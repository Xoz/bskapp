import {NextRequest} from 'next/server';
import {requestOrigin} from '../../../../lib/auth';
import {readWorkday,writeWorkday} from '../../../../lib/desktop/workday';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
export async function GET(req:NextRequest){
 const result=await readWorkday(req.nextUrl.searchParams.get('kind')||'',Number(req.nextUrl.searchParams.get('id')));
 return Response.json(result.body,{status:result.status,headers});
}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==requestOrigin(req))return Response.json({error:'Otillåtet ursprung.'},{status:403,headers});
 if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return Response.json({error:'Ogiltigt format.'},{status:415,headers});
 const text=await req.text();if(Buffer.byteLength(text)>1_100_000)return Response.json({error:'Underlaget är för stort.'},{status:413,headers});
 let body;try{body=JSON.parse(text);}catch{return Response.json({error:'Ogiltigt underlag.'},{status:400,headers});}
 const result=await writeWorkday(body);return Response.json(result.body,{status:result.status,headers});
}
