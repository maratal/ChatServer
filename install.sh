#!/usr/bin/env bash
# ChatServer installer for Ubuntu (Digital Ocean droplet)
# Usage:             curl -sSL <URL> | bash                        (self-signed cert for IP)
# Usage with domain: curl -sSL <URL> | DOMAIN=yourdomain.com bash  (Let's Encrypt cert)
set -euo pipefail

APP_NAME="chatserver"
APP_PORT=443
REPO_URL="https://github.com/maratal/ChatServer.git"
INSTALL_DIR="/opt/$APP_NAME"
APP_USER="vapor"
DOMAIN="${DOMAIN:-${1:-}}"  # Set DOMAIN env var for Let's Encrypt HTTPS

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
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"
ufw --force enable
ok "Firewall configured (SSH + HTTP + HTTPS)"

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

SWIFT_VERSION="6.0.3"

log "Installing Swift $SWIFT_VERSION"
if command -v swift &> /dev/null && swift --version 2>&1 | grep -q "6.0"; then
    ok "Swift 6.0 already installed"
else
    # Determine architecture
    ARCH=$(dpkg --print-architecture)
    case "$ARCH" in
        amd64)
            SWIFT_ARCH=""
            PLATFORM_SUFFIX="ubuntu2404"
            ;;
        arm64)
            SWIFT_ARCH="-aarch64"
            PLATFORM_SUFFIX="ubuntu2404-aarch64"
            ;;
        *) fail "Unsupported architecture: $ARCH" ;;
    esac

    SWIFT_TAG="swift-${SWIFT_VERSION}-RELEASE"
    SWIFT_TARBALL="${SWIFT_TAG}-ubuntu24.04${SWIFT_ARCH}.tar.gz"
    SWIFT_URL="https://download.swift.org/swift-${SWIFT_VERSION}-release/${PLATFORM_SUFFIX}/${SWIFT_TAG}/${SWIFT_TARBALL}"

    # Install Swift runtime dependencies
    apt-get -qq install -y \
        binutils libc6-dev libcurl4-openssl-dev libedit2 \
        libgcc-13-dev libpython3-dev libsqlite3-0 libstdc++-13-dev \
        libxml2-dev libncurses-dev libz3-dev pkg-config unzip zlib1g-dev \
        > /dev/null

    log "Downloading Swift from $SWIFT_URL"
    curl -sSL "$SWIFT_URL" -o /tmp/swift.tar.gz
    mkdir -p /opt/swift
    tar xzf /tmp/swift.tar.gz -C /opt/swift --strip-components=2
    rm /tmp/swift.tar.gz
    ln -sf /opt/swift/bin/swift /usr/local/bin/swift
    ln -sf /opt/swift/bin/swiftc /usr/local/bin/swiftc

    # Add to PATH for this session and future shells
    export PATH="/opt/swift/bin:$PATH"
    echo 'export PATH="/opt/swift/bin:$PATH"' > /etc/profile.d/swift.sh

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
ENV_FILE="/etc/$APP_NAME.env"
cat > "$ENV_FILE" <<EOF
DATABASE_HOST=localhost
DATABASE_NAME=$DB_NAME
DATABASE_USERNAME=$DB_USER
DATABASE_PASSWORD=$DB_PASS
LOG_LEVEL=info
EOF

# ── Application user ─────────────────────────────────────────────────────────

if id "$APP_USER" &> /dev/null; then
    ok "User '$APP_USER' already exists"
else
    useradd --system --user-group --create-home --home-dir /home/$APP_USER --shell /usr/sbin/nologin $APP_USER
    ok "User '$APP_USER' created"
fi

# Allow the app user to run management scripts without a password
SUDOERS_FILE="/etc/sudoers.d/$APP_NAME"
cat > "$SUDOERS_FILE" <<EOF
$APP_USER ALL=(root) NOPASSWD: $INSTALL_DIR/refresh.sh, /usr/bin/systemd-run --collect $INSTALL_DIR/update.sh
EOF
chmod 440 "$SUDOERS_FILE"
ok "Sudoers configured for $APP_USER"

# Lock down management scripts so only root can modify them
chown root:root "$INSTALL_DIR/refresh.sh" "$INSTALL_DIR/update.sh"
chmod 755 "$INSTALL_DIR/refresh.sh" "$INSTALL_DIR/update.sh"

