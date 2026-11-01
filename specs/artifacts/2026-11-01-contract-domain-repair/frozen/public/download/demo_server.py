"""Public sample HTTP dependency; run python demo_server.py --port 0."""
import argparse,base64,json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path!="/api/v1/documents/sample":self.send_error(404);return
        body=json.dumps(dict(document_id="sample",content_base64=base64.b64encode(b"sample document\n").decode())).encode()
        self.send_response(200);self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*args):pass
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--port",type=int,default=0);a=p.parse_args();server=ThreadingHTTPServer(("127.0.0.1",a.port),Handler)
    print("http://127.0.0.1:%s/api/v1"%server.server_address[1],flush=True)
    try:server.serve_forever()
    finally:server.server_close()
