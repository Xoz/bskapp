import type { BrowserContext, Page } from "playwright";
import {readLineup} from "./lineup";
import { ORIGIN, TEAM_PATH, dayOffset, sourceUrl, validateSnapshot, type ActivitySnapshot, type Reply } from "../../lib/svenskalag/model";

const months = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
export class LoginRequired extends Error {}
async function open(page: Page, url: string) {
  const response = await page.goto(sourceUrl(url), {waitUntil: "domcontentloaded", timeout: 30_000});
  if (!response?.ok()) throw new Error("Källan svarar inte");
  if (/login|logga-in/i.test(page.url())) throw new LoginRequired();
  sourceUrl(page.url());
  if (await page.locator('input[type="password"]').first().isVisible()) throw new LoginRequired();
  await page.locator("#logged-in-menu").waitFor({state:"attached", timeout:10_000}).catch(() => {throw new LoginRequired();});
}
export async function collect(context: BrowserContext, today: string): Promise<ActivitySnapshot[]> {
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const from = dayOffset(today, -28), to = dayOffset(today, 14);
  const monthKeys = new Set<string>();
  for (let date = from; date <= to; date = dayOffset(date, 1)) monthKeys.add(date.slice(0,7));
  const entries = new Map<string, Omit<ActivitySnapshot, "callups" | "totals" | "attendance">>();
  for (const month of monthKeys) {
    const [year, number] = month.split("-");
    await open(page, `${ORIGIN}${TEAM_PATH}/kalender/${year}/${months[Number(number)-1]}`);
    await page.locator("#table-schedule").waitFor({state:"attached"});
    const rows = await page.locator("#table-schedule tr").evaluateAll(rows => rows.map(row => {
      const cells = row.querySelectorAll("td");
      const a = row.querySelector<HTMLAnchorElement>('a[href*="/match/"],a[href*="/aktivitet/"]');
      return {url:a?.href ?? "", day:cells[0]?.querySelector("b")?.textContent?.trim() ?? "", time:cells[1]?.textContent?.match(/\d{1,2}:\d{2}/)?.[0] ?? "", title:row.querySelector(".activity-name")?.textContent?.trim() ?? ""};
    }));
    let currentDay = "";
    for (const row of rows) {
      if (row.day) currentDay = row.day;
      const match = row.url.match(/\/(match|aktivitet)\/(\d+)(?:\/|$)/);
      if (!match) continue;
      const date = `${month}-${currentDay.padStart(2,"0")}`;
      if (date < from || date > to) continue;
      const kind: "match" | "training" | null = match[1] === "match" ? "match" : /träning/i.test(row.title) ? "training" : null;
      if (!kind) continue;
      const value = {sourceId:match[2], url:sourceUrl(row.url), date, time:row.time.padStart(5,"0"), title:row.title, kind, cancelled:/inställd/i.test(row.title)};
      const old = entries.get(value.sourceId);
      if (old && JSON.stringify(old) !== JSON.stringify(value)) throw new Error("Motstridiga kalenderuppgifter");
      entries.set(value.sourceId, value);
    }
  }
  // Närvaro läses bara för aktiviteter som uttryckligen har sparad närvaro.
  const savedAttendance = new Map<string, {url:string; count:number}>();
  for (const year of new Set([...monthKeys].map(m=>m.slice(0,4)))) {
    await open(page, `${ORIGIN}${TEAM_PATH}/kontrollpanelen/aktiviteter`);
    const yearSelect = page.locator("select").filter({has:page.locator(`option[value="${year}"]`)}).first();
    if (await yearSelect.count()) { await yearSelect.selectOption(year); await page.waitForLoadState("domcontentloaded"); }
    await page.locator('tr[id^="ScheduleRow"]').first().waitFor({state:"attached"});
    const saved = await page.locator('tr[id^="ScheduleRow"]').evaluateAll(rows => rows.flatMap(row => {
      if (!row.querySelector('[title^="Närvaro sparad av"]')) return [];
      const link = row.querySelector('a[title="Fyll i närvaro"]');
      const url = link?.getAttribute("onclick")?.match(/popit\('([^']+)'/)?.[1];
      const id = row.id.match(/^ScheduleRow(\d+)_/)?.[1];
      const count = Number(link?.textContent?.trim());
      return id && url && Number.isInteger(count) ? [{id, url, count}] : [];
    }));
    for (const s of saved) savedAttendance.set(s.id, {url:sourceUrl(s.url),count:s.count});
  }
  const results: ActivitySnapshot[] = [];
  for (const entry of entries.values()) {
    await open(page, entry.url);
    let match:ActivitySnapshot["match"];
    if(entry.kind==='match') {
      const header=(await page.locator('.game-header').textContent())?.trim()??'';
      const teams=header.split(' - ');
      if(teams.length!==2||teams.filter(t=>/^Bollstanäs SK(?: |$)/.test(t)).length!==1) throw new Error('Matchens lag kunde inte verifieras');
      const homeAway=/^Bollstanäs SK(?: |$)/.test(teams[0])?'home':'away';
      const location=page.locator('.game-info p.text-muted');
      if(await location.count()>1) throw new Error('Spelplatsen kunde inte verifieras');
      match={homeAway,opponent:teams[homeAway==='home'?1:0].trim(),location:await location.count()?(await location.innerText()).trim():''};
    }
    if(entry.cancelled) {results.push({...entry,match,callups:[],totals:{accepted:0,declined:0,pending:0},attendance:null});continue;}
    const totals = {accepted:0, declined:0, pending:0};
    const callups: ActivitySnapshot["callups"] = [];
    for (const [panel, status] of [["tabYes","accepted"],["tabNo","declined"],["tabNoAnswer","pending"]] as const) {
      const tab = page.locator(`a[data-target="#${panel}"]`);
      if (await tab.count() !== 1) throw new Error("Kallelsesidan har ändrats eller saknar tillgänglig svarslista");
      const label = (await tab.textContent()) ?? "";
      const numbers = label.match(/(\d+)(?:\+(\d+))?\s*$/);
      if (!numbers) throw new Error("Svarsantal saknas");
      totals[status] = Number(numbers[1]);
      await tab.click();
      const names = await page.locator(`#${panel} a.delete-from-list[membertypeid="1"]`).evaluateAll(links=>links.map(a=>a.getAttribute("name")?.trim() ?? ""));
      if (names.length !== totals[status]) throw new Error("Hela svarslistan kunde inte läsas");
      callups.push(...names.map(name=>({name,status:status as Reply})));
    }
    let attendance: string[] | null = null;
    const presence = savedAttendance.get(entry.sourceId);
    if (presence && entry.date < today) {
      // Närvarofönstret har ett annat skal och saknar vanliga toppmenyn.
      const response = await page.goto(presence.url, {waitUntil:"domcontentloaded"});
      if (!response?.ok() || await page.locator('input[type="password"]').first().isVisible()) throw new LoginRequired();
      await page.locator(".memberlist").last().waitFor();
      if (await page.locator(".split-tab li:not(:last-child)").count() !== 1) throw new Error("Flera närvarogrupper behöver stöd innan import");
      const presentRows = page.locator(".memberlist").last().locator("li.player, li.leader, li.volunteer");
      if (presence.count > 0) await presentRows.first().waitFor();
      if (await presentRows.count() !== presence.count) throw new Error(`Närvarolistan är inte komplett för ${entry.sourceId}: ${await presentRows.count()}/${presence.count}`);
      attendance = await page.locator(".memberlist li.player.presence-row div.left").allTextContents();
      attendance = attendance.map(n=>n.replace(/^\s*\d+\.\s*/, "").split(",")[0].trim());
    }
    let lineup:string[]|undefined;
    if(entry.kind==='match'&&entry.date>=today) lineup=await readLineup(page,entry.sourceId);
    results.push({...entry, match, lineup, callups, totals, attendance});
  }
  validateSnapshot(results, today);
  await page.close();
  return results;
}
