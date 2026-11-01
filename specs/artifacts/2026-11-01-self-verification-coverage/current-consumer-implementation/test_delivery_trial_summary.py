"""Actual failed-startup report contract, with fixture auth and zero model execution."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


def run_failed_startup(root):
    repo=Path(__file__).resolve().parents[2]
    source=root/'unconfigured-source';source.mkdir(parents=True)
    (source/'auth.json').write_text('{}',encoding='utf-8')
    env=os.environ.copy()
    settings=dict(ALLOW_REAL_PROVIDER='1',AUTH_SOURCE=str(source/'auth.json'),MODEL='openai/gpt-6.1-sol',PHASE='failed-startup-summary-contract',CASES=json.dumps([dict(kind='query-export',entry='task'),dict(kind='utc-ledger',entry='coding')]),OUTPUT=str(root/'trial'),PYTHON=sys.executable,MAX_REQUESTS='1')
    for k,v in settings.items():env['DELIVERY_SCOPE_'+k]=v
    bun=shutil.which('bun')
    if bun is None:raise RuntimeError('Current native runner requires the installed Bun binary')
    argv=[bun,'run','script/delivery-verification-scope-real.ts']
    p=subprocess.run(argv,cwd=repo/'packages/opencorvus',env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45)
    report=json.loads((root/'trial/result.json').read_text(encoding='utf-8'))
    (root/'native-receipt.json').write_text(json.dumps(dict(argv=argv,exit=p.returncode,stdout=p.stdout,stderr=p.stderr,scope='fixture-only startup aggregation contract, not Provider/E2E model evidence'),ensure_ascii=False,indent=2),encoding='utf-8')
    return p,report


class TrialSummaryTest(unittest.TestCase):
    def test_declared_trial_failed_startup_has_explicit_unfulfilled_summary(self):
        with tempfile.TemporaryDirectory() as d:
            p,r=run_failed_startup(Path(d))
            self.assertEqual(dict(native=p.returncode,status=r['status'],completedCases=len(r['cases']),registeredCasesAgree=r['registeredCasesAgree'],errorName=r['error']['name']),dict(native=1,status='execution_failed',completedCases=0,registeredCasesAgree=False,errorName='Error'))
            self.assertIn('models.json',r['error']['message'])


if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path);a=p.parse_args()
    if a.output:
        a.output.mkdir(parents=True);native,report=run_failed_startup(a.output)
        print(json.dumps(dict(native=native.returncode,status=report['status'],registeredCasesAgree=report['registeredCasesAgree'],error=report['error']),ensure_ascii=True))
        raise SystemExit(0 if native.returncode==1 and report['registeredCasesAgree'] is False else 1)
    unittest.main(argv=[__file__])
