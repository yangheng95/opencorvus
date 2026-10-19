# 生命周期与目录租约证据

对应[记录](../../records/2026-10/2026-10-20-instance-lifecycle-authority.md)。聚焦生产合同、保留全部65个项目的真实HTTP配置保存/恢复与公开关闭后的物理结算；所有模型请求流式使用已授权gpt-6.1-sol。完整数据库、配置原件和成对凭据均不进入仓库。

验收结果见results.json；配置性能仍按cold≤10s、restore≤5s、并发page read≤20s原门槛判定。

最终94个聚焦用例/306断言通过。family-checks和nested-publication-initial保留原始夹具/全局空集断言失败，分别由project-deletion-final和publication-final给出按当前合同的正向复验。primitive-contracts含旧store5个用例，最终计数用final-shared-contracts中的store7个替代，未重复计算。

真实65项目配置cold22.930s、restore5.698s均超原门槛；实际重叠的页面Config读取9.953s合格，整体性能仍failed。HTTP完整恢复、原生退出与成对退休通过。
