# Krypterad VPS-backup

Det här flödet säkerhetskopierar både `bsk-db` och `coach-platform-db-1` utan
att skriva anslutningssträngar eller dekrypterad data till logg eller disk.
Varje körning:

1. skapar en custom-format `pg_dump` per databas;
2. krypterar strömmen med AES-256 och en separat rootnyckel;
3. dekrypterar snapshoten till en isolerad temporär databas;
4. jämför radantal för samtliga publika tabeller;
5. tar bort testdatabasen och publicerar snapshotkatalogen atomiskt;
6. gallrar endast kompletta snapshotkataloger äldre än beslutad retention.

Scriptet vägrar starta om `/mnt/bsk-backup` inte är en rootägd `0700`-mount på
ett annat filsystem än VPS-roten. Det ger skydd mot diskhaveri bara om mounten
faktiskt är extern eller replikerad utanför VPS:en.

## Aktivering efter föreningsbeslut

Besluta och dokumentera först backupintervall, retention, RPO/RTO, lagringsregion,
krypteringsansvar och leverantör/biträde. Kör därefter som root på VPS:en:

```bash
install -d -m 700 -o root -g root /etc/bsk-backup
install -m 600 -o root -g root \
  /opt/bsk/bsk-f2014/deploy/backup/backup.env.example \
  /etc/bsk-backup/backup.env
# Fyll endast i de två beslutade heltalen i backup.env.
openssl rand -hex 32 > /etc/bsk-backup/passphrase
chmod 600 /etc/bsk-backup/passphrase
/opt/bsk/bsk-f2014/deploy/backup/install-vps-backup.sh
```

Krypteringsnyckeln ska förvaras i föreningens godkända lösenords-/nyckelvalv,
separat från både VPS och backupmålet. Lägg aldrig värdet i Git eller docs.

## Driftkontroll

```bash
systemctl list-timers bsk-database-backup.timer
systemctl status bsk-database-backup.timer
journalctl -u bsk-database-backup.service --since today
```

Timern kontrollerar varje timme, men scriptet skapar bara en snapshot när det
beslutade intervallet har passerat. `--check` validerar konfigurationen utan att
läsa databaser; `--force` skapar en verifierad snapshot oavsett intervall.

Återställning över en produktionsdatabas är avsiktligt inte automatiserad. Vid
incident ska en snapshot först checksummeverifieras och återställas till en ny,
isolerad databas; byte av produktionsdatabas kräver ett dokumenterat
underhållsfönster och namngiven ansvarig.
