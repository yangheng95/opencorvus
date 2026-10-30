"""Evaluator-side original-row packets, actual labels and fixed historical scales."""
import csv
from datetime import timedelta
from fractions import Fraction
import json
from pathlib import Path

from asof_input import InputError, project
from check_projection import assess
from daily_data import read_packet
from decode_materials import OBS,COV,decode,hour_tick,rows,utc
from material_contract import load_contract,read_json


def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,indent=2,allow_nan=False),encoding='utf-8')


class StudySource:
    def __init__(self,root,contract_path,study):
        self.root=root;self.contract=load_contract(contract_path);self.study=study
        self.raw,self.grid=decode(root,'archive',self.contract)
        self.origins={g['origin_id']:g for g in self.grid['origins']};self.epoch=utc(self.grid['clock']['epoch_utc'])
        self.originals={}
        for table,filename,fields,identity,end in [('observations','observations.csv',OBS,'series_id','event_end_utc'),('covariates','covariate-vintages.csv',COV,'variable_id','valid_end_utc')]:
            indexed={}
            for row in rows(root/filename,fields):
                key=row[identity],hour_tick(row[end],self.epoch),int(row['revision_id'])
                if key in indexed:raise InputError('raw_business_identity_duplicate')
                indexed[key]=row
            self.originals[table]=indexed
        self.terminal={(r['series_id'],r['event_tick']):r for r in self.raw['observations'] if r['revision_id']==self.contract['grid']['terminal_revision_id']}
        scale=study['scale_source'];start=utc(scale['event_start']+'T00:00:00Z')+timedelta(days=1);end=utc(scale['event_end_inclusive']+'T00:00:00Z')+timedelta(days=1)
        published=hour_tick(scale['published_by_utc'],self.epoch);n=(end-start).days+1
        means={}
        for node in self.grid['series_catalogue']:
            if node['kind']!='leaf':continue
            source=[self.terminal.get((node['series_id'],int(((start+timedelta(days=i))-self.epoch).total_seconds())//3600)) for i in range(n)]
            if any(row is None or row['quality_flag']!='valid' or row['release_tick']>published for row in source):raise InputError('scale_publication_invalid')
            means[node['series_id']]=sum(Fraction(row['value']) for row in source)/n
        for node in self.grid['series_catalogue']:
            if node['kind']=='aggregate':means[node['series_id']]=sum(int(e['weight'])*means[e['child']] for e in self.grid['hierarchy'] if e['parent']==node['series_id'])
        self.scales={name:str(max(Fraction(scale['minimum_litres']),value)) for name,value in means.items()};self.scale_release_tick=published

    def context_and_labels(self,origin_id):
        origin=self.origins[origin_id];labels={};released=[]
        for node in self.grid['series_catalogue']:
            if node['kind']!='leaf':continue
            for target in origin['target_ticks']:
                row=self.terminal[node['series_id'],target]
                if row['quality_flag']!='valid':raise InputError('terminal_label_missing')
                labels[node['series_id'],target]=row['value'];released.append(row['release_tick'])
        hierarchy=[{**e,'weight':int(e['weight'])} for e in self.grid['hierarchy']]
        for node in self.grid['series_catalogue']:
            if node['kind']=='aggregate':
                for target in origin['target_ticks']:labels[node['series_id'],target]=sum(e['weight']*labels[e['child'],target] for e in hierarchy if e['parent']==node['series_id'])
        context={'format':'l02-score-context/1','origin_tick':origin['origin_tick'],'target_ticks':origin['target_ticks'],
            'series_catalogue':[{k:node[k] for k in ['series_id','kind']} for node in self.grid['series_catalogue']],'hierarchy':hierarchy,'scales_litres':self.scales}
        return context,[{'series_id':name,'target_tick':target,'value':value} for (name,target),value in labels.items()],max(released)

    def packet(self,origin_id,out):
        origin=self.origins[origin_id];out.mkdir(parents=True,exist_ok=False)
        snapshot=project(self.raw,origin['origin_tick'],len(origin['target_ticks']))
        meta={'format':'l02-daily-worker-packet/1','clock':{k:self.grid['clock'][k] for k in ['epoch_utc','tick_unit','event_interval']},
            'origin_tick':origin['origin_tick'],'target_ticks':origin['target_ticks'],'series_catalogue':self.grid['series_catalogue'],'hierarchy':self.grid['hierarchy'],
            'units':self.contract['units'],'variables':self.raw['variables'],'quantiles':self.study['quantiles']}
        write_json(out/'packet.json',meta)
        for table,filename,fields,identity,tick in [('observations','observations.csv',OBS,'series_id','event_tick'),('covariates','covariate-vintages.csv',COV,'variable_id','valid_tick')]:
            permitted=[self.originals[table][row[identity],row[tick],row['revision_id']] for row in snapshot[table]]
            with (out/filename).open('w',newline='',encoding='utf-8') as f:
                writer=csv.DictWriter(f,fieldnames=sorted(fields));writer.writeheader();writer.writerows(permitted)
        actual,packet_meta=read_packet(out)
        actual_snapshot=project(actual,origin['origin_tick'],len(origin['target_ticks']))
        verification=assess(self.raw,actual_snapshot,origin['origin_tick'],len(origin['target_ticks']))
        if verification['status']!='projection_verified' or packet_meta!=meta:raise InputError('packet_projection_invalid')
        return {'origin_id':origin_id,'origin_tick':origin['origin_tick'],'target_ticks':origin['target_ticks'],'projection':verification,
            'raw_rows':{table:len(snapshot[table]) for table in ['observations','covariates']},'scope':'authorized original CSV rows and registered target grid only'}


def load_pool(path):
    return validate_pool(read_json(path))


def validate_pool(pool):
    if type(pool) is not dict or pool.get('format')!='l02-method-pool/1' or type(pool.get('methods')) is not list:raise InputError('method_pool_invalid')
    methods={}
    for method in pool['methods']:
        if type(method) is not dict or set(method)!={'method_id','role','configuration'} or type(method['method_id']) is not str or not method['method_id'].strip() or method['method_id'] in methods or type(method['configuration']) is not dict:raise InputError('method_pool_invalid')
        methods[method['method_id']]=method
    for key in ['selection_ids','outer_ids']:
        ids=pool.get(key)
        if type(ids) is not list or not ids or any(type(i) is not str or i not in methods for i in ids) or len(set(ids))!=len(ids):raise InputError('method_pool_invalid')
    if len(pool['selection_ids'])<2 or not set(pool['selection_ids'])<=set(pool['outer_ids']):raise InputError('method_pool_invalid')
    return pool,methods
