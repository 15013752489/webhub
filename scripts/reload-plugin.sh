#!/usr/bin/env bash
# ============================================================
# reload-plugin.sh — Build & reload the openclaw-web-hub-channel plugin
#
# Usage:
#   ./scripts/reload-plugin.sh [--no-build]
#
# What it does:
#   1. Builds the plugin (unless --no-build is passed)
#   2. Prints the new plugin version
#   3. Guides you through clearing the cached accessToken so
#      openclaw picks up the new build on next start
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"

NO_BUILD=false
for arg in "$@"; do
  [[ "$arg" == "--no-build" ]] && NO_BUILD=true
done

echo ""
echo "=== openclaw-web-hub-channel plugin reload ==="
echo ""

# ── Step 1: Build ────────────────────────────────────────────
if [[ "$NO_BUILD" == "false" ]]; then
  echo "▶  Building plugin..."
  cd "$PLUGIN_ROOT"
  npm run build
  echo "✓  Build complete."
else
  echo "⚠  Skipping build (--no-build flag set)."
fi

# ── Step 2: Print version ────────────────────────────────────
PLUGIN_VERSION=$(node -e "console.log(require('$PLUGIN_ROOT/package.json').version)")
echo ""
echo "✓  Plugin version: $PLUGIN_VERSION"

# ── Step 3: Version detection via service API ─────────────────
WEBHUB_URL="${WEBHUB_URL:-http://localhost:3000}"
echo ""
echo "▶  Checking service version endpoint..."
if curl -sf "$WEBHUB_URL/api/channel/version" | grep -q "serviceVersion"; then
  echo "✓  Service version response:"
  curl -s "$WEBHUB_URL/api/channel/version" | python3 -m json.tool 2>/dev/null \
    || curl -s "$WEBHUB_URL/api/channel/version"
else
  echo "⚠  Service at $WEBHUB_URL is not reachable or version endpoint unavailable."
  echo "   Set WEBHUB_URL env var if the service runs on a different address."
fi

# ── Step 4: Reload instructions ──────────────────────────────
echo ""
echo "=== Manual reload steps ==="
echo ""
echo "To activate the new plugin version in openclaw:"
echo ""
echo "  Option A — full restart (recommended):"
echo "    1. Stop openclaw"
echo "    2. Run this script (already done if you're reading this)"
echo "    3. Start openclaw"
echo ""
echo "  Option B — clear cached accessToken so plugin re-registers:"
echo "    1. In openclaw config, remove the 'accessToken' field under"
echo "       channels.chatu (or channels.chatu.accounts.<id>)"
echo "    2. Keep 'channelId' and 'secret' in place"
echo "    3. Restart openclaw — the plugin will exchange the secret for"
echo "       a fresh token and report its new version on /api/channel/version"
echo ""
echo "  After restart, verify version via:"
echo "    curl $WEBHUB_URL/api/channel/version"
echo ""
echo "=== Done ==="
