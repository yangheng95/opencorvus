"""Actual CLI checks for raw business facts; not a candidate or hardness score."""
import argparse
import csv
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    root=args.output;root.mkdir(parents=True,exist_ok=False);source=Path(__file__).parent
    original=json.loads((source/'v2/inputs/full.json').read_text());expected={k:v for k,v in original.items() if k not in ('status','qualification_variant')}
    events=[];start=time.perf_counter()
    def run(mode,where,out,code=0):
        command=[sys.executable,'-B',str(source/'l06_packet.py'),'--mode',mode,'--input',str(where),'--output',str(out)]
        begin=time.perf_counter();result=subprocess.run(command,capture_output=True,text=True)
        events.append({'command':command,'exit_code':result.returncode,'stdout':result.stdout,'stderr':result.stderr,'seconds':time.perf_counter()-begin})
        assert result.returncode==code,events[-1]
        return json.loads(result.stdout)
    packet=root/'packet';run('export',source/'v2/inputs/full.json',packet)
    run('read',packet,root/'normalized.json')
    assert json.loads((root/'normalized.json').read_text())==expected
    changed=root/'quote-change';shutil.copytree(packet,changed)
    file=changed/'supplier_quotes.csv'
    with file.open(newline='',encoding='utf-8') as stream:reader=csv.DictReader(stream);columns=reader.fieldnames;rows=list(reader)
    before=int(rows[0]['unit_price_minor']);assert before>=1
    rows[0]['unit_price_minor']=str(before-1)
    with file.open('w',newline='',encoding='utf-8') as stream:writer=csv.DictWriter(stream,fieldnames=columns);writer.writeheader();writer.writerows(rows)
    run('read',changed,root/'quote-change-normalized.json')
    changed_expected=json.loads(json.dumps(expected));changed_expected['suppliers'][0]['price_minor'][0]-=1
    assert json.loads((root/'quote-change-normalized.json').read_text())==changed_expected
    reordered=root/'index-order';shutil.copytree(packet,reordered)
    file=reordered/'raw_materials.csv'
    with file.open(newline='',encoding='utf-8') as stream:reader=csv.DictReader(stream);columns=reader.fieldnames;rows=list(reader)
    with file.open('w',newline='',encoding='utf-8') as stream:writer=csv.DictWriter(stream,fieldnames=columns);writer.writeheader();writer.writerows(reversed(rows))
    run('read',reordered,root/'index-order-normalized.json')
    assert json.loads((root/'index-order-normalized.json').read_text())==expected
    duplicate=root/'duplicate-quote';shutil.copytree(packet,duplicate)
    file=duplicate/'supplier_quotes.csv'
    with file.open(newline='',encoding='utf-8') as stream:reader=csv.DictReader(stream);columns=reader.fieldnames;rows=list(reader)
    with file.open('a',newline='',encoding='utf-8') as stream:csv.DictWriter(stream,fieldnames=columns).writerow(rows[0])
    response=run('read',duplicate,root/'duplicate-normalized.json',2)
    assert response['error']=='packet_invalid' and response['where']=='supplier_quotes'
    receipt={'status':'passed','actual_cli_commands':len(events),'full_business_projection_equal':True,
             'changed_price':{'supplier':expected['suppliers'][0]['id'],'raw':expected['raw_materials'][0],'before':before,'after':before-1},
             'reordered_catalog_projection':True,'duplicate_key_error':response,'seconds':time.perf_counter()-start,
             'scope':'input-fact qualification only; no perturbation cost optimum, formal benchmark score or hours claimed','executions':events}
    (root/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k!='executions'}))


if __name__=='__main__':main()
