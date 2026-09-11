import {timingSafeEqual} from 'node:crypto';
export function validLoanToken(header:string|null,token:unknown):boolean {
  if(typeof token!=='string'||token.length<40||!header?.startsWith('Bearer ')) return false;
  const received=Buffer.from(header.slice(7)),expected=Buffer.from(token);
  return received.length===expected.length&&timingSafeEqual(received,expected);
}
