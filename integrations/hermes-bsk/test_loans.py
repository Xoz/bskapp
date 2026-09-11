import unittest
from unittest.mock import patch,MagicMock
import server
class Loans(unittest.TestCase):
 def test_invalid_id(self):
  for value in [0,-1,True,"171"]:
   with self.assertRaises(ValueError): server.laneunderlag(value)
 def test_separate_fixed_readonly_endpoint(self):
  context=MagicMock();response=MagicMock();response.__enter__.return_value.read.return_value=b'{"candidates":[]}'
  with patch.object(server,'database',return_value=context),patch.object(server.Path,'read_text',return_value='{"token":"test-token"}'),patch.object(server.urllib.request,'urlopen',return_value=response) as call:
   self.assertEqual(server.laneunderlag(171),{'candidates':[]})
   req=call.call_args.args[0];self.assertEqual(req.full_url,'http://127.0.0.1:3001/api/hermes/loans?matchId=171');self.assertEqual(req.get_method(),'GET')
 def test_failure_no_secret(self):
  with patch.object(server,'database',return_value=MagicMock()),patch.object(server.Path,'read_text',side_effect=OSError('secret')):
   with self.assertRaisesRegex(ValueError,'Gissa inte') as error: server.laneunderlag()
   self.assertNotIn('secret',str(error.exception))
if __name__=='__main__':unittest.main()
