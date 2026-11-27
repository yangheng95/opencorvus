from pathlib import Path
import csv, io, json, struct

s=Path(__file__).parent
d=Path('C:/Users/hengu/Downloads')
source=(s/'original-project-files/sales_summary.py').read_bytes()
checks=[]
for name,copy,phase in [('sales-summary.txt','before-python-download','before'),('sales_summary (6).py','before-plaintext-download.py','before'),('sales-summary','final-python-download','candidate'),('sales_summary (7).py','final-plaintext-download.py','candidate')]:
    raw=(d/name).read_bytes()
    assert raw==source==(s/copy).read_bytes()
    checks.append({'filename':name,'phase':phase,'bytes':len(raw),'equalsOriginal':True})
for name in ['copied-python.py','copied-plaintext.py','pasted-source.py']:
    assert (s/name).read_bytes()==source
for name,original,copy in [('区域汇总 (6).csv','区域汇总.csv','downloaded-original-regions.csv'),('区域对比（原图） (2).png','review/区域对比（原图）.png','downloaded-original-chart.png')]:
    raw=(d/name).read_bytes()
    assert raw==(s/'original-project-files'/original).read_bytes()
    (s/copy).write_bytes(raw)
    checks.append({'filename':name,'phase':'shared-download-regression','bytes':len(raw),'equalsOriginal':True})
csv_bytes=(s/'downloaded-original-regions.csv').read_bytes()
assert list(csv.reader(io.StringIO(csv_bytes.decode('utf-8'))))==[['区域','订单数','净金额'],['华东','3','28.25'],['华南','2','7.35']]
png=(s/'downloaded-original-chart.png').read_bytes()
assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(1280,720)
result={'status':'passed','sourceBytes':len(source),'downloads':checks,'nativeCopiesAndPasteEqualOriginal':True,'csvRows':2,'pngDimensions':[1280,720],'scope':'actual saved files from native page actions; raw byte and format contracts, no UI assertions or source digests'}
(s/'download-regression-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
