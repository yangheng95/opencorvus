"""Author-only original simulated reports; no cleaned effect table is public."""
from pathlib import Path
from html import escape
import argparse,csv,json

def build(out):
    out=Path(out);archive=out/'archive';archive.mkdir(parents=True,exist_ok=False);index=[]
    def report(identity,registry,kind,metadata,data=(),released='2024-06-01T10:00:00Z',revision=0,notes=''):
        fields={'Registration record':registry,**metadata};headers=['row_id','endpoint','week','arm','n','mean','spread','spread_kind','units']
        if len(index)%2:headers=headers[4:]+headers[:4]
        parts=['<!doctype html><html lang="zh"><meta charset="utf-8"><title>'+escape(identity)+'</title><body>',
          '<h1>'+escape(identity)+' · 原创模拟成人培训档案</h1>',
          '<p>本文件不是现实研究。来源身份与组统计须保留，报告不等于独立人群。</p><dl>']
        for k,v in fields.items():parts+=['<dt>'+escape(k)+'</dt><dd>'+escape(str(v))+'</dd>']
        parts+=['</dl><h2 id="methods">方法与登记背景</h2><p>'+escape(notes)+'</p>']
        if data:
            parts+=['<h2>原始观察组汇总</h2><table id="outcomes"><thead><tr>'+''.join('<th>'+h+'</th>' for h in headers)+'</tr></thead><tbody>']
            for row in data:parts+=['<tr id="'+escape(row['row_id'])+'">'+''.join('<td>'+escape(str(row[h]))+'</td>' for h in headers)+'</tr>']
            parts+=['</tbody></table><p>n是该组该时点实际观察数；spread_kind为SD、SE或NR。NR不意味着零。没有将组数据预转换为效应或逆方差。</p>']
        parts+=['<h2 id="limitations">资料边界</h2><p>研究方案、分析角色与发布记录须交叉核对。摘要的醒目结果不自动等于登记主要终点；后续更正只在其发布后生效。没有个体级数据，不能自行核验未给出的受试者重叠或假设缺失机制。</p></body></html>']
        (archive/(identity+'.html')).write_text('\n'.join(parts)+'\n',encoding='utf-8')
        index.append({'report_id':identity,'file':identity+'.html','kind':kind,'revision':revision,'released_at':released})
    def row(identity,arm,n,mean,spread,kind='SD',unit='points',endpoint='transfer_score',week=12):
        return dict(row_id=identity,endpoint=endpoint,week=week,arm=arm,n=n,mean=mean,spread=spread,spread_kind=kind,units=unit)
    specs=[
      ('R01','A','primary','2023-01-10','individual lottery',40,40,[(40,'68','12'),(40,'60','10')]),
      ('R02','B','primary','2023-02-15','individual lottery',60,55,[(60,'67','10'),(55,'60','11')]),
      ('R03','C','primary','2023-03-12','classroom lottery',80,80,[(80,'72','14'),(80,'64','13')]),
      ('R04','D','primary','2023-04-03','classroom lottery',60,60,[(60,'65','10'),(60,'60','10')]),
      ('R05','E','primary','2023-04-20','individual lottery',70,50,[(30,'64','9'),(40,'68','10'),(50,'60','11')]),
      ('R06','A','secondary','2023-03-01','individual lottery',40,40,[(40,'69','12'),(40,'60','10')]),
      ('R07','G','primary','2023-05-01','alternating intake weeks',40,40,[(40,'75','11'),(40,'60','10')]),
      ('R08','H','primary','2023-05-10','individual lottery',40,40,[(40,'66','NR'),(40,'62','NR')]),
      ('R09','I','primary','2023-05-18','individual lottery',50,50,[(25,'60','13'),(26,'62','11')]),
      ('R10','J','primary','2023-06-01','individual lottery',100,100,[(100,'.32','.01'),(100,'.35','.012')]),
      ('R11','K','primary','2023-06-10','individual lottery',30,30,[(30,'80','12'),(30,'61','11')]),
      ('R12','L','primary','2023-07-01','individual lottery',45,45,[(45,'70','12'),(45,'64','10')])]
    for registry,cohort,role,date,assignment,nt,nc,values in specs:
        meta={'Cohort code':cohort,'Study role':role,'Registered on':date,'Population':'adult workers',
          'Experimental condition':'simulator','Comparator':'routine','Assignment mechanism':assignment,
          'Randomized experimental':nt,'Randomized control':nc,'Cluster size':'10' if 'classroom' in assignment else 'not applicable',
          'ICC':'.04' if registry=='R03' else 'not reported' if registry=='R04' else 'not applicable'}
        report(registry+'-REG',registry,'registry',meta,released='2023-08-01T10:00:00Z',
          notes='组分配机制按原注册文字；成人迁移表现为登记目标。'+('这是对A队列的次要再分析，未重新招募受试者。' if role=='secondary' else '按登记角色作主要研究。'))
        concealment='not reported' if registry in ['R04','R08'] else 'sealed central assignment'
        body={'Allocation concealment':concealment,'Outcome assessor':'masked' if registry not in ['R09'] else 'not masked',
          'Analysis notes':'未给个体数据；观察人数低于随机人数时，完整原因未核证。'}
        groups=[]
        for i,(n,mean,sd) in enumerate(values):
            arm=('T1' if i==0 else 'T2' if i==1 else 'C') if registry=='R05' else 'T' if i==0 else 'C'
            endpoint='transfer_errors' if registry=='R10' else 'satisfaction' if registry=='R11' else 'transfer_score'
            groups.append(row(registry+'-12-'+arm,arm,n,mean,sd,kind='SE' if registry=='R10' else 'SD',unit='proportion' if registry=='R10' else 'points',endpoint=endpoint))
        if registry=='R01':
            groups +=[row('R01-8-T','T',40,'80','12',week=8),row('R01-8-C','C',40,'58','10',week=8),row('R01-24-T','T',38,'64','13',week=24),row('R01-24-C','C',37,'61','10',week=24)]
        if registry=='R02':groups +=[row('R02-12-sat-T','T',60,'86','8',endpoint='satisfaction'),row('R02-12-sat-C','C',55,'65','10',endpoint='satisfaction')]
        report(registry+'-MAIN',registry,'full_report',body,groups,notes='研究结果表包含本次实际观察组；不要混用满意度、不同随访或分散度定义。'+('两个治疗版本共享唯一C组，不能独立计两份对照。' if registry=='R05' else ''))
    report('R01-ABS','R01','abstract',{'Allocation concealment':'not reported','Outcome assessor':'not reported'},
      [row('R01-abs-8-T','T',40,'80','12',week=8),row('R01-abs-8-C','C',40,'58','10',week=8)],released='2024-03-01T10:00:00Z',notes='大会摘要突出8周结果，不能替代12周目标。')
    report('R02-APP','R02','appendix',{'Allocation concealment':'sealed central assignment','Outcome assessor':'masked'},
      [row('R02-app-12-T','T',60,'67','10'),row('R02-app-12-C','C',55,'60','11')],released='2024-07-01T10:00:00Z',notes='附录确认12周原表，分散度栏为SD，不是SE。')
    report('R02-COR','R02','correction',{'Allocation concealment':'sealed central assignment','Outcome assessor':'masked','Replaces':'R02-APP'},
      [row('R02-cor-12-T','T',60,'56','10'),row('R02-cor-12-C','C',55,'60','11')],released='2025-06-01T10:00:00Z',revision=1,
      notes='数据核查发现治疗组旧均值67由错列产生，正确均值56。其余组n/SD与控制组不变；本更正的发布日期不能回溯修改初始综述。')
    registry='R13'
    report('R13-REG',registry,'registry',{'Cohort code':'M','Study role':'primary','Registered on':'2024-01-10','Population':'adult workers','Experimental condition':'simulator','Comparator':'routine','Assignment mechanism':'individual lottery','Randomized experimental':90,'Randomized control':90,'Cluster size':'not applicable','ICC':'not applicable'},released='2025-04-01T10:00:00Z',notes='新独立M队列；本档发布日期为注册记录公开可得时间，不等于注册日期。')
    report('R13-MAIN',registry,'full_report',{'Allocation concealment':'sealed central assignment','Outcome assessor':'masked'},
      [row('R13-12-T','T',90,'58','12'),row('R13-12-C','C',90,'63','12')],released='2025-06-10T10:00:00Z',notes='新增独立队列与负向观察结果；不因效应为负而排除。')
    with (archive/'index.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['report_id','file','kind','revision','released_at']);w.writeheader();w.writerows(index)
    with (out/'correspondence.csv').open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['message_id','registry_a','registry_b','relation','released_at','source_locator']);w.writeheader();w.writerows([
          dict(message_id='M01',registry_a='R01',registry_b='R06',relation='certain_same',released_at='2024-08-01T10:00:00Z',source_locator='correspondence.md#M01'),
          dict(message_id='M02',registry_a='R10',registry_b='R12',relation='possible',released_at='2024-08-02T10:00:00Z',source_locator='correspondence.md#M02')])
    (out/'correspondence.md').write_text('# 原创模拟作者往来\n\n## M01\nR06作者确认：R06再分析的全部参与者就是R01的A队列，未新招募；研究角色secondary。不能计作新的独立样本。\n\n## M02\nR10与R12都在同一地区部分重合招募时窗；无可匹配受试者ID，双方目前不能确认是否重叠。只是possible，既不能证明同人，也不能证明独立。按既定保守主规则并另作不同人群敏感性。\n',encoding='utf-8')
    print(json.dumps({'reports_including_registry':len(index),'raw_rows':sum(p.read_text(encoding='utf-8').count('<tr id=') for p in archive.glob('*.html')),'cleaned_effect_table_provided':False}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args();build(a.output)
