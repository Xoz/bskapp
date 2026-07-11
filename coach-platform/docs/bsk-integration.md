# Integration med BSK

Rekommenderat: monorepo med interna paket för `domain`, `schemas`, `repositories` och återanvändbara UI-moduler. BSK:s befintliga spelare och utvecklingstrappa mappas via explicita migreringsskript; ingen modul ska läsa BSK-tabeller direkt. Alternativ är internt paket med separata repositories eller fortsatt separat backend via ett versionshanterat API.

## MVP-beslut

Piloten omfattar ett lag och fyra tränare. BSK-appen äger autentiseringen; tränarplattformen ska därför inte ha en separat inloggning. Vid integration verifieras BSK-sessionen server-side och pilotlagets identitet sätts på serversidan. Lag- eller användar-id från URL, formulär eller annan klientdata får inte vara behörighetsgrund. Generell organisationshantering och flerlag-RBAC skjuts till fas 2.
