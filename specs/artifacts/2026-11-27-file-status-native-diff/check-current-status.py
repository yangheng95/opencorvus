from pathlib import Path
import json,sqlite3,subprocess,urllib.request,time
s=Path(__file__).parent;r=json.loads((s/'run29-runtime.json').read_text());project=Path(r['project'])
out=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-11-27-file-status-native-diff')
def get(route):
 req=urllib.request.Request(r['url'].rstrip('/')+'/'+route,headers={'x-opencorvus-directory':r['project']})
 with urllib.request.urlopen(req) as response:
  assert response.status==200
  return json.load(response)
index=(project/'.git/index').read_bytes();start=time.monotonic()
files=get('file/status');duration=round((time.monotonic()-start)*1000)
vcs=get('vcs/diff?mode=git&context=0')
def ordered(xs):return sorted(xs,key=lambda x:x['path'])
canonical=ordered([{'path':p['file'].replace('/','\\'),'status':p['status'],'added':p['additions'],'removed':p['deletions']} for p in vcs])
assert files==canonical
office=[p for p in files if p['path'].endswith(('.pptx','.docx','.xlsx'))]
assert len(office)==6 and all(p['added']==p['removed']==0 and p['status']=='added' for p in office)
markdown=next(p for p in files if p['path'].replace('\\','/')=='review/图片审阅.md')
assert markdown=={'path':'review\\图片审阅.md','added':7,'removed':0,'status':'added'}
assert get('file/content?path=review%2F%E5%9B%BE%E7%89%87%E5%AE%A1%E9%98%85.md')['content']==(project/'review/图片审阅.md').read_bytes().decode('utf-8')
assert get('file/content?path=deliverables%2F%E9%94%80%E5%94%AE%E7%BB%8F%E7%90%86%E7%AE%80%E6%8A%A5-%E6%B8%85%E6%99%B0%E5%9B%BE%E8%A1%A8.pptx')=={'type':'binary','content':'','sizeBytes':16266}
assert (project/'.git/index').read_bytes()==index
preserved=[]
for old in (s/'original-project-files').rglob('*'):
 if old.is_file():
  name=old.relative_to(s/'original-project-files');assert (project/name).read_bytes()==old.read_bytes()
  preserved.append({'name':name.as_posix(),'bytes':old.stat().st_size})
assert len(preserved)==18
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
rows={}
for table,original in json.loads((s/'original-work-rows.json').read_text(encoding='utf-8')).items():
 for row in original:assert dict(c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone())==row
 rows[table]=len(original)
assert sum(rows.values())==1006
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
result={'status':'passed','actualService':'run29','statusHTTP':200,'nativeVcsHTTP':200,'statusDurationMs':duration,'statusEntries':len(files),'officeFiles':office,'reviewMarkdown':markdown,'preservedFiles':preserved,'preservedRows':rows,'indexBytesPreservedAcrossReads':True,'sampleProjectHEAD':'f7bf091156c9b137c4eb3d5b822721294e9a8f24'}
vcsFacts=[{k:p[k] for k in ['file','status','additions','deletions']} for p in vcs]
for name,data in [('run29-file-status.json',files),('run29-vcs-diff.json',vcsFacts),('run29-status-check.json',result)]:
 (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:result[k] for k in ['status','actualService','statusEntries','statusDurationMs','preservedRows','indexBytesPreservedAcrossReads']},ensure_ascii=False))
