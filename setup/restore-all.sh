#!/usr/bin/env bash
# =============================================================
# restore-all: ONE COMMAND to restore the entire environment
#   on a fresh/reset sandbox.
# Usage:  bash setup/restore-all.sh            (normal)
#         FORCE=1 bash setup/restore-all.sh    (overwrite everything)
#         SKIP=1  ... to skip my-project restore
# IMPORTANT (Oct 30 lesson): my-project SURVIVES resets (persistent
# volume). Push this repo to GitHub FIRST before any long work.
# =============================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

banner() { echo; echo "================================================="; echo "  $1"; echo "================================================="; }

banner "STEP 1/5 - JDK 17 + 21"
bash "$DIR/01-install-jdks.sh"

banner "STEP 2/5 - Android SDK"
bash "$DIR/02-install-android-sdk.sh"

banner "STEP 3/5 - Android projects (SmartTube/NewPipe/Kharcha/TakaTrack)"
bash "$DIR/03-restore-projects.sh"

if [ "${SKIP:-0}" != "1" ]; then
  banner "STEP 4/5 - Next.js download page + APK placement"
  bash "$DIR/04-restore-myproject.sh"
else
  echo "SKIP=1: step 4 skipped (my-project left as-is), APKs still placed"
  cp -f "$(dirname "$DIR")/apks/"*.apk /home/z/my-project/public/ 2>/dev/null || true
fi

banner "STEP 5/5 - Verification"
bash "$DIR/05-verify.sh" || true

banner "RESTORE COMPLETE"
cat <<'EOF'
Next steps:
  1. Start dev server (background):  cd /home/z/my-project && (bun run dev > /dev/null 2>&1 &)
  2. Check it is up:                 curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
  3. Build any app:                  bash /home/z/android-build-env/scripts/build-<name>.sh
     (smarttube | kharcha | takatrack | newpipe | all)
EOF
