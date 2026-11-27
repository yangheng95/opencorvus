from pathlib import Path
import json
s=Path(__file__).parent;d=Path('C:/Users/hengu/Downloads')
raw=(s/'original-project-files/sales_summary.py').read_bytes()
facts=[]
for name,copy,entry in [('sales_summary (8).py','downloaded-file-preview.py','file-preview'),('sales_summary (9).py','downloaded-history.py','history')]:
    saved=(d/name).read_bytes();assert saved==raw
    (s/copy).write_bytes(saved)
    facts.append({'filename':name,'bytes':len(saved),'entry':entry,'equalsOriginal':True})
assert (s/'copied-original.py').read_bytes()==raw
result={'status':'passed','downloads':facts,'copiedBytes':len(raw),'clipboardEqualsOriginal':True,'comparison':'direct bytes against protected original, not a digest or UI assertion'}
(s/'download-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
