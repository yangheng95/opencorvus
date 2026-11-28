from pathlib import Path
import json,zipfile,xml.etree.ElementTree as ET
s=Path(__file__).parent;facts=json.loads((s/'candidate-delivery-facts.json').read_text(encoding='utf-8'));chart=facts['authorChart']
with zipfile.ZipFile(s/facts['source']['filename']) as package:
    types=ET.fromstring(package.read('[Content_Types].xml'));chartParts=[node.attrib['PartName'].lstrip('/') for node in types if node.attrib.get('ContentType')=='application/vnd.openxmlformats-officedocument.drawingml.chart+xml'];assert len(chartParts)==1
    native=ET.fromstring(package.read(chartParts[0]));ns={'c':'http://schemas.openxmlformats.org/drawingml/2006/chart','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
    position=native.find('.//c:dLbls/c:dLblPos',ns).attrib['val'];assert position=='inEnd' and chart['data_label_position']=='insideEnd'
    labelSizes=[int(node.attrib['sz'])/100 for node in native.findall('.//c:dLbls/c:txPr/a:p/a:pPr/a:defRPr',ns)];assert labelSizes==[chart['data_label_font_size_pt']]
    axisSizes=[int(node.attrib['sz'])/100 for tag in ['catAx','valAx'] for node in native.findall('.//c:'+tag+'/c:txPr/a:p/a:pPr/a:defRPr',ns)];assert axisSizes==[chart['axis_font_size_pt']]*2
rows=json.loads((s/'run170-chart-position-declarations.json').read_text(encoding='utf-8'));assert rows
for row in rows:
    assert row['model']=='gpt-6.1-sol' and row['streaming'] is True and row['tool']=='work_artifact_author' and row['strict'] is False
    assert len(row['declarations'])==1
    schema=row['declarations'][0]['positionSchema'];assert schema['anyOf'][0]['enum']==['outsideEnd','insideEnd','insideBase','center'] and schema['anyOf'][1]=={'type':'null'}
assert (s/'browser-downloaded.pptx').read_bytes()==(s/'北仓结算交接简报.pptx').read_bytes()
assert (s/'candidate-browser-downloaded.pptx').read_bytes()==(s/'北仓结算内侧标签图.pptx').read_bytes()
result={'status':'passed','candidateSession':facts['sessionID'],'candidateArtifact':facts['artifactID'],'sourceBytes':facts['source']['size'],'requestedLabelPosition':chart['data_label_position'],'nativeLabelPosition':position,'nativeLabelFontSizePt':labelSizes,'nativeAxisFontSizePt':axisSizes,'nativeChartPart':chartParts[0],'outgoingRequestsWithActualDeclaration':len(rows),'outgoingEnum':['outsideEnd','insideEnd','insideBase','center'],'actualModel':'gpt-6.1-sol','streaming':True,'structuredOutputOptionalNull':'actual nullable SDK declaration;selected insideEnd retained in real author input and native file','baselineAndCandidateActualBrowserDownloads':'exact canonical bytes','expected':facts['expected']}
(s/'candidate-contract-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
