# 定时运行历史显示每条记录的项目

## Recall

- 用户要求本人独立持续按批并行调查与体验，根因和影响先落盘，随后实施、真实桌面交互与人工截图复核、正向检查和按需授权模型验收，范围提交、合并上游并正常推送。上批外部成员变化后刷新搜索的 `d06527c68` 已推送，上下游一致。
- 已读[定时详情和历史契约](../../current/architecture/07-panel.md)、[定时历史通知](2026-11-25-scheduled-run-updates-while-online.md)、[多项目规则](2026-11-24-scheduled-lifecycle-across-projects.md)、[项目名称提示](2026-11-01-scheduled-project-identity.md)和[任务控制面](../../current/architecture/task-control-plane.md)。全仓核对 `AutomationService.listRuns`、`listRunsForAutomation`、`AutomationRunView.targetProjectId`、`projectRunTargets`、`loadRuns`、`projectsByID`、`projectHints`、`targetLabel`、`openRunSession`、历史行样式和关联测试。此次触及路径未查到界面自动化测试。

## 实施前证据、根因与影响

- 隔离服务 `41801/ui/` 加载 `main-CCbrmk67.js`。为 `mission-list-review` 和 `control-review` 保存一条 2099 年才到期的项目规则 `atm_hbBD27XDLCIWgnAlPnym`。分别通过正式项目提供方目录确认唯一连接为回环的 `scheduled-target-review/streaming-checker`，两个项目均有该模型。手动运行 200 `0d215580-d86c-42b5-8ec7-89ebdbe19a01` 产生同一次 Fire `atm_hOkL44VNcCEEEfX57ANt` 的两份成功 Run。真实只读回执 `3bfeabae-4213-4e66-8cc0-d1b48eb5d1c5` 给两条独立项目与会话，时间均为 `1795559259271`，标题同为 `B620 Two-project handoff`。本机检查器记录两次目标模型的真实流式请求。未来 Fire 未执行。
- 桌面详情顶部“目标项目”列出二者，下面的运行历史两行都只显示 Succeeded（成功）、相同时间和相同的 `B620 Two-project handoff` 按钮。用户必须点开结果后才能知道项目。实际第一按钮打开的是 `control-review` 的 `ses_automation_1294467cb2894bcd0ae56025788ba1f2`，而顶部第一个是 `mission-list-review`。服务没有丢失项目，也不能以配置顺序猜历史归属。[基线截图及回执](../../artifacts/2026-11-25-scheduled-history-identifies-project-run-target/README.md)
- 根因是历史行只从已经接受的原 Run 投影显示结果、时间、会话标题和错误，未使用 Run 自己的精确 `targetProjectId`。现有详情的目标项目列表与历史标签不是同一条记录，更新规则后尤其不能拿当前目标集合去猜以前运行的项目。影响多项目规则的成功、失败、无可打开会话和跨修订的历史识别。正规服务仍提供原会话身份、原目录、原项目 ID、原执行、原重试与原终态。正常 `poll`、手动和工具运行都读同一任务契约，本次 Fire 只有一次实际尝试、两个分别成功的目标，未观察到共享调度、恢复或持久化异常。

## 方案与验收

- 按每条已接受 Run 的目标范围及项目 ID 生成其项目标签。提取面板已有项目名和同名目录提示格式供定义行和历史复用。当前项目元数据未返回时，显示原精确项目 ID；该 Run 无会话也显示其项目。会话可打开时，原会话标题和项目标签同时可见，两者参与同一个原按钮的可读名称。沿用原列表顺序、可操作控件、当前选中规则与 `openRunSession` 的精确 Session／目录交接。全局和已有会话范围继续用现有名称。无新接口、缓存、计划执行写入或本地化字段需求。
- 候选重用已经完成的两个目标回执，从同一个历史位置打开两个可区分项目的原会话，核对本机原回复和精确目录。比较停机重开前后的实际历史、原 Fire 和未来规则，检查真实桌面截图及键盘／名称。执行计划服务、项目标签和公开回执聚焦检查，并通过渲染构建、类型、双语及文档。已有本机回执足以验证显示与导航，不再发送推理请求。
