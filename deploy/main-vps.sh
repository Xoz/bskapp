#!/usr/bin/env bash
# Publish only the main app. Coach and Development stores/services are independent.
set -Eeuo pipefail
umask 077
commit=${1:?Expected full commit SHA}
[[ "$commit" =~ ^[0-9a-f]{40}$ ]]
exec 9>/var/lock/bsk-main-deploy.lock
flock -n 9
repo=/opt/bsk/bsk-f2014
root=/opt/bsk
snippet=/etc/nginx/snippets/bsk-development-prod.conf
override=/etc/systemd/system/bsk.service.d/release.conf
set -a
. /etc/bsk/bsk.env
set +a
# A stable session key must survive changing the working directory.
[[ -n "${SESSION_SECRET:-}" ]]
git -C "$repo" fetch origin main
[[ "$(git -C "$repo" rev-parse origin/main)" = "$commit" ]]
install -d -m 700 "$root/releases" "$root/backups"
backup=$(mktemp -d "$root/backups/main-${commit:0:12}.XXXXXX")
release=$(mktemp -d "$root/releases/${commit:0:12}.XXXXXX")
# Before Next's build-time schema initialization, preserve the complete main DB.
docker exec bsk-db pg_dump -U bsk -d bsk -Fc > "$backup/bsk.dump"
docker exec -i bsk-db pg_restore --list < "$backup/bsk.dump" > "$backup/dump-manifest.txt"
[[ -s "$backup/dump-manifest.txt" ]]
cp -a "$snippet" "$backup/development.conf"
if [[ -f "$override" ]]; then cp -a "$override" "$backup/release.conf"; fi
previous=$(readlink "$root/current" || true)
printf '%s\n' "$previous" > "$backup/previous-release.txt"
git -C "$repo" archive "$commit" | tar -x -C "$release"
# Preserve any filesystem-backed data without copying it into Git or logs.
if [[ -d "$repo/data" ]]; then ln -s "$repo/data" "$release/data"; fi
cd "$release"
training_marker_before=$(docker exec bsk-db psql -U bsk -d bsk -Atc "SELECT count(*) FROM schema_migrations WHERE id = '0021-training-plans'")
switched=0
rollback() {
  code=$?
  trap - ERR
  if [[ "$switched" = 1 ]]; then systemctl stop bsk.service; fi
  # Migration 0021 is additive. Preserve plans; retract only a newly applied marker.
  if [[ "$training_marker_before" = 0 ]]; then
    docker exec bsk-db psql -U bsk -d bsk -v ON_ERROR_STOP=1 -c "DELETE FROM schema_migrations WHERE id = '0021-training-plans';"
  fi
  if [[ "$switched" = 1 ]]; then
    cp -a "$backup/development.conf" "$snippet"
    if [[ -f "$backup/release.conf" ]]; then
      cp -a "$backup/release.conf" "$override"
    else
      rm -f "$override"
    fi
    if [[ -n "$previous" ]]; then ln -sfn "$previous" "$root/current"; else rm -f "$root/current"; fi
    systemctl daemon-reload
    systemctl restart bsk.service
    nginx -t && systemctl reload nginx.service
  fi
  echo "Deployment failed. Previous service configuration restored; backup: $backup" >&2
  exit "$code"
}
trap rollback ERR
npm ci --include=dev
npm test
npm run build
npm run db:audit
# Match only the known legacy entry; keep its API/assets and stored data intact.
python3 - "$snippet" "$backup/next-development.conf" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text()
old='location = /utveckling {\n    return 308 /utveckling/;\n}'
new='location = /utveckling/ {\n    return 307 /utveckling;\n}'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('Unknown development entry configuration; refusing to replace it')
Path(sys.argv[2]).write_text(text)
PY
switched=1
ln -sfn "$release" "$root/current"
install -d -m 755 /etc/systemd/system/bsk.service.d
cat > "$override" <<'UNIT'
[Service]
WorkingDirectory=/opt/bsk/current
ExecStart=
ExecStart=/opt/bsk/current/node_modules/.bin/next start -H 127.0.0.1 -p 3001
UNIT
systemctl daemon-reload
systemctl restart bsk.service
healthy=0
for _ in {1..15}; do
  if curl -fsS http://127.0.0.1:3001/login >/dev/null; then healthy=1; break; fi
  sleep 2
done
[[ "$healthy" = 1 ]]
install -m 644 "$backup/next-development.conf" "$snippet"
nginx -t
systemctl reload nginx.service
curl -fsS https://bsk2014.se/login >/dev/null
[[ "$(curl -sS -o /dev/null -w '%{http_code}' https://bsk2014.se/api/auth/dev)" = 404 ]]
[[ "$(curl -sS -o /dev/null -w '%{http_code}' https://bsk2014.se/utveckling/)" = 307 ]]
systemctl is-active --quiet bsk.service
printf '%s\n' "$commit" > "$release/DEPLOYED_COMMIT"
trap - ERR
printf 'Published %s\nRelease: %s\nBackup: %s\n' "$commit" "$release" "$backup"
