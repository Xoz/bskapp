import {nameKey} from './model';
export const lineupKey=(id:number)=>`svenskalag_lineup:${id}`;
export const outboxKey=(id:number)=>`svenskalag_outbox:${id}`;
export const draftKey=(id:number)=>`svenskalag_draft:${id}`;
export type SourceLineup={sourceId:string;date:string;names:string[];fetchedAt:string};
export type LineupJob={id:string;matchId:number;sourceId:string;date:string;names:string[];baseline:string[];state:'queued'|'running'|'ok'|'conflict'|'error';message:string;createdAt:string;finishedAt?:string};
export const lineupRevision=(names:string[])=>JSON.stringify(names.map(nameKey).sort());
export function sameLineup(a:string[],b:string[]):boolean {
  return JSON.stringify(a.map(nameKey).sort())===JSON.stringify(b.map(nameKey).sort());
}
export function validLineup(names:string[]):boolean {
  return Array.isArray(names)&&names.length<=40&&names.every(n=>typeof n==='string'&&n.trim().length>0&&n.length<=150)&&new Set(names.map(nameKey)).size===names.length;
}
/** Retry after an uncertain response only reads; it never repeats a write blindly. */
export function publicationDecision(current:string[],job:LineupJob):'done'|'write'|'conflict' {
  if(!validLineup(current)||!validLineup(job.names)||!validLineup(job.baseline)||job.names.length===0) return 'conflict';
  if(sameLineup(current,job.names)) return 'done';
  if(job.state==='running'||!sameLineup(current,job.baseline)) return 'conflict';
  return 'write';
}
