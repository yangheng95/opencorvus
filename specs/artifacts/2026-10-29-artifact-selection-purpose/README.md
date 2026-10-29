# Artifact 来源与恢复轮次证据

本批计划和完整边界见[调查记录](../../records/2026-10/2026-10-29-artifact-selection-purpose.md)。只由一个 agent 工作，没有新增交付分支或工作树。

- [真实任务与独立测试](actual-task.json)：同一 Task/Tester 的续跑、原失败及第二轮 completed 事件、真实 Python 输出、来源声明和 Mission 的原始失败工具事实。独立审阅与 Task 完成已达成，Mission 正常关闭未达成。13次来源声明仍发生，不能宣称调用成本降低。
- [正式检查与原输出](checks.json)：9项引用/发布合同、1项持久生命周期合同、双项目两轮与重建后的正向回归；保留 red-baseline、原库 reader 的真实失败和 green 重跑。日志以完整 UTF-8 字符串存入 JSON，未改写原内容。
- [真实完成数据读取](real-reader.json)：正式 collectTaskRunEvidence 已接收原 completed 轮次和原私有 Git 结果；Mission delivery audit.passed=true。它证明证据可读及物理投递结算，不证明 Mission 已业务完成。
- [数据和操作者 Git 原件](data-review.json)：来源92表161325行原件、新库172843行/schema9、全部原行身份保留；整个 index、HEAD和7文件原件，以及51份附件的来源/副本一致。
- [真实范围结算](retirement.json)：40次精确 Sol 流式请求，累计970，固定上限耗尽；public shutdown200、原exec/native/launcher0、物理/输出/请求结清及成对凭据副本清退。没有再次开启同范围额度。

六张实页均实际查看，UI源码未改，页面由项目开发 serve 的普通前端产物呈现：

1. [真实模型预检](01-preflight.png)。
2. [原失败与待续跑入口](02-original-failed-task.png)。
3. [原独立 Tester 侧栏](03-independent-review.png)。
4. [Task 已完成](04-task-completed.png)。
5. [滚动到底后的交付正文与完成工具](05-task-bottom.png)。
6. [Mission 未收口](06-mission-unsettled.png)：活跃状态观察后，Task 并发完成导致消息权限校验拒绝；后续恢复被本范围验收请求上限截断。截图中的提示框是当时真实 hover 状态。

首次数据复核 helper 把 SQLite 的 null-prototype 行对象与 JSON 对象作 strict deepEqual，导致比较器本身失败；精确停止自有 helper 后以完整行 JSON 值比较重跑通过，没有修改数据或放宽产品完整性验证。另一次关闭命令误用 Windows PowerShell5，已改用当前 PowerShell7.6.5 正常公开关闭，未绕过进程身份校验。
