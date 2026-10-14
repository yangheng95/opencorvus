# 双升级候选首次检查器失败原件

101个原文件、12464172原bytes；[manifest](manifest.json)记录实际映射。[408 Recall](../../../records/2026-10/2026-10-14-grant-decision-recovery-408.md)说明当前选择与未完成项。gzip字节回读只核归档身份，不是功能验收。

原lock-followup-01真实exit1，只启动一个case和三个worker，退出码0/0/1；原request、physical、output均闭合，唯一自有数据根在闭合后删除。首失败及完整输入保留，后续after-race、backup、validator未启动，不能计入覆盖。

两个候选共同起点前都已在NORMAL/WAL下读取完整v1。实际一个原migrator返回1→2及真实v1 backup；另一个返回2→2，在检查器固定要求from1时失败。两份实际完整数据快照保真，第一候选实际NORMAL访问释放已记录；第二候选只执行了失败后的strict close。不是两次版本升级，也不是两个旧decoder获准继续工作。

[原外层回执](original-failed-run/owner.json.gz)、[原driver回执](original-failed-run/driver-owner.json.gz)、[共同起点](original-failed-run/normal-candidate-race/race-start.gz)、[第二原调用](original-failed-run/normal-candidate-race/race-b-attempt.json.gz)、[原失败stderr](original-failed-run/normal-candidate-race/race-b-stderr.log.gz)和[完整只读根因分析](prepared-input/followup01-race-analysis.md.gz)一同保留。对应SQLite Windows源码解释主动锁转换的差异；没有操作系统逐步锁trace，不能断言精确原生调用时刻。

归档还承接b082正常范围提交、上游同步、精确提交refspec推送及正常hook原日志。当前修正输入要求分别核busy、真正upgrade和current校验；独立第三旧版连接的组合仍待鲜范围实测。没有408生产、正式测试、业务迁移、UI或模型资格，排除DB/runtime、凭据、私有页面bundle和Provider完整正文。
