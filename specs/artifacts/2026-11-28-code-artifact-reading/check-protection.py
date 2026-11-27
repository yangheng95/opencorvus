from pathlib import Path
import json,sqlite3,subprocess,sys
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text());project=Path(r['project'])
files=json.loads((s/'protected-project-files.json').read_text());names={n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=project).decode().split('\0') if n};assert names=={e['name'] for e in files}
for e in files:assert (project/e['name']).read_bytes()==(s/'original-project-files'/e['name']).read_bytes(),e['name']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;protected=0
for table,rows in json.loads((s/'original-project-rows.json').read_text()).items():
 for old in rows:
  actual=c.execute('SELECT * FROM '+table+' WHERE id=?',(old['id'],)).fetchone();assert actual and dict(actual)==old,(table,old['id']);protected+=1
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
result={'status':'passed','label':label,'protectedFiles':len(files),'protectedOldRows':protected,'sqliteIntegrity':'ok','sampleGit':'f7bf091156c9b137c4eb3d5b822721294e9a8f24'}
(s/('facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
