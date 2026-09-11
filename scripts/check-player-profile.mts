import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import crypto from 'node:crypto';
import postgres from 'postgres';
import { chromium } from 'playwright';
import { SKILLS } from '../lib/skillTrappan';

const dbUrl = process.env.BSK_PROFILE_TEST_DATABASE_URL;
const appUrl = process.env.BSK_PROFILE_TEST_APP_URL || 'http://localhost:3114';
if (!dbUrl || !['localhost','127.0.0.1'].includes(new URL(dbUrl).hostname) || !new URL(dbUrl).pathname.startsWith('/bsk_profile_verify_') || !['localhost','127.0.0.1'].includes(new URL(appUrl).hostname)) throw new Error('Kräver separat lokal profildatabas och lokal app.');
const sql = postgres(dbUrl, { max: 1 });
const browser = await chromium.launch();
const output = process.env.BSK_PROFILE_SCREENSHOTS || '/tmp/bsk-profile-screenshots';
await mkdir(output, { recursive: true });
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const year = today.slice(0,4);
const player = 980001;
const emptyPlayer = 980002;
const coach = 980001;
const restricted = 980002;
const admin = 980003;
const secret = "local-profile-verification-only-not-production";
const cookie = (id: number) => { const value=`user:${id}`; return `${value}.${crypto.createHmac("sha256",secret).update(value).digest("hex")}`; };
const otherTeam = 980001;
try {
  await sql`INSERT INTO players(id,name,jersey_number,active,preferred_level_primary,preferred_level_secondary) VALUES
    (${player},'Exempel: Alex Andersson',13,1,'4','3'),(${emptyPlayer},'Exempel: Tom Profil',14,1,'','') ON CONFLICT(id) DO NOTHING`;
  await sql`INSERT INTO groups(id,name,group_type) VALUES(${otherTeam},'Grön','subgroup') ON CONFLICT(id) DO NOTHING`;
  await sql`INSERT INTO player_group_memberships(player_id,group_id,is_primary) VALUES(${player},2,1),(${emptyPlayer},2,1) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO development_checkpoints(id,player_id,date,coach_name,focus_note) VALUES('profile-check',${player},${today},'Exempeltränare','Privat fokusanteckning för kontroll.') ON CONFLICT DO NOTHING`;
  for (const [i, skill] of SKILLS.slice(0,2).entries()) {
    await sql`INSERT INTO player_skill_status(player_id,skill_id,status) VALUES(${player},${skill.id},${i ? 'almost' : 'training'}) ON CONFLICT(player_id,skill_id) DO UPDATE SET status=EXCLUDED.status`;
    await sql`INSERT INTO development_checkpoint_skills(checkpoint_id,skill_id,status,previous_status,is_focus) VALUES('profile-check',${skill.id},${i ? 'almost' : 'training'},'not_started',1) ON CONFLICT DO NOTHING`;
  }
  await sql`INSERT INTO player_conversations(id,player_id,conversation_date,coach_name,agreed_actions,follow_up_on) VALUES('profile-talk',${player},${today},'Exempeltränare','Privat överenskommelse för kontroll.',${today}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO development_activities(id,activity_date,activity_type,title,external_key,group_id) VALUES('profile-training',${year + '-09-01'},'training','Exempelträning','profile-training',2) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO development_activity_participation(activity_id,player_id,attendance_status) VALUES('profile-training',${player},'present') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO development_observations(id,activity_id,player_id,evidence,note,coach_name) VALUES('profile-observation','profile-training',${player},'shown','Privat observation för kontroll.','Exempeltränare') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO matches(id,date,opponent,home_away,match_type,finished,group_id) VALUES
    (980001,${year+'-09-01'},'Exempelmotstånd Gul','home','seriespel',1,2),
    (980002,${year+'-09-02'},'Exempelmotstånd Grön','away','traningsmatch',1,${otherTeam}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO match_players(match_id,player_id) VALUES(980001,${player}),(980002,${player}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO match_roster(match_id,player_id,callup_status) VALUES(980001,${player},'accepted'),(980002,${player},'declined') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO match_player_evaluations(id,match_id,player_id,contributor_type,contributor_id,self_comparison,match_impact) VALUES(980001,980001,${player},'coach','980001','above','influenced') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO users(id,email,name,active) VALUES(${coach},'profile-coach@example.test','Exempeltränare',1),(${restricted},'profile-restricted@example.test','Begränsad tränare',1),(${admin},'profile-fixture-admin@example.test','Exempeladministratör',1) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO user_roles(user_id,role) VALUES(${coach},'coach'),(${restricted},'coach'),(${admin},'admin') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO user_permissions(user_id,permission_key,allowed) VALUES(${coach},'view_private_player_data',0),(${coach},'manage_squads',0) ON CONFLICT(user_id,permission_key) DO UPDATE SET allowed=0`;
  await sql`INSERT INTO user_group_access(user_id,group_id) VALUES(${restricted},${otherTeam}) ON CONFLICT DO NOTHING`;

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addCookies([{name:'bsk_session',value:cookie(admin),url:appUrl}]);
  await page.goto(`${appUrl}/spelare/${player}?lag=Gul&q=Alex`);
  await page.getByRole('heading', { name: 'Aktuellt fokus', exact: true }).waitFor();
  assert.equal(await page.getByRole('link',{name:'Öppna utvecklingsträdet',exact:true}).count(),1);
  assert.equal(await page.getByText('Privat observation för kontroll.',{exact:true}).count(),1);
  assert.equal(await page.getByText('Privat överenskommelse för kontroll.',{exact:true}).count(),1);
  assert.equal(await page.getByText('Positiv utveckling',{exact:true}).count(),0);
  assert.equal(await page.locator('.profile-battery').getByText('olösta',{exact:false}).count(),0);
  assert.deepEqual(await page.locator('.profile-stats dd').allTextContents(), ['1','2','2']);
  const battery = await page.locator('.profile-battery').boundingBox();
  assert(battery && battery.height < 210, 'Kompakt batterikort');
  const cta = await page.getByRole('link',{name:'Öppna utvecklingsträdet',exact:true}).boundingBox();
  assert(cta && cta.y+cta.height < 780, 'Trädlänken syns på första mobilskärmen');
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:844});
    await page.evaluate(() => window.scrollTo(0,0));
    await page.screenshot({path:`${output}/profile-${width}.png`,fullPage:true});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Inget horisontellt överflöde vid ${width}px`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByText('Vad räknas och vilka lag?',{exact:true}).click();
  await page.getByText('Grön: 1 spelade matcher',{exact:true}).waitFor();
  await page.getByText(`Spelade matcher ${year} (2)`,{exact:true}).click();
  await page.getByText('Träningsmatch',{exact:false}).last().waitFor();
  await page.getByRole('link',{name:'Ange position',exact:true}).click();
  await page.locator('#bedomning[open]').waitFor();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bottom = await page.locator('#bedomning').boundingBox();
  const nav = await page.locator('.bsk-bottom-nav').boundingBox();
  assert(bottom && nav && bottom.y+bottom.height <= nav.y, 'Sista sektionen kan läsas ovanför bottennavigationen');
  await page.getByRole('link',{name:'Alla spelare',exact:true}).click();
  await page.locator(`#spelare-${player}`).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('lag'),'Gul');
  assert.equal(await page.getByRole('searchbox').inputValue(),'Alex');
  assert.equal(new URL(page.url()).hash,`#spelare-${player}`);
  await page.locator(`#spelare-${player}`).click();
  await page.getByRole('link',{name:'Öppna utvecklingsträdet',exact:true}).click();
  await page.getByRole('link',{name:'Exempel: Alex Andersson',exact:true}).click();
  await page.getByRole('heading',{name:'Aktuellt fokus',exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('q'),'Alex');
  await page.evaluate(() => { document.documentElement.dataset.theme='dark'; window.scrollTo(0,0); });
  await page.screenshot({path:`${output}/profile-dark.png`,fullPage:true});
  await page.goto(`${appUrl}/spelare/${emptyPlayer}`);
  await page.getByText('Inget fokus valt ännu.',{exact:false}).waitFor();
  await page.screenshot({path:`${output}/profile-empty.png`,fullPage:true});
  assert.deepEqual(await page.locator('.profile-stats dd').allTextContents(),['0','0','0']);

  await context.addCookies([{name:'bsk_session',value:cookie(coach),url:appUrl}]);
  await page.goto(`${appUrl}/spelare/${player}`);
  assert.equal(new URL(page.url()).pathname, '/spelare');
  const body = await page.locator('body').innerText();
  assert(!body.includes('Privat observation') && !body.includes('Privat överenskommelse') && !body.includes('Privat fokusanteckning'), 'Privata uppgifter dolda');
  await sql`UPDATE user_permissions SET allowed=1 WHERE user_id=${coach} AND permission_key='view_private_player_data'`;
  await sql`INSERT INTO user_permissions(user_id,permission_key,allowed) VALUES(${coach},'manage_evaluations',0) ON CONFLICT(user_id,permission_key) DO UPDATE SET allowed=0`;
  await page.goto(`${appUrl}/spelare/${player}`);
  await page.getByRole('heading',{name:'Aktuellt fokus',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Förbered spelarsamtal',exact:true}).count(),0);
  assert.equal(await page.getByText('Justera kapacitet',{exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'Ange position',exact:true}).count(),0);
  await context.addCookies([{name:'bsk_session',value:cookie(restricted),url:appUrl}]);
  const denied = await page.goto(`${appUrl}/spelare/${player}`);
  assert.equal(denied?.status(),404);
  assert(!(await page.locator('body').innerText()).includes('Exempel: Alex Andersson'));
  assert.deepEqual(errors,[]);
  console.log('Godkänt: mobil/dator/mörkt läge, tomt/ifyllt träd, en trädlänk, statistik, lagfördelning, återgång med sökning, position, privat åtkomst och lagisolering.');
} finally { await browser.close(); await sql.end(); }
