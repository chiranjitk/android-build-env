#!/usr/bin/env bash
# =============================================================
# Build NewPipe v0.29.1 (debug) -> public/newpipe.apk
# Requires: /home/z/newpipe-src (setup/03) + JDK 17 + Android SDK
# NOTE: build takes 10-20 min
# =============================================================
set -euo pipefail
export JAVA_HOME=/home/z/jdk-17
export PATH="$JAVA_HOME/bin:$PATH"

cd /home/z/newpipe-src
echo ">> Building NewPipe (assembleDebug) with JAVA_HOME=$JAVA_HOME"
./gradlew assembleDebug

OUT=app/build/outputs/apk/debug
ls -la "$OUT"/
cp -f "$OUT/app-debug.apk" /home/z/my-project/public/newpipe.apk
echo ">> Copied -> /home/z/my-project/public/newpipe.apk"
"$HOME/android-sdk/build-tools/30.0.3/aapt" dump badging /home/z/my-project/public/newpipe.apk | head -2
