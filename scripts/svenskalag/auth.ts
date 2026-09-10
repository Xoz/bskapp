import type { Browser, BrowserContext } from "playwright";
import { access, chmod, rename, rm } from "node:fs/promises";
import { ORIGIN, TEAM_PATH } from "../../lib/svenskalag/model";
import { LoginRequired } from "./collect";

export async function authenticatedContext(browser: Browser, stateFile: string, credentials: {username?:string; password?:string}): Promise<BrowserContext> {
  const admin = `${ORIGIN}${TEAM_PATH}/kontrollpanelen/aktiviteter`;
  const exists = await access(stateFile).then(()=>true,()=>false);
  const verify = async (context:BrowserContext) => {
    const page = await context.newPage();
    try {
      const response=await page.goto(admin,{waitUntil:"domcontentloaded",timeout:30_000});
      if (!response?.ok() || page.url()!==admin) return false;
      await page.locator('#logged-in-menu').waitFor({state:'attached',timeout:5000});
      await page.locator('tr[id^="ScheduleRow"]').first().waitFor({state:'attached',timeout:5000});
      return true;
    } catch {return false;} finally {await page.close();}
  };
  const make = async (state?:string, login=false) => {
    const context=await browser.newContext({storageState:state,locale:"sv-SE",timezoneId:"Europe/Stockholm",acceptDownloads:false});
    await context.route('**/*',route=>{
      const request=route.request();
      const allowed=["GET","HEAD"].includes(request.method()) || (login && request.method()==="POST" && new URL(request.url()).origin===ORIGIN);
      return allowed ? route.continue() : route.abort();
    });
    return context;
  };
  if (exists) {
    const context=await make(stateFile);
    if(await verify(context)) return context;
    await context.close();
  }
  if (!credentials.username || !credentials.password) throw new LoginRequired();
  const context=await make(undefined,true);
  const temporary=`${stateFile}.new`;
  try {
    const page=await context.newPage();
    await page.goto(`${ORIGIN}${TEAM_PATH}#openLoginModal=true`,{waitUntil:"domcontentloaded",timeout:30_000});
    const cookies=page.getByRole('button',{name:'Bara nödvändiga',exact:true});
    if(await cookies.isVisible()) await cookies.click();
    await page.locator('#login-username').fill(credentials.username);
    await page.locator('#login-password').fill(credentials.password);
    await page.locator('#login-submit').click();
    await page.locator('#logged-in-menu').waitFor({state:'attached',timeout:20_000});
    await page.close();
    if (!await verify(context)) throw new LoginRequired();
    await context.storageState({path:temporary});
    await chmod(temporary,0o600);
    await rename(temporary,stateFile);
  } catch {
    await rm(temporary,{force:true});
    throw new LoginRequired();
  } finally {await context.close();}
  // Ny kontext: POST är åter blockerat efter den enda inloggningsinlämningen.
  return make(stateFile);
}
