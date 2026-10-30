"""Author daily reachability reference; no full archive or truth-label input."""
import argparse
from datetime import datetime,timedelta
import json
import math
from pathlib import Path
import time
import numpy as np

from asof_input import InputError, project
from daily_data import read_packet
from material_contract import read_json


def latest(rows,identity,tick):
    result={}
    for row in rows:
        key=row[identity],row[tick]
        if key not in result or row['revision_id']>result[key]['revision_id']:result[key]=row
    return result


def validate_config(config):
    common={'algorithm','train_window_days','minimum_training_rows','calibration_days_before','minimum_calibration_rows'}
    extra={'weekday_repeats'} if config.get('algorithm')=='seasonal_weekday' else {'use_weather','use_operations','ridge_alpha'} if config.get('algorithm')=='ridge' else set()
    if not extra or set(config)!=common|extra:raise InputError('method_configuration')
    for key in ['train_window_days','minimum_training_rows','minimum_calibration_rows']:
        if type(config[key]) is not int or config[key]<1:raise InputError('method_configuration')
    offsets=config['calibration_days_before']
    if type(offsets) is not list or not offsets or any(type(x) is not int or x<1 for x in offsets) or len(set(offsets))!=len(offsets):raise InputError('method_configuration')
    if config['algorithm']=='seasonal_weekday':
        if type(config['weekday_repeats']) is not int or config['weekday_repeats']<1:raise InputError('method_configuration')
    else:
        if any(type(config[key]) is not bool for key in ['use_weather','use_operations']):raise InputError('method_configuration')
        alpha=float(config['ridge_alpha'])
        if not math.isfinite(alpha) or alpha<=0:raise InputError('method_configuration')


def base_predict(raw,meta,origin,targets,config):
    """Only point fitting/prediction. Calibration calls this function, never forecast()."""
    snapshot=project(raw,origin,len(targets))
    observations=latest(snapshot['observations'],'series_id','event_tick')
    covariates=latest(snapshot['covariates'],'variable_id','valid_tick')
    epoch=datetime.fromisoformat(meta['clock']['epoch_utc'].replace('Z','+00:00'))
    def day(tick):return epoch+timedelta(hours=tick-24)
    def cov(name,tick):
        row=covariates.get((name,tick))
        return None if row is None or row['quality_flag']!='valid' else row['value']
    def operation(series,tick):
        name=series+'.open'
        if name not in raw['variables']:return 1.0
        value=cov(name,tick)
        if value not in (0,1):raise InputError('operating_plan_missing:'+name)
        return float(value)
    predictions={};audits={}
    for node in meta['series_catalogue']:
        if node['kind']!='leaf':continue
        series=node['series_id'];zone=node['parent_zone']
        points=sorted((tick,float(row['value'])) for (name,tick),row in observations.items()
            if name==series and row['quality_flag']=='valid' and origin-24*config['train_window_days']<=tick<origin)
        if len(points)<config['minimum_training_rows']:raise InputError('insufficient_history:'+series)
        use_weather=config['algorithm']=='ridge' and config['use_weather']
        names=['weekday_'+str(i) for i in range(1,7)]+['year_sin','year_cos']
        if use_weather:names+=['temperature_C']
        if config['algorithm']=='ridge' and config['use_operations']:names+=['open','transfer_in']
        imputed=[]
        climate={}
        if use_weather:
            history=[(tick,row['value']/10) for (name,tick),row in covariates.items() if name==zone+'.temperature_actual' and row['quality_flag']=='valid']
            for month in range(1,13):
                values=[value for tick,value in history if day(tick).month==month]
                if values:climate[month]=float(np.mean(values))
        def temperature(tick,training):
            value=cov(zone+('.temperature_actual' if training else '.temperature_forecast'),tick)
            if value is not None:return value/10
            month=day(tick).month
            if month not in climate:raise InputError('insufficient_climatology:'+zone)
            if not training:imputed.append(tick)
            return climate[month]
        def features(tick,training):
            date=day(tick);angle=2*math.pi*date.timetuple().tm_yday/365.25
            values=[float(date.weekday()==i) for i in range(1,7)]+[math.sin(angle),math.cos(angle)]
            if use_weather:values.append(temperature(tick,training))
            if config['use_operations']:
                transfer=cov(series+'.transfer_in',tick) if series+'.transfer_in' in raw['variables'] else 0
                if transfer not in (0,1):raise InputError('operating_plan_missing:'+series+'.transfer_in')
                values += [operation(series,tick),float(transfer)]
            return values
        if config['algorithm']=='seasonal_weekday':
            for target in targets:
                values=[value for tick,value in points if day(tick).weekday()==day(target).weekday()][-config['weekday_repeats']:]
                if not values:raise InputError('insufficient_weekday_history:'+series)
                predictions[series,target]=float(np.mean(values))
            fit={'training_rows':len(points),'features':['up_to_'+str(config['weekday_repeats'])+'_same_weekday_values'],'coefficient':None}
        else:
            x=np.array([features(tick,True) for tick,_ in points],dtype=np.float64);y=np.array([value for _,value in points],dtype=np.float64)
            centre=x.mean(axis=0);spread=x.std(axis=0);spread=np.where(spread>0,spread,1.0)
            design=np.column_stack([np.ones(len(x)),(x-centre)/spread]);penalty=np.diag([0.0]+[math.sqrt(float(config['ridge_alpha']))]*x.shape[1])
            coefficients,_,rank,_=np.linalg.lstsq(np.vstack([design,penalty]),np.concatenate([y,np.zeros(design.shape[1])]),rcond=None)
            for target in targets:
                xx=(np.array(features(target,False),dtype=np.float64)-centre)/spread
                value=float(np.concatenate([[1.0],xx])@coefficients)
                predictions[series,target]=max(0.0,value)
            fit={'training_rows':len(points),'features':['intercept',*names],'coefficient':coefficients.tolist(),'feature_centre':centre.tolist(),'feature_scale':spread.tolist(),'augmented_rank':int(rank)}
        audits[series]={**fit,'future_temperature_imputed_ticks':sorted(set(imputed)),'maximum_training_event_tick':max(tick for tick,_ in points)}
    return predictions,audits


