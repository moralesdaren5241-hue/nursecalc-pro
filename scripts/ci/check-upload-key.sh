#!/usr/bin/env bash
# Restore and pre-check the private Play upload key BEFORE Gradle runs.
#
# Reads (from GitHub secrets, passed only to this step and the Gradle step):
#   UPLOAD_KEYSTORE_BASE64            base64 of nursecalc-upload.jks
#   NURSECALC_UPLOAD_STORE_PASSWORD   keystore password
#   NURSECALC_UPLOAD_KEY_ALIAS        key alias
#   NURSECALC_UPLOAD_KEY_PASSWORD     key password
#
# It signs a throwaway jar with exactly these values (the same thing Gradle does
# for the AAB) and explains any failure in plain words. Passwords are passed to
# keytool/jarsigner through environment variables (-storepass:env), never on a
# command line, and are never printed. The only key detail printed is the
# certificate's public SHA-256 fingerprint.
#
# No keystore secret  -> safe unsigned build (NURSECALC_HAS_UPLOAD_KEY=false).
# Secret present but unusable -> fail here with the reason, before Gradle.
set -uo pipefail

ENV_OUT="${GITHUB_ENV:-/dev/null}"
KS="${RUNNER_TEMP:-/tmp}/upload.jks"
err() { echo "::error title=Upload key::$*"; echo "ERROR: $*" >&2; }

if [ -z "${UPLOAD_KEYSTORE_BASE64:-}" ]; then
  echo "NURSECALC_HAS_UPLOAD_KEY=false" >> "$ENV_OUT"
  echo "::warning::No upload keystore secret — the AAB will be UNSIGNED. See docs/ANDROID_RELEASE.md."
  exit 0
fi

missing=()
[ -n "${NURSECALC_UPLOAD_STORE_PASSWORD:-}" ] || missing+=(ANDROID_UPLOAD_STORE_PASSWORD)
[ -n "${NURSECALC_UPLOAD_KEY_ALIAS:-}" ]      || missing+=(ANDROID_UPLOAD_KEY_ALIAS)
[ -n "${NURSECALC_UPLOAD_KEY_PASSWORD:-}" ]   || missing+=(ANDROID_UPLOAD_KEY_PASSWORD)
if [ ${#missing[@]} -gt 0 ]; then
  err "ANDROID_UPLOAD_KEYSTORE_BASE64 is set but these secrets are empty or missing: ${missing[*]}."
  exit 1
fi

# Decode. Line breaks, spaces and Windows CR characters from copy/paste are removed first.
if ! printf '%s' "$UPLOAD_KEYSTORE_BASE64" | tr -d ' \t\r\n' | base64 -d > "$KS" 2>/dev/null || [ ! -s "$KS" ]; then
  err "ANDROID_UPLOAD_KEYSTORE_BASE64 is not valid base64. Re-encode nursecalc-upload.jks (docs/ANDROID_RELEASE.md §3) and paste the whole output."
  rm -f "$KS"; exit 1
fi
MAGIC="$(head -c 4 "$KS" | od -An -tx1 | tr -d ' \n')"
case "$MAGIC" in
  feedfeed) KTYPE="JKS" ;;
  30*)      KTYPE="PKCS12" ;;
  *) err "The decoded secret is not a Java keystore (it starts with bytes $MAGIC; size $(stat -c%s "$KS") bytes). Encode the .jks file itself, not a text file or a copy of its contents."
     rm -f "$KS"; exit 1 ;;
esac
echo "Decoded keystore: $(stat -c%s "$KS") bytes, format $KTYPE"

# 1. Store password
if ! LIST="$(keytool -list -keystore "$KS" -storepass:env NURSECALC_UPLOAD_STORE_PASSWORD 2>&1)"; then
  if grep -qiE 'password was incorrect|keystore password was incorrect|tampered' <<<"$LIST"; then
    err "ANDROID_UPLOAD_STORE_PASSWORD does not open this keystore (wrong password)."
  else
    err "keytool could not read the keystore: $(grep -v 'JAVA_TOOL_OPTIONS' <<<"$LIST" | grep -m1 -iE 'error|exception' | sed 's/keytool error: //')"
  fi
  rm -f "$KS"; exit 1
