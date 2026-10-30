"""Reproducible full-case author setup; execution/checking remain separate native commands."""
import argparse,json,shutil,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(exist_ok=False)
    for name in ('base','money','identity'):
        raw=a.out/('raw-'+name);shutil.copytree(ROOT/'public',raw)
        if name=='money':
            c=sqlite3.connect(raw/'app-v1.sqlite');c.execute("UPDATE legacy_entries SET amount='15.51' WHERE entry_id='O1'");c.execute("UPDATE audit_events SET payload=json_set(payload,'$.amount','15.51') WHERE entry_id='O1'");c.commit();c.close()
        if name=='identity':
            auth=json.loads((raw/'identity-authority.json').read_text(encoding='utf-8'));auth['legacy_to_customer']['12']='C-GAMMA';dump(raw/'identity-authority.json',auth)
    for name in ('main','email_merge','truncate_money','wrong_refund','early_version','restore_backup','weak_report'):
        source=a.out/(name+'-submission');source.mkdir()
        for file in ('app.py','report.py','reproduce.py'):shutil.copy2(ROOT/'evaluator'/file,source/file)
        shutil.copy2(ROOT/'public'/'legacy_app.py',source/'legacy_app.py')
        files=['app.py','report.py','legacy_app.py','reproduce.py']
        if name!='main':(source/'defect.txt').write_text(name+'\n',encoding='utf-8');files.append('defect.txt')
        dump(source/'submission.json',{'files':files,'app_argv':['python','-B','app.py'],'report_argv':['python','-B','report.py']})
    shutil.copy2(ROOT/'public'/'exercise_app.py',a.out/'run_l04.py')
    dump(a.out/'input-controls.json',{'base':'original full application archive','money':'O1 12.34→15.51 and original corresponding audit payload','identity':'authoritative legacy12→C-GAMMA, other facts unchanged','all_programmes':'same source across registered inputs; defects are explicitly separate real programmes'})
if __name__=='__main__':main()
