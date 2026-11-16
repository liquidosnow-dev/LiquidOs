#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "$(uname -s)" = "Darwin" ] && [ -d "/Applications/Visual Studio Code.app" -o -d "$HOME/Applications/Visual Studio Code.app" ]; then
  open -a "Visual Studio Code" "$APP_ROOT"
elif command -v code >/dev/null 2>&1; then
  code "$APP_ROOT"
else
  exec "$APP_ROOT/start.command"
fi
