# 事故调查、恢复及交接

原始档案是明示合成的真实旧SQLite/HTTP过程，不是现实账户。原旧入口以全局event_id seen处理多租户与修订，导致B/X缺效果、A/X更高冲突仍留旧100、B/Y取消未反映；A/X外部已提交却丢ACK，Z仅登记未外发。调查依据原journal、legacy_seen/projection、不可改wire与receiver receipts，不能把本地sent标记当外部效果。

正确业务按tenant/event_id最高revision的唯一语义折叠；最高冲突贡献0、迟到低版保留但不改目标，更高唯一解除。批准调整入账，NUL/Unicode原批注逐字保留。运输身份tenant/request_id与业务/外发posting身份不同。business/adjustment/opening是逻辑来源；负调整的资金parent可为同租户不同正post，不能按同来源强配。累计reversal不可超正post。

修复先事务暂停新接受，保存完整事实prefix与所有旧intent键/载荷，epoch不撤已飞行HTTP。原键GET/POST确定原receipt；在确认前进程退出，重启依原repair_id/阶段继续。计划提交后中断时稳定新keys已持久，不能重计划/另造key。逐来源前向补偿后同事务完成cut/推进epoch，再释放旧HTTP得到相同receipt/replayed；不能从本地stale推断远端没发生。

本次还实际演练接受提交后ACK前退出/原请求重试、两个接受者同传输身份、两个sender同pending键、receiver自然重启后继续查询。原请求/native/PID、checkpoint实际本地与receiver SQL、cuts阶段在本次events和数据库；不是文字声明。最终表图从实际本次facts重算，不缓存既有答案。两个正确资金分配可能有不同post数/parent，不以参考动作轨迹评分。

监测分别记录pending/registered、最高版冲突、已登记intent的可查询外部逐来源差异及opened/still_active/resolved/clear。零分母=0；原冲突在首修复后仍存在，不能只因账修复说业务冲突已解决；更高版接受后才解除。查询只写监测样本/告警，不替代业务修复。窗口是离散观测点，不是端到端延迟/现实SLA或agent小时。

## 范围
只有本地合作接收方提供稳定幂等键/可查询收据时，有限受控故障停止后才能沿原键收敛。没有证明无限网络故障/任意OS攻击/物理断电/真实资金服务或现实认证；更没有把引用退回旧备份冒充保留新accepted。运行器给actor本地DB与URL，live receiver DB由独立owner持有，report只读原事实。原失败/中断与正确拒绝分别列，未知身份不能猜新key。
