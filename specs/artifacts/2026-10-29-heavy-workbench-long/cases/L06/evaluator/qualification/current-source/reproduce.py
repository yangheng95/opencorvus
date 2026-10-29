"""Reference source pipeline: public raw facts -> new optimization -> full delivery.

Reads no archived matrix, old plan, registered bound or evaluator rubric.
"""
import argparse,copy,csv,json,platform,sys,time
from datetime import datetime,timezone
from fractions import Fraction
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy,scipy,ortools

from check_l06 import evaluate,PlanError
from l06_input import read_json
from l06_packet import read_packet,HEADERS
from l06_delivery import expected_delivery,operational_decisions
from qualify_l06 import build_model
from l06_integer import solve_integer


COMPONENTS={'purchase_cost':'材料采购','freight_cost':'固定运费','production_cost':'生产','holding_cost':'持有'}


def dump(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')


def run_metadata(args,started,start,solver,business=None,alternative_complete=False):
    kind='completed' if solver['status'] in ('OPTIMAL','INFEASIBLE') else 'resource_limit' if solver['status']=='FEASIBLE' else 'failed' if solver['status']=='MODEL_INVALID' else 'unknown'
    return {'format':'l06-run/1','input_path':str(args.input),'command':[sys.executable,*sys.argv],
            'dependencies':{'python':platform.python_version(),'numpy':numpy.__version__,'scipy':scipy.__version__,'matplotlib':matplotlib.__version__,'ortools':ortools.__version__},
            'parameters':{'workers':args.workers,'seed':args.seed,'relative_gap':args.relative_gap,'solver_seconds':args.solver_seconds,'warm_start':None},
            'algorithm':{'name':'CP-SAT plus explicitly validated local comparison','termination_kind':kind,'termination_detail':solver['termination']},
            'native_solver':{'name':solver['solver'],'version':solver['solver_version'],'status':solver['status'],'objective_minor':solver['objective'],'best_bound_minor':solver['dual_bound']},
            'feasibility':'feasible' if business is not None else 'infeasible' if solver['termination']=='infeasible' else 'unknown',
            'delivered_cost_minor':None if business is None else business['expected_cost_minor'],'started_utc':started,'finished_utc':datetime.now(timezone.utc).isoformat(),'elapsed_seconds':time.perf_counter()-start,
            'source_only_inputs':'supplied raw packet plus declared source/dependencies; no prior matrix/plan/reference/rubric',
            'execution_evidence':['solver/response-stats.txt','solver-result.json'],'alternative_complete':alternative_complete,
            'timing_definition':'inside main after module imports; external runner separately measures complete process/container wall time'}


def alternative_policy(data,plan):
    """A bounded, explicitly validated policy comparison, using the one checker."""
    base=operational_decisions(plan);attempts=[]
    def attempt(t,name,change,description):
        trial=copy.deepcopy(base)
        targets=[s['id'] for s in data['scenarios']] if t<data['common_weeks'] else [name]
        for s in targets:change(trial['decisions'][s])
        try:business=evaluate(data,trial)
        except PlanError as error:
            attempts.append({'change':description,'scenario':targets,'week':t,'result':error.code,'where':error.where});return None
        attempts.append({'change':description,'scenario':targets,'week':t,'result':'business_feasible','cost_exact':business['expected_cost_exact']})
        return trial,business,{'change':description,'scenarios':targets,'week':t,'attempts':attempts}
    for t in reversed(range(data['weeks'])):
        for scenario in data['scenarios']:
            name=scenario['id'];production=base['decisions'][name]['production'][t]
            for p,row in enumerate(production):
                for j,quantity in enumerate(row):
                    if quantity<1:continue
                    for target in range(len(data['plants'])):
                        if target==p or data['allowed'][target][j]!=1:continue
                        def move(record,p=p,j=j,target=target,t=t):record['production'][t][p][j]-=1;record['production'][t][target][j]+=1
                        found=attempt(t,name,move,{'kind':'production_transfer','product':data['products'][j],'from':data['plants'][p],'to':data['plants'][target],'units':1})
                        if found:return found
            for k,rule in enumerate(data['suppliers']):
                if t+rule['lead_weeks']>=data['weeks']:continue
                for m,pack in enumerate(rule['pack_units']):
                    volume=pack*data['raw_volume'][m];increment=max(1,(rule['minimum_volume']+volume-1)//volume)
                    def buy(record,t=t,k=k,m=m,increment=increment):record['order_lots'][t][k][m]+=increment;record['truck_on'][t][k]=1
                    found=attempt(t,name,buy,{'kind':'additional_pack_purchase','supplier':rule['id'],'raw':data['raw_materials'][m],'lots':increment})
                    if found:return found
    return None,None,{'result':'no_verified_local_alternative','attempts':attempts}


def operations(data,plan,path):
    with path.open('w',encoding='utf-8',newline='') as file:
        writer=csv.writer(file);writer.writerow(['scenario_or_information_set','week','action','entity','secondary_entity','quantity','unit'])
        for scenario in data['scenarios']:
            name=scenario['id'];record=plan['decisions'][name]
            for t in range(data['weeks']):
                if t<data['common_weeks'] and name!=data['scenarios'][0]['id']:continue
                information='all_scenarios' if t<data['common_weeks'] else name
                for k,rule in enumerate(data['suppliers']):
                    writer.writerow([information,t,'shipment',rule['id'],'',record['truck_on'][t][k],'0_or_1'])
                    for m,raw in enumerate(data['raw_materials']):writer.writerow([information,t,'order',rule['id'],raw,record['order_lots'][t][k][m],'pack_lots'])
                for p,plant in enumerate(data['plants']):
                    for j,product in enumerate(data['products']):writer.writerow([information,t,'production',plant,product,record['production'][t][p][j],'pieces'])


def draw(data,ledger,output):
    figures=output/'figures';figures.mkdir()
    plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.dpi':140})
    fig,axis=plt.subplots(figsize=(9,4.7))
    for name,record in ledger['scenarios'].items():axis.plot([r['week'] for r in record['weeks']],[r['cash'] for r in record['weeks']],marker='o',markersize=3,label=name)
    axis.axhline(-data['credit_limit_minor'],color='#b33b32',linestyle='--',label='Credit floor');axis.axhline(0,color='#64748b',linewidth=.8)
    axis.set(xlabel='Week (zero based)',ylabel='Cash (minor units)',title='Scenario cash after actual receipts and all weekly payments',xticks=list(range(data['weeks'])));axis.legend(fontsize=8);axis.grid(axis='y',alpha=.18);fig.tight_layout();fig.savefig(figures/'cash.png');fig.savefig(figures/'cash.svg');plt.close(fig)
    fig,axis=plt.subplots(figsize=(9,4.7));names=list(ledger['scenarios']);bottom=numpy.zeros(len(names))
    for key,label in [('purchase_cost','Material purchase'),('freight_cost','Freight'),('production_cost','Production'),('holding_cost','Inventory holding')]:
        values=[sum(r[key] for r in ledger['scenarios'][name]['weeks']) for name in names];axis.bar(names,values,bottom=bottom,label=label);bottom+=values
    axis.set(ylabel='Total spending (minor units)',title='Cost components by scenario');axis.legend(fontsize=8,bbox_to_anchor=(1.02,1),loc='upper left');axis.grid(axis='y',alpha=.18);fig.tight_layout();fig.savefig(figures/'cost.png');fig.savefig(figures/'cost.svg');plt.close(fig)
    fig,axes=plt.subplots(2,1,figsize=(9,7),sharex=True)
    for axis,key,cap,title in [(axes[0],'raw_stage_peak_volume',data['raw_storage_volume'],'Raw stock after arrivals, before production'),(axes[1],'product_stage_peak_volume',data['product_storage_volume'],'Finished stock after production, before delivery')]:
        for name,record in ledger['scenarios'].items():axis.plot([r['week'] for r in record['weeks']],[r[key] for r in record['weeks']],marker='o',markersize=3,label=name)
        axis.axhline(cap,color='#b33b32',linestyle='--',label='Storage capacity');axis.set(ylabel='Volume units',title=title,ylim=(0,max(1,cap*1.1)));axis.legend(fontsize=8,bbox_to_anchor=(1.02,1),loc='upper left');axis.grid(axis='y',alpha=.18)
    axes[-1].set(xlabel='Week (zero based)',xticks=list(range(data['weeks'])));fig.tight_layout();fig.savefig(figures/'storage.png');fig.savefig(figures/'storage.svg');plt.close(fig)


def report(data,plan,ledger,summary,baseline,alternative,comparison,solver,output):
    lines=['# 情景运营方案与交接','', '本报告由本次原始CSV/设施输入、实际新求解和验证后的账生成。所有数量/金额为明示合成单位；金额精确值在JSON，图和比例用于展示。','',
           '## 结论与求解范围','',f"原生状态为{solver['status']}，termination={solver['termination']}，实际solver耗时{solver['seconds']:.3f}秒，worker={solver['solver_options']['num_search_workers']}。达到非零gap不表示精确最优；原生下界不是独立有理dual/search proof。",'',
           f"本次交付期望支出为{summary['expected_cost_minor']['numerator']}/{summary['expected_cost_minor']['denominator']}最小单位，原生界为{solver['dual_bound']}。没有读取旧策略、注册成本界或评分权重。",'',
           '## 方案比较','', '| 策略 | 实际完整可行成本（精确） | 来源 |','| --- | ---: | --- |']
    for name,business,description in [('本方案',evaluate(data,plan),'本次求解/验证后的选择'),('基线',baseline,'本次solver第一个真实可行incumbent'),('替代方案',alternative,'有明确动作差异、经完整业务checker验证')]:
        cost=business['expected_cost_exact'] if business is not None else None
        lines.append(f"| {name} | {str(cost['numerator'])+'/'+str(cost['denominator']) if cost else '未得到'} | {description} |")
    lines+=['',f"替代动作及全部实际尝试见[alternative-search.json](alternative-search.json)：{json.dumps({k:v for k,v in comparison.items() if k!='attempts'},ensure_ascii=False)}。比较只计本模型的真实支出和资源占用，不虚构模型外的收益。替代若更贵，不能称其在本模型中更优；若原生与局部验证方案不同，run.json分别记录原生目标和交付目标。",'',
            '## 物料、资金与信息合同','',
            '原料期末=上期末+按提前期到货−BOM耗料；成品期末=上期末+完工−当周全部需求。仓容检查周内到货后/生产前及生产后/交付前峰值。包装和固定运费按供方合单，供应/产线容量共享。',
            f"现金期末=上周现金+{data['receipt_lag_weeks']}周前交付回款−当周下单/运费/生产/持有支出，期末AR不当现金。前{data['common_weeks']}周所有场景的订单、装运与生产共同承诺，揭示后在途到货不能重写。",'',
            '## 资金瓶颈','', '| 场景 | 最紧周 | 开周现金 | 收款 | 当周总支出 | 期末现金 | 期末AR |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for scenario in data['scenarios']:
        name=scenario['id'];rows=ledger['scenarios'][name]['weeks'];row=min(rows,key=lambda r:r['cash']);t=row['week'];opening=data['initial_cash_minor'] if t==0 else rows[t-1]['cash']
        lines.append(f"| {name} | {t} | {opening} | {row['receipts']} | {row['cost']} | {row['cash']} | {row['receivable']} |")
    lines+=['','该周费用分解、每笔下单/装运/产出与逐周现金见ledger.json；先支付订单且回款滞后，因此不能将未来销售额或期末AR用于填补本周信用。','', '## 必需预存与供应中断','']
    witnesses=[]
    for scenario in data['scenarios']:
        for t in range(1,data['weeks']):
            for j,product in enumerate(data['products']):
                upper=sum(scenario['plant_capacity_hours'][t][p]//data['production_hours'][j] for p in range(len(data['plants'])) if data['allowed'][p][j])
                required=scenario['demand'][t][j]-upper
                if required>0:witnesses.append(f"{scenario['id']}周{t}产品{product}需求{scenario['demand'][t][j]}，即使独占各合资格产线，同周上界仅{upper}，故进入该周前至少须有{required}件库存；实际前周库存为{ledger['scenarios'][scenario['id']]['weeks'][t-1]['finished_inventory'][j]}。")
    lines+=['- '+text for text in witnesses[:8]] if witnesses else ['本次逐产品独立工时上界没有提供简单必需预存见证；不据此声称共享产能完全没有跨周作用。']
    interruptions=[]
    for scenario in data['scenarios']:
        for t in range(data['common_weeks'],data['weeks']):
            for k,rule in enumerate(data['suppliers']):
                capacity=scenario['supplier_capacity_volume'][t][k]
                if capacity<rule['minimum_volume']:
                    row=ledger['scenarios'][scenario['id']]['weeks'][t]
                    interruptions.append(f"{scenario['id']}周{t}供方{rule['id']}容量{capacity}<最低装运{rule['minimum_volume']}，因此该周不能启运；实际开关{plan['decisions'][scenario['id']]['truck_on'][t][k]}。合法履约政策使用实际到货{row['arrivals']}与前存供给耗料{row['consumption']}，见操作表其他供方和早期承诺。")
    lines+=['','以下是可行选择集的约束证据，不强迫正确策略发生动作翻转：','']+(['- '+text for text in interruptions[:6]] if interruptions else ['本输入没有低于MOQ的中断见证；未捏造停供。'])
    totals={key:Fraction() for key in COMPONENTS}
    for scenario in data['scenarios']:
        for key in totals:totals[key]+=Fraction(scenario['probability_numerator'],data['probability_denominator'])*sum(r[key] for r in ledger['scenarios'][scenario['id']]['weeks'])
    total=sum(totals.values());lines+=['','## 费用与实际图形','', '| 分量 | 精确期望金额 | 比例（展示） |','| --- | ---: | ---: |']
    for key,value in totals.items():lines.append(f"| {COMPONENTS[key]} | {value} | {float(value/total)*100:.2f}% |" if total else f'| {COMPONENTS[key]} | {value} | 0 |')
    lines+=['','![实际现金](figures/cash.png)','','![费用构成](figures/cost.png)','','![周内仓容](figures/storage.png)','','## 操作与复建','',
            f"[operations.csv](operations.csv)逐条列出采购包装数、装运开关和分线生产数量（含0），前{data['common_weeks']}周标为all_scenarios，其他按真实场景ID区分。周从0开始。机器计划在plan.json，阶段/费用/现金账在ledger.json，应收定义与规范来源映射见source-map.md。",'',
            '源码项目的README说明从不存在的新输出目录复建；manifest中的outputs相对本输出根，命令和原生执行元数据在run.json。图形由相同ledger生成，未将文件存在或程序自述当独立验收。','',
            '局限：有限合成场景、固定时序与无利息信用；没有验证真实采购、未来未给情景或价格预测。数学原生gap、完整策略可行、实际执行来源和评分资格是不同结论；本程序不输出benchmark总分或小时级结论。']
    (output/'report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--workers',type=int,default=8);parser.add_argument('--relative-gap',type=float,default=.009);parser.add_argument('--seed',type=int,default=20261029);parser.add_argument('--solver-seconds',type=float)
    args=parser.parse_args();start=time.perf_counter();started=datetime.now(timezone.utc).isoformat();args.output.mkdir(parents=True,exist_ok=False)
    data=read_packet(args.input);dump(args.output/'normalized.json',data);linear=build_model(data);dump(args.output/'model.json',linear.payload())
    solver,plan=solve_integer(data,linear,relative_gap=args.relative_gap,workers=args.workers,seed=args.seed,solver_seconds=args.solver_seconds,progress_dir=args.output/'solver')
    dump(args.output/'solver-result.json',solver)
    if plan is None:
        dump(args.output/'run.json',run_metadata(args,started,start,solver))
        dump(args.output/'manifest.json',{'format':'l06-manifest/1','status':'incomplete','outputs':{'normalized':'normalized.json','run':'run.json'},'unavailable_outputs':['plan','ledger','summary','report'],'reproduce_command':[sys.executable,*sys.argv]})
        raise SystemExit(2)
    baseline_plan=read_json(args.output/'solver/first-plan.json','first_incumbent');baseline=evaluate(data,baseline_plan)
    business=evaluate(data,plan)
    if Fraction(business['expected_cost_exact']['numerator'],business['expected_cost_exact']['denominator'])!=Fraction(solver['objective_exact']):raise ValueError('native_objective_disagrees_with_business_cost')
    alternative,alternative_business,comparison=alternative_policy(data,plan)
    if alternative_business is not None and alternative_business['expected_cost_minor']<business['expected_cost_minor']:
        plan,alternative=alternative,plan;business,alternative_business=alternative_business,business;comparison['selected']='verified local improvement; original native terminal becomes alternative'
    ledger,summary=expected_delivery(data,plan,business)
    for name,value in [('plan',plan),('ledger',ledger),('summary',summary),('baseline-plan',baseline_plan),('baseline-business',baseline),('alternative-plan',alternative),('alternative-business',alternative_business),('alternative-search',comparison)]:dump(args.output/(name+'.json'),value)
    operations(data,plan,args.output/'operations.csv');draw(data,ledger,args.output)
    mapping=['# 原始事实来源与单位','', '目录按显式index定位，联合键与单位沿用随源码提供的DATA.md；没有按物理行序或文件摘要定义身份。','']
    for name,columns in HEADERS.items():mapping.append(f'- {name}.csv：'+', '.join(columns))
    mapping+=['','原料/产品目录分别提供体积、持有费、初始件数，以及产品每件工时/销售最小单位价格；供应条款按supplier_id，报价按supplier_id/raw_id；BOM按product_id/raw_id，资格/生产费按plant_id/product_id；情景分子配facility分母，需求/容量按scenario_id/week/实体ID。','', 'facility提供周长、共同前缀、两仓容量、初始现金/信用和正回款滞后。数量为件/包装数，容量为表定体积/工时单位；所有金额为合成最小单位。normalized.json是这些业务事实的完整投影，ledger中的应收为已交付未回款销售额。']
    (args.output/'source-map.md').write_text('\n'.join(mapping)+'\n',encoding='utf-8')
    report(data,plan,ledger,summary,baseline,alternative_business,comparison,solver,args.output)
    run=run_metadata(args,started,start,solver,business,alternative is not None);run['execution_evidence'].append('solver/events.jsonl')
    dump(args.output/'run.json',run)
    dump(args.output/'manifest.json',{'format':'l06-manifest/1','outputs':{key:key+('.md' if key=='report' else '.json') for key in ['normalized','plan','ledger','summary','run','report']},'reproduce_command':[sys.executable,*sys.argv]})
    print(json.dumps({'event':'reference_delivery_complete','cost':business['expected_cost_exact'],'native_status':solver['status'],'alternative_complete':alternative is not None,'elapsed_seconds':run['elapsed_seconds']}),flush=True)
    raise SystemExit(0 if alternative is not None else 2)


if __name__=='__main__':main()
