#!/usr/bin/env bash
set -euo pipefail

# Optional macOS .app wrapper builder using osacompile (no hardcoded developer paths).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_APP="${1:-$APP_ROOT/DARK-GPT.app}"

if [ "$(uname -s)" != "Darwin" ] || ! command -v osacompile >/dev/null 2>&1; then
  echo "macOS osacompile is required to build a .app bundle. On other platforms, run ./start.command."
  exit 1
fi

TMP_SCPT="$(mktemp /tmp/dark_gpt_launcher.XXXXXX.applescript)"
trap 'rm -f "$TMP_SCPT"' EXIT

cat > "$TMP_SCPT" <<EOF
tell application "Terminal"
  activate
  do script "cd " & quoted form of "$APP_ROOT" & " && ./start.command"
end tell
EOF

osacompile -o "$OUT_APP" "$TMP_SCPT"
echo "Built macOS launcher bundle at: $OUT_APP"
