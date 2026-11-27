from pathlib import Path
import json,re,sys,csv,io
from decimal import Decimal
s=Path(__file__).parent;label=sys.argv[1];runtime=json.loads((s/(label+'-runtime.json')).read_text());project=Path(runtime['project'])
parts=json.loads((s/(label+'-task-parts.json')).read_text());artifact=json.loads((s/(label+'-api-artifact.json')).read_text());payload=artifact['payload']
assert [p['tool'] for p in parts]==['read','read','read','publish_interactive_artifact']
assert [p['state']['status'] for p in parts]==['completed']*4
reads=[]
for part in parts[:3]:
 name=part['state']['input']['filePath'];text=part['state']['output'].split('<content>',1)[1];lines=re.findall(r'^\d+: (.*)$',text,re.MULTILINE)
 assert lines==(project/name).read_text(encoding='utf-8-sig').splitlines(),name
 reads.append({'file':name,'lines':len(lines),'completeOriginalText':True})
assert [r['file'] for r in reads]==['sales.csv','summary.json','销售报告.md']
published=parts[3]['state']['input']['artifact'];assert payload=={'schemaVersion':published['schemaVersion'],'title':published['title'],**published['content']}
assert payload['renderer']=='presentation@1' and payload['aspectRatio']=='16:9' and len(payload['slides'])==3
rows=list(csv.DictReader(io.StringIO((project/'sales.csv').read_text(encoding='utf-8-sig'))));regions={}
for row in rows:
 region=regions.setdefault(row['区域'],{'count':0,'amount':Decimal(0)});region['count']+=1;region['amount']+=Decimal(row['金额'])
summary={'order_count':len(rows),'total_amount':format(sum((Decimal(r['金额']) for r in rows),Decimal(0)),'.2f'),'by_region':{k:{'order_count':v['count'],'total_amount':format(v['amount'],'.2f')} for k,v in regions.items()}}
assert summary==json.loads((project/'summary.json').read_text(encoding='utf-8-sig'))
export='\n\n---\n\n'.join('# '+slide['title']+'\n\n'+slide['markdown']+'\n\n'+slide['notes'] for slide in payload['slides']).encode()
assert (s/'before-download.md').read_bytes()==export
if label!='run118':
 assert artifact==json.loads((s/'run118-api-artifact.json').read_text())
 assert parts==json.loads((s/'run118-task-parts.json').read_text())
last=json.loads(json.loads((s/(label+'-task-messages.json')).read_text())[-1]['data']);assert last['finish']=='stop'
result={'status':'passed','label':label,'sessionID':artifact['sessionID'],'artifactID':artifact['id'],'fullOriginalReads':reads,'independentDecimalSummaryEqualsActualJSON':summary,'slides':[{'id':slide['id'],'title':slide['title'],'noteCharacters':len(slide['notes']),'noteBytes':len(slide['notes'].encode())} for slide in payload['slides']],'actualMarkdownBytes':len(export),'realPartsUnchanged':True,'finish':'stop','semanticReview':'all original slide content and notes reviewed manually against complete real source files; no UI assertions'}
(s/('presentation-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
