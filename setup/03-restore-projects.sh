#!/usr/bin/env bash
# =============================================================
# 03: Restore Android projects to /home/z/
#   - SmartTube : clone (pinned commit) + submodules + patched configs
#   - NewPipe   : clone (pinned tag v0.29.1)
#   - Kharcha   : copy full source from this repo
#   - TakaTrack : copy full source + keystore from this repo
# Idempotent. Use FORCE=1 to overwrite existing copies.
# =============================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H=/home/z
FORCE="${FORCE:-0}"

# ---------- SmartTube ----------
ST_PIN="4b3f333e540a1403429d1a9d86dec758e59288f9"
if [ ! -d "$H/smarttube/.git" ]; then
  echo ">> Cloning SmartTube..."
  git clone https://github.com/yuliskov/SmartTube "$H/smarttube"
else
  echo "OK: SmartTube already cloned"
fi
echo ">> SmartTube: checkout pinned commit $ST_PIN"
git -C "$H/smarttube" fetch origin master --quiet || true
git -C "$H/smarttube" checkout -q "$ST_PIN"
echo ">> SmartTube: init submodules (MediaServiceCore, SharedModules)..."
git -C "$H/smarttube" submodule update --init --recursive
echo ">> SmartTube: applying patched build configs (Maven Central mirror + memory tuning)..."
cp "$REPO_DIR/configs/smarttube/build.gradle"      "$H/smarttube/build.gradle"
cp "$REPO_DIR/configs/smarttube/gradle.properties" "$H/smarttube/gradle.properties"
cp "$REPO_DIR/configs/smarttube/local.properties"  "$H/smarttube/local.properties"
chmod +x "$H/smarttube/gradlew"

# ---------- NewPipe ----------
NP_PIN="00acf2f318b0af7ffacbd687bba011b642cc01d0"   # tag v0.29.1
if [ ! -d "$H/newpipe-src/.git" ]; then
  echo ">> Cloning NewPipe (v0.29.1)..."
  git clone --branch v0.29.1 https://github.com/TeamNewPipe/NewPipe.git "$H/newpipe-src"
else
  echo "OK: NewPipe already cloned"
fi
git -C "$H/newpipe-src" checkout -q "$NP_PIN"

# ---------- Kharcha ----------
if [ -d "$REPO_DIR/projects/kharcha" ]; then
  if [ ! -f "$H/kharcha/gradlew" ] || [ "$FORCE" = "1" ]; then
    echo ">> Restoring Kharcha from repo..."
    rm -rf "$H/kharcha"
    cp -r "$REPO_DIR/projects/kharcha" "$H/kharcha"
    chmod +x "$H/kharcha/gradlew"
  else
    echo "OK: Kharcha already present (FORCE=1 to overwrite)"
  fi
else
  echo "WARN: projects/kharcha missing in repo (see README - source rewrite pending)"
fi

# ---------- TakaTrack ----------
if [ -d "$REPO_DIR/projects/takatrack" ]; then
  if [ ! -f "$H/takatrack/gradlew" ] || [ "$FORCE" = "1" ]; then
    echo ">> Restoring TakaTrack (with keystore) from repo..."
    rm -rf "$H/takatrack"
    cp -r "$REPO_DIR/projects/takatrack" "$H/takatrack"
    chmod +x "$H/takatrack/gradlew"
  else
    echo "OK: TakaTrack already present (FORCE=1 to overwrite)"
  fi
else
  echo "WARN: projects/takatrack missing in repo (v1.0 keystore was lost in Oct 30 reset; v1.1 rebuild pending)"
fi

echo "--- summary ---"
echo "smarttube   HEAD : $(git -C "$H/smarttube" rev-parse --short HEAD) (submodules: $(git -C "$H/smarttube" submodule status | wc -l))"
echo "newpipe-src HEAD : $(git -C "$H/newpipe-src" describe --tags 2>/dev/null || git -C "$H/newpipe-src" rev-parse --short HEAD)"
echo "kharcha          : $([ -f "$H/kharcha/gradlew" ] && echo ready || echo MISSING)"
echo "takatrack        : $([ -f "$H/takatrack/gradlew" ] && echo ready || echo MISSING) (jks: $([ -f "$H/takatrack/takatrack.jks" ] && echo present || echo none))"
echo "DONE: 03-restore-projects.sh"
