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

- **Matchbetyg – Fas 2** (integrationer): nivåförslag, väg in form i AI-förslag,
  form-topplista i Översikt, bästa form-kort i cup. Se [SPEC-matchbetyg.md](SPEC-matchbetyg.md).

- **Matchgrupper** (flera lag, delad pool) – Fas 1–4, inget byggt än.
  Se [SPEC-matchgrupper.md](SPEC-matchgrupper.md).

- **Staging** – koden klar, 3 manuella engångssteg kvar (Turso-DB, Vercel-env,
  Google-redirect). Se [STAGING.md](STAGING.md).
