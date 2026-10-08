# 203 原153历史的控制、消息与记忆前沿

## Recall

用户最新要求单 agent，当前团队只有 root。遵照[203方案](../child-history-startup-frontiers-plan-203.md)，真实原库继续只读；不启动副本或模型，原153消息、Task 和进程记录完整保留。202数据连接与隔离工具错误已修正并保留，不能用工具失败代替数据验收。

`guard.json` 在2026-10-08T19:35:28Z重新观察原 Host/Target 的创建身份死亡、18098无监听、auth/models成对不存在。`result.json` 在同一 readonly（只读）事务读取全部控制目标的生产当前租约胜出项、生产不可变输入处置以及安全关系事实。`exit.json` 记录这次实际执行退出0。

实际观察：

- 1016当前租约胜出项覆盖 bus_delivery、dispatch_admission、effect、lifecycle、runtime_process、task_root_ingress；除历史进程身份外，其余均在观察时已过期。两个容量槽位均已过期。
- 唯一 SessionControl wake_reason 有 consumed 终态。三个根输入的生产处置依次为 resolved、resolved、terminal_inapplicable，并保留具体决策/终态证据身份。
- 八次权限执行 start 各有匹配 outcome_slot 终态和执行结果，两个 Git checkpoint 请求均有对应结果。
- 全库15条 assistant 消息均有 completed 时间。三个真实 source-url part 都属于 explore 会话 `ses_hMlVNrRdOLxQf4XhSds7`，分布于前三条工具回合回复；该数据没有 snippet（摘要），适合后续无摘要 Sources 视觉检查，不代表长摘要场景。
- 两项目记忆文档均为 version1/revision1/idle，无 pending user_message 文件或组织租约。已读取的调度、事件、协议 inbox、prompt owner、等待、交互、构建清理和项目维护等表为空；仅作为关系事实，不替代配置与消费语义审计。

唯一 `runtime_process` 的 expires_at=Number.MAX_SAFE_INTEGER 是 `process-liveness.ts` 明确使用的持久化身份表示，不是活跃工作期限。`runtime-process-os.json` 验证原 PID63112/创建身份 `win32:639270464606887343` 实际 dead_or_reused，已按当前操作系统观察语义排除本条记录活跃。没有删除它或假造过期。

`source-executed.ts.txt` 保存实际执行源；执行后仅将私有当前脚本控制台输出压缩为计数，未重跑或改写原结果。完整结果含安全身份，排除凭据、消息/工具正文、记忆内容。

此轮仍未满足：原父工具退出档案的独立文件绑定、所有项目文件配置/生产恢复消费条件、复制身份一致性、唯一原生绝对截止传递，以及真正子侧栏截图/交互。174启动资格保持待满足。当前 UI（User Interface，用户界面）源码17cc7cfb未改，连续 goal（目标）保持 active（进行中）；下一轮继续准备实际子侧栏复现，不把这次数据调查计作视觉通过。
