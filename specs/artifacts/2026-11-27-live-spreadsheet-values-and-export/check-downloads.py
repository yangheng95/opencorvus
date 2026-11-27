from pathlib import Path
from decimal import Decimal
import csv,io,json,shutil
s=Path(__file__).parent;downloads=Path('C:/Users/hengu/Downloads')
r=json.loads((s/'run37-runtime.json').read_text());project=Path(r['project'])
pairs=[
 ('销售核对电子表格·大范围核对 - 订单明细.csv','before-range-recovered-details.csv'),
 ('销售核对电子表格·大范围核对 - 订单明细 (1).csv','after-range-recovered-details.csv'),
 ('销售核对电子表格·大范围核对 - 区域汇总.csv','after-summary-en.csv'),
 ('销售核对电子表格·大范围核对 - 区域汇总 (1).csv','after-summary-zh.csv'),
 ('销售核对说明-来源复验 (1).md','after-document-original.md')]
proof=[]
for browser_name,name in pairs:
 data=(downloads/browser_name).read_bytes();shutil.copyfile(downloads/browser_name,s/name)
 assert (s/name).read_bytes()==data
 proof.append({'browserFilename':browser_name,'evidenceFile':name,'bytes':len(data)})
assert (s/'before-range-recovered-details.csv').read_bytes()==(s/'after-range-recovered-details.csv').read_bytes()==(s/'before-details.csv').read_bytes()
assert (s/'after-summary-en.csv').read_bytes()==(s/'after-summary-zh.csv').read_bytes()==(s/'before-edited-summary.csv').read_bytes()
assert (s/'after-document-original.md').read_bytes()==(project/'review/销售核对说明-来源复验.md').read_bytes()
source=list(csv.DictReader(io.StringIO((project/'sales.csv').read_bytes().decode())))
details=list(csv.DictReader(io.StringIO((s/'after-range-recovered-details.csv').read_bytes().decode())))
assert len(source)==len(details)==5
for original,current in zip(source,details):
 assert [current[k] for k in ['订单编号','区域','备注']]==[original[k] for k in ['订单编号','区域','备注']]
 assert Decimal(current['金额'])==Decimal(original['金额'])
def rows(name):return list(csv.reader(io.StringIO((s/name).read_bytes().decode())))
initial=rows('before-summary.csv');edited=rows('after-summary-en.csv')
assert Decimal(initial[1][2])==Decimal('28.25') and Decimal(initial[3][2])==Decimal('35.60')
assert Decimal(edited[1][2])==Decimal('30.25') and Decimal(edited[3][2])==Decimal('37.60')
assert edited[3][1]=='5'
result={'status':'passed','downloads':proof,'sourceRecords':5,'initialRegionalAmount':'28.25','initialTotal':'35.60','editedRegionalAmount':'30.25','editedTotal':'37.60','englishAndChineseCSVExact':True,'recoveredDetailsExact':True,'ordinaryDocumentBytes':4221}
(s/'download-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
