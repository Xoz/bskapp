import type {loanCandidate,LoanMatch} from './loanModel';
type Candidate=ReturnType<typeof loanCandidate>&{name:string};
export function loanAnswer(target:LoanMatch,candidates:Candidate[],fetchedAt:string):string {
 const blocked=candidates.filter(c=>c.category==='upptagen_enligt_tidsantagande');
 const review=candidates.filter(c=>['mojlig_att_fraga','underlag_behover_kontrolleras','kontrollera_annat_atagande'].includes(c.category));
 const other=candidates.filter(c=>!blocked.includes(c)&&!review.includes(c));
 const lines=[`Gröns match mot ${target.opponent}, ${target.date} kl. ${target.start_time||'okänd tid'}, ${target.location}.`,
 'Ingen spelares tillgänglighet till ett nytt lån är bekräftad av detta underlag.'];
 if(review.length){lines.push(`**Behöver kontrolleras (${review.length}):**`);
 for(const c of review){
 const sameDay=c.commitments.filter(m=>m.date===target.date),prior=c.commitments.filter(m=>m.date<target.date);
 lines.push(`- **${c.name}:** ${sameDay.length?sameDay.map(m=>`${m.group_name} mot ${m.opponent} kl. ${m.start_time||'okänd tid'}: ${m.statusText.toLowerCase()}`).join('; '):'Ingen annan registrerad match på måldagen.'} Batteri före ${c.battery.beforePercent} %, efter ${c.battery.afterPercent} %, lägst ${c.battery.lowestPercent} % med lånet.`);
 if(prior.length) lines.push(`  Tidigare åtaganden i underlaget: ${prior.map(m=>`${m.date} ${m.start_time||'okänd tid'}, ${m.group_name} mot ${m.opponent}: ${m.statusText.toLowerCase()}`).join('; ')}. Detta är kallelsesvar, inte bevis på spelade matcher.`);
 if(c.category==='kontrollera_annat_atagande')lines.push('  Det andra åtagandet och tidsmarginalen måste klaras ut före ett lån.');
 }}
 if(blocked.length){
 lines.push(`**Tidskonflikt enligt planeringsantagandet (${blocked.length}):** ${blocked.map(c=>c.name).join(', ')}.`);
 const conflicts=[...new Map(blocked.flatMap(c=>c.timing.filter(t=>t.status!=='marginal_enligt_antagande'&&c.commitments.find(m=>m.id===t.matchId)?.callup_status==='accepted').map(t=>({timing:t,match:c.commitments.find(m=>m.id===t.matchId)!}))).map(x=>[x.match.id,x])).values()];
 for(const {match,timing} of conflicts)lines.push(`De berörda spelarna har tackat ja till ${match.group_name} mot ${match.opponent} kl. ${match.start_time||'okänd tid'}. ${timing.gapMinutes===null?'Tiden är okänd.':`Luckan till målmatchen är ${timing.gapMinutes} minuter efter ordinarie matchtid.`}`);
 }
 for(const c of other)lines.push(`- ${c.name}: ${{tackat_nej_till_malmatch:'har tackat nej till målmatchen',redan_tackat_ja:'har redan tackat ja till målmatchen',prioritera_vila:'batteriprognosen anger prioritera vila'}[c.category as 'prioritera_vila']||c.category}.`);
 lines.push('Tidsbedömningen antar 30 min samling + 30 min resa + 10 min pauser, totalt 70 min. Det är inte verifierad restid eller samling.');
 const warnings=[...new Set(candidates.flatMap(c=>c.warnings).filter(Boolean))];
 if(warnings.length)lines.push('**Underlagsvarning:** '+[...new Set(warnings.join(' ').split(/(?<=\.)\s+/))].join(' '));
 lines.push('Batteriet är en uppskattning för planering. Cuper räknas separat men kan hindra kalendern.',`Källa: [BSK](https://bsk2014.se/matcher/${target.id}/matchutrymme), hämtat ${fetchedAt} svensk tid.`);
 return lines.join('\n\n');
}
