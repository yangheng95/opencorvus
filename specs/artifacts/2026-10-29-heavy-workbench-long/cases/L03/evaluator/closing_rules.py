"""Synthetic management-close policy. No candidate code is imported."""
from collections import defaultdict
from decimal import Decimal,ROUND_HALF_UP
from fractions import Fraction
import json,csv
from pathlib import Path
from datetime import datetime,timezone

def instant(value):
    if type(value) is not str:raise ValueError('canonical UTC string required')
    parsed=datetime.strptime(value,'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
    if parsed.strftime('%Y-%m-%dT%H:%M:%SZ')!=value:raise ValueError('canonical UTC string required')
    return parsed

def parse(text):
    def pairs(values):
        result={}
        for k,v in values:
            if k in result:raise ValueError('duplicate JSON key: '+k)
            result[k]=v
        return result
    def constant(value):raise ValueError('non-JSON number: '+value)
    return json.loads(text,object_pairs_hook=pairs,parse_constant=constant)
def read(root,name):return parse((Path(root)/name).read_text(encoding='utf-8'))
def rows(root,name):return [parse(s) for s in (Path(root)/name).read_text(encoding='utf-8').splitlines() if s.strip()]
def native(value):
    if type(value) is not str:raise ValueError('money must be a decimal string')
    d=Decimal(value)
    if not d.is_finite() or d<0 or d.as_tuple().exponent < -2:raise ValueError('nonnegative two-decimal money required')
    return int(d*100)
def rounded_ratio(n,d):
    if d<=0:raise ValueError('positive denominator required')
    return (2*n+d)//(2*d) if n>=0 else -rounded_ratio(-n,d)
def converted(amount,rate):return int((Decimal(amount)*Decimal(rate)*100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
def latest(values,identity,cutoff):
    instant(cutoff)
    groups=defaultdict(list)
    for row in values:
        instant(row['released_at'])
        if type(row['revision']) is not int or row['revision']<0:raise ValueError('nonnegative integer revision required')
        if row['released_at']<=cutoff:groups[tuple(row[k] for k in identity)].append(row)
    selected={}
    for key,group in groups.items():
        rev=max(r['revision'] for r in group);variants={json.dumps({k:v for k,v in r.items() if k!='source_id'},sort_keys=True) for r in group if r['revision']==rev}
        selected[key]=json.loads(next(iter(variants))) if len(variants)==1 else {'revision':rev,'conflict':True,'variants':[json.loads(v) for v in sorted(variants)]}
    return selected

def close(root):
    policy=read(root,'company.json');months=policy['months'];cutoff=policy['as_of'];fx=latest(rows(root,'fx.jsonl'),['currency','rate_date'],cutoff)
    rawdocs=latest(rows(root,'documents.jsonl'),['doc_id'],cutoff);exceptions=[];docs=[];bydoc={};journal=[]
    def post(kind,identity,month,account,amount):
        if month not in months:raise ValueError('period outside registered company months')
        if amount:journal.append({'source_type':kind,'source_id':identity,'month':month,'account':account,'amount_minor':amount})
    post('opening','opening',months[0],'Cash',policy['opening_cash_minor']);post('opening','opening',months[0],'OpeningEquity',-policy['opening_cash_minor'])
    for (identity,),d in sorted(rawdocs.items()):
        if d.get('conflict'):
            docs.append({'doc_id':identity,'revision':d['revision'],'status':'quarantined','gross_minor':None})
            exceptions.append({'kind':'document_conflict','identity':identity,'revision':d['revision'],'status':'unresolved'});continue
        if d['status']=='cancelled':
            docs.append({'doc_id':identity,'revision':d['revision'],'status':'cancelled','gross_minor':0});continue
        rate=fx[d['currency'],d['rate_date']]
        if rate.get('conflict'):raise ValueError('reference FX conflict')
        sign=1 if d['kind']=='invoice' else -1
        lines=[{'line_id':r['line_id'],'native_minor':native(r['amount']),'base_minor':sign*converted(r['amount'],rate['rate'])} for r in d['lines']]
        total=sum(r['base_minor'] for r in lines);n=sum(r['native_minor'] for r in lines)
        record={'doc_id':identity,'revision':d['revision'],'status':'posted','vendor':d['vendor'],'department':d['department'],'book_month':d['book_month'],
            'service_months':d['service_months'],'currency':d['currency'],'native_minor':sign*n,'fx_revision':rate['revision'],'gross_minor':total,'lines':lines}
        docs.append(record);bydoc[identity]=record
        post('doc',identity,d['book_month'],'Prepaid:'+d['department'],total);post('doc',identity,d['book_month'],'AP:'+d['vendor'],-total)
        quotient,remainder=divmod(abs(total),len(d['service_months']))
        for i,month in enumerate(d['service_months']):
            value=sign*(quotient+(remainder if i==len(d['service_months'])-1 else 0))
            post('doc',identity,month,'Expense:'+d['department'],value);post('doc',identity,month,'Prepaid:'+d['department'],-value)
    # Bank rows are stable transaction identities, not export-row identities.
    banks={}
    for b in rows(root,'bank.jsonl'):
        if instant(b['released_at'])<instant(b['posted_at']):raise ValueError('bank release precedes transaction')
        if b['released_at']>cutoff:continue
        value={k:v for k,v in b.items() if k!='source_id'};old=banks.get(b['bank_tx_id'])
        if old is not None and old!=value:raise ValueError('conflicting bank transaction')
        banks[b['bank_tx_id']]=value
    advices=latest(rows(root,'advice.jsonl'),['bank_tx_id'],cutoff);settlements=[];bankout=[];cumulative=defaultdict(int);cumulative_book=defaultdict(int)
    for identity,b in sorted(banks.items(),key=lambda pair:(pair[1]['posted_at'],pair[0])):
        month=b['posted_at'][:7];cash=b['amount_minor'];fee=b['fee_minor'];advice=advices.get((identity,));allocated=0
        post('bank',identity,month,'Cash',-cash);post('bank',identity,month,'Expense:Finance',fee)
        status='confirmed' if advice and not advice.get('conflict') and advice['status']=='confirmed' else 'unresolved'
        if status=='confirmed':
            for allocation in advice['allocations']:
                d=bydoc[allocation['doc_id']]
                if d['native_minor']<=0:raise ValueError('settle a positive invoice only')
                amount=native(allocation['amount_native']);cumulative[d['doc_id']]+=amount
                if cumulative[d['doc_id']]>d['native_minor']:raise ValueError('native invoice over-allocation')
                book=rounded_ratio(d['gross_minor']*cumulative[d['doc_id']],d['native_minor'])-cumulative_book[d['doc_id']]
                cumulative_book[d['doc_id']]+=book;paid=allocation['cash_minor'];allocated+=paid;exchange=paid-book
                settlements.append({'bank_tx_id':identity,'doc_id':d['doc_id'],'month':month,'native_minor':amount,'book_minor':book,'cash_minor':paid,'fx_minor':exchange})
                post('bank',identity,month,'AP:'+d['vendor'],book);post('bank',identity,month,'FX:'+d['department'],exchange)
        if allocated+fee>cash:raise ValueError('bank allocations exceed actual cash')
        unresolved=cash-fee-allocated;post('bank',identity,month,'Suspense',unresolved)
        if unresolved:exceptions.append({'kind':'bank_unallocated','identity':identity,'amount_minor':unresolved,'status':'unresolved','evidence_status':None if advice is None else 'conflict' if advice.get('conflict') else advice['status']})
        bankout.append({'bank_tx_id':identity,'month':month,'amount_minor':cash,'fee_minor':fee,'allocated_minor':allocated,'unallocated_minor':unresolved,'status':status})
    budgets=latest(rows(root,'budgets.jsonl'),['department','month'],cutoff);commitments=latest(rows(root,'commitments.jsonl'),['commit_id'],cutoff)
    accounts=defaultdict(int);monthly=[];departments=[];vendors=[];cash_previous=policy['opening_cash_minor']
    department_names=sorted({r['department'] for r in docs if r['status']=='posted'}|{d for d,m in budgets}|{'Finance'})
    vendor_names=sorted({r['vendor'] for r in docs if r['status']=='posted'})
    for month in months:
        changes=defaultdict(int)
        for r in journal:
            if r['month']==month:changes[r['account']]+=r['amount_minor']
        for account,value in changes.items():accounts[account]+=value
        service=sum(v for k,v in changes.items() if k.startswith('Expense:') and k!='Expense:Finance')
        fees=changes['Expense:Finance'];exchange=sum(v for k,v in changes.items() if k.startswith('FX:'))
        payable=sum(max(-accounts['AP:'+v],0) for v in vendor_names);advance=sum(max(accounts['AP:'+v],0) for v in vendor_names)
        cash_out=sum(b['amount_minor'] for b in bankout if b['month']==month)
        commitment=sum(r['amount_minor'] for r in commitments.values() if not r.get('conflict') and r['status']=='open' and r['expected_month']==month)
        budget=sum(r['amount_minor'] for (d,m),r in budgets.items() if m==month)
        monthly.append({'month':month,'cash_open_minor':cash_previous,'cash_out_minor':cash_out,'cash_close_minor':accounts['Cash'],
            'service_expense_minor':service,'fees_minor':fees,'fx_minor':exchange,'expense_minor':service+fees+exchange,
            'prepaid_close_minor':sum(v for k,v in accounts.items() if k.startswith('Prepaid:')),'ap_net_close_minor':payable-advance,
            'ap_payable_close_minor':payable,'vendor_advance_close_minor':advance,'suspense_close_minor':accounts['Suspense'],
            'budget_minor':budget,'variance_minor':budget-service-fees-exchange,'open_commitments_minor':commitment,
            'overdraft_used_minor':max(-accounts['Cash'],0),'overdraft_headroom_minor':policy['bank_overdraft_limit_minor']-max(-accounts['Cash'],0)})
        cash_previous=accounts['Cash']
        for d in department_names:
            expense=changes['Expense:'+d]+changes['FX:'+d];budget=budgets.get((d,month),{}).get('amount_minor',0)
            departments.append({'department':d,'month':month,'expense_minor':expense,'budget_minor':budget,'variance_minor':budget-expense})
        for v in vendor_names:
            net=-accounts['AP:'+v];vendors.append({'vendor':v,'month':month,'net_ap_minor':net,'payable_minor':max(net,0),'advance_minor':max(-net,0)})
    choices=read(root,'choices.json');available=monthly[-1]['cash_close_minor']-monthly[-1]['ap_payable_close_minor']-choices['reserve_minor']
    options=[]
    for option in choices['options']:
        cost=sum(Fraction(s['probability'])*(option['fixed_minor']+option['unit_minor']*s['units']) for s in choices['scenarios'])
        options.append({'id':option['id'],'capacity_ok':option['capacity']>=max(s['units'] for s in choices['scenarios']),
            'cash_ok':option['upfront_minor']<=available,'minimum_new_funding_minor':max(option['upfront_minor']-available,0),'expected_cost_exact':str(cost)})
    feasible=[r for r in options if r['capacity_ok'] and r['cash_ok']];selected=min(feasible,key=lambda r:(Fraction(r['expected_cost_exact']),r['id']))['id'] if feasible else None
    cross=[]
    for i,a in enumerate(choices['options']):
        for b in choices['options'][i+1:]:
            volume=None if a['unit_minor']==b['unit_minor'] else str(Fraction(b['fixed_minor']-a['fixed_minor'],a['unit_minor']-b['unit_minor']))
            cross.append({'left':a['id'],'right':b['id'],'volume_exact':volume})
    funding=[];joint=[]
    for offer in choices['funding_offers']:
        permitted=[r for r in options if r['capacity_ok'] and next(o['upfront_minor'] for o in choices['options'] if o['id']==r['id'])<=available+offer['additional_cash_minor']]
        chosen=min(permitted,key=lambda r:(Fraction(r['expected_cost_exact']),r['id'])) if permitted else None
        row={'funding_id':offer['id'],'status':offer['status'],'additional_cash_minor':offer['additional_cash_minor'],'funding_fee_minor':offer['fee_minor'],
            'available_cash_minor':available+offer['additional_cash_minor'],'selected_plan':None if chosen is None else chosen['id'],
            'expected_total_cost_exact':None if chosen is None else str(Fraction(chosen['expected_cost_exact'])+offer['fee_minor'])}
        funding.append(row)
        if chosen is not None:joint.append(row)
    best=min(joint,key=lambda r:(Fraction(r['expected_total_cost_exact']),r['funding_id'],r['selected_plan'])) if joint else None
    decision={'available_cash_minor':available,'options':options,'selected':selected,'break_even':cross,'funding_scenarios':funding,
        'conditional_recommendation':None if best is None else {'funding_id':best['funding_id'],'plan_id':best['selected_plan'],'expected_total_cost_exact':best['expected_total_cost_exact']}}
    with (Path(root)/'legacy-close.csv').open(encoding='utf-8',newline='') as f:legacy={r['month']:r for r in csv.DictReader(f)}
    bridge=[]
    for r in monthly:
        old=legacy.get(r['month'])
        if old is not None:bridge.append({'month':r['month'],'legacy_expense_minor':int(old['reported_expense_minor']),'corrected_expense_minor':r['expense_minor'],
            'expense_adjustment_minor':r['expense_minor']-int(old['reported_expense_minor']),'legacy_cash_close_minor':int(old['reported_cash_close_minor']),
            'corrected_cash_close_minor':r['cash_close_minor'],'cash_adjustment_minor':r['cash_close_minor']-int(old['reported_cash_close_minor'])})
    return {'format':'l03-close-result/1','documents':docs,'bank':bankout,'settlements':settlements,'journal':journal,'monthly':monthly,
        'vendors':vendors,'departments':departments,'exceptions':sorted(exceptions,key=lambda r:(r['kind'],r['identity'])),'decision':decision,'legacy_bridge':bridge}
