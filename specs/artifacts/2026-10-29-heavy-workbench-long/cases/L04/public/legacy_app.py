"""Published local v1 application. Decimal text and epoch generation are its wire contract."""
import argparse,json,os,re,sqlite3,sys
from fractions import Fraction
from pathlib import Path

class Error(ValueError):pass
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True)
def identity(x):return isinstance(x,str) and bool(x.strip())
def minor(x):
    if not isinstance(x,str) or re.fullmatch(r'-?[0-9]+(?:\.[0-9]{1,2})?',x) is None:raise Error('amount_scale')
    value=Fraction(x)*100
    if value.denominator!=1 or not -(2**63)<=value<2**63:raise Error('amount_range')
    return int(value)
def read_request(path):
    def pairs(items):
        out={}
        for k,v in items:
            if k in out:raise Error('invalid_request:json')
            out[k]=v
        return out
    def constant(x):raise Error('invalid_request:json')
    x=json.loads(Path(path).read_text(encoding='utf-8'),object_pairs_hook=pairs,parse_constant=constant)
    if not isinstance(x,dict):raise Error('invalid_request:json')
    return x
def connect(path):
    c=sqlite3.connect(path,isolation_level=None,timeout=10);c.row_factory=sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON');c.execute('PRAGMA synchronous=FULL');return c
def checkpoint(name,requested,c):
    if name==requested:
        print(canonical({'event':'checkpoint','name':name,'pid':os.getpid(),'transaction_open':c.in_transaction}),flush=True)
        if sys.stdin.readline()!='\n':raise Error('checkpoint_release_required')
def execute(c,r,pause):
    action=r.get('action');v=c.execute('SELECT max(version) FROM schema_migrations').fetchone()[0];e=c.execute('SELECT epoch FROM control').fetchone()[0]
    if action=='status':return {'status':'ok','version':v,'epoch':e}
    if action=='notes':return {'status':'ok','notes':[dict(x) for x in c.execute('SELECT * FROM notes')]}
    if action=='receipt':
        row=c.execute('SELECT result_json FROM write_receipts WHERE op_key=?',(r['op_key'],)).fetchone();return {'status':'ok','receipt':json.loads(row[0])} if row else {'status':'unknown_receipt'}
    if action=='write':
        w=r['write']
        for f in ('op_key','entry_id'):
            if not identity(w.get(f)):raise Error('invalid_request:'+f)
        if type(w.get('epoch')) is not int or type(w.get('customer_id')) is not int:raise Error('invalid_request:integer')
        if not isinstance(w.get('amount'),str) or w.get('currency') not in ('USD','CNY'):raise Error('invalid_request:money')
        if w.get('reversal_of') is not None and not identity(w['reversal_of']):raise Error('invalid_request:reversal_of')
        checkpoint('before_begin',pause,c)
        c.execute('BEGIN IMMEDIATE');e=c.execute('SELECT epoch FROM control').fetchone()[0]
        if w['epoch']!=e:c.rollback();return {'status':'stale_epoch','current_epoch':e}
        if c.execute('SELECT max(version) FROM schema_migrations').fetchone()[0]!=1:raise Error('unsupported_schema')
        encoded=canonical(w);old=c.execute('SELECT command_json,result_json FROM write_receipts WHERE op_key=?',(w['op_key'],)).fetchone()
        if old:c.rollback();return {'status':'duplicate','receipt':json.loads(old[1])} if old[0]==encoded else {'status':'operation_conflict'}
        c.execute('INSERT INTO legacy_entries VALUES(?,?,?,?,?)',(w['entry_id'],w['customer_id'],w['currency'],w['amount'],w.get('reversal_of')))
        out={'status':'accepted','entry_id':w['entry_id'],'epoch':e,'source_schema':1};c.execute('INSERT INTO write_receipts VALUES(?,?,?)',(w['op_key'],encoded,canonical(out)))
        checkpoint('before_commit',pause,c);c.commit();checkpoint('after_commit',pause,c);return out
    if v!=1:raise Error('unsupported_schema')
    if action=='get':
        row=c.execute('SELECT * FROM legacy_entries WHERE entry_id=?',(r['entry_id'],)).fetchone();return {'status':'ok','entry':dict(row)} if row else {'status':'unknown_entry'}
    if action=='list':return {'status':'ok','entries':[dict(x) for x in c.execute('SELECT * FROM legacy_entries')]}
    raise Error('invalid_request:action')
def main():
    p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--request',type=Path,required=True);p.add_argument('--authority');p.add_argument('--pause-at');a=p.parse_args();c=connect(a.db)
    try:out=execute(c,read_request(a.request),a.pause_at)
    except Error as e:c.rollback();out={'status':str(e)}
    except sqlite3.IntegrityError as e:c.rollback();out={'status':'constraint_error','sqlite_errorname':e.sqlite_errorname}
    finally:c.close()
    print(canonical(out),flush=True)
if __name__=='__main__':main()
