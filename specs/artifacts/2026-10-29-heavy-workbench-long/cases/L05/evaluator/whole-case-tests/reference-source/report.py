import argparse,json,csv
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
def rows(path,fields,values):
    with path.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(values)
def targets(local):
    grouped={}
    for x in local['journal']:grouped.setdefault((x['tenant'],x['event_id']),{}).setdefault(x['revision'],set()).add((x['kind'],x['amount_minor']))
    businesses=[]
    for (t,e),versions in sorted(grouped.items()):
        rev=max(versions);payloads=versions[rev];kind,amount=next(iter(payloads)) if len(payloads)==1 else ('quarantined',0);businesses.append({'tenant':t,'event_id':e,'revision':rev,'status':kind,'amount_minor':amount})
    wanted={x['tenant']:x['amount_minor'] for x in local['opening']}
    for x in local['adjustments']+businesses:wanted[x['tenant']]=wanted.get(x['tenant'],0)+x['amount_minor']
    return businesses,wanted
def main():
    p=argparse.ArgumentParser();p.add_argument('--evidence',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(exist_ok=False)
    account_rows=[];business_rows=[];stage_data={}
    for stage in ('repaired-incident','repaired-current','final'):
        path=a.evidence/stage/'facts.json'
        if not path.exists():continue
        facts=json.loads(path.read_text(encoding='utf-8'));stage_data[stage]=facts;business,wanted=targets(facts['local'])
        business_rows.extend({'stage':stage,**x} for x in business)
        for tenant,value in sorted(wanted.items()):account_rows.append({'stage':stage,'tenant':tenant,'target_minor':value,'external_minor':sum(x['amount_minor'] for x in facts['remote']['effects'] if x['tenant']==tenant)})
    rows(a.out/'reconciliation.csv',['stage','tenant','target_minor','external_minor'],account_rows)
    rows(a.out/'business.csv',['stage','tenant','event_id','revision','status','amount_minor'],business_rows)
    events=json.loads((a.evidence/'events.json').read_text(encoding='utf-8'));samples=[x['response']['sample'] for x in events if x.get('kind')=='application' and x['request']['action']=='monitor' and isinstance(x.get('response'),dict) and 'sample' in x['response']]
    rows(a.out/'monitor.csv',['window_id','pending','total','pending_ratio','conflicts','mismatched_sources','active_json'],samples)
    fig,axes=plt.subplots(1,3,figsize=(16,4.5));final=[x for x in account_rows if x['stage']=='final'];xs=list(range(len(final)))
    axes[0].bar([x-.18 for x in xs],[x['target_minor'] for x in final],width=.36,label='Business target');axes[0].bar([x+.18 for x in xs],[x['external_minor'] for x in final],width=.36,label='Actual HTTP effects');axes[0].set_xticks(xs,[x['tenant'] for x in final]);axes[0].set_ylabel('USD minor units');axes[0].legend();axes[0].set_title('Recovered account reconciliation')
    for key,title,axis in [('pending','Pending intents',axes[1]),('mismatched_sources','Sources needing compensation',axes[2])]:
        axis.plot(range(len(samples)),[s[key] for s in samples],marker='o',label=title);axis.set_xticks(range(len(samples)),[s['window_id'] for s in samples],rotation=50,ha='right');axis.set_ylabel('Count');axis.set_title(title)
    axes[2].plot(range(len(samples)),[s['conflicts'] for s in samples],marker='x',label='Highest revision conflict');axes[2].legend();fig.tight_layout();fig.savefig(a.out/'recovery.png',dpi=140);plt.close(fig)
    body='''# 事故调查、恢复及交接

原始档案是明示合成的真实旧SQLite/HTTP过程，不是现实账户。原旧入口以全局event_id seen处理多租户与修订，导致B/X缺效果、A/X更高冲突仍留旧100、B/Y取消未反映；A/X外部已提交却丢ACK，Z仅登记未外发。调查依据原journal、legacy_seen/projection、不可改wire与receiver receipts，不能把本地sent标记当外部效果。

正确业务按tenant/event_id最高revision的唯一语义折叠；最高冲突贡献0、迟到低版保留但不改目标，更高唯一解除。批准调整入账，NUL/Unicode原批注逐字保留。运输身份tenant/request_id与业务/外发posting身份不同。business/adjustment/opening是逻辑来源；负调整的资金parent可为同租户不同正post，不能按同来源强配。累计reversal不可超正post。

修复先事务暂停新接受，保存完整事实prefix与所有旧intent键/载荷，epoch不撤已飞行HTTP。原键GET/POST确定原receipt；在确认前进程退出，重启依原repair_id/阶段继续。计划提交后中断时稳定新keys已持久，不能重计划/另造key。逐来源前向补偿后同事务完成cut/推进epoch，再释放旧HTTP得到相同receipt/replayed；不能从本地stale推断远端没发生。

本次还实际演练接受提交后ACK前退出/原请求重试、两个接受者同传输身份、两个sender同pending键、receiver自然重启后继续查询。原请求/native/PID、checkpoint实际本地与receiver SQL、cuts阶段在本次events和数据库；不是文字声明。最终表图从实际本次facts重算，不缓存既有答案。两个正确资金分配可能有不同post数/parent，不以参考动作轨迹评分。

监测分别记录pending/registered、最高版冲突、已登记intent的可查询外部逐来源差异及opened/still_active/resolved/clear。零分母=0；原冲突在首修复后仍存在，不能只因账修复说业务冲突已解决；更高版接受后才解除。查询只写监测样本/告警，不替代业务修复。窗口是离散观测点，不是端到端延迟/现实SLA或agent小时。

## 范围
只有本地合作接收方提供稳定幂等键/可查询收据时，有限受控故障停止后才能沿原键收敛。没有证明无限网络故障/任意OS攻击/物理断电/真实资金服务或现实认证；更没有把引用退回旧备份冒充保留新accepted。运行器给actor本地DB与URL，live receiver DB由独立owner持有，report只读原事实。原失败/中断与正确拒绝分别列，未知身份不能猜新key。
'''
    settings=json.loads(Path(__file__).with_name('settings.json').read_text(encoding='utf-8'))
    if settings.get('defect')=='weak_report':body+='\n现已证明任何网络分区/无限故障下所有现实支付都绝对exactly-once，并获得金融生产认证。\n'
    if not stage_data:body+='\n本次执行未形成完整营业终态；原run.json保留实际失败，不宣称通过。\n'
    (a.out/'REPORT.md').write_text(body,encoding='utf-8')
    (a.out/'operations.md').write_text('''# 替班操作
保原local/remote SQLite、原journal/批准调整/notes/ACK日志；receiver是独立HTTP服务，不能改它的effects库。以submission app_argv追加--db LOCAL --url URL --request REQUEST --input PUBLIC_RAW运行。先status/monitor incident，核未决key，不用新key重发。
pause请求带当前epoch和稳定repair_id，检查返回完整accepted prefix/intent目录；暂停仅阻新登记，不撤旧socket。repair同一repair_id恢复，确认前/计划后中断都原请求重试，不能删cuts重计划。未完成resume应repair_incomplete；全部匹配receipt并逐source对账后才推进epoch。旧generation新请求stale，已接受的原payload重试仍duplicate；变载荷必须transport_conflict。
新事件先保存accepted，业务版本按最高唯一，不按传输次数或到达先后。批准负调整先核opening+所有负调整>=0，原notes不变。双sender可以查询/同键POST竞争，收据必须逐完整payload匹配；服务重启后用原库重新启动，URL更新给新命令，同键收据不能改。
monitor离散window_id保持原样本，pending或source差异尚存不宣称业务恢复；最高版冲突只能新权威更高唯一版解决。无限故障、缺键或原载荷不可信应保留中止并人工对账，禁止回旧备份删新accepted。reconciliation.csv、business.csv和monitor.csv必须与实际数据库/HTTP收据一致。
''',encoding='utf-8')
    (a.out/'reproduce.md').write_text('''# 干净复建
Linux owner容器，Python3/SQLite标准库、Matplotlib离线依赖；networknone/1CPU。完整public挂/raw只读，本submission挂/source只读，新/results可写。执行python /source/reproduce.py --input /raw --output /results/run。仅使用公开exercise.py和本source，无私有checker/权重/参考/旧答案依赖；actor UID10001只可写自己的本地库，report UID65534只读事实副本，原对象owner700在report终态后导出。
输出包括完整原请求/native/故障/两事务域真实SQLite、阶段原事实、监测/告警与delivery。逻辑表/列由logical-map.json映射到实际SQLite对象；其它正确schema/资金策略可以不同。先核原owner自然终态，保失败而非重跑覆盖旧目录。所有接口及本次故障类别在public合同中，不需访问其它项目。
''',encoding='utf-8')
if __name__=='__main__':main()
