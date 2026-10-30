"""Faithful extracted historical entry, including its global business-id seen index."""
import argparse,json,sqlite3,sys,os,urllib.parse,http.client
from pathlib import Path
from l05_transport import request
def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def main():
    p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--url',required=True);p.add_argument('--request',type=Path,required=True);p.add_argument('--pause-at');a=p.parse_args();r=json.loads(a.request.read_text(encoding='utf-8'));c=sqlite3.connect(a.db,isolation_level=None,timeout=20);c.row_factory=sqlite3.Row
    try:
        if r['action']=='send':
            row=c.execute('SELECT * FROM postings WHERE tenant=? AND event_id=?',(r['tenant'],r['event_id'])).fetchone();wire=json.loads(row['payload'])
            code,result=request(a.url+'/effects',wire)
            if result.get('status') in ('applied','replayed'):
                c.execute('UPDATE postings SET receipt_id=? WHERE tenant=? AND event_id=?',(result['receipt']['receipt_id'],r['tenant'],r['event_id']))
            out={'status':'sent','http_code':code,'result':result}
        else:
            e=r['event'];c.execute('BEGIN IMMEDIATE');old=c.execute('SELECT seq,payload FROM journal WHERE tenant=? AND request_id=?',(e['tenant'],e['request_id'])).fetchone()
            if old:out={'status':'duplicate' if old['payload']==canonical(e) else 'transport_conflict','seq':old['seq']}
            else:
                state=c.execute('SELECT epoch,active FROM control').fetchone()
                if r['epoch']!=state['epoch']:out={'status':'stale_epoch','epoch':state['epoch']}
                elif not state['active']:out={'status':'paused','epoch':state['epoch']}
                else:
                    seq=c.execute('INSERT INTO journal(tenant,request_id,event_id,revision,kind,amount_minor,payload) VALUES(?,?,?,?,?,?,?)',(*[e[k] for k in ('tenant','request_id','event_id','revision','kind','amount_minor')],canonical(e))).lastrowid
                    if c.execute('SELECT 1 FROM legacy_seen WHERE event_id=?',(e['event_id'],)).fetchone() is None:
                        c.execute('INSERT INTO legacy_seen VALUES(?)',(e['event_id'],));c.execute('INSERT INTO projection VALUES(?,?,?,?,?)',(e['tenant'],e['event_id'],e['revision'],e['kind'],e['amount_minor']))
                        if e['amount_minor']:
                            key='legacy-'+str(seq);wire={'tenant':e['tenant'],'event_id':key,'kind':'post','amount_minor':e['amount_minor'],'reverses':None}
                            c.execute('INSERT INTO postings(tenant,event_id,payload,source_kind,source_id,boundary_seq,epoch) VALUES(?,?,?,?,?,?,?)',(e['tenant'],key,canonical(wire),'business',e['event_id'],seq,r['epoch']))
                    c.commit();out={'status':'accepted','seq':seq}
    except (OSError,ConnectionError,http.client.RemoteDisconnected) as e:out={'status':'transport_unknown','error_type':type(e).__name__}
    finally:c.close()
    print(json.dumps(out,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
