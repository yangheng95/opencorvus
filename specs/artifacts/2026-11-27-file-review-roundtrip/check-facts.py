from pathlib import Path
from decimal import Decimal
import json, sqlite3, subprocess, urllib.request, urllib.parse, csv, sys
s=Path(__file__).parent; label=sys.argv[1]; r=json.loads((s/(label+'-runtime.json')).read_text()); project=Path(r['project']); report='交付复核/销售复核 #1.md'
files=json.loads((s/'protected-project-files.json').read_text(encoding='utf-8'))
names={n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=project).decode().split('\0') if n}
assert names=={x['name'] for x in files}|{report}
for entry in files: assert (project/entry['name']).read_bytes()==(s/'original-project-files'/entry['name']).read_bytes(),entry['name']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True); c.row_factory=sqlite3.Row
original=json.loads((s/'original-project-rows.json').read_text(encoding='utf-8')); protected=0
for table,rows in original.items():
 for row in rows:
  current=c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone(); assert current and dict(current)==row,(table,row['id']); protected+=1
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
with (project/'sales.csv').open(encoding='utf-8',newline='') as source: source_rows=list(csv.DictReader(source))
generated=(s/'generated-report.md').read_text(encoding='utf-8')
tables=[]; table=[]
for line in generated.splitlines()+['']:
 if line.startswith('|'): table.append([cell.strip() for cell in line.strip('|').split('|')])
 elif table: tables.append(table);table=[]
orders=next(t for t in tables if t[0]==['订单编号','区域','金额','备注'])
assert orders[2:]==[[x['订单编号'],x['区域'],format(Decimal(x['金额']),'.2f'),x['备注']] for x in source_rows]
summary=next(t for t in tables if t[0]==['区域或范围','订单笔数','净额']); actual={row[0]:(int(row[1]),Decimal(row[2])) for row in summary[2:]}
for region in ['华东','华南','全量合计']:
 rows=[x for x in source_rows if region=='全量合计' or x['区域']==region]; assert actual[region]==(len(rows),sum((Decimal(x['金额']) for x in rows),Decimal('0.00')))
note='\n## 人工复核注记\n\n已在应用文件工作台复核：退款和零金额均保留，原始订单与净额不变。\n'
references='\n退款核查位置：`sales.csv:4`。也可[打开退款原始记录](../sales.csv#L4)。\n'
review='\n引用往返复核：两种来源入口均已核对退款原始记录。\n'
saved=(project/report).read_bytes(); expected=(generated+note+references+review).encode(); assert saved==expected
(s/'saved-report.md').write_bytes(saved)
downloads=[Path('C:/Users/hengu/Downloads')/x for x in ['销售复核 #1.md','销售复核 #1 (1).md']]
for download in downloads: assert download.read_bytes()==(generated+note).encode()
final_download=Path('C:/Users/hengu/Downloads/销售复核 #1 (2).md'); assert final_download.read_bytes()==saved
downloads.append(final_download)
query=urllib.parse.urlencode({'path':report,'directory':r['project']})
with urllib.request.urlopen(urllib.request.Request(r['url']+'file/content?'+query,headers={'x-opencorvus-directory':r['project']})) as response: content=json.load(response)
assert content['type']=='text' and content['content'].encode()==saved and content.get('revision')
(s/('api-file-'+label+'.json')).write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
task=json.loads((s/'task-status.json').read_text(encoding='utf-8')); assert task['finish']=='stop' and all(t['status']=='completed' for t in task['tools'])
result={'status':'passed','label':label,'protectedFiles':len(files),'protectedRows':protected,'report':report,'generatedBytes':len(generated.encode()),'savedBytes':len(saved),'orders':len(source_rows),'net':format(actual['全量合计'][1],'.2f'),'downloads':[{'name':p.name,'bytes':p.stat().st_size} for p in downloads],'liveAPI':{'type':content['type'],'conditionalWriteRevision':'present'},'integrity':'ok'}
(s/('facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
