from pathlib import Path
import json
s=Path(__file__).parent
source=(s/'original-project-files/sales_summary.py').read_bytes()
edited='# 交接临时备注：仅当前视图\n'.encode()+source
for name in ['edited-download.py','copied-edited.py','pasted-edited.py']:assert (s/name).read_bytes()==edited,name
for name in ['before-download.py','restored-download.py','copied-restored.py','original-resource.py','readonly-download.py']:assert (s/name).read_bytes()==source,name
facts=json.loads((s/'download-facts.json').read_text(encoding='utf-8'))
for entry,expected in zip(facts['downloads'],[edited,source]):assert (Path.home()/'Downloads'/entry['filename']).read_bytes()==expected
original=json.loads((s/'original-code-facts.json').read_text(encoding='utf-8'))
assert (Path.home()/'Downloads'/original['actualDownloadedFilename']).read_bytes()==source
print(json.dumps({'status':'passed','originalBytes':len(source),'editedBytes':len(edited),'actualDownloads':3,'copyAndNativePaste':'exact edit','undoAndReadonlyOriginal':'exact source'}))
