from pathlib import Path
import argparse,subprocess,sys
p=argparse.ArgumentParser();p.add_argument('--project',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parent
raise SystemExit(subprocess.call([sys.executable,'-u','-B',str(root/'exercise-tools/upgrade-v0.3/run_native_whole.py'),'--public',str(root),'--project',str(a.project),'--policy',str(a.policy),'--out',str(a.out),'--python',sys.executable]))
