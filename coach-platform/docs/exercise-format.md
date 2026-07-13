# Övningsformat

Planpositioner ska vara normaliserade 0–1. Diagrammet är statiskt och består av objekt och rörelselinjer med stabila id:n. Pilar refererar objekt-id eller fri punkt. JSON importeras först efter Zod-validering; SVG/PNG är exportformat, aldrig datakälla.

## Konkret format (`src/domain/diagram.ts`)

```ts
DiagramObject { id, type: "player"|"ball"|"cone"|"pole"|"goal"|"miniGoal"|"zone"|"text", x: 0..1, y: 0..1, label?, team?, width?, height?, rotation? }
Arrow         { id, kind: "pass"|"run"|"dribble", from: {objectId?}|{point:[x,y]}, to: {objectId?}|{point:[x,y]}, order }
Diagram       { widthRatio: number, objects: DiagramObject[], arrows: Arrow[] }
```

- `widthRatio` tolkas som planens höjd/bredd och väljer samtidigt planmall: träningsyta `0.72`, halvplan `0.8`, helplan `0.65`, kvadrat `1.0`.
- `order` bevaras för bakåtkompatibilitet men diagrammet har ingen uppspelning eller animation.
- `objectId`-referenser följer objektet när det flyttas; fri `point` ligger fast.
- Passning visas streckad, löpning rak och dribbling sicksackad.
- Spelare, motståndare och boll har samma visuella storlek. Egna spelare är blå, motståndare gula och målvakter gröna.
- Pilar kan skapas antingen med två klick (start, slut) eller genom att dra direkt. I markeringsläget har de en förstorad osynlig träffyta och kan byta linjetyp eller tas bort i egenskapspanelen.
- Zoner renderas bakom övriga objekt och kan ändra bredd/höjd. Spelare och text kan få etikett; mål och pinnar kan roteras.
- Validering: `diagramSchema` (Zod). `serialize`/`parse` garanterar round-trip.

## Persistens

`exercise_diagrams` (objects+actions jsonb, width_ratio, version). En aktiv diagramrad per övning i pilot-MVP; `saveDiagram` gör SELECT-then-upsert (ingen unique-constraint ännu). JSON skrivs med postgres.js `sql.json` så kolumnernas array-constraints bevaras.
