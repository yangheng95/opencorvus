# 独立任务归档前说明取消执行

## Recall

- 用户要求持续迭代，逐批先调查、落盘、真实桌面交互及截图人工复核，聚焦当前契约，提交后合并上游及正常推送。由当前操作者独立完成。本批验收同一独立 Task 在活动轮次及已取消状态下的侧栏和标题菜单，两种界面语言，归档/恢复后原请求和终态。
- 已读 `AGENTS.md`、`07-panel.md` 的 Archive queries（归档查询）、[主动归档回执](2026-11-12-active-archive-receipt.md)和[工作类型本地化](2026-11-06-work-kind-language.md)。全仓追踪 `task.archive_button_title`、`workLedgerArchiveLabel`、活动行 `archiveLabel`、`taskCanStop`、`workLedgerPresentationStatus`、Task 与 Mission 子 Task 投影、标题/侧栏菜单、`setTaskArchived`、`EngineService.setTaskArchived`、项目范围、正常/终态与旧测试。该范围只改界面措辞，不新增或运行界面自动化测试。

## 根因与影响

1. 前批中文桌面中，同一隔离独立 Task 在归档前仍有打开的执行轮次，工作台精确投影 `lifecycleStatus=active` 且实际活动 `inactive`。其侧栏菜单提供「取消此运行中的任务（需要确认）」及「归档此任务」。点击归档后服务真实地保留原身份与请求并取消原轮次，随后恢复也保持 `cancelled`。这个 Task 再回活动列表，侧栏和标题菜单仍只显示「归档此任务」。相同文案掩盖归档对尚未结束 Task 的附带行为。[实际前后菜单及服务证据](../../artifacts/2026-11-12-task-archive-cancellation-label/README.md)
2. 两处菜单复制同一个静态类型到文字映射。已有停止资格依据 `lifecycleStatus`，而常用界面运行状态依赖 `activityStatus`，后者表达当前是否有运行活动，不能说明一个未终结、等待中的轮次是否需要取消。前批回执确认修复发生在提交后，无法在动作发起前说明该影响。
3. 产品接口使用原项目/Task 标识精确定位。原服务对未终结 Task 调用取消并完成根会话物理结算和 Goal（持续目标）暂停后归档，已终结 Task 只走既有保留流程。前批真实归档及恢复和两组服务测试核对了 Task、Mission、Chat/Work 的终态和原 owner（所有者）。Mission 的执行关闭与右栏会话的 Prompt（提示请求）结算使用各自契约。本次证据针对 Task 的取消；其他工作类型的文案语义沿用当前契约。没有新发现的调度或并发异常。
4. 影响限独立 Task 和通过同一工作台组件渲染的 Mission 子 Task 菜单，包括 Project（项目）、最近、标题等共享入口。菜单标签走现有本地化和可访问名称。公共接口、归档确认、原执行状态、输入、权限、数据库、调度和交付无改动。

## 实施与验收

- 将两处现有类型文字映射合为一个 `workLedgerArchiveLabel`。用独立停止动作已经采用的 `lifecycleStatus === "active"` 区分 Task，尚未结束显示「取消并归档任务」及 “Cancel and archive task”，已终结显示「归档任务」及 “Archive task”。不增加流程分支、确认弹窗或后端请求。
- 在隔离开发服务准备一条尚未终结、无当前运行活动的 Task，附带真实不可变内置专家团绑定。打开真实英文和中文侧栏、标题菜单，完成归档和设置恢复，再看同一 Task 的终态菜单。用正式工作台精确读、任务接口、SQLite（嵌入式数据库）核对项目身份、原请求和终态。前态准备不涉及真实 Provider（模型服务商），本轮无需模型执行。
- 检查 Overlay 类型、本地化、构建、渲染公开面、文档和架构索引。候选截图由当前操作者逐张查看。
