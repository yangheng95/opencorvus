"""Independent raw-to-business oracle and atomic whole-case grader, no candidate self ratings."""
import argparse,csv,json,re,sqlite3,sys
from datetime import datetime
from fractions import Fraction
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'public'))
from exercise_app import snapshot

SCENARIOS=('clean','before','after','cutover')
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def db_rows(db,table):
    c=sqlite3.connect(db);c.row_factory=sqlite3.Row
    try:return [dict(x) for x in c.execute('SELECT * FROM '+table)]
    finally:c.close()
def norm(rows):return sorted(json.dumps(x,ensure_ascii=False,sort_keys=True) for x in rows)

def expected(raw,pre):
    authority=load(raw/'identity-authority.json');customers=db_rows(raw/'app-v1.sqlite','legacy_customers');entries=db_rows(raw/'app-v1.sqlite','legacy_entries')+[pre]
    aliases={r['customer_id']:authority['legacy_to_customer'].get(str(r['customer_id'])) for r in customers};valid={};bad={};quarantine=[]
    for r in customers:
        if aliases[r['customer_id']] is None:quarantine.append(('customer',str(r['customer_id']),'unmapped_customer',r))
    for r in entries:
        key=r['entry_id'];value=r['amount']
        if aliases.get(r['customer_id']) is None:bad[key]='unmapped_customer'
        elif r['currency'] not in ('USD','CNY'):bad[key]='unsupported_currency'
        elif not isinstance(value,str) or re.fullmatch(r'-?[0-9]+(?:\.[0-9]{1,2})?',value) is None:bad[key]='amount_scale'
        elif not -(2**63)<=Fraction(value)*100<2**63:bad[key]='amount_range'
        else:valid[key]=(aliases[r['customer_id']],r['currency'],int(Fraction(value)*100),r['reversal_of'])
    for key,(customer,currency,a,parent) in valid.items():
        p=valid.get(parent)
        if (parent is None and a<0) or (parent is not None and (a>=0 or p is None or p[:2]!=(customer,currency) or p[2]<=0 or p[3] is not None)):bad[key]='invalid_reversal'
    groups={}
    for key,v in valid.items():
        if key not in bad and v[3] is not None:groups.setdefault(v[3],[]).append(key)
    for parent,ids in groups.items():
        if -sum(valid[k][2] for k in ids)>valid[parent][2]:
            for k in ids:bad[k]='refund_group_exceeds'
    for r in entries:
        if r['entry_id'] in bad:quarantine.append(('entry',r['entry_id'],bad[r['entry_id']],r))
    target={r['entry_id']:{'entry_id':r['entry_id'],'customer_key':valid[r['entry_id']][0],'currency':valid[r['entry_id']][1],'amount_minor':valid[r['entry_id']][2],'reversal_of':valid[r['entry_id']][3],'fee_minor':0,'legacy_raw_json':r} for r in entries if r['entry_id'] not in bad}
    return authority,customers,aliases,target,quarantine

def expected_new_writes(events,target,customer_keys):
    """Replay permitted requests, not candidate rows or candidate claimed balances."""
    state={k:dict(v) for k,v in target.items()};new={};seen={};ok=True
    for event in events:
        if event['legacy'] or event['request']['action']!='write':continue
        w=event['request']['write'];key=w.get('op_key');response=event.get('response');status=None
        if not isinstance(key,str) or not key.strip():status='invalid_request:op_key'
        elif type(w.get('amount_minor')) is not int:status='invalid_request:amount_minor'
        elif w['epoch']!=4:status='stale_epoch'
        elif key in seen:status='duplicate' if w==seen[key] else 'operation_conflict'
        elif w['customer_key'] not in customer_keys:status='constraint_error'
        elif w.get('reversal_of'):
            parent=state.get(w['reversal_of']);amount=w['amount_minor']
            if parent is None or parent['reversal_of'] is not None or parent['amount_minor']<=0 or amount>=0 or (parent['customer_key'],parent['currency'])!=(w['customer_key'],w['currency']):status='invalid_reversal'
            elif -sum(x['amount_minor'] for x in state.values() if x['reversal_of']==w['reversal_of'])-amount>parent['amount_minor']:status='refund_exceeds'
            else:status='accepted'
        else:status='accepted'
        committed=status=='accepted' and (not event.get('intentional_process_fault') or event['pause']=='after_commit')
        if committed:
            row={k:w[k] for k in ('entry_id','customer_key','currency','amount_minor','fee_minor')};row['reversal_of']=w.get('reversal_of');row['legacy_raw_json']=None;state[row['entry_id']]=row;new[row['entry_id']]=row;seen[key]=w
        if event.get('intentional_process_fault'):continue
        ok=ok and isinstance(response,dict) and response.get('status')==status
        if status in ('accepted','duplicate') and isinstance(response,dict):
            receipt=response if status=='accepted' else response.get('receipt',{})
            ok=ok and isinstance(receipt,dict) and all(type(receipt.get(k)) is type(v) and receipt.get(k)==v for k,v in {'status':'accepted','entry_id':w['entry_id'],'epoch':4,'source_schema':2}.items())
        if status=='stale_epoch' and isinstance(response,dict):ok=ok and response.get('current_epoch')==4
    return new,seen,ok

