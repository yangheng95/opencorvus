from pathlib import Path
import json,sys,urllib.request
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text())
original=next(row for row in json.loads((s/'original-project-rows.json').read_text())['interactive_artifact'] if row['id']=='art_g0Vc8JddB00rifxkPyIl')
with urllib.request.urlopen(urllib.request.Request(r['url']+'session/ses_hXaoxvf6sXUeNwnhrZTA/interactive-artifact/'+original['id'],headers={'x-opencorvus-directory':r['project']})) as response:artifact=json.load(response)
assert artifact['payload']==json.loads(original['payload'])
assert len(artifact['payload']['slides'])==3 and all(slide['image'] for slide in artifact['payload']['slides'])
(s/'existing-presentation-api.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
actual=(s/'downloaded-existing.pptx').read_bytes();expected=(s/'original-project-files/deliverables/销售经理简报-清晰图表.pptx').read_bytes();assert actual==expected
result={'status':'passed','artifactID':artifact['id'],'originalPublicPayloadUnchanged':True,'nativeImageSlides':3,'downloadedPPTXBytes':len(actual),'equalsProtectedOriginalFile':True}
(s/'existing-presentation-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
