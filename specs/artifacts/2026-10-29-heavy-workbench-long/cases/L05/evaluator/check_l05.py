"""Whole-case actual SQLite/receiver/request grader. No import of the author app."""
import argparse,json,sqlite3,sys,csv
from pathlib import Path
from fractions import Fraction
from decimal import Decimal,InvalidOperation
from collections import Counter
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'public'))
from logical_store import read,original,remote,CandidateDataError
from l05_effects import decode,Invalid
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def norm(rows):return sorted(json.dumps(x,ensure_ascii=False,sort_keys=True) for x in rows)
def canon(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def integer_value(x):
    try:
        value=Decimal(str(x))
        if not value.is_finite() or value.copy_abs()>Decimal(2**63-1) or value!=value.to_integral_value():raise ValueError('candidate_integer_export_invalid')
        return int(value)
    except (InvalidOperation,TypeError):raise ValueError('candidate_integer_export_invalid')
def input_identity(x):return canon({'local':{t:norm(rows) for t,rows in x['local'].items()},'remote_effects':norm(x['remote_effects']),'incoming':x['incoming']})
CORE=['journal','opening','adjustments','notes','projection','postings','control']
def native_identity_preflight(run):
    reg=load(run/'registration.json');name=reg['manifest']['logical_map']
    if load_payload(reg['source_files'][name])!=reg['logical_map']:raise ValueError('facility_source_map_binding_invalid')
    for event in load(run/'events.json'):
        if event.get('kind')!='application':continue
        try:header=json.loads(event['stderr'].splitlines()[0])
        except (ValueError,KeyError,IndexError,TypeError):raise ValueError('facility_native_identity_capture_invalid')
        if not isinstance(header,dict) or header.get('event')!='process_identity' or type(header.get('uid')) is not int or header['uid']!=10001 or type(header.get('pid')) is not int or header['pid']!=event['pid']:raise ValueError('facility_native_identity_capture_invalid')
    try:header=json.loads(load(run/'report-native.json')['stderr'].splitlines()[0])
    except (ValueError,KeyError,IndexError,TypeError):raise ValueError('facility_report_identity_capture_invalid')
    if not isinstance(header,dict) or header.get('event')!='process_identity' or type(header.get('uid')) is not int or header['uid']!=65534 or type(header.get('pid')) is not int or header['pid']<=0:raise ValueError('facility_report_identity_capture_invalid')
    isolation=load(run/'isolation.json')
    if isolation.get('owner_mode')!='0o700' or isolation.get('projection_mode')!='0o555' or isolation.get('file_modes')!=['0o444'] or isolation.get('actor_uid')!=10001 or isolation.get('report_uid')!=65534:raise ValueError('facility_execution_isolation_invalid')
def business(journal):
    c=sqlite3.connect(':memory:');c.execute('CREATE TABLE j(t TEXT,e TEXT,r INTEGER,k TEXT,a INTEGER)');c.executemany('INSERT INTO j VALUES(?,?,?,?,?)',[(x['tenant'],x['event_id'],x['revision'],x['kind'],x['amount_minor']) for x in journal])
    rows=c.execute('WITH m AS (SELECT t,e,max(r) r FROM j GROUP BY t,e),p AS (SELECT DISTINCT j.* FROM j JOIN m USING(t,e,r)) SELECT t,e,r,count(*),min(k),min(a) FROM p GROUP BY t,e,r').fetchall();c.close()
    return {(t,e):(rev,k if n==1 else 'quarantined',a if n==1 else 0) for t,e,rev,n,k,a in rows}
def desired(facts):
    b=business(facts['journal']);out={(x['tenant'],'opening','opening'):x['amount_minor'] for x in facts['opening']};out.update({(x['tenant'],'adjustment',x['adjustment_id']):x['amount_minor'] for x in facts['adjustments']});out.update({(t,'business',e):v[2] for (t,e),v in b.items()});return out
def authority(raw,events,late):
    init=original(raw/'original-local.sqlite');out={k:[dict(x) for x in init[k]] for k in ('journal','opening','adjustments','notes')}
    if not late:return out
    bykey={(x['tenant'],x['request_id']):x for x in out['journal']}
    for event in events:
        if event.get('kind')!='application' or event.get('legacy'):continue
        request=event['request'];response=event.get('response') or {};action=request['action']
        if action=='ingest' and (response.get('status') in ('accepted','duplicate') or event.get('intentional_process_fault') and event.get('pause')=='after_accept_commit'):
            x=request['event'];key=(x['tenant'],x['request_id'])
            if key in bykey:continue
            seq=response.get('seq')
            if seq is None:
                rows=event.get('checkpoint_sql',{}).get('local',{}).get('journal',[]);match=[r for r in rows if (r['tenant'],r['request_id'])==key];seq=match[0]['seq'] if len(match)==1 else -1
            bykey[key]={'seq':seq,**x,'payload':canon(x)}
        if action=='adjustment' and response.get('status') in ('approved','duplicate'):
            row={k:request[k] for k in ('tenant','adjustment_id','amount_minor','approval')}
            if row not in out['adjustments']:out['adjustments'].append(row)
        if action=='note' and response.get('status') in ('accepted','duplicate'):
            row={k:request[k] for k in ('tenant','note_id','body')}
            if row not in out['notes']:out['notes'].append(row)
    out['journal']=list(bykey.values());return out
class F:
    def __init__(self):self.d={f'M{i:02}':[] for i in range(1,16)}
    def add(self,key,ok,evidence,details=None):self.d[key].append({'status':'verified_pass' if ok else 'verified_fail','evidence':evidence,'details':details})
    def block(self,key,evidence):self.d[key].append({'status':'blocked','evidence':evidence})
    def result(self):
        out={}
        for k,items in self.d.items():
            states=[x['status'] for x in items];out[k]={'status':'verified_fail' if 'verified_fail' in states else 'blocked' if 'blocked' in states else 'verified_pass' if items else 'unassessed','findings':items}
        return out
def logical_equal(actual,wanted,table):
    if table!='journal':return norm(actual)==norm(wanted)
    def n(row):
        x=dict(row);x['payload']=load_payload(x['payload']);return x
    return norm([n(x) for x in actual])==norm([n(x) for x in wanted])
def load_payload(x):return json.loads(x)
def assess_stage(local,receiver,expected,initial_local,initial_remote,f,evidence,cut_keys):
    f.add('M02',all(logical_equal(local[t],expected[t],t) for t in ('journal','opening','adjustments','notes')),evidence)
    b=business(expected['journal']);projection={(x['tenant'],x['event_id']):(x['revision'],x['status'],x['amount_minor']) for x in local['projection']};f.add('M04',projection==b and len(projection)==len(local['projection']),evidence)
    want=desired(expected);postings=local['postings'];effects=receiver['effects'];remote_map={(x['tenant'],x['event_id']):x for x in effects};local_map={(x['tenant'],x['event_id']):x for x in postings};contrib={};wire_ok=True;source_ok=True
    for x in postings:
        try:w=decode(x['payload'])
        except Invalid:wire_ok=False;continue
        key=(x['tenant'],x['event_id']);actual=remote_map.get(key);source=(x['tenant'],x['source_kind'],x['source_id'])
        wire_ok=wire_ok and w['tenant']==x['tenant'] and w['event_id']==x['event_id'] and actual is not None and all(type(actual.get(k)) is type(v) and actual.get(k)==v for k,v in w.items()) and actual['receipt_id']==x['receipt_id']
        initial_boundary=max([r['seq'] for r in initial_local['journal']]+[0]);old_keys={(r['tenant'],r['event_id']) for r in initial_local['postings']}
        source_ok=source_ok and source in want and type(x['epoch']) is int and x['epoch'] in (1,2) and type(x['boundary_seq']) is int and 0<=x['boundary_seq']<=max([r['seq'] for r in expected['journal']]+[0])
        if key not in old_keys:
            source_ok=source_ok and (x['epoch']==1 and x['boundary_seq']==initial_boundary and key in cut_keys and source in desired(initial_local) or x['epoch']==2 and x['boundary_seq']>=initial_boundary)
        if x['source_kind']=='business':source_ok=source_ok and any(r['tenant']==x['tenant'] and r['event_id']==x['source_id'] and r['seq']<=x['boundary_seq'] for r in expected['journal'])
        if actual:contrib[source]=contrib.get(source,0)+actual['amount_minor']
    f.add('M05',all(contrib.get(k,0)==want.get(k,0) for k in want.keys()|contrib.keys()),evidence,{'desired':[list(k)+[v] for k,v in sorted(want.items())]})
    old_ok=True
    for old in initial_local['postings']:
        x=local_map.get((old['tenant'],old['event_id']));old_ok=old_ok and x is not None and all(x[k]==v for k,v in old.items() if k!='receipt_id') and (old['receipt_id'] is None or old['receipt_id']==x['receipt_id'])
    old_remote={(x['tenant'],x['event_id']):x for x in initial_remote['effects']};f.add('M06',source_ok and old_ok and all(remote_map.get(k)==x for k,x in old_remote.items()) and len(local_map)==len(postings),evidence)
    f.add('M07',wire_ok and set(remote_map)==set(local_map) and len(remote_map)==len(effects),evidence)
    funding=True
    for x in effects:
        if x['kind']=='reversal':
            p=remote_map.get((x['tenant'],x['reverses']));funding=funding and p is not None and p['kind']=='post' and type(x['amount_minor']) is int and x['amount_minor']<0
        else:
            funding=funding and x['kind']=='post' and x['amount_minor']>0 and x['reverses'] is None and x['amount_minor']+sum(y['amount_minor'] for y in effects if y['tenant']==x['tenant'] and y['kind']=='reversal' and y['reverses']==x['event_id'])>=0
    f.add('M08',funding,evidence)
def monitoring(run,events,mapping,f):
    try:main_local=read(run/'local.sqlite',mapping,['samples','alerts'])
    except CandidateDataError as e:f.add('M12',False,str(run/'local.sqlite'),str(e));return
    old_active=set();empty=read(run/'empty-monitor.sqlite',mapping,['samples','alerts']) if (run/'empty-monitor.sqlite').exists() else None
    for event in events:
        if event.get('kind')!='application' or event['request']['action']!='monitor':continue
        before=event['monitor_before'];local=before['local'];effects={(x['tenant'],x['event_id']):x for x in before['remote']['effects']};want=desired(local);contrib={}
        for x in local['postings']:
            effect=effects.get((x['tenant'],x['event_id']))
            if effect:
                k=(x['tenant'],x['source_kind'],x['source_id']);contrib[k]=contrib.get(k,0)+effect['amount_minor']
        p=sum(x['receipt_id'] is None for x in local['postings']);n=len(local['postings']);conflicts=sum(v[1]=='quarantined' for v in business(local['journal']).values());mismatch=sum(want.get(k,0)!=contrib.get(k,0) for k in want.keys()|contrib.keys());active={k for k,v in [('pending',p),('business_conflict',conflicts),('source_mismatch',mismatch)] if v};window=event['request']['window_id'];previous=set() if window=='empty' else old_active
        expected={'window_id':window,'pending':p,'total':n,'conflicts':conflicts,'mismatched_sources':mismatch};response=event.get('response') or {};sample=response.get('sample',{});transitions=[{'window_id':window,'alarm':name,'status':'still_active' if name in active and name in previous else 'opened' if name in active else 'resolved' if name in previous else 'clear'} for name in ('pending','business_conflict','source_mismatch')]
        try:
            active_value=json.loads(sample['active_json'])
            ok=all(type(sample.get(k)) is type(v) and sample.get(k)==v for k,v in expected.items()) and isinstance(sample.get('pending_ratio'),str) and Fraction(sample['pending_ratio'])==(Fraction(p,n) if n else 0) and type(active_value) is list and all(isinstance(x,str) for x in active_value) and set(active_value)==active and norm(response['transitions'])==norm(transitions)
        except (ValueError,KeyError,TypeError,ZeroDivisionError):ok=False
        persistent=empty if window=='empty' else main_local
        ok=ok and persistent is not None and any(x==sample for x in persistent['samples']) and norm([x for x in persistent['alerts'] if x['window_id']==window])==norm(transitions)
        after=event.get('monitor_after')
        if after is None:
            if not ok:f.add('M12',False,str(run/'events.json'),{'window':window,'expected':expected})
            f.block('M12','original run predates post-monitor observation; do not fabricate past isolation facts')
        else:
            ok=ok and all(norm(local[t])==norm(after['local'][t]) for t in ('journal','opening','adjustments','notes','projection','postings','control','repair_cuts')) and norm(before['remote']['effects'])==norm(after['remote']['effects'])
            f.add('M12',ok,str(run/'events.json'),{'window':window,'expected':expected})
        old_active=active if window!='empty' else old_active
def assess(run,raw,f):
    reg=load(run/'registration.json');mapping=reg['logical_map'];events=load(run/'events.json');state=load(run/'run.json');report=load(run/'report-native.json');orig=original(raw/'original-local.sqlite');oldremote=remote(raw/'original-remote.sqlite')
    f.add('M01',state['status']=='executed' and report['exit_code']==0 and all(x.get('exit_code')==0 or x.get('intentional_process_fault') and x.get('exit_code',0)!=0 for x in events if x.get('kind')=='application'),str(run/'run.json'))
    apps=[x for x in events if x.get('kind')=='application'];faults=[x for x in apps if x.get('intentional_process_fault')];receipt_fault=next((x for x in faults if x['pause']=='after_remote_receipt_before_confirm'),None);plan_fault=next((x for x in faults if x['pause']=='after_plan_commit'),None);cut_keys={(x['tenant'],x['event_id']) for x in plan_fault['checkpoint_sql']['local']['postings']} if plan_fault else set()
    for stage,late in [('repaired-incident',False),('repaired-current',True),('final',True)]:
        folder=run/stage
        if not folder.exists():
            for key in ('M02','M04','M05','M06','M07','M08'):f.block(key,str(folder))
            continue
        local=read(folder/'local.sqlite',mapping,CORE);receiver=remote(folder/'remote.sqlite');assess_stage(local,receiver,authority(raw,events,late),orig,oldremote,f,str(folder),cut_keys)
    actual=read(run/'local.sqlite',mapping,CORE);actual_remote=remote(run/'remote.sqlite')
    if state['status']=='executed':assess_stage(actual,actual_remote,authority(raw,events,True),orig,oldremote,f,str(run/'local.sqlite'),cut_keys)
    else:
        known={(x['tenant'],x['event_id']):x for x in actual_remote['effects']};local_keys={(x['tenant'],x['event_id']) for x in actual['postings']}
        for row in actual['postings']:
            if row['receipt_id'] is None:continue
            try:
                wire=decode(row['payload']);effect=known.get((row['tenant'],row['event_id']));valid=effect is not None and effect['receipt_id']==row['receipt_id'] and all(type(effect.get(k)) is type(v) and effect.get(k)==v for k,v in wire.items())
            except Invalid:valid=False
            if not valid:f.add('M07',False,str(run/'local.sqlite'),{'error':'observed_confirmed_receipt_mismatch','identity':[row['tenant'],row['event_id']]})
        if set(known)-local_keys:f.add('M07',False,str(run/'remote.sqlite'),{'error':'observed_remote_effect_unaccounted','identities':[list(x) for x in sorted(set(known)-local_keys)]})
    twins=[x for x in apps if x.get('pause')=='before_accept_begin']
    if len(twins)<2 and state['status']!='executed':f.block('M03','acceptance competition not reached')
    else:f.add('M03',len(twins)==2 and len({x['pid'] for x in twins})==2 and {x.get('response',{}).get('status') for x in twins}=={'accepted','duplicate'} and len({x.get('response',{}).get('seq') for x in twins})==1,str(run/'events.json'))
    for event in apps:
        response=event.get('response') or {}
        if event['request']['action']=='ingest' and response.get('status') in ('accepted','duplicate'):f.add('M03',type(response.get('seq')) is int and response['seq']>0,str(run/'events.json'))
    paused=[x for x in apps if x['request']['action']=='pause']
    try:cut=next((x for x in read(run/'local.sqlite',mapping,['repair_cuts'])['repair_cuts'] if x['repair_id']=='incident'),None)
    except CandidateDataError:cut=None
    cut_ok=cut is not None
    if cut:
        snap=json.loads(cut['snapshot_json']);cut_ok=cut['phase']=='complete' and cut['completed_epoch']==2 and all(norm(snap[t])==norm(orig[t]) for t in ('journal','opening','adjustments','notes')) and norm(snap['intent_keys'])==norm([{k:x[k] for k in ('tenant','event_id','payload')} for x in orig['postings']]) and actual['control']==[{'id':1,'epoch':2,'active':1}]
    f.add('M09',cut_ok and len(paused)==1 and paused[0]['response']['status']=='paused' and any(x['request']['action']=='resume' and x['response']['status']=='repair_incomplete' for x in apps),str(run/'local.sqlite'))
    plan_ok=plan_fault is not None and receipt_fault is not None
    if plan_ok and (run/'repaired-incident/local.sqlite').exists():
        planned=plan_fault['checkpoint_sql']['local']['postings'];finished=read(run/'repaired-incident/local.sqlite',mapping,['postings'])['postings'];finished_map={(x['tenant'],x['event_id']):x for x in finished};plan_ok={(x['tenant'],x['event_id']) for x in planned}==set(finished_map)
        for row in planned:
            after=finished_map.get((row['tenant'],row['event_id']))
            plan_ok=plan_ok and after is not None and all(canon(load_payload(after[k]))==canon(load_payload(v)) if k=='payload' else type(after[k]) is type(v) and after[k]==v for k,v in row.items() if k!='receipt_id') and (row['receipt_id'] is None or after['receipt_id']==row['receipt_id'])
        detail=receipt_fault['checkpoint']['detail'];rr=next((x for x in receipt_fault['checkpoint_sql']['remote']['effects'] if x['tenant']==detail['tenant'] and x['event_id']==detail['event_id']),None);lr=next((x for x in receipt_fault['checkpoint_sql']['local']['postings'] if x['tenant']==detail['tenant'] and x['event_id']==detail['event_id']),None);plan_ok=plan_ok and rr is not None and lr is not None and lr['receipt_id'] is None and rr['receipt_id']==detail['receipt']['receipt_id']
    if not plan_fault or not receipt_fault:f.block('M10','declared repair fault windows not reached')
    else:f.add('M10',plan_ok,str(run/'events.json'))
    senders=[x for x in apps if x.get('pause')=='before_http']
    if len(senders)<2 and state['status']!='executed':f.block('M11','sender competition not reached')
    else:f.add('M11',len(senders)==2 and len({x['pid'] for x in senders})==2 and senders[0]['checkpoint']['detail']==senders[1]['checkpoint']['detail'] and all(x.get('response',{}).get('status')=='converged' for x in senders),str(run/'events.json'))
    monitoring(run,events,mapping,f)
    if state['status']!='executed':f.block('M12','later monitoring windows not reached; observed samples retained')
    accept_fault=next((x for x in faults if x['pause']=='after_accept_commit'),None);services=[x for x in events if x.get('kind')=='service_start'];late=[x for x in apps if x.get('legacy')]
    if accept_fault is None:f.block('M13','acceptance fault not reached')
    else:f.add('M13',any(x['request']==accept_fault['request'] and x.get('response',{}).get('status')=='duplicate' for x in apps if not x.get('intentional_process_fault')),str(run/'events.json'))
    if len(services)<3 and state['status']!='executed':f.block('M13','receiver restart not reached')
    else:f.add('M13',len(services)==3 and len({x['pid'] for x in services})==3,str(run/'events.json'))
    if len(late)==1 and not late[0].get('cleanup_after_failure'):f.add('M13',late[0].get('response',{}).get('result',{}).get('status')=='replayed',str(run/'events.json'))
    else:f.block('M13','late HTTP release test not completed')
    isolation=load(run/'isolation.json');f.add('M14',isolation['owner_mode']=='0o700' and isolation['projection_mode']=='0o555' and isolation['file_modes']==['0o444'] and isolation['actor_uid']==10001 and isolation['report_uid']==65534 and all((run/'delivery'/n).is_file() for n in ('REPORT.md','operations.md','reproduce.md','recovery.png','reconciliation.csv','business.csv','monitor.csv')),str(run/'isolation.json'))
    try:
        with (run/'delivery/reconciliation.csv').open(encoding='utf-8',newline='') as stream:rows=list(csv.DictReader(stream))
        wanted=[]
        for stage,late_flag in [('repaired-incident',False),('repaired-current',True),('final',True)]:
            if not (run/stage/'facts.json').exists():f.block('M14','reconciliation depends on incomplete stage '+stage);continue
            want=desired(authority(raw,events,late_flag));effects=remote(run/stage/'remote.sqlite')['effects']
            for tenant in sorted({x[0] for x in want}):wanted.append({'stage':stage,'tenant':tenant,'target_minor':str(sum(v for k,v in want.items() if k[0]==tenant)),'external_minor':str(sum(x['amount_minor'] for x in effects if x['tenant']==tenant))})
        def account_value(x):return {'stage':x['stage'],'tenant':x['tenant'],'target_minor':integer_value(x['target_minor']),'external_minor':integer_value(x['external_minor'])}
        f.add('M14',norm([account_value(x) for x in rows])==norm([account_value(x) for x in wanted]),str(run/'delivery/reconciliation.csv'))
    except (OSError,ValueError,TypeError,KeyError):f.add('M14',False,str(run/'delivery/reconciliation.csv'),'candidate_reconciliation_invalid')
    try:
        with (run/'delivery/business.csv').open(encoding='utf-8',newline='') as stream:rows=list(csv.DictReader(stream))
        actual_business=[{k:integer_value(x[k]) if k in ('revision','amount_minor') else x[k] for k in ('stage','tenant','event_id','revision','status','amount_minor')} for x in rows];wanted_business=[]
        for stage in ('repaired-incident','repaired-current','final'):
            if not (run/stage/'facts.json').exists():f.block('M14','business export depends on incomplete stage '+stage);continue
            facts=read(run/stage/'local.sqlite',mapping,['journal'])
            wanted_business.extend({'stage':stage,'tenant':k[0],'event_id':k[1],'revision':v[0],'status':v[1],'amount_minor':v[2]} for k,v in business(facts['journal']).items())
        f.add('M14',norm(actual_business)==norm(wanted_business),str(run/'delivery/business.csv'))
        with (run/'delivery/monitor.csv').open(encoding='utf-8',newline='') as stream:csv_samples=list(csv.DictReader(stream))
        expected_samples=read(run/'local.sqlite',mapping,['samples'])['samples']
        if (run/'empty-monitor.sqlite').exists():expected_samples+=read(run/'empty-monitor.sqlite',mapping,['samples'])['samples']
        def sample_value(x):
            y={k:x[k] for k in ('window_id','pending','total','pending_ratio','conflicts','mismatched_sources','active_json')}
            for k in ('pending','total','conflicts','mismatched_sources'):y[k]=integer_value(y[k])
            if not isinstance(y['pending_ratio'],str):raise ValueError('candidate_ratio_type')
            y['pending_ratio']=str(Fraction(y['pending_ratio']));active=json.loads(y['active_json'])
            if type(active) is not list or not all(isinstance(v,str) for v in active):raise ValueError('candidate_active_shape')
            y['active_json']=sorted(active);return y
        f.add('M14',norm([sample_value(x) for x in csv_samples])==norm([sample_value(x) for x in expected_samples]),str(run/'delivery/monitor.csv'))
    except (OSError,ValueError,TypeError,KeyError,CandidateDataError):f.add('M14',False,str(run/'delivery'),'candidate_required_export_invalid')
    return reg
def main():
    p=argparse.ArgumentParser();p.add_argument('--run',type=Path,action='append',required=True);p.add_argument('--raw',type=Path,action='append',required=True);p.add_argument('--registered',type=Path,required=True);p.add_argument('--rubric',type=Path,required=True);p.add_argument('--review',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(exist_ok=False)
    try:
        if len(a.run)!=len(a.raw) or not 1<=len(a.run)<=3:raise ValueError('facility_input_set_invalid')
        registered=load(a.registered);roles=[]
        for raw in a.raw:
            identity={'local':original(raw/'original-local.sqlite'),'remote_effects':remote(raw/'original-remote.sqlite')['effects'],'incoming':load(raw/'incoming-operations.json')};matches=[k for k,v in registered.items() if input_identity(v)==input_identity(identity)]
            if len(matches)!=1 or matches[0] in roles:raise ValueError('facility_input_identity_invalid')
            roles.append(matches[0])
        f=F();regs=[]
        for run in a.run:native_identity_preflight(run)
        for run,raw in zip(a.run,a.raw):
            try:regs.append(assess(run,raw,f))
            except CandidateDataError as e:f.add('M01',False,str(run),str(e));regs.append(load(run/'registration.json'))
        if set(roles)==set(registered):f.add('M15',all(x['source_files']==regs[0]['source_files'] and x['manifest']==regs[0]['manifest'] for x in regs),'same immutable submission over all registered inputs')
        findings=f.result();rubric=load(a.rubric);humans=[x['id'] for x in rubric['leaves'] if x['assessment']=='independent'];roots=[str(x.resolve()) for x in a.run]
        if a.review:
            review=load(a.review)
            if review.get('run_roots')!=roots or set(review.get('ratings',{}))!=set(humans):raise ValueError('facility_independent_review_binding_invalid')
            for key,r in review['ratings'].items():
                if r.get('status') not in ('verified_pass','verified_fail','unassessed') or not isinstance(r.get('evidence'),str) or not r['evidence'].strip():raise ValueError('facility_independent_review_invalid')
                findings[key]=r
        else:
            for k in humans:findings[k]={'status':'unassessed','evidence':'whole-case independent review pending'}
        unresolved=[k for k,v in findings.items() if v['status'] in ('blocked','unassessed')];failed=[k for k,v in findings.items() if v['status']=='verified_fail'];score=sum(x['weight'] for x in rubric['leaves'] if findings[x['id']]['status']=='verified_pass');critical=[x['id'] for x in rubric['leaves'] if x['critical'] and findings[x['id']]['status']!='verified_pass']
        result={'status':'assessment_incomplete' if unresolved else 'graded','subject_role':'author_reference_or_error_control','run_roots':roots,'fixed_denominator':100,'total':None if unresolved else score,'business_success':None if unresolved else not critical,'good':None if unresolved else score>=90 and not critical,'failed':failed,'unresolved':unresolved,'critical_unmet':critical,'findings':findings};code=4 if unresolved else 2 if failed else 0
    except (OSError,ValueError,KeyError,TypeError,sqlite3.Error) as e:result={'status':'run_invalid','error':str(e),'total':None,'good':None};code=3
    (a.out/'assessment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='findings'},ensure_ascii=False));raise SystemExit(code)
if __name__=='__main__':main()
