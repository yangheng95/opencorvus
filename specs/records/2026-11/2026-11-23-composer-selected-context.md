# 已选会话工具栏显示当前对象类型

## Recall

用户要求本人独立持续分批迭代。每批先落盘根因与影响，再实施、真实桌面交互与人工截图复核、聚焦正向验证、范围提交、合并上游与正常推送。第 371 批远端为 `61b6a8747`，上下游 0/0，保留 177 条原有工作区状态。只操作本人隔离服务、测试项目和页面。本轮复查未执行模型、未使用凭据。

已追踪 `openMissionSession`、`openWorkLedgerMission`、独立任务与 Chat/Work 的选择入口、跨项目 `applyDirectory`、`BoardSource`、`selectionRequest` 及其精确接受／保留结果、`ChatComposer` 唯一挂载与工具栏，及 `ComposerReferenceSelector` 的可见、辅助名称、只读引用。全仓查 `activeComposerIntent`、`activeWorkItemKind`、`toolbarContextLabel`、`productPillarFromConversationExperience`、`conversationSourceExperience` 及两种语言原标签。参考 [会话等待](2026-11-23-conversation-opening-status.md)、[选中读恢复](2026-11-12-work-ledger-selection-reading-recovery.md) 和架构 07-panel。未发现触及范围内的界面自动化测试。

验收覆盖真实英文与简体中文项目切换，暂缓规范读取的真实 200，在等待阶段展示确切目标类型，正式接受后显示原编程／通用分类和同一请求。反向打开普通 Work（通用工作对话）、真正新建时原有模式、已选引用的只读入口保持可辨。检查接受结果、暂态读取分阶段的真实输入和回执。另跑现有精确选中读取和提交意图正向检查、类型、双语、构建、文档与架构索引。

## 修改前证据与影响

第 371 批打开归档多步任务时，上方已正确显示 `Mission`，工具栏短暂仍为 `Work · Chat`。本轮在新的真实服务 `40396` 上，通过只转发的 `40400/ui/` 打开独立的南区 `South work conversation`，再从项目中选择北区 `North code review`。转发保留北区 `/path` 的真实 200，界面在线、上方 `Mission`、输入提示 `Loading conversation`，工具栏仍为上一条 `Work · Chat`。放行同一响应后显示原请求和 `Code · Mission`。中文重复得到「多步任务」和「正在加载对话」配旧「通用 · 对话」，随后是「编程 · 多步任务」。反向从北区编程多步任务切到通用 Work 时，真实南区 `/path` 待转发期间已显示正确的 `Work · Chat`。两条正式选中读的项目、身份与种类均得到 200 并核对原记录。 [原始截图和读取回执](../../artifacts/2026-11-23-composer-selected-context/README.md)

`ChatComposer` 当前把 `activeComposerIntent` 缺值视为可以读 `composerIntent`，又只从接受的精确行读取 `activeWorkItemKind`。在多步任务切换中，`openMissionSession` 先发布已选来源，从跨目录读取返回后才同步输入模式，随后才得到该次精确的行。这个窗口里已选来源已确定种类，旧模式状态仍属于上一个入口。普通对话选择在发布来源前已设置自己的意图，所以逆向实测未出现同样的误标。单任务选择入口可提前从已加载列表恢复分类，读取期间 `activeWorkItemKind` 仍缺值，工具栏拾取的启动模式只含 Chat/Mission 概念，不能据此判断为 Task（任务）。前轮修复使用来源标明正确标题和等待，同时没有改变独立的工具栏上下文读取。影响限工具栏的已选对象可见和辅助标签；标题、输入忙态、模式偏好、只读引用目录、打开及提交路径、数据存储和接口不需要变更。

真实请求按现有选择所有权和项目读取完成，消息未发送。此次观察为当前选择的展示，未发现 Task（任务）、Mission（多步任务）或 Session（会话）执行轮次的调度、队列、唤醒、重启恢复、并发或终态异常。不在此轮直接证实单任务暂态，只按相同来源分析其呈现。

## 方案

已有选中对象时，工具栏优先展示当前身份精确读或同一身份允许保留读的类型与分类。精确记录未到时，从已发布的来源展示 Mission/Task 类型；已知 Chat/Work 体验时继续显示对应既有分类与 Chat 类型。当前来源不提供有依据的分类时暂不呈现分类。无选中对象的新建继续用该项目现有启动意图，同一工具栏、翻译、动作和焦点保持。只读任务包继续由已接受的当前 Task 决定。去掉工具栏选中标签对上一启动模式的取值路径，不改导航时序、状态所有权、读取、提交或持久偏好。更新架构的输入区呈现合同。
