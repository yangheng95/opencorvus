from pathlib import Path
import json
s=Path(__file__).parent;payload=json.loads((s/'run118-api-artifact.json').read_text())['payload']
expected='\n\n---\n\n'.join('# '+slide['title']+'\n\n'+slide['markdown']+'\n\n'+slide['notes'] for slide in payload['slides']).encode()
files=['before-download.md','after-download.md','copied-presentation.md','pasted-presentation.md']
for name in files:assert (s/name).read_bytes()==expected,name
result={'status':'passed','bytes':len(expected),'slides':3,'fullOriginalNotesAndMarkdown':True,'actualFilesEqualOriginalPublication':files,'scope':'actual downloaded and native copied/pasted output contract; no product DOM or UI source assertions'}
(s/'download-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
