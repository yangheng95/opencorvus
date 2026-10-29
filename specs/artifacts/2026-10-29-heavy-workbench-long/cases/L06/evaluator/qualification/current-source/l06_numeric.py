"""Thirty numeric findings using one business recurrence. Not a complete case grade."""
import argparse,copy
from decimal import Decimal
from fractions import Fraction
import json
from pathlib import Path
import zipfile

from check_l06 import inspect_plan,PlanError
from l06_input import read_json,decode_json,validate_instance,InputError
from l06_packet import read_packet
from l06_delivery import (operational_decisions,expected_delivery,assess_summary,assess_ledger,
                          assess_inventory_claims,finding,SUMMARY_FIELDS,LEDGER_FIELDS)


FACT_GROUPS={
    'A01':['format','raw_materials','products','plants','raw_volume','raw_holding_minor','initial_raw',
           'product_volume','product_holding_minor','initial_products','production_hours','sales_price_minor'],
    'A02':['suppliers'],
    'A03':['bom','allowed','production_cost_minor'],
    'A04':['weeks','common_weeks','probability_denominator','raw_storage_volume','product_storage_volume',
           'initial_cash_minor','credit_limit_minor','receipt_lag_weeks','scenarios'],
}
PHYSICAL={
    'B02':'common_commitment','B03':'shipment_binary','B04':'shipment_minimum','B05':'supplier_capacity',
    'B06':'product_assignment','B07':'plant_capacity','B08':'raw_availability','B09':'fulfilment',
    'B10':'raw_storage_peak','B11':'product_storage_peak',
    'C04':'terminal_pipeline','C05':'terminal_finished',
}
OUTPUT_IDS=['C01',*SUMMARY_FIELDS,*LEDGER_FIELDS]
NUMERIC_IDS=[*FACT_GROUPS,'B01',*PHYSICAL,'C02','C03','C06',*OUTPUT_IDS]


class EvaluationError(ValueError):
    def __init__(self,code,detail):self.code,self.detail=code,detail;super().__init__(detail)


def load_rubric(path):
    rubric=read_json(path,'rubric_invalid',decimal_numbers=True)
    try:
        criteria=[criterion for group in rubric['groups'] for criterion in group['criteria']]
        identifiers=[c['id'] for c in criteria]
        valid=(rubric['criterion_count']==len(criteria) and len(set(identifiers))==len(identifiers)
               and all(type(c['id']) is str and type(c['critical']) is bool and type(c['weight']) in (int,Decimal) and c['weight']>=0 for c in criteria)
               and sum(c['weight'] for c in criteria)==rubric['total_weight']==100
               and set(NUMERIC_IDS)<=set(identifiers))
        if not valid:raise EvaluationError('rubric_invalid','unique criterion identities, exact declared coverage/weights and critical flags required')
    except (KeyError,TypeError) as error:raise EvaluationError('rubric_invalid',str(error)) from error
    return rubric,criteria


def same_value(actual,expected):
    if type(actual) is not type(expected):return False
    if isinstance(expected,dict):return set(actual)==set(expected) and all(same_value(actual[k],v) for k,v in expected.items())
    if isinstance(expected,list):return len(actual)==len(expected) and all(same_value(a,e) for a,e in zip(actual,expected))
    return actual==expected


def facts_findings(data,path):
    try:actual=read_json(path,'normalized_json')
    except InputError as error:return [finding(i,'candidate_incomplete','normalized',{'code':error.code,'detail':error.detail}) for i in FACT_GROUPS]
    if not isinstance(actual,dict):return [finding(i,'candidate_incomplete','normalized','normalized object required') for i in FACT_GROUPS]
    results=[]
    for identifier,fields in FACT_GROUPS.items():
        missing=[key for key in fields if key not in actual]
        if missing:results.append(finding(identifier,'candidate_incomplete','normalized',{'missing':missing}));continue
        wrong=[key for key in fields if not same_value(actual[key],data[key])]
        results.append(finding(identifier,'verified_fail' if wrong else 'verified_pass','normalized',{'fields_mismatched':wrong}))
    return results


