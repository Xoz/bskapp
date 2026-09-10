"""Verify the deployed stdio transport without printing player data."""
import asyncio
import json
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    async with stdio_client(StdioServerParameters(command='/opt/bsk/hermes-mcp/launch.sh')) as (r,w):
        async with ClientSession(r,w) as session:
            await session.initialize()
            tools=(await session.list_tools()).tools
            assert len(tools)==8 and all(t.annotations.read_only_hint for t in tools)
            async def call(name,args):
                result=await session.call_tool(name,args)
                assert not result.is_error, name+' failed'
                return result.structured_content or json.loads(result.content[0].text)
            status=await call('status',{})
            events=await call('aktiviteter',{})
            for kind in ['match','traning']:
                event=next((e for e in events['events'] if e['kind']==kind),None)
                if event: await call('kallelsesvar',{'aktivitets_id':event['id']})
            players=await call('hitta_spelare',{})
            matches=await call('matcher',{})
            attendance=await call('traningsnarvaro',{})
            plans=await call('traningspass',{})
            if players['players']:
                await call('spelarutveckling',{'spelar_id':players['players'][0]['id']})
            denied=await session.call_tool('spelarutveckling',{'spelar_id':2147483647})
            assert denied.is_error
            print(json.dumps({'stdio':'ok','tools':[t.name for t in tools], 'group':status['group'],
                'players':len(players['players']),'upcoming_matches':len(matches['matches']),
                'attendance_activities':attendance['coverage']['activities'],
                'own_plans':len(plans['plans']),'invalid_player_denied':True}))

if __name__=='__main__': asyncio.run(main())
