<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Läs kartan först

Innan du ändrar eller lägger till kod: läs `docs/CODEMAP.md` och öppna bara de filer den
pekar på för uppgiften. Svep inte hela `lib/` eller `components/` för att leta — det slösar tokens.
När du lägger till en fil, route, DB-tabell eller exportfunktion: uppdatera `docs/CODEMAP.md` i samma ändring.

## Kallprioritet

For detta repo galler:

1. repots kod och lokala docs
2. `docs/CODEMAP.md` och `docs/PROJECT_CONTEXT.md`
3. Obsidian-projektsidan for BSK App
4. GBrain endast som fallback

Projektstatus och handover ska i forsta hand lasas fran repo och Obsidian, inte fran GBrain.

## Gemensamt språk i hela appen (beslut 2026-09-10)

- **Trupp** = alla som tackat ja och kommer att spela matchen (`callup_status=accepted`).
- **Laguppställning / Uttagen** = planerad att spela, kallelse skickad eller kommer att skickas (`selection_status=selected`). Uttagning är inte ett ja-svar.
- **Deltog / Deltagare** = faktisk registrerad närvaro efter matchen.
- **Spelare / Spelarregister / Huvudlag** = hela spelarbasen eller organisationen; använd inte trupp för dessa.

Definitionerna gäller alla vyer, räknare, hjälptexter, guide och API-etiketter. Ändra aldrig kallelsesvar eller uttagning bara för att anpassa terminologin. Interna befintliga databasfält och URL:er kan behålla sina namn.
