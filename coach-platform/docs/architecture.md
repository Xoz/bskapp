# Arkitektur

De skrivande vyerna använder server actions och PostgreSQL-adaptern i `src/repositories/postgres.ts`. Alla frågor avgränsas server-side till pilotlaget och dess organisation; klienten väljer inte lag. Domänlagret känner varken till Next.js eller PostgreSQL. BSK-sessionen blir tillitsgräns när apparna integreras. Diagramredigeraren blir en separat klientkomponent med Zustand-state och serialiserbart diagramformat.
