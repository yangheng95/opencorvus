from pathlib import Path
from decimal import Decimal
import csv,io,json,urllib.request,urllib.parse,zipfile,xml.etree.ElementTree as ET
s=Path(__file__).parent;r=json.loads((s/'run169-runtime.json').read_text(encoding='utf-8'));task=json.loads((s/'business-task.json').read_text(encoding='utf-8'));query='?'+urllib.parse.urlencode({'directory':task['directory']})
def get(route,binary=False):
    with urllib.request.urlopen(r['url']+route.lstrip('/')+query,timeout=30) as response:return response.read() if binary else json.load(response)
messages=get('session/'+task['sessionID']+'/message');assert messages[-1]['info'].get('finish')=='stop'
(s/'business-messages.json').write_text(json.dumps(messages,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
tools=[p for m in messages for p in m['parts'] if p['type']=='tool'];deliveries=[p for p in tools if p['tool']=='work_artifact_deliver' and p['state']['status']=='completed'];assert len(deliveries)==1
delivery=deliveries[0];output=json.loads(delivery['state']['output']);assert output['source']['filename']=='北仓结算交接简报.pptx' and len(output['renders'])==3
artifact=get('session/'+task['sessionID']+'/interactive-artifact/'+output['artifactID']);assert artifact['payload']['renderer']=='presentation@1' and len(artifact['payload']['slides'])==3
(s/'business-artifact.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for ref in [output['source'],*output['renders']]:
    raw=get(ref['url'],True);assert len(raw)==ref['size'];(s/ref['filename']).write_bytes(raw)
source=list(csv.DictReader(io.StringIO((s/'business-inputs/north/settlement-review.csv').read_text(encoding='utf-8'))));groups={}
for row in source:
    entry=groups.setdefault(row['类型'],{'count':0,'amount':Decimal(0)});entry['count']+=1;entry['amount']+=Decimal(row['金额'])
expected={'rows':len(source),'net':str(sum((Decimal(row['金额']) for row in source),Decimal(0))),'groups':{key:{'count':value['count'],'amount':str(value['amount'])} for key,value in groups.items()}}
authors=[p for p in tools if p['tool']=='work_artifact_author' and p['state']['status']=='completed'];assert authors
author=authors[-1]['state']['input'];assert len(author['slides'])==3
charts=[e for slide in author['slides'] for e in slide['elements'] if e['kind']=='chart'];assert len(charts)==1
chart=charts[0];assert set(chart['categories'])==set(groups) and len(chart['categories'])==len(groups)
assert [Decimal(str(v)) for v in chart['series'][0]['values']]==[groups[key]['amount'] for key in chart['categories']]
assert chart['data_label_number_format']=='0.00'
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','c':'http://schemas.openxmlformats.org/drawingml/2006/chart'}
with zipfile.ZipFile(s/output['source']['filename']) as package:
    slides=sorted(n for n in package.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml'));assert len(slides)==3
    slideTexts=[ET.fromstring(package.read(n)).findall('.//a:t',ns) for n in slides]
    texts=['\n'.join(node.text or '' for node in values) for values in slideTexts]
    contentTypes=ET.fromstring(package.read('[Content_Types].xml'))
    nativeCharts=[node.attrib['PartName'].lstrip('/') for node in contentTypes if node.attrib.get('ContentType')=='application/vnd.openxmlformats-officedocument.drawingml.chart+xml'];assert len(nativeCharts)==1
    native=ET.fromstring(package.read(nativeCharts[0]));values=[Decimal(n.text) for n in native.findall('.//c:ser/c:val/c:numLit/c:pt/c:v',ns)]
    assert values==[groups[key]['amount'] for key in chart['categories']]
    formats=[n.attrib for n in native.findall('.//c:dLbls/c:numFmt',ns)];assert any(n['formatCode']=='0.00' for n in formats)
result={'status':'passed','sessionID':task['sessionID'],'artifactID':output['artifactID'],'assistantFinish':messages[-1]['info']['finish'],'source':output['source'],'renders':output['renders'],'expected':expected,'authorChart':chart,'nativeChartValues':[str(v) for v in values],'nativeChartFormats':formats,'slideTexts':texts,'toolStates':[{'tool':p['tool'],'status':p['state']['status']} for p in tools],'scope':'Real source bytes, native editable text/chart values and exact current public payload;native UI and each fresh render require separate personal review.'}
(s/'delivery-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k not in ['slideTexts','authorChart','renders','toolStates']},ensure_ascii=False))
