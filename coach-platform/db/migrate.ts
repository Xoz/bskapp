import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL måste vara satt.");

const sql = postgres(databaseUrl, { max: 1 });
const migrationDir = path.join(process.cwd(), "db", "migrations");

async function baselineLegacyDatabase(files: string[]) {
  const [{ organizations, conducted, metadata }] = await sql<[{ organizations: boolean; conducted: boolean; metadata: boolean }]>`
    SELECT
      to_regclass('public.organizations') IS NOT NULL AS organizations,
      to_regclass('public.conducted_sessions') IS NOT NULL AS conducted,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='activity_logs' AND column_name='metadata'
      ) AS metadata
  `;
  if (!organizations) return;

  const inferred = new Set<string>(["001_initial.sql"]);
  if (conducted) inferred.add("002_conducted.sql");
  if (metadata) inferred.add("003_coach_workflow.sql");
  for (const file of files.filter(name => inferred.has(name))) {
    const source = await readFile(path.join(migrationDir, file), "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    await sql`INSERT INTO schema_migrations (name,checksum) VALUES (${file},${checksum}) ON CONFLICT (name) DO NOTHING`;
    console.log(`Baslinemarkerad: ${file}`);
  }
}

async function main() {
try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const files = (await readdir(migrationDir)).filter(file => /^\d+_.+\.sql$/.test(file)).sort();
  const existing = await sql<{ count: number }[]>`SELECT COUNT(*)::int count FROM schema_migrations`;
  if (existing[0].count === 0) await baselineLegacyDatabase(files);

  for (const file of files) {
    const source = await readFile(path.join(migrationDir, file), "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    const rows = await sql<{ checksum: string }[]>`SELECT checksum FROM schema_migrations WHERE name=${file}`;
    if (rows[0]) {
      if (rows[0].checksum !== checksum) throw new Error(`Migrationen ${file} har ändrats efter applicering.`);
      console.log(`Redan applicerad: ${file}`);
      continue;
    }
    await sql.begin(async tx => {
      await tx.unsafe(source);
      await tx`INSERT INTO schema_migrations (name,checksum) VALUES (${file},${checksum})`;
    });
    console.log(`Applicerad: ${file}`);
  }
} finally {
  await sql.end();
}
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
