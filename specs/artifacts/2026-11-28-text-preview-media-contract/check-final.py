from pathlib import Path
import json,urllib.request
s=Path(__file__).parent;r=json.loads((s/'run130-runtime.json').read_text(encoding='utf-8'))
def load(name):return json.loads((s/name).read_text(encoding='utf-8'))
ref=load('attachment-reference.json');source=(s/'original-project-files/test_sales_summary.py').read_bytes()
artifacts=load('run130-api-artifacts.json');text=next(a for a in artifacts if a['payload'].get('kind')=='text')
assert text['payload']['source']==ref and text['id']=='art_g0VcD6EEH00vsHhh41eG'
with urllib.request.urlopen(r['url'].rstrip('/')+ref['url']) as response:
    raw=response.read();assert response.status==200 and raw==source and len(raw)==10107
    assert response.headers['Content-Type'].split(';')[0]=='application/octet-stream'
parts=load('run130-task-parts.json');old=load('run128-task-parts.json')
assert parts[:len(old)]==old
published=[p for p in parts if p['tool']=='publish_interactive_artifact' and p['state']['status']=='completed']
assert published[0]['state']['input']['artifact']['content']['source']==ref
assert json.loads(published[0]['state']['output'])=={'artifactID':text['id'],'renderer':'file-preview@1'}
for name in ['final-clipboard.txt','english-clipboard.txt','actual-download.py']:
    assert (s/name).read_bytes()==source,name
assert (s/'typed-clipboard.txt').read_bytes()==(s/'original-project-files/sales_summary.py').read_bytes()
assert (s/'candidate-clipboard.txt').read_text()=='test_sales_summary.py'
pdf_ref=load('binary-reference.json')['payload']['source']
pdf=next(a for a in artifacts if a['payload'].get('kind')=='pdf')
assert pdf['payload']['source']==pdf_ref
assert published[1]['state']['input']['artifact']['content']['source']==pdf_ref
assert json.loads(published[1]['state']['output'])=={'artifactID':pdf['id'],'renderer':'file-preview@1'}
assert (s/'binary-clipboard.txt').read_text(encoding='utf-8')==pdf_ref['filename']
with urllib.request.urlopen(r['url'].rstrip('/')+pdf_ref['url']) as response:
    pdf_bytes=response.read();assert response.status==200 and len(pdf_bytes)==pdf_ref['size'] and pdf_bytes[:5]==b'%PDF-'
(s/'accepted-original.pdf').write_bytes(pdf_bytes)
session=text['sessionID']
with urllib.request.urlopen(urllib.request.Request(r['url']+'session/'+session+'/message',headers={'x-opencorvus-directory':r['project']})) as response:messages=json.load(response)
final=[m for m in messages if m['info'].get('finish')=='stop'][-1]
reply='\n'.join(p['text'] for p in final['parts'] if p['type']=='text');assert reply.strip()
(s/'pdf-response.txt').write_text(reply,encoding='utf-8')
stops=[m for m in messages if m['info'].get('finish')=='stop']
(s/'retry-response.txt').write_text('\n'.join(p['text'] for p in stops[-2]['parts'] if p['type']=='text'),encoding='utf-8')
facts={'status':'passed','sessionID':session,'textArtifactID':text['id'],'originalReferenceUnchanged':True,
    'sourceBytes':len(source),'sourceLines':len(source.decode().splitlines()),'sourceMime':ref['mime'],
    'historicalToolPartsUnchanged':len(old),'naturalTextPublication':'completed','candidateClipboard':'test_sales_summary.py',
    'finalCopyBytes':len(source),'englishCopyBytes':len(source),'nativeDownload':load('download-facts.json'),
    'typedOriginalCopyBytes':7650,'pdfArtifactID':pdf['id'],'pdfOriginalBytes':len(pdf_bytes),'pdfCopyName':pdf_ref['filename'],
    'final':'stop','scope':'public tool/attachment/output/actual clipboard and downloaded-byte facts; native screenshots reviewed separately; no DOM or UI test'}
(s/'final-contract-facts.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(facts,ensure_ascii=False))
