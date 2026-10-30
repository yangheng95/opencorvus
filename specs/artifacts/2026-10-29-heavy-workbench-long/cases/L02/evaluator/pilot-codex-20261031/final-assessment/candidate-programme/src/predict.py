"""Frozen numerical predictor. No truth, score scales, other cells, or network input."""
import math
import sys
from pathlib import Path
import numpy as np
from common import Vintages, QUANTILES, load, dump, day, validate_forecast


def selected(cov, var, t):
    return cov.get((var,t))


class Model:
    def __init__(self, data, origin, config, targets):
        self.origin, self.config = origin, config
        self.obs, self.cov = data.snapshot(origin)
        self.leaves = sorted(s['series_id'] for s in data.packet['series_catalogue'] if s['kind']=='leaf')
        self.zones = {s['series_id']:s['parent_zone'] for s in data.packet['series_catalogue'] if s['kind']=='leaf'}
        self.record = {'origin_tick':origin, 'configuration':config, 'selected_missing_observation_refs':sorted(r['ref'] for r in self.obs.values() if r['value'] is None), 'fits':{}, 'target_features':[]}
        self.targets = targets
        self.climate = {}
        self.climate_refs = {}
        self.weather_bias = {}
        if config['model']=='regression' and config['weather']:
            for zone in sorted(set(self.zones.values())):
                rr = sorted((r for (var,t),r in self.cov.items() if var==zone+'.temperature_actual' and r['value'] is not None and origin-config['window_days']*24 <= t < origin), key=lambda r:r['end'])
                if len(rr)<14:
                    raise ValueError('insufficient_legal_temperature_history')
                X = np.array([self.season(r['end']) for r in rr])
                y = np.array([r['value']/10 for r in rr])
                self.climate[zone] = np.linalg.solve(X.T@X + np.diag([0.001,1.,1.]), X.T@y)
                self.climate_refs[zone] = [r['ref'] for r in rr]
            self.record['weather_climatology']={z:{'coefficients_C':self.climate[z].tolist(),'source_refs':self.climate_refs[z]} for z in self.climate}
            # Learn issue-lead weather error from retrospectively available actual labels,
            # reconstructing the highest forecast revision at EACH historical issue cutoff.
            forecast_groups={}
            for r in data.cov:
                if r['id'].endswith('.temperature_forecast') and r['release']<=origin:
                    forecast_groups.setdefault((r['id'],r['end']),[]).append(r)
            self.record['weather_issue_bias']={}
            for zone in sorted(self.climate):
                bins={lead:[] for lead in range(1,14)}
                sources=[]
                actuals=sorted((r for (var,t),r in self.cov.items() if var==zone+'.temperature_actual' and r['value'] is not None and origin-config['window_days']*24<=t<origin),key=lambda r:r['end'])
                for actual in actuals:
                    for lead in range(1,14):
                        issue=actual['end']-(lead+1)*24+9
                        rr=[r for r in forecast_groups.get((zone+'.temperature_forecast',actual['end']),[]) if r['release']<=issue]
                        if rr:
                            r=max(rr,key=lambda r:r['revision'])
                            if r['value'] is not None:
                                error=(r['value']-actual['value'])/10
                                bins[lead].append(error)
                                sources.append({'issue_origin_tick':issue,'lead':lead,'forecast_ref':r['ref'],'current_fit_actual_ref':actual['ref'],'error_C':error})
                bias={lead:sum(values)/(len(values)+config['weather_bias_prior_days']) for lead,values in bins.items()}
                self.weather_bias[zone]=bias
                self.record['weather_issue_bias'][zone]={'bias_C_by_lead':bias,'count_by_lead':{k:len(v) for k,v in bins.items()},'sources':sources,'label_policy':'highest actual revision published at this fit origin; issued forecasts reprojected at their historical issue cutoffs'}
        self.fit = {}
        if config['model']=='regression':
            for sid in self.leaves:
                samples=[]
                for (s,t),r in sorted(self.obs.items()):
                    if s!=sid or r['value'] is None or not origin-config['window_days']*24 <= t < origin:
                        continue
                    x,meta = self.features(sid,t,False)
                    samples.append((t,r,x,meta))
                if len(samples)<28:
                    raise ValueError('insufficient_legal_observation_history')
                X=np.array([v[2] for v in samples]); y=np.array([v[1]['value'] for v in samples],dtype=float)
                w=np.array([2**(-((origin-t)/24)/config['half_life_days']) for t,_,_,_ in samples])
                penalty=np.full(X.shape[1],config['ridge'])
                penalty[0]=0.001
                beta=np.linalg.solve(X.T@(X*w[:,None])+np.diag(penalty),X.T@(y*w))
                residual=y-X@beta
                recent=np.array([(origin-t)/24<=config['local_days'] for t,_,_,_ in samples])
                offset=float(residual[recent].sum()/(recent.sum()+config['local_prior_days']))
                self.fit[sid]=(beta,offset)
                transfer=[v[3]['operating_state']['transfer_in'] for v in samples]
                opens=[v[3]['operating_state']['open'] for v in samples]
                self.record['fits'][sid]={'feature_names':self.names(sid), 'coefficients_L':beta.tolist(), 'local_offset_L':offset, 'weighted_training_rmse_L':float(np.sqrt(np.average(residual**2,weights=w))), 'n':len(samples), 'operating_state_support':{'transfer_values':sorted(set(transfer)),'open_values':sorted(set(opens))}, 'samples':[{'end_tick':t,'observation_ref':r['ref'],'y_L':r['value'],'weight':float(w[i]),'x':x,'features':meta} for i,(t,r,x,meta) in enumerate(samples)]}

    @staticmethod
    def season(t):
        d=day(t)
        phase=2*math.pi*(d.timetuple().tm_yday-1)/365.25
        return [1.,math.sin(phase),math.cos(phase)]

    def names(self,sid):
        n=['intercept','annual_sin','annual_cos']+['weekday_'+str(i) for i in range(6)]+['holiday']
        if self.config['weather']:n+=['temperature_10C']
        if sid=='A1':n+=['transfer_in']
        if sid=='A2':n+=['closed_level']
        return n

    def state(self,var,t,default):
        r=selected(self.cov,var,t)
        if r is not None and r['value'] is not None:
            return r['value'],{'kind':'published','ref':r['ref']}
        return default,{'kind':'explicit_prior_for_unknown','default':default,'missing_ref':r['ref'] if r else None}

    def temperature(self,zone,t,training):
        var=zone+('.temperature_actual' if training else '.temperature_forecast')
        r=selected(self.cov,var,t)
        if r is not None and r['value'] is not None:
            if training:
                return r['value']/10,{'kind':'published_actual','ref':r['ref']}
            lead=(t-24)//24-r['release']//24
            correction=self.weather_bias[zone].get(max(1,min(13,lead)),0.)
            return r['value']/10-correction,{'kind':'bias_corrected_issued_forecast','ref':r['ref'],'issue_lead':lead,'bias_correction_C':correction}
        climatology=float(np.dot(self.season(t),self.climate[zone]))
        if not training:
            rr=sorted((r for (v,end),r in self.cov.items() if v==zone+'.temperature_forecast' and end in self.targets and r['value'] is not None and end<t),key=lambda r:r['end'])[-3:]
            if rr:
                anomaly=np.mean([r['value']/10-self.weather_bias[zone].get(max(1,min(13,(r['end']-24)//24-r['release']//24)),0.)-np.dot(self.season(r['end']),self.climate[zone]) for r in rr])
                return climatology+float(anomaly),{'kind':'issued_anomaly_plus_legal_climatology','forecast_refs':[r['ref'] for r in rr],'missing_ref':r['ref'] if r else None,'climatology_zone':zone}
        return climatology,{'kind':'legal_climatology','missing_ref':r['ref'] if r else None,'climatology_zone':zone}

    def features(self,sid,t,target):
        d=day(t)
        holiday,hmeta=self.state('holiday',t,0)
        opened,ometa=self.state('A2.open',t,1)
        transfer,tmeta=self.state('A1.transfer_in',t,0)
        x=self.season(t)+[float(d.weekday()==i) for i in range(6)]+[float(holiday)]
        meta={'calendar_date':str(d),'holiday':hmeta,'operating_state':{'open':opened,'transfer_in':transfer},'open_source':ometa if sid=='A2' else None,'transfer_source':tmeta if sid=='A1' else None}
        if self.config['weather']:
            temp,tm=self.temperature(self.zones[sid],t,not target)
            x+=[temp/10]
            meta['temperature']={'C':temp,**tm}
        if sid=='A1': x+=[float(transfer)]
        if sid=='A2': x=[v*opened for v in x]+[1.-opened]
        return x,meta

    def point(self,sid,t):
        if self.config['model']=='seasonal':
            rr=sorted((r for (s,end),r in self.obs.items() if s==sid and r['value'] is not None and self.origin-self.config['window_days']*24<=end<self.origin and day(end).weekday()==day(t).weekday()),key=lambda r:r['end'])[-self.config['weekday_count']:]
            if len(rr)<2:raise ValueError('insufficient_seasonal_history')
            val=sum(r['value'] for r in rr)/len(rr)
            self.record['target_features'].append({'series_id':sid,'target_tick':t,'seasonal_source_refs':[r['ref'] for r in rr],'location_L':val})
            return val,1.
        x,meta=self.features(sid,t,True)
        beta,offset=self.fit[sid]
        opened=meta['operating_state']['open'] if sid=='A2' else 1.
        val=max(0.,float(np.dot(x,beta))+offset*opened)
        self.record['target_features'].append({'series_id':sid,'target_tick':t,'x':x,'features':meta,'location_L':val})
        return val,opened


def predict(input_root,output_root):
    root=Path(input_root);out=Path(output_root)/'result'
    packet=load(root/'packet/packet.json');method=load(root/'method.json');cfg=method['configuration'];origin=packet['origin_tick'];targets=packet['target_ticks']
    data=Vintages(root/'packet',packet)
    model=Model(data,origin,cfg,targets)
    labels,_=data.snapshot(origin)
    residual=[];residual_rows=[];past_records=[]
    for lag in cfg['calibration_lags_days']:
        pseudo=origin-lag*24
        pt=[t-lag*24 for t in targets]
        past=Model(data,pseudo,cfg,pt)
        for j,t in enumerate(pt):
            pair=[];trace=[]
            for sid in model.leaves:
                r=labels.get((sid,t));location,_=past.point(sid,t)
                if r is None or r['value'] is None:break
                pair.append(float(r['value'])-location)
                trace.append({'series_id':sid,'label_ref':r['ref'],'current_origin_label_L':r['value'],'pseudo_location_L':location})
            if len(pair)==len(model.leaves):
                residual.append(pair);residual_rows.append({'pseudo_origin_tick':pseudo,'target_tick':t,'lead':j+1,'residual_L':pair,'labels':trace})
        past_records.append(past.record)
    if len(residual)<14:raise ValueError('insufficient_complete_calibration_vectors')
    R=np.array(residual)
    center=R.mean(axis=0) if cfg['center_residuals'] else np.zeros(len(model.leaves))
    centered=R-center
    forecasts=[]
    for t in targets:
        samples={}
        for k,sid in enumerate(model.leaves):
            location,exposure=model.point(sid,t)
            # Exposure zero is a structural shutdown prior; learned closed-level location can be positive.
            spread=exposure if cfg['model']=='regression' and sid=='A2' else 1.
            samples[sid]=np.maximum(0.,location+centered[:,k]*spread)
        pending=list(packet['hierarchy'])
        while pending:
            available=[p for p in sorted({e['parent'] for e in pending}) if all(e['child'] in samples for e in pending if e['parent']==p)]
            if not available:raise ValueError('invalid_hierarchy')
            for p in available:
                samples[p]=sum(int(e['weight'])*samples[e['child']] for e in pending if e['parent']==p)
                pending=[e for e in pending if e['parent']!=p]
        means={s:float(a.mean()) for s,a in samples.items()}
        # Use exact same floating operations as bottom-up child means for coherence.
        for p in sorted({e['parent'] for e in packet['hierarchy']}):
            means[p]=sum(int(e['weight'])*means[e['child']] for e in packet['hierarchy'] if e['parent']==p)
        for s in sorted(samples):
            q=np.quantile(samples[s],[float(v) for v in QUANTILES],method='linear')
            forecasts.append({'series_id':s,'target_tick':t,'mean':means[s],'quantiles':{k:float(v) for k,v in zip(QUANTILES,q)}})
    forecast={'format':'l02-distribution-forecasts/1','method_id':method['method_id'],'origin_tick':origin,'forecasts':forecasts}
    check=validate_forecast(packet,method,forecast)
    dump(out/'forecast.json',forecast)
    dump(out/'diagnostics.json',{'format':'candidate-fit-lineage/1','method_id':method['method_id'],'origin_tick':origin,'point_fit':model.record,'pseudo_fits':past_records,'calibration':{'label_policy':'highest revision released by CURRENT origin, including missing; retain complete four-leaf dates','feature_policy':'each pseudo-origin separately release-projected','vectors':residual_rows,'center_L':center.tolist(),'n_vectors':len(residual),'empirical_rule':'linear sample quantiles; nonnegative paired leaf samples then bottom-up aggregation'},'source_registry':data.registry,'contract_check':check})
    print('forecast_written',method['method_id'],origin,84,'calibration_vectors',len(residual),flush=True)


if __name__=='__main__':
    predict(sys.argv[1] if len(sys.argv)>1 else '/input',sys.argv[2] if len(sys.argv)>2 else '/output')
