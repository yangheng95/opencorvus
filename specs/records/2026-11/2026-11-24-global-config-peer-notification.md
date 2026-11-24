# 全局输入栏同步已保存的默认配置

## Recall

用户要求本人独立持续分批迭代，先复现、分析根因与影响并写入规格，再实施、真实桌面交互和截图人工复核、聚焦正向检查、范围提交、合并上游并正常推送。上一批 `739ac3e50` 已推送，上下游 0/0，原有 177 条工作区状态保留。本批检查未选项目的全局输入栏和已加入项目的显式配置。只操作自身隔离服务与测试项目，未用真实账户、凭据或模型。

已读[项目配置跨标签同步](2026-11-24-project-config-peer-notification.md)、[项目配置重连补读](2026-11-24-project-config-after-stream-rejoin.md)、[配置架构](../../current/architecture/05-config.md)与[界面实时投影](../../current/architecture/07-panel-reactivity.md)。全仓查 `global.disposed`、`publishGlobalConfigSettlement`、`commitGlobalConfigMutation`、`global.config.update`、`reconcileGlobalProjectTransitions`、`Config.Event.ProjectChanged`、`openGlobalChatLauncher`、`loadConfigInfo`、`work-ledger.connected` 及全局配置的写入、归属和恢复测试。

## 基线、根因和影响

- `41884/ui/` 使用 `main-sNkT02-b.js`，专用进程 `20636`。两个页点击实际 New chat 后都处于未选项目的全局输入栏，起初显示 Full access。第三页打开有显式 `full_access` 的 `control-review`。第一全局页实际保存 Ask me，`PATCH /global/config` 的 `d117994f-a179-4084-a6e1-8a5ba4374933` 于 `12:40:37.348Z` 返回 200，操作者页立即显示 Ask me。另一全局页仍显示 Full access，通过 New chat 重新进入同一全局入口后才由 `cc4d2227-0308-4a40-bea6-dc6f1612f82a` 的正式读取显示 Ask me。显式配置的项目始终显示自己的 Full access。[桌面基线](../../artifacts/2026-11-24-global-config-peer-notification/README.md)
- 真实 `/global/event` 于 `12:40:37.348Z` 收到 `global.disposed`，目录信封标记为 `global`。并行真实 `/work-ledger/events` 已成功连接，本次没有这一提示。后端的全局更新统一在 `Config.publishGlobalConfigSettlement` 发布现有事件。原项目投影路线已经转发由每个项目各自配置调和发布的 `project.config.changed`，该事件只会刷新对应目录。全局未选项目的读者没有收到全局投影的失效通知，通常只能由其自己重新进入入口或换连接触发读取。既有写入回执说明全局值已保存，配置合并和项目显式覆盖实际正确。
- 全局提交会用当前配置候选做已注册、已加载项目的规范合并、验证与运行态调和，记录全局及各项目各自的真实回执。此次只修工作记录流的界面投影入口，不改写入、锁、候选、进程恢复或任务调度；没有运行任务或发起模型请求。`global.disposed` 也用于规范的全局释放，当前无项目读取仍是只读配置复核。项目继续由自己的有效配置事件和读取负责；不会把全局正文当项目配置，也不新增项目的信号或数据来源。

## 实施前方案和验收

- 把已有 `global.disposed` 投影到同一个工作记录流，事件只含原来源身份与实时序列字段。只有未选项目的当前界面在此事件下使用同一个 `loadConfigInfo` 读取 `/global/config`，当前项目仍由原目录对应的事件和有效配置读取负责。流重连时，对持有已接受配置的当前范围仍走同一个读者，补读全局范围漏掉的提示。继续验证连接、选择轮次和配置读写代次，不发全局配置正文，既有项目配置契约不变。
- 聚焦服务验收走真实公开全局保存、实际工作记录事件以及当前全局配置读取。桌面同一轮以两个已经进入全局入口的在线页、一个只断实时连接的全局页和已显式设置的项目作对照。实际收紧默认值，在线页立即读到新值，掉线页恢复后补读，项目保留其显式有效设置。核对项目和全局的真实文件与公开响应，复核截图，运行当前配置和连接正向测试后进行正常提交和推送。
