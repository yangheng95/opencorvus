# 迁移调查与交付

本次对象为原创合成应用，不含真实用户。输入app-v1.sqlite和权威身份文件决定结果；邮箱相同不是法人相同，7/9为合法别名，12是另一个客户。每个旧行按完整原文字段进入alias/entry或quarantine，批注NUL/Unicode逐字保留。金额精确整数最小单位；手续费独立于本金，币种不混加。

分类按公开优先级：未知客户、币种、金额格式/范围、退款关系和整组超额依次处理；CAP两退款合计超过5.00，全部隔离而不随遍历顺序挑选。原审计和已发布version1记录保存，v2插入继续触发审计。新退款累计不得超原单。

schema最大版本是唯一版本事实，epoch是写者generation。迁移同一BEGIN IMMEDIATE提交数据/版本/epoch；提交前故障新连接仍见v1，提交后失ACK新连接见v2，原请求重试不重复升级。新写失ACK同键返回原收据而不重复业务，旧两个终端在BEGIN前被控制，跨切换后实际stale_epoch。事件位置以events内另一连接SQL和final-sql共同证明，不只信打印checkpoint。

备份在升级前，但之后已有新ACK和v2 fee。直接恢复旧备份会丢业务且不能表达费用，因此恢复选择保留v2/前向修复，重建缺失索引后继续写入。pre-recover/recovered/final SQL与recover返回的完整缺ACK差集可逐项核；没有执行任意无损降级。有限回退是迁移未提交时SQLite事务回滚。

clean: 原命令/进程/native见clean/events.json，共35次调用；最终版本2/epoch4。逐字段账见clean/export.json与final-sql.json。
before: 原命令/进程/native见before/events.json，共32次调用；最终版本2/epoch4。逐字段账见before/export.json与final-sql.json。
after: 原命令/进程/native见after/events.json，共32次调用；最终版本2/epoch4。逐字段账见after/export.json与final-sql.json。
cutover: 原命令/进程/native见cutover/events.json，共33次调用；最终版本2/epoch4。逐字段账见cutover/export.json与final-sql.json。

## 证据与局限
reconciliation.csv与实际图分币种列本金和fee；原读写请求、原收据、版本、别名、隔离和批注在本次数据库/导出。ambiguous_entry与ambiguous_receipt是保留中止，不是成功升级。没有测物理断电/磁盘丢失/任意并发或网络文件系统；不声称零停机、认证全生产或任意无损降级。速度与模拟场景数不是agent小时。
