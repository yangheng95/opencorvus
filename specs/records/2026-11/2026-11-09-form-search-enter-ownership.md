# 表单内搜索的回车归属

## Recall

用户要求持续迭代，最新明确本人独立工作；先查根因与影响、落盘规格，再实施、真实桌面交互与本人截图复核、正向检查、范围提交、同步推送。上批 `fbfd9f656` 普通推送退出 0，本地/上游 0/0，原 177 条工作区状态逐项相同。未授权隔离凭据，不读取凭据或模型目录，不走模型调用；本批仅允许隔离项目中的未执行草稿，定时表单不保存。未检索到触及路径的界面自动化测试。

已读 07-panel 的多步任务创建/字段校验、定时目标搜索、共享 SearchField，原 2026-11-02-mission-form-validation 记录，前批市场安装选择记录，SearchField/TextField、MissionCreateDialog、MissionBoard 到 main 的两个创建入口、定时目标搜索、MemoryPanel 的独立查询、ComboboxControl、`mission.createDraft`/`mission.list`。全仓查 SearchField 调用、回车处理、原生表单、输入法标记及历史；用现安装的 TypeScript 语法树核查组件嵌套：21 处 SearchField 调用中，两个直接处在原生表单，即创建多步任务和定时项目目标，只有 Memory 明确提供独立 `onSubmit`，后者在表单外。定时项目目标已局部 `preventDefault`，并独有方向键的列表焦点移交。其他消费者目前没有相同的原生表单归属；输入/下拉选择器是各自语义，不纳入本批。

## 修改前根因及范围

真实隔离 39073 `/ui` 使用 `main-Cm9WWiq6.js`。任务页进入英文 Start now，选 Work，原请求为空，在专家团搜索键入 `dynamic`；Dynamic 勾选、计数 1、搜索仍聚焦、创建按钮可用（01）。按一次真实回车，现产品把请求框置红，显示 `Describe the expected result to continue.` 并把焦点从查询移至空请求（02）。空字段由现 `submit()` 本地校验阻断，因此没有调用创建/运行入口。再进入定时任务新建、选择 Selected projects、搜索 `project-before`：回车仍在搜索框，方向键 Down 将焦点给实际唯一项目（03），随后取消，无定时保存。

[HTML（超文本标记语言）现行规范的隐式提交](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission)允许 Enter 由文本控件激活表单默认提交按钮。SearchField 的原生 `type=search` 在该 Mission `form` 内；共用控件仅在有独立 `onSubmit` 时取消 Enter 默认动作，Mission 搜索按输入实时读取而未提供它。外置 footer 的原生 submit 用 `form="missionCreateForm"` 关联同一表单，因而回车走创建动作。既有 `noValidate` 只统一空值反馈，不能解除搜索与原生隐式提交的绑定；定时的局部拦截也不覆盖另一处。当前实测只触发空值校验；从同一 `submit` 可见，有效手动表单会进入 `mission.createDraft`，有效立即开始表单会到主绑定和 `wakeMission`。不实际触发旧版执行分支。

影响面限定两个原生表单搜索和共用控件显式搜索提交：Mission 两种模式、键盘焦点和独立保存入口；定时项目的 Enter/方向键/选择；Memory 明确提交由 `onSubmit` 拥有。原生提交按钮、正常字段校验、实时读取、清除和 Escape、用户已选项、项目和工作类型、公开接口、错误协议、数据、持久格式及交付链无改。观察到的是本地输入意图误路由，不是运行轮次、任务调度、队列、唤醒、重试或终态的共享运行异常；验收不安排定时、不派发任务。标准覆盖浏览器隐式行为；仅以此次实际桌面环境作为交付证据，不声称逐个平台或真实输入法组合均复验。

## 实施与验收计划

复用 SearchField 现有 Enter 所有权，在原生输入有关联表单或明确独立 `onSubmit` 时，由共用控件处理完成编辑后的回车：先沿现有外部键盘处理和 defaultPrevented 契约，再隔离父表单，有独立回调时照常调用。保留实际输入法组成（Input Method Editor，IME）的确认，不把组成中 Enter 改成提交。不增加组件选项、表单门、第二提交路径或搜索请求。删除定时消费者的重复 Enter 分支，保留其独有 Up/Down、列表选取和取消。更新 07-panel 对应契约，不改用户文案。

用真实桌面复验英文立即开始的空请求路径：Enter 后原查询、可见焦点、当前候选和计数保持；再明确点击空表单的 Create and start，核对现本地化校验和焦点仍工作（无需实际运行）。中文「先存草稿」填写完全可审查的隔离标题与请求，通用/Dynamic，专家团搜索回车后仍在原表单及搜索处；之后只用明确「保存草稿」动作提交这一个未执行草稿，核对页面成功、真实读接口和持久会话原文。定时表单重复 Enter、Down 和手动选取并取消，不保存；检查明确提交搜索的 Memory 是否能用本地索引安全核对，不能时注明原因。正常构建、类型、双语、文档/架构，真实 `/ui` 资源、截图与本地开发服务响应，确认隔离数据库仅有唯一草稿、没有实际执行和提供商活动；范围提交、正常上游同步与推送。纯界面修复，无界面自动化测试。

## 实际验收

新版隔离开发服务 39074 的 `/ui` 实际提供 `main-CpbC1sCL.js`。英文 Start now 搜索 `dynamic` 后按回车，搜索获焦、Dynamic 勾选和计数 1 保持；明确点击空表单 Create and start 才进入既有错误与请求框焦点（04–05）。中文已填有效标题和请求，选择通用、Dynamic，搜索 `dynamic` 后回车，焦点仍在搜索且标题、请求和唯一选择保留（06）；此时实际 `/mission` 200 返回空。明确点击「保存草稿」后显示成功及待规划卡片（07）；唯一 `POST /mission/draft` 为 `30d9586d-4530-4634-ae1c-ec25250be0e1`，200、134 毫秒。实际列表和 SQLite 数据库独立确认同一 Mission `3ec551184173af95` 与 Session `ses_-zUPYDbd7zzbGpndXpSI`、隔离项目目录、原题与请求、Work 及唯一 `dynamic` 快照，待规划且零子任务。

定时项目查询回车后仍聚焦，Down 聚焦实际项目，空格后计数从 0 变为 1（08–09），最终取消。另观察到空格选取之后焦点落在页面根，保留为独立下一批复现线索；本批没有更改列表选取代码，基线只覆盖方向键移焦，未据此判定旧版也有该症状。Memory 使用本地全文查询：`b75keyboard` 真实按回车返回 `No matching context found`（10），实际 `POST /panel/knowledge/memory/search` 请求 `f9333cca-5385-44ba-9b3e-526a511a2d3b` 200、2 毫秒。没有调用提供商。本人复核 10 张真实桌面图；没有逐平台复测输入法组合。

三个阶段共 6 个实际业务读取按真实 `/doc` 响应结构验证。两份数据库只有各自项目，修复后有唯一草稿；消息、执行任务、定时定义/触发/运行及 Provider 活动和用量均为 0；两个隔离项目原文件和 Git HEAD 保持。两个服务各经 `/shutdown` 正常退出 0。类型、双语（2955 个键）、正常构建、文档/架构、差异检查通过。见[原图与运行证据](../../artifacts/2026-11-09-form-search-enter-ownership/README.md)。
