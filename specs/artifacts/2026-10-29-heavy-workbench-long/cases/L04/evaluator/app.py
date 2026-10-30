"""Constructive complete application. Legacy binary is the immutable public input."""
import argparse, json, os, sqlite3, sys
from datetime import datetime,timezone
from pathlib import Path
from legacy_app import connect, canonical, minor, Error, read_request, identity, checkpoint


def current(c):
    return c.execute('SELECT max(version) FROM schema_migrations').fetchone()[0],c.execute('SELECT epoch FROM control').fetchone()[0]


def migrate(c, authority, pause, defect):
    c.execute('BEGIN IMMEDIATE')
    version, epoch=current(c)
    if version==2:
        c.rollback(); return {'status':'already_current','version':2,'epoch':epoch}
    if version!=1: raise Error('unsupported_schema')
    raw_c=[dict(r) for r in c.execute('SELECT * FROM legacy_customers')]
    raw_e=[dict(r) for r in c.execute('SELECT * FROM legacy_entries')]
    receipts=[dict(r) for r in c.execute('SELECT * FROM write_receipts')]
    if any(not identity(r['op_key']) for r in receipts):raise Error('unresolved_receipt_identity')
    if any(not identity(r['entry_id']) for r in raw_e):raise Error('unresolved_entry_identity')
    if defect=='early_version':
        c.execute("INSERT INTO schema_migrations VALUES(2,'canonical_money_fee',?)",(datetime.now(timezone.utc).isoformat(),))
        c.execute('UPDATE control SET epoch=epoch+1');c.commit();c.execute('BEGIN IMMEDIATE')
    for sql in [
      "CREATE TABLE customers(customer_key TEXT PRIMARY KEY NOT NULL CHECK(length(trim(customer_key))>0),display_name TEXT NOT NULL,email TEXT NOT NULL)",
      'CREATE TABLE customer_aliases(legacy_id INTEGER PRIMARY KEY,customer_key TEXT NOT NULL REFERENCES customers,raw_json TEXT NOT NULL)',
      "CREATE TABLE entries(entry_id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(entry_id))>0),customer_key TEXT NOT NULL REFERENCES customers,currency TEXT NOT NULL CHECK(currency IN ('USD','CNY')),amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer'),reversal_of TEXT REFERENCES entries DEFERRABLE INITIALLY DEFERRED,fee_minor INTEGER NOT NULL CHECK(typeof(fee_minor)='integer' AND fee_minor>=0),legacy_raw_json TEXT,CHECK((reversal_of IS NULL AND amount_minor>=0) OR (reversal_of IS NOT NULL AND amount_minor<0)))",
      'CREATE INDEX entries_customer_currency ON entries(customer_key,currency)',
      'CREATE TABLE quarantine(kind TEXT NOT NULL,legacy_key TEXT NOT NULL,reason TEXT NOT NULL,raw_json TEXT NOT NULL,PRIMARY KEY(kind,legacy_key))']:
        c.execute(sql)
    def q(kind,key,reason,row): c.execute('INSERT INTO quarantine VALUES(?,?,?,?)',(kind,str(key),reason,canonical(row)))
    mapping={};email_keys={}
    for r in raw_c:
        key=authority['legacy_to_customer'].get(str(r['customer_id']))
        if key is None:q('customer',r['customer_id'],'unmapped_customer',r);continue
        facts=authority['customers'][key]
        if defect=='email_merge':key=email_keys.setdefault(facts['email'],key)
        c.execute('INSERT OR IGNORE INTO customers VALUES(?,?,?)',(key,facts['display_name'],facts['email']))
        mapping[r['customer_id']]=key
        c.execute('INSERT INTO customer_aliases VALUES(?,?,?)',(r['customer_id'],key,canonical(r)))
    values={};bad={}
    for r in raw_e:
        try:
            if r['customer_id'] not in mapping:raise Error('unmapped_customer')
            if r['currency'] not in ('USD','CNY'):raise Error('unsupported_currency')
            a=minor(r['amount'])
            if defect=='truncate_money':a=int(a/100)*100
            values[r['entry_id']]=(mapping[r['customer_id']],r['currency'],a,r['reversal_of'])
        except Error as e:bad[r['entry_id']]=str(e)
    refunds={}
    for key,(customer,currency,a,parent) in values.items():
        if parent is None:
            if a<0:bad[key]='invalid_reversal'
        else:
            p=values.get(parent)
            if a>=0 or p is None or p[:2]!=(customer,currency) or p[2]<=0 or p[3] is not None or parent in bad:bad[key]='invalid_reversal'
            else:refunds.setdefault(parent,[]).append(key)
    for parent,ids in refunds.items():
        if -sum(values[k][2] for k in ids)>values[parent][2]:
            for k in ids:bad[k]='refund_group_exceeds'
    for r in raw_e:
        key=r['entry_id']
        if key in bad:q('entry',key,bad[key],r);continue
        cust,cur,a,parent=values[key]
        if defect=='wrong_refund' and parent is not None:parent=next(k for k,v in values.items() if k not in bad and v[:2]==(cust,cur) and v[2]>0 and v[3] is None and k!=parent)
        c.execute('INSERT INTO entries VALUES(?,?,?,?,?,?,?)',(key,cust,cur,a,parent,0,canonical(r)))
    c.execute("CREATE TABLE receipts_next(op_key TEXT PRIMARY KEY NOT NULL CHECK(length(trim(op_key))>0),command_json TEXT NOT NULL,result_json TEXT NOT NULL)")
    c.execute('INSERT INTO receipts_next SELECT * FROM write_receipts');c.execute('DROP TABLE write_receipts');c.execute('ALTER TABLE receipts_next RENAME TO write_receipts')
    c.execute('DROP TABLE legacy_entries');c.execute('DROP TABLE legacy_customers')
    c.execute("CREATE TRIGGER entry_audit AFTER INSERT ON entries BEGIN INSERT INTO audit_events(entry_id,source_schema,payload) VALUES(NEW.entry_id,2,json_object('customer_key',NEW.customer_key,'currency',NEW.currency,'amount_minor',NEW.amount_minor,'reversal_of',NEW.reversal_of,'fee_minor',NEW.fee_minor)); END")
    if defect!='early_version':
        c.execute("INSERT INTO schema_migrations VALUES(2,'canonical_money_fee',?)",(datetime.now(timezone.utc).isoformat(),))
        c.execute('UPDATE control SET epoch=epoch+1')
    checkpoint('before_commit',pause,c)
    c.commit();checkpoint('after_commit',pause,c)
    return {'status':'upgraded','version':2,'epoch':epoch+1}