def forecast(raw,meta,method):
    if type(method) is not dict or set(method)!={'method_id','configuration'} or type(method['method_id']) is not str or not method['method_id'].strip():raise InputError('method_identity')
    config=method['configuration'];validate_config(config)
    origin=meta['origin_tick'];leaf_ids=[r['series_id'] for r in meta['series_catalogue'] if r['kind']=='leaf']
    known=latest(raw['observations'],'series_id','event_tick');residual_vectors=[];calibration=[]
    for offset in config['calibration_days_before']:
        pseudo=origin-24*offset
        if pseudo<0:raise InputError('insufficient_calibration_history')
        targets=[(pseudo//24+2)*24+24*i for i in range(len(meta['target_ticks']))]
        prediction,audit=base_predict(raw,meta,pseudo,targets,config)
        accepted=[]
        for target in targets:
            labels=[known.get((series,target)) for series in leaf_ids]
            if all(row is not None and row['quality_flag']=='valid' for row in labels):
                residual_vectors.append([row['value']-prediction[series,target] for series,row in zip(leaf_ids,labels)])
                accepted.append(target)
        calibration.append({'origin_tick':pseudo,'target_ticks':targets,'accepted_complete_leaf_ticks':accepted,'fit':audit})
    if len(residual_vectors)<config['minimum_calibration_rows']:raise InputError('insufficient_calibration_rows')
    point,audit=base_predict(raw,meta,origin,meta['target_ticks'],config)
    residuals=np.array(residual_vectors,dtype=np.float64)
    current_cov=latest(raw['covariates'],'variable_id','valid_tick');forecasts=[]
    for target in meta['target_ticks']:
        samples={series:np.maximum(0.0,point[series,target]+residuals[:,i]) for i,series in enumerate(leaf_ids)}
        if config['algorithm']=='ridge' and config['use_operations']:
            for series in leaf_ids:
                name=series+'.open'
                if name in raw['variables']:
                    row=current_cov.get((name,target))
                    if row is None or row['quality_flag']!='valid' or row['value'] not in (0,1):raise InputError('operating_plan_missing:'+name)
                    samples[series]*=row['value']
        for node in meta['series_catalogue']:
            if node['kind']=='aggregate':samples[node['series_id']]=sum(int(edge['weight'])*samples[edge['child']] for edge in meta['hierarchy'] if edge['parent']==node['series_id'])
        for series,values in samples.items():
            quantiles=np.quantile(values,[float(q) for q in meta['quantiles']],method='linear')
            forecasts.append({'series_id':series,'target_tick':target,'mean':float(np.mean(values)),'quantiles':{q:float(value) for q,value in zip(meta['quantiles'],quantiles)}})
    result={'format':'l02-distribution-forecasts/1','method_id':method['method_id'],'origin_tick':origin,'forecasts':forecasts}
    fit={'format':'l02-reference-fit/1','method':method,'origin_tick':origin,'numpy_version':np.__version__,'fit':audit,'calibration':calibration,
         'paired_residual_rows':len(residual_vectors),'scope':'author empirical marginal predictive reference; no finite-sample coverage or joint-path certification'}
    return result,fit


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--config',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();began=time.perf_counter()
    try:
        raw,meta=read_packet(a.input);result,fit=forecast(raw,meta,read_json(a.config))
        a.output.mkdir(parents=True,exist_ok=False)
        for name,value in [('forecast',result),('fit',fit)]: (a.output/(name+'.json')).write_text(json.dumps(value,indent=2,allow_nan=False),encoding='utf-8')
        print(json.dumps({'status':'prediction_completed','rows':len(result['forecasts']),'wall_seconds':time.perf_counter()-began,'numpy_version':np.__version__}),flush=True)
    except (OSError,ValueError,KeyError,TypeError,np.linalg.LinAlgError) as e:
        print(json.dumps({'status':'execution_failed','error':str(e),'wall_seconds':time.perf_counter()-began}),flush=True);raise SystemExit(2)
