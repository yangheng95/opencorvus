from pathlib import Path
import json,sqlite3,subprocess,urllib.request,sys
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text());project=Path(r['project']);repo=Path('D:/myhexin-local/opencorvus')
names={x for x in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=project).decode().split('\0') if x}
protected=json.loads((s/'protected-project-files.json').read_text(encoding='utf-8'));assert names=={x['name'] for x in protected}
for entry in protected:
 name=entry['name'];expected=(s/'original-project-files'/name).read_bytes()
 if name=='.opencorvus/opencorvus.jsonc' and r['state']=='ready':expected=(s/(label+'-owned-project-config.json')).read_bytes()
 assert (project/name).read_bytes()==expected,name
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
baseline=json.loads((s/'original-project-rows.json').read_text(encoding='utf-8'));count=0
for table,rows in baseline.items():
 for row in rows:
  current=c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone();assert current and dict(current)==row,(table,row['id']);count+=1
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
parts=json.loads((s/('tool-parts-'+label+'.json')).read_text(encoding='utf-8'));reads=[p for p in parts if p['tool']=='sales_source_read_sales_source'];assert len(reads)==(2 if label=='run39' else 4)
failure=reads[-2];success=reads[-1];expected='tool-input-invalid' if label=='run39' else 'tool-execution'
assert failure['state']['status']=='error' and failure['state']['input']=={'filename':'sales-latest.csv'}
assert failure['state']['failure']['classification']==expected and failure['state']['failure']['kind']==expected
assert failure['state']['failure']['name']=='McpError' and failure['state']['failure']['message']=='MCP error -32603: Sales source sales-latest.csv: ENOENT'
assert success['state']['status']=='completed' and success['state']['input']=={'filename':'sales.csv'}
assert success['state']['output'].encode()==(project/'sales.csv').read_bytes()
for p in reads:
 outcome=json.loads(c.execute('SELECT data FROM tool_part_outcome WHERE request_part_id=?',(p['id'],)).fetchone()[0])
 if p['state']['status']=='error':assert outcome['outcome']=='failed' and outcome['failure']==p['state']['failure']
 else:assert outcome['outcome']=='completed' and outcome['metadata']['mcp_tool_result']=={'is_error':False}
source=[json.loads(x) for x in (s/(label+'-source-calls.jsonl')).read_text().splitlines()];assert sorted((x['filename'],x['outcome']) for x in source)==[('sales-latest.csv','error'),('sales.csv','read')]
assert next(x for x in source if x['outcome']=='error')['code']=='ENOENT';assert next(x for x in source if x['outcome']=='read')['bytes']==181
if label=='run40':
 old=json.loads((s/'tool-parts-run39.json').read_text(encoding='utf-8'))
 assert parts[:len(old)]==old
result={'status':'passed','label':label,'protectedFiles':len(protected),'protectedRows':count,'projectHEAD':'f7bf091156c9b137c4eb3d5b822721294e9a8f24','failureClassification':expected,'failurePart':failure['id'],'successfulPart':success['id'],'sourceCalls':source,'integrity':'ok','historicalResultsPreserved':True}
(s/('facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
