#!/usr/bin/env bash
# =============================================================
# 04: Restore the Next.js app (Adda chat + APK download links)
#   NOTE: my-project usually SURVIVES sandbox resets (persistent
#   volume - proven Oct 30). This script is the worst-case path.
#   - overwrites the scaffold with our app (Adda chat app)
#   - installs deps (bun install) + pushes Prisma schema + seeds
#   - installs the socket mini-service (mini-services/chat-service)
#   - places all APKs into public/ for download
# Use SKIP=1 to leave existing my-project untouched (only APK
# placement + service install hints are done).
# =============================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H=/home/z
SKIP="${SKIP:-0}"

if [ "$SKIP" = "1" ]; then
  echo "SKIP=1: leaving my-project as-is"
else
  echo ">> Restoring my-project (Adda chat app) from repo..."
  rm -rf "$H/my-project"
  cp -r "$REPO_DIR/my-project" "$H/my-project"
  if command -v bun > /dev/null 2>&1; then
    echo ">> bun install..."
    (cd "$H/my-project" && bun install)
    echo ">> Prisma db push..."
    (cd "$H/my-project" && bun run db:push) || echo "WARN: db push failed (check .env DATABASE_URL)"
    echo ">> Seeding demo users (chiranjit/mama/bonna, pass 1234)..."
    (cd "$H/my-project" && bun scripts/seed-chat.ts) || echo "WARN: seed failed (non-fatal)"
  else
    echo ">> bun not found, using npm install..."
    (cd "$H/my-project" && npm install)
  fi
fi

echo ">> Placing APKs into my-project/public/ ..."
cp -f "$REPO_DIR/apks/"*.apk "$H/my-project/public/"

echo ">> Restoring socket mini-service (chat-service, port 3003)..."
mkdir -p "$H/my-project/mini-services"
cp -r "$REPO_DIR/mini-services/chat-service" "$H/my-project/mini-services/"
if command -v bun > /dev/null 2>&1; then
  (cd "$H/my-project/mini-services/chat-service" && bun install && bunx prisma generate) \
    || echo "WARN: chat-service install failed"
fi

echo "DONE: 04-restore-myproject.sh"
echo "NEXT: cd /home/z/my-project && (bun run dev > /dev/null 2>&1 &)   # background"
echo "NEXT: cd /home/z/my-project/mini-services/chat-service && (setsid nohup bun run dev > /home/z/my-project/chat-service.log 2>&1 < /dev/null &)"
echo "      ^ chat service MUST run for real-time chat (port 3003, --hot reload)"
