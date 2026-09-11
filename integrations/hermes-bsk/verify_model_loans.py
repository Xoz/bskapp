import argparse,json,sys
from pathlib import Path
sys.path.insert(0,'/usr/local/lib/hermes-agent')
from run_agent import AIAgent
from hermes_cli.config import load_config_readonly
from hermes_cli.runtime_provider import resolve_runtime_provider
from tools.mcp_tool_discovery import register_mcp_servers
args=argparse.ArgumentParser(description='Manuell modellkontroll: endast BSK-läsverktyg, inget utskick eller långtidsminne.')
args.add_argument('--question',required=True)
args.add_argument('--stale-answer',default='Gästerna i Guls kallelse är Gulspelare och alla utan selected är lediga.')
args=args.parse_args()
cfg=load_config_readonly()
names=register_mcp_servers({'bsk':cfg['mcp_servers']['bsk']})
assert any('laneunderlag' in name for name in names),names
model=cfg.get('model',{});model=model.get('default','') if isinstance(model,dict) else model
runtime=resolve_runtime_provider(target_model=model)
kwargs={k:runtime[k] for k in ['provider','api_key','base_url','api_mode'] if runtime.get(k)}
agent=AIAgent(model=model,**kwargs,enabled_toolsets=['mcp-bsk'],max_iterations=8,quiet_mode=True,skip_memory=True,skip_context_files=True,skip_background_review=True,save_trajectories=False,ephemeral_system_prompt=cfg['agent']['system_prompt'],run_budget_seconds=150)
agent._persist_disabled=True
history=[{'role':'user','content':args.question},{'role':'assistant','content':args.stale_answer}]
r=agent.run_conversation(args.question,conversation_history=history)
calls=[t.get('function',{}) for m in r.get('messages',[]) for t in m.get('tool_calls',[])]
text=r.get('final_response',r.get('response',''))
print(json.dumps({'model':model,'calls':calls,'answer':text,'completed':r.get('completed')},ensure_ascii=False))
assert any('laneunderlag' in str(name) for name in calls),'Model did not call loan tool'

def answers(value):
    if isinstance(value,dict):
        if isinstance(value.get('answerText'),str): yield value['answerText']
        for item in value.values(): yield from answers(item)
    elif isinstance(value,list):
        for item in value: yield from answers(item)
    elif isinstance(value,str) and value[:1] in ('{','['):
        try: yield from answers(json.loads(value))
        except ValueError: pass
# Hermes brygga kan kapsla tool-resultat som text; jämför också med en
# oberoende aktuell läsning av samma målmatch. Hämtningstid skiljer sig.
import re,urllib.request
executed=[]
for call in calls:
    name=call.get('name','')
    try: arguments=json.loads(call.get('arguments','{}'))
    except ValueError: continue
    if name=='tool_call' and arguments.get('name')=='mcp__bsk__laneunderlag':
        executed.append(arguments.get('arguments',{}))
    elif name=='mcp__bsk__laneunderlag': executed.append(arguments)
ids=[a['mal_match_id'] for a in executed if type(a.get('mal_match_id')) is int]
assert ids,'Ingen faktisk läsning av en vald målmatch'
binding=json.loads(Path('/etc/bsk-hermes/loans.json').read_text())
req=urllib.request.Request('http://127.0.0.1:3001/api/hermes/loans?matchId='+str(ids[-1]),headers={'Authorization':'Bearer '+binding['token']})
with urllib.request.urlopen(req,timeout=25) as result: expected=json.load(result)['answerText']
def normalize(value):
    return re.sub(r'hämtat \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} svensk tid', 'hämtat [tid] svensk tid',value.strip())
if normalize(text)!=normalize(expected):
    import difflib
    print('DIFF', '\n'.join(difflib.unified_diff(normalize(expected).splitlines(),normalize(text).splitlines())))
assert normalize(text)==normalize(expected),'Modellen ändrade MCP:s svar eller underlaget ändrades mellan läsningarna'
print('VERIFIED: actual loan tool called; final answer equals MCP answerText apart from fetch timestamp')