fi
ENTRIES="$(grep -c 'PrivateKeyEntry' <<<"$LIST" || true)"
echo "Store password OK; private key entries in the keystore: $ENTRIES"

# 2. Alias
if ! keytool -list -keystore "$KS" -storepass:env NURSECALC_UPLOAD_STORE_PASSWORD -alias "$NURSECALC_UPLOAD_KEY_ALIAS" >/dev/null 2>&1; then
  err "ANDROID_UPLOAD_KEY_ALIAS does not match any key in the keystore ($ENTRIES private key entries found). The alias you created with keytool -alias must be entered exactly, same letters and case."
  rm -f "$KS"; exit 1
fi
echo "Alias found"

# 3. Key password: sign a throwaway jar exactly as Gradle will.
WORK="$(mktemp -d)"
echo probe > "$WORK/probe.txt"
(cd "$WORK" && jar cf probe.jar probe.txt)
if ! SIGN="$(jarsigner -keystore "$KS" -storepass:env NURSECALC_UPLOAD_STORE_PASSWORD -keypass:env NURSECALC_UPLOAD_KEY_PASSWORD "$WORK/probe.jar" "$NURSECALC_UPLOAD_KEY_ALIAS" 2>&1)"; then
  # Diagnose only: would the store password open the key? (Common with PKCS12, where both are the same.)
  if jarsigner -keystore "$KS" -storepass:env NURSECALC_UPLOAD_STORE_PASSWORD -keypass:env NURSECALC_UPLOAD_STORE_PASSWORD "$WORK/probe.jar" "$NURSECALC_UPLOAD_KEY_ALIAS" >/dev/null 2>&1; then
    err "ANDROID_UPLOAD_KEY_PASSWORD is wrong. This $KTYPE keystore's key opens with the STORE password: set the ANDROID_UPLOAD_KEY_PASSWORD secret to the same value as ANDROID_UPLOAD_STORE_PASSWORD. (Modern keytool makes PKCS12 keystores whose key password always equals the store password.)"
  else
    WHY="$(grep -v 'JAVA_TOOL_OPTIONS' <<<"$SIGN" | grep -m1 -v '^\s*$' | sed -E 's/^jarsigner( error)?: //')"
    err "ANDROID_UPLOAD_KEY_PASSWORD does not unlock the key (jarsigner: ${WHY:-no details}). Enter the key password you chose when creating nursecalc-upload.jks; if you pressed Enter at that prompt, it is the same as the store password."
  fi
  rm -rf "$WORK" "$KS"; exit 1
fi
rm -rf "$WORK"
echo "Key password OK: a test signature with the upload key succeeded"

# Public certificate fingerprint (safe to show; compare with Play Console → App integrity → Upload key certificate).
FP="$(keytool -list -v -keystore "$KS" -storepass:env NURSECALC_UPLOAD_STORE_PASSWORD -alias "$NURSECALC_UPLOAD_KEY_ALIAS" 2>/dev/null | grep -m1 'SHA256:' | awk '{print $2}')"
echo "Upload certificate SHA-256: $FP"
TEST_FP="$(keytool -list -v -keystore android/app/nursecalc-test.keystore -storepass nursecalc-test -alias nursecalc 2>/dev/null | grep -m1 'SHA256:' | awk '{print $2}')"
if [ -n "$TEST_FP" ] && [ "$FP" = "$TEST_FP" ]; then
  err "The upload key secret contains the PUBLIC test key. Use your private nursecalc-upload.jks."
  rm -f "$KS"; exit 1
fi

{
  echo "NURSECALC_UPLOAD_STORE_FILE=$KS"
  echo "NURSECALC_HAS_UPLOAD_KEY=true"
  echo "NURSECALC_UPLOAD_CERT_SHA256=$(tr -d ':' <<<"$FP" | tr 'A-F' 'a-f')"
} >> "$ENV_OUT"
echo "Upload key ready: the AAB and release APK will be signed for Play upload."
