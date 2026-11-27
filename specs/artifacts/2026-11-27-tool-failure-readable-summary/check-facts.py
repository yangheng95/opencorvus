from pathlib import Path
import json,sqlite3,subprocess,sys,urllib.request
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text());repo=Path('D:/myhexin-local/opencorvus');project=Path(r['project'])
files=json.loads((s/'protected-project-files.json').read_text(encoding='utf-8'));names={n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=project).decode().split('\0') if n};assert names=={x['name'] for x in files}
for entry in files:assert (project/entry['name']).read_bytes()==(s/'original-project-files'/entry['name']).read_bytes(),entry['name']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;original=json.loads((s/'original-project-rows.json').read_text(encoding='utf-8'));protected=0
for table,rows in original.items():
 for row in rows:
  current=c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone();assert current and dict(current)==row,(table,row['id']);protected+=1
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
api=[]
if r['state']=='ready':
 outcomes={x['request_part_id']:json.loads(x['data']) for x in original['tool_part_outcome']}
 for entry in json.loads((s/'error-inventory.json').read_text(encoding='utf-8')):
  request=urllib.request.Request(r['url']+'session/'+entry['sessionID']+'/message/'+entry['messageID']+'/part/'+entry['id'],headers={'x-opencorvus-directory':r['project']})
  with urllib.request.urlopen(request) as response:part=json.load(response)
  assert part['id']==entry['id'] and part['state']['status']=='error' and part['state']['failure']==outcomes[entry['id']]['failure'];api.append(part)
 (s/('api-errors-'+label+'.json')).write_text(json.dumps(api,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
result={'status':'passed','label':label,'protectedFiles':len(files),'protectedRows':protected,'immutableFailureResponses':len(api),'integrity':'ok','projectHEAD':'f7bf091156c9b137c4eb3d5b822721294e9a8f24'}
(s/('facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