def load_reference(case_root,rubric,data):
    try:
        spec=rubric['quality_reference'];filename=(case_root/spec['registration_file']).resolve()
        if not filename.is_relative_to(case_root):raise EvaluationError('reference_config_invalid','registration file must be in the evaluator case root')
        reference=read_json(filename,'reference_config_invalid')
        if reference['format']!='l06-quality-reference/2' or reference['status']!='registered_before_fresh_candidate':raise EvaluationError('reference_unregistered','current reference contract is not registered')
        if type(reference['reference_id']) is not str or not reference['reference_id'].strip():raise EvaluationError('reference_config_invalid','nonempty base reference identity required')
        if type(reference['bound_source']['kind']) is not str or not reference['bound_source']['kind'].strip():raise EvaluationError('reference_config_invalid','nonempty bound-source kind required')
        packet=(filename.parent/reference['input_identity']['public']).resolve()
        if not packet.is_relative_to(case_root/'public'):raise EvaluationError('reference_config_invalid','registered packet must be public input')
        registered=read_packet(packet)
        def capture(locator):
            if not isinstance(locator,str):raise EvaluationError('reference_config_invalid','captured input locator must be a string')
            archive_name,separator,member=locator.partition(':');archive_path=(filename.parent/archive_name).resolve()
            if not separator or not member or not archive_path.is_relative_to(case_root):raise EvaluationError('reference_config_invalid','captured input must identify a case-local archive/member')
            try:
                with zipfile.ZipFile(archive_path) as archive:raw=archive.read(member)
            except (OSError,zipfile.BadZipFile,KeyError) as error:raise EvaluationError('reference_evidence_invalid',str(error)) from error
            value=validate_instance(decode_json(raw,'reference_evidence_invalid',source=str(archive_path)+':'+member))
            return {key:item for key,item in value.items() if key not in ('status','qualification_variant')}
        captured=capture(reference['input_identity']['captured_input'])
        if not same_value(registered,captured):raise EvaluationError('reference_public_input_drift','current public facts differ from the archived registered input')
        matched=reference['reference_id'] if same_value(data,captured) else None
        identifiers={reference['reference_id']};variants=reference['derived_variants']
        if not isinstance(variants,list):raise EvaluationError('reference_config_invalid','explicit derived variant list required')
        for variant in variants:
            identifier=variant['reference_id'];change=variant['transformation']
            if type(identifier) is not str or not identifier.strip() or identifier in identifiers:raise EvaluationError('reference_config_invalid','unique nonempty reference IDs required')
            identifiers.add(identifier)
            if change['kind']!='monotone_supplier_price_increase' or type(change['delta_minor']) is not int or change['delta_minor']<=0:raise EvaluationError('reference_config_invalid','only the proved positive supplier-price transformation is registered')
            expected=copy.deepcopy(captured)
            suppliers=[i for i,rule in enumerate(expected['suppliers']) if rule['id']==change['supplier_id']]
            materials=[i for i,name in enumerate(expected['raw_materials']) if name==change['raw_id']]
            if len(suppliers)!=1 or len(materials)!=1:raise EvaluationError('reference_config_invalid','derived transformation identities must resolve uniquely')
            expected['suppliers'][suppliers[0]]['price_minor'][materials[0]]+=change['delta_minor']
            actual=capture(variant['input_identity']['captured_input'])
            if not same_value(actual,expected):raise EvaluationError('reference_variant_drift','derived captured facts differ from the exact registered transformation')
            if same_value(data,actual):
                if matched is not None:raise EvaluationError('reference_config_invalid','input matches more than one registration')
                matched=identifier
        if matched is None:raise EvaluationError('reference_input_unregistered','semantic input matches neither the archived base nor an explicitly registered derived variant')
        value=reference['lower_bound_minor']
        if type(value['numerator']) is not int or type(value['denominator']) is not int or value['denominator']<=0:
            raise EvaluationError('reference_config_invalid','positive rational lower bound required')
        lower=Fraction(value['numerator'],value['denominator'])
        maximum=spec['maximum_relative_gap']
        if type(maximum) not in (int,Decimal):raise EvaluationError('reference_config_invalid','exact relative-gap value required')
        maximum=Fraction(maximum)
        if lower<=0 or maximum<0 or spec['relative_gap_definition']!='(C-L)/L':raise EvaluationError('reference_config_invalid','positive L and registered gap definition required')
        return {'id':matched,'lower':lower,'maximum':maximum,'kind':reference['bound_source']['kind']}
    except (KeyError,TypeError,ValueError) as error:
        if isinstance(error,(EvaluationError,InputError)):raise
        raise EvaluationError('reference_config_invalid',str(error)) from error


