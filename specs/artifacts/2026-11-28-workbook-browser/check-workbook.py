from pathlib import Path
from decimal import Decimal
import csv,json,sys
s=Path(__file__).parent;label=sys.argv[1]
sys.path.insert(0,str(s.parent/'opencorvus-iteration-20261127-sales-workbook/checker-libs'))
import openpyxl
r=json.loads((s/(label+'-runtime.json')).read_text());project=Path(r['project'])
book=openpyxl.load_workbook(project/'deliverables/销售核对.xlsx',read_only=True,data_only=False)
assert book.sheetnames==['订单明细','区域汇总','统计说明']
expected={sheet.title:{cell.coordinate:cell.value for row in sheet for cell in row if cell.value is not None} for sheet in book}
assert sum(map(len,expected.values()))==104
source=list(csv.DictReader((project/'sales.csv').open(encoding='utf-8-sig',newline='')))
assert len(source)==5 and sum((Decimal(row['金额']) for row in source),Decimal(0))==Decimal('35.60')
assert list(book.worksheets[1].values)==[('区域','订单数','净金额'),('华东',3,28.25),('华南',2,7.35),('全体合计',5,35.6)]
parts=json.loads((s/(label+'-task-parts.json')).read_text())
bashes=[p for p in parts if p['tool']=='bash' and p['state']['status']=='completed']
captured=[]
for p in bashes:
 assert p['state']['metadata']['exit']==0
 for line in p['state']['output'].splitlines():
  if line.startswith('SHEET='):captured.append(json.loads(line[6:]))
assert [sheet['name'] for sheet in captured]==book.sheetnames
for sheet in captured:
 actual={cell['address']:Decimal(cell['value']) if cell['type']=='number' else cell['value'] for cell in sheet['cells']}
 for cell in sheet['cells']:
  original=expected[sheet['name']][cell['address']]
  assert cell['type']==('boolean' if isinstance(original,bool) else 'number' if isinstance(original,(int,float)) else 'str')
  assert actual[cell['address']]==(Decimal(str(original)) if cell['type']=='number' else original)
artifact=json.loads((s/(label+'-api-artifact.json')).read_text());payload=artifact['payload']
assert payload['renderer']=='spreadsheet@1' and payload['editable'] is False
assert [sheet['name'] for sheet in payload['sheets']]==book.sheetnames
for sheet in payload['sheets']:
 actual={cell['address']:cell['value'] for cell in sheet['cells']}
 assert actual==expected[sheet['name']],sheet['name']
 for cell in sheet['cells']:
  assert type(cell['value']) is type(expected[sheet['name']][cell['address']]),(sheet['name'],cell['address'])
publisher=next(p for p in parts if p['tool']=='publish_interactive_artifact' and p['state']['status']=='completed')
published=publisher['state']['input']['artifact']
assert payload=={'schemaVersion':published['schemaVersion'],'title':published['title'],**published['content']}
last=json.loads(json.loads((s/(label+'-task-messages.json')).read_text())[-1]['data'])
assert last['finish']=='stop'
if label!='run112':
 assert artifact==json.loads((s/'run112-api-artifact.json').read_text())
 assert parts==json.loads((s/'run112-task-parts.json').read_text())
(s/'expected-cells.json').write_text(json.dumps(expected,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
result={'status':'passed','label':label,'sessionID':artifact['sessionID'],'artifactID':artifact['id'],'sheets':book.sheetnames,'sourceWorkbookBytes':(project/'deliverables/销售核对.xlsx').stat().st_size,'nonemptyCells':104,'allReadAndPublishedValuesCoordinatesAndTypesEqualOriginal':True,'finished':'stop','tools':[{'tool':p['tool'],'id':p['id'],'status':p['state']['status']} for p in parts]}
(s/('workbook-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
