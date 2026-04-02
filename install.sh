#!/usr/bin/env bash
# ChatServer installer for Ubuntu (Digital Ocean droplet)
# Usage: curl -sSL https://raw.githubusercontent.com/maratal/ChatServer/main/install.sh | bash
set -euo pipefail

APP_NAME="chatserver"
APP_PORT=8080
REPO_URL="https://github.com/maratal/ChatServer.git"
INSTALL_DIR="/opt/$APP_NAME"
APP_USER="vapor"

# ── Helpers ──────────────────────────────────────────────────────────────────

log()  { printf '\n\033[1;34m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "This script must be run as root"
[[ -f /etc/os-release ]] && . /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fail "This script is intended for Ubuntu"

# ── Firewall ─────────────────────────────────────────────────────────────────

log "Configuring firewall (UFW)"
apt-get -qq update
apt-get -qq install -y ufw > /dev/null

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow "$APP_PORT"/tcp comment "ChatServer"
ufw --force enable
ok "Firewall configured (SSH + port $APP_PORT)"

# ── System dependencies ──────────────────────────────────────────────────────

log "Installing system dependencies"
export DEBIAN_FRONTEND=noninteractive

apt-get -qq dist-upgrade -y > /dev/null
apt-get -qq install -y \
    ca-certificates \
    curl \
    git \
    gnupg \
    libgd-dev \
    tzdata \
    > /dev/null
ok "System packages installed"

# ── Swift ────────────────────────────────────────────────────────────────────

log "Installing Swift 6.0"
if command -v swift &> /dev/null && swift --version 2>&1 | grep -q "6.0"; then
    ok "Swift 6.0 already installed"
else
    # Install swiftly (official Swift version manager)
    curl -sSL https://swiftlang.github.io/swiftly/swiftly-install.sh | bash -s -- --disable-confirmation -y
    export PATH="$HOME/.swiftly/bin:$PATH"
    # Source the env so swiftly is available
    if [[ -f "$HOME/.local/share/swiftly/env.sh" ]]; then
        . "$HOME/.local/share/swiftly/env.sh"
    fi
    swiftly install 6.0
    ok "Swift $(swift --version 2>&1 | head -1)"
fi

# ── PostgreSQL ───────────────────────────────────────────────────────────────

log "Installing PostgreSQL"
if command -v psql &> /dev/null; then
    ok "PostgreSQL already installed"
else
    apt-get -qq install -y postgresql postgresql-contrib > /dev/null
fi

systemctl enable postgresql
systemctl start postgresql

# Create database and user if they don't exist
DB_NAME="chatserver"
DB_USER="chatserver"
DB_PASS=$(openssl rand -hex 16)

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
    ok "Database user '$DB_USER' already exists"
    # Read existing password from env file if available
    if [[ -f "/etc/$APP_NAME.env" ]]; then
        DB_PASS=$(grep DATABASE_PASSWORD "/etc/$APP_NAME.env" | cut -d= -f2)
    fi
else
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    ok "Database user '$DB_USER' created"
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    ok "Database '$DB_NAME' already exists"
else
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    ok "Database '$DB_NAME' created"
fi

# ── Environment file ─────────────────────────────────────────────────────────

log "Writing environment config"
cat > "/etc/$APP_NAME.env" <<EOF
DATABASE_HOST=localhost
DATABASE_NAME=$DB_NAME
DATABASE_USERNAME=$DB_USER
DATABASE_PASSWORD=$DB_PASS
LOG_LEVEL=info
EOF
chmod 600 "/etc/$APP_NAME.env"
ok "Environment saved to /etc/$APP_NAME.env"

# ── Application user ─────────────────────────────────────────────────────────

if id "$APP_USER" &> /dev/null; then
    ok "User '$APP_USER' already exists"
else
    useradd --system --user-group --create-home --home-dir /home/$APP_USER --shell /usr/sbin/nologin $APP_USER
    ok "User '$APP_USER' created"
fi

# ── Clone & build ────────────────────────────────────────────────────────────

log "Cloning repository"
if [[ -d "$INSTALL_DIR" ]]; then
    cd "$INSTALL_DIR"
    git fetch --all
    git reset --hard origin/main
    ok "Repository updated"
else
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Repository cloned"
fi

cd "$INSTALL_DIR"

log "Building application (this may take several minutes)"
swift build -c release 2>&1 | tail -5

BIN_PATH=$(swift build -c release --show-bin-path)
cp "$BIN_PATH/App" "$INSTALL_DIR/App"
ok "Build complete"

# Set ownership
chown -R $APP_USER:$APP_USER "$INSTALL_DIR"

# ── Systemd service ──────────────────────────────────────────────────────────

log "Creating systemd service"
cat > "/etc/systemd/system/$APP_NAME.service" <<EOF
[Unit]
Description=ChatServer
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=/etc/$APP_NAME.env
ExecStart=$INSTALL_DIR/App serve --env production --hostname 0.0.0.0 --port $APP_PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"
ok "Service '$APP_NAME' started"

# ── Run migrations ───────────────────────────────────────────────────────────

log "Running database migrations"
sleep 2  # Give the app a moment to start
cd "$INSTALL_DIR"
sudo -u $APP_USER bash -c "source /etc/$APP_NAME.env && $INSTALL_DIR/App migrate --yes" 2>&1 || true
ok "Migrations complete"

# ── Done ─────────────────────────────────────────────────────────────────────

log "Installation complete!"
echo ""
echo "  App running on:   http://$(hostname -I | awk '{print $1}'):$APP_PORT"
echo "  Service name:     $APP_NAME"
echo "  Install dir:      $INSTALL_DIR"
echo "  Config:           /etc/$APP_NAME.env"
echo ""
echo "  Useful commands:"
echo "    systemctl status $APP_NAME    # check status"
echo "    journalctl -u $APP_NAME -f    # view logs"
echo "    systemctl restart $APP_NAME   # restart"
echo ""
