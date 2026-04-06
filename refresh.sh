#!/usr/bin/env bash
# Fetch latest code (HTML, JS, CSS) without recompiling.

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Configuration
APP_NAME="chatserver"
INSTALL_DIR="/opt/$APP_NAME"

# Logging helpers
log()  { printf '\n\033[1;34m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Require root and a valid install directory
[[ "$(id -u)" -eq 0 ]] || fail "This script must be run as root"
[[ -d "$INSTALL_DIR" ]] || fail "Install directory $INSTALL_DIR not found"

# Leaf templates and static files are served from disk — no restart needed
log "Fetching latest code"
cd "$INSTALL_DIR"
git config --global --add safe.directory "$INSTALL_DIR"
git fetch origin
git merge --ff-only origin/main
ok "Repository updated"
