"""Single explicit raw-business packet projection; no optimization equations."""
import argparse
import csv
import json
from pathlib import Path

from l06_input import InputError,read_json,validate_instance


HEADERS={
    'raw_materials':['raw_index','raw_id','volume','holding_minor','initial_units'],
    'products':['product_index','product_id','volume','holding_minor','initial_units','hours','sales_price_minor'],
    'plants':['plant_index','plant_id'],
    'supplier_terms':['supplier_index','supplier_id','lead_weeks','freight_minor','minimum_volume'],
    'supplier_quotes':['supplier_id','raw_id','pack_units','unit_price_minor'],
    'routes':['plant_id','product_id','allowed','production_cost_minor'],
    'bom':['product_id','raw_id','units'],
    'scenarios':['scenario_index','scenario_id','probability_numerator'],
    'demand':['scenario_id','week','product_id','units'],
    'supplier_capacity':['scenario_id','week','supplier_id','volume'],
    'plant_capacity':['scenario_id','week','plant_id','hours'],
}
GLOBAL=('weeks','common_weeks','probability_denominator','raw_storage_volume','product_storage_volume','initial_cash_minor','credit_limit_minor','receipt_lag_weeks')


def write_packet(data,folder):
    validate_instance(data);folder=Path(folder);folder.mkdir(parents=True,exist_ok=False)
    def table(name,rows):
        with (folder/(name+'.csv')).open('w',encoding='utf-8',newline='') as file:
            writer=csv.writer(file);writer.writerow(HEADERS[name]);writer.writerows(rows)
    table('raw_materials',[(i,name,data['raw_volume'][i],data['raw_holding_minor'][i],data['initial_raw'][i]) for i,name in enumerate(data['raw_materials'])])
    table('products',[(i,name,data['product_volume'][i],data['product_holding_minor'][i],data['initial_products'][i],data['production_hours'][i],data['sales_price_minor'][i]) for i,name in enumerate(data['products'])])
    table('plants',list(enumerate(data['plants'])))
    table('supplier_terms',[(i,s['id'],s['lead_weeks'],s['freight_minor'],s['minimum_volume']) for i,s in enumerate(data['suppliers'])])
    table('supplier_quotes',[(s['id'],raw,s['pack_units'][m],s['price_minor'][m]) for s in data['suppliers'] for m,raw in enumerate(data['raw_materials'])])
    table('routes',[(plant,product,data['allowed'][p][j],data['production_cost_minor'][p][j]) for p,plant in enumerate(data['plants']) for j,product in enumerate(data['products'])])
    table('bom',[(product,raw,data['bom'][j][m]) for j,product in enumerate(data['products']) for m,raw in enumerate(data['raw_materials'])])
    table('scenarios',[(i,s['id'],s['probability_numerator']) for i,s in enumerate(data['scenarios'])])
    table('demand',[(s['id'],t,product,s['demand'][t][j]) for s in data['scenarios'] for t in range(data['weeks']) for j,product in enumerate(data['products'])])
    table('supplier_capacity',[(s['id'],t,supplier['id'],s['supplier_capacity_volume'][t][k]) for s in data['scenarios'] for t in range(data['weeks']) for k,supplier in enumerate(data['suppliers'])])
    table('plant_capacity',[(s['id'],t,plant,s['plant_capacity_hours'][t][p]) for s in data['scenarios'] for t in range(data['weeks']) for p,plant in enumerate(data['plants'])])
    (folder/'facility.json').write_text(json.dumps({'format':'l06-operational-facts/1',**{k:data[k] for k in GLOBAL}},indent=2)+'\n')


