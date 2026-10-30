"""Actual standard-shape networks from initial conditions and PDE structure.

Not an eligible old-profile training procedure, not an analytic inference callback.
"""
from pathlib import Path
import argparse,os,json,sys
os.environ['OPENBLAS_NUM_THREADS']='1';os.environ['OMP_NUM_THREADS']='1'
import numpy as np

def blank():return [(np.zeros((b,a),dtype=np.float64),np.zeros(b,dtype=np.float64)) for a,b in zip((2,100,100,100),(100,100,100,1))]
def fit(features,target):
    scale=np.maximum(np.linalg.norm(features,axis=0),1e-30)
    matrix=np.column_stack((features/scale,np.ones(len(features))))
    v,_,rank,s=np.linalg.lstsq(matrix,target,rcond=1e-12)
    return v[:-1]/scale,v[-1],{'rank':int(rank),'columns':matrix.shape[1],'training_rows':len(features),'singular_values':s.tolist(),'rcond':1e-12,'source':'known initial condition or its PDE/boundary-derived extension, not future evaluation labels'}
def construct(problem):
    layers=blank();w0,b0=layers[0];w1,b1=layers[1];w2,b2=layers[2];wo,bo=layers[3]
    if problem=='reaction':
        centers=np.linspace(-.2,2*np.pi+.2,99);w0[:99,0]=12;b0[:99]=-12*centers
        w0[99,1]=1e-3;w1[:99,:99]=.01*np.eye(99);w1[99,99]=1
        x=np.linspace(0,2*np.pi,257);h=np.exp(-(x-np.pi)**2/(2*(np.pi/4)**2));clipped=np.clip(h,1/(1+np.exp(8)),1/(1+np.exp(-8)))
        target=np.log(clipped/(1-clipped));features=np.tanh(.01*np.tanh(12*(x[:,None]-centers)))
        c,b,info=fit(features,target);w2[0,:99]=.5*c;w2[0,99]=2.5/1e-3;b2[0]=.5*b;wo[0,0]=.5;bo[0]=.5
        info.update(transform='logit initial value +5t; logistic output encoded as .5*tanh(.5*z)+.5',initial_logit_clip=8,time_channel_scale=.001)
    else:
        convection=problem=='convection';n=100 if convection else 50;slope=2 if convection else 6
        centers=np.linspace(-42,2*np.pi+2,n) if convection else np.linspace(-2.5,3.5,n)
        xi=np.linspace(-40,2*np.pi,4096) if convection else np.linspace(-2,3,4096)
        if convection:target=np.sin(np.remainder(xi,2*np.pi))
        else:
            phase=np.remainder(xi,2);coordinate=np.where(phase<=1,phase,2-phase);sign=np.where(phase<=1,1.,-1.)
            target=sign*(np.sin(np.pi*coordinate)+.5*np.sin(5*np.pi*coordinate))
        features=np.tanh(.01*np.tanh(.01*np.tanh(slope*(xi[:,None]-centers))))
        c,b,info=fit(features,target);w1[:,:]=.01*np.eye(100);w2[:,:]=.01*np.eye(100)
        for j,speed in enumerate((-40,) if convection else (-2,2)):
            index=slice(j*n,(j+1)*n);w0[index,0]=slope;w0[index,1]=speed*slope;b0[index]=-slope*centers;wo[0,index]=c if convection else .5*c
        bo[0]=b;info['transform']='periodic characteristic initial extension' if convection else 'odd Dirichlet initial extension and half-weight left/right characteristics'
    return layers,info
def main():
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    sys.path.insert(0,str(a.repo/'script/benchmark'));import pinn_numeric_check as checker
    rows=[]
    for problem in ('convection','reaction','wave'):
        layers,training=construct(problem);path=a.out/(problem+'.npz')
        np.savez(path,**{k:v for i,(w,b) in enumerate(layers) for k,v in ((f'weight_{i}',w),(f'bias_{i}',b))})
        m=checker.metrics(problem,checker.load_network(path),checker.canonical_data(problem))
        targets={'solution':m['l2re']<=.01,'residual':m['evaluation_residual_rmse']<=.01,**{k:v['rmse']<=.01 for k,v in m['constraint_families'].items()}}
        row={'problem':problem,'metrics':m,'fit':training,'target_components':targets,'all_target_components':all(targets.values()),'old_profile_eligible':False,'scope':'same architecture representability control only; not Xavier/registered training/whole selection/candidate score'};rows.append(row)
        print(json.dumps({'problem':problem,'l2re':m['l2re'],'residual':m['evaluation_residual_rmse'],'conditions':m['constraint_families'],'target_components':targets}),flush=True)
    (a.out/'assessment.json').write_text(json.dumps({'rows':rows,'old_training_contract_reachable':None,'candidate_score':None},indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':main()
