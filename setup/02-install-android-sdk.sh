#!/usr/bin/env bash
# =============================================================
# 02: Install Android SDK (cmdline-tools + packages) to
#     /home/z/android-sdk
# Packages: platform-tools,
#           platforms;android-34, platforms;android-37.0,
#           build-tools;30.0.3, build-tools;36.0.0, build-tools;37.0.0
# Idempotent: skips pieces that already exist.
# =============================================================
set -euo pipefail

SDK=/home/z/android-sdk

if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo ">> Downloading Android cmdline-tools..."
  curl -fSL --retry 3 -o /tmp/clt.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  mkdir -p "$SDK/cmdline-tools"
  cd "$SDK/cmdline-tools"
  unzip -q /tmp/clt.zip
  rm -rf latest
  mv cmdline-tools latest
  rm -f /tmp/clt.zip
else
  echo "OK: cmdline-tools already present"
fi

SDKM="$SDK/cmdline-tools/latest/bin/sdkmanager"

echo ">> Accepting SDK licenses..."
yes | "$SDKM" --licenses > /dev/null 2>&1 || true

echo ">> Installing SDK packages (this downloads ~500MB, please wait)..."
"$SDKM" --install \
  "platform-tools" \
  "platforms;android-34" \
  "platforms;android-37.0" \
  "build-tools;30.0.3" \
  "build-tools;36.0.0" \
  "build-tools;37.0.0"

echo "--- verify ---"
ls "$SDK/platforms" "$SDK/build-tools" 2>/dev/null
[ -x "$SDK/build-tools/30.0.3/aapt" ] && echo "OK: aapt 30.0.3 present"
[ -x "$SDK/platform-tools/adb" ] && echo "OK: adb present"
echo "DONE: 02-install-android-sdk.sh"
