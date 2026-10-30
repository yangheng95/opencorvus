"""Author construction from the retired scene witness; current runtime is app.py only."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=(ROOT/'scene-source/scene_app.py').read_text(encoding='utf-8')
start=s.index('sys.path.insert(');end=s.index('\n\ndef canonical',start)
s=s[:start]+'''from l05_transport import request
from l05_effects import identity, decode as decode_wire, Invalid
import argparse,os

PAUSE=None
PAUSED=False
DEFECT='none'
def checkpoint(name,detail=None):
    global PAUSED
    if PAUSE==name and not PAUSED:
        PAUSED=True
        print(json.dumps({'event':'checkpoint','name':name,'pid':os.getpid(),'detail':detail}),flush=True)
        if sys.stdin.readline()!='\\n':raise ValueError('checkpoint_release_required')
'''+s[end:]
start=s.index('def initialize(');end=s.index('\n\ndef validate_event',start)
original=(ROOT/'scene-source/scene_app.py').read_text(encoding='utf-8');sql=original.split('c.executescript("""',1)[1].split('""")',1)[0]
sql=sql.replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ').replace('INSERT INTO control VALUES','INSERT OR IGNORE INTO control VALUES')
sql+='''
CREATE TABLE IF NOT EXISTS repair_cuts(repair_id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,boundary_seq INTEGER NOT NULL,snapshot_json TEXT NOT NULL,phase TEXT NOT NULL,completed_epoch INTEGER);
CREATE TABLE IF NOT EXISTS samples(window_id TEXT PRIMARY KEY,pending INTEGER NOT NULL,total INTEGER NOT NULL,pending_ratio TEXT NOT NULL,conflicts INTEGER NOT NULL,mismatched_sources INTEGER NOT NULL,active_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS alerts(window_id TEXT NOT NULL,alarm TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(window_id,alarm));
'''
s=s[:start]+'def initialize(db):\n    with connect(db) as c:c.executescript('+repr('BEGIN IMMEDIATE;'+sql+'COMMIT;')+')\n'+s[end:]
s=s.replace('def ingest(db, e, epoch, *, legacy_fixture=False):','def ingest(db, e, epoch):')
start=s.index('        if legacy_fixture:');end=s.index('        c.commit()',start)
s=s[:start]+'        replace_projection(c)\n'+s[end:]
s=s.replace('    with connect(db) as c:\n        c.execute("BEGIN IMMEDIATE")\n        old = c.execute("SELECT seq,payload', '    checkpoint("before_accept_begin",e)\n    with connect(db) as c:\n        c.execute("BEGIN IMMEDIATE")\n        old = c.execute("SELECT seq,payload',1)
s=s.replace('    return {"status": "accepted", "seq": seq}','    checkpoint("after_accept_commit",e)\n    return {"status": "accepted", "seq": seq}',1)
s=s.replace('WHERE tenant=? AND request_id=?", (e["tenant"], e["request_id"])).fetchone()', 'WHERE tenant=? AND request_id=?", (e["tenant"], e["request_id"])).fetchone()',1)
needle='        error = control_error(c, epoch)\n        if error:\n            return error\n        if c.execute("SELECT tenant FROM opening'
s=s.replace(needle,'''        if DEFECT=='global_transport' and c.execute('SELECT seq FROM journal WHERE request_id=?',(e['request_id'],)).fetchone():return {'status':'duplicate','seq':-1}
'''+needle,1)
s=s.replace('        revision = max(versions_for_key)','        revision = max(versions_for_key)',1)
s=s.replace('        if len(payloads) != 1:',"        if DEFECT=='conflict_first' and len(payloads)>1:payloads={sorted(payloads)[0]}\n        if len(payloads) != 1:",1)
s=s.replace('    try:\n        code, result = request(url + "/effects?"', '''    if row['receipt_id'] is None:checkpoint('before_http',{'tenant':tenant,'event_id':key})
    if DEFECT=='early_sent':
        with connect(db) as c:c.execute('UPDATE postings SET receipt_id=COALESCE(receipt_id,?) WHERE tenant=? AND event_id=?',('assumed',tenant,key))
        return {'status':'confirmed','event_id':key}
    try:
        code, result = request(url + "/effects?"''',1)
s=s.replace('        if code == 404 and result["status"] == "unknown":','''        if DEFECT=='ack_new_key' and row['receipt_id'] is None and code==200:
            wire=dict(wire,event_id='wrong'+uuid.uuid4().hex);code,result=request(url+'/effects',wire)
        if code == 404 and result["status"] == "unknown":''',1)
s=s.replace('except (OSError, ConnectionError, http.client.RemoteDisconnected):','except (OSError, ConnectionError, http.client.RemoteDisconnected,TimeoutError):',1)
s=s.replace('    with connect(db) as c:\n        c.execute("BEGIN IMMEDIATE")\n        c.execute("UPDATE postings SET receipt_id', '''    if row['receipt_id'] is None:checkpoint('after_remote_receipt_before_confirm',{'tenant':tenant,'event_id':key,'receipt':receipt})
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("UPDATE postings SET receipt_id''',1)
s=s.replace('        result = deliver_one(db, url, tenant, key)\n        if result["status"] != "confirmed":', '''        result = deliver_one(db, url, tenant, key)
        if result['status']=='transport_unknown':result=deliver_one(db,url,tenant,key)
        if result["status"] != "confirmed":''',1)
s=s.replace('def reconcile(db, url, *, parent_policy="oldest"):\n    settle_all(db, url)','def plan(db, *, parent_policy="oldest",repair_id=None):',1)
s=s.replace('        replace_projection(c)\n        c.commit()\n    settle_all(db, url)','''        replace_projection(c)
        if repair_id is not None:c.execute("UPDATE repair_cuts SET phase='planned' WHERE repair_id=?",(repair_id,))
        c.commit()
    checkpoint('after_plan_commit',{'repair_id':repair_id})''',1)
start=s.index('def pause(');s=s[:start]+'''def pause(db,epoch,repair_id):
    with connect(db) as c:
        c.execute('BEGIN IMMEDIATE')
        old=c.execute('SELECT * FROM repair_cuts WHERE repair_id=?',(repair_id,)).fetchone()
        if old:
            if old['epoch']!=epoch:return {'status':'repair_conflict'}
            return {'status':'repair_complete' if old['phase']=='complete' else 'already_paused','epoch':old['completed_epoch'] or epoch,'boundary_seq':old['boundary_seq'],'snapshot':json.loads(old['snapshot_json'])}
        error=control_error(c,epoch)
        if error:return error
        facts={t:[dict(x) for x in c.execute('SELECT * FROM '+t)] for t in ('journal','opening','adjustments','notes')}
        facts['intent_keys']=[dict(x) for x in c.execute('SELECT tenant,event_id,payload FROM postings ORDER BY seq')]
        boundary=max([x['seq'] for x in facts['journal']]+[0]);c.execute('UPDATE control SET active=0')
        c.execute('INSERT INTO repair_cuts VALUES(?,?,?,?,?,NULL)',(repair_id,epoch,boundary,canonical(facts),'paused'));c.commit()
    return {'status':'paused','epoch':epoch,'boundary_seq':boundary,'snapshot':facts}

def repair(db,url,epoch,repair_id,policy):
    started=pause(db,epoch,repair_id)
    if started['status']=='repair_complete':return started
    if started['status'] not in ('paused','already_paused'):return started
    with connect(db) as c:phase=c.execute('SELECT phase FROM repair_cuts WHERE repair_id=?',(repair_id,)).fetchone()[0]
    if phase=='paused':
        settle_all(db,url)
        with connect(db) as c:c.execute("UPDATE repair_cuts SET phase='settled' WHERE repair_id=?",(repair_id,))
        phase='settled'
    if phase=='settled':plan(db,parent_policy=policy,repair_id=repair_id)
    settle_all(db,url)
    with connect(db) as c:
        c.execute('BEGIN IMMEDIATE')
        if c.execute('SELECT COUNT(*) FROM postings WHERE receipt_id IS NULL').fetchone()[0]:return {'status':'unsettled_intents'}
        c.execute("UPDATE repair_cuts SET phase='complete',completed_epoch=? WHERE repair_id=?",(epoch+1,repair_id));c.execute('UPDATE control SET active=1,epoch=?',(epoch+1,));c.commit()
    return {'status':'resumed','epoch':epoch+1,'repair_id':repair_id}

def reconcile(db,url,policy):
    settle_all(db,url);plan(db,parent_policy=policy);settle_all(db,url);return {'status':'converged'}

def monitor(db,url,window):
    from fractions import Fraction
    with connect(db) as c:
        previous=c.execute('SELECT * FROM samples WHERE window_id=?',(window,)).fetchone()
        if previous:return {'status':'duplicate','sample':dict(previous)}
        postings=[dict(x) for x in c.execute('SELECT * FROM postings')];desired=targets(c);conflicts=sum(v[1]=='quarantined' for v in fold(c).values())
        last=c.execute('SELECT active_json FROM samples ORDER BY rowid DESC LIMIT 1').fetchone();old_active=set(json.loads(last[0])) if last else set()
    contributed={}
    for row in postings:
        code,result=request(url+'/effects?'+urllib.parse.urlencode({'tenant':row['tenant'],'event_id':row['event_id']}))
        if code==200:
            source=(row['tenant'],row['source_kind'],row['source_id']);contributed[source]=contributed.get(source,0)+result['receipt']['amount_minor']
    mismatch=sum(desired.get(k,0)!=contributed.get(k,0) for k in desired.keys()|contributed.keys());pending=sum(x['receipt_id'] is None for x in postings);n=len(postings)
    if DEFECT=='monitor_fake':pending=conflicts=mismatch=0
    active={name for name,value in [('pending',pending),('business_conflict',conflicts),('source_mismatch',mismatch)] if value}
    sample={'window_id':window,'pending':pending,'total':n,'pending_ratio':str(Fraction(pending,n)) if n else '0','conflicts':conflicts,'mismatched_sources':mismatch,'active_json':canonical(sorted(active))}
    transitions=[{'window_id':window,'alarm':name,'status':'still_active' if name in active and name in old_active else 'opened' if name in active else 'resolved' if name in old_active else 'clear'} for name in ('pending','business_conflict','source_mismatch')]
    with connect(db) as c:
        c.execute('BEGIN IMMEDIATE');c.execute('INSERT INTO samples VALUES(?,?,?,?,?,?,?)',tuple(sample.values()));c.executemany('INSERT INTO alerts VALUES(?,?,?)',[(x['window_id'],x['alarm'],x['status']) for x in transitions]);c.commit()
    return {'status':'ok','sample':sample,'transitions':transitions}

def note(db,r,epoch):
    if not identity(r.get('tenant')) or not identity(r.get('note_id')) or not isinstance(r.get('body'),str):return {'status':'invalid_note'}
    with connect(db) as c:
        c.execute('BEGIN IMMEDIATE');old=c.execute('SELECT body FROM notes WHERE tenant=? AND note_id=?',(r['tenant'],r['note_id'])).fetchone()
        if old:return {'status':'duplicate' if old[0]==r['body'] else 'note_conflict'}
        error=control_error(c,epoch)
        if error:return error
        c.execute('INSERT INTO notes VALUES(?,?,?)',(r['tenant'],r['note_id'],r['body']));c.commit();return {'status':'accepted'}

def main():
    global PAUSE,DEFECT
    p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--url',required=True);p.add_argument('--request',type=Path,required=True);p.add_argument('--input',type=Path,required=True);p.add_argument('--pause-at');a=p.parse_args();PAUSE=a.pause_at
    settings=json.loads(Path(__file__).with_name('settings.json').read_text(encoding='utf-8'));DEFECT=settings.get('defect','none');policy=settings.get('parent_policy','oldest');r=json.loads(a.request.read_text(encoding='utf-8'));initialize(a.db)
    try:
        action=r['action']
        if action=='init':out={'status':'initialized'}
        elif action=='ingest':out=ingest(a.db,r['event'],r['epoch'])
        elif action=='adjustment':out=add_adjustment(a.db,r['tenant'],r['adjustment_id'],r['amount_minor'],r['approval'],r['epoch'])
        elif action=='note':out=note(a.db,r,r['epoch'])
        elif action=='pause':out=pause(a.db,r['epoch'],r['repair_id'])
        elif action=='repair':out=repair(a.db,a.url,r['epoch'],r['repair_id'],policy)
        elif action=='resume':out={'status':'repair_incomplete'}
        elif action=='reconcile':out=reconcile(a.db,a.url,policy)
        elif action=='monitor':out=monitor(a.db,a.url,r['window_id'])
        elif action=='status':
            with connect(a.db) as c:out={'status':'ok','control':[dict(x) for x in c.execute('SELECT * FROM control')],'cuts':[dict(x) for x in c.execute('SELECT * FROM repair_cuts')]}
        else:out={'status':'invalid_action'}
        if DEFECT=='restore_backup' and action=='reconcile':
            with connect(a.db) as c:
                if c.execute('SELECT COUNT(*) FROM journal').fetchone()[0]>7:
                    with sqlite3.connect(a.input/'original-local.sqlite') as origin:origin.backup(c)
    except ValueError as e:out={'status':'operation_failed','error':str(e)}
    print(json.dumps(out,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
'''
start=s.index('def add_opening(');end=s.index('def add_adjustment(',start);s=s[:start]+s[end:]
s=s.replace('Constructive scene witness. Legacy entry is a fixture producer, not a fallback.','Complete constructive L05 application; input history is preserved, no legacy runtime fallback.')
(ROOT/'app.py').write_text(s,encoding='utf-8')
