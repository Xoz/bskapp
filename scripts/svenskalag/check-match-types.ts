import {chromium} from 'playwright';
import postgres from 'postgres';
import {authenticatedContext} from './auth';
import {collect} from './collect';
import {applySnapshot} from '../../lib/svenskalag/import';
async function main(){
  const sql=postgres(process.env.DATABASE_URL!,{prepare:false,max:1});
  const browser=await chromium.launch({headless:true,args:['--disable-features=BackForwardCache','--renderer-process-limit=2']});
  try {
    const context=await authenticatedContext(browser,process.env.SVENSKALAG_STATE_FILE!,{username:process.env.SVENSKALAG_USERNAME,password:process.env.SVENSKALAG_PASSWORD});
    const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'});
    for(const team of ['Gul','Grön'] as const){
      const rows=await collect(context,today,team);
      const result=await applySnapshot(sql,rows,today,true,team);
      console.log(JSON.stringify({team,...result,matches:rows.filter(a=>a.kind==='match').map(a=>({sourceId:a.sourceId,...a.match?.metadata}))}));
    }
  } finally {await browser.close();await sql.end();}
}
main().catch(()=>{console.error('Provhämtningen kunde inte verifieras.');process.exitCode=1;});