class Findings:
    def __init__(self):self.items={f'M{i:02}':[] for i in range(1,17)}
    def add(self,key,ok,evidence,actual=None):self.items[key].append({'status':'verified_pass' if ok else 'verified_fail','evidence':evidence,'actual':actual})
    def blocked(self,key,evidence):self.items[key].append({'status':'blocked','evidence':evidence})
    def aggregate(self):
        out={}
        for key,items in self.items.items():
            states=[x['status'] for x in items]
            state='verified_fail' if 'verified_fail' in states else 'blocked' if 'blocked' in states else 'verified_pass' if items else 'unassessed'
            out[key]={'status':state,'findings':items}
        return out

def assess(run,raw,f):
    registration=load(run/'registration.json');outcomes=load(run/'run.json')['scenarios']
    f.add('M01',all(x['status']=='completed' for x in outcomes) and load(run/'report-native.json')['exit_code']==0,str(run/'run.json'))
    for name in SCENARIOS:
        root=run/name;events=load(root/'events.json');initial=load(root/'pre-upgrade-sql.json')['tables'] if (root/'pre-upgrade-sql.json').exists() else None
        captured=load(root/'final-sql.json') if (root/'final-sql.json').exists() else None
        final=snapshot(root/'live.sqlite') if captured and (root/'live.sqlite').is_file() else None
        # Fault observations are assessed even when subsequent candidate work failed.
        if name in ('before','after'):
            faults=[x for x in events if x.get('intentional_process_fault') and x['request']['action']=='upgrade']
            good=False
            if len(faults)==1:
                x=faults[0];t=x['at_checkpoint_sql']['tables'];version=max(r['version'] for r in t['schema_migrations']);epoch=t['control'][0]['epoch']
                good=x['exit_code']!=0 and version==(1 if name=='before' else 2) and epoch==(3 if name=='before' else 4) and (('legacy_entries' in t and 'entries' not in t) if name=='before' else ('entries' in t and 'legacy_entries' not in t))
            f.add('M10',good,str(root/'events.json'))
        if not final:
            recovery_events=[e for e in events if e['request']['action']=='recover' and e.get('response')]
            if recovery_events:
                f.add('M14',recovery_events[-1]['response'].get('status')=='forward_repaired',str(root/'events.json'),recovery_events[-1]['response'])
            else:f.blocked('M14',str(root/'scenario.json'))
            for key in ('M02','M03','M04','M05','M06','M07','M08','M09','M12','M15'):f.blocked(key,str(root/'scenario.json'))
            if name=='clean':f.blocked('M13',str(root/'scenario.json'))
            if name=='cutover':f.blocked('M11',str(root/'scenario.json'))
            continue
        t=final['tables'];pre=next(x['request']['write'] for x in events if x['legacy'] and x['request']['action']=='write')
        oldrow={k:pre.get(k) for k in ('entry_id','customer_id','currency','amount','reversal_of')};authority,raw_c,aliases,target,quarantine=expected(raw,oldrow)
        actual={x['entry_id']:x for x in t['entries']};oldactual={k:v for k,v in actual.items() if v['legacy_raw_json'] is not None}
        expected_new,expected_new_commands,write_contract_ok=expected_new_writes(events,target,{x for x in aliases.values() if x is not None})
        capture_bound=captured is not None and set(final['tables'])==set(captured['tables']) and all(norm(final['tables'][k])==norm(captured['tables'][k]) for k in final['tables'])
        f.add('M02',capture_bound and set(target)==set(oldactual) and final['integrity']=='ok' and not final['foreign_keys'],str(root/'live.sqlite'))
        alias_actual={x['legacy_id']:x['customer_key'] for x in t['customer_aliases']};expected_alias={k:v for k,v in aliases.items() if v is not None}
        cust={x['customer_key']:{k:x[k] for k in ('display_name','email')} for x in t['customers']};wanted_cust={v:authority['customers'][v] for v in expected_alias.values()}
        f.add('M03',alias_actual==expected_alias and cust==wanted_cust,str(root/'final-sql.json'))
        full_wanted=dict(target,**expected_new)
        f.add('M04',set(actual)==set(full_wanted) and all(k in actual and all(type(actual[k][field]) is int and actual[k][field]==v[field] for field in ('amount_minor','fee_minor')) and actual[k]['currency']==v['currency'] and actual[k]['customer_key']==v['customer_key'] for k,v in full_wanted.items()),str(root/'final-sql.json'))
        f.add('M05',all(k in actual and actual[k]['reversal_of']==v['reversal_of'] for k,v in full_wanted.items()),str(root/'final-sql.json'))
        q_actual={(x['kind'],x['legacy_key']):(x['reason'],json.loads(x['raw_json'])) for x in t['quarantine']};q_wanted={(kind,key):(reason,row) for kind,key,reason,row in quarantine}
        raw_map={x['entry_id']:json.loads(x['legacy_raw_json']) for x in oldactual.values()};alias_raw={x['legacy_id']:json.loads(x['raw_json']) for x in t['customer_aliases']}
        f.add('M06',q_actual==q_wanted and raw_map=={k:v['legacy_raw_json'] for k,v in target.items()} and alias_raw=={x['customer_id']:x for x in raw_c if aliases[x['customer_id']] is not None},str(root/'final-sql.json'))
        expected_notes=db_rows(raw/'app-v1.sqlite','notes')+[{'note_id':'POST-'+name,'entry_id':'V2-'+name,'text':'升级后原用户批注\n\u0000尾部 / 追加不可丢'}]
        note_reads=[x['response'].get('notes') for x in events if x['request']['action']=='notes' and not x['legacy'] and isinstance(x.get('response'),dict)]
        f.add('M07',norm(t['notes'])==norm(expected_notes) and any(norm(x)==norm(expected_notes) for x in note_reads),str(root/'final-sql.json'))
        original_history=db_rows(raw/'app-v1.sqlite','schema_migrations');history=[x for x in t['schema_migrations'] if x['version']==1]
        oldaudit=initial['audit_events'];audit_by_id={x['event_id']:x for x in t['audit_events']}
        newkeys={k for k,v in actual.items() if v['legacy_raw_json'] is None};audit_new=[x for x in t['audit_events'] if x['source_schema']==2]
        date_row=next(x for x in t['schema_migrations'] if x['version']==2)
        try:
            dt=datetime.fromisoformat(date_row['applied_at'].replace('Z','+00:00'));date_ok=dt.utcoffset().total_seconds()==0 and any(datetime.fromisoformat(e['started_at'])<=dt<=datetime.fromisoformat(e['finished_at']) for e in events if e['request']['action']=='upgrade')
        except (ValueError,TypeError,AttributeError):date_ok=False
        payload_ok=all(json.loads(x['payload'])=={k:actual[x['entry_id']][k] for k in ('customer_key','currency','amount_minor','reversal_of','fee_minor')} for x in audit_new if x['entry_id'] in actual)
        f.add('M08',date_ok and payload_ok and date_row['name']=='canonical_money_fee' and history==original_history and len(t['schema_migrations'])==2 and all(audit_by_id.get(x['event_id'])==x for x in oldaudit) and {x['entry_id'] for x in audit_new}==newkeys and len(audit_new)==len(newkeys),str(root/'final-sql.json'))
        by_key={x['op_key']:x for x in t['write_receipts']};expected_receipts={x['op_key']:x for x in initial['write_receipts']}
        for e in events:
            if e['request']['action']=='write' and not e['legacy'] and isinstance(e.get('response'),dict):
                r=e['response'];w=e['request']['write']
                if r.get('status')=='accepted':expected_receipts[w['op_key']]={'op_key':w['op_key'],'command':w,'result':r}
                elif r.get('status')=='duplicate' and w['op_key'] not in expected_receipts:expected_receipts[w['op_key']]={'op_key':w['op_key'],'command':w,'result':r['receipt']}
        receipt_ok=set(by_key)==set(expected_receipts) and set(expected_receipts)==set(x['op_key'] for x in initial['write_receipts'])|set(expected_new_commands)
        for k,w in expected_receipts.items():
            a=by_key.get(k)
            receipt_ok=receipt_ok and a is not None and (a==w if 'command_json' in w else json.loads(a['command_json'])==w['command'] and json.loads(a['result_json'])==w['result'])
        receipt_reads=[x for x in events if x['request']['action']=='receipt']
        receipt_ok=receipt_ok and all(x['response']=={'status':'ok','receipt':json.loads(by_key[x['request']['op_key']]['result_json'])} for x in receipt_reads)
        f.add('M09',receipt_ok and write_contract_ok,str(root/'events.json'))
        if name=='cutover':
            held=[e for e in events if e['legacy'] and e.get('pause')=='before_begin']
            f.add('M11',len(held)==2 and all(e['response']=={'status':'stale_epoch','current_epoch':4} for e in held) and all('STALE-'+str(i) not in actual for i in range(2)),str(root/'events.json'))
        statuses=[e['response'].get('status') for e in events if isinstance(e.get('response'),dict)]
        probes=load(root/'constraint-probes.json')
        f.add('M12',write_contract_ok and all(s in statuses for s in ('operation_conflict','refund_exceeds','invalid_request:op_key','invalid_request:amount_minor','stale_epoch','constraint_error')) and probes[0]['status']=='accepted_in_rolled_back_probe' and all(x['status']=='constraint_error' for x in probes[1:]),str(root/'constraint-probes.json'))
        if name=='clean':
            fs=[e for e in events if e.get('intentional_process_fault') and e['request']['action']=='write'];ok=len(fs)==2
            for e in fs:
                w=e['request']['write'];at=e['at_checkpoint_sql']['tables'];atentries={x['entry_id'] for x in at['entries']};atkeys={x['op_key'] for x in at['write_receipts']};committed=e['pause']=='after_commit'
                ok=ok and (w['entry_id'] in atentries)==committed and (w['op_key'] in atkeys)==committed and sum(x['entry_id']==w['entry_id'] for x in t['entries'])==1
            f.add('M13',ok,str(root/'events.json'))
        before=load(root/'pre-recover-sql.json')['tables'];recovered=load(root/'recovered-sql.json')['tables'];backup_keys={x['op_key'] for x in initial['write_receipts']};before_keys={x['op_key'] for x in before['write_receipts']}
        response=next(e['response'] for e in events if e['request']['action']=='recover');expected_fee=sum(x['fee_minor'] for x in before['entries'])
        f.add('M14',response=={'status':'forward_repaired','decision':'retain_v2','backup_missing_ack_keys':sorted(before_keys-backup_keys),'fee_minor':expected_fee,'integrity':'ok'} and all(norm(before[k])==norm(recovered[k]) for k in before) and 'CONTINUED-'+name in actual,str(root/'recovered-sql.json'))
        exp=load(root/'export.json');balance_response=next(e['response'] for e in events if e['request']['action']=='balance');balances={}
        # balance was read before continued write; use pre-recover state.
        for x in before['entries']:
            value=balances.setdefault((x['customer_key'],x['currency']),[0,0]);value[0]+=x['amount_minor'];value[1]+=x['fee_minor']
        balance_rows=[{'customer_key':k[0],'currency':k[1],'amount_minor':v[0],'fee_minor':v[1]} for k,v in balances.items()]
        f.add('M15',all(norm(exp['tables'][k])==norm(t[k]) for k in exp['tables']) and set(exp['tables'])==set(k for k in t if k in ('customers','customer_aliases','entries','quarantine','write_receipts','notes','schema_migrations','audit_events','control')) and norm(balance_response['balances'])==norm(balance_rows),str(root/'export.json'))
    for name in ('ambiguous_entry','ambiguous_receipt'):
        root=run/name;b=load(root/'ambiguous-before-sql.json');a=snapshot(root/'live.sqlite');answer=load(root/'scenario.json')['response']
        f.add('M10',a==b and answer=={'status':'unresolved_entry_identity' if name=='ambiguous_entry' else 'unresolved_receipt_identity'},str(root/'scenario.json'))
    isolation=load(run/'report-isolation.json') if (run/'report-isolation.json').exists() else None
    if isolation:
        try:uid=json.loads(isolation['identity_stderr_first_line'])['uid']
        except (ValueError,KeyError,TypeError):uid=None
        f.add('M15',uid==65534 and isolation['private_root_mode']=='0o700' and isolation['projection_directory_mode']=='0o555' and isolation['projection_file_modes']==['0o444'],str(run/'report-isolation.json'))
    else:f.blocked('M15','original execution predates current real report isolation evidence; do not backfill past facts')
    # Actual source identity across registered input changes; identity is not a correctness gate.
    return registration

