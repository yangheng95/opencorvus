from pathlib import Path
import json, urllib.request
s=Path(__file__).parent
r=json.loads((s/'run124-runtime.json').read_text(encoding='utf-8'))
old=json.loads((s.parent/'opencorvus-iteration-20261128-code-reading/run121-api-artifact.json').read_text(encoding='utf-8'))
url=r['url']+'session/'+old['sessionID']+'/interactive-artifact/'+old['id']
with urllib.request.urlopen(urllib.request.Request(url,headers={'x-opencorvus-directory':r['project']})) as response:
    current=json.load(response)
    status=response.status
assert current==old and current['payload']['editable'] is True and current['payload']['language']=='python'
assert current['payload']['source'].encode('utf-8')==(s/'original-project-files/sales_summary.py').read_bytes()
(s/'original-editable-code.json').write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
result={'status':'passed','httpStatus':status,'artifactID':current['id'],'sessionID':current['sessionID'],'sourceBytes':len(current['payload']['source'].encode('utf-8')),'samePublicArtifactAsBefore':True,'editable':True,'language':'python'}
(s/'existing-code-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
