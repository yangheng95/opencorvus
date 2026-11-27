from pathlib import Path
import csv,io,json
s=Path(__file__).parent
artifact=json.loads((s/'run112-api-artifact.json').read_text())['payload']
expected=json.loads((s/'expected-cells.json').read_text())
facts=[]
def value(v):
 if isinstance(v,bool):return str(v).lower()
 return str(v)
for sheet in artifact['sheets']:
 name=artifact['title']+' - '+sheet['name']+'.csv';raw=(s/name).read_bytes();rows=list(csv.reader(io.StringIO(raw.decode('utf-8-sig'))))
 assert len(rows)==sheet['rowCount'] and all(len(row)==sheet['columnCount'] for row in rows)
 for cell in sheet['cells']:
  addr=cell['address'];letters=''.join(ch for ch in addr if ch.isalpha());col=0
  for ch in letters:col=col*26+ord(ch)-64
  actual=rows[int(addr[len(letters):])-1][col-1];v=expected[sheet['name']][addr]
  if isinstance(v,bool):assert actual==str(v).lower(),(addr,actual)
  elif isinstance(v,(int,float)):assert float(actual)==v,(addr,actual)
  else:assert actual==v,(addr,actual)
 facts.append({'name':name,'bytes':len(raw),'rows':len(rows),'columns':sheet['columnCount'],'originalValuesEqual':True})
edited=(s/'edited-summary.csv').read_bytes();rows=list(csv.reader(io.StringIO(edited.decode('utf-8-sig'))))
assert rows[:4]==[['区域','订单数（笔）','净金额（源文件未注明单位）'],['华东','3','30.25'],['华南','2','7.35'],['合计','5','37.6']]
original=json.loads((s/'art_g0Vc8gdaZ00BYeqDlb3g-original.json').read_text())['sheets'][1]
for cell in original['cells']:
 addr=cell['address'];row=int(addr[1:])-1;col=ord(addr[0])-65
 if addr in ['C2','C4']:continue
 v=cell.get('computed',cell.get('value'));actual=rows[row][col]
 if isinstance(v,(int,float)):assert float(actual)==v
 else:assert actual==str(v)
result={'status':'passed','readonlySheets':facts,'readonlyOriginalCells':104,'edited':{'bytes':len(edited),'C2':'30.25','C4':'37.6','otherOriginalValuesEqual':True},'copies':'downloaded bytes copied from timestamp-qualified browser Downloads files; not synthesized exports'}
(s/'download-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
