"""One-off author construction. Reproduction uses the delivered closed input database."""
import json,sqlite3,shutil,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'public'
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
    history=ROOT/'evaluator'/'historical-micro-input.zip'
    names=['v1.sqlite','v1-schema.sql','provenance.json','PROTOCOL.draft.md','legacy_writer.py','l04_request.py','authority.json']
    if history.exists() or (PUB/'app-v1.sqlite').exists():raise RuntimeError('construction_already_published')
    with zipfile.ZipFile(history,'w',zipfile.ZIP_DEFLATED) as z:
        for n in names:z.write(PUB/n,n)
    db=PUB/'app-v1.sqlite';shutil.copy2(PUB/'v1.sqlite',db)
    c=sqlite3.connect(db);c.execute('CREATE TABLE notes(note_id TEXT PRIMARY KEY NOT NULL,entry_id TEXT NOT NULL,text TEXT NOT NULL)')
    customers=[(21,'诊所 北区','clinic@example.test'),(23,'诊所旧ID','clinic-old@example.test'),(40,'Müller & Co','muller@example.test'),(41,'Müller 财务别名','finance@example.test')]
    c.executemany('INSERT INTO legacy_customers VALUES(?,?,?)',customers)
    for i in range(1,19):
        customer=[7,12,21,40][i%4];currency='USD' if i%2 else 'CNY';amount=f'{10+i}.{(i*17)%100:02d}'
        order=f'INV-{i:03d}';c.execute('INSERT INTO legacy_entries VALUES(?,?,?,?,NULL)',(order,customer,currency,amount))
        if i%3==0:c.execute('INSERT INTO legacy_entries VALUES(?,?,?,?,?)',(f'REF-{i:03d}',23 if customer==21 else customer,currency,'-1.17',order))
        note=f'客户原批注 {i}: 保留换行\n含逗号,"原文"及NUL\x00尾 / café'
        c.execute('INSERT INTO notes VALUES(?,?,?)',(f'N-{i:03d}',order,note))
    for row in [('CAP',7,'USD','5.00',None),('CAP-R1',7,'USD','-3.00','CAP'),('CAP-R2',9,'USD','-3.00','CAP'),('BAD-CUR',7,'EUR','2.00',None),('BAD-PARENT',12,'USD','-0.50','O1')]:c.execute('INSERT INTO legacy_entries VALUES(?,?,?,?,?)',row)
    # Original accepted operations are real commands committed by the published v1 app.
    c.commit();c.close()
    import subprocess,sys
    temp=ROOT/'evaluator'/'construction-original-requests';temp.mkdir(exist_ok=False)
    for i,(cust,amount) in enumerate([(7,'21.09'),(12,'30.31'),(23,'15.27')]):
        r={'action':'write','write':{'op_key':f'published-ack-{i}','entry_id':f'ACK-{i}','customer_id':cust,'currency':'USD','amount':amount,'epoch':3}}
        dump(temp/f'{i}.json',r)
        p=subprocess.run([sys.executable,'-B',str(PUB/'legacy_app.py'),'--db',str(db),'--request',str(temp/f'{i}.json')],capture_output=True,text=True,check=True)
        dump(temp/f'{i}-native.json',{'argv':[sys.executable,'legacy_app.py','--db','app-v1.sqlite','--request',f'{i}.json'],'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
        assert json.loads(p.stdout)['status']=='accepted'
    authority=json.loads((PUB/'authority.json').read_text(encoding='utf-8'))
    authority['legacy_to_customer'].update({'21':'C-CLINIC','23':'C-CLINIC','40':'C-MULLER','41':'C-MULLER'})
    authority['customers'].update({'C-CLINIC':{'display_name':'北区诊所','email':'clinic@example.test'},'C-MULLER':{'display_name':'Müller & Co','email':'muller@example.test'},'C-GAMMA':{'display_name':'第三法人','email':'same@example.test'}})
    dump(PUB/'identity-authority.json',authority)
    c=sqlite3.connect(db);schema='\n\n'.join(row[0]+';' for row in c.execute("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name"));c.close()
    (PUB/'published-v1.sql').write_text('BEGIN IMMEDIATE;\n'+schema+'\nCOMMIT;\n',encoding='utf-8')
    dump(PUB/'provenance.json',{'kind':'original_explicitly_synthetic_application_archive','construction':'build_materials.py plus actual published v1 writes','published_migration_history':'schema_migrations is immutable input history; maximum version is schema truth','live_input':'app-v1.sqlite','historical_micro':'private historical-micro-input.zip preserves all seven old files','notes':'fictional users; no personal data or actual production data'})
    for n in names:
        if n!='provenance.json':(PUB/n).unlink()
if __name__=='__main__':main()
