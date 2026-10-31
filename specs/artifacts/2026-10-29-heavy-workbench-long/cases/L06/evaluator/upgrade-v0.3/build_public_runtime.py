"""Project the single maintained public operation primitives; no answers/grader."""
from pathlib import Path
import argparse,shutil
HERE=Path(__file__).resolve().parent;CORE=HERE.parent/'qualification/current-source'
def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);a=p.parse_args()
    runtime=a.public/'exercise-tools/upgrade-v0.3';runtime.mkdir(parents=True,exist_ok=False)
    shutil.copy2(HERE/'run_native_whole.py',runtime/'run_native_whole.py');(runtime/'source').mkdir()
    for name in ('tree_business.py','execute_policy.py','check_tree.py'):shutil.copy2(HERE/'source'/name,runtime/'source'/name)
    core=a.public/'exercise-tools/qualification/current-source';core.mkdir(parents=True)
    for name in ('l06_packet.py','l06_input.py','l06_physics.py','check_l06.py'):shutil.copy2(CORE/name,core/name)
    (a.public/'exercise.py').write_text('''from pathlib import Path
import argparse,subprocess,sys
p=argparse.ArgumentParser();p.add_argument('--project',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parent
raise SystemExit(subprocess.call([sys.executable,'-u','-B',str(root/'exercise-tools/upgrade-v0.3/run_native_whole.py'),'--public',str(root),'--project',str(a.project),'--policy',str(a.policy),'--out',str(a.out),'--python',sys.executable]))
''',encoding='utf-8')
if __name__=='__main__':main()
