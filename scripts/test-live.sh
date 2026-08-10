#!/usr/bin/env bash
# Testprotokoll — liverapportering end-to-end mot lokal dev-DB (bskdev).
#
# Förutsätter:
#   1. Lokal Postgres kör på localhost:5432 med databasen `bskdev`.
#   2. Dev-servern kör mot bskdev:  `npm run dev`  (port 3000).
#      (.env.development.local pekar dev-servern mot bskdev — högre prioritet än .env.local)
#   3. Schemat är skapat (dev-servern har startat minst en gång → lib/db.ts init()).
#
# Körs från projektroten:
#   bash scripts/test-live.sh
#
# Skriptet är idempotent: seedar/återställer matchen före och efter, så det kan
# köras om. Det skriver INGET till produktion — allt går mot localhost:5432/bskdev.

set -u
BASE="http://localhost:3000/api/live"
DEVDB="postgresql://xozozmen@localhost:5432/bskdev"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✅ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ❌ $1 — fick: $2  förväntade: $3"; }
check(){ if [ "$1" = "$2" ]; then ok "$3"; else bad "$3" "$1" "$2"; fi; }
val(){ python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }
postc(){ curl -s -X POST "$BASE/$MID" -H "Content-Type: application/json" -d "$1" -o /dev/null -w "%{http_code}"; }

echo "=== Förberedelser ==="
curl -s "$BASE/1" -o /dev/null -w "dev-server /api/live/1 → HTTP %{http_code}\n" || { echo "dev-servern kör inte på :3000 — starta med 'npm run dev'"; exit 1; }
echo "Seedar + återställer testmatch i bskdev..."
DATABASE_URL="$DEVDB" node scripts/seed-dev.mjs >/dev/null 2>&1
DATABASE_URL="$DEVDB" node scripts/reset-dev-match.mjs >/dev/null 2>&1