def business_findings(data,plan,reference):
    try:inspection=inspect_plan(data,operational_decisions(plan))
    except PlanError as error:
        return ([finding('B01','candidate_incomplete','plan',{'code':error.code,'where':error.where})]+
                [finding(i,'blocked_candidate','plan','control schema/domain is incomplete') for i in [*PHYSICAL,'C02','C03','C06',*OUTPUT_IDS]]),None
    results=[finding('B01','verified_pass','plan.control_schema')]
    violations={identifier:[] for identifier in [*PHYSICAL,'C02','C03']}
    reverse={code:identifier for identifier,code in PHYSICAL.items()}
    for error in inspection['violations']:
        if error['code']=='cash_limit':
            context=error['context']
            if type(context.get('terminal')) is not bool:raise EvaluationError('business_mapping_invalid','cash terminal context missing')
            identifier='C03' if context['terminal'] else 'C02'
        elif error['code'] in reverse:identifier=reverse[error['code']]
        else:raise EvaluationError('business_mapping_invalid','unmapped business violation '+error['code'])
        violations[identifier].append(error)
    by_id={}
    for identifier,code in PHYSICAL.items():
        checks=inspection['constraint_checks'].get(code,0)
        if checks<1:raise EvaluationError('business_mapping_invalid','business family did not execute: '+code)
        value=finding(identifier,'verified_fail' if violations[identifier] else 'verified_pass',code,
                      {'executed_predicates':checks,'violation_count':len(violations[identifier]),'first_violation':violations[identifier][0] if violations[identifier] else None})
        by_id[identifier]=value;results.append(value)
    # MOQ/capacity interpretations require a legal 0/1 shipping decision.
    if by_id['B03']['status']!='verified_pass':
        for identifier in ['B04','B05']:
            value=finding(identifier,'blocked_candidate','truck_on','0/1 shipment domain is a prerequisite')
            by_id[identifier]=value
        results=[by_id.get(item['id'],item) for item in results]
    physical_ok=all(item['status']=='verified_pass' for item in by_id.values())
    for identifier,key in [('C02','cash_intermediate'),('C03','cash_terminal')]:
        checks=inspection['constraint_checks'].get(key,0)
        if checks<1 and not (identifier=='C02' and data['weeks']==1):raise EvaluationError('business_mapping_invalid','cash family did not execute: '+key)
        results.append(finding(identifier,'verified_fail' if violations[identifier] else 'verified_pass',key,
                               {'executed_predicates':checks,'violation_count':len(violations[identifier]),'first_violation':violations[identifier][0] if violations[identifier] else None})
                       if physical_ok else finding(identifier,'blocked_candidate','physical_contract','financial findings require executable physical/information/terminal constraints'))
    if inspection['business_feasible']:
        cost=Fraction(inspection['expected_cost_exact']['numerator'],inspection['expected_cost_exact']['denominator'])
        if cost<reference['lower']:raise EvaluationError('reference_bound_contradicted','a complete business-feasible cost is below the registered lower bound; audit the reference/model before scoring')
        gap=(cost-reference['lower'])/reference['lower']
        results.append(finding('C06','verified_pass' if gap<=reference['maximum'] else 'verified_fail','registered_reference',
                               {'reference_id':reference['id'],'trust_kind':reference['kind'],'cost_exact':str(cost),'relative_gap_exact':str(gap)}))
    else:
        results.append(finding('C06','blocked_candidate','business_contract','quality requires a complete business-feasible plan'))
        results.extend(finding(i,'blocked_candidate','business_contract','derived deliverable values require a complete business-feasible plan') for i in OUTPUT_IDS)
    return results,inspection


