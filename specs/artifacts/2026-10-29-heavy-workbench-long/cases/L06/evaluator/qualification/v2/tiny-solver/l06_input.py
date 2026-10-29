"""Single input-integrity contract; contains no optimization/plan equations."""
import json
from pathlib import Path


class InputError(ValueError):
    def __init__(self, code, path, detail):
        self.code,self.path,self.detail=code,path,detail
        super().__init__(f'{code}: {path}: {detail}')


def read_json(path, code):
    def pairs(values):
        result={}
        for key,value in values:
            if key in result:raise InputError(code,str(path),f'duplicate key {key}')
            result[key]=value
        return result
    def constant(value):raise InputError(code,str(path),f'non-JSON number {value}')
    try:
        return json.loads(Path(path).read_text(encoding='utf8'),object_pairs_hook=pairs,parse_constant=constant)
    except (OSError,UnicodeError,json.JSONDecodeError) as error:
        raise InputError(code,str(path),str(error)) from error


def validate_instance(data):
    def require(condition,path,detail):
        if not condition:raise InputError('instance_invalid',path,detail)
    def number(value,path,minimum=0,maximum=None):
        require(type(value) is int and value>=minimum and (maximum is None or value<=maximum),path,
                f'integer in [{minimum},{maximum}] required')
        return value
    def vector(value,shape,path,minimum=0,maximum=None):
        if not shape:
            number(value,path,minimum,maximum);return
        require(isinstance(value,list) and len(value)==shape[0],path,f'exact shape {shape} required')
        for i,row in enumerate(value):vector(row,shape[1:],f'{path}[{i}]',minimum,maximum)
    def identity(value,path):
        require(isinstance(value,str) and bool(value.strip()),path,'nonempty identity required')
        return value
    def identifiers(values,path):
        require(isinstance(values,list) and len(values)>0,path,'nonempty identity list required')
        for i,value in enumerate(values):identity(value,f'{path}[{i}]')
        require(len(set(values))==len(values),path,'unique identities required')
        return len(values)
    required={'format','weeks','common_weeks','probability_denominator','raw_materials','products','suppliers','plants',
              'allowed','production_hours','production_cost_minor','bom','raw_volume','product_volume','raw_holding_minor',
              'product_holding_minor','raw_storage_volume','product_storage_volume','initial_raw','initial_products',
              'initial_cash_minor','credit_limit_minor','sales_price_minor','receipt_lag_weeks','scenarios'}
    require(isinstance(data,dict),'$','instance object required')
    require(required<=set(data),'$',f'missing fields {sorted(required-set(data))}')
    require(set(data)<=required|{'status','qualification_variant'},'$','unknown input fields')
    require(data['format']=='l06-feasibility-instance/2','format','v2 stage-peak instance required')
    T=number(data['weeks'],'weeks',1);K=number(data['common_weeks'],'common_weeks',0,T)
    denominator=number(data['probability_denominator'],'probability_denominator',1)
    M=identifiers(data['raw_materials'],'raw_materials');J=identifiers(data['products'],'products');P=identifiers(data['plants'],'plants')
    for name in ['initial_cash_minor','credit_limit_minor','raw_storage_volume','product_storage_volume']:
        number(data[name],name)
    number(data['receipt_lag_weeks'],'receipt_lag_weeks',1)
    for name,width,minimum in [('initial_raw',M,0),('initial_products',J,0),('raw_volume',M,1),('product_volume',J,1),
                               ('raw_holding_minor',M,0),('product_holding_minor',J,0),('production_hours',J,1),('sales_price_minor',J,0)]:
        vector(data[name],[width],name,minimum)
    vector(data['allowed'],[P,J],'allowed',0,1)
    vector(data['production_cost_minor'],[P,J],'production_cost_minor')
    vector(data['bom'],[J,M],'bom')
    suppliers=data['suppliers'];require(isinstance(suppliers,list) and bool(suppliers),'suppliers','nonempty list required')
    ids=[]
    for i,s in enumerate(suppliers):
        path=f'suppliers[{i}]'
        fields={'id','lead_weeks','pack_units','price_minor','freight_minor','minimum_volume'}
        require(isinstance(s,dict) and set(s)==fields,path,'exact supplier fields required')
        ids.append(identity(s['id'],path+'.id'))
        for name in ['lead_weeks','freight_minor','minimum_volume']:number(s[name],path+'.'+name)
        vector(s['pack_units'],[M],path+'.pack_units',1);vector(s['price_minor'],[M],path+'.price_minor')
    require(len(set(ids))==len(ids),'suppliers','unique identities required');S=len(ids)
    scenarios=data['scenarios'];require(isinstance(scenarios,list) and bool(scenarios),'scenarios','nonempty list required')
    ids=[];total=0
    for i,s in enumerate(scenarios):
        path=f'scenarios[{i}]';fields={'id','probability_numerator','demand','supplier_capacity_volume','plant_capacity_hours'}
        require(isinstance(s,dict) and set(s)==fields,path,'exact scenario fields required')
        ids.append(identity(s['id'],path+'.id'));total+=number(s['probability_numerator'],path+'.probability_numerator',1)
        for name,width in [('demand',J),('supplier_capacity_volume',S),('plant_capacity_hours',P)]:
            vector(s[name],[T,width],path+'.'+name)
            require(s[name][:K]==scenarios[0][name][:K],path+'.'+name,'identical revealed-prefix information required')
    require(len(set(ids))==len(ids),'scenarios','unique identities required')
    require(total==denominator,'scenarios.probability','strictly positive probabilities summing to one required')
    for name in ['status','qualification_variant']:
        if name in data:require(isinstance(data[name],str),name,'metadata string required')
    return data
