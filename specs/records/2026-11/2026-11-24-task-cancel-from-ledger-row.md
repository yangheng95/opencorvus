# 从侧栏取消较早任务时沿用其项目目录

## Recall

用户要求本人独立持续迭代，先分析、落盘并以实际证据限定修复，随后真实桌面操作、人工截图、聚焦正向检查、范围提交、拉取合并上游并正常推送。前批 `90a9a8c98` 已推送，上下游一致。本批使用隔离开发服务和两个测试项目，较早的 Task 预置了原执行轮次、未启动物理执行。当期不需要模型请求。

已读[侧栏改名和任务项目归属](2026-11-24-task-rename-from-ledger-row.md)、[工具面板](../../current/architecture/07-panel.md)、[任务调度及取消](../../current/architecture/task-control-plane.md)、[任务归档与恢复](2026-11-12-archive-restore-receipt.md)。全仓检索 `cancelWorkLedgerTask`、`cancelTask`、`interruptTask`、`requestTaskCancellation`、`taskOwningDirectory`、`activeTaskID`、`TaskCancellationRequestBody`、公开 `task.cancel`、后端接受与取消恢复状态及现有相关测试。

## 基线、根因和影响

- `41920/ui/` 使用 `main-B3KS1YfM.js`。最近任务页包含 11 条较新的 `branch-review` 记录，界面采用前 10 条。侧栏的工作记录完整显示另一项目 `control-review` 的较早 Task `tsk_g00VbtfgG700Vcs3G0Qw`。焦点未选择该任务时，从其已显示的菜单按 Enter 打开 Stop this Task，实际确认 Stop work。随后出现 Couldn't confirm the action，原诊断 `has no owning project directory`。[基线截图](../../artifacts/2026-11-24-task-cancel-from-ledger-row/README.md)
- 服务日志未收到这次取消写入，真实精确读取仍为 `active`、`inactive`、`none`（生命周期未结束、没有当前运行活动、没有待处理取消）。该任务持久事实只有原执行起点及专家团配置绑定，表明异常发生在发出请求之前。无证据表明底层执行、项目隔离或终态收敛失败。
- 侧栏确认捕获原 Task 行，`cancelWorkLedgerTask` 传给 `cancelTask` 的只有 ID。后者依赖最近任务页、已选任务或已读取 Board 内的同 ID 目录。在本场景这些投影都没有该较早任务，即使原侧栏行已经有真实的完整目录。已有目录必填校验和精确服务路由保持正确，旧改名和归档的修复只覆盖各自入口。

## 共享机制核对

- Task 的普通侧栏、最近与多步任务子行由同一工作记录行触发。当前已选 Task 的输入栏也进 `cancelTask`，可以按原选中对象定位。正在发送的任务消息停止把其已捕获的 Task、目录与连接直接交给 `requestTaskCancellation`。任务内独立对话停止、会话右栏和多步任务停止各走原目标及原生接口。未找到 `interruptTask` 的生产调用，它属于已有独立包装，本批不扩大为删除。
- 真实 Task 取消路由按指定项目进入 owner（所有者）与原 Task，持久化取消申请、结算物理活动和等待的交互，再落原轮次的终态；已经取消的同原身份返回持久投影，已完成或失败的任务返回明确冲突。任务控制面在运行时重试结算，重启通过已有恢复协调。多步任务以原执行身份关闭，才逐批协调其精确子任务和对话；会话的提示请求有自己的原始所有者。当前故障未进入这些路径，无需改调度、队列、唤醒、重试、恢复、原轮次、并发或多项目隔离。验收同时核对另一项目原终态、取消后重启与既有收敛正向测试。

## 实施前方案与验收

- 当前 Task 停止服务接收现有 Task 记录目标结构，侧栏传入原行的身份、目录及连接。已经选中的 Task 输入栏沿现有目标所有权取目录。正在发送的请求与其它类型继续使用自己的真实目标。沿现有 `requestTaskCancellation` 及持久响应，现有 Board 读与错误语义继续可用。
- 候选桌面以相同较早任务和不同当前项目执行实际停止，确认后核对 202、真实取消终态、原项目和原轮次。再次启动同一隔离数据读回持久结果，并核对其它项目原来的完成任务、无模型执行。复核截图、聚焦跨项目请求和现有取消与恢复契约，完成正常提交、合并上游及推送。

## 候选验收

- 候选 `main-DQxsyhUm.js` 使用同一隔离数据。实际在 `branch-review` 的启动器输入未发送草稿，从 `control-review` 的较早任务菜单键盘进入确认后点击 Stop work。真实请求 `20e0d405-429c-4d08-b9e5-16c2bef1757b` 于 `13:33:13.083Z` 返回 202。任务在原项目侧栏和最近列表显示 Cancelled，焦点回到发起行，原工作区及未发送草稿保留。[候选桌面证据](../../artifacts/2026-11-24-task-cancel-from-ledger-row/README.md)
- 通过既有服务对原项目和任务再请求一次，`aa484990-e483-4508-80ea-7de29ca33f8a` 于 `13:33:41.795Z` 返回 202 和首次操作的请求及终态事件，保存的来源仍是原侧栏操作。正式读 `58c8882e-e753-4ec4-84fc-d65d62a44b46` 确认取消。同一数据关闭重启后，公开读 `a57e250a-dfe2-467d-999d-e3b50c57ff2a` 返回原目录、`cancelled`、`inactive`、`cancelled`。
- 持久数据库完整。原轮次 1 只有各一条执行打开、取消请求、取消终态，申请 `pev_g0Vbth7R300sk2C5NeeR` 与终态 `pev_g0Vbth7RJ006mZTiOY1X` 和重放读取一致。另一项目的 12 条任务均仍为 completed。消息和模型请求各 0。6 项客户端请求与目录测试、12 项服务取消收敛、权限恢复和归档身份测试均通过。类型、构建、公开渲染面、文档及架构索引通过。桌面覆盖历史任务的侧栏入口，当前输入栏沿原有目标定位。
