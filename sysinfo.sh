#!/usr/bin/env bash
# Output system info as JSON.

set -euo pipefail

if [[ -f /etc/os-release ]]; then
    os=$(. /etc/os-release && echo "${PRETTY_NAME:-$NAME $VERSION_ID}")
elif command -v lsb_release &>/dev/null; then
    os=$(lsb_release -ds)
elif command -v sw_vers &>/dev/null; then
    os="macOS $(sw_vers -productVersion)"
else
    os=$(uname -sr)
fi

swift=$(swift --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1 || echo "unknown")
postgres=$(psql --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1 || echo "unknown")

printf '{"os":"%s","swift":"%s","postgres":"%s"}\n' "$os" "$swift" "$postgres"
