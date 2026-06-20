# Roller, behörigheter och grupper

Status: **Byggd 2026-06-20**.

## Roller

- **Admin** – full åtkomst och kan aldrig begränsas med individuella undantag.
- **Huvudtränare** – hela den sportsliga verksamheten samt användare och grupper.
- **Tränare** – spelare, utvärderingar, matcher, laguttagningar och statistik som standard.
- **Ledare** – grundläggande spelarlista, matcher, laguttagning och liverapportering.
- **Spelare** – endast den eller de spelarprofiler som uttryckligen kopplats till kontot.
- **Förälder** – endast uttryckligen kopplade barn.

En användare kan ha flera roller. Rollernas standardrättigheter slås samman. Admin eller
huvudtränare kan därefter lägga ett individuellt `allow`/`deny` på varje funktion.

## Lagbegränsning

Personal utan valda grupper ser alla grupper. Så snart minst en grupp väljs i
Administration begränsas både läsning och skrivning till dessa grupper. Server actions och
API-rutter gör samma kontroll som gränssnittet; dold navigation är aldrig säkerhetsgränsen.

## Gruppmodell

- `squad` – huvudtrupp, exempelvis BSK F2014.
- `subgroup` – varaktig undergrupp, exempelvis Gul eller Grön.
- `matchgroup` – tillfällig eller återanvändbar uttagningsgrupp, ofta kopplad till en cup.

Spelare kopplas många-till-många via `player_group_memberships`. En spelare kan därför ha
en ordinarie undergrupp och samtidigt ingå i flera cup-/matchgrupper. Matcher pekar på den
grupp som spelade matchen. När en cup skapas eller importeras skapas dess matchgrupp
automatiskt om den inte redan finns.

## Konto- och sessionsmodell

Google-inloggning slår upp `users` och `user_roles`; cookien innehåller bara ett signerat
användar-id. Gamla adresser i `allowed_coach_emails` migreras vid första inloggningen.
`ADMIN_EMAIL` väljer första admin. Om variabeln saknas används första adressen i den gamla
listan. PIN-inloggning för spelare finns kvar parallellt.

## Databastabeller

`users`, `user_roles`, `user_permissions`, `groups`, `player_group_memberships`,
`user_group_access`, `user_player_links`; dessutom `matches.group_id`.
