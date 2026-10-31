"""Explicit v1 closed-container receipt to v2 historical metadata projection.

Never queries/runs a container. The full original capsule remains immutable;
this small previous-segment receipt does not pretend to contain its model state.
"""
from pathlib import Path
import argparse,hashlib,json,zipfile

def identity(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return {'bytes':path.stat().st_size,'sha256':h.hexdigest(),'meaning':'identity of the preserved closed original, not source/science correctness'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--original',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    if a.out.exists():raise ValueError('new migration object required; original objects are never overwritten')
    with zipfile.ZipFile(a.original) as z:
        capture=json.loads(z.read('inspect.json'));values=json.loads(capture['stdout'])
        if capture['exit_code']!=0 or len(values)!=1:raise ValueError('original actual inspect receipt required')
        old=values[0];state=old['State'];startup=json.loads(z.read('results/study-started.json'))
        if state['Status']!='exited' or state['Running'] or type(state['ExitCode']) is not int or type(startup['pid']) is not int:raise ValueError('original natural native terminal required')
        mounts=[v for v in old['Mounts'] if v['Destination']=='/project']
        if len(mounts)!=1:raise ValueError('original source identity required')
        projected={'format':'l01-controlled-execution/2','execution_id':'historical-'+old['Id'],'backend':'historical-container','pid':startup['pid'],'pid_scope':'original container namespace, not a Windows PID','project_root':mounts[0]['Source'],'argv':old['Config']['Cmd'],'started_at':state['StartedAt'],'finished_at':state['FinishedAt'],'state':{'status':'exited','exit_code':state['ExitCode']},'original_capture':{'path':str(a.original.resolve()),**identity(a.original)},'scope':'explicit historical metadata-only projection; full original source/raw/model/optimizer state retained in original capsule'}
        a.out.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(a.out,'w',zipfile.ZIP_DEFLATED) as dest:
            dest.writestr('execution.json',json.dumps(projected,indent=2)+'\n')
            for name in ('create.json','start.json','inspect.json','logs.json'):dest.writestr('original-v1/'+name,z.read(name))
            dest.writestr('original-v1/study-started.json',z.read('results/study-started.json'))
    print(json.dumps({'migrated':True,'backend':'historical-container','training_executed':False,'original_retained':str(a.original),'new_receipt':str(a.out)}))
if __name__=='__main__':main()
