#!/usr/bin/env bash
set -euo pipefail
# Kör från en granskad releasekatalog. Aktiverar inte timern före verifierad synk.
if [[ $(id -u) != 0 ]]; then exit 1; fi
release=$(pwd)
[[ -f "$release/scripts/svenskalag/run.ts" ]]
id bsk-sync >/dev/null 2>&1 || useradd --system --home-dir /var/lib/bsk-sync --shell /usr/sbin/nologin bsk-sync
install -d -m 700 -o bsk-sync -g bsk-sync /var/lib/bsk-sync
install -d -m 750 -o root -g bsk-sync /etc/bsk-sync
npm ci --no-audit --no-fund >/dev/null
PLAYWRIGHT_BROWSERS_PATH=/var/lib/bsk-sync/browsers npx playwright install --with-deps chromium >/dev/null
chown -R bsk-sync:bsk-sync /var/lib/bsk-sync
# Miljöfilen ska ha en separat DB-roll och skrivs separat utan att logga hemligheter.
[[ -f /etc/bsk-sync/sync.env ]]
chmod 640 /etc/bsk-sync/sync.env
chown root:bsk-sync /etc/bsk-sync/sync.env
ln -sfn "$release" /opt/bsk/svenskalag-sync.next
mv -Tf /opt/bsk/svenskalag-sync.next /opt/bsk/svenskalag-sync
install -m 644 deploy/svenskalag/bsk-svenskalag-sync.service /etc/systemd/system/
install -m 644 deploy/svenskalag/bsk-svenskalag-sync.timer /etc/systemd/system/
systemctl daemon-reload
printf 'Installerad. Kör provsynk och verifiera innan timern aktiveras.\n'
