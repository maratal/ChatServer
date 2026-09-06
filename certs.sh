#!/usr/bin/env bash
# certs.sh — the one place this project makes TLS certificates.
#
#   certs.sh self-signed --cert <path> --key <path> [--cn <name>] [--days <n>]
#                        [--env <file>] [--owner <user>]
#   certs.sh domain <domain> [--env <file>] [--owner <user>] [--restart <unit>]
#
# self-signed  A certificate for this host's IP — all that can be issued before
#              a name points here. An existing pair is reused, not replaced.
# domain       A Let's Encrypt certificate, with renewal wired up.
#
#   --env      write TLS_CERT_PATH and TLS_KEY_PATH into this env file, replacing
#              any previous pair rather than appending a second one
#   --owner    the user the app runs as; it is given read access to the key
#   --restart  the unit a renewal should restart (domain mode only)
#
# Both modes end with the same two facts on stdout, so a caller that needs the
# paths can read them back instead of reconstructing them:
#
#   TLS_CERT_PATH=<path>
#   TLS_KEY_PATH=<path>

set -uo pipefail

# Group granting read access to /etc/letsencrypt. Shared with anything else that
# provisions certificates on this host — p5agent's certs.sh names the same group
# — because these directories are per-host, not per-app: handing them to a
# single user is right until the second app arrives, at which point that chgrp
# silently takes the first one's access away. Do not rename it on one side alone.
CERT_GROUP="certaccess"

# Named in the renewal hook so whoever finds it knows what wrote it.
APP_CERTS_ORIGIN="ChatServer certs.sh"

log()  { printf '\033[1;34m→ %s\033[0m\n' "$*" >&2; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
usage() { sed -n '2,22p' "$0" >&2; exit 2; }

# ── Arguments ────────────────────────────────────────────────────────────────
MODE="${1:-}"
[[ -n "$MODE" ]] || usage
shift

DOMAIN="" CERT="" KEY="" CN="" DAYS=825 ENV_FILE="" OWNER="" RESTART_UNIT=""

case "$MODE" in
    self-signed) ;;
    domain)
        DOMAIN="${1:-}"
        [[ -n "$DOMAIN" && "$DOMAIN" != --* ]] || fail "certs.sh domain <domain>"
        shift
        ;;
    *) usage ;;
esac

while [[ $# -gt 0 ]]; do
    case "$1" in
        --cert)    CERT="${2:?--cert needs a path}"; shift 2 ;;
        --key)     KEY="${2:?--key needs a path}"; shift 2 ;;
        --cn)      CN="${2:?--cn needs a name}"; shift 2 ;;
        --days)    DAYS="${2:?--days needs a number}"; shift 2 ;;
        --env)     ENV_FILE="${2:?--env needs a path}"; shift 2 ;;
        --owner)   OWNER="${2:?--owner needs a user}"; shift 2 ;;
        --restart) RESTART_UNIT="${2:?--restart needs a unit}"; shift 2 ;;
        *) fail "Unknown option: $1" ;;
    esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────

# This host's public address. The metadata service is authoritative on a
# droplet; hostname -I is the fallback anywhere else.
host_ip() {
    local ip
    ip=$(curl -s --max-time 10 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null)
    [[ -n "$ip" ]] || ip=$(hostname -I | awk '{print $1}')
    printf '%s' "$ip"
}

# Record the paths in an env file. Previous entries are removed first: appending
# blindly leaves a file that grows a pair every re-install, and while systemd
# takes the last one, the file stops being readable by a person.
write_env() {
    local file="$1" cert="$2" key="$3" owner="$4"
    [[ -n "$file" ]] || return 0
    touch "$file"
    chmod 600 "$file"
    sed -i '/^TLS_CERT_PATH=/d;/^TLS_KEY_PATH=/d' "$file"
    printf 'TLS_CERT_PATH=%s\nTLS_KEY_PATH=%s\n' "$cert" "$key" >> "$file"
    if [[ -n "$owner" ]] && id "$owner" &> /dev/null; then
        chown "${owner}:${owner}" "$file"
    fi
    ok "TLS paths written to $file"
}

# Make the certificate readable by the group — the key itself, not just the path
# to it.
#
# certbot writes privkey as 0600 root:root, and a group on a parent directory
# grants traversal, never read on a file inside: the app walks the whole way to
# the key and is refused at the last step. Both the directories and the key need
# doing, and the key is the part that actually matters.
#
# A renewal inherits the mode and ownership of the key it replaces, so this holds
# from here on rather than needing to be reapplied. That is also why a host whose
# certificate predates this can look fine while a freshly issued one fails — the
# old key carried old permissions forward.
grant_cert_access() {
    local domain="$1" owner="$2"
    getent group "$CERT_GROUP" > /dev/null || groupadd --system "$CERT_GROUP"

    chgrp "$CERT_GROUP" /etc/letsencrypt/live /etc/letsencrypt/archive
    chmod 750 /etc/letsencrypt/live /etc/letsencrypt/archive

    local live="/etc/letsencrypt/live/$domain" arch="/etc/letsencrypt/archive/$domain"
    for dir in "$live" "$arch"; do
        [[ -d "$dir" ]] || continue
        chgrp "$CERT_GROUP" "$dir"
        chmod 750 "$dir"          # group needs x to reach the files inside
    done
    if compgen -G "$arch/privkey*.pem" > /dev/null; then
        chgrp "$CERT_GROUP" "$arch"/privkey*.pem
        chmod 640 "$arch"/privkey*.pem
        ok "Private key readable by the $CERT_GROUP group"
    else
        log "No private key found under $arch"
    fi

    if [[ -n "$owner" ]] && id "$owner" &> /dev/null; then
        usermod -aG "$CERT_GROUP" "$owner"
        ok "Certificate access granted to $owner via the $CERT_GROUP group"
    fi
}

