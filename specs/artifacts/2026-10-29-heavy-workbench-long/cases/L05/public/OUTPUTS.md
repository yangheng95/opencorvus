# 交付与内容

完整source/依赖、submission、logical_map、自含reproduce与说明。report必须从本次实际evidence生成REPORT.md、operations.md、reproduce.md、recovery.png、reconciliation.csv、business.csv、monitor.csv。不得用旧答案/作者稿补原候选缺交。

reconciliation.csv逐stage(repaired-incident/repaired-current/final)/tenant给target_minor/external_minor，均USD最小单位；business.csv给stage/tenant/event_id/revision/status/amount_minor；monitor.csv给window_id/pending/total/pending_ratio/conflicts/mismatched_sources/active_json。等价完整排序/解释格式不按参考措辞或字数扣分；规定CSV接口供可执行验收，图必须实际可读、轴/单位/范围正确。

REPORT用原journal/旧代码/完整wire/真实服务收据解释事故根因、三身份/版本/冲突和unknown ACK，说明固定prefix/持久计划、真实故障和恢复、source与资金parent的区别。不得从有限受控试验推导现实所有网络exactly-once、无限故障收敛或金融认证。operations要有具体命令、原repair_id/原键查证、告警开闭、停手条件和移交；reproduce从完整public+本submission在新环境可执行，不依赖私有checker。实际图/软件运行不能被报告字数替代。