def check_report_csv(run,f):
    path=run/'delivery'/'reconciliation.csv'
    if not path.exists():f.add('M15',False,str(path),'candidate_reconciliation_missing');return
    try:
        with path.open(encoding='utf-8',newline='') as stream:rows=list(csv.DictReader(stream))
        assert len(rows)==4 and {x['scenario'] for x in rows}==set(SCENARIOS)
        for row in rows:
            t=load(run/row['scenario']/'final-sql.json')['tables'];e=t['entries']
            wanted={'schema_version':max(x['version'] for x in t['schema_migrations']),'epoch':t['control'][0]['epoch'],'entries':len(e),'quarantine':len(t['quarantine']),'receipts':len(t['write_receipts']),'notes':len(t['notes'])}
            for cur in ('USD','CNY'):
                for field in ('amount_minor','fee_minor'):wanted[field+'_'+cur]=sum(x[field] for x in e if x['currency']==cur)
            assert all(type(row[k]) is str and re.fullmatch(r'-?[0-9]+',row[k]) and int(row[k])==v for k,v in wanted.items())
        f.add('M15',True,str(path))
    except (ValueError,KeyError,AssertionError,TypeError):f.add('M15',False,str(path),'candidate_reconciliation_invalid')

def main():
    p=argparse.ArgumentParser();p.add_argument('--run',type=Path,action='append',required=True);p.add_argument('--raw',type=Path,action='append',required=True);p.add_argument('--registered-inputs',type=Path,required=True);p.add_argument('--rubric',type=Path,required=True);p.add_argument('--review',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(exist_ok=False)
    try:
        if len(a.run)!=len(a.raw) or not 1<=len(a.run)<=3:raise ValueError('facility_registered_input_set_invalid')
        registered=load(a.registered_inputs)['inputs'];roles=[]
        for raw in a.raw:
            facts={'tables':{t:db_rows(raw/'app-v1.sqlite',t) for t in registered['base']['tables']},'authority':load(raw/'identity-authority.json')}
            matches=[role for role,x in registered.items() if facts['authority']==x['authority'] and all(norm(facts['tables'][t])==norm(x['tables'][t]) for t in x['tables'])]
            if len(matches)!=1 or matches[0] in roles:raise ValueError('facility_registered_input_identity_invalid')
            roles.append(matches[0])
        f=Findings();regs=[]
        for run,raw in zip(a.run,a.raw):regs.append(assess(run,raw,f));check_report_csv(run,f)
        if set(roles)==set(registered):
            f.add('M16',all(r['source_files']==regs[0]['source_files'] and r['manifest']==regs[0]['manifest'] for r in regs) and all(load(run/'run.json')['scenarios'][0]['status']=='completed' for run in a.run),'same immutable programme across base/money/identity controls')
        findings=f.aggregate();rubric=load(a.rubric);human=[x['id'] for x in rubric['leaves'] if x['assessment']=='independent'];binding=[str(r.resolve()) for r in a.run]
        if a.review:
            review=load(a.review)
            if review.get('run_roots')!=binding or set(review.get('ratings',{}))!=set(human):raise ValueError('facility_independent_review_binding_invalid')
            for key,item in review['ratings'].items():
                if item.get('status') not in ('verified_pass','verified_fail','unassessed') or not isinstance(item.get('evidence'),str) or not item['evidence'].strip():raise ValueError('facility_independent_review_rating_invalid')
                findings[key]=item
        else:
            for key in human:findings[key]={'status':'unassessed','evidence':'independent whole-case review pending'}
        unresolved=[k for k,v in findings.items() if v['status'] in ('unassessed','blocked')];failed=[k for k,v in findings.items() if v['status']=='verified_fail'];score=sum(x['weight'] for x in rubric['leaves'] if findings[x['id']]['status']=='verified_pass')
        crit=[x['id'] for x in rubric['leaves'] if x['critical'] and findings[x['id']]['status']!='verified_pass']
        result={'status':'assessment_incomplete' if unresolved else 'graded','subject_role':'author_reference_or_error_control','run_roots':binding,'fixed_denominator':100,'total':None if unresolved else score,'business_success':None if unresolved else not crit,'good':None if unresolved else score>=90 and not crit,'failed':failed,'unresolved':unresolved,'critical_unmet':crit,'findings':findings}
        code=4 if unresolved else 2 if failed else 0
    except (OSError,sqlite3.Error,ValueError,KeyError,TypeError) as e:result={'status':'run_invalid','error':str(e),'total':None,'good':None};code=3
    (a.out/'assessment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='findings'},ensure_ascii=False));raise SystemExit(code)
if __name__=='__main__':main()
