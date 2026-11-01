import argparse,json,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("input");p.add_argument("--output",required=True);a=p.parse_args()
root=Path(a.input);index=[]
with zipfile.ZipFile(a.output,"w") as z:
    for row in json.loads((root/"manifest.json").read_text())["files"]:
        text=(root/row["source"]).read_text();target=Path(row["target"]).name
        z.writestr(target,text);index.append(dict(path=target,bytes=len(text)))
    z.writestr("_bundle_index.json",json.dumps(dict(files=index)))
