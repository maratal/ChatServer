#!/usr/bin/env bash
# Fetch latest code, recompile, replace binary and restart the service.

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Redirect all output to the log file (and console via tee)
LOG_FILE="/tmp/chatserver-update.log"
rm -f "$LOG_FILE"
exec > >(stdbuf -oL tee "$LOG_FILE") 2>&1

# Configuration
APP_NAME="chatserver"
INSTALL_DIR="/opt/$APP_NAME"
APP_USER="vapor"

# Logging helpers
log()  { printf '\033[1;34m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Require root and a valid install directory
[[ "$(id -u)" -eq 0 ]] || fail "This script must be run as root"
[[ -d "$INSTALL_DIR" ]] || fail "Install directory $INSTALL_DIR not found"
export HOME=/root

# Pull latest changes from remote
log "Fetching latest code"
cd "$INSTALL_DIR"
git config --global --add safe.directory '*'
git fetch origin
if ! git merge --ff-only origin/main 2>/dev/null; then
    log "Fast-forward failed, resetting to origin/main"
    git reset --hard origin/main
fi
ok "Repository updated"

# Determine cached binary name (matches install-swift-app naming)
PLATFORM=$(dpkg --print-architecture)
OS_ID=$(. /etc/os-release && echo "${ID}${VERSION_ID}" | tr -d '.')
SWIFT_VERSION=$(swift --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
APP_VERSION=$(grep -oE 'version = "[0-9]+\.[0-9]+\.[0-9]+"' "$INSTALL_DIR/Sources/App/info.swift" 2>/dev/null | grep -oE '"[^"]*"' | tr -d '"')
APP_VERSION="${APP_VERSION:-unknown}"
BIN_NAME="App-${OS_ID}-${PLATFORM}-swift-${SWIFT_VERSION}-${APP_VERSION}"
BIN_FILE="$INSTALL_DIR/$BIN_NAME"

PREBUILD_SRC="${PREBUILD_SRC:-https://159.65.31.5/prebuilds}"
log "Attempting to download pre-built binary from $PREBUILD_SRC"
if curl -fsSLk --max-time 30 "${PREBUILD_SRC}/${BIN_NAME}" -o "$BIN_FILE"; then
    ok "App downloaded as $BIN_NAME"
else
    log "Download failed — falling back to build"
    log "Building application (this may take several minutes)"
    swift build -c release 2>&1 | grep -E "^(Compiling|Linking|Build complete)|error:"
    BIN_PATH=$(swift build -c release --show-bin-path)
    cp "$BIN_PATH/App" "$BIN_FILE"
    cp "$BIN_FILE" "$INSTALL_DIR/Public/prebuilds/$BIN_NAME"
    ok "Build complete — saved as $BIN_NAME"
fi

log "Stopping service"
# Delay so client could read the "Stopping service" message before the service is stopped and the connection is lost
sleep 2
systemctl stop "$APP_NAME"
cp "$BIN_FILE" "$INSTALL_DIR/App"
chown $APP_USER:$APP_USER "$BIN_FILE" "$INSTALL_DIR/App"
setcap 'cap_net_bind_service=+ep' "$INSTALL_DIR/App" # Allow binding to port 443 without root
ok "Binary updated"

# Restart the service to pick up the new binary
log "Restarting service"
systemctl restart "$APP_NAME"
ok "Service '$APP_NAME' restarted"
