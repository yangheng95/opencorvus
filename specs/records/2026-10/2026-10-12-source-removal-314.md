# 314 子会话删除与快照成员关系

[实施前Recall和影响分析](../../artifacts/2026-10-05-connection-workspace-authority/source-removal-plan-314.md)。单agent，验证实际消息移动后旧实时数据的合并行为。

已修复补全清空删除标记、旧实时消息与Sources随后复活的问题。真实生产消息移动及路由前后检查从重复归属恢复为唯一当前归属；快照与运行代次重置、重新返回及目标隔离使用同一成员事实。44项数据/路由检查、106个断言通过，类型检查与构建通过。

完整90表历史副本的真实开发页面已人工查看三条来源、列表往返、关闭重开及阅读位置。没有新模型请求或新成员；自己的页面及Native/Host已结束并取得原执行器退出码。受保护表逐行相同。静态历史验收不能替代自然流式漏帧；全部Rendering闪烁场景仍需持续调查。[完整证据与限制](../../artifacts/2026-10-05-connection-workspace-authority/source-removal-314/README.md)。
