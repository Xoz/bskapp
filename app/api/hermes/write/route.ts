import {readFile} from 'node:fs/promises';
import {writeContext,executeWrite,type WriteBinding} from '../../../../lib/hermes/writes';
import {validLoanToken} from '../../../../lib/hermes/loanAuth';
import {WriteError,type WriteKind} from '../../../../lib/hermes/writeModel';
import {DevelopmentServiceError} from '../../../../lib/services/development';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function handle(request:Request,write:boolean){
 let config:WriteBinding & {token:string};
 try{config=JSON.parse(await readFile('/etc/bsk-hermes/write.json','utf8'));}
 catch{return Response.json({error:'BSK-skrivstödet är inte anslutet.'},{status:503,headers});}
 if(!validLoanToken(request.headers.get('authorization'),config.token))return Response.json({error:'Åtkomst nekad.'},{status:401,headers});
 try{
  let result;
  if(write){
   if(Number(request.headers.get('content-length')||0)>20000)throw new WriteError('För stort kommando.',413);
   const text=await request.text();if(text.length>20000)throw new WriteError('För stort kommando.',413);
   let body;try{body=JSON.parse(text);}catch{throw new WriteError('Ogiltigt JSON.');}
   result=await executeWrite(config,body);
  }else{
   const q=new URL(request.url).searchParams;result=await writeContext(config,q.get('kind') as WriteKind,Number(q.get('id')));
  }
  return Response.json(result,{headers});
 }catch(e){
  if(e instanceof WriteError||e instanceof DevelopmentServiceError)return Response.json({error:e.message},{status:e.status,headers});
  return Response.json({error:'Skrivningen kunde inte verifieras. Återanvänd samma kommando-ID vid nytt försök.'},{status:500,headers});
 }
}
export const GET=(r:Request)=>handle(r,false);
export const POST=(r:Request)=>handle(r,true);
