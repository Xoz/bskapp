import {readFile} from 'node:fs/promises';
import {readLoans,type LoanBinding} from '@/lib/hermes/loans';
import {validLoanToken} from '@/lib/hermes/loanAuth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request) {
  let config:LoanBinding & {token:string};
  try {config=JSON.parse(await readFile('/etc/bsk-hermes/loans.json','utf8'));}
  catch {return Response.json({error:'Låneunderlaget är inte anslutet'},{status:503,headers});}
  if(!validLoanToken(request.headers.get('authorization'),config.token)) return Response.json({error:'Åtkomst nekad'},{status:401,headers});
  const raw=new URL(request.url).searchParams.get('matchId');
  if(raw!==null&&!/^[1-9]\d{0,8}$/.test(raw)) return Response.json({error:'Ogiltigt match-id'},{status:400,headers});
  try {return Response.json(await readLoans(config,raw===null?undefined:Number(raw)),{headers});}
  catch {return Response.json({error:'Låneunderlaget är inte tillgängligt. Kontrollera behörighet och målmatch; gissa inte.'},{status:403,headers});}
}
