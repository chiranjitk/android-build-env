#!/usr/bin/env bash
# =============================================================
# Build TakaTrack (release-signed) -> public/takatrack.apk
# Requires: /home/z/takatrack (setup/03) + JDK 21 + Android SDK
# Signing: signing.properties + takatrack.jks (repo te ache)
# HISTORY: v1.0 keystore LOST in Oct 30 sandbox reset.
#          v1.1+ uses the NEW keystore committed here - old
#          installed v1.0 builds must be uninstalled first
#          (signature mismatch).
# =============================================================
set -euo pipefail
export JAVA_HOME=/home/z/jdk-21
export PATH="$JAVA_HOME/bin:$PATH"

cd /home/z/takatrack
echo ">> Building TakaTrack (assembleRelease, signed) with JAVA_HOME=$JAVA_HOME"
./gradlew assembleRelease

OUT=app/build/outputs/apk/release
ls -la "$OUT"/
SIGNED=$(ls "$OUT"/*-release.apk 2>/dev/null | head -1 || ls "$OUT"/*.apk | head -1)
cp -f "$SIGNED" /home/z/my-project/public/takatrack.apk
echo ">> Copied $SIGNED -> /home/z/my-project/public/takatrack.apk"
"$HOME/android-sdk/build-tools/37.0.0/aapt" dump badging /home/z/my-project/public/takatrack.apk | head -2
