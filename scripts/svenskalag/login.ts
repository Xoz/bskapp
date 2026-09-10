import { chromium } from "playwright";
import { mkdir, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { ORIGIN, TEAM_PATH } from "../../lib/svenskalag/model";
process.umask(0o077);
async function main() {
  const file = process.env.SVENSKALAG_STATE_FILE;
  if (!file) throw new Error("SVENSKALAG_STATE_FILE saknas");
  await mkdir(dirname(file),{recursive:true,mode:0o700});
  const browser = await chromium.launch({headless:false});
  const context = await browser.newContext({locale:"sv-SE"});
  const page = await context.newPage();
  await page.goto(`${ORIGIN}${TEAM_PATH}/kontrollpanelen/aktiviteter`);
  console.log("Logga in i det öppnade fönstret. Sessionen sparas när Guls närvarolista är tillgänglig.");
  await page.locator('tr[id^="ScheduleRow"]').first().waitFor({state:"attached",timeout:15*60_000});
  if (!page.url().startsWith(`${ORIGIN}${TEAM_PATH}/kontrollpanelen/aktiviteter`)) throw new Error("Fel lagvy");
  await context.storageState({path:file});
  await chmod(file,0o600);
  await browser.close();
  console.log("Inloggningen är klar. Sessionsfilen har skyddade filrättigheter.");
}
main().catch(()=>{console.error("Inloggningen slutfördes inte.");process.exitCode=1;});
