#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

backup_root=/mnt/bsk-backup
config_file=/etc/bsk-backup/backup.env
passphrase_file=/etc/bsk-backup/passphrase
main_env=/etc/bsk/bsk.env
coach_env=/etc/bsk-coach/coach.env
lock_file=/run/lock/bsk-database-backup.lock

mode=${1:-scheduled}
if [[ "$mode" != scheduled && "$mode" != --force && "$mode" != --check ]]; then
  echo "Användning: $0 [--force|--check]" >&2
  exit 2
fi
if [[ $EUID -ne 0 ]]; then
  echo "Backup måste köras som root." >&2
  exit 1
fi

for required in "$config_file" "$passphrase_file" "$main_env" "$coach_env"; do
  if [[ ! -f "$required" || -L "$required" ]]; then
    echo "Obligatorisk, vanlig fil saknas: $required" >&2
    exit 1
  fi
done

config_mode=$(stat -c %a "$config_file")
config_owner=$(stat -c %u "$config_file")
if [[ "$config_mode" != 600 || "$config_owner" != 0 ]]; then
  echo "Backupkonfigurationen måste vara rootägd med mode 600." >&2
  exit 1
fi
if grep -Ev '^[[:space:]]*(#.*)?$|^BSK_BACKUP_(INTERVAL_HOURS|RETENTION_DAYS)=[0-9]+$' "$config_file" | grep -q .; then
  echo "Backupkonfigurationen innehåller okända eller osäkra rader." >&2
  exit 1
fi
read_config_value() {
  local key=$1
  local count
  count=$(grep -c "^${key}=" "$config_file" || true)
  if [[ "$count" != 1 ]]; then
    echo "$key måste förekomma exakt en gång." >&2
    return 1
  fi
  sed -n "s/^${key}=//p" "$config_file"
}
interval_hours=$(read_config_value BSK_BACKUP_INTERVAL_HOURS)
retention_days=$(read_config_value BSK_BACKUP_RETENTION_DAYS)
if [[ ! "$interval_hours" =~ ^[1-9][0-9]*$ || "$interval_hours" -gt 720 ]]; then
  echo "BSK_BACKUP_INTERVAL_HOURS måste vara ett heltal 1–720." >&2
  exit 1
fi
if [[ ! "$retention_days" =~ ^[1-9][0-9]*$ || "$retention_days" -gt 3650 ]]; then
  echo "BSK_BACKUP_RETENTION_DAYS måste vara ett heltal 1–3650." >&2
  exit 1
fi

if [[ ! -d "$backup_root" || -L "$backup_root" ]] || ! mountpoint -q "$backup_root"; then
  echo "$backup_root måste vara en separat, monterad och icke-länkad lagringsyta." >&2
  exit 1
fi
backup_mode=$(stat -c %a "$backup_root")
backup_owner=$(stat -c %u "$backup_root")
if [[ "$backup_mode" != 700 || "$backup_owner" != 0 ]]; then
  echo "$backup_root måste vara rootägd med mode 700." >&2
  exit 1
fi
root_source=$(findmnt -n -o SOURCE /)
backup_source=$(findmnt -n -o SOURCE --target "$backup_root")
if [[ -z "$root_source" || -z "$backup_source" || "$root_source" == "$backup_source" ]]; then
  echo "Backupmålet får inte ligga på samma filsystem som VPS-roten." >&2
  exit 1
fi

pass_mode=$(stat -c %a "$passphrase_file")
pass_owner=$(stat -c %u "$passphrase_file")
pass_size=$(stat -c %s "$passphrase_file")
if [[ "$pass_mode" != 600 || "$pass_owner" != 0 || "$pass_size" -lt 32 ]]; then
  echo "Krypteringsnyckeln måste vara rootägd, mode 600 och minst 32 byte." >&2
  exit 1
fi
for container in bsk-db coach-platform-db-1; do
  if [[ $(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true) != true ]]; then
    echo "Databascontainern kör inte: $container" >&2
    exit 1
  fi
done
for command_name in docker findmnt flock gpg mountpoint node sha256sum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Obligatoriskt kommando saknas: $command_name" >&2
    exit 1
  fi
done

if [[ "$mode" == --check ]]; then
  echo "Backupkonfigurationen är giltig; inga databaser lästes."
  exit 0
fi

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "En annan backupkörning pågår." >&2
  exit 1
fi

latest_marker=$(find "$backup_root" -mindepth 2 -maxdepth 2 -type f -name .bsk-backup-complete -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2- || true)
if [[ "$mode" == scheduled && -n "$latest_marker" ]]; then
  latest_epoch=$(stat -c %Y "$latest_marker")
  now_epoch=$(date +%s)
  if (( now_epoch - latest_epoch < interval_hours * 3600 )); then
    echo "Senaste verifierade backup är yngre än beslutat intervall; hoppar över."
    exit 0
  fi
fi

read_database_identity() {
  local env_file=$1
  local database_url
  database_url=$(
    unset DATABASE_URL
    set -a
    . "$env_file"
    set +a
    printf %s "${DATABASE_URL:?DATABASE_URL saknas}"
  )
  DATABASE_URL="$database_url" node -e '
    const value = new URL(process.env.DATABASE_URL);
    const user = decodeURIComponent(value.username);
    const database = decodeURIComponent(value.pathname.slice(1));
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(user) || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(database)) process.exit(1);
    process.stdout.write(`${user} ${database}`);
  '
}

