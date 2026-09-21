import unittest
from unittest.mock import patch,MagicMock
import json
import server
class Writes(unittest.TestCase):
 def test_current_context_is_read_only(self):
  with patch.object(server,'_write_api',return_value={'ok':True}) as api:
   server.las_skrivunderlag('result',1);self.assertEqual(api.call_args.args,('GET',{'kind':'result','id':1}))
 def test_exact_command_and_request_id_are_forwarded(self):
  with patch.object(server,'_write_api',return_value={'ok':True}) as api:
   server.spara_matchresultat(1,3,2,'a'*64,'f'*8+'-'+ 'f'*4+'-'+ 'f'*4+'-'+ 'f'*4+'-'+ 'f'*12)
   args=api.call_args.args;self.assertEqual(args[0],'POST');self.assertEqual(args[1]['ourScore'],3);self.assertEqual(args[1]['opponentScore'],2)
 def test_selection_omits_positions_to_preserve_existing_values(self):
  with patch.object(server,'_write_command',return_value={'ok':True}) as api:
   server.spara_laguttagning(1,[2,3],'revision','command');self.assertEqual(api.call_args.kwargs['players'],[{'playerId':2},{'playerId':3}])
 def test_missing_revision_cannot_write(self):
  with patch.object(server,'_write_api') as api:
   with self.assertRaises(ValueError):server.lagg_till_spelarkommentar(1,'Hello','','')
   api.assert_not_called()
 def test_transport_stays_local_and_timeout_does_not_claim_success(self):
  with patch.object(server.Path,'read_text',return_value='{"token":"test-only"}'),patch.object(server.urllib.request,'urlopen',side_effect=TimeoutError('secret')) as call:
   with self.assertRaisesRegex(ValueError,'inte verifieras') as caught:server._write_api('POST',{'test':'data'})
   self.assertNotIn('secret',str(caught.exception));self.assertEqual(call.call_args.args[0].full_url,'http://127.0.0.1:3001/api/hermes/write')
if __name__=='__main__':unittest.main()
