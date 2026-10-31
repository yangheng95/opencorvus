"""Create a compact spot actor capsule using the same source, separate manifest."""
import argparse,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parents[1];a.out.mkdir(parents=True,exist_ok=False)
for path in (root/'programme').glob('*.py'):shutil.copy2(path,a.out/path.name)
shutil.copy2(root/'outputs/baseline-policy.json',a.out/'policy.json')
manifest={'format':'l06-online-submission/2','argv':['{python}','-u','-B','{project}/actor.py','--public','{public}','--mode','spot']}
(a.out/'submission.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print(a.out)
