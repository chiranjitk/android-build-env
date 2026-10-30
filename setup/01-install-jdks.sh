#!/usr/bin/env bash
# =============================================================
# 01: Install JDK 17 + JDK 21 (Eclipse Temurin) to /home/z/
# Creates stable symlinks: /home/z/jdk-17 and /home/z/jdk-21
# Idempotent: skips if already installed.
# =============================================================
set -euo pipefail

H=/home/z

ensure_jdk() {
  local MAJOR="$1" PIN_URL="$2" API_URL="$3" SYMLINK="$4"

  if [ -L "$SYMLINK" ] && [ -d "$SYMLINK" ]; then
    echo "OK: JDK $MAJOR already present -> $(readlink "$SYMLINK")"
    return 0
  fi

  # Detect any already-extracted jdk-$MAJOR* dir
  local existing
  existing=$(ls -d "$H"/jdk-"$MAJOR".*+* 2>/dev/null | head -1 || true)
  if [ -n "$existing" ] && [ -d "$existing" ]; then
    ln -sfn "$existing" "$SYMLINK"
    echo "OK: JDK $MAJOR found at $existing (linked)"
    return 0
  fi

  echo ">> Downloading JDK $MAJOR (Temurin)..."
  local TMP
  TMP=$(mktemp "/tmp/jdk$MAJOR.tar.gz.XXXXXX")
  # Try pinned release first, fallback to Adoptium latest-GA API redirect
  curl -fSL --retry 3 -o "$TMP" "$PIN_URL" \
    || curl -fSL --retry 3 -o "$TMP" "$API_URL"
  tar -xzf "$TMP" -C "$H"
  rm -f "$TMP"

  local extracted
  extracted=$(ls -d "$H"/jdk-"$MAJOR".* 2>/dev/null | grep -v -- '->' | head -1 || true)
  if [ -z "$extracted" ] || [ ! -d "$extracted" ]; then
    echo "ERROR: JDK $MAJOR extraction failed"; exit 1
  fi
  ln -sfn "$extracted" "$SYMLINK"
  echo "OK: JDK $MAJOR installed -> $extracted (linked as $SYMLINK)"
}

ensure_jdk 17 \
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.21%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.21_9.tar.gz" \
  "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
  "$H/jdk-17"

ensure_jdk 21 \
  "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz" \
  "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse" \
  "$H/jdk-21"

echo "--- verify ---"
"$H/jdk-17/bin/java" -version 2>&1 | head -1
"$H/jdk-21/bin/java" -version 2>&1 | head -1
echo "DONE: 01-install-jdks.sh"
