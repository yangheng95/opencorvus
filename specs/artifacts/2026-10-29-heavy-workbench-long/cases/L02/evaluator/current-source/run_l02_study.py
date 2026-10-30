"""Actual isolated daily reference processes. No LLM routing or candidate score."""
import argparse
from datetime import datetime,timezone
import json
from pathlib import Path
import shutil
import subprocess
import time
import uuid
import zipfile

from asof_input import InputError
from l02_scoring import ProtocolError,load_study,score
from l02_selection import assess_selection
from l02_study_data import StudySource,load_pool,write_json
from material_contract import read_json

WORKER_FILES=['l02_daily_reference.py','daily_data.py','decode_materials.py','material_contract.py','asof_input.py']
SELECTOR_FILES=['l02_selection.py','l02_scoring.py','material_contract.py','asof_input.py']


class ExecutionError(RuntimeError):
    def __init__(self,code,detail):self.code=code;super().__init__(code+':'+detail)


def timestamp():return datetime.now(timezone.utc).isoformat()


def command(argv,receipt):
    start=time.perf_counter();p=subprocess.run(list(map(str,argv)),capture_output=True,text=True,encoding='utf-8')
    write_json(receipt,{'argv':list(map(str,argv)),'exitcode':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'wall_seconds':time.perf_counter()-start})
    return p


def run_numeric(source,input_root,output,script,args,image,events):
    job=output.parent;output.mkdir();cid=None;name='oc-l02-ref-'+uuid.uuid4().hex[:14]
    argv=['docker','create','--name',name,'--network','none','--cpus','1','--env','PYTHONDONTWRITEBYTECODE=1','--env','OPENBLAS_NUM_THREADS=1','--env','OMP_NUM_THREADS=1',
        '--mount',f'type=bind,source={source.resolve()},target=/project,readonly',
        '--mount',f'type=bind,source={input_root.resolve()},target=/input,readonly',
        '--mount',f'type=bind,source={output.resolve()},target=/output','--workdir','/project',image,'/opt/cpsat/bin/python',script,*args]
    created=command(argv,job/'create-command.json')
    if created.returncode:raise ExecutionError('facility_executor_create_failed',created.stderr)
    cid=created.stdout.strip();events('numeric_started',{'container_id':cid,'name':name,'script':script,'job':str(job)})
    initial=command(['docker','inspect',cid],job/'initial-inspect-command.json')
    if initial.returncode:raise ExecutionError('facility_executor_inspect_failed',initial.stderr)
    obj=json.loads(initial.stdout)[0]
    write_json(job/'initial-inspect.json',{'Id':obj['Id'],'Image':obj['Image'],'Mounts':obj['Mounts'],'Args':obj['Args'],
        'HostConfig':{k:obj['HostConfig'][k] for k in ['NanoCpus','NetworkMode']},'State':obj['State']})
    attached=command(['docker','start','-a',cid],job/'execution-command.json')
    terminal=command(['docker','inspect',cid],job/'terminal-inspect-command.json')
    if terminal.returncode:raise ExecutionError('facility_executor_inspect_failed',terminal.stderr)
    final=json.loads(terminal.stdout)[0]
    write_json(job/'terminal-inspect.json',{'Id':final['Id'],'Image':final['Image'],'Mounts':final['Mounts'],'Args':final['Args'],
        'HostConfig':{k:final['HostConfig'][k] for k in ['NanoCpus','NetworkMode']},'State':final['State']})
    if final['State']['Status']!='exited':raise ExecutionError('facility_executor_not_terminal','original container retained: '+cid)
    archive=job/'completed-originals.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for file in sorted(job.rglob('*')):
            if file.is_file() and file!=archive:z.write(file,file.relative_to(job).as_posix())
        for file in sorted(source.rglob('*')):
            if file.is_file():z.write(file,'executed-source/'+file.relative_to(source).as_posix())
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:raise ExecutionError('facility_archive_invalid',str(archive))
    cleanup=command(['docker','rm',cid],job/'cleanup-command.json')
    if cleanup.returncode:raise ExecutionError('facility_executor_cleanup_failed',cleanup.stderr)
    events('numeric_terminal',{'container_id':cid,'exitcode':final['State']['ExitCode'],'job':str(job),'archive':str(archive)})
    if attached.returncode or final['State']['ExitCode']:
        # This runner executes sealed author reference programs, not arbitrary candidate self-ratings.
        try:failure=json.loads(attached.stdout)
        except (ValueError,TypeError):failure={}
        if type(failure) is dict and failure.get('status')=='run_invalid':raise ExecutionError('facility_numeric_input_invalid',attached.stdout)
        raise ExecutionError('candidate_cell_execution_failed',attached.stdout+attached.stderr)


