"""One NumPy-only publication rule shared by producer and explicit closed-segment repair."""
from pathlib import Path
import argparse,datetime,json,os,sys
from pinn_submission_check import select_minimum,read_json,artifact
from pinn_numeric_check import load_network,metrics,canonical_data

def finalize_manifest(profile,manifest,observations):
    """One publication rule for full, partial and closed-segment metadata."""
    specs={s['id']:s for s in profile['base_configurations']+profile['continuations']}
    parent_ids=[s['id'] for s in profile['base_configurations'] if all(s[k]==profile['selection'][k] for k in ('problem','seed','method'))]
    padded={k:observations.get(k,{'status':'incomplete','metrics':None}) for k in specs}
    parent=select_minimum(parent_ids,padded,profile['selection']['eligible_terminal_states'],lambda k:specs[k]['adam_learning_rate'])
    continuation_ids={s['id'] for s in profile['continuations']}
    for row in manifest['runs']:
        if row['config_id'] in continuation_ids and row['status'] in ('incomplete','dependency_incomplete') and all(v['attempts']==0 for v in row['phases'].values()):
            if any(v is not None for v in row['checkpoints'].values()) or row['trace'] is not None or row['receipt'] is not None:raise ValueError('pending continuation has actual artifacts; preserve for explicit diagnosis')
            row.update(parent_id=parent,status='incomplete' if parent else 'dependency_incomplete',reason='registered continuation not executed' if parent else 'registered hybrid parent not yet eligible')
    for problem in manifest['solution_checkpoints']:
        ids=[s['id'] for s in profile['base_configurations'] if s['problem']==problem and s['seed']==profile['solution_selection']['seed']]
        if problem=='convection':ids += [s['id'] for s in profile['continuations']]
        manifest['solution_checkpoints'][problem]=select_minimum(ids,padded,profile['solution_selection']['eligible_terminal_states'],lambda k:k)
    return parent

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,required=True);p.add_argument('--inputs',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    root=a.root.resolve();out=a.output.resolve();profile=read_json(a.inputs/'profile.json');terminal=read_json(out/'study-terminal.json')
    if terminal.get('native_exit')!=0 or read_json(out/'profile.json')!=profile:raise ValueError('original successful natural terminal and unchanged profile required')
    manifest=read_json(out/'manifest.json');original=read_json(out/'manifest.json');observations={}
    for row in manifest['runs']:
        if row['status'] not in ('incomplete','dependency_incomplete'):
            spec=next(s for s in profile['base_configurations']+profile['continuations'] if s['id']==row['config_id'])
            final=artifact(root,row['checkpoints']['final'],'original terminal final')
            observations[row['config_id']]={'status':row['status'],'metrics':metrics(spec.get('problem','convection'),load_network(final),canonical_data(spec.get('problem','convection')))}
    parent=finalize_manifest(profile,manifest,observations);receipt=out/'metadata-close';receipt.mkdir(exist_ok=False)
    def write(path,value):path.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    write(receipt/'original-manifest.json',original);write(out/'manifest.json',manifest)
    write(receipt/'receipt.json',{'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'native_pid':os.getpid(),'argv':sys.argv,'original_terminal':terminal,'continuation_parent':parent,'executed_configurations':list(observations),'scope':'NumPy-only derived metadata; zero optimizer execution; original arrays/traces/counts retained'})
    print(json.dumps({'publication_closed':True,'original_executed_records':len(observations),'continuation_parent':parent}))
if __name__=='__main__':main()
