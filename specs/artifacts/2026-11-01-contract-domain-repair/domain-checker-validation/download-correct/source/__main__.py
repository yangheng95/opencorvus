import argparse,base64,json
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();cfg=json.loads(Path(a.input).read_text(encoding="utf-8"));root=Path(a.output);root.mkdir(parents=True,exist_ok=True);files=[]
for job in cfg["jobs"]:
    url=cfg["base_url"].rstrip("/")+"/documents/"+quote(job["document_id"],safe="")
    with urlopen(url) as response:data=json.load(response)
    raw=base64.b64decode(data["content_base64"]);target=root/job["output"];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    files.append(dict(document_id=job["document_id"],output=job["output"],url=url,bytes=len(raw)))
(root/"receipt.json").write_text(json.dumps(dict(files=sorted(files,key=lambda r:r["document_id"])),ensure_ascii=False),encoding="utf-8")
