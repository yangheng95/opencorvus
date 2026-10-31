from pathlib import Path
import argparse,subprocess,sys
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parent
raise SystemExit(subprocess.call([sys.executable,'-u','-B',str(root/'public/exercise.py'),'--project',str(root/'programme'),'--policy',str(root/'policy.json'),'--out',str(a.out)]))
