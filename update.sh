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
log "Last commit: $(git log -1 --pretty='%h %s')"
ok "Repository updated"

# Determine cached binary name (matches install-swift-app naming)
PLATFORM=$(dpkg --print-architecture)
OS_ID=$(. /etc/os-release && echo "${ID}${VERSION_ID}" | tr -d '.')
APP_VERSION=$(grep -oE 'version = "[0-9]+\.[0-9]+\.[0-9]+"' "$INSTALL_DIR/Sources/App/info.swift" 2>/dev/null | grep -oE '"[^"]*"' | tr -d '"')
APP_VERSION="${APP_VERSION:-unknown}"
# `--static` comes from "Build Statically" in the dashboard (update.sh --static).
STATIC_BUILD=false
[[ "${1:-}" == "--static" ]] && STATIC_BUILD=true

# Binary names (install.sh uses the same):
#   App-<os>-<arch>-<app version>                         static build, runs without Swift
#   App-<os>-<arch>-swift-<swift version>-<app version>   regular build, needs that Swift runtime
# A static prebuilt is tried first, Swift or not — as install.sh does. With
# Swift, the regular prebuilt comes next and a build last; without it (e.g.
# removed after a static build) updates can only come from static prebuilts.
# BIN_NAME here is what a build is saved as; a download replaces it below.
STATIC_NAME="App-${OS_ID}-${PLATFORM}-${APP_VERSION}"
SWIFT_NAME=""
BUILD_FLAGS=(-c release)
if command -v swift &>/dev/null; then
    SWIFT_INSTALLED=true
    SWIFT_VERSION=$(swift --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    SWIFT_NAME="App-${OS_ID}-${PLATFORM}-swift-${SWIFT_VERSION}-${APP_VERSION}"
    if [[ "$STATIC_BUILD" == true ]]; then
        BUILD_FLAGS+=(--static-swift-stdlib)
        BIN_NAME="$STATIC_NAME"
        log "Static build requested (--static-swift-stdlib)"
    else
        BIN_NAME="$SWIFT_NAME"
    fi
else
    SWIFT_INSTALLED=false
    BIN_NAME="$STATIC_NAME"
    log "Swift is not installed — updating from static prebuilt binaries only"
fi
BIN_FILE="$INSTALL_DIR/$BIN_NAME"

# Clear every App-* file, then keep exactly one: a copy of what is running.
#
# These are release binaries of some hundreds of megabytes and one accumulated
# per version, which fills a small droplet's disk quietly. App-backup is taken
# from the live binary rather than kept from the last download, so it is always
# the thing being replaced — and it matches App-* itself, so the sweep above
# retires the previous one before this makes the new one. Rollback is
# `mv App-backup App` and a restart.
log "Clearing old binaries"
rm -f "$INSTALL_DIR"/App-*
if [[ -f "$INSTALL_DIR/App" ]]; then
    cp "$INSTALL_DIR/App" "$INSTALL_DIR/App-backup"
    chown "$APP_USER:$APP_USER" "$INSTALL_DIR/App-backup" 2>/dev/null || true
    ok "Current binary backed up as App-backup"
else
    ok "No current binary to back up"
fi

PREBUILD_SRC="${PREBUILD_SRC:-https://157.245.47.23/prebuilds}"

# fetch_prebuilt <name>: download it as $INSTALL_DIR/<name>; fails (leaving
# nothing behind) when the server does not have it.
fetch_prebuilt() {
    log "Attempting to download pre-built binary $1"
    if curl -fsSLk --max-time 30 "${PREBUILD_SRC%/}/$1" -o "$INSTALL_DIR/$1" && [[ -s "$INSTALL_DIR/$1" ]]; then
        return 0
    fi
    rm -f "$INSTALL_DIR/$1"
    return 1
}

# static_runs <file>: a static binary must not need Swift's runtime, nor any
# library this droplet lacks — checked while the current one still runs.
static_runs() {
    local linked
    linked=$(ldd "$1" 2>/dev/null || true)
    if grep -q "libswiftCore" <<< "$linked"; then
        log "$(basename "$1") needs the Swift runtime after all — not using it"
        return 1
    fi
    if grep -q "not found" <<< "$linked"; then
        grep "not found" <<< "$linked" || true
        log "$(basename "$1") needs libraries that are missing here — not using it"
        return 1
    fi
    return 0
}

DOWNLOADED=""
# "Build Statically" always builds: skip the download.
if [[ "$STATIC_BUILD" == true && "$SWIFT_INSTALLED" == true ]]; then
    log "Build Statically ticked — skipping prebuilt download"
else
    if fetch_prebuilt "$STATIC_NAME"; then
        if static_runs "$INSTALL_DIR/$STATIC_NAME"; then
            DOWNLOADED="$STATIC_NAME"
        else
            rm -f "$INSTALL_DIR/$STATIC_NAME"
        fi
    fi
    if [[ -z "$DOWNLOADED" && "$SWIFT_INSTALLED" == true ]] && fetch_prebuilt "$SWIFT_NAME"; then
        DOWNLOADED="$SWIFT_NAME"
    fi
fi

if [[ -n "$DOWNLOADED" ]]; then
    BIN_NAME="$DOWNLOADED"
    BIN_FILE="$INSTALL_DIR/$BIN_NAME"
    ok "App downloaded as $BIN_NAME"
elif [[ "$SWIFT_INSTALLED" == false ]]; then
    fail "No static prebuilt $STATIC_NAME at $PREBUILD_SRC that runs here, and Swift is not installed to build it. Publish one by updating a droplet that has Swift with Build Statically ticked. Server left running the current version."
else
    [[ "$STATIC_BUILD" == true ]] || log "No pre-built binary — falling back to build"
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
    swift build "${BUILD_FLAGS[@]}" -j 1 2>&1 | grep -E "Compiling|Linking|Build complete|error:"
    BUILD_STATUS=${PIPESTATUS[0]}
    set -e
    [[ "$BUILD_STATUS" -eq 0 ]] || fail "Build failed (exit $BUILD_STATUS). If it was killed, check: journalctl -k | grep -i 'out of memory'"

    BIN_PATH=$(swift build "${BUILD_FLAGS[@]}" --show-bin-path)
    cp "$BIN_PATH/App" "$BIN_FILE"
    mkdir -p "$INSTALL_DIR/Public/prebuilds"
    cp "$BIN_FILE" "$INSTALL_DIR/Public/prebuilds/$BIN_NAME"
    ok "Build complete — saved as $BIN_NAME"
fi

log "Stopping service"
# Delay so client could read the "Stopping service" message before the service is stopped and the connection is lost
sleep 2
systemctl disable --now "$APP_NAME"
# Moved, not copied: nothing keeps the versioned name on this droplet now, and
# leaving it would put back the file the sweep above just removed.
mv "$BIN_FILE" "$INSTALL_DIR/App"
chmod 755 "$INSTALL_DIR/App"
chown $APP_USER:$APP_USER "$INSTALL_DIR/App"
setcap 'cap_net_bind_service=+ep' "$INSTALL_DIR/App"
ok "Binary updated"

# Restart the service to pick up the new binary
log "Restarting service"
systemctl enable --now "$APP_NAME"
ok "Service '$APP_NAME' restarted"
