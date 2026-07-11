# Integration med BSK

Rekommenderat: monorepo med interna paket för `domain`, `schemas`, `repositories` och återanvändbara UI-moduler. BSK:s befintliga spelare och utvecklingstrappa mappas via explicita migreringsskript; ingen modul ska läsa BSK-tabeller direkt. Alternativ är internt paket med separata repositories eller fortsatt separat backend via ett versionshanterat API.
