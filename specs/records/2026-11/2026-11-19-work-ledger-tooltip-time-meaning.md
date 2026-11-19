# 侧栏时间提示区分创建和开始

## Recall

- 用户要求本人独立持续迭代。每批先真实调查、落盘根因与影响，再实施、本人桌面操作与逐图复核、聚焦正向检查、范围提交、获取并合并上游和正常推送。上一批远端 `4d69e204c`，上下游 0/0，原工作区 177 项状态逐行一致。此轮使用新建的本地专用项目、同一隔离应用数据目录和独立 Windows 浏览器。用正式接口创建草稿及空会话，无模型或凭据。
- 已阅读 `WorkLedger` 的工作行、已有时间提示、Project 与 Recents 投影、`LedgerRowMainButton`、`time.ts`、`work-ledger.css`、双语、正式工作记录、会话和草稿路由、传输类型、引擎 `projectTaskRowInTransaction` 及 07-panel。全仓查提示的 `data-ui`、`work_ledger.tooltip.started`、`tooltipStartedAt` 及工作记录 `created` / `started` 消费；三种工作行共享此提示。任务状态头使用自己的明确生命周期契约。未触及界面自动化测试。
- 验收在英文和简体中文验证三类真实行的绝对和相对时间、指针和键盘焦点、项目与最近两种呈现及原行可打开。以正式工作记录、会话和草稿的相同身份和时刻回读为依据。保持独立任务的原开始时间语义和相同呈现，变更只涉及通用侧栏时间提示。

## 基线与影响

- `40312/ui/` 提供 `main-CYCLy1Fu.js`。真实创建 `Invoice review draft`、空 `Warehouse planning chat` 和空 `Stock review work`，分别获得 200、201、201。任务列表仍是待规划，草稿零子任务，三条会话消息历史均 200 且为空。接口中的工作记录 `created` 和 `started` 分别与原会话的 `time.created` 完全相等。实际点击草稿后，侧栏英文显示 `Started`，同屏正文显示草稿可开始。用 Tab 和 Shift+Tab 逐行读取两个空会话，实际也显示 `Started`。 [实页与接口回执](../../artifacts/2026-11-19-work-ledger-tooltip-time-meaning/README.md)
- `workLedgerMissionFromSession` 给 `started` 投影 `MissionRecord.created`，`workLedgerChatFromSession` 给 `started` 投影 `Session.time.created`。`WorkLedgerRowView` 统一消费 `row.started` 并给绝对时间加 `Started` /「开始时间」。直读的时间准确，语义来自一个通用英文/中文标签，原路径在展示中没有区分行来源。使用其公开 `created` 能正确表示多步任务与两种对话的创建时刻。Task（任务）含顶层及 Mission（多步任务）子任务，其 `started` 从任务领域生命周期打开时刻产生，维持现有「开始时间」与详情契约。
- 影响限同一工作行摘要在项目、置顶、单列表、最近和嵌套任务的呈现。时间标签和绝对、相对文本必须前后一致，中文长度变化不得挤出日期，打开真实身份和鼠标/键盘提示沿原逻辑。对话重名编号的创建排序、执行状态头、正式接口类型、持久数据及 Task/Mission/Session（会话）的执行轮次不涉及。无派发，未发现实际调度、队列、唤醒、恢复、并发或终态异常。

## 实施与验收

- 同一摘要按行类型取对应事实。多步任务及 Chat/Work 直接使用原 `created` 与 `Created` /「创建时间」，Task 用已有 `started` 与原本地化标签。绝对和相对时间都消费同一个事实，复用日期工具及原提示结构。将仅形容提示本身的样式和标记改为通用时间名称。无新接口、别名、数据写入或提示组件。
- 顺序关闭基线并启动候选，沿用同一份隔离数据。英文在点击草稿时截图对照原请求和创建提示，再通过键盘逐一进入最近 Chat、Work 或草稿。中文复核创建标签、日期格式和原始标题。正式接口读回核对与基线相同的三个身份、时刻和草稿；不触发模型或 Task 启动。对独立 Task 和嵌套 Task 的原渲染契约以现有类型、代码审查及聚焦的任务时间和工作记录数据检查辅助；当前隔离项目没有真实 Task，不能宣称桌面实测该分支。正常构建、双语、样式、文档与架构检查后范围提交和推送。
