# Backlog

Samlade öppna punkter. Detaljerade specar bor i egna filer – den här listan är en
överblick över vad som väntar och var det är dokumenterat.

## Öppet

- **GDPR** – appen lagrar personuppgifter om **minderåriga** (spelare 11–12 år):
  namn, bedömningar/betyg, AI-intervjusvar, närvaro m.m. Behöver gås igenom:
  rättslig grund/samtycke (vårdnadshavare), lagringstid & gallring, rätt till
  radering/utdrag, vilka personuppgifter som skickas till AI (Anthropic) och om
  det kräver särskild information. Frågan: vad behöver vi göra för att vara
  GDPR-kompatibla, och vad är minsta rimliga steg? *(Spec saknas – behöver skrivas.)*

- **Matchbetyg – Fas 2** (integrationer): kvar är **form-topplista i Översikt** och
  **bästa form-kort i cup**. Klart sedan tidigare: nivåförslag från matchform och
  invävning av form i AI-förslaget. Se [SPEC-matchbetyg.md](SPEC-matchbetyg.md).

- **Staging** – koden klar, manuella engångssteg kvar (Vercel-env, Google-redirect).
  OBS: DB:n är migrerad från Turso till **Supabase/Postgres** – stegen i STAGING.md
  behöver uppdateras till en Supabase-stagingdatabas. Se [STAGING.md](STAGING.md).
