#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Installationen måste köras som root." >&2
  exit 1
fi
repo_root=/opt/bsk/bsk-f2014
"$repo_root/scripts/backup-vps-databases.sh" --check
install -m 644 -o root -g root "$repo_root/deploy/backup/bsk-database-backup.service" /etc/systemd/system/bsk-database-backup.service
install -m 644 -o root -g root "$repo_root/deploy/backup/bsk-database-backup.timer" /etc/systemd/system/bsk-database-backup.timer
systemctl daemon-reload
systemctl enable --now bsk-database-backup.timer
systemctl start bsk-database-backup.service
systemctl is-active --quiet bsk-database-backup.timer
echo "Backupservice installerad, första krypterade snapshoten verifierad och timern aktiv."
