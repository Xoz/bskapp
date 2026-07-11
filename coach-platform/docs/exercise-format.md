# Övningsformat

Planpositioner ska vara normaliserade 0–1. Diagrammet består av versionshanterade objekt och actions med stabila id:n. Pilar refererar objekt-id eller fri punkt. JSON importeras först efter Zod-validering; SVG/PNG är exportformat, aldrig datakälla.

## Konkret format (`src/domain/diagram.ts`)

```ts
DiagramObject { id, type: "player"|"ball"|"cone"|"goal", x: 0..1, y: 0..1, label?, team?: "att"|"def"|"gk" }
Arrow         { id, kind: "pass"|"run"|"dribble", from: {objectId?}|{point:[x,y]}, to: {objectId?}|{point:[x,y]}, order }
Diagram       { widthRatio: number, objects: DiagramObject[], arrows: Arrow[] }
```

- `widthRatio` tolkas som planens höjd/bredd (0.65 ≈ 7v7, ~1.5:1); SVG `aspect-ratio: 1 / widthRatio`.
- `order` styr uppspelningssekvensen — pilarna spelas i ordning, bollen flyttas till aktuella pilens `to`.
- `objectId`-referenser följer objektet när det flyttas; fri `point` ligger fast.
- Validering: `diagramSchema` (Zod). `serialize`/`parse` garanterar round-trip.

## Persistens

`exercise_diagrams` (objects+actions jsonb, width_ratio, version). En aktiv diagramrad per övning i pilot-MVP; `saveDiagram` gör SELECT-then-upsert (ingen unique-constraint ännu).