#!/usr/bin/env bash
# Fetch latest code (HTML, JS, CSS) without recompiling.

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Configuration
APP_NAME="chatserver"
INSTALL_DIR="/opt/$APP_NAME"
APP_USER=$(grep -oP '^User=\K.*' /etc/systemd/system/"$APP_NAME".service 2>/dev/null || true)

# Logging helpers
log()  { printf '\033[1;34m→ %s\033[0m\n' "$*"; }
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
if ! git merge --ff-only origin/main 2>/dev/null; then
    log "Fast-forward failed, resetting to origin/main"
    git reset --hard origin/main
fi
log "Last commit: $(git log -1 --pretty='%h %s')"
ok "Repository updated"

# Keep the sudoers rule in step with install.sh. Droplets installed before
# `update.sh --static` existed only allow the bare command. Validated with
# visudo first: a broken sudoers file would lock out sudo.
if [[ -n "$APP_USER" ]]; then
    SUDOERS_FILE="/etc/sudoers.d/$APP_NAME"
    SUDOERS_TMP=$(mktemp)
    cat > "$SUDOERS_TMP" <<EOF
$APP_USER ALL=(root) NOPASSWD: $INSTALL_DIR/refresh.sh, /usr/bin/systemd-run --collect $INSTALL_DIR/update.sh, /usr/bin/systemd-run --collect $INSTALL_DIR/update.sh --static
EOF
    if ! cmp -s "$SUDOERS_TMP" "$SUDOERS_FILE" && visudo -cqf "$SUDOERS_TMP"; then
        install -m 440 -o root -g root "$SUDOERS_TMP" "$SUDOERS_FILE"
        ok "Sudoers rule updated (allows update.sh --static)"
    fi
    rm -f "$SUDOERS_TMP"
fi
