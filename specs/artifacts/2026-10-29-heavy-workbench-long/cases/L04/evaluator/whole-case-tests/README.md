# L04完整整题实测与独审

当前L04/0.2.0-dev已限定开发冻结。主根`D:/opencorvus-benchmark-runs/l04-full-case-20261031`，最终产品为handover-submission、handover-base/money/identity；弱报告为handover-weak相应三输入。13份public只给候选，私有参考/权重/错误答案不得移交。

真实同checker主参考[100/21pass](main-assessment.json)、[原命令](handover-reviewed-command.json)；[弱报告96](weak-assessment.json)/H02关键失败/goodfalse/exit2，数字正确但伪保证不能补偿。均为作者参考/错误控制，不是LLM成绩。早期没有完整评分的对象保持null；不手写总分或用完成状态替代业务成绩。

主和weak各三输入均真实native0，四营业链及两身份保留中止各完成。每营业链真实原应用读写、备份、故障/切换、v2费用退款、继续业务和报告；clean另有新写提交前/后真实中断。按邮箱合并、金额截断、错退款、版本早提交、恢复备份均真实程序进入同checker；cached-authority基例正确而映射变化后M03/M04关键失败，不能由全局金额掩盖。

[整题最终独审](independent-review/REVIEW-FINAL.md)从原SQLite另算逐身份数据/新请求/ACK/notes/audit/时间/恢复，不使用作者core作oracle；唯一额外基例直接运行自含reproduce.py、19.3405秒自然0，图真实查看。三实质阻断和原checker/探针都保留：缺自含复建、新写未绑request、只信JSON不读实际DB。最终修复按原两个真实持久金额反例复验，均明确M04失败；没有另开组件阶段/通用平台。

report实际uid/gid65534，原事实在容器700工作区、投影555/文件444，独立delivery可写；原DB在report终态后导出，grader实际只读SQLite并对原raw/request。原local旧资格/早期三输入/错误控制没有此隔离证据，不冒称执行最终字节。新公开SQL先前INDEX排序/内部表真实错误单独修复并实际重建/写入/trigger测试；原DB/已发布历史未改。

[完整成品](reference-delivery/REPORT.md)、[可复建源](reference-source/reproduce.py)和[来源收据](archive-receipt.json)可读；originals.zip约21MB保存全部主/独立文件、原raw/源码/PID/native/数据库/inspect/原失败/初评/修后/最终源，含最初checker捕获，而非事后重构。ZIP内已有每轮原capsule，不以摘要/文件数作功能门。

本次仅明示合成SQLite/受控进程故障，非任意并发/物理掉电/无损降级/OS安全保证。熟悉参考的非盲AI独审不是职业真人或统计成熟认证；秒级参考/业务场景数不证明agent有效小时。全套8/10开发合同，fresh区分度/小时和L05/L01、已触发L02/L06新版仍待。
