"""Reuse the real closed accident; do not repeat the retired mini qualification."""
import json,shutil,sqlite3,subprocess,sys,zipfile
from pathlib import Path
CASE=Path(__file__).resolve().parents[1];PUB=CASE/'public'
OLD=Path('D:/opencorvus-benchmark-runs/l05-scene-qualification-20261030/original-input')
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
    if (PUB/'original-local.sqlite').exists():raise RuntimeError('materials_already_created')
    for name in ('original-local.sqlite','original-remote.sqlite','legacy-delivery.json','receiver-start.json','receiver-exit.json'):shutil.copy2(OLD/name,PUB/name)
    future=json.loads((OLD/'future-events.json').read_text(encoding='utf-8'))
    future.append({'tenant':'B','request_id':'q1','event_id':'W','revision':1,'kind':'settle','amount_minor':35})
    dump(PUB/'incoming-operations.json',{'events':future,'adjustment':{'tenant':'A','adjustment_id':'approved-2','amount_minor':-5,'approval':'approval-A2'},'note':{'tenant':'B','note_id':'new-note','body':'After repair: retain evidence\n\u0000尾部'}})
    dump(PUB/'provenance.json',{'data':'original explicitly synthetic accident with actual historical HTTP effects/receipts','origin':str(OLD),'current_public_legacy':'faithful extraction of historical ingest/send behavior; correct repair reference is private','historical_receiver_addresses':'receiver-start.json is a historical process receipt, never an active endpoint','scope':'USD minor integer, local SQLite plus cooperative HTTP service; no real personal data or external finance'})
if __name__=='__main__':main()
