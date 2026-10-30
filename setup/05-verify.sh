#!/usr/bin/env bash
# =============================================================
# 05: Verify the whole environment after restore
# =============================================================
set -uo pipefail
H=/home/z
PASS=0; FAIL=0

chk() { # desc, condition-result($?)
  if [ "$2" -eq 0 ]; then echo "  [PASS] $1"; PASS=$((PASS+1));
  else echo "  [FAIL] $1"; FAIL=$((FAIL+1)); fi
}

echo "=== Environment Verification ==="

"$H/jdk-17/bin/java" -version > /dev/null 2>&1; chk "JDK 17 (/home/z/jdk-17)" $?
"$H/jdk-21/bin/java" -version > /dev/null 2>&1; chk "JDK 21 (/home/z/jdk-21)" $?

[ -x "$H/android-sdk/cmdline-tools/latest/bin/sdkmanager" ]; chk "Android cmdline-tools" $?
[ -d "$H/android-sdk/platforms/android-34" ];        chk "platform android-34" $?
[ -d "$H/android-sdk/platforms/android-37.0" ];      chk "platform android-37.0" $?
[ -d "$H/android-sdk/build-tools/30.0.3" ];          chk "build-tools 30.0.3" $?
[ -d "$H/android-sdk/build-tools/37.0.0" ];          chk "build-tools 37.0.0" $?
[ -x "$H/android-sdk/platform-tools/adb" ];          chk "adb (platform-tools)" $?

[ -f "$H/smarttube/gradlew" ] && [ -x "$H/smarttube/gradlew" ];               chk "SmartTube source + gradlew" $?
[ -d "$H/smarttube/SharedModules" ] && [ -d "$H/smarttube/MediaServiceCore" ]; chk "SmartTube submodules" $?
grep -q "maven-central.storage" "$H/smarttube/build.gradle" 2>/dev/null;      chk "SmartTube patched build.gradle (mirror)" $?

[ -f "$H/newpipe-src/gradlew" ]; chk "NewPipe source (v0.29.1)" $?

[ -f "$H/kharcha/gradlew" ];     chk "Kharcha source" $?
[ -f "$H/takatrack/gradlew" ] && [ -f "$H/takatrack/takatrack.jks" ]; chk "TakaTrack source + keystore" $?

[ -f "$H/my-project/src/app/page.tsx" ]; chk "my-project (download page)" $?
for a in smarttube kharcha newpipe takatrack; do
  [ -f "$H/my-project/public/$a.apk" ]; chk "APK served: $a.apk" $?
done

echo "==============================="
echo "RESULT: $PASS passed, $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo "ALL GOOD. Start dev server:"
  echo "  cd /home/z/my-project && bun run dev   (background)"
else
  echo "Some checks failed - re-run setup/restore-all.sh or check RESTORE.md"
fi
exit "$FAIL"
