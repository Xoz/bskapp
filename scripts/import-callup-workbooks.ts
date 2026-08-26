import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { importSvenskaLagCallupWorkbooks } from "../lib/services/callupWorkbookImport";

async function main() {
  const apply = process.argv.includes("--apply");
  const paths = process.argv.slice(2).filter((arg) => arg !== "--apply");
  if (paths.length < 1 || paths.length > 2) {
    throw new Error("Användning: npm run import:callups -- [--apply] fil-gul.xlsx [fil-grön.xlsx]. Träningar tas endast från Gul, idag till 14 dagar framåt.");
  }
  const files = await Promise.all(paths.map(async (path) => {
    const buffer = await readFile(path);
    return {
      name: basename(path),
      buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  }));
  const result = await importSvenskaLagCallupWorkbooks(files, "Ömer Özmen", { dryRun: !apply });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
