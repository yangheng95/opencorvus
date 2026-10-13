# 390 执行轮次身份与成员正文更新

[Recall与影响分析](../../artifacts/2026-10-05-connection-workspace-authority/execution-actor-identity-plan-390.md) · [证据](../../artifacts/2026-10-05-connection-workspace-authority/execution-actor-identity-390/README.md)

只用单agent开发。389已证明同一成员输入的消息owner=work、lifecycle actor=assistant，导致正文事件无法归并。本轮共用精确durable input身份读取，保留WorkerTurnDescriptor和Chat/Work固定约束，删除conversation读取的旧角色猜测。对删除用户消息使用真实事件原快照；不改UI匹配，不吞错误，不修改消息原文。

修前4项全部失败，修后最终执行身份/Task协议9项通过；另conversation projector7、Mission caller receipt7、Mission origin3项通过。扩展测试第一次有1项缺少完整view输入，改用真实生产投影后通过；原失败保留。重试、完成、取消、错误、重入回放、独立Project和helper owner有聚焦正向覆盖。没有新增/运行UI自动化。

真实开发服务/UI使用gpt-6.1-sol，7次流式请求包含预检和helper。未刷新页面中父进展和dock都显示最终正文；Source“方案甲.txt L2–3”打开文件并选中2—3行。规范数据库、HTTP conversation和SSE回放核对相同work身份及同一input。Native资源在306843ms完成，端口释放、复制auth/models成对清理，页面关闭。Provider传输完成与Message stop、Tool completed分别检查。

验证状态：前三次typecheck因同期配置类型改动失败，原日志保留；最终正常push的8工作区types、routes/docs、lease、architecture/package/release/module和secret检查全部通过，4341de9807675b2c6170c53beef1b3eb27ffdd6c已推送。完整push原日志随[391证据](../../artifacts/2026-10-05-connection-workspace-authority/activity-input-projection-391/README.md)归档，未绕过hook。

剩余：刷新后父进展额外显示一行英文交接输入，已保存03/05真实对照，下一轮追查实时/恢复投影差异。原Research Studio长历史未重放，本轮不能代表全部功能体验完成。误建空目录删除曾被自动审批以blocked by policy拒绝，保留原处，未绕过。
