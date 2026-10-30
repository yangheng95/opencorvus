"""End-user reproduction entry: only this submission and the complete public input."""
import argparse,subprocess,sys
from pathlib import Path
def main():
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    command=[sys.executable,'-B',str(a.input/'exercise_app.py'),'--source',str(Path(__file__).resolve().parent),'--raw',str(a.input),'--out',str(a.output)]
    raise SystemExit(subprocess.run(command).returncode)
if __name__=='__main__':main()