# A renewed certificate that never reaches the running service is the same as an
# expired one, so renewal restarts it.
install_deploy_hook() {
    local unit="$1"
    [[ -n "$unit" ]] || return 0
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    local hook="/etc/letsencrypt/renewal-hooks/deploy/restart-${unit}.sh"
    printf '#!/bin/bash\n# Written by %s — edits here are lost on the next run.\nsystemctl restart %s\n' \
        "$APP_CERTS_ORIGIN" "$unit" > "$hook"
    chmod +x "$hook"
    ok "Renewal hook installed at $hook"
}

# certbot ships this timer and enables it, but a host where it was masked or
# never started looks healthy for sixty days and then stops serving.
enable_renewal_timer() {
    systemctl list-unit-files certbot.timer &> /dev/null || return 0
    systemctl enable --now certbot.timer &> /dev/null \
        || log "Could not enable certbot.timer — renewals will not run unattended"
}

# ── self-signed ──────────────────────────────────────────────────────────────
if [[ "$MODE" == "self-signed" ]]; then
    [[ -n "$CERT" && -n "$KEY" ]] || fail "self-signed needs --cert and --key"
    mkdir -p "$(dirname "$CERT")" "$(dirname "$KEY")"

    if [[ -f "$CERT" && -f "$KEY" ]]; then
        ok "Reusing the existing certificate at $CERT"
    else
        [[ -n "$CN" ]] || CN=$(host_ip)
        [[ -n "$CN" ]] || CN="localhost"
        log "Generating a self-signed certificate for $CN"
        openssl req -x509 -newkey rsa:2048 -nodes -days "$DAYS" \
            -keyout "$KEY" -out "$CERT" \
            -subj "/CN=$CN" -addext "subjectAltName=IP:$CN" >&2 \
            || fail "Could not generate a certificate for $CN"
        ok "Self-signed certificate created for $CN"
    fi

    if [[ -n "$OWNER" ]] && id "$OWNER" &> /dev/null; then
        chown "${OWNER}:${OWNER}" "$CERT" "$KEY"
    fi
    write_env "$ENV_FILE" "$CERT" "$KEY" "$OWNER"
    printf 'TLS_CERT_PATH=%s\nTLS_KEY_PATH=%s\n' "$CERT" "$KEY"
    exit 0
fi

# ── domain ───────────────────────────────────────────────────────────────────
DOMAIN="${DOMAIN,,}"
DOMAIN="${DOMAIN%.}"
[[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]] \
    || fail "Not a valid domain name: $DOMAIN"

# Check the name points here before spending an attempt: Let's Encrypt
# rate-limits failures, and a typo should not cost one.
SERVER_IP=$(host_ip)
RESOLVED=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')
[[ -n "$RESOLVED" ]] \
    || fail "$DOMAIN does not resolve. Add an A record pointing at $SERVER_IP and try again once it has propagated."
[[ " $RESOLVED " == *" $SERVER_IP "* ]] \
    || fail "$DOMAIN resolves to $RESOLVED, not to this host ($SERVER_IP). Point its A record here and try again."
ok "$DOMAIN resolves to this host ($SERVER_IP)"

if ! command -v certbot &> /dev/null; then
    log "Installing certbot"
    apt-get -qq update > /dev/null 2>&1
    apt-get -qq install -y certbot > /dev/null || fail "Could not install certbot"
fi

# The http-01 challenge is answered on port 80.
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp comment "ACME http-01" > /dev/null 2>&1 || true
fi

install_deploy_hook "$RESTART_UNIT"

LE_DIR="/etc/letsencrypt/live/$DOMAIN"
if [[ -d "$LE_DIR" ]]; then
    log "A certificate for $DOMAIN already exists — renewing if it is due"
    # Not --force-renewal: a certificate with weeks left is not reissued just
    # because the installer ran again, and reissues count against a weekly
    # limit. Nothing due is a success.
    certbot renew --cert-name "$DOMAIN" --standalone --non-interactive >&2 \
        || fail "Renewal failed for $DOMAIN"
else
    log "Requesting a certificate for $DOMAIN"
    certbot certonly --standalone --non-interactive --agree-tos \
        --register-unsafely-without-email -d "$DOMAIN" >&2 \
        || fail "Could not obtain a certificate for $DOMAIN"
    ok "Certificate obtained for $DOMAIN"
fi

CERT="$LE_DIR/fullchain.pem"
KEY="$LE_DIR/privkey.pem"
[[ -f "$CERT" && -f "$KEY" ]] || fail "certbot reported success but $LE_DIR is not readable"

grant_cert_access "$DOMAIN" "$OWNER"
enable_renewal_timer
write_env "$ENV_FILE" "$CERT" "$KEY" "$OWNER"
printf 'TLS_CERT_PATH=%s\nTLS_KEY_PATH=%s\n' "$CERT" "$KEY"