# ── TLS certificates ─────────────────────────────────────────────────────────

CERT_DIR="/etc/$APP_NAME/certs"
mkdir -p "$CERT_DIR"

if [[ -n "$DOMAIN" ]]; then
    # Domain provided — use Let's Encrypt
    log "Setting up HTTPS with Let's Encrypt for $DOMAIN"
    apt-get -qq install -y certbot > /dev/null

    LE_DIR="/etc/letsencrypt/live/$DOMAIN"
    if [[ -d "$LE_DIR" ]]; then
        ok "Certificate for $DOMAIN already exists"
    else
        certbot certonly --standalone --non-interactive --agree-tos \
            --register-unsafely-without-email -d "$DOMAIN"
        ok "Certificate obtained for $DOMAIN"
    fi

    TLS_CERT="$LE_DIR/fullchain.pem"
    TLS_KEY="$LE_DIR/privkey.pem"

    # Allow the app user to read certificates
    chmod 750 /etc/letsencrypt/live /etc/letsencrypt/archive
    chgrp $APP_USER /etc/letsencrypt/live /etc/letsencrypt/archive

    # Set up auto-renewal with service restart
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    cat > /etc/letsencrypt/renewal-hooks/deploy/restart-chatserver.sh <<'HOOK'
#!/bin/bash
systemctl restart chatserver
HOOK
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-chatserver.sh
    ok "Auto-renewal configured"
else
    # No domain — generate self-signed certificate for the IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    log "Generating self-signed certificate for $SERVER_IP"

    TLS_CERT="$CERT_DIR/cert.pem"
    TLS_KEY="$CERT_DIR/key.pem"

    openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
        -keyout "$TLS_KEY" -out "$TLS_CERT" \
        -subj "/CN=$SERVER_IP" \
        -addext "subjectAltName=IP:$SERVER_IP"

    chown $APP_USER:$APP_USER "$CERT_DIR"/*.pem
    ok "Self-signed certificate created for $SERVER_IP"
fi

# Add TLS paths to environment
cat >> "$ENV_FILE" <<EOF
TLS_CERT_PATH=$TLS_CERT
TLS_KEY_PATH=$TLS_KEY
EOF

chmod 600 "$ENV_FILE"
ok "Environment saved to $ENV_FILE"

# ── Clone & build ────────────────────────────────────────────────────────────

log "Cloning repository"
if [[ -d "$INSTALL_DIR" ]]; then
    cd "$INSTALL_DIR"
    git config --global --add safe.directory "$INSTALL_DIR"
    git fetch origin
    git merge --ff-only origin/main
    ok "Repository updated"
else
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Repository cloned"
fi

cd "$INSTALL_DIR"

log "Building application (this may take several minutes)"
swift build -c release -v 2>&1 | grep -E "^(Compiling|Linking|Build complete)|warning:|error:"

BIN_PATH=$(swift build -c release --show-bin-path)
cp "$BIN_PATH/App" "$INSTALL_DIR/App"
ok "Build complete"

# Set ownership
chown -R $APP_USER:$APP_USER "$INSTALL_DIR"

# Allow binding to port 443 as non-root
setcap 'cap_net_bind_service=+ep' "$INSTALL_DIR/App"

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
export $(grep -v '^#' /etc/$APP_NAME.env | xargs)
sudo -E -u $APP_USER "$INSTALL_DIR/App" migrate --yes 2>&1 || true
ok "Migrations complete"

# ── Done ─────────────────────────────────────────────────────────────────────

log "Installation complete!"
echo ""
if [[ -n "$DOMAIN" ]]; then
    echo "  App running on:   https://$DOMAIN"
else
    echo "  App running on:   https://$(hostname -I | awk '{print $1}')"
    echo "  (self-signed cert — browser will show a warning)"
fi
echo "  Service name:     $APP_NAME"
echo "  Install dir:      $INSTALL_DIR"
echo "  Config:           /etc/$APP_NAME.env"
echo ""
echo "  Useful commands:"
echo "    systemctl status $APP_NAME    # check status"
echo "    journalctl -u $APP_NAME -f    # view logs"
echo "    systemctl restart $APP_NAME   # restart"
echo ""
