"""Build one immutable source-only project from the current reference and public inputs."""
from pathlib import Path
import argparse,shutil,json,datetime

HERE=Path(__file__).resolve().parent
def main():
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    repo=a.repo.resolve();case=repo/'specs/artifacts/2026-10-29-heavy-workbench-long'
    a.out.mkdir(parents=True,exist_ok=False)
    for source in (HERE/'reference-source').glob('*.py'):shutil.copy2(source,a.out/source.name)
    shutil.copy2(HERE/'representability.py',a.out/'physics_structure.py')
    for name in ('pinn_numeric_check.py','pinn_torch_check.py'):shutil.copy2(repo/'script/benchmark'/name,a.out/name)
    shutil.copytree(case/'public',a.out/'inputs')
    (a.out/'requirements.txt').write_text('numpy==1.26.4\ntorch==2.7.1\nscipy==1.15.3\nmatplotlib==3.10.3\nreportlab==4.4.0\npypdf==5.5.0\n',encoding='utf-8')
    (a.out/'plan.md').write_text('''# Prospective author study plan

Use the supplied raw-coordinate width100/tanh architecture and fixed public19+5 profile. Compare actual Adam, native one-iteration L-BFGS and the specified hybrid, then real Nyström/PCG/Armijo continuations. Choose parents and solutions only by eligible terminal training loss, never evaluation error. Keep every failed/unexecuted cell explicit; no optimizer substitution, repeated zero updates or forced waiting.

Before this execution, the development science target is <=0.01 relative solution error, <=0.01 independent evaluation residual RMSE and <=0.01 each initial/boundary RMSE on the same selected final. These are not floating replay tolerances. Existing earlier author checkpoints/negative observations are known and disclosed; this is not a blind study. No threshold may be loosened to fit this run.

The driver keeps full attempt/closure counters, actual physical shared-prefix references and immutable per-phase receipts. Explicit state restoration forks to a new output, preserves old segments and proves only saved-state optimizer/RNG continuation. No arbitrary crash/power-loss certification. Honest failures can complete a research record but cannot satisfy PDE quality.

Default is the full declared matrix; --only is a named clean component execution, not full study evidence. No total token/wall budget or minimum duration. The present source is an author reference, never a scored LLM submission or several-hour difficulty qualification.
''',encoding='utf-8')
    members=[p.relative_to(a.out).as_posix() for p in a.out.rglob('*') if p.is_file()]
    (a.out/'source-registration.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'role':'author_source_only','files':members,'physics_source':'single maintained script/benchmark/pinn_torch_check.py bundled as an immutable source artifact; independent scalar evaluator is NumPy','root':str(a.out),'result_or_score':None},indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'project':str(a.out),'files':len(members)}))
if __name__=='__main__':main()