def output_findings(data,plan,inspection,summary_path,ledger_path):
    ledger,summary=expected_delivery(data,plan,inspection);results=[]
    for name,path,expected,assessor,ids in [('summary',summary_path,summary,assess_summary,['C01',*SUMMARY_FIELDS]),('ledger',ledger_path,ledger,assess_ledger,list(LEDGER_FIELDS))]:
        try:actual=read_json(path,name+'_json',decimal_numbers=name=='summary')
        except InputError as error:results.extend(finding(i,'candidate_incomplete',name,{'code':error.code,'detail':error.detail}) for i in ids)
        else:results.extend(assessor(actual,expected))
    claims=assess_inventory_claims(plan,ledger)
    if claims['status']!='verified_pass':results=[claims if item['id']=='D03' and item['status']=='verified_pass' else item for item in results]
    return results


def assess(args):
    root=args.case_root.resolve()
    result={'format':'l06-numeric-findings/1','status':'partially_assessed','scope':'30 numeric leaves only; execution/review and complete case grade pending','total_score':None,'business_success':None,'findings':[]}
    try:
        rubric,criteria=load_rubric(root/'rubric.json')
        data=read_packet(args.input);reference=load_reference(root,rubric,data)
        findings=facts_findings(data,args.normalized)
        try:plan=read_json(args.plan,'plan_json')
        except InputError as error:
            calculated=[finding('B01','candidate_incomplete','plan',{'code':error.code,'detail':error.detail})]
            calculated.extend(finding(i,'blocked_candidate','plan','control input cannot be decoded') for i in [*PHYSICAL,'C02','C03','C06',*OUTPUT_IDS]);inspection=None
        else:
            calculated,inspection=business_findings(data,plan,reference)
            if inspection is not None and inspection['business_feasible']:calculated.extend(output_findings(data,plan,inspection,args.summary,args.ledger))
        findings.extend(calculated);mapping={item['id']:item for item in findings}
        if len(mapping)!=len(NUMERIC_IDS) or set(mapping)!=set(NUMERIC_IDS):raise EvaluationError('numeric_mapping_invalid','numeric findings must cover exactly the declared 30 leaves')
        result['findings']=[mapping.get(c['id'],finding(c['id'],'unassessed','evaluator','execution or independent review adapter is not implemented')) for c in criteria]
        result['numeric_leaf_count']=len(NUMERIC_IDS)
        result['counts']={status:sum(item['status']==status for item in result['findings']) for status in ['verified_pass','verified_fail','candidate_incomplete','blocked_candidate','unassessed']}
        failures=[c['id'] for c in criteria if c['critical'] and mapping.get(c['id'],{}).get('status') in ['verified_fail','candidate_incomplete','blocked_candidate']]
        result['known_critical_failures']=failures
        if failures:result['business_success']=False
        if inspection is not None:result['business_primitive']={'business_feasible':inspection['business_feasible'],'violation_count':len(inspection['violations']),'constraint_checks':inspection['constraint_checks']}
    except (InputError,EvaluationError) as error:
        result.update(status='run_invalid',business_success=None,infrastructure_error={'code':error.code,'detail':getattr(error,'detail',str(error))},findings=[])
    return result


def main():
    parser=argparse.ArgumentParser()
    for name in ['case-root','input','normalized','plan','summary','ledger','out']:parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args();result=assess(args)
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({key:value for key,value in result.items() if key not in ['findings','business_primitive']},allow_nan=False))
    raise SystemExit(3 if result['status']=='run_invalid' else 2 if result['counts']['verified_fail']+result['counts']['candidate_incomplete']+result['counts']['blocked_candidate'] else 0)


if __name__=='__main__':main()