def write(c,r,pause):
    for field in ('op_key','entry_id','customer_key'):
        if not identity(r.get(field)):raise Error('invalid_request:'+field)
    for field in ('epoch','amount_minor','fee_minor'):
        if type(r.get(field)) is not int or not -(2**63)<=r[field]<2**63:raise Error('invalid_request:'+field)
    if r['epoch']<0 or r['fee_minor']<0:raise Error('invalid_request:range')
    if r.get('currency') not in ('USD','CNY'):raise Error('invalid_request:currency')
    if r.get('reversal_of') is not None and not identity(r['reversal_of']):raise Error('invalid_request:reversal_of')
    if set(r)-{'op_key','entry_id','customer_key','epoch','amount_minor','fee_minor','currency','reversal_of'}:raise Error('invalid_request:unknown_field')
    c.execute('BEGIN IMMEDIATE');v,e=current(c)
    if r['epoch']!=e:c.rollback();return {'status':'stale_epoch','current_epoch':e}
    if v!=2:raise Error('unsupported_schema')
    encoded=canonical(r);old=c.execute('SELECT command_json,result_json FROM write_receipts WHERE op_key=?',(r['op_key'],)).fetchone()
    if old:
        c.rollback();return {'status':'duplicate','receipt':json.loads(old[1])} if old[0]==encoded else {'status':'operation_conflict'}
    p=r.get('reversal_of');a=r['amount_minor']
    if p is None:
        if a<0:raise Error('invalid_reversal')
    else:
        parent=c.execute('SELECT customer_key,currency,amount_minor,reversal_of FROM entries WHERE entry_id=?',(p,)).fetchone()
        if a>=0 or parent is None or tuple(parent[:2])!=(r['customer_key'],r['currency']) or parent[2]<=0 or parent[3] is not None:raise Error('invalid_reversal')
        already=c.execute('SELECT coalesce(sum(amount_minor),0) FROM entries WHERE reversal_of=?',(p,)).fetchone()[0]
        if -already-a>parent[2]:raise Error('refund_exceeds')
    c.execute('INSERT INTO entries VALUES(?,?,?,?,?,?,NULL)',(r['entry_id'],r['customer_key'],r['currency'],a,p,r['fee_minor']))
    answer={'status':'accepted','entry_id':r['entry_id'],'epoch':e,'source_schema':2}
    c.execute('INSERT INTO write_receipts VALUES(?,?,?)',(r['op_key'],encoded,canonical(answer)))
    checkpoint('before_commit',pause,c);c.commit();checkpoint('after_commit',pause,c)
    return answer