# Hitta testmatchens id (vanligtvis 1, men hämta säkert)
MID=$(DATABASE_URL="$DEVDB" node -e '
import("postgres").then(async ({default: postgres}) => {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const r = await sql`SELECT id FROM matches WHERE opponent = ${"Dev Testmatch"} ORDER BY id DESC LIMIT 1`;
  console.log(r[0].id); await sql.end();
})
' 2>/dev/null)
echo "Testmatch id: $MID"
TOKEN=$(DATABASE_URL="$DEVDB" node -e '
import("postgres").then(async ({default: postgres}) => {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const r = await sql`SELECT report_token FROM matches WHERE id = ${process.argv[1]}`;
  console.log(r[0].report_token); await sql.end();
})
' "$MID" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "Testmatchen saknar report_token"; exit 1; fi
PUBLIC_URL="$BASE/$MID?token=$TOKEN"
CK=$(mktemp)
curl -s -c "$CK" -L "http://localhost:3000/api/auth/dev?role=coach" -o /dev/null
post(){ curl -s -b "$CK" -X POST "$BASE/$MID" -H "Content-Type: application/json" -d "$1"; }
get(){ curl -s -b "$CK" "$BASE/$MID$1"; }
# Välj två faktiska startare och en faktisk bänkspelare oberoende av namn/id-sortering.
INITIAL=$(get "?reporter=1")
P1=$(echo "$INITIAL" | val "str(d['onField'][0])")
P2=$(echo "$INITIAL" | val "str(d['onField'][1])")
BENCH=$(echo "$INITIAL" | val "str(next(p['id'] for p in d['players'] if p['id'] not in d['onField']))")
SQUAD_COUNT=$(echo "$INITIAL" | val "str(len(d['players']))")
PLAYER_IDS=($(echo "$INITIAL" | python3 -c "import sys,json; print(' '.join(str(p['id']) for p in json.load(sys.stdin)['players'][:5]))"))
echo "Spelare: p1=$P1 p2=$P2 bänk=$BENCH"
echo ""

echo "=== A) Publik GET (ingen cookie): livescore JA, reporting-detaljer NEJ ==="
P=$(curl -s "$BASE/$MID")
check "$(echo "$P"|val "len(d['players'])")" "0" "publik GET avslöjar ej trupp"
check "$(echo "$P"|val "d['finished']")" "False" "matchen inte avslutad"
NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$MID?reporter=1")
check "$NO_TOKEN" "401" "rapporteringsdetaljer kräver matchspecifik länk"

echo "=== B) Coach GET ?reporter=1: trupp + startelva syns ==="
C=$(get "?reporter=1")
check "$(echo "$C"|val "len(d['players'])")" "$SQUAD_COUNT" "coach ser hela truppen ($SQUAD_COUNT)"
check "$(echo "$C"|val "d['hasLineup']")" "True" "coach ser startelva"
check "$(echo "$C"|val "len(d['onField'])")" "7" "7 på plan från start"
check "$(echo "$C"|val "d['reportOpen']")" "True" "rapportering öppen"

echo "=== C) Coach: starta klocka ==="
post '{"type":"clock","op":"start"}' >/dev/null
check "$(get "?reporter=1"|val "d['clockRunning']")" "True" "klockan rullar"

echo "=== D) Coach: mål p1 ==="
post "{\"type\":\"event\",\"playerId\":$P1,\"statId\":\"goals\"}" >/dev/null
S=$(get "?reporter=1")
check "$(echo "$S"|val "d['ourScore']")" "1" "ourScore=1"
check "$(echo "$S"|val "d['counts']['$P1']['goals']")" "1" "counts[p1].goals=1"

echo "=== E) Coach: assist p2 ==="
post "{\"type\":\"event\",\"playerId\":$P2,\"statId\":\"assists\"}" >/dev/null
check "$(get "?reporter=1"|val "d['counts']['$P2']['assists']")" "1" "counts[p2].assists=1"

echo "=== F) Coach: motståndarmål ==="
post '{"type":"opponent_goal"}' >/dev/null
S=$(get "?reporter=1")
check "$(echo "$S"|val "d['oppScore']")" "1" "oppScore=1"
check "$(echo "$S"|val "d['ourScore']")" "1" "eget resultat oförändrat"

echo "=== G) Coach: byte p2 ut, bänkspelare in ==="
post "{\"type\":\"sub\",\"offId\":$P2,\"onId\":$BENCH}" >/dev/null
S=$(get "?reporter=1")
check "$(echo "$S"|val "len(d['onField'])")" "7" "7 på plan efter byte"
check "$(echo "$S"|val "$BENCH in d['onField']")" "True" "bänkspelaren kom in på plan"
check "$(echo "$S"|val "$P2 not in d['onField']")" "True" "p2 lämnade planen"
check "$(echo "$S"|val "$P1 in d['onField']")" "True" "p1 kvar på plan"

echo "=== H) Coach: nästa period ==="
post '{"type":"clock","op":"next_period"}' >/dev/null
check "$(get "?reporter=1"|val "d['period']")" "2" "period=2"

echo "=== I) Coach: mål bänkspelare i period 2 ==="
post "{\"type\":\"event\",\"playerId\":$BENCH,\"statId\":\"goals\"}" >/dev/null
check "$(get "?reporter=1"|val "d['ourScore']")" "2" "ourScore=2"

echo "=== J) Coach: ångra senaste (bänkens mål) ==="
post '{"type":"undo"}' >/dev/null
S=$(get "?reporter=1")
check "$(echo "$S"|val "d['ourScore']")" "1" "ourScore=1 efter ångra"
check "$(echo "$S"|val "d['counts']['$BENCH']['goals']")" "0" "counts[bänk].goals=0 efter ångra"

echo "=== L) Säkerhet: föräldrarapportör (ingen cookie) nekas tränaråtgärder ==="
# Körs INNAN finish_match — annars är rapporteringen stängd och föräldern
# nekas redan vid "Rapportering ej öppen" i stället för vid behörighetskontrollen.
RID="test-reporter-AAAAAAAA-0001"
R1=$(curl -s -X POST "$PUBLIC_URL" -H "Content-Type: application/json" -d "{\"type\":\"clock\",\"op\":\"pause\",\"reporterId\":\"$RID\"}")
R2=$(curl -s -X POST "$PUBLIC_URL" -H "Content-Type: application/json" -d "{\"type\":\"finish_match\",\"reporterId\":\"$RID\"}")
R3=$(curl -s -X POST "$PUBLIC_URL" -H "Content-Type: application/json" -d "{\"type\":\"sub\",\"offId\":$P1,\"onId\":$BENCH,\"reporterId\":\"$RID\"}")
check "$(echo "$R1"|val "d.get('error','ok')")" "Åtgärden kräver tränarbehörighet" "parent nekad clock-pause"
check "$(echo "$R2"|val "d.get('error','ok')")" "Åtgärden kräver tränarbehörighet" "parent nekad finish_match"
check "$(echo "$R3"|val "d.get('error','ok')")" "Åtgärden kräver tränarbehörighet" "parent nekad sub"

echo "=== M) Föräldrarapportör: kan registrera + ångra EGEN händelse (ingen cookie) ==="
curl -s -X POST "$PUBLIC_URL" -H "Content-Type: application/json" -d "{\"type\":\"event\",\"playerId\":$P1,\"statId\":\"goals\",\"reporterId\":\"$RID\",\"reporter\":\"Förälder 1\"}" >/dev/null
check "$(get "?reporter=1"|val "d['ourScore']")" "2" "förälder la till mål (ourScore=2)"
curl -s -X POST "$PUBLIC_URL" -H "Content-Type: application/json" -d "{\"type\":\"undo\",\"reporterId\":\"$RID\"}" >/dev/null
check "$(get "?reporter=1"|val "d['ourScore']")" "1" "förälder ångrade sitt eget mål"

echo "=== N) Rate-limit: max 30 händelser per rapportör per 10s ==="
# Körs INNAN finish_match så rapporteringen är öppen — annars nekas alla vid
# "Rapportering ej öppen" och rate-limiten testas aldrig.
RID2="test-reporter-BBBBBBBB-0002"
STATS=("shots" "shots_on_target" "passes_completed" "interceptions" "saves" "goals" "assists")
OK=0; BL=0
for i in $(seq 1 40); do
  pid=$(( (i % 10) + 1 )); stat=${STATS[$((i % 7))]}
  c=$(curl -s -X POST "$PUBLIC_URL" -H "Content-Type: application/json" -d "{\"type\":\"event\",\"playerId\":$pid,\"statId\":\"$stat\",\"reporterId\":\"$RID2\",\"reporter\":\"Rate Test\"}" -o /dev/null -w "%{http_code}")
  [ "$c" = "200" ] && OK=$((OK+1)) || BL=$((BL+1))
done
echo "  40 distinkta händelser → 200: $OK   429: $BL"
if [ "$OK" -le 30 ] && [ "$BL" -ge 1 ]; then ok "rate-limit: max 30 accepterade, resten 429"; else bad "rate-limit" "$OK 200/$BL 429" "≤30 200 och ≥1 429"; fi

echo "=== O) Idempotens: samma idempotencyKey räknas inte dubbelt (offline-replay) ==="
# Isolerat test: återställ matchen först så ourScore=0 och inga tidigare
# händelser påverkar. Triggar idempotensen (inte 8s-dedup) genom att skicka
# SAMMA nyckel med OLIKA spelare i replayen — dedupen matchar bara
# spelare+stat+reporter, så olika spelare bypassar den och idempotenskontrollen
# är det som skippar dubbletten.
DATABASE_URL="$DEVDB" node scripts/reset-dev-match.mjs >/dev/null 2>&1
KEY="idem-AAAAAAAA-0001"
# 1) Första händelsen med nyckel → räknas (ourScore 0 → 1).
curl -s -b "$CK" -X POST "$BASE/$MID" -H "Content-Type: application/json" \
  -d "{\"type\":\"event\",\"playerId\":$P1,\"statId\":\"goals\",\"idempotencyKey\":\"$KEY\"}" >/dev/null
check "$(get "?reporter=1"|val "d['ourScore']")" "1" "första händelse med nyckel räknas (ourScore=1)"
# 2) Replay med SAMMA nyckel men annan spelare → idempotens skippar (ej dedup).
curl -s -b "$CK" -X POST "$BASE/$MID" -H "Content-Type: application/json" \
  -d "{\"type\":\"event\",\"playerId\":$P2,\"statId\":\"goals\",\"idempotencyKey\":\"$KEY\"}" >/dev/null
check "$(get "?reporter=1"|val "d['ourScore']")" "1" "replay med samma nyckel ignoreras (idempotens)"
NEV=$(DATABASE_URL="$DEVDB" node -e '
import("postgres").then(async ({default: postgres}) => {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const r = await sql`SELECT COUNT(*)::int AS n FROM match_events WHERE match_id = ${process.argv[1]} AND idempotency_key = ${process.argv[2]}`;
  console.log(r[0].n); await sql.end();
})' "$MID" "$KEY" 2>/dev/null)
check "$NEV" "1" "bara 1 event-rad med nyckeln (p2 ej dubbellagrad)"
# 3) Olik nyckel + olik spelare → ny händelse (ourScore 1 → 2).
curl -s -b "$CK" -X POST "$BASE/$MID" -H "Content-Type: application/json" \
  -d "{\"type\":\"event\",\"playerId\":$P2,\"statId\":\"goals\",\"idempotencyKey\":\"idem-BBBBBBBB-0002\"}" >/dev/null
check "$(get "?reporter=1"|val "d['ourScore']")" "2" "olik nyckel → ny händelse (ourScore=2)"
# 4) Sub-idempotens: samma nyckel två gånger (olika off) → bara 1 sub-rad.
SUBKEY="idem-sub-CCCCCC-0003"
curl -s -b "$CK" -X POST "$BASE/$MID" -H "Content-Type: application/json" \
  -d "{\"type\":\"sub\",\"offId\":$P1,\"onId\":$BENCH,\"idempotencyKey\":\"$SUBKEY\"}" >/dev/null
curl -s -b "$CK" -X POST "$BASE/$MID" -H "Content-Type: application/json" \
  -d "{\"type\":\"sub\",\"offId\":$P2,\"onId\":$BENCH,\"idempotencyKey\":\"$SUBKEY\"}" >/dev/null
NSUBS=$(DATABASE_URL="$DEVDB" node -e '
import("postgres").then(async ({default: postgres}) => {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const r = await sql`SELECT COUNT(*)::int AS n FROM match_subs WHERE match_id = ${process.argv[1]} AND idempotency_key = ${process.argv[2]}`;
  console.log(r[0].n); await sql.end();
})' "$MID" "$SUBKEY" 2>/dev/null)
check "$NSUBS" "1" "replay av byte med samma nyckel → bara 1 sub-rad"

echo "=== P) Samtidighet: två rapportörer skriver parallellt utan tappade räknare ==="
DATABASE_URL="$DEVDB" node scripts/reset-dev-match.mjs >/dev/null 2>&1
for rid in parallel-reporter-AAAA parallel-reporter-BBBB; do
  for pid in "${PLAYER_IDS[@]}"; do
    for stat in shots shots_on_target; do
      curl -s -X POST "$PUBLIC_URL" -H "Content-Type: application/json" \
        -d "{\"type\":\"event\",\"playerId\":$pid,\"statId\":\"$stat\",\"reporterId\":\"$rid\",\"idempotencyKey\":\"parallel-$rid-$pid-$stat\"}" \
        -o /dev/null &
    done
  done
done
wait
PARALLEL=$(DATABASE_URL="$DEVDB" node -e '
import("postgres").then(async ({default: postgres}) => {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const r = await sql`SELECT COALESCE(SUM(shots),0)::int shots, COALESCE(SUM(shots_on_target),0)::int shots_on_target FROM match_players WHERE match_id = ${process.argv[1]}`;
  console.log(`${r[0].shots} ${r[0].shots_on_target}`); await sql.end();
})' "$MID" 2>/dev/null)
check "${PARALLEL% *}" "10" "två parallella rapportörer: alla 10 skott sparade"
check "${PARALLEL#* }" "10" "två parallella rapportörer: alla 10 skott på mål sparade"

echo "=== K) Coach: avsluta matchen ==="
post '{"type":"finish_match"}' >/dev/null
S=$(get "?reporter=1")
check "$(echo "$S"|val "d['finished']")" "True" "matchen avslutad"
check "$(echo "$S"|val "d['clockRunning']")" "False" "klockan stoppad"

echo ""
echo "=== Städa: återställ testmatchen ==="
DATABASE_URL="$DEVDB" node scripts/reset-dev-match.mjs >/dev/null 2>&1
rm -f "$CK"
echo ""
echo "============================================"
echo "  RESULTAT:  $PASS passerade,  $FAIL misslyckades"
echo "============================================"
[ "$FAIL" = 0 ] && exit 0 || exit 1
