#!/usr/bin/env bash
# =============================================================
# 04: Restore the Next.js download page to /home/z/my-project
#   NOTE: my-project usually SURVIVES sandbox resets (persistent
#   volume - proven Oct 30). This script is the worst-case path.
#   - overwrites the scaffold with our app
#   - installs deps (bun install)
#   - places all APKs into public/ for download
# Use SKIP=1 to leave existing my-project untouched (APK placement
# and install are skipped too).
# =============================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H=/home/z
SKIP="${SKIP:-0}"

if [ "$SKIP" = "1" ]; then
  echo "SKIP=1: leaving my-project as-is"
else
  echo ">> Restoring my-project (Next.js download page) from repo..."
  rm -rf "$H/my-project"
  cp -r "$REPO_DIR/my-project" "$H/my-project"
  if command -v bun > /dev/null 2>&1; then
    echo ">> bun install..."
    (cd "$H/my-project" && bun install)
  else
    echo ">> bun not found, using npm install..."
    (cd "$H/my-project" && npm install)
  fi
fi

echo ">> Placing APKs into my-project/public/ ..."
cp -f "$REPO_DIR/apks/"*.apk "$H/my-project/public/"

echo "DONE: 04-restore-myproject.sh"
echo "NEXT: cd /home/z/my-project && (bun run dev > /dev/null 2>&1 &)   # background"
