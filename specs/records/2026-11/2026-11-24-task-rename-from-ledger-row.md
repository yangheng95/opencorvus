# 从工作侧栏改名独立任务并保留当前工作

## Recall

用户要求本人独立持续调查和改进，先落盘根因、影响及方案，再实施、真实桌面交互和截图人工复核、聚焦正向测试、提交、合并上游并正常推送。起点 `7852dce00` 已推送，上下游一致。实际服务和两个测试项目私有，已完成的任务只由隔离历史夹具建立，未运行模型。

已读[已有侧栏改名调查](2026-11-10-sidebar-rename-actions.md)、[面板架构](../../current/architecture/07-panel.md)、[工作记录选择失效](2026-11-12-work-ledger-selection-invalidation.md)与[归档任务操作归属](2026-11-24-archived-task-delete-project-owner.md)。全仓搜索 `renameWorkLedgerTask`、`renameTask`、`taskOwningDirectory`、`workLedgerRenameLabel`、`renameCurrentRow`、`WorkLedgerRenamePresentation`、`taskScopedPath`、`loadTasks`、`loadWorkLedger`、任务标题路由和现有验证。早期改名只验收了会话和多步任务草稿，明确保留独立任务待后续调查。

## 基线、根因和影响

- 当前真实 `41916/ui/` 保持 `branch-review`，侧栏可见 `control-review` 中的 Older independent task 579。任务的更多菜单有项目下载、置顶和归档。双击同一行会先选择该任务，再打开既有改名弹窗。取消弹窗后，中央仍停留在该任务。[桌面前态](../../artifacts/2026-11-24-task-rename-from-ledger-row/README.md)
- 真实 `GET /global/tasks?limit=11` 返回 11 条较新的任务，界面当前 Board 采用前 10 条；独立的 `GET /work-ledger?search=Older%20independent%20task%20579` 返回 `tsk_g00Vbtd6iL00QnQ2Y4Lq` 的真实目录、原请求和 `completed`。复用真实前端服务及连接读入最近任务再请求改名时，原行不在局部 Board、也未选择，`taskOwningDirectory` 报 `has no owning project directory`。请求失败在客户端路由准备阶段，服务未收到标题写入。
- `WorkLedgerRowView` 在更多菜单中排除了 Task，且现双击处理先通过主按钮改变当前选择。其已知行包含精确任务和项目目录，传入 `renameWorkLedgerTask` 时目录被省略，`renameTask` 重新从另一份分页列表或选中对象推导目录。前批侧栏改名仅解开了会话及多步任务的入口与焦点问题。标题持久写和原始任务身份在现公开路由已具备，无法解决未选择历史行的客户端路径和入口。
- 涉及工作记录任务行实际动作及对话标题的同一个改名服务，子任务和单列表共享工作记录行。保留现有连接、选择和危险操作规则。只使用原身份写任务标题，不运行任务，也不改任务、会话及多步任务执行轮次、调度、队列、模型请求、数据库或发布。

## 实施前方案和验收

- 在原菜单使用同一改名动作和已有本地化名称；在 Task 上复用会话和多步任务的弹窗归属及发起行焦点。双击与已选标题继续可用。
- 将所操作行的 Task 标识、目录和连接交给标题服务，沿现有 `taskScopedPath` 直接生成明确项目的标题路由。继续用现服务写入与写后刷新，无需开始选择目标，也无需放大最近任务的分页。
- 在真实实例从另一项目保留一份工作台草稿，通过侧栏键盘菜单改名较早且不在最近任务页的完成任务。核对对话或启动器、选中目录、草稿、保存后的焦点、原任务及对照项目数据。验证当前语言与真实接口、聚焦客户端服务、构建和文档。

## 候选验收

- 候选 `main-B3KS1YfM.js` 使用相同隔离数据。先选择 `branch-review` 并输入未发送草稿，再从 `control-review` 的较早任务行以键盘进入更多操作，打开改名。对话框使用原任务标题和输入焦点，中央仍是原工作区和草稿。[展现与键盘验证](../../artifacts/2026-11-24-task-rename-from-ledger-row/README.md)
- 通过 Enter 真正保存 Older task renamed 579，`82a7f488-0375-4115-b40e-c01eab7d4979` 于 `13:24:41.773Z` 返回 200。从打开任务菜单到保存，原工作区和未发送草稿保留。保存后焦点回到显示新标题的 `control-review` 原行。切换简体中文，从同一行打开「重命名此任务。」，输入临时标题并按 Escape，焦点回原行，已保存标题和草稿保留。
- 正式精确读取 `c0a32af0-84d8-483a-949a-843d64d62684` 返回原身份、原目录、创建时间、原请求及 `completed`。数据库核对原工作区的 12 个对照任务标题，完整性通过。隔离数据有 13 个任务和原对话，消息及模型请求为 0。16 项改名、项目路径和归档服务测试通过，类型、构建、双语、公开渲染面、文档与架构索引通过。实页覆盖独立任务，任务子行复用同一实现。
