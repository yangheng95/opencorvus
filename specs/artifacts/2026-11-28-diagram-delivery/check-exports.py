from pathlib import Path
import json,re,xml.etree.ElementTree as E
s=Path(__file__).parent
source=json.loads((s/'run114-api-artifact.json').read_text())['payload']['source'].encode()
for name in ['before-source.mmd','after-source.mmd','copied-source.mmd','pasted-source.mmd','final-source.mmd','final-copied-source.mmd','final-pasted-source.mmd']:
 assert (s/name).read_bytes()==source,name
expected=set('ENTRY ARG PATH ARGERR HELP ALIAS CALL OPEN HEADER NEXT SHAPE AMOUNT RECORD DATAERR PREC ACC MONEY RESULT CSVERR JSON REPORT MD OPTIONAL OK SORT OUTCSV HANDLER IO OTHER UNCAUGHT SCOPE WRITEWARN APIERR REPORTNOTE TESTNOTE'.split())
files=[];labels=[];edges=[]
for name in ['light.svg','dark.svg']:
 raw=(s/name).read_bytes();root=E.fromstring(raw);assert root.tag=='{http://www.w3.org/2000/svg}svg'
 box=list(map(float,root.attrib['viewBox'].replace(',',' ').split()));assert len(box)==4 and box[2]>0 and box[3]>0
 assert [float(root.attrib['width']),float(root.attrib['height'])]==box[2:]
 nodes=[n for n in root.iter() if 'node' in n.attrib.get('class','').split()]
 identities={re.fullmatch(re.escape(root.attrib['id'])+r'-flowchart-(.+)-\d+',n.attrib['id']).group(1) for n in nodes}
 assert identities==expected and len(nodes)==35
 labels.append({re.fullmatch(re.escape(root.attrib['id'])+r'-flowchart-(.+)-\d+',n.attrib['id']).group(1):''.join(n.itertext()) for n in nodes})
 paths=[n for n in root.iter() if 'flowchart-link' in n.attrib.get('class','').split()]
 edges.append(sorted(n.attrib['id'].removeprefix(root.attrib['id']+'-') for n in paths))
 backdrop=root[0];assert backdrop.tag=='{http://www.w3.org/2000/svg}rect'
 assert [float(backdrop.attrib[key]) for key in ['x','y','width','height']]==box
 style=dict(item.strip().split(':',1) for item in backdrop.attrib['style'].split(';') if ':' in item)
 rgb=re.fullmatch(r'rgb\((\d+), (\d+), (\d+)\)',style['fill'].strip());assert rgb
 assert all(any(text.text or list(text) for text in node.iter('{http://www.w3.org/2000/svg}text')) for node in nodes)
 files.append({'filename':name,'bytes':len(raw),'namespace':'http://www.w3.org/2000/svg','width':box[2],'height':box[3],'nodes':len(nodes),'links':len(paths),'backgroundRGB':list(map(int,rgb.groups())),'all35AuthoredNodeIdentities':True,'nativeTextNodeCount':35,'paintedBackdrop':True})
assert labels[0]==labels[1] and edges[0]==edges[1]
result={'status':'passed','originalSourceBytes':len(source),'sourceCopies':'before/after MMD, actual product copy and native Ctrl+V draft bytes all equal original publication','svgFiles':files,'sameNodeTextAndLinkIdentitiesAcrossThemes':True,'scope':'independent actual downloaded artifact XML/data contract; real desktop screenshots and independent Sharp/librsvg decoded files provide manual document visual acceptance'}
(s/'export-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
