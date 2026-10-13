# 删除 MySQL 转换能力的证据

[用户要求、Recall、影响面和删除方案](../../records/2026-10/2026-10-14-remove-mysql-transfer.md)。

`verification.json` 保存10个受影响文件的原始逐文件结果、schema重跑和最终94项不同检查统计；`focused-tests.log` 与 `schema-recheck.log` 只抽取实际checker的case/退出结果，首次清理失败明确保留。其余日志为正式SDK生成、类型、API文档/路由和架构索引检查原输出。

`prior-393-*` 是上一批393最终正常推送和精确提交架构检查输出，不计入本轮删除验收。没有 UI 自动化、视觉验收、外部Provider模型调用或原始数据库改写。

归档日志仅规范换行与行尾空白，原输出保留于本地执行目录。
