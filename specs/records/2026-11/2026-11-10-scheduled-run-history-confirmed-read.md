# 定时运行历史保留已确认记录

## Recall

用户要求持续分批迭代，由本人独立完成，不使用子 agent；每批先分析并落盘，真实桌面交互和截图人工复核、聚焦正向检查、范围提交、上游合并与普通推送。B166 `70c1fd9e7` 已推送、上游 0/0，177 项无关状态保持。已读根 AGENTS、`07-panel` 定时详情和读取失败、`task-control-plane` Automation Fire/Run、[定时列表重试](2026-11-09-scheduled-list-retry-focus.md)、[已接受手动运行](2026-11-10-automation-manual-run-replay.md)、[审批历史已确认读取](2026-11-10-permission-ledger-refresh.md)，以及 `ScheduledAutomationsPanel`、服务、API（应用程序接口）连接归属、公开 `/runs`、`AutomationService.listRuns` 和共享 Feedback/Button。全仓搜 `runState`、`runRequest`、`loadRuns`/`listAutomationRuns`、`global.automations.runs`、`AutomationRunView`、history 文案与唯一页面消费、现列表和审批近似实现。无委托、无外部模型/凭据，使用 B165 已验收的原 Fire/Run/Session 备份，不调用任何运行写入。

## 基线、根因和影响

隔离真实开发 39428 `/ui` `main-DsZQzjf0.js`，39429 代理实时连接 101，仅截断 `/global/automations/atm_g0VaWgonz00zzrAdffju/runs` 选定响应。直连有准确两条成功记录，Fire 分别 `atm_h1dld2x3sv6KS0k8focA`、`atm_h3579veBQzgEbkcNMhnQ`；另一真实定义 `atm_g0VaWfp6u00Ig4RdODBZ` 有三个各自原运行。桌面先接受两条，打开 Refresh 后真实 200 `004886f3-fc6e-47b3-a9e4-4b7a77b4025d` 的 1189 字节等待 7 秒，只送 24 字节。等待只显示 Loading，两条历史及打开入口同时消失；失败只剩错误和一个新 Retry，原 Refresh 也仍在。展开原诊断再点 Retry，第二个真实 200 `261f9a9e-e366-4580-b84e-5149c1fca03b` 等待 9 秒同样截断，旧诊断卸载，焦点落文档根。再次 Retry，完整原两条恢复但焦点仍在文档根。[实页证据](../../artifacts/2026-11-10-scheduled-run-history-confirmed-read/README.md)。

`loadRuns` 已保存同一 automation ID 的 `currentItems`，却把 `status` 设为 `loading` 时丢掉 `error`。渲染只在 `status===ready` 时装载任何 rows；错误分支另创建第二个按钮。已有 `runRequest` 能取消较老读取、列表外 `selectedRunState` 能隔离不同定义；都没有把已接受数据与当前请求状态分开，也没有给当前已接受的显示绑定 API 连接代次。切换连接时传输已拒绝旧响应，但候选仍须把它视为退休而非当前错误。背景到期读、初次选择、保存/状态/手动运行后的确认刷新、手动刷新都共用这一条局部读取。该 API 只按定义读正向 Run，Fire 级历史另为 `/fires`；截断发生在 HTTP（超文本传输协议）读响应，持久结果不变。未见调度、队列、唤醒、Task（任务）/Mission（多步任务）/Session（会话）轮次、重试执行、重启或终态异常；不改变调度 timer、后端读写、Fire/Run/Session 身份、已接受手动执行或 SDK（软件开发工具包）。

## 实施与验收（修改前）

