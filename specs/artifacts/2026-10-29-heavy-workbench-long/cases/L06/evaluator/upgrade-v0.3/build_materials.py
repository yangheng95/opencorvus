"""Author construction of explicit new multi-stage raw materials, not a grader."""
from pathlib import Path
from copy import deepcopy
import argparse,json,itertools,sys,shutil,subprocess

HERE=Path(__file__).resolve().parent
CORE=HERE.parent/'qualification/current-source';sys.path.insert(0,str(CORE));sys.path.insert(0,str(HERE/'source'))
from l06_packet import read_packet,write_packet
from tree_business import contingency

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    old=read_packet(HERE.parents[1]/'public/inputs');data=deepcopy(old)
    data.update(common_weeks=0,probability_denominator=8,initial_cash_minor=12000,credit_limit_minor=9000)
    base,shift=old['scenarios'][0],old['scenarios'][2];paths=[]
    for index,bits in enumerate(itertools.product((0,1),repeat=3)):
        s={'id':'T'+str(index).zfill(2),'probability_numerator':1,'demand':[],'supplier_capacity_volume':[],'plant_capacity_hours':[]}
        for t in range(16):
            stage=t//4;bit=0 if stage==0 else bits[stage-1]
            s['demand'].append(deepcopy((shift if bit else base)['demand'][t]))
            # Announced current supply is observed before the current action;
            # old orders still arrive regardless of this week's capacity.
            s['supplier_capacity_volume'].append([30 if bit else 80,75,140])
            s['plant_capacity_hours'].append([24,34 if bit else 31])
        paths.append(s)
    data['scenarios']=paths;write_packet(data,a.out/'inputs')
    # Publication metadata and public wire prose have one current source.
    contract=json.loads((HERE/'public-draft/tree-contract.json').read_text(encoding='utf-8'))
    (a.out/'tree-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf-8')
    baseline,audit=contingency(data)
    # This author-side witness must never be included in candidate public input.
    (a.out.parent/(a.out.name+'-contingency-policy.json')).write_text(json.dumps(baseline,indent=2)+'\n')
    (a.out.parent/(a.out.name+'-contingency-audit.json')).write_text(json.dumps(audit,indent=2)+'\n')
    for name in ('TASK.md','OUTPUTS.md','OPERATIONS.md'):shutil.copy2(HERE/'public-draft'/name,a.out/name)
    subprocess.run([sys.executable,'-B',str(HERE/'build_public_runtime.py'),'--public',str(a.out)],check=True)
    print(json.dumps({'raw_paths':len(paths),'weeks':16,'contingency_cost':audit['expected_cost_exact'],'all_business_and_information_valid':audit['policy_valid']}))
if __name__=='__main__':main()
