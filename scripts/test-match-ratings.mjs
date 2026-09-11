// Endast den separata lokala testdatabasen, med tillfälliga exempelspelare.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import postgres from 'postgres';
import { chromium } from 'playwright';
const sql=postgres('postgresql://localhost:5432/bsk_match_ratings_test',{max:1});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
let user, group; const players=[],matches=[];
try {
  await page.goto('http://localhost:3026/login');
  user=(await sql`INSERT INTO users(email,name) VALUES(${crypto.randomUUID()+'@example.invalid'},'Exempeltränare') RETURNING id`)[0].id;
  await sql`INSERT INTO user_roles(user_id,role) VALUES(${user},'admin')`;
  group=(await sql`INSERT INTO groups(name,group_type) VALUES('Gul','subgroup') RETURNING id`)[0].id;
  for(const name of ['Exempel: Ada','Exempel: Bea','Exempel: Cecilia Långt Efternamn','Exempel: Endast uttagen']) {
    const p=(await sql`INSERT INTO players(name) VALUES(${name}) RETURNING id`)[0].id; players.push(p);
    await sql`INSERT INTO player_group_memberships(player_id,group_id,is_primary) VALUES(${p},${group},1)`;
  }
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date());
  const past=new Date(today+'T12:00:00Z');past.setUTCDate(past.getUTCDate()-1);
  const date=past.toISOString().slice(0,10);
  for(let i=0;i<5;i++) {
    const m=(await sql`INSERT INTO matches(date,opponent,group_id,level,finished) VALUES(${date},${'Exempel motstånd '+i},${group},'latt',1) RETURNING id`)[0].id;matches.push(m);
    for(const p of players.slice(0,3)) await sql`INSERT INTO match_players(match_id,player_id) VALUES(${m},${p})`;
    await sql`INSERT INTO match_roster(match_id,player_id,selection_status) VALUES(${m},${players[3]},'selected')`;
    if(i>0) await sql`INSERT INTO match_player_evaluations(match_id,player_id,contributor_type,contributor_id,rating,match_level_snapshot) VALUES(${m},${players[0]},'coach',${String(user)},5,'latt')`;
  }
  const value='user:'+user;
  await context.addCookies([{name:'bsk_session',value:value+'.'+crypto.createHmac('sha256','bsk-match-rating-local-test').update(value).digest('hex'),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);
  const url=`http://localhost:3026/matcher/${matches[0]}/utvardera`;
  await page.goto(url);
  await page.getByRole('heading',{name:'Deltagarnas prestation'}).waitFor();
  assert.equal(await page.locator('.rating-row').count(),3);
  assert.equal(await page.getByText('Exempel: Endast uttagen',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Exempel: Ada: 5 – Var klart över nivån',exact:true}).click();
  await page.getByRole('button',{name:'Exempel: Bea: 3 – Klarade nivån',exact:true}).click();
  await page.locator('.rating-comment summary').first().click();
  await page.getByRole('textbox',{name:'Kommentar för Exempel: Ada',exact:true}).fill('Bra beslut i passningsspelet');
  for(const width of [320,390,744]) {await page.setViewportSize({width,height:900}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/bsk-ratings-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Spara utvärdering',exact:true}).click();
  await page.waitForURL(`**/matcher/${matches[0]}`);
  const saved=await sql`SELECT player_id,rating,rating_comment,skipped,match_level_snapshot FROM match_player_evaluations WHERE match_id=${matches[0]} ORDER BY player_id`;
  assert.deepEqual(saved.map(r=>r.rating),[5,3,null]); assert.equal(saved[2].skipped,1); assert.equal(saved[0].rating_comment,'Bra beslut i passningsspelet');
  await sql`UPDATE match_player_evaluations SET self_comparison='usual',match_impact='held',rating=NULL,skipped=0 WHERE match_id=${matches[0]} AND player_id=${players[2]}`;
  await page.goto(url);
  assert.equal(await page.getByRole('button',{name:'Exempel: Ada: 5 – Var klart över nivån',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Exempel: Bea: 3 – Klarade nivån',exact:true}).click();
  await page.getByRole('button',{name:'Spara utvärdering',exact:true}).click();await page.waitForURL(`**/matcher/${matches[0]}`);
  assert.equal((await sql`SELECT rating FROM match_player_evaluations WHERE match_id=${matches[0]} AND player_id=${players[1]}`)[0].rating,null);
  const legacy=(await sql`SELECT self_comparison,match_impact FROM match_player_evaluations WHERE match_id=${matches[0]} AND player_id=${players[2]}`)[0];
  assert.equal(legacy.self_comparison,'usual');assert.equal(legacy.match_impact,'held');
  await page.goto(`http://localhost:3026/spelare/${players[0]}`);
  await page.getByText('Visad nivå: Lätt',{exact:true}).waitFor();
  await page.screenshot({path:'/tmp/bsk-ratings-profile.png',fullPage:true});
  assert.ok((await page.locator('body').innerText()).includes('pröva Medel'));
  // Den befintliga tränarbedömningen kan fastställa alla fem nivåer.
  await sql`UPDATE players SET preferred_level_primary='1', preferred_level_secondary='' WHERE id=${players[0]}`;
  const token=crypto.randomBytes(32).toString('hex');
  await sql`INSERT INTO match_evaluation_invites(match_id,label,token_hash,expires_at,created_by) VALUES(${matches[0]},'Exempel bedömare',${crypto.createHash('sha256').update(token).digest('hex')},now()+interval '1 day',${user})`;
  await context.clearCookies();
  await page.goto(`http://localhost:3026/matchutvardering/${token}`);
  await page.getByRole('button',{name:'Exempel: Ada: 4 – Klarade nivån med god marginal',exact:true}).click();
  await page.getByRole('button',{name:'Spara utvärdering',exact:true}).click();await page.waitForURL('**?sparad=1');
  assert.equal((await sql`SELECT rating FROM match_player_evaluations WHERE match_id=${matches[0]} AND contributor_type='invite' AND player_id=${players[0]}`)[0].rating,4);
  await sql`UPDATE match_evaluation_invites SET revoked_at=now() WHERE match_id=${matches[0]}`;
  const denied=await page.goto(`http://localhost:3026/matchutvardering/${token}`);assert.equal(denied.status(),404);
  assert.deepEqual(errors,[]);
  console.log('Godkänt: deltagarlista, 320/390/744 px, spara/återläs/rensa, kommentar, nivåprofil, extern bedömning och återkallad länk.');
} finally {
  for(const m of matches) await sql`DELETE FROM matches WHERE id=${m}`;
  for(const p of players) await sql`DELETE FROM players WHERE id=${p}`;
  if(group) await sql`DELETE FROM groups WHERE id=${group}`;
  if(user) {await sql`DELETE FROM activity_log WHERE coach_name='Exempeltränare'`;await sql`DELETE FROM users WHERE id=${user}`;}
  await browser.close();await sql.end();
}
