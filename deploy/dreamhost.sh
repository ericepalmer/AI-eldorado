#!/usr/bin/env bash
# Deploy El Dorado to DreamHost under games.palton.xyz/eldorado/
#
# Usage:
#   ./deploy/dreamhost.sh theeping@games.palton.xyz
#
# Optional:
#   DREAMHOST_PATH=games.palton.xyz/eldorado ./deploy/dreamhost.sh USER@HOST

set -euo pipefail

REMOTE="${1:-}"
REMOTE_PATH="${DREAMHOST_PATH:-games.palton.xyz/eldorado}"

if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 USER@dreamhost-server"
  echo "Example: $0 theeping@games.palton.xyz"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Building site (base /eldorado/)…"
VITE_BASE=/eldorado/ npm run build

echo "→ Copying DreamHost helpers into dist/…"
cp "$ROOT/deploy/eldorado.htaccess" "$ROOT/dist/.htaccess"
cp "$ROOT/deploy/hit.php" "$ROOT/dist/hit.php"
# Seed count.html only if missing in dist (rsync also preserves remote count.html)
if [[ ! -f "$ROOT/dist/count.html" ]]; then
  cp "$ROOT/deploy/count.html" "$ROOT/dist/count.html"
fi

echo "→ Ensuring remote directory ~/$REMOTE_PATH …"
ssh "$REMOTE" "mkdir -p ~/$REMOTE_PATH"

echo "→ Uploading to $REMOTE:~/$REMOTE_PATH/ …"
rsync -avz --delete \
  --exclude .DS_Store \
  --exclude game-starts.log \
  --exclude count.html \
  "$ROOT/dist/" "$REMOTE:~/$REMOTE_PATH/"

# Seed remote count.html once if absent
ssh "$REMOTE" "test -f ~/$REMOTE_PATH/count.html || true"
if ! ssh "$REMOTE" "test -f ~/$REMOTE_PATH/count.html"; then
  scp "$ROOT/deploy/count.html" "$REMOTE:~/$REMOTE_PATH/count.html"
fi

echo "✓ Live at https://games.palton.xyz/eldorado/"
echo "  Counts: https://games.palton.xyz/eldorado/count.html"
