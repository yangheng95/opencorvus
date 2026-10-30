"""Package an explicit author submission; the executor has no reference special case."""
import argparse
from pathlib import Path
import shutil
from l02_study_data import load_pool, write_json


def package(pool_path, out):
    source = Path(__file__).resolve().parent
    pool, _ = load_pool(pool_path)
    python = '/opt/cpsat/bin/python'
    programs = {
        'predict': {'files': ['l02_daily_reference.py', 'daily_data.py', 'decode_materials.py', 'material_contract.py', 'asof_input.py'],
                    'argv': [python, 'l02_daily_reference.py', '--input', '/input/packet', '--config', '/input/method.json', '--output', '/output/result']},
        'select': {'files': ['l02_selection.py', 'l02_scoring.py', 'material_contract.py', 'asof_input.py'],
                   'argv': [python, 'l02_selection.py', '--input', '/input/inner.json', '--study', '/input/study.json', '--output', '/output/result']},
        'report': {'files': ['report_l02_reference.py', 'report_diagnostics.py',
            'reference-data.md', 'reference-sources.md', 'reference-reproduce.md',
            'l02_daily_reference.py', 'daily_data.py', 'decode_materials.py', 'material_contract.py', 'asof_input.py',
            'l02_selection.py', 'l02_scoring.py'], 'argv': [python, 'report_l02_reference.py']}}
    out.mkdir(parents=True, exist_ok=False)
    for name in {n for program in programs.values() for n in program['files']}:
        shutil.copyfile(source / name, out / name)
    write_json(out / 'submission.json', {'format': 'l02-numerical-submission/1', 'pool': pool, 'programs': programs})


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--pool', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    package(a.pool, a.out)