1. 保留一个历史读取状态和现 AbortController，按选中的定义与当前连接代次拥有。区分尚未接受响应、已经接受真实空/非空响应、在途与原错误；同范围等待和失败保留上次成功记录、可用的精确 Session 入口与原诊断。使用当前语言标记正在刷新或显示上次成功读取。只有当前拥有者成功替换数据和退休诊断。离开/换定义或连接退休旧响应；不建立缓存、重试器或后端替代查询。
2. 标题里的现 Refresh 是唯一读取动作，失败时原位置改为 Retry，等待用现 `aria-disabled`、`aria-busy` 和 guard（在途约束）保持焦点并拒绝重复激活。错误内容本身保留同一个 Feedback 与 Details。已接受记录按真实 Run ID 挂载，使相同身份在成功确认时保留键盘焦点；用户已经选中其他控件时不强行交接。现业务操作后的重读仍可替换此前发起的读，普通定时背景重读不打断当前同范围的在途请求。独立跨定义与已接受为空仍用各自真实状态；不把旧结果用作最新运行或手动执行回执。
3. 同一两条真实持久运行验证英文首次接受、等待、两次断开、同一个焦点、重复 Enter、原诊断、真恢复，以及成功刷新期间把焦点移到原 Session 按钮后仍可继续；中文复核对应界面和切换定义时退休原读、另一真实定义三条身份和真实空历史。至少实际打开一个原 Session，直连接口验证正向的准确原身份、公开检查和现聚焦非界面合同。风险是冷态错误误报空结果、旧行跨定义/连接、布局挤出首行或影响真实打开。截图本人复核，不新增或运行 UI（用户界面）自动化。

隔离库的七个既有定义均有成功历史。空历史对照在候选副本内通过正常公开定义创建入口添加一条 2099 年才到期的独立定义，直接核对真实空 `/runs` 和未到期 Fire；不触发该定义，原七个定义及持久历史作精确比较。

首次候选 `main-CK7dO9SF.js` 实页证明 2 条原历史、诊断和唯一按钮在两次中断期间保持；连续 Enter 只发一次读取，恢复后保持同一按钮。另一次慢刷新期间用 Tab 到第一条会话，成功替换后原焦点保持，并实际 Enter 打开 08:43 的会话、读到真实已有正文。截图显示原失败摘要内的 “Please retry.” 在已显示 `Retrying…` 时仍像再次指令，且不区分没有接纳数据与刷新既有记录。全仓搜索确认 `automations.error.history_load_failed` 仅为此页 `loadRuns` 生成。保留原诊断和原始原因，只按 `items` 是否已接纳区分「无法加载运行历史。」与「无法刷新运行历史。」；正文说明使用「上次加载的记录」，错误摘要不再给第二条重复动作指令。最终候选重新构建，复验已接受、冷空结果、双语和焦点。

## 实际验收

- 最终真实 `/ui` `main-DYypGkF7.js`，39432/39433，实时连接 101。空历史对照 `atm_g0VaWp2Qp003Qa2uNWAf` 首次实际 200 `[]` 被截为 1 字节，界面显示读取失败而不显示空；同一按钮重试取得完整 2 字节后才显示尚未运行，焦点回到同一刷新控件。隔离定义未来 Fire 保持 scheduled，没有产生真实运行。
- 已接纳两条的英文详情在 1189 字节真实响应延迟或截为 24 字节时，仍显示两条原行，等待和错误都标明上次加载。连续两次 Enter 只有一个重试；原 `TypeError: Failed to fetch` 保持展开，第三次完整回应后原按钮恢复 Refresh 并保留焦点。另一次完整慢读期间用 Tab 到第一行，响应替换后焦点仍在原会话。Enter 后浏览器实际读取 `ses_automation_15faaaf05ef8dc1cee6d1a3017bc0b07/conversation`，人工看到 08:43 原会话正文。
- 简体中文有实际刷新状态、局部失败、原两条和同一「重试」。延迟 9 秒的第八个真实历史请求在返回列表/切换定义时，代理记录客户端已关闭；另一真实定义稳定显示自己的三条，迟到的上游结果没有覆盖。直接接口 `2 / 3 / 0` 各有明确原身份与顺序，复制前后 SQLite `quick_check=ok`；精确比较 22 个原 Fire、14 Run、14 Run receipt、13 attempt 和 13 attempt receipt 等原行，只有独立 2099 年定义、其 Fire 及 frontier 增加。验证未触发任何新执行。
- 聚焦 `scheduler-automation-remediation` 11 用例、117 条断言；最终类型、双语 3050 键、普通构建和渲染器公开接口、文档与架构检查通过。[16 张实际桌面图和证据](../../artifacts/2026-11-10-scheduled-run-history-confirmed-read/README.md)已人工复核。没有 UI 自动化或模型调用；本次桌面覆盖定义切换，未在应用内实际更换连接配置或设备。三个验证标签和 39428–39433 自有监听已关闭。
