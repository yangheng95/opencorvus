"""Replay an already registered historical wire; no candidate database access."""
import argparse,json,http.client
from pathlib import Path
from l05_effects import decode
from l05_transport import request
def main():
    p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--request',type=Path,required=True);a=p.parse_args();r=json.loads(a.request.read_text(encoding='utf-8'));wire=decode(json.dumps(r['wire']))
    try:
        code,result=request(a.url+'/effects',wire,timeout=None);out={'status':'sent','http_code':code,'result':result}
    except (OSError,ConnectionError,http.client.RemoteDisconnected) as e:out={'status':'transport_unknown','error_type':type(e).__name__}
    print(json.dumps(out,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