def run(a):
    started=time.perf_counter()
    def event(kind,detail):
        row={'at':timestamp(),'kind':kind,**detail}
        with (a.out/'events.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps(row)+'\n')
        write_json(a.out/'status.json',row)
    source=Path(__file__).resolve().parent
    frozen=a.out/'source';frozen.mkdir()
    for file in source.glob('*.py'):shutil.copyfile(file,frozen/file.name)
    for path,name in [(a.material_contract,'material-contract.json'),(a.study,'study-contract.draft.json'),(a.pool,'reference-pool.json')]:shutil.copyfile(path,frozen/name)
    worker=a.out/'worker-source';selector=a.out/'selector-source';worker.mkdir();selector.mkdir()
    for name in WORKER_FILES:shutil.copyfile(frozen/name,worker/name)
    for name in SELECTOR_FILES:shutil.copyfile(frozen/name,selector/name)
    study=load_study(frozen/'study-contract.draft.json');pool,methods=load_pool(frozen/'reference-pool.json')
    data=StudySource(a.raw,frozen/'material-contract.json',study)
    all_outer=[g['origin_id'] for g in data.grid['origins'] if g['role']=='outer'];requested=a.outer_id or all_outer
    if len(set(requested))!=len(requested) or not set(requested)<=set(all_outer):raise InputError('registered_outer_identity')
    write_json(a.out/'registration.json',{'at':timestamp(),'outer_ids':requested,'all_registered_outer_ids':all_outer,'pool':pool,
        'mandatory_inner_ids':pool['selection_ids'],'mandatory_outer_ids':pool['outer_ids'],'scale_litres':data.scales,'image':a.image,
        'total_wall_seconds':None,'candidate_grade':None,'scope':'author reference; requested fixed outer/inner matrix, no full L02 freeze or candidate hours'})
    event('study_registered',{'outer_ids':requested,'requested_outer_count':len(requested)})
    assessed=[]
    for outer_id in requested:
        outer=data.origins[outer_id];root=a.out/'outer'/outer_id;root.mkdir(parents=True)
        inner=[g for g in data.grid['origins'] if g['role']=='inner' and g['outer_id']==outer_id]
        if len(inner)!=len(data.contract['schedule']['inner_days_before']):raise InputError('registered_inner_coverage')
        if outer['origin_tick']<data.scale_release_tick:raise InputError('selector_scale_unpublished')
        frames=[]
        for origin in inner:
            origin_id=origin['origin_id'];packet=root/'packets'/origin_id
            verification=data.packet(origin_id,packet);write_json(root/'packet-receipts'/(origin_id+'.json'),verification)
            context,labels,released=data.context_and_labels(origin_id)
            if released>outer['origin_tick']:raise InputError('inner_actual_label_unpublished')
            forecasts={}
            for method_id in pool['selection_ids']:
                job=root/'inner'/origin_id/method_id;input_root=job/'input';input_root.mkdir(parents=True)
                shutil.copytree(packet,input_root/'packet')
                write_json(input_root/'method.json',{k:methods[method_id][k] for k in ['method_id','configuration']})
                run_numeric(worker,input_root,job/'output','l02_daily_reference.py',['--input','/input/packet','--config','/input/method.json','--output','/output/result'],a.image,event)
                value=read_json(job/'output/result/forecast.json',decimal_numbers=True)
                assessment=score(value,context,labels,method_id,study);write_json(job/'metric-assessment.json',assessment)
                forecasts[method_id]=read_json(job/'output/result/forecast.json')
            frames.append({'origin_id':origin_id,'context':context,'labels':labels,'labels_released_at':released,'forecasts':forecasts})
        selection_job=root/'selector';selection_input=selection_job/'input';selection_input.mkdir(parents=True)
        payload={'format':'l02-inner-selection-packet/1','outer_origin_tick':outer['origin_tick'],'inner_ids':[g['origin_id'] for g in inner],
            'selection_ids':pool['selection_ids'],'frames':frames}
        write_json(selection_input/'inner.json',payload);write_json(selection_input/'study.json',study)
        run_numeric(selector,selection_input,selection_job/'output','l02_selection.py',['--input','/input/inner.json','--study','/input/study.json','--output','/output/result'],a.image,event)
        actual=read_json(selection_job/'output/result/selection.json');verified=assess_selection(actual,read_json(selection_input/'inner.json',decimal_numbers=True),study)
        write_json(selection_job/'assessment.json',verified);selected=actual['selected_method_id']
        packet=root/'packets'/outer_id;write_json(root/'packet-receipts'/(outer_id+'.json'),data.packet(outer_id,packet))
        context,labels,released=data.context_and_labels(outer_id);outer_scores={}
        for method_id in pool['outer_ids']:
            job=root/'outer'/method_id;input_root=job/'input';input_root.mkdir(parents=True);shutil.copytree(packet,input_root/'packet')
            write_json(input_root/'method.json',{k:methods[method_id][k] for k in ['method_id','configuration']})
            run_numeric(worker,input_root,job/'output','l02_daily_reference.py',['--input','/input/packet','--config','/input/method.json','--output','/output/result'],a.image,event)
            outer_scores[method_id]=score(read_json(job/'output/result/forecast.json',decimal_numbers=True),context,labels,method_id,study)
            write_json(job/'metric-assessment.json',outer_scores[method_id])
        record={'outer_id':outer_id,'selected_method_id':selected,'inner_selection':verified,'outer_metrics':outer_scores,'selected_metrics':outer_scores[selected],
            'outer_label_release_tick':released,'mandatory_cells_complete':True,'candidate_score':None}
        write_json(root/'assessment.json',record);assessed.append(record);event('outer_completed',{'outer_id':outer_id,'selected_method_id':selected})
    result={'status':'requested_reference_matrix_complete','outer_count':len(assessed),'assessments':assessed,'wall_seconds':time.perf_counter()-started,
        'candidate_score':None,'quality_threshold':study['quality_floor'],'scope':'daily numerical reference/method selection only; not full research delivery/rubric/freeze/candidate hours'}
    write_json(a.out/'assessment.json',result);event('study_completed',{'outer_count':len(assessed),'wall_seconds':result['wall_seconds']});print(json.dumps({'status':result['status'],'outer_count':len(assessed),'wall_seconds':result['wall_seconds']}),flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ['raw','material-contract','study','pool','out']:p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--image',required=True);p.add_argument('--outer-id',action='append');a=p.parse_args()
    try:a.out.mkdir(parents=True,exist_ok=False)
    except OSError as e:
        print(json.dumps({'status':'run_invalid','error':'output_directory_unavailable','detail':str(e),'candidate_score':None}),flush=True);raise SystemExit(3)
    try:run(a)
    except (InputError,ProtocolError,ExecutionError,OSError,ValueError,KeyError,TypeError) as e:
        code=getattr(e,'code','facility_study_execution_invalid')
        facility=code.startswith('facility_') or isinstance(e,(InputError,OSError))
        result={'status':'run_invalid' if facility else 'selection_incomplete','error':code,'detail':str(e),'candidate_score':None}
        write_json(a.out/'assessment.json',result);print(json.dumps(result),flush=True);raise SystemExit(3 if facility else 2)
