# 383 完整工具结果与来源恢复

本轮单 agent 按 [Recall 与实施方案](../../artifacts/2026-10-05-connection-workspace-authority/source-result-commit-plan-383.md) 修复382实际复现的两类断点：Tool已完成但Source失败，以及成功receipt被中断恢复误写为失败。

Session现在将Tool outcome、来源、行内产物display与事件outbox一起提交，完整提交后才退休处理器调用。来源身份去重只有一个实现。Source/display的toolPartID由应用和SQLite共同验证，同一Message中真实已完成调用的结果可在恢复时晚到结算；普通内容不可变规则保持。fork重映射该绑定。

Full access与Ask me通过相同的精确调用身份读取成功receipt。处理器错误收敛和共享Session中断恢复物化原输出、附件、来源和display，不重新执行外部效果，不把助手中断改成成功。缺失success/result配对或歧义成功结果属于完整性错误。

48项聚焦后台合同、189个断言通过，包括真实SQLite事务失败、原调用重试、并发恢复、已完成助手、项目隔离、fork、Task释放activation后结算，以及真实子进程在receipt完成、结果事务中途、Mission持有owner后退出三个边界。权限、capability-search和生产错误收敛合同一并通过。typecheck、生成SDK和当前私有UI构建通过。完整成功及工具链失败日志见 [证据目录](../../artifacts/2026-10-05-connection-workspace-authority/source-result-commit-383/README.md)。

实际gpt-6.1-sol在当前开发服务/ui完成真实文件读取及document@1发布；Source和display各自绑定正确调用和Message。人工操作确认来源文件名/行号、文件高亮、文档工作区。7次流式请求均200/EOF；预声明20请求预算未耗尽。

本轮整体验收仍未通过：最后刷新重开未在固定Native时限内完成，launcher为OWNED_NATIVE_COMPLETION_INVALID/exit1，目标deadline_exceeded/exit1。保留完整失败事实，不续额。所有owned进程、输出、请求、端口和auth/models副本已收敛；本轮tab3关闭。实际正常Provider页面与独立OS恢复测试不能合并声称真实Provider崩溃恢复已通过。

交付限制：触发器变更使旧schema按当前准入返回SCHEMA_RESET_REQUIRED；没有自动迁移、重置用户数据库、重启用户服务或发布版本。同一Message不同permission continuation的并行收尾、历史不完整结果及刷新重开仍需继续验证，未包装为全部问题解决。

自动审批拒绝删除初次测试工具链故障留下的空runner目录，仅返回“blocked by policy”；目录保留且未换机制重试。该限制不影响已验证的产品Native和凭据副本清理。
