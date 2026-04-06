#!/usr/bin/env bash
# Fetch latest code, recompile, replace binary and restart the service.

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Configuration
APP_NAME="chatserver"
INSTALL_DIR="/opt/$APP_NAME"
APP_USER="vapor"

# Logging helpers
log()  { printf '\n\033[1;34m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Require root and a valid install directory
[[ "$(id -u)" -eq 0 ]] || fail "This script must be run as root"
[[ -d "$INSTALL_DIR" ]] || fail "Install directory $INSTALL_DIR not found"

# Pull latest changes from remote
log "Fetching latest code"
cd "$INSTALL_DIR"
git config --global --add safe.directory "$INSTALL_DIR"
git fetch origin
git merge --ff-only origin/main
ok "Repository updated"

# Compile and replace the binary
log "Building application"
swift build -c release -v 2>&1 | grep -E "^(Compiling|Linking|Build complete)|warning:|error:"
BIN_PATH=$(swift build -c release --show-bin-path)
log "Stopping service"
systemctl stop "$APP_NAME"
cp "$BIN_PATH/App" "$INSTALL_DIR/App"
chown $APP_USER:$APP_USER "$INSTALL_DIR/App"
setcap 'cap_net_bind_service=+ep' "$INSTALL_DIR/App" # Allow binding to port 443 without root
ok "Binary updated"

# Restart the service to pick up the new binary
log "Restarting service"
systemctl restart "$APP_NAME"
ok "Service '$APP_NAME' restarted"
