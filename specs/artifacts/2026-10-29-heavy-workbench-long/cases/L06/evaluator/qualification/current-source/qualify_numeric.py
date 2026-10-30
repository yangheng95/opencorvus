"""Actual positive/error-contract CLI checks for the 30-leaf numeric subset."""
import argparse,copy,csv,json,shutil,subprocess,sys,time,zipfile
from datetime import datetime,timezone
from pathlib import Path

from check_l06 import evaluate
from l06_delivery import expected_delivery
from l06_packet import read_packet,write_packet


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--case-root',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    root=args.output;root.mkdir(parents=True,exist_ok=False);source=root/'executed-source';source.mkdir()
    for name in ['check_l06.py','l06_input.py','l06_packet.py','l06_physics.py','l06_delivery.py','l06_numeric.py','qualify_numeric.py']:
        shutil.copy2(Path(__file__).parent/name,source/name)
    original=args.case_root;case=root/'case';case.mkdir();shutil.copytree(original/'public',case/'public')
    shutil.copy2(original/'rubric.json',case/'rubric.json')
    relative='evaluator/qualification/v2/integer-search/quality-reference/registered-reference.json'
    (case/relative).parent.mkdir(parents=True);shutil.copy2(original/relative,case/relative)
    shutil.copy2((original/relative).parent/'originals.zip',(case/relative).parent/'originals.zip')
    shutil.copy2((original/relative).parent/'price-control.zip',(case/relative).parent/'price-control.zip')
    data=read_packet(case/'public/inputs')
    with zipfile.ZipFile((original/relative).parent/'originals.zip') as archive:plan=json.loads(archive.read('quality-proof/plan.json'))
    ledger,summary=expected_delivery(data,plan,evaluate(data,plan))
    assert summary['expected_cost_minor']=={'numerator':47808,'denominator':1}
    fixtures=root/'fixtures';fixtures.mkdir()
    def write(name,value):
        p=fixtures/name;p.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n');return p
    defaults={'case_root':case,'input':case/'public/inputs','normalized':write('normalized.json',data),'plan':write('plan.json',plan),'ledger':write('ledger.json',ledger),'summary':write('summary.json',summary)}
    events=[];start=time.perf_counter()
    def run(name,expected=None,exit_code=0,infra=None,**changes):
        folder=root/name;folder.mkdir();values=defaults|changes
        cmd=[sys.executable,'-B',str(source/'l06_numeric.py')]
        for key,path in values.items():cmd+=['--'+key.replace('_','-'),str(path)]
        out=folder/'result.json';cmd+=['--out',str(out)]
        before=time.perf_counter();timestamp=datetime.now(timezone.utc).isoformat();process=subprocess.run(cmd,capture_output=True,text=True)
        (folder/'stdout.txt').write_text(process.stdout);(folder/'stderr.txt').write_text(process.stderr)
        event={'case':name,'argv':cmd,'started_utc':timestamp,'seconds':time.perf_counter()-before,'exit_code':process.returncode,'stdout':process.stdout,'stderr':process.stderr};events.append(event)
        (root/'receipt.progress.json').write_text(json.dumps({'status':'in_progress','executions':events},indent=2)+'\n')
        assert process.returncode==exit_code,(name,event)
        result=json.loads(out.read_text());assert result['total_score'] is None
        if infra:assert result['status']=='run_invalid' and result['infrastructure_error']['code']==infra,(name,result)
        else:
            assert result['status']=='partially_assessed' and result['numeric_leaf_count']==30 and result['counts']['unassessed']==17,(name,result)
            findings={f['id']:f for f in result['findings']}
            for identifier,status in (expected or {}).items():assert findings[identifier]['status']==status,(name,identifier,findings[identifier])
        return result
    full=run('full-reference')
    assert full['counts']['verified_pass']==30 and full['business_success'] is None
    with zipfile.ZipFile((original/relative).parent.parent/'originals.zip') as archive:old=json.loads(archive.read('cpsat-full/plan.json'))
    old_ledger,old_summary=expected_delivery(data,old,evaluate(data,old))
    result=run('feasible-below-quality',{'C06':'verified_fail'},2,plan=write('old-plan.json',old),ledger=write('old-ledger.json',old_ledger),summary=write('old-summary.json',old_summary))
    assert result['counts']['verified_pass']==29 and result['business_success'] is False
    for name,identifier,field in [('catalog-attribute','A01','sales_price_minor'),('supplier-attribute','A02','suppliers'),('bom-attribute','A03','bom'),('scenario-attribute','A04','scenarios')]:
        bad=copy.deepcopy(data)
        if field=='sales_price_minor':bad[field][0]+=1
        elif field=='suppliers':bad[field][0]['price_minor'][0]+=1
        elif field=='bom':bad[field][0][0]+=1
        else:bad[field][0]['demand'][0][0]+=1
        result=run(name,{identifier:'verified_fail','C06':'verified_pass'},2,normalized=write(name+'.json',bad));assert result['counts']['verified_pass']==29
    bad=copy.deepcopy(data);assert bad['allowed'][0][0]==1;bad['allowed'][0][0]=True
    run('boolean-is-not-integer',{'A03':'verified_fail'},2,normalized=write('bool-normalized.json',bad))
    name=data['scenarios'][0]['id'];bad=copy.deepcopy(plan);bad['decisions'][name]['truck_on'][-1][0]=2
    p,j=next((p,j) for p,row in enumerate(data['allowed']) for j,v in enumerate(row) if v==0)
    bad['decisions'][name]['production'][-1][p][j]+=1
    joint=run('independent-multiple-violations',{'B03':'verified_fail','B04':'blocked_candidate','B05':'blocked_candidate','B06':'verified_fail','C02':'blocked_candidate','C03':'blocked_candidate','C06':'blocked_candidate'},2,plan=write('joint-plan.json',bad))
    assert joint['business_primitive']['violation_count']>=2
    bad=copy.deepcopy(plan);bad['decisions'][name]['order_lots'][0][2][0]+=1
    run('common-information',{'B02':'verified_fail','C06':'blocked_candidate'},2,plan=write('prefix-plan.json',bad))
    zero=copy.deepcopy(plan)
    def zeros(value):return [zeros(v) for v in value] if isinstance(value,list) else 0
    for record in zero['decisions'].values():
        for field in ['order_lots','truck_on','production']:record[field]=zeros(record[field])
    run('zero-actions-are-not-low-cost',{'B09':'verified_fail','C06':'blocked_candidate','C02':'blocked_candidate'},2,plan=write('zero-plan.json',zero))
    bad=copy.deepcopy(plan);bad['decisions'][name]['production']=[]
    run('control-shape',{'B01':'candidate_incomplete','B02':'blocked_candidate','C06':'blocked_candidate'},2,plan=write('shape-plan.json',bad))
    run('omitted-plan',{'B01':'candidate_incomplete','C06':'blocked_candidate'},2,plan=fixtures/'omitted-plan.json')
    run('omitted-normalized',{i:'candidate_incomplete' for i in ['A01','A02','A03','A04']},2,normalized=fixtures/'omitted-normalized.json')
    run('omitted-summary',{'C01':'candidate_incomplete','C08':'candidate_incomplete','C06':'verified_pass','D03':'verified_pass'},2,summary=fixtures/'omitted-summary.json')
    run('omitted-ledger',{'D03':'candidate_incomplete','D06':'candidate_incomplete','C06':'verified_pass'},2,ledger=fixtures/'omitted-ledger.json')
    bad=copy.deepcopy(plan);bad['decisions'][name]['raw_inventory'][0][0]+=1
    optional=run('optional-inventory',{'D03':'verified_fail','B08':'verified_pass','C06':'verified_pass'},2,plan=write('optional-plan.json',bad));assert optional['counts']['verified_pass']==29
    reordered=root/'reordered';shutil.copytree(defaults['input'],reordered)
    for file in reordered.glob('*.csv'):
        with file.open(newline='',encoding='utf-8') as f:reader=csv.reader(f);header=next(reader);rows=list(reader)
        with file.open('w',newline='',encoding='utf-8') as f:writer=csv.writer(f);writer.writerow(header);writer.writerows(reversed(rows))
    reordered_result=run('semantic-row-order',input=reordered);assert reordered_result['counts']['verified_pass']==30
    control=root/'registered-price'
    with zipfile.ZipFile((case/relative).parent/'price-control.zip') as archive:
        instance=json.loads(archive.read('normalized.json'));control_plan=json.loads(archive.read('plan.json'))
    write_packet(instance,control)
    control_ledger,control_summary=expected_delivery(instance,control_plan,evaluate(instance,control_plan))
    registered=run('registered-monotone-price',input=control,normalized=write('control-normalized.json',instance),plan=write('control-plan.json',control_plan),ledger=write('control-ledger.json',control_ledger),summary=write('control-summary.json',control_summary))
    assert registered['counts']['verified_pass']==30
    cached=read_packet(case/'public/inputs');cached_ledger,cached_summary=expected_delivery(cached,control_plan,evaluate(cached,control_plan))
    run('cached-ledger-on-price-control',{'A02':'verified_fail','C01':'verified_fail','D05':'verified_fail','D06':'verified_fail','C06':'verified_pass'},2,input=control,normalized=write('cached-normalized.json',cached),plan=write('cached-plan.json',control_plan),ledger=write('cached-ledger.json',cached_ledger),summary=write('cached-summary.json',cached_summary))
    changed=root/'changed-price';shutil.copytree(defaults['input'],changed);file=changed/'supplier_quotes.csv'
    with file.open(newline='',encoding='utf-8') as f:reader=csv.DictReader(f);columns=reader.fieldnames;rows=list(reader)
    rows[0]['unit_price_minor']=str(int(rows[0]['unit_price_minor'])-1)
    with file.open('w',newline='',encoding='utf-8') as f:writer=csv.DictWriter(f,fieldnames=columns);writer.writeheader();writer.writerows(rows)
    run('unregistered-numerical-variant',exit_code=3,infra='reference_input_unregistered',input=changed)
    drift=root/'drifting-current-public';shutil.copytree(case,drift)
    shutil.copy2(changed/'supplier_quotes.csv',drift/'public/inputs/supplier_quotes.csv')
    run('archived-input-identity',exit_code=3,infra='reference_public_input_drift',case_root=drift,input=drift/'public/inputs')
    contradicted=root/'contradicted-reference';shutil.copytree(case,contradicted)
    policy=json.loads((contradicted/relative).read_text());policy['lower_bound_minor']={'numerator':100000,'denominator':1};(contradicted/relative).write_text(json.dumps(policy))
    run('feasible-cost-contradicts-bound',exit_code=3,infra='reference_bound_contradicted',case_root=contradicted)
    badcase=root/'bad-rubric';shutil.copytree(case,badcase);rubric=json.loads((badcase/'rubric.json').read_text(encoding='utf-8'));rubric['groups'][0]['criteria'][1]['id']=rubric['groups'][0]['criteria'][0]['id'];(badcase/'rubric.json').write_text(json.dumps(rubric))
    run('duplicate-rubric-identity',exit_code=3,infra='rubric_invalid',case_root=badcase)
    broken=root/'broken-packet';shutil.copytree(defaults['input'],broken);file=broken/'supplier_quotes.csv'
    with file.open('a') as f:f.write(file.read_text().splitlines()[1]+'\n')
    run('invalid-evaluator-packet',exit_code=3,infra='packet_invalid',input=broken)
    huge=copy.deepcopy(plan);huge['decisions'][name]['order_lots'][-1][2][0]=2**2048;huge['decisions'][name]['truck_on'][-1][2]=1
    run('large-exact-invalid-control',{'B05':'verified_fail','C06':'blocked_candidate'},2,plan=write('large-plan.json',huge))
    coefficient,s,m=max((rule['pack_units'][m]*data['raw_volume'][m],s,m) for s,rule in enumerate(data['suppliers']) for m in range(len(data['raw_materials'])))
    assert coefficient>1
    huge=copy.deepcopy(plan);huge['decisions'][name]['order_lots'][-1][s][m]=9*10**4299;huge['decisions'][name]['truck_on'][-1][s]=1
    large_path=write('large-scaled-plan.json',huge)
    boundary=run('large-derived-diagnostic',{'B05':'verified_fail','C06':'blocked_candidate'},2,plan=large_path)
    record=next(item for item in boundary['findings'] if item['id']=='B05')
    assert record['detail']['first_violation']['actual']['kind']=='large_exact_integer'
    folder=root/'original-business-large-diagnostic';folder.mkdir();out=folder/'result.json'
    cmd=[sys.executable,'-B',str(source/'check_l06.py'),'--input',str(defaults['normalized']),'--plan',str(large_path),'--out',str(out)]
    before=time.perf_counter();process=subprocess.run(cmd,capture_output=True,text=True)
    (folder/'stdout.txt').write_text(process.stdout);(folder/'stderr.txt').write_text(process.stderr)
    events.append({'case':folder.name,'argv':cmd,'exit_code':process.returncode,'seconds':time.perf_counter()-before,'stdout':process.stdout,'stderr':process.stderr})
    result=json.loads(out.read_text());assert process.returncode==2 and result['error']=='supplier_capacity' and result['actual']['kind']=='large_exact_integer'
    # Hand-calculated two-week fixtures exercise terminal context independently
    # of the production instance or any solver/reference score.
    hand={'format':'l06-feasibility-instance/2','weeks':2,'common_weeks':2,'probability_denominator':2,'raw_materials':['R'],'products':['P'],'plants':['F'],
          'suppliers':[{'id':'A','lead_weeks':0,'pack_units':[2],'price_minor':[1],'freight_minor':2,'minimum_volume':2}],
          'allowed':[[1]],'production_hours':[1],'production_cost_minor':[[1]],'bom':[[1]],'raw_volume':[1],'product_volume':[1],
          'raw_holding_minor':[1],'product_holding_minor':[0],'raw_storage_volume':2,'product_storage_volume':1,'initial_raw':[0],'initial_products':[0],
          'initial_cash_minor':1,'credit_limit_minor':5,'sales_price_minor':[10],'receipt_lag_weeks':1,
          'scenarios':[{'id':s,'probability_numerator':1,'demand':[[1],[0]],'supplier_capacity_volume':[[2],[2]],'plant_capacity_hours':[[1],[1]]} for s in ['a','b']]}
    handplan={'format':'l06-plan/1','decisions':{s:{'order_lots':[[[1]],[[0]]],'truck_on':[[1],[0]],'production':[[[1]],[[0]]]} for s in ['a','b']}}
    def hand_case(label,instance):
        c=root/label;c.mkdir();(c/'public').mkdir();write_packet(instance,c/'public/inputs')
        r=json.loads((case/'rubric.json').read_text(encoding='utf-8'));r['quality_reference']['registration_file']='reference.json';(c/'rubric.json').write_text(json.dumps(r))
        with zipfile.ZipFile(c/'input-capture.zip','w',zipfile.ZIP_DEFLATED) as archive:archive.writestr('input.json',json.dumps(instance))
        (c/'reference.json').write_text(json.dumps({'format':'l06-quality-reference/2','status':'registered_before_fresh_candidate','derived_variants':[],'input_identity':{'public':'public/inputs','captured_input':'input-capture.zip:input.json'},'lower_bound_minor':{'numerator':7,'denominator':1},'reference_id':'known-hand-fixture-not-benchmark','bound_source':{'kind':'analytical_hand_fixture'}}))
        return c
    handroot=hand_case('hand-feasible',hand);hledger,hsummary=expected_delivery(hand,handplan,evaluate(hand,handplan));assert hsummary['expected_cost_minor']=={'numerator':7,'denominator':1}
    hargs={'case_root':handroot,'input':handroot/'public/inputs','normalized':write('hand-normalized.json',hand),'plan':write('hand-plan.json',handplan),'ledger':write('hand-ledger.json',hledger),'summary':write('hand-summary.json',hsummary)}
    run('hand-two-week-cash',{'C02':'verified_pass','C03':'verified_pass','C06':'verified_pass'},**hargs)
    intermediate=copy.deepcopy(hand);intermediate['credit_limit_minor']=4;c=hand_case('hand-insufficient-credit',intermediate)
    run('intermediate-cash-context',{'C02':'verified_fail','C03':'verified_pass','C06':'blocked_candidate'},2,**(hargs|{'case_root':c,'input':c/'public/inputs','normalized':write('intermediate-normalized.json',intermediate)}))
    terminal=copy.deepcopy(hand);terminal['sales_price_minor']=[0];c=hand_case('hand-no-terminal-receipt',terminal)
    run('terminal-cash-context',{'C02':'verified_pass','C03':'verified_fail','C06':'blocked_candidate'},2,**(hargs|{'case_root':c,'input':c/'public/inputs','normalized':write('terminal-normalized.json',terminal)}))
    receipt={'status':'passed','actual_cli_commands':len(events),'seconds':time.perf_counter()-start,'scope':'30 numeric predicates and typed dependency/infrastructure contracts; not full task/candidate/hour qualification','executions':events}
    (root/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='executions'}))


if __name__=='__main__':main()
