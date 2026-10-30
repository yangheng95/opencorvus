"""Complete constructive L05 application; input history is preserved, no legacy runtime fallback."""
import json
import http.client
from pathlib import Path
import sqlite3
import sys
import urllib.parse
import uuid
from contextlib import contextmanager

from l05_transport import request
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
        if sys.stdin.readline()!='\n':raise ValueError('checkpoint_release_required')


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


@contextmanager
def connect(db):
    c = sqlite3.connect(db, timeout=20, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA synchronous=FULL")
    try:
        yield c
    finally:
        c.close()


def initialize(db):
    with connect(db) as c:c.executescript('BEGIN IMMEDIATE;\n        CREATE TABLE IF NOT EXISTS control(id INTEGER PRIMARY KEY CHECK(id=1), epoch INTEGER NOT NULL, active INTEGER NOT NULL);\n        INSERT OR IGNORE INTO control VALUES(1,1,1);\n        CREATE TABLE IF NOT EXISTS journal(seq INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, request_id TEXT NOT NULL,\n          event_id TEXT NOT NULL, revision INTEGER NOT NULL, kind TEXT NOT NULL, amount_minor INTEGER NOT NULL,\n          payload TEXT NOT NULL, UNIQUE(tenant,request_id));\n        CREATE TABLE IF NOT EXISTS opening(tenant TEXT NOT NULL PRIMARY KEY, amount_minor INTEGER NOT NULL);\n        CREATE TABLE IF NOT EXISTS adjustments(tenant TEXT NOT NULL, adjustment_id TEXT NOT NULL, amount_minor INTEGER NOT NULL,\n          approval TEXT NOT NULL, PRIMARY KEY(tenant,adjustment_id));\n        CREATE TABLE IF NOT EXISTS notes(tenant TEXT NOT NULL, note_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,note_id));\n        CREATE TABLE IF NOT EXISTS projection(tenant TEXT NOT NULL,event_id TEXT NOT NULL,revision INTEGER NOT NULL,\n          status TEXT NOT NULL,amount_minor INTEGER NOT NULL,PRIMARY KEY(tenant,event_id));\n        CREATE TABLE IF NOT EXISTS legacy_seen(event_id TEXT NOT NULL PRIMARY KEY);\n        CREATE TABLE IF NOT EXISTS postings(seq INTEGER PRIMARY KEY AUTOINCREMENT,tenant TEXT NOT NULL,event_id TEXT NOT NULL,\n          payload TEXT NOT NULL,source_kind TEXT NOT NULL,source_id TEXT NOT NULL,boundary_seq INTEGER NOT NULL,\n          epoch INTEGER NOT NULL,receipt_id TEXT,UNIQUE(tenant,event_id));\n        \nCREATE TABLE IF NOT EXISTS repair_cuts(repair_id TEXT PRIMARY KEY,epoch INTEGER NOT NULL,boundary_seq INTEGER NOT NULL,snapshot_json TEXT NOT NULL,phase TEXT NOT NULL,completed_epoch INTEGER);\nCREATE TABLE IF NOT EXISTS samples(window_id TEXT PRIMARY KEY,pending INTEGER NOT NULL,total INTEGER NOT NULL,pending_ratio TEXT NOT NULL,conflicts INTEGER NOT NULL,mismatched_sources INTEGER NOT NULL,active_json TEXT NOT NULL);\nCREATE TABLE IF NOT EXISTS alerts(window_id TEXT NOT NULL,alarm TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(window_id,alarm));\nCOMMIT;')


def validate_event(e):
    if not isinstance(e, dict) or set(e) != {"tenant", "request_id", "event_id", "revision", "kind", "amount_minor"}:
        return "fields"
    for key in ("tenant", "request_id", "event_id"):
        if not identity(e[key]):
            return key
    if type(e["revision"]) is not int or not 1 <= e["revision"] <= 10**6:
        return "revision"
    if type(e["amount_minor"]) is not int or not 0 <= e["amount_minor"] <= 10**9:
        return "amount_minor"
    if e["kind"] not in ("settle", "cancel") or (e["kind"] == "cancel" and e["amount_minor"] != 0):
        return "kind"


def control_error(c, epoch):
    row = c.execute("SELECT epoch,active FROM control WHERE id=1").fetchone()
    if type(epoch) is not int or epoch != row["epoch"]:
        return {"status": "stale_epoch", "epoch": row["epoch"]}
    if row["active"] != 1:
        return {"status": "paused", "epoch": row["epoch"]}


def append_posting(c, tenant, source_kind, source_id, amount, parent=None):
    if amount == 0:
        raise ValueError("zero_posting")
    key = "p" + uuid.uuid4().hex
    wire = {"tenant": tenant, "event_id": key, "kind": "post" if amount > 0 else "reversal",
            "amount_minor": amount, "reverses": parent}
    boundary = c.execute("SELECT COALESCE(MAX(seq),0) FROM journal").fetchone()[0]
    epoch = c.execute("SELECT epoch FROM control WHERE id=1").fetchone()[0]
    c.execute("INSERT INTO postings(tenant,event_id,payload,source_kind,source_id,boundary_seq,epoch) VALUES(?,?,?,?,?,?,?)",
              (tenant, key, canonical(wire), source_kind, source_id, boundary, epoch))
    return key


def fold(c):
    """Reference implementation; checker uses a separate relational reconstruction."""
    versions = {}
    for row in c.execute("SELECT tenant,event_id,revision,kind,amount_minor FROM journal"):
        key = row["tenant"], row["event_id"]
        revs = versions.setdefault(key, {})
        revs.setdefault(row["revision"], set()).add((row["kind"], row["amount_minor"]))
    result = {}
    for key, versions_for_key in versions.items():
        revision = max(versions_for_key)
        payloads = versions_for_key[revision]
        if DEFECT=='conflict_first' and len(payloads)>1:payloads={sorted(payloads)[0]}
        if len(payloads) != 1:
            result[key] = (revision, "quarantined", 0)
        else:
            kind, amount = next(iter(payloads))
            result[key] = (revision, kind, amount)
    return result


def replace_projection(c):
    values = fold(c)
    c.execute("DELETE FROM projection")
    c.executemany("INSERT INTO projection VALUES(?,?,?,?,?)", [(t, e, *v) for (t, e), v in values.items()])


def ingest(db, e, epoch):
    error = validate_event(e)
    if error:
        return {"status": "invalid_request", "field": error}
    checkpoint("before_accept_begin",e)
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        old = c.execute("SELECT seq,payload FROM journal WHERE tenant=? AND request_id=?", (e["tenant"], e["request_id"])).fetchone()
        if old:
            return {"status": "duplicate" if old["payload"] == canonical(e) else "transport_conflict", "seq": old["seq"]}
        if DEFECT=='global_transport' and c.execute('SELECT seq FROM journal WHERE request_id=?',(e['request_id'],)).fetchone():return {'status':'duplicate','seq':-1}
        error = control_error(c, epoch)
        if error:
            return error
        if c.execute("SELECT tenant FROM opening WHERE tenant=?", (e["tenant"],)).fetchone() is None:
            return {"status": "unknown_tenant"}
        seq = c.execute("INSERT INTO journal(tenant,request_id,event_id,revision,kind,amount_minor,payload) VALUES(?,?,?,?,?,?,?)",
                        (e["tenant"], e["request_id"], e["event_id"], e["revision"], e["kind"], e["amount_minor"], canonical(e))).lastrowid
        replace_projection(c)
        c.commit()
    checkpoint("after_accept_commit",e)
    return {"status": "accepted", "seq": seq}


def add_adjustment(db, tenant, adjustment_id, amount, approval, epoch):
    if not identity(tenant) or not identity(adjustment_id) or type(amount) is not int or not -10**9 <= amount <= 10**9 or not isinstance(approval, str) or not approval:
        return {"status": "invalid_adjustment"}
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        old = c.execute("SELECT amount_minor,approval FROM adjustments WHERE tenant=? AND adjustment_id=?", (tenant, adjustment_id)).fetchone()
        if old:
            return {"status": "duplicate" if tuple(old) == (amount, approval) else "adjustment_conflict"}
        error = control_error(c, epoch)
        if error:
            return error
        opening = c.execute("SELECT amount_minor FROM opening WHERE tenant=?", (tenant,)).fetchone()
        negative = sum(r[0] for r in c.execute("SELECT amount_minor FROM adjustments WHERE tenant=? AND amount_minor<0", (tenant,)))
        if opening is None or opening[0] + negative + min(0, amount) < 0:
            return {"status": "adjustment_out_of_domain"}
        c.execute("INSERT INTO adjustments VALUES(?,?,?,?)", (tenant, adjustment_id, amount, approval))
        c.commit()
    return {"status": "approved"}


def deliver_one(db, url, tenant, key):
    with connect(db) as c:
        row = c.execute("SELECT * FROM postings WHERE tenant=? AND event_id=?", (tenant, key)).fetchone()
        try:
            wire = decode_wire(row["payload"])
        except Invalid as error:
            raise ValueError("local_posting_wire_invalid:" + str(error)) from error
        if wire["tenant"] != tenant or wire["event_id"] != key:
            raise ValueError("local_posting_identity_mismatch")
    if row['receipt_id'] is None:checkpoint('before_http',{'tenant':tenant,'event_id':key})
    if DEFECT=='early_sent':
        with connect(db) as c:c.execute('UPDATE postings SET receipt_id=COALESCE(receipt_id,?) WHERE tenant=? AND event_id=?',('assumed',tenant,key))
        return {'status':'confirmed','event_id':key}
    try:
        code, result = request(url + "/effects?" + urllib.parse.urlencode({"tenant": wire["tenant"], "event_id": key}))
        if DEFECT=='ack_new_key' and row['receipt_id'] is None and code==200:
            wire=dict(wire,event_id='wrong'+uuid.uuid4().hex);code,result=request(url+'/effects',wire)
        if code == 404 and result["status"] == "unknown":
            code, result = request(url + "/effects", wire)
    except (OSError, ConnectionError, http.client.RemoteDisconnected,TimeoutError):
        return {"status": "transport_unknown", "event_id": key}
    if result.get("status") not in ("applied", "replayed", "found"):
        raise ValueError("remote_rejected:" + canonical(result))
    receipt = result["receipt"]
    if not receipt.get("receipt_id") or any(receipt.get(k) != v for k, v in wire.items()):
        raise ValueError("receipt_conflict")
    if row['receipt_id'] is None:checkpoint('after_remote_receipt_before_confirm',{'tenant':tenant,'event_id':key,'receipt':receipt})
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("UPDATE postings SET receipt_id=? WHERE tenant=? AND event_id=?", (receipt["receipt_id"], wire["tenant"], key))
        c.commit()
    return {"status": "confirmed", "event_id": key, "receipt": receipt}


def settle_all(db, url):
    with connect(db) as c:
        keys = [tuple(r) for r in c.execute("SELECT tenant,event_id FROM postings ORDER BY seq")]
    for tenant, key in keys:
        result = deliver_one(db, url, tenant, key)
        if result['status']=='transport_unknown':result=deliver_one(db,url,tenant,key)
        if result["status"] != "confirmed":
            raise ValueError("old_intent_unresolved:" + key)


def targets(c):
    result = {(r["tenant"], "opening", "opening"): r["amount_minor"] for r in c.execute("SELECT * FROM opening")}
    result.update({(t, "business", e): v[2] for (t, e), v in fold(c).items()})
    result.update({(r["tenant"], "adjustment", r["adjustment_id"]): r["amount_minor"] for r in c.execute("SELECT * FROM adjustments")})
    return result


def plan(db, *, parent_policy="oldest",repair_id=None):
    with connect(db) as c:
        c.execute("BEGIN IMMEDIATE")
        desired, contributed, wires = targets(c), {}, []
        for row in c.execute("SELECT * FROM postings ORDER BY seq"):
            wire = json.loads(row["payload"])
            source = row["tenant"], row["source_kind"], row["source_id"]
            contributed[source] = contributed.get(source, 0) + wire["amount_minor"]
            wires.append(wire)
        deltas = {k: desired.get(k, 0) - contributed.get(k, 0) for k in desired.keys() | contributed.keys()}
        for (tenant, kind, identity), difference in sorted(deltas.items()):
            if difference > 0:
                remaining = difference
                while remaining:
                    piece = min(remaining, 10**12)
                    key = append_posting(c, tenant, kind, identity, piece)
                    wires.append({"tenant": tenant, "event_id": key, "amount_minor": piece, "kind": "post", "reverses": None})
                    remaining -= piece
        residual = {(w["tenant"], w["event_id"]): w["amount_minor"] for w in wires if w["kind"] == "post"}
        for w in wires:
            if w["kind"] == "reversal":
                residual[w["tenant"], w["reverses"]] += w["amount_minor"]
        parents = list(residual)
        if parent_policy == "newest":
            parents.reverse()
        elif parent_policy != "oldest":
            raise ValueError("parent_policy")
        for (tenant, kind, identity), difference in sorted(deltas.items()):
            remaining = max(0, -difference)
            for parent in parents:
                if parent[0] != tenant or remaining == 0:
                    continue
                piece = min(remaining, residual[parent])
                if piece:
                    append_posting(c, tenant, kind, identity, -piece, parent[1])
                    residual[parent] -= piece
                    remaining -= piece
            if remaining:
                raise ValueError("unreachable_account_domain")
        replace_projection(c)
        if repair_id is not None:c.execute("UPDATE repair_cuts SET phase='planned' WHERE repair_id=?",(repair_id,))
        c.commit()
    checkpoint('after_plan_commit',{'repair_id':repair_id})


def pause(db,epoch,repair_id):
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
