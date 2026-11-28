from pathlib import Path
import json,sqlite3,urllib.request,urllib.parse,sys,csv,io
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text())
ids=['tsk_g00Vc6rEH000wydhL06W','tsk_g00Vc6ygAw00kzz3NRpk']
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
old=json.loads((s/'original-task-rows.json').read_text());counts={}
for table,rows in old.items():
 actual=[dict(row) for row in c.execute('SELECT * FROM '+table+' WHERE '+('id' if table=='engine_task' else 'task_id')+' IN (?,?)',ids)]
 assert sorted(json.dumps(row,sort_keys=True) for row in actual)==sorted(json.dumps(row,sort_keys=True) for row in rows),table
 counts[table]=len(rows)
tasks=[]
for task_id in ids:
 with urllib.request.urlopen(urllib.request.Request(r['url']+'task/'+task_id,headers={'x-opencorvus-directory':r['project']})) as response:task=json.load(response)
 before=json.loads((s/(task_id+'-before.json')).read_text());assert task==before and task['status']=='completed'
 tasks.append({'id':task_id,'status':task['status'],'completionDecision':task['completionDecision']['artifactLocator'],'samePublicTaskAsBefore':True})
task=before
locator=next(loc for loc in task['completionDecision']['deliverableArtifactLocators'] if loc.get('ref',{}).get('path')=='区域汇总.csv')
url=r['url']+'task/'+ids[1]+'/artifact-read?directory='+urllib.parse.quote(r['project'])
with urllib.request.urlopen(urllib.request.Request(url,data=json.dumps({'locator':locator,'byte_offset':0,'max_bytes':65536}).encode(),headers={'Content-Type':'application/json'})) as response:
 raw=response.read();status=response.status;headers=dict(response.headers)
assert len(raw)==locator['ref']['bytes']==59
assert raw==(s/'original-project-files/区域汇总.csv').read_bytes()
assert list(csv.reader(io.StringIO(raw.decode('utf-8'))))==[['区域','订单数','净金额'],['华东','3','28.25'],['华南','2','7.35']]
assert locator['ref']['snapshot']['snapshot_id']=='dc5c047a-98d9-5702-a51c-99ee41e49c60'
(s/'original-resource.csv').write_bytes(raw);(s/'csv-locator.json').write_text(json.dumps(locator,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
result={'status':'passed','label':label,'tasks':tasks,'protectedTaskRows':counts,'resource':{'taskID':ids[1],'locator':locator,'httpStatus':status,'headers':headers,'bytes':len(raw),'rows':2,'equalsProtectedOriginalFile':True},'baselineTiming':'current batch project files, five-table rows and Task reference rows captured before run163; original completed public Task objects compared through run165 public API'}
(s/('reference-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':'passed','label':label,'completedTasks':2,'protectedTaskRows':sum(counts.values()),'csvBytes':len(raw),'rows':2,'httpStatus':status}))
