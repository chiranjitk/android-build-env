#!/usr/bin/env bash
# =============================================================
# Build Kharcha (Bangla expense tracker) -> public/kharcha.apk
# Requires: /home/z/kharcha (setup/03) + JDK 21 + Android SDK
# =============================================================
set -euo pipefail
export JAVA_HOME=/home/z/jdk-21
export PATH="$JAVA_HOME/bin:$PATH"

cd /home/z/kharcha
echo ">> Building Kharcha (assembleDebug) with JAVA_HOME=$JAVA_HOME"
./gradlew assembleDebug

OUT=app/build/outputs/apk/debug
ls -la "$OUT"/
cp -f "$OUT/app-debug.apk" /home/z/my-project/public/kharcha.apk
echo ">> Copied -> /home/z/my-project/public/kharcha.apk"
"$HOME/android-sdk/build-tools/37.0.0/aapt" dump badging /home/z/my-project/public/kharcha.apk | head -2
