#!/usr/bin/env bash
# Android emulator smoke test for the release-configured (sideload-signed) APK.
# Usage: emulator-smoke.sh <apk> <report-dir>
# Every check is recorded in <report-dir>/emulator.txt with screenshots. The script
# runs all checks, then exits non-zero if any failed.
set -uo pipefail

APK="$1"
OUT="$2"
PKG="com.nursecalcpro.app"
ACT="$PKG/.MainActivity"
UI="python3 $(dirname "$0")/ui.py"
mkdir -p "$OUT/screenshots"
REPORT="$OUT/emulator.txt"
: > "$REPORT"
FAILS=0

log()  { echo "$*" | tee -a "$REPORT"; }
pass() { log "PASS  $*"; }
fail() { log "FAIL  $*"; echo "::error title=emulator-smoke::$*"; FAILS=$((FAILS + 1)); }
check() { local name="$1"; shift; if "$@" >/dev/null 2>&1; then pass "$name"; else fail "$name"; fi; }
shot() { adb exec-out screencap -p > "$OUT/screenshots/$1.png" && log "      screenshot $1.png"; }
wait_for() { # wait_for TEXT [seconds]
  local t="$1" n="${2:-20}"
  for _ in $(seq 1 "$n"); do $UI has "$t" >/dev/null 2>&1 && return 0; sleep 1; done
  return 1
}
launch() { adb shell am start -W -n "$ACT" | tee -a "$REPORT" | grep -q "Status: ok"; }

log "NurseCalc Pro emulator smoke test — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Device: $(adb shell getprop ro.product.model | tr -d '\r'), Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r'))"
log "WebView: $(adb shell dumpsys webviewupdate | grep -m1 'Current WebView package' | tr -d '\r')"
log "APK: $APK ($(stat -c %s "$APK") bytes)"
log ""

adb logcat -c
check "install APK" adb install -r -g "$APK"

log ""; log "-- Permissions granted to the installed app"
adb shell dumpsys package "$PKG" | sed -n '/requested permissions:/,/install permissions:/p' | tee -a "$REPORT"
if adb shell dumpsys package "$PKG" | grep -q "android.permission.INTERNET"; then fail "no INTERNET permission"; else pass "no INTERNET permission"; fi

log ""; log "-- First launch"
check "cold launch reports Status: ok" launch
if wait_for "Quick access" 30; then pass "home screen rendered (web content visible)"; else fail "home screen rendered (web content visible)"; fi
shot 01-home
$UI dump "$OUT/home-hierarchy.xml" >/dev/null 2>&1
check "bottom tab bar visible (Calculators)" $UI has "Calculators"
check "disclaimer visible on home" $UI has "Educational and calculation aid"

log ""; log "-- Calculation"
check "open Drug dose from Quick access" $UI tap "Drug dose"
if wait_for "Try example" 10; then pass "drug dose calculator opened"; else fail "drug dose calculator opened"; fi
shot 02-drug-dose
check "tap Try example" $UI tap "Try example"
sleep 2
# Example: 125 mg ordered, 250 mg in 5 mL → (125 ÷ 250) × 5 = 2.5 mL
if wait_for "2.5" 10; then pass "example result 2.5 mL shown"; else fail "example result 2.5 mL shown"; fi
shot 03-drug-dose-result

log ""; log "-- Android back button"
adb shell input keyevent KEYCODE_BACK; sleep 2
if wait_for "Quick access" 10; then pass "back from calculator returns to Home"; else fail "back from calculator returns to Home"; fi
check "tap Settings tab" $UI tap "Settings" --last
sleep 2
shot 04-settings
adb shell input keyevent KEYCODE_BACK; sleep 2
if wait_for "Quick access" 10; then pass "back from Settings tab root returns to Home (does not exit)"; else fail "back from Settings tab root returns to Home (does not exit)"; fi
check "app still in foreground after back to Home" $UI focus "$PKG"
adb shell input keyevent KEYCODE_BACK; sleep 3
check "back at Home root exits the app" $UI unfocused "$PKG"

log ""; log "-- Background and resume"
check "relaunch" launch
wait_for "Quick access" 20 >/dev/null
adb shell input keyevent KEYCODE_HOME; sleep 3
check "app left foreground on HOME" $UI unfocused "$PKG"
check "resume from background" launch
if wait_for "Quick access" 15; then pass "content intact after resume"; else fail "content intact after resume"; fi

log ""; log "-- Process restart"
adb shell am force-stop "$PKG"; sleep 1
check "launch after force-stop" launch
if wait_for "Quick access" 30; then pass "content after restart"; else fail "content after restart"; fi
shot 05-after-restart

log ""; log "-- Rotation"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1; sleep 3
if wait_for "Quick access" 15; then pass "landscape renders"; else fail "landscape renders"; fi
shot 06-landscape
adb shell settings put system user_rotation 0; sleep 2

log ""; log "-- System dark mode"
adb shell cmd uimode night yes; sleep 2
adb shell am force-stop "$PKG"; launch >/dev/null
if wait_for "Quick access" 30; then pass "dark mode renders"; else fail "dark mode renders"; fi
shot 07-dark
adb shell cmd uimode night no

log ""; log "-- Crash and log scan"
adb logcat -d > "$OUT/logcat.txt"
if grep -E "FATAL EXCEPTION|ANR in $PKG|Process: $PKG" "$OUT/logcat.txt" >/dev/null; then
  fail "no crashes or ANRs in logcat"; grep -E -A15 "FATAL EXCEPTION|ANR in $PKG" "$OUT/logcat.txt" | head -60 | tee -a "$REPORT"
else
  pass "no crashes or ANRs in logcat"
fi
if grep -i "Capacitor/Console" "$OUT/logcat.txt" >/dev/null; then fail "web console not logged in release (loggingBehavior none)"; else pass "web console not logged in release (loggingBehavior none)"; fi

log ""
log "Result: $FAILS failed check(s)"
exit $(( FAILS > 0 ? 1 : 0 ))