def read_packet(folder):
    folder=Path(folder)
    def fail(path,detail):raise InputError('packet_invalid',str(path),detail)
    def integer(text,path):
        try:return int(text)
        except (ValueError,TypeError) as error:raise InputError('packet_invalid',str(path),'integer field required') from error
    def read(name):
        path=folder/(name+'.csv')
        try:
            with path.open(encoding='utf-8',newline='') as file:
                reader=csv.DictReader(file,strict=True)
                if reader.fieldnames!=HEADERS[name]:fail(path,'exact declared columns required')
                rows=list(reader)
        except (OSError,UnicodeError,csv.Error) as error:raise InputError('packet_invalid',str(path),str(error)) from error
        if any(None in row or any(value is None or value=='' for value in row.values()) for row in rows):fail(path,'complete field values required')
        return rows
    def indexed(name,index_field,id_field):
        rows=read(name);by_index={}
        for row in rows:
            i=integer(row[index_field],name+'.'+index_field)
            if i in by_index:fail(name,'duplicate index')
            by_index[i]=row
        if sorted(by_index)!=list(range(len(rows))):fail(name,'contiguous zero-based indices required')
        rows=[by_index[i] for i in range(len(rows))]
        ids=[row[id_field] for row in rows]
        if len(set(ids))!=len(ids):fail(name,'duplicate identity')
        return rows,ids
    def relation(name,key_fields,expected):
        result={}
        for row in read(name):
            if 'week' in key_fields:row['week']=str(integer(row['week'],name+'.week'))
            key=tuple(row[field] for field in key_fields)
            if key in result:fail(name,'duplicate business key '+repr(key))
            result[key]=row
        if set(result)!=set(expected):fail(name,'complete exact business-key coverage required')
        return result
    facts=read_json(folder/'facility.json','packet_invalid')
    if not isinstance(facts,dict) or set(facts)!={'format',*GLOBAL} or facts['format']!='l06-operational-facts/1':fail('facility.json','exact facility facts required')
    if any(type(facts[k]) is not int for k in GLOBAL) or facts['weeks']<=0:fail('facility.json','integer facts and positive weeks required')
    raw_rows,raw_ids=indexed('raw_materials','raw_index','raw_id')
    product_rows,products=indexed('products','product_index','product_id')
    _,plants=indexed('plants','plant_index','plant_id')
    supplier_rows,suppliers=indexed('supplier_terms','supplier_index','supplier_id')
    scenario_rows,scenarios=indexed('scenarios','scenario_index','scenario_id')
    T=facts['weeks']
    quotes=relation('supplier_quotes',('supplier_id','raw_id'),[(s,m) for s in suppliers for m in raw_ids])
    routes=relation('routes',('plant_id','product_id'),[(p,j) for p in plants for j in products])
    bom=relation('bom',('product_id','raw_id'),[(j,m) for j in products for m in raw_ids])
    demand=relation('demand',('scenario_id','week','product_id'),[(s,str(t),j) for s in scenarios for t in range(T) for j in products])
    supply=relation('supplier_capacity',('scenario_id','week','supplier_id'),[(s,str(t),k) for s in scenarios for t in range(T) for k in suppliers])
    plant=relation('plant_capacity',('scenario_id','week','plant_id'),[(s,str(t),p) for s in scenarios for t in range(T) for p in plants])
    def n(row,field):return integer(row[field],field)
    data={'format':'l06-feasibility-instance/2',**{k:facts[k] for k in GLOBAL},
          'raw_materials':raw_ids,'products':products,'plants':plants,
          'raw_volume':[n(r,'volume') for r in raw_rows],'raw_holding_minor':[n(r,'holding_minor') for r in raw_rows],
          'initial_raw':[n(r,'initial_units') for r in raw_rows],
          'product_volume':[n(r,'volume') for r in product_rows],'product_holding_minor':[n(r,'holding_minor') for r in product_rows],
          'initial_products':[n(r,'initial_units') for r in product_rows],'production_hours':[n(r,'hours') for r in product_rows],
          'sales_price_minor':[n(r,'sales_price_minor') for r in product_rows],
          'allowed':[[n(routes[(p,j)],'allowed') for j in products] for p in plants],
          'production_cost_minor':[[n(routes[(p,j)],'production_cost_minor') for j in products] for p in plants],
          'bom':[[n(bom[(j,m)],'units') for m in raw_ids] for j in products],
          'suppliers':[{'id':r['supplier_id'],'lead_weeks':n(r,'lead_weeks'),'freight_minor':n(r,'freight_minor'),'minimum_volume':n(r,'minimum_volume'),
                        'pack_units':[n(quotes[(r['supplier_id'],m)],'pack_units') for m in raw_ids],
                        'price_minor':[n(quotes[(r['supplier_id'],m)],'unit_price_minor') for m in raw_ids]} for r in supplier_rows],
          'scenarios':[{'id':r['scenario_id'],'probability_numerator':n(r,'probability_numerator'),
                        'demand':[[n(demand[(r['scenario_id'],str(t),j)],'units') for j in products] for t in range(T)],
                        'supplier_capacity_volume':[[n(supply[(r['scenario_id'],str(t),k)],'volume') for k in suppliers] for t in range(T)],
                        'plant_capacity_hours':[[n(plant[(r['scenario_id'],str(t),p)],'hours') for p in plants] for t in range(T)]} for r in scenario_rows]}
    return validate_instance(data)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['export','read'],required=True)
    parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    try:
        if args.mode=='export':write_packet(read_json(args.input,'instance_invalid'),args.output)
        else:
            result=read_packet(args.input);args.output.parent.mkdir(parents=True,exist_ok=True)
            if args.output.exists():raise ValueError('new_output_required')
            args.output.write_text(json.dumps(result,indent=2)+'\n')
    except InputError as error:
        print(json.dumps({'status':'invalid','error':error.code,'where':error.path,'detail':error.detail}));raise SystemExit(2)
    print(json.dumps({'status':'completed','mode':args.mode,'output':str(args.output)}))


if __name__=='__main__':main()
