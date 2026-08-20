/** Validerar migrationslistans ordning och returnerar endast ej körda id:n. */
export function pendingSchemaMigrationIds(
  orderedIds: readonly string[],
  appliedIds: ReadonlySet<string>
): string[] {
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("Schemamigrationernas id:n måste vara unika");
  }
  for (let index = 1; index < orderedIds.length; index++) {
    if (orderedIds[index - 1].localeCompare(orderedIds[index]) >= 0) {
      throw new Error("Schemamigrationerna måste ligga i stigande id-ordning");
    }
  }
  const knownIds = new Set(orderedIds);
  for (const appliedId of appliedIds) {
    if (!knownIds.has(appliedId)) {
      throw new Error(`Databasen innehåller en okänd schemamigration: ${appliedId}`);
    }
  }
  return orderedIds.filter((id) => !appliedIds.has(id));
}
