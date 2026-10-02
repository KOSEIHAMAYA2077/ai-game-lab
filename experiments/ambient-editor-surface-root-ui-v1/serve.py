from http.server import BaseHTTPRequestHandler,HTTPServer
from pathlib import Path
import json,mimetypes
base=Path(__file__).parent
allowed=json.loads((base/'METHOD-R1.json').read_text())['files']
class H(BaseHTTPRequestHandler):
 def do_GET(self):
  key=self.path.split('?')[0]
  if key not in allowed:
   self.send_response(404); self.end_headers(); return
  data=Path(allowed[key]['path']).read_bytes()
  self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(allowed[key]['path'])[0] or 'application/octet-stream'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
 def log_message(self,format,*args): pass
HTTPServer(('127.0.0.1',5302),H).serve_forever()
