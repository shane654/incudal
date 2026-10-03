#!/usr/bin/env bash
set -euo pipefail

[[ "$EUID" -eq 0 ]] || { echo 'Run this installer as root' >&2; exit 1; }
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_directory="$(realpath "${1:-$script_dir/..}")"
[[ -f "$app_directory/docker-compose.yml" ]] || { echo 'docker-compose.yml not found' >&2; exit 1; }
[[ "$app_directory" != *$'\n'* && "$app_directory" != *$'\r'* ]] || { echo 'Invalid app directory' >&2; exit 1; }
for executable in docker python3 flock systemctl systemd-analyze; do
  command -v "$executable" >/dev/null || { echo "Missing executable: $executable" >&2; exit 1; }
done
install -m 0755 "$script_dir/auto-update.sh" /usr/local/sbin/incudal-auto-update
# systemd unit values support quoted paths with escaped backslashes and quotes.
escaped_directory=${app_directory//\\/\\\\}
escaped_directory=${escaped_directory//\"/\\\"}
escaped_directory=${escaped_directory//%/%%}
cat > /etc/systemd/system/incudal-auto-update.service <<UNIT
[Unit]
Description=Update the Incudal app image and verify its health
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory="$escaped_directory"
ExecStart=/usr/local/sbin/incudal-auto-update
TimeoutStartSec=10min
UMask=0077
UNIT
cat > /etc/systemd/system/incudal-auto-update.timer <<'UNIT'
[Unit]
Description=Check for an Incudal app image update every two minutes

[Timer]
OnBootSec=30s
OnUnitActiveSec=120s
AccuracySec=5s
Unit=incudal-auto-update.service

[Install]
WantedBy=timers.target
UNIT
systemd-analyze verify /etc/systemd/system/incudal-auto-update.service /etc/systemd/system/incudal-auto-update.timer
systemctl daemon-reload
systemctl enable --now incudal-auto-update.timer
echo 'Incudal automatic updates enabled (120-second interval)'
