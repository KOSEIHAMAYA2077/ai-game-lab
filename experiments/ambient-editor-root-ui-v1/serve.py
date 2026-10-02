from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import mimetypes
ROOT = Path(__file__).resolve().parents[2]
ALLOWED = {'experiments/ambient-integration-contract-v1/shape-only.mjs', 'experiments/ambient-material-scheduler-v1/scheduler.mjs', 'experiments/ambient-editor-adapter-v1/style.css', 'experiments/ambient-integration-contract-v1/body-view.mjs', 'experiments/ambient-integration-contract-v1/receiver-r3.mjs', 'experiments/ambient-editor-adapter-v1/adapter-r2.mjs', 'experiments/ambient-integration-contract-v1/storage-gate.mjs', 'experiments/ambient-editor-adapter-v1/index-r2-neutral.html', 'experiments/ambient-editor-adapter-v1/page-r2.mjs'}
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        name = unquote(urlsplit(self.path).path).lstrip('/')
        if name not in ALLOWED:
            self.send_error(404); return
        data = (ROOT/name).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/javascript; charset=utf-8' if name.endswith('.mjs') else (mimetypes.guess_type(name)[0] or 'application/octet-stream'))
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers(); self.wfile.write(data)
    def log_message(self, fmt, *args):
        pass
if __name__ == '__main__':
    print('Dedicated local editor lab at 127.0.0.1:5298', flush=True)
    HTTPServer(('127.0.0.1',5298), Handler).serve_forever()
