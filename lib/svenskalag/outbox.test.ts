import {it,expect} from 'vitest';
import {publicationDecision,type LineupJob} from './outbox';
const job:LineupJob={id:'x',matchId:1,sourceId:'12',date:'2026-09-12',names:['Spelare A','Spelare B'],baseline:['Spelare A'],state:'queued',message:'',createdAt:'2026-09-10'};
it('publicerar bara mot oförändrad uppställning',()=>{
 expect(publicationDecision(['Spelare A'],job)).toBe('write');
 expect(publicationDecision(['Spelare C'],job)).toBe('conflict');
});
it('identiska återförsök skriver inget och osäkra försök upprepas inte',()=>{
 expect(publicationDecision(['Spelare B','Spelare A'],{...job,state:'running'})).toBe('done');
 expect(publicationDecision(['Spelare A'],{...job,state:'running'})).toBe('conflict');
});
it('tom eller tvetydig uttagning kan inte skickas',()=>{
 expect(publicationDecision(['Spelare A'],{...job,names:[]})).toBe('conflict');
 expect(publicationDecision(['Spelare A'],{...job,names:['Spelare A','spelare a']})).toBe('conflict');
});
