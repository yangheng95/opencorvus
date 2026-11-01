import json
from pathlib import Path

root=Path(__file__).resolve().parent
facts=json.loads((root/'original-r06-observable-facts.json').read_text(encoding='utf-8'))
for p in facts['tools']:
    value=p['input']
    print(p['id'],p['tool'],json.dumps(value,ensure_ascii=True)[:420])
print('OBSERVABLE MESSAGES')
for p in facts['text']:
    if p['text'] and not p['text'].startswith(('Repair the supplied','Complete the following','## Orchestrator')):
        print(p['id'],json.dumps(p['text'],ensure_ascii=True)[:1300])