def export(c):
    return {t:[dict(r) for r in c.execute('SELECT * FROM '+t)] for t in ('customers','customer_aliases','entries','quarantine','write_receipts','notes','schema_migrations','audit_events','control')}


def main():
    p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--request',type=Path,required=True);p.add_argument('--authority',type=Path,required=True);p.add_argument('--pause-at');a=p.parse_args()
    defect=Path(__file__).with_name('defect.txt').read_text().strip() if Path(__file__).with_name('defect.txt').exists() else 'none'
    r=read_request(a.request);action=r.get('action');c=connect(a.db)
    try:
        if action=='upgrade':answer=migrate(c,json.loads(a.authority.read_text(encoding='utf-8')),a.pause_at,defect)
        elif action=='write':answer=write(c,r['write'],a.pause_at)
        elif action=='receipt':
            row=c.execute('SELECT result_json FROM write_receipts WHERE op_key=?',(r['op_key'],)).fetchone();answer={'status':'ok','receipt':json.loads(row[0])} if row else {'status':'unknown_receipt'}
        elif action=='get':
            row=c.execute('SELECT * FROM entries WHERE entry_id=?',(r['entry_id'],)).fetchone();answer={'status':'ok','entry':dict(row)} if row else {'status':'unknown_entry'}
        elif action=='balance':
            rows=c.execute('SELECT customer_key,currency,sum(amount_minor) AS amount_minor,sum(fee_minor) AS fee_minor FROM entries GROUP BY customer_key,currency');answer={'status':'ok','balances':[dict(row) for row in rows]}
        elif action=='notes':answer={'status':'ok','notes':[dict(row) for row in c.execute('SELECT * FROM notes')]}
        elif action=='note':
            if not identity(r.get('note_id')) or not isinstance(r.get('text'),str):raise Error('invalid_request:note')
            c.execute('BEGIN IMMEDIATE');c.execute('INSERT INTO notes VALUES(?,?,?)',(r['note_id'],r['entry_id'],r['text']));c.commit();answer={'status':'accepted','note_id':r['note_id']}
        elif action=='status':v,e=current(c);answer={'status':'ok','version':v,'epoch':e}
        elif action=='recover':
            # The supplied old backup is evidence for a decision, never the live target.
            if defect=='restore_backup':
                c.close();b=connect(Path(r['backup']));dst=connect(a.db);b.backup(dst);b.close();dst.close();c=connect(a.db);answer={'status':'restored_backup'}
            else:
                b=connect(Path(r['backup']));backup_keys={x[0] for x in b.execute('SELECT op_key FROM write_receipts')};b.close()
                live_keys={x[0] for x in c.execute('SELECT op_key FROM write_receipts')};fees=c.execute('SELECT coalesce(sum(fee_minor),0) FROM entries').fetchone()[0]
                c.execute('BEGIN IMMEDIATE');c.execute('CREATE INDEX IF NOT EXISTS entries_customer_currency ON entries(customer_key,currency)');c.commit()
                answer={'status':'forward_repaired','decision':'retain_v2','backup_missing_ack_keys':sorted(live_keys-backup_keys),'fee_minor':fees,'integrity':c.execute('PRAGMA integrity_check').fetchone()[0]}
        elif action=='export':answer={'status':'ok','tables':export(c)}
        else:raise Error('invalid_request:action')
    except Error as e:c.rollback();answer={'status':str(e)}
    except sqlite3.IntegrityError as e:c.rollback();answer={'status':'constraint_error','sqlite_errorname':e.sqlite_errorname}
    finally:c.close()
    print(canonical(answer),flush=True)


if __name__=='__main__':main()
