#!/usr/bin/env bash
# Verifies the Android release outputs before they are trusted or uploaded.
# Usage: verify-android.sh <report-dir>
# Fails (exit 1) if any Play-relevant property is wrong.
set -uo pipefail

OUT="${1:-ci-report}"
mkdir -p "$OUT"
REPORT="$OUT/android-verify.txt"
: > "$REPORT"
FAILS=0
log()  { echo "$*" | tee -a "$REPORT"; }
pass() { log "PASS  $*"; }
fail() { log "FAIL  $*"; echo "::error title=verify-android::$*"; FAILS=$((FAILS + 1)); }
expect() { local name="$1" cond="$2"; if [ "$cond" = "1" ]; then pass "$name"; else fail "$name"; fi; }
has() { grep -qE "$2" <<<"$1" && echo 1 || echo 0; }
hasnt() { grep -qE "$2" <<<"$1" && echo 0 || echo 1; }

BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
AAPT2="$BT/aapt2"
APKSIGNER="$BT/apksigner"
APP=android/app/build/outputs
AAB="$APP/bundle/release/app-release.aab"
SIDELOAD="$APP/apk/sideload/app-sideload.apk"
RELEASE_APK="$(ls "$APP"/apk/release/*.apk 2>/dev/null | head -1)"
VERSION="$(node -p "require('./package.json').version")"

log "NurseCalc Pro Android build verification — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "build-tools: $(basename "$BT"); expected versionName: $VERSION"
log ""

for f in "$AAB" "$SIDELOAD" "$RELEASE_APK"; do
  if [ -n "$f" ] && [ -f "$f" ]; then pass "exists: $f ($(stat -c %s "$f") bytes)"; else fail "exists: ${f:-release APK}"; fi
done
log ""

# ---- APK manifest (sideload APK has the same manifest as release) ----
BADGING="$("$AAPT2" dump badging "$SIDELOAD" 2>&1)"
echo "$BADGING" > "$OUT/badging.txt"
log "$(grep -E "^package:|sdkVersion|targetSdkVersion|uses-permission|application-label:|application-debuggable" <<<"$BADGING")"
expect "applicationId com.nursecalcpro.app"   "$(has "$BADGING" "^package: name='com.nursecalcpro.app'")"
expect "versionName matches package.json ($VERSION)" "$(has "$BADGING" "versionName='$VERSION'")"
expect "targetSdkVersion 36"                  "$(has "$BADGING" "^targetSdkVersion:'36'")"
expect "minSdkVersion 24"                     "$(has "$BADGING" "^sdkVersion:'24'")"
expect "app label NurseCalc Pro"              "$(has "$BADGING" "^application-label:'NurseCalc Pro'")"
expect "not debuggable"                       "$(hasnt "$BADGING" "application-debuggable")"
expect "no INTERNET permission"               "$(hasnt "$BADGING" "uses-permission: name='android.permission.INTERNET'")"
expect "no dangerous permissions (location, camera, storage, contacts, phone, mic)" \
  "$(hasnt "$BADGING" "permission: name='android.permission.(ACCESS_(FINE|COARSE)_LOCATION|CAMERA|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|READ_CONTACTS|READ_PHONE_STATE|RECORD_AUDIO|READ_MEDIA_[A-Z_]+|POST_NOTIFICATIONS)'")"

XMLTREE="$("$AAPT2" dump xmltree --file AndroidManifest.xml "$SIDELOAD" 2>&1)"
echo "$XMLTREE" > "$OUT/manifest-xmltree.txt"
expect "allowBackup=false" "$(has "$XMLTREE" 'allowBackup.*=false')"
log ""

# ---- Bundled web app ----
ASSETS="$(unzip -l "$AAB")"
expect "AAB contains the web app (base/assets/public/index.html)" "$(has "$ASSETS" 'base/assets/public/index.html')"
expect "AAB contains the WebView-update fallback page"           "$(has "$ASSETS" 'base/assets/public/webview-update.html')"
CAPCFG="$(unzip -p "$AAB" base/assets/capacitor.config.json 2>/dev/null)"
echo "$CAPCFG" > "$OUT/capacitor.config.bundled.json"
expect "WebView debugging disabled in bundled config" "$(has "$CAPCFG" '"webContentsDebuggingEnabled": *false')"
expect "bridge logging disabled in bundled config"    "$(has "$CAPCFG" '"loggingBehavior": *"none"')"
INDEX="$(unzip -p "$AAB" base/assets/public/index.html 2>/dev/null)"
expect "no localhost/dev-server URLs in the web bundle" "$(hasnt "$INDEX" 'https?://(localhost|127\.0\.0\.1|10\.0\.2\.2):[0-9]+')"
expect "no remote script or font loads in the web bundle" "$(hasnt "$INDEX" '<(script|link)[^>]+(src|href)="https?://')"
log ""

# ---- AAB manifest via bundletool ----
BT_URL="$(curl -fsSL https://api.github.com/repos/google/bundletool/releases/latest | grep -oE 'https://[^"]+bundletool-all-[0-9.]+\.jar' | head -1)"
if [ -n "$BT_URL" ] && curl -fsSL -o "$RUNNER_TEMP/bundletool.jar" "$BT_URL"; then
  AABMAN="$(java -jar "$RUNNER_TEMP/bundletool.jar" dump manifest --bundle "$AAB" 2>&1)"
  echo "$AABMAN" > "$OUT/aab-manifest.xml"
  expect "AAB targetSdkVersion 36" "$(has "$AABMAN" 'targetSdkVersion="36"')"
  expect "AAB versionName $VERSION" "$(has "$AABMAN" "versionName=\"$VERSION\"")"
  log "AAB versionCode: $(grep -oE 'versionCode="[0-9]+"' <<<"$AABMAN")"
else
  fail "download bundletool to inspect the AAB manifest"
fi
log ""

# ---- Signing ----
TEST_SHA="$(keytool -list -v -keystore android/app/nursecalc-test.keystore -storepass nursecalc-test -alias nursecalc 2>/dev/null | grep -m1 'SHA256:' | awk '{print $2}' | tr -d ':' | tr 'A-F' 'a-f')"
SIDE_CERT="$("$APKSIGNER" verify --print-certs "$SIDELOAD" 2>&1)"
expect "sideload APK signature verifies" "$(has "$SIDE_CERT" 'certificate SHA-256 digest')"
if [ "${NURSECALC_HAS_UPLOAD_KEY:-false}" = "true" ]; then
  REL_CERT="$("$APKSIGNER" verify --print-certs "$RELEASE_APK" 2>&1)"
  expect "release APK signed with upload key" "$(has "$REL_CERT" 'certificate SHA-256 digest')"
  expect "release APK NOT signed with the public test key" "$(hasnt "$REL_CERT" "$TEST_SHA")"
  JS="$(jarsigner -verify -verbose -certs "$AAB" 2>&1)"
  expect "AAB is signed (jar verified)" "$(has "$JS" 'jar verified')"
  log "AAB signing: SIGNED with the private upload key"
else
  JS="$(jarsigner -verify "$AAB" 2>&1)"
  expect "AAB is unsigned when no upload key is configured (never test-signed)" "$(has "$JS" 'jar is unsigned')"
  log "AAB signing: UNSIGNED — add the upload-key secrets (docs/ANDROID_RELEASE.md) to produce an uploadable AAB"
fi

log ""
log "Result: $FAILS failed check(s)"
exit $(( FAILS > 0 ? 1 : 0 ))
