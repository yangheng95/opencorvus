"""Author-only synthetic source documents, never supplied to candidates."""
import json,copy,csv
from pathlib import Path
from datetime import date,timedelta

def build(root):
    root=Path(root);root.mkdir(parents=True,exist_ok=False)
    def obj(name,value):(root/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    def table(name,values):(root/name).write_text(''.join(json.dumps(v,ensure_ascii=False)+'\n' for v in values),encoding='utf-8')
    months=['2025-01','2025-02','2025-03'];departments=['Engineering','Operations','Marketing']
    obj('company.json',{'format':'l03-company/1','as_of':'2025-04-15T18:00:00Z','months':months,'base_currency':'CNY','opening_cash_minor':2000000,'bank_overdraft_limit_minor':600000,
        'departments':departments,'policy':'per-line conversion, final-month remainder, cumulative settlement book value; see POLICY.md'})
    fx=[]
    for i,m in enumerate(months):
        for currency,rate in [('CNY','1.00'),('USD',['7.10','7.17','7.22'][i]),('EUR',['7.72','7.75','7.81'][i])]:
            fx.append({'source_id':f'FX-{m}-{currency}-0','currency':currency,'rate_date':m+'-01','revision':0,'released_at':m+'-01T08:00:00Z','rate':rate})
    fx+=[{'source_id':'FX-Jan-correction','currency':'USD','rate_date':'2025-01-01','revision':1,'released_at':'2025-04-10T09:00:00Z','rate':'7.10'},
         {'source_id':'FX-unpublished','currency':'USD','rate_date':'2025-01-01','revision':2,'released_at':'2025-04-30T09:00:00Z','rate':'7.90'}]
    fx[1]['rate']='7.01';table('fx.jsonl',fx)
    docs=[]
    for i in range(72):
        m=months[i%3];start=i%3;service=months[start:min(3,start+1+i%2)]
        d={'source_id':f'export-A-{i}','doc_id':f'I{i:03}','revision':0,'released_at':m+'-06T09:00:00Z','status':'posted','kind':'invoice',
            'vendor':'V'+str(i%8),'department':departments[(i//3)%3],'currency':['CNY','USD','EUR'][i%3],'rate_date':m+'-01','book_month':m,
            'service_months':service,'lines':[{'line_id':'a','amount':f'{30+i*3}.{(i*17)%100:02}'},{'line_id':'b','amount':f'{5+i%9}.{(i*11)%100:02}'}],
            'note':'采购/订阅；原行身份不随导出批次变化'}
        docs.append(d)
        if i%9==0:docs.append({**copy.deepcopy(d),'source_id':f'export-B-duplicate-{i}'})
        if i%11==0:
            correction=copy.deepcopy(d);correction.update(source_id=f'correction-{i}',revision=1,released_at='2025-04-12T10:00:00Z');correction['lines'][0]['amount']=f'{40+i*3}.55';docs.append(correction)
        if i%13==0:
            later=copy.deepcopy(d);later.update(source_id=f'unpublished-{i}',revision=3,released_at='2025-05-01T10:00:00Z');later['lines'][0]['amount']='9999.99';docs.append(later)
    def special(identity,amount,kind='invoice',revision=0,status='posted',released='2025-01-07T09:00:00Z',vendor='AnchorVendor'):
        return {'source_id':identity+'-source-'+str(revision)+'-'+amount,'doc_id':identity,'revision':revision,'released_at':released,'status':status,'kind':kind,
            'vendor':vendor,'department':'Operations','currency':'CNY','rate_date':'2025-01-01','book_month':'2025-01','service_months':['2025-01'],
            'lines':[{'line_id':'one','amount':amount}],'note':'完整题包内的可手算原单'}
    docs += [special('I-anchor','100.00'),special('C-anchor','10.00','credit',released='2025-04-10T09:00:00Z'),
             special('I-cancelled','250.00'),special('I-cancelled','250.00',revision=1,status='cancelled',released='2025-03-01T09:00:00Z'),
             special('I-conflict','100.00',vendor='UncertainVendor'),special('I-conflict','120.00',revision=1,vendor='UncertainVendor'),special('I-conflict','125.00',revision=1,vendor='UncertainVendor'),
             special('I-resolved','100.00',vendor='ResolvedVendor'),special('I-resolved','110.00',revision=1,vendor='ResolvedVendor'),special('I-resolved','111.00',revision=1,vendor='ResolvedVendor'),
             special('I-resolved','170.00',revision=2,released='2025-04-13T09:00:00Z',vendor='ResolvedVendor')]
    r=special('I-rounding','0.05',vendor='RoundingVendor');r['currency']='USD';r['lines']=[{'line_id':'x','amount':'0.05'},{'line_id':'y','amount':'0.05'}];docs.append(r)
    table('documents.jsonl',docs)
    from closing_rules import latest,native,rounded_ratio
    selected=latest(docs,['doc_id'],'2025-04-15T18:00:00Z');banks=[];advice=[]
    def payment(identity,month,allocations,fee=3,extra=0,status='confirmed'):
        total=sum(a['cash_minor'] for a in allocations)+fee+extra
        release=(date.fromisoformat(month+'-28')+timedelta(days=1)).isoformat()
        b={'source_id':identity+'-A','bank_tx_id':identity,'posted_at':month+'-28T10:00:00Z','released_at':release+'T08:00:00Z',
            'amount_minor':total,'fee_minor':fee,'vendor_hint':'statement text is not allocation authority','narrative':'transfer / 付款'}
        banks.append(b)
        if len(banks)%5==0:banks.append({**b,'source_id':identity+'-B-duplicate'})
        if allocations:advice.append({'source_id':'advice-'+identity,'bank_tx_id':identity,'revision':0,'released_at':release+'T09:00:00Z','status':status,'allocations':allocations,'note':'付款通知；仅confirmed可确认为结算'})
    for i in range(42):
        d=selected[(f'I{i:03}',)];amount=sum(native(l['amount']) for l in d['lines']);currency=d['currency'];rate={'CNY':100,'USD':713,'EUR':777}[currency]
        def allocation(value):return {'doc_id':d['doc_id'],'amount_native':f'{value//100}.{value%100:02}','cash_minor':rounded_ratio(value*rate,100)}
        month=d['book_month']
        if i%4==0:
            first=amount*3//5;payment(f'P{i:03}a',month,[allocation(first)])
            nextmonth=months[min(2,months.index(month)+1)];payment(f'P{i:03}b',nextmonth,[allocation(amount-first)],extra=2 if i%8==0 else 0)
        else:payment(f'P{i:03}',month,[allocation(amount)],status='ambiguous' if i in [7,19] else 'confirmed')
    payment('P-anchor-a','2025-01',[{'doc_id':'I-anchor','amount_native':'40.00','cash_minor':4000}],fee=0)
    payment('P-anchor-b','2025-02',[{'doc_id':'I-anchor','amount_native':'60.00','cash_minor':6000}],fee=0)
    payment('P-unknown','2025-01',[],fee=0,extra=700)
    # One bank transfer genuinely settles two distinct invoices.
    merged=[]
    for i in [42,43]:
        d=selected[(f'I{i:03}',)];n=sum(native(l['amount']) for l in d['lines']);rate={'CNY':100,'USD':713,'EUR':777}[d['currency']]
        merged.append({'doc_id':d['doc_id'],'amount_native':f'{n//100}.{n%100:02}','cash_minor':rounded_ratio(n*rate,100)})
    payment('P-merged','2025-03',merged)
    table('bank.jsonl',banks);table('advice.jsonl',advice)
    budgets=[]
    for month in months:
        for dept in departments+['Finance']:budgets.append({'source_id':f'budget-{month}-{dept}','department':dept,'month':month,'revision':0,'released_at':'2024-12-20T09:00:00Z','amount_minor':100000 if dept!='Finance' else 1500})
    table('budgets.jsonl',budgets)
    commitments=[{'source_id':'commit-source-'+str(i),'commit_id':'K'+str(i),'revision':0,'released_at':'2025-03-01T09:00:00Z',
        'department':departments[i%3],'expected_month':months[i%3],'status':'cancelled' if i==4 else 'open','amount_minor':9000+i*1700} for i in range(9)]
    table('commitments.jsonl',commitments)
    obj('choices.json',{'format':'l03-management-choices/1','reserve_minor':500000,
        'funding_offers':[{'id':'current','additional_cash_minor':0,'fee_minor':0,'status':'current'},
            {'id':'bridge','additional_cash_minor':5000000,'fee_minor':25000,'status':'offered_unaccepted'},
            {'id':'expanded','additional_cash_minor':5500000,'fee_minor':50000,'status':'offered_unaccepted'}],
        'scenarios':[{'id':'low','units':80,'probability':'1/2'},{'id':'high','units':160,'probability':'1/2'}],
        'options':[{'id':'renew','fixed_minor':120000,'unit_minor':600,'capacity':200,'upfront_minor':100000},
                   {'id':'switch','fixed_minor':30000,'unit_minor':1300,'capacity':120,'upfront_minor':20000},
                   {'id':'hybrid','fixed_minor':80000,'unit_minor':800,'capacity':200,'upfront_minor':50000},
                   {'id':'bulk','fixed_minor':150000,'unit_minor':100,'capacity':200,'upfront_minor':900000}]})
    write_legacy(root)
    print(json.dumps({'documents_raw':len(docs),'bank_export_rows':len(banks),'advice_rows':len(advice),'source':'original synthetic author materials'}))

def write_legacy(root):
    """A genuinely different old bookkeeping policy; not a perturbed gold result."""
    from collections import defaultdict
    from closing_rules import rows,read,converted
    c=read(root,'company.json');oldrates={(r['currency'],r['rate_date']):r['rate'] for r in rows(root,'fx.jsonl') if r['revision']==0}
    expense=defaultdict(int);seen=set()
    for d in rows(root,'documents.jsonl'):
        if d['revision']!=0 or d['doc_id'] in seen:continue
        seen.add(d['doc_id']);expense[d['book_month']]+=sum(converted(r['amount'],oldrates[d['currency'],d['rate_date']]) for r in d['lines'])*(1 if d['kind']=='invoice' else -1)
    cash=c['opening_cash_minor'];out=[]
    for month in c['months']:
        cash-=sum(r['amount_minor'] for r in rows(root,'bank.jsonl') if r['posted_at'][:7]==month)
        out.append({'month':month,'reported_expense_minor':expense[month],'reported_cash_close_minor':cash,'basis':'original legacy management export, not authoritative corrected truth'})
    with (Path(root)/'legacy-close.csv').open('w',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(out[0]));writer.writeheader();writer.writerows(out)
if __name__=='__main__':
    import sys
    build(sys.argv[1])
