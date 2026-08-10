#!/usr/bin/env bash
set -Eeuo pipefail

main_env=/etc/bsk/bsk.env
coach_env=/etc/bsk-coach/coach.env
bsk_vhost_link=/etc/nginx/sites-enabled/bsk2014.se
legacy_snippet=/etc/nginx/snippets/coach-platform.conf
bsk_snippet=/etc/nginx/snippets/bsk-coach-platform.conf
repo_root=/opt/bsk/bsk-f2014

for required in "$main_env" "$coach_env" "$bsk_vhost_link" "$legacy_snippet"; do
  if [[ ! -f "$required" ]]; then
    echo "Obligatorisk VPS-fil saknas: $required" >&2
    exit 1
  fi
done

bsk_vhost=$(realpath "$bsk_vhost_link")
if [[ "$bsk_vhost" != /etc/nginx/* || ! -f "$bsk_vhost" ]]; then
  echo "Vhost-sökvägen kunde inte verifieras säkert." >&2
  exit 1
fi

backup_dir=$(mktemp -d /tmp/bsk-coach-config.XXXXXX)
if [[ "$backup_dir" != /tmp/bsk-coach-config.* || ! -d "$backup_dir" ]]; then
  echo "Temporär backupkatalog kunde inte verifieras." >&2
  exit 1
fi

cp -a "$main_env" "$backup_dir/main.env"
cp -a "$coach_env" "$backup_dir/coach.env"
cp -a "$bsk_vhost" "$backup_dir/bsk2014.vhost"
cp -a "$legacy_snippet" "$backup_dir/legacy-snippet.conf"
bsk_snippet_existed=0
if [[ -f "$bsk_snippet" ]]; then
  cp -a "$bsk_snippet" "$backup_dir/bsk-snippet.conf"
  bsk_snippet_existed=1
fi

cleanup_backup() {
  rm -f -- "$backup_dir/main.env" "$backup_dir/coach.env" "$backup_dir/bsk2014.vhost" \
    "$backup_dir/legacy-snippet.conf" "$backup_dir/bsk-snippet.conf"
  rmdir -- "$backup_dir"
}

rollback() {
  local exit_code=$?
  trap - ERR
  echo "Konfigurationen misslyckades; återställer nginx och miljöfiler." >&2
  install -m 600 -o root -g root "$backup_dir/main.env" "$main_env"
  install -m 600 -o root -g root "$backup_dir/coach.env" "$coach_env"
  cp -a "$backup_dir/bsk2014.vhost" "$bsk_vhost"
  cp -a "$backup_dir/legacy-snippet.conf" "$legacy_snippet"
  if [[ "$bsk_snippet_existed" == 1 ]]; then
    cp -a "$backup_dir/bsk-snippet.conf" "$bsk_snippet"
  else
    rm -f -- "$bsk_snippet"
  fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx.service || true
  cleanup_backup
  exit "$exit_code"
}
trap rollback ERR

abort_with_rollback() {
  echo "$1" >&2
  return 1
}

read_secret() {
  local file=$1
  local count
  count=$(grep -c '^BSK_SESSION_BRIDGE_SECRET=' "$file" || true)
  if [[ "$count" -gt 1 ]]; then
    echo "Flera bridge-hemligheter hittades i $file." >&2
    return 1
  fi
  sed -n 's/^BSK_SESSION_BRIDGE_SECRET=//p' "$file"
}

main_secret=$(read_secret "$main_env")
coach_secret=$(read_secret "$coach_env")
if [[ -n "$main_secret" && -n "$coach_secret" && "$main_secret" != "$coach_secret" ]]; then
  abort_with_rollback "BSK- och coach-processerna har olika bridge-hemligheter."
fi
bridge_secret=${main_secret:-$coach_secret}
if [[ -z "$bridge_secret" ]]; then
  bridge_secret=$(openssl rand -hex 32)
fi
if [[ ! "$bridge_secret" =~ ^[A-Za-z0-9_-]{32,256}$ ]]; then
  abort_with_rollback "Bridge-hemligheten har ett ogiltigt format."
fi

rewrite_env() {
  local file=$1
  local remove_anthropic=$2
  local temporary
  temporary=$(mktemp "${file}.XXXXXX")
  if [[ "$temporary" != "${file}."* || ! -f "$temporary" ]]; then
    echo "Temporär miljöfil kunde inte verifieras." >&2
    return 1
  fi
  if [[ "$remove_anthropic" == 1 ]]; then
    awk '!/^BSK_SESSION_BRIDGE_SECRET=/ && !/^ANTHROPIC_API_KEY=/' "$file" > "$temporary"
  else
    awk '!/^BSK_SESSION_BRIDGE_SECRET=/' "$file" > "$temporary"
  fi
  printf 'BSK_SESSION_BRIDGE_SECRET=%s\n' "$bridge_secret" >> "$temporary"
  chmod 600 "$temporary"
  chown root:root "$temporary"
  mv -f -- "$temporary" "$file"
}

rewrite_env "$main_env" 1
rewrite_env "$coach_env" 0

install -m 644 -o root -g root "$repo_root/coach-platform/deploy/nginx-bsk2014.conf" "$bsk_snippet"
install -m 644 -o root -g root "$repo_root/coach-platform/deploy/nginx-klvr-redirect.conf" "$legacy_snippet"

include_line='    include /etc/nginx/snippets/bsk-coach-platform.conf;'
if ! grep -Fqx "$include_line" "$bsk_vhost"; then
  temporary_vhost=$(mktemp "${bsk_vhost}.XXXXXX")
  if [[ "$temporary_vhost" != "${bsk_vhost}."* || ! -f "$temporary_vhost" ]]; then
    abort_with_rollback "Temporär vhost-fil kunde inte verifieras."
  fi
  awk -v include_line="$include_line" '
    !inserted && /^[[:space:]]*server_name[[:space:]]+bsk2014[.]se;/ {
      print
      print include_line
      inserted=1
      next
    }
    { print }
    END { if (!inserted) exit 42 }
  ' "$bsk_vhost" > "$temporary_vhost"
  chmod --reference="$bsk_vhost" "$temporary_vhost"
  chown --reference="$bsk_vhost" "$temporary_vhost"
  mv -f -- "$temporary_vhost" "$bsk_vhost"
fi

nginx -t
systemctl reload nginx.service

trap - ERR
cleanup_backup
echo "Coach-routing och bridge-konfiguration installerad utan att exponera hemligheter."
