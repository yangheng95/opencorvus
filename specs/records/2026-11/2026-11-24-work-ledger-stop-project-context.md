# 停止确认显示工作所属的完整项目目录

## Recall

用户要求本人独立持续分批体验、调查、先分析并落盘，再实施有依据的改进，进行真实桌面操作、截图人工复核、聚焦检查、范围提交以及正常合并和推送。上一批 `5688e51eb` 已推送，上下游一致。当前批的两条同名 Task（独立任务）及两个同名项目均为隔离测试数据。

已读[工作台归档精确项目目录](2026-11-10-archive-actions-exact-project-directory.md)、[侧栏取消任务的项目归属](2026-11-24-task-cancel-from-ledger-row.md)与[面板架构](../../current/architecture/07-panel.md)。全仓查 `confirmAndStopCurrentRow`、`stopKindLabel`、`work_ledger.stop_confirm`、`coding_assistant.background_stop_confirm`、`projectDisplayName`、`projectLedgerDisplayName`、`workLedgerProject`、当前 Task/Mission/Chat/Work（独立任务、多步任务、对话和工作对话）的停止入口和共用弹窗。

## 基线、根因和影响

- `41928/ui/` 使用 `main-CONsyCAq.js`。工作台真实侧栏区分了 `Workspace · alpha` 和 `Workspace · beta`，两组均有 `Shared waiting task 582`。公开读取的身份分别为 `tsk_g00Vbtkz8m00hXLx3hGZ` 与 `tsk_g00VbtkyJy00dCd3EeOu`，真实完整目录分别以 `alpha/Workspace`、`beta/Workspace` 结尾。两条生命周期均为 `active`，无正在运行的进程。
- 从两条工作行分别按键盘进入停止确认，均显示相同的 Stop this Task、同一任务标题和 Stop work。确认窗遮暗了侧栏的项目上下文，两次内容无法从弹窗区分。实际均选择 Cancel，两个原任务状态均保持不变。[基线截图](../../artifacts/2026-11-24-work-ledger-stop-project-context/README.md)
- `confirmAndStopCurrentRow` 持有原行和目录，原归属校验、焦点归还及写入正确。弹窗正文仅插入原任务标题，普通与后台活动两个说明都没有显示当前持有的项目目录。原跨项目路由修复验证了点确认后的准确写入，但未处理确认前的区别。本轮只补当前共享侧栏确认的项目线索，任务、对话、多步任务及后台活动的停止语义仍由原路径控制。没有调度、执行轮次、队列与重启异常，接口、数据、配置、模型和发布无需变动。

## 实施前方案及验收

- 在现有停止说明下呈现原行所属项目的现显示名称和完整项目目录。复用同一工作记录的项目名称读取与通用名称逻辑，目录直接取确认所操作的行。保留原确认、原焦点目标、后台活动说明及按钮译文。
- 用同一套数据实页核对两个同名目标的确认。在英文用键盘分别打开、取消并核对焦点。切中文后从 beta 确认真正停止隔离任务，核对 alpha 的原身份和未结束状态、beta 的取消结果及原项目工作台。复核截图和真实读写、语言、类型、构建及文档。界面文案变化使用实页检查。

## 候选验收

- `main-B6BhXiJm.js` 使用原两个隔离项目。英文以键盘分别打开两个确认，准确显示相同的任务标题及各自项目的显示名和完整目录。Cancel 后焦点回各自发起行。简体中文从 beta 的行打开确认，完整目录和原项目名可见，真实点击「确认停止」。[桌面截图](../../artifacts/2026-11-24-work-ledger-stop-project-context/README.md)
- 原 beta 任务取消请求 `f74de43e-3aa1-413b-b7c3-3309a6acaa57` 于 `13:53:16.440Z` 返回 202。桌面 beta 行显示「已取消」且焦点在该行，当前工作区仍为 alpha。真实精确读取 `ed500631-30ce-47d5-bda9-481be9ddad18` 和 `f62d5ef5-2e4b-4259-b202-c639b05a5ec8` 确认原 alpha 仍为 `active`（未结束）、原 beta 为 `cancelled`。
- 隔离数据库完整，只存在 beta 的第 1 轮取消终态，两个原任务及对话保留，消息和模型请求为 0。任务取消项目目录与同名项目身份的两项聚焦检查通过。两种语言、类型、正规构建、公开渲染面、文档和架构索引检查通过。本轮实页覆盖独立任务，其他工作类型沿用同一个停止确认实现。
