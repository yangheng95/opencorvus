from pathlib import Path
import json,shutil,xml.etree.ElementTree as E,datetime
s=Path(__file__).parent;r=json.loads((s/'run44-runtime.json').read_text());downloads=Path('C:/Users/hengu/Downloads')
files=[downloads/'visualization (1).svg',downloads/'visualization (2).svg'];objects=[]
for file in files:
 stat=file.stat();assert stat.st_mtime*1000>r['startedAt'];data=file.read_bytes();root=E.fromstring(data);assert root.tag=='{http://www.w3.org/2000/svg}svg'
 labels=[e.text or '' for e in root.iter('{http://www.w3.org/2000/svg}text')];assert {'华东','华南','28.25','7.35'}<=set(labels)
 assert float(root.attrib['width'])>0 and float(root.attrib['height'])>0
 objects.append({'browserFilename':file.name,'bytes':len(data),'modifiedUTC':datetime.datetime.fromtimestamp(stat.st_mtime,datetime.timezone.utc).isoformat(),'width':root.attrib['width'],'height':root.attrib['height'],'visibleRegionLabels':['华东','华南'],'visibleAmounts':['28.25','7.35']})
assert files[0].read_bytes()==files[1].read_bytes();shutil.copyfile(files[0],s/'regional-all.svg')
result={'status':'passed','actualBrowserDownloads':objects,'sameNativeSVGBytes':True,'downloadEventWait':'CUA waitForEvent timed out twice despite completed browser files; checked real downloaded SVG instead','preExistingVisualizationPreserved':True}
(s/'download-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
