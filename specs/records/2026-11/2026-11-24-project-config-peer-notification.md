# 项目配置保存后更新同项目的其它标签页

## Recall

用户要求本人独立持续分批迭代，先复现并落盘根因和影响，再实施、真实桌面与人工截图、聚焦正向检查、范围提交、合并上游和正常推送。上一批 `1530e6a13` 已推送，上下游 0/0，工作区原有 177 项状态逐行保留。本批检查两个在线标签页的服务器项目配置，使用本批专有项目、进程和纯本机测试数据。只在隔离项目中从预设 Full access 收紧为 Ask me，未提交对话或调用模型。

已读[同目录重新选择时读取配置](2026-11-24-project-mode-read-on-reselect.md)、[项目配置架构](../../current/architecture/05-config.md)、[面板实时投影](../../current/architecture/07-panel-reactivity.md)和[项目范围视图](../../current/architecture/07-panel.md)。全仓查 `Config.Event.ProjectChanged`、`Config.updateProjectPatch`、`project.config.changed`、`config.changed`、`subscribeWorkLedgerChanges`、`workLedgerGlobalBusProjectEvent`、`loadConfigInfo`、`beginConfigSnapshotRead`、`currentConfigCommitRevision`、`appStore.config`、`currentPermissionMode`、各公开事件连接与项目配置测试。

## 基线、根因和影响

- `41860/ui/` 运行 `main-COr7kqoq.js`，专用进程 `35280`。两个窗口标签页已在 `branch-review`，第三页在 `control-review`。三个标签起初均显示预设 Full access。写入页经输入栏真实选择 Ask me。`PATCH /config` 请求 `704928ed-0ea1-4bb1-a111-d278b4b4506f` 在 `12:16:48.294Z` 返回 200，写入页的单选状态及输入栏随即显示 Ask me。磁盘与直接公开读取都确认 `branch-review` 是 `ask`，`control-review` 仍为 `full_access`。同项目的另一在线页继续显示 Full access，完整重开文档后配置读取 `a1a6d52e-5a18-4a35-a9ab-e49667921134` 200 才恢复 Ask me。[基线截图](../../artifacts/2026-11-24-project-config-peer-notification/README.md)
- 真实 `/global/event` 连接 `53084510-7686-4e3e-9dcc-fa50cede67f8` 在 `12:16:48.293Z` 收到现有 `project.config.changed`，目录为 `branch-review`。同一观察中，并行连接的 `/work-ledger/events` `3e3e69a1-c19b-4687-b4b0-2631bd019501` 已正常连通，未收到这一变更。界面这些在线空项目页实际只接收工作记录实时通知。公开事件的源生产者已经结清实际配置后广播，工作记录路由没有这个投影，界面也没有接续等范围的配置读取。写入页通过自己的 `PATCH` 回执已更新，不能替其它页更新各自接受的 `appStore.config`。现有 Session（会话）`config.changed` 只拥有精确会话配置，与项目配置不同。
- 影响是当前项目设置与依赖这份投影的输入控件及频道目录看到已提交状态的时机。保存的权限策略和真正的项目范围正确，是在线界面的陈旧投影。已有配置提供同一后端真实回执，频道与插件等运行态结算维持现有所有者，未见执行、调度、队列、唤醒、重启或终态异常。新的通知只携带项目目录、原事件类型和现有实时序列字段，配置正文继续走有正式权限范围的公开读取。另一项目、全局未选项目、会话模型和本地草稿不会接收这个项目快照。应用断线后的标准配置读取、项目切换和管理页面保持原链路。

## 实施前方案和验收

- 工作记录事件路由只把现有 `Config.Event.ProjectChanged` 投影为该项目已有 `work-ledger.changed` 事件形状。配置细节以及展开后的值不会写进这条提示。面板只在当前项目目录与事件可规范等价时，通过已有 `loadConfigInfo` 核对当前已授权项目。沿用同一项目/连接/选择轮次和读取代次的约束，已有写入回执与 `currentConfigCommitRevision` 继续处理并发读写。在其他目录接到提示时各自维持现有配置，无新增实体、连接或数据副本。
- 用真实公开配置保存、工作记录流、公开读和磁盘证明确切项目通知与真实的新配置。桌面复刻写入页、已经打开的同项目观察页和另一对照项目，实际收紧到 Ask me，确认两页自动显示 Ask me、另一项目仍显示自己的设置，并截图人工复核。以现有配置读写归属测试和真实事件投影测试检查相关契约，走现有正常合并与推送。
