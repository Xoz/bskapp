# Arkitektur

UI anropar applikationstjänster via repository-interface. Domänlagret känner varken till Next.js eller PostgreSQL. Serveradaptern ska kontrollera session, organisation, lagroll och input innan repository-anrop. Diagramredigeraren blir en separat klientkomponent med Zustand-state och serialiserbart diagramformat.
