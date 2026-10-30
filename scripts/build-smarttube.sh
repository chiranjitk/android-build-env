#!/usr/bin/env bash
# =============================================================
# Build SmartTube v32.68 (ststable flavor) -> public/smarttube.apk
# Requires: /home/z/smarttube (setup/03) + JDK 17 + Android SDK
# NOTE: build takes 15-25 min on 4GB cgroup (single-worker tuned)
# =============================================================
set -euo pipefail
export JAVA_HOME=/home/z/jdk-17
export PATH="$JAVA_HOME/bin:$PATH"

cd /home/z/smarttube
echo ">> Building SmartTube (assembleStstableDebug) with JAVA_HOME=$JAVA_HOME"
./gradlew assembleStstableDebug

OUT=smarttubetv/build/outputs/apk/ststable/debug
echo ">> Output APKs:"
ls -la "$OUT"/
# Universal APK = the largest one (includes all ABIs)
UNIVERSAL=$(ls -S "$OUT"/*.apk | head -1)
cp -f "$UNIVERSAL" /home/z/my-project/public/smarttube.apk
echo ">> Copied $UNIVERSAL -> /home/z/my-project/public/smarttube.apk"
"$HOME/android-sdk/build-tools/30.0.3/aapt" dump badging /home/z/my-project/public/smarttube.apk | head -2
