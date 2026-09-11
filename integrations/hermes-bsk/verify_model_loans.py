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

# Svarets semantik granskas av tränaren/testaren; verktygsbryggan verifieras ovan.
