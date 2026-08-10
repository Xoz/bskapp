import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";

const exec = promisify(execFile);
const sourceUrl = process.env.DATABASE_URL ?? "";
if (!sourceUrl) throw new Error("DATABASE_URL måste vara satt.");
const dockerService = process.env.PG_DOCKER_SERVICE;
if (dockerService && !/^[a-z][a-z0-9_-]*$/.test(dockerService)) throw new Error("Ogiltigt Docker-servicenamn.");
const parsedSource = new URL(sourceUrl);
const sourceDatabase = decodeURIComponent(parsedSource.pathname.slice(1));
const sourceUser = decodeURIComponent(parsedSource.username);
if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(sourceDatabase) || !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(sourceUser)) throw new Error("Databasens namn eller användare kan inte verifieras säkert.");

const temporaryDatabase = `coach_restore_check_${process.pid}_${Date.now()}`;
if (!/^coach_restore_check_\d+_\d+$/.test(temporaryDatabase)) throw new Error("Ogiltigt temporärt databasnamn.");
const restoredUrl = new URL(sourceUrl);
restoredUrl.pathname = `/${temporaryDatabase}`;

async function tableCounts(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name
    `;
    const counts: Record<string, number> = {};
    for (const { table_name: table } of tables) {
      if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new Error(`Oväntat tabellnamn: ${table}`);
      const rows = await sql.unsafe<{ count: number }[]>(`SELECT COUNT(*)::int count FROM "${table}"`);
      counts[table] = rows[0].count;
    }
    return counts;
  } finally {
    await sql.end();
  }
}

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), "planlinjen-restore-"));
  const dump = path.join(directory, "backup.dump");
  let created = false;
  const containerDump = `/tmp/${temporaryDatabase}.dump`;
  try {
    const before = await tableCounts(sourceUrl);
    if (dockerService) {
      const docker = ["compose", "exec", "-T", dockerService];
      await exec("docker", [...docker, "pg_dump", "--format=custom", "--no-owner", "--no-acl", "-U", sourceUser, "-d", sourceDatabase, `--file=${containerDump}`]);
      await exec("docker", [...docker, "createdb", "-U", sourceUser, temporaryDatabase]);
      created = true;
      await exec("docker", [...docker, "pg_restore", "--no-owner", "--no-acl", "-U", sourceUser, "-d", temporaryDatabase, containerDump]);
    } else {
      await exec("pg_dump", ["--format=custom", "--no-owner", "--no-acl", `--file=${dump}`, sourceUrl]);
      await exec("createdb", [`--maintenance-db=${sourceUrl}`, temporaryDatabase]);
      created = true;
      await exec("pg_restore", ["--no-owner", "--no-acl", `--dbname=${restoredUrl.toString()}`, dump]);
    }
    const after = await tableCounts(restoredUrl.toString());
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(`Återställningen gav andra radantal. Källa=${JSON.stringify(before)} Återställd=${JSON.stringify(after)}`);
    }
    console.log(`Återställningsprov godkänt: ${Object.keys(before).length} tabeller och samtliga radantal matchar.`);
  } finally {
    if (dockerService) {
      const docker = ["compose", "exec", "-T", dockerService];
      if (created) await exec("docker", [...docker, "dropdb", "-U", sourceUser, "--if-exists", temporaryDatabase]);
      await exec("docker", [...docker, "rm", "-f", containerDump]);
    } else if (created) {
      await exec("dropdb", [`--maintenance-db=${sourceUrl}`, "--if-exists", temporaryDatabase]);
    }
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
