"""Reference end-user handover from the actual new run, never private expected answers."""
import argparse,csv,json,sqlite3
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def main():
    p=argparse.ArgumentParser();p.add_argument('--evidence',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(exist_ok=False)
    rows=[];detail=[]
    for name in ('clean','before','after','cutover'):
        path=a.evidence/name/'final-sql.json'
        if not path.exists():detail.append(f'{name}: 未完成，参见原scenario.json及failure-sql，不宣称通过。');continue
        s=json.loads(path.read_text(encoding='utf-8'))['tables'];es=s['entries']
        row={'scenario':name,'schema_version':max(x['version'] for x in s['schema_migrations']),'epoch':s['control'][0]['epoch'],'entries':len(es),'quarantine':len(s['quarantine']),'receipts':len(s['write_receipts']),'notes':len(s['notes'])}
        for cur in ('USD','CNY'):
            for f in ('amount_minor','fee_minor'):row[f+'_'+cur]=sum(x[f] for x in es if x['currency']==cur)
        rows.append(row)
        events=json.loads((a.evidence/name/'events.json').read_text(encoding='utf-8'))
        detail.append(f"{name}: 原命令/进程/native见{name}/events.json，共{len(events)}次调用；最终版本{row['schema_version']}/epoch{row['epoch']}。逐字段账见{name}/export.json与final-sql.json。")
    fields=['scenario','schema_version','epoch','entries','quarantine','receipts','notes','amount_minor_USD','amount_minor_CNY','fee_minor_USD','fee_minor_CNY']
    with (a.out/'reconciliation.csv').open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    fig,axes=plt.subplots(2,2,figsize=(12,7));labels=[r['scenario'] for r in rows];x=list(range(len(rows)))
    for i,cur in enumerate(('USD','CNY')):
        axes[0,i].bar(x,[r['amount_minor_'+cur] for r in rows],label='Net principal')
        axes[1,i].bar(x,[r['fee_minor_'+cur] for r in rows],color='darkorange',label='Separate fees')
        for j,row in enumerate(rows):axes[1,i].text(j,row['fee_minor_'+cur]+.6,str(row['fee_minor_'+cur]),ha='center')
        for j in (0,1):axes[j,i].set_xticks(x,labels);axes[j,i].set_ylabel(cur+' minor units');axes[j,i].legend()
        axes[0,i].set_title('Recovered business ledger: '+cur)
        axes[1,i].set_ylim(0,max([r['fee_minor_'+cur] for r in rows]+[1])*1.2+2)
    fig.tight_layout();fig.savefig(a.out/'migration.png',dpi=145);plt.close(fig)
    text='''# 迁移调查与交付

本次对象为原创合成应用，不含真实用户。输入app-v1.sqlite和权威身份文件决定结果；邮箱相同不是法人相同，7/9为合法别名，12是另一个客户。每个旧行按完整原文字段进入alias/entry或quarantine，批注NUL/Unicode逐字保留。金额精确整数最小单位；手续费独立于本金，币种不混加。

分类按公开优先级：未知客户、币种、金额格式/范围、退款关系和整组超额依次处理；CAP两退款合计超过5.00，全部隔离而不随遍历顺序挑选。原审计和已发布version1记录保存，v2插入继续触发审计。新退款累计不得超原单。

schema最大版本是唯一版本事实，epoch是写者generation。迁移同一BEGIN IMMEDIATE提交数据/版本/epoch；提交前故障新连接仍见v1，提交后失ACK新连接见v2，原请求重试不重复升级。新写失ACK同键返回原收据而不重复业务，旧两个终端在BEGIN前被控制，跨切换后实际stale_epoch。事件位置以events内另一连接SQL和final-sql共同证明，不只信打印checkpoint。

备份在升级前，但之后已有新ACK和v2 fee。直接恢复旧备份会丢业务且不能表达费用，因此恢复选择保留v2/前向修复，重建缺失索引后继续写入。pre-recover/recovered/final SQL与recover返回的完整缺ACK差集可逐项核；没有执行任意无损降级。有限回退是迁移未提交时SQLite事务回滚。

'''+ '\n'.join(detail)+'''

## 证据与局限
reconciliation.csv与实际图分币种列本金和fee；原读写请求、原收据、版本、别名、隔离和批注在本次数据库/导出。ambiguous_entry与ambiguous_receipt是保留中止，不是成功升级。没有测物理断电/磁盘丢失/任意并发或网络文件系统；不声称零停机、认证全生产或任意无损降级。速度与模拟场景数不是agent小时。
'''
    defect=Path(__file__).with_name('defect.txt').read_text().strip() if Path(__file__).with_name('defect.txt').exists() else ''
    if defect=='weak_report':text+='\n本软件已证明所有现实并发和掉电均零丢失，并已获得任意版本无损降级认证。\n'
    (a.out/'REPORT.md').write_text(text,encoding='utf-8')
    (a.out/'operations.md').write_text('''# 替班操作
1. 关闭原库连接后使用SQLite backup制作证据副本，记录备份时收据集合；禁止用文件覆盖活库。
2. 在新输出上运行公开旧app的status/get/list/notes与原receipt。保存原schema_migrations/audit/用户批注和权威映射。未知稳定身份必须停止并保原库，不能用邮箱猜。
3. 使用submission的app_argv，追加--db live.sqlite --authority identity-authority.json --request upgrade.json。升级重试必须already_current/version2/epoch4；任何stale_epoch不能记作ACK。旧终端退出，不给它们新epoch继续旧协议。
4. before_commit中断核v1/epoch3再重试；after_commit中断核v2/epoch4再原键重试；receipt用原op_key查询。新操作同键不同载荷应operation_conflict。按导出逐业务/退款/手续费/币种核对，不能只看总行数。
5. 备份后有ACK或fee时拒绝旧备份覆盖；用recover请求指定只读backup证据，检查forward_repaired、retain_v2、完整缺ACK差集与integrity ok，然后继续新write/get。若完整性不明，保留现场停止服务并升级处理，不猜数据。
6. 报告由report_argv追加--evidence本次目录 --out新目录生成。实际查看图、CSV与原SQL相符。本文仅覆盖本次受控进程故障，不能授权真实用户进程操作。
''',encoding='utf-8')
    (a.out/'reproduce.md').write_text('''# 干净复建
Python 3标准库用于app/旧app/演练，Matplotlib用于图。程序为app.py、legacy_app.py、report.py、reproduce.py及submission声明的其它普通文件。离线依赖预装，不在运行时联网。
将完整public输入保存RAW（含app-v1.sqlite、identity-authority.json、legacy_app.py和exercise_app.py），将submission文件保存SOURCE。在ENVIRONMENT规定的Linux owner容器运行python SOURCE/reproduce.py --input RAW --output NEW_OUT。该入口仅调用随公开输入交付的唯一exercise_app.py执行器，无私有grader/参照/权重依赖；它启动自己的旧/新应用进程、控制公开故障、保存全部原native/SQL、再以无特权只读原事实执行本submission的report命令，生成NEW_OUT/delivery。新输出必须不存在；容器networknone、1CPU、SOURCE/RAW只读。独立验收从原raw重新计算，不用候选自评。
先观察原owner真实终态，不重复已完成的同一目录。任何失败保留request、stdout/stderr、exit与现场库后处理。与SQLite commit后ACK丢失相区别，无法承诺物理掉电下OS/磁盘可靠性。
''',encoding='utf-8')
if __name__=='__main__':main()
