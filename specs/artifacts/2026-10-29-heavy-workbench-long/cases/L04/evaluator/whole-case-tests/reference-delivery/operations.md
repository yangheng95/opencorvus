# 替班操作
1. 关闭原库连接后使用SQLite backup制作证据副本，记录备份时收据集合；禁止用文件覆盖活库。
2. 在新输出上运行公开旧app的status/get/list/notes与原receipt。保存原schema_migrations/audit/用户批注和权威映射。未知稳定身份必须停止并保原库，不能用邮箱猜。
3. 使用submission的app_argv，追加--db live.sqlite --authority identity-authority.json --request upgrade.json。升级重试必须already_current/version2/epoch4；任何stale_epoch不能记作ACK。旧终端退出，不给它们新epoch继续旧协议。
4. before_commit中断核v1/epoch3再重试；after_commit中断核v2/epoch4再原键重试；receipt用原op_key查询。新操作同键不同载荷应operation_conflict。按导出逐业务/退款/手续费/币种核对，不能只看总行数。
5. 备份后有ACK或fee时拒绝旧备份覆盖；用recover请求指定只读backup证据，检查forward_repaired、retain_v2、完整缺ACK差集与integrity ok，然后继续新write/get。若完整性不明，保留现场停止服务并升级处理，不猜数据。
6. 报告由report_argv追加--evidence本次目录 --out新目录生成。实际查看图、CSV与原SQL相符。本文仅覆盖本次受控进程故障，不能授权真实用户进程操作。
