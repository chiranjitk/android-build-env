#!/usr/bin/env bash
# Build everything sequentially. Usage: bash scripts/build-all.sh [name...]
# No args = build all 4.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(newpipe kharcha takatrack smarttube)
fi

for t in "${TARGETS[@]}"; do
  echo "=========================================="
  echo "  BUILD: $t"
  echo "=========================================="
  bash "$DIR/build-$t.sh"
done
echo "ALL BUILDS DONE"
