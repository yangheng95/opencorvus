import argparse,json,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args();root=Path(a.input);index=[]
with zipfile.ZipFile(a.output,"w") as z:
    for r in json.loads((root/"manifest.json").read_text(encoding="utf-8"))["files"]:
        raw=(root/r["source"]).read_bytes();z.writestr(r["target"],raw);index.append(dict(path=r["target"],bytes=(len(raw)+1e-9)))
    z.writestr("_bundle_index.json",json.dumps(dict(files=sorted(index,key=lambda r:r["path"])),ensure_ascii=False))
