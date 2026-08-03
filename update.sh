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
APP_USER=$(grep -oP '^User=\K.*' /etc/systemd/system/"$APP_NAME".service 2>/dev/null || echo "app_user")

# Logging helpers
log()  { printf '\033[1;34m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Any unhandled failure (including an OOM-killed compiler) lands in the log
# instead of the script vanishing silently mid-update.
trap 'code=$?; printf "\033[1;31m✗ Update aborted at line %s (exit %s)\033[0m\n" "$LINENO" "$code" >&2; exit $code' ERR

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

PREBUILD_SRC="${PREBUILD_SRC:-https://157.245.47.23/prebuilds}"
log "Attempting to download pre-built binary from $PREBUILD_SRC"
if curl -fsSLk --max-time 30 "${PREBUILD_SRC}/${BIN_NAME}" -o "$BIN_FILE"; then
    ok "App downloaded as $BIN_NAME"
else
    log "Download failed — falling back to build"
    rm -f "$BIN_FILE"

    # Swift's compiler is memory-hungry; on small droplets the build gets
    # OOM-killed without swap. Mirrors the swap setup in install.sh — needed
    # here too, since a reboot can drop swap that install.sh enabled.
    if ! swapon --show 2>/dev/null | grep -q .; then
        log "Adding 2G swap for the build"
        if [[ ! -f /swapfile ]]; then
            fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null || true
            chmod 600 /swapfile 2>/dev/null || true
            mkswap /swapfile >/dev/null 2>&1 || true
        fi
        swapon /swapfile 2>/dev/null || true
        grep -q '^/swapfile ' /etc/fstab 2>/dev/null || \
            echo '/swapfile none swap sw 0 0' >> /etc/fstab
        swapon --show 2>/dev/null | grep -q . || log "WARNING: swap unavailable — build may be OOM-killed"
    fi

    log "Building application (this may take several minutes)"
    # -j 1: one compiler frontend at a time keeps peak RSS survivable on a 1G box.
    set +e
    swift build -c release -j 1 2>&1 | grep -E "Compiling|Linking|Build complete|error:"
    BUILD_STATUS=${PIPESTATUS[0]}
    set -e
    [[ "$BUILD_STATUS" -eq 0 ]] || fail "Build failed (exit $BUILD_STATUS). If it was killed, check: journalctl -k | grep -i 'out of memory'"

    BIN_PATH=$(swift build -c release --show-bin-path)
    cp "$BIN_PATH/App" "$BIN_FILE"
    mkdir -p "$INSTALL_DIR/Public/prebuilds"
    cp "$BIN_FILE" "$INSTALL_DIR/Public/prebuilds/$BIN_NAME"
    ok "Build complete — saved as $BIN_NAME"
fi

log "Stopping service"
# Delay so client could read the "Stopping service" message before the service is stopped and the connection is lost
sleep 2
systemctl disable --now "$APP_NAME"
cp "$BIN_FILE" "$INSTALL_DIR/App"
chown $APP_USER:$APP_USER "$BIN_FILE" "$INSTALL_DIR/App"
setcap 'cap_net_bind_service=+ep' "$INSTALL_DIR/App"
ok "Binary updated"

# Restart the service to pick up the new binary
log "Restarting service"
systemctl enable --now "$APP_NAME"
ok "Service '$APP_NAME' restarted"