read -r main_user main_database < <(read_database_identity "$main_env")
read -r coach_user coach_database < <(read_database_identity "$coach_env")
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
if [[ ! "$timestamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
  echo "Ogiltig backuptidsstämpel." >&2
  exit 1
fi
final_dir="$backup_root/$timestamp"
if [[ -e "$final_dir" ]]; then
  echo "Backupmålet finns redan: $final_dir" >&2
  exit 1
fi
work_dir=$(mktemp -d "$backup_root/.partial-$timestamp.XXXXXX")
if [[ "$work_dir" != "$backup_root/.partial-$timestamp."* || ! -d "$work_dir" || -L "$work_dir" ]]; then
  echo "Temporär backupkatalog kunde inte verifieras." >&2
  exit 1
fi
main_dump="$work_dir/bsk-main.dump.gpg"
coach_dump="$work_dir/bsk-coach.dump.gpg"
checksums="$work_dir/SHA256SUMS"
marker="$work_dir/.bsk-backup-complete"

cleanup_partial() {
  local exit_code=$1
  trap - ERR INT TERM
  rm -f -- "$main_dump" "$coach_dump" "$checksums" "$marker"
  rmdir -- "$work_dir" 2>/dev/null || true
  exit "$exit_code"
}
trap 'cleanup_partial $?' ERR
trap 'cleanup_partial 130' INT
trap 'cleanup_partial 143' TERM

create_and_verify() {
  local container=$1
  local db_user=$2
  local db_name=$3
  local output=$4
  local label=$5
  local restore_database="bsk_backup_check_${timestamp}_${label}"
  if [[ ! "$restore_database" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "Ogiltigt temporärt återställningsnamn." >&2
    return 1
  fi
  docker exec "$container" pg_dump --format=custom --no-owner --no-acl -U "$db_user" -d "$db_name" |
    gpg --batch --quiet --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" \
      --symmetric --cipher-algo AES256 --output "$output"
  test -s "$output"
  gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$passphrase_file" --decrypt "$output" |
    docker exec -i "$container" pg_restore --list >/dev/null

  docker exec "$container" createdb -U "$db_user" "$restore_database"
  local restore_status=0
  if ! gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$passphrase_file" --decrypt "$output" |
    docker exec -i "$container" pg_restore --no-owner --no-acl -U "$db_user" -d "$restore_database"; then
    restore_status=1
  else
    local source_counts restored_counts
    if ! source_counts=$(database_counts "$container" "$db_user" "$db_name"); then
      restore_status=1
    elif ! restored_counts=$(database_counts "$container" "$db_user" "$restore_database"); then
      restore_status=1
    elif [[ "$source_counts" != "$restored_counts" ]]; then
      echo "Återställningsprovet gav andra tabellantal för $label." >&2
      restore_status=1
    fi
  fi
  docker exec "$container" dropdb -U "$db_user" --if-exists "$restore_database"
  return "$restore_status"
}

database_counts() {
  local container=$1
  local db_user=$2
  local db_name=$3
  docker exec -i "$container" sh -s -- "$db_user" "$db_name" <<'SH'
set -eu
db_user=$1
db_name=$2
psql -U "$db_user" -d "$db_name" -Atc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename" |
while IFS= read -r table; do
  case "$table" in ''|*[!a-z0-9_]*) exit 1;; esac
  count=$(psql -U "$db_user" -d "$db_name" -Atc "SELECT count(*) FROM \"$table\"")
  printf '%s=%s\n' "$table" "$count"
done
SH
}

create_and_verify bsk-db "$main_user" "$main_database" "$main_dump" main
create_and_verify coach-platform-db-1 "$coach_user" "$coach_database" "$coach_dump" coach
(
  cd "$work_dir"
  sha256sum bsk-main.dump.gpg bsk-coach.dump.gpg > SHA256SUMS
)
touch "$marker"
chmod 700 "$work_dir"
chmod 600 "$main_dump" "$coach_dump" "$checksums" "$marker"
mv -- "$work_dir" "$final_dir"
trap - ERR INT TERM

while IFS= read -r candidate; do
  name=${candidate##*/}
  if [[ ! "$name" =~ ^[0-9]{8}T[0-9]{6}Z$ || "$candidate" != "$backup_root/$name" || ! -d "$candidate" || -L "$candidate" ]]; then
    echo "Vägrar gallra oväntat backupmål: $candidate" >&2
    exit 1
  fi
  mapfile -t entries < <(find "$candidate" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)
  expected=(.bsk-backup-complete SHA256SUMS bsk-coach.dump.gpg bsk-main.dump.gpg)
  if [[ "${entries[*]}" != "${expected[*]}" ]]; then
    echo "Vägrar gallra backup med oväntat innehåll: $candidate" >&2
    exit 1
  fi
  rm -f -- "$candidate/.bsk-backup-complete" "$candidate/SHA256SUMS" \
    "$candidate/bsk-coach.dump.gpg" "$candidate/bsk-main.dump.gpg"
  rmdir -- "$candidate"
done < <(find "$backup_root" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -print | sort)

echo "Krypterad och återläsningsverifierad backup skapad: $final_dir"
