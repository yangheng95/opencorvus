# Task 跟进模型回执与活动轮次模型

## Recall

用户要求持续分批迭代，由本人独立工作，不使用子 agent。每批先调查根因和影响，落盘后修改，进行聚焦正向验证、真实桌面页面交互与截图复核，完成范围提交、合并最新上游和普通推送。B161 `d1f01c160` 已推送并与上游 0/0，工作区原 177 项不变。已读根 AGENTS、[B161 Task 跟进重放](2026-11-10-task-operator-follow-up-replay.md)、[Provider 选模](../../current/architecture/06-provider.md)、[Task 控制面](../../current/architecture/task-control-plane.md)、02-data、03-control、07-panel 的相关契约。全仓搜索 `TaskMessageInput`、`handleTaskMessage`、所有 `appendAndWakeTaskOperatorMessage`/`buildTaskSessionMessageBundle`、`messageContext`、`EffectiveConfig`、`resolveAgentModel*`、`projected-scheduler`/`orchestrator-wake` 两个生产安装点、`task-root-assistant-v1`、`processTurn`、`terminalizeRecoveredIncompleteAssistant`、Worker Turn descriptor、Mission 和 Session recovery，以及 CLI（命令行界面）、桌面 Composer 入口。已读 Task 原子接受和 root runtime 测试、现本地流式 Provider 夹具。无委托，无外部 Provider 凭据。这里验收模型标识、真实流式请求及控制面事实，固定本机流式夹具不评价 GPT-6.1 Sol 的语义表现。

## 基线、根因与影响

隔离开发服务 39392 和本机流式服务 39396。Task `tsk_g00VaWPVWX00bwZMIGo0` 在执行轮次 1 用 A 发起实际 Orchestrator 请求。202 接受指定 B 的跟进，同一接收写入实际 ingress `art_hX2JSSJL3i1VUtwRcSeT`、Message `msg_h4p9NOxudvoHEvPJ1NaB` 和 Task 的 B 模型配置，但该 Message 记录 A。下一 Provider step 前，真实打开的 Assistant `msg_hSTYyGm0Ff0ecl0LAOXN` 仍为 A，而现解析得到 B；身份校验报错，原 Assistant 带错误完成，Task epoch 1 以 `interrupted` 失败（`pev_g0VaWPXRm00Q6XYqR5gU`），已接受 B 的 ingress 留在该轮次。真实工作台可展开看到相同原诊断。串行对照用新键指定 C，在 epoch 2 得到 C 的实际流式 Orchestrator 请求，接受 Message 却仍记录 B。原始流式调用和 SQLite 事实见[证据](../../artifacts/2026-11-10-task-operator-model-and-active-turn/README.md)。

第一处是写前后时序：显式配置通过现 `Session.prepareConfigOverlayMergeInProject` 准备后仅在 Message 的接受事务内生效；`buildTaskSessionMessageBundle` 在事务前从当前 Task 选模，没有接收该调用已经校验的明确选择。不能提前应用配置或事后改写 Message，两种做法都会破坏 Message/overlay/attachment/epoch/ingress 的原子性或已接受事实不可变。第二处是同一物理轮次的读边界：B 被接受或通过桌面模型控件写回根配置后，`SessionLoop` 的 projected scheduler 分支每个 Provider step 都从根配置解析，随后 `processTurn` 以完全相同 Session、父 Message 和 activation 的确定性 Assistant 校验新模型等于其不可变 A。新增的精确身份校验正确揭露了旧的每步解析问题；删除它、伪造 Assistant、新启轮次、延迟根设置、锁住模型控件或把子 Session 的历史 User 模型当本次配置，均会破坏现契约。

候选首次复测在修正 A/B 模型身份后，进一步暴露同一读边界也用于 Catalog：候选 Task `tsk_g00VaWRzI500FHFstFCm` 的 A Assistant `msg_hfy9hVWsX4mtd5VTT5Ev` 真实持久 `StaleCatalogOccurrenceError`，唯一 mismatch 为 `materialization_scope.config_revision`，随后 epoch 1 再次中断。同一重现的原子接受测试通过，流式回归显示首个 A 完成一条无决策 step 而无 `no_action`。审计 `CatalogOccurrenceBinding.materializationScope` 的两个生产调用点（Session 通用 model step、restart Permission continuation）及 Catalog 固定定义/owner/Plugin 校验：`config_revision` 使用实际全部有效配置的摘要，单独修改顶层 `model` 或清理 `agent.*.model` 也会改变同一物理轮次原 Catalog。不能忽略 mismatch、放宽工具定义/owner/Plugin 或改写已发布 Catalog。仅在活动 Task-root 物理 activation 内，SessionLoop 把首次实际使用配置的模型选择字段（顶层与 per-agent Model）保留在现 runtime owner 的短生命周期内，每步仍加载当前配置，形成实际用于该步的配置；其他字段继续接受现全配置摘要及定义检查。冻结值只是本物理轮次已经读取的选择，不写第二份配置、不改变其他 Session、restart Permission 或数据库格式。新 activation 根据现根 Session 模型重新选择并读取新配置。对并发场景还要核对工作台只改模型时旧目录仍通过、真实非模型字段变化仍为现明确 stale 契约。

### 共享轮次与恢复审计

Task 所有入口（创建、公开 follow-up、注入、连续目标、Scheduler Message、Mission/worker 协调、等待/Automation/Event、显式 Retry 及终态对话）通过 Task-root ingress 串行化同一 Task 的激活，最终使用同一个 projected scheduler `SessionLoop` 分支和真实控制/参与者父 Message；任何入口的活动 Task 轮次都可能遇到显式模型设置或配置变动。并行 Project/Task 各有自身 Session 和 ingress lease，不能用进程级模型缓存。记录模型只改公开 follow-up 的明确输入；不带模型、其他 actor 输入或历史接受的精确重发保留各自既有语义。Task 根配置仍是每个新物理激活的选择源，继承配置的待执行输入仍按其激活时当前配置执行。

同物理轮次的流式多步骤、普通决策修复和等待 Tool 的后续步骤共用同一个开放 Assistant；传输重试已在同一 Provider 活动内保持模型。Task 进程丢失后现 reconciler 用该 lease 的到期时间终结确切遗留 Assistant，新 activation 是新的物理尝试，并按现规则选择根配置，不能继续失去所有者的 Assistant。终态、显式取消、重新打开、归档或删除不改变现生命周期/接收授权。另一个 scheduler contract 安装点是 restart 后的 exact Permission 工具重放，仅重建受授权工具、读取原 Assistant 记录和现安全检查，不发新的模型 step；它对配置漂移的 typed stale 决策是独立权限约束，本批不调整。原生 Mission、Chat、Work 和其 Scheduler Message 路径走普通 Session 持久输入或 Mission 自己的精确 wake 和恢复，不安装 Task projected scheduler contract；投影 worker 走已有不可变 descriptor/输入模型。两条正常分支、其错误和重启路径不变；实际多项目/共享入口和重启控制按下面执行。没有新状态机、提示词、Tool、接口字段、数据库 schema（结构）、迁移、发布或产品界面改动。

## 实施与验收

1. 公开 Task follow-up 将现配置校验使用的明确模型 ID 交给同一 Task 根消息 builder，通过既有显式模型解析入口写入真实 Message 和回执；仍用现事务提交配置/Message/附件/轮次/ingress。未显式指定保留 `messageContext` 当前解析。exact replay 只读已接受 Message，不重算历史字段。
2. 同一 Task-root activation 每一步先取现确定性 Assistant，用原有角色、父 Message、activation/Session/agent 身份校验确认其准确归属。尚开放时用该 Assistant 持久 `providerID/modelID` 向现 Provider 目录加载精确模型，继续其原物理 Turn。新物理轮次仍读根配置；保持真实模型不存在的错误行为，不能偷偷切换。将同一次读取的 Assistant 交给现 turn 处理，保留写入守卫和终态检查。对 Catalog 使用活跃物理 activation 首次模型选择与当前其他配置实际合成后的配置；不用替代摘要、补写原事实或历史匹配规则。
3. 聚焦正向契约：原子接受的显式模型等于配置及新 Message；真实 streaming 中暂停 A、接受 B、释放 A，A 同一 Assistant 至少两个实际 Provider steps 并完成真实 `no_action`，下一 ingress 单独由 B 执行并生成实际 Tool 结果；核对对应持久 ID/轮次、无模型输入、同键重放以及另一项目独立。在实际开发页面从 Task Composer 切换并提交，亲看活动回复连续、独立的跟进和选中的模型，截图前后对照；以本地协议和持久事实证明模型标识。运行共享 Task 根调度及进程恢复、原生 Mission/Session 和 worker 对照所需的聚焦检查，不运行用户界面自动化测试。

## 实际验收

- 候选真实开发服务 39402、隔离流式服务 39403。在 A 已发出的第一步暂停后，两个并发同键、同明确 B 的公开请求收到同一 202、同一 ingress、同一 User Message（记录 B），根配置投影 B。释放首个流后，旧 Assistant 在同一 activation 用 A 完成第二步和真实 `no_action`；明确 B、继承 B 两个后续 ingress 分别用 B 完成各自的 Tool 结果，实际顺序 A/A/B/B。三个 ingress 均在 epoch 1，另一个 Project 真实流用 C；它与主 Task 的 Project 和持久记录独立。冷重启实际监听进程变更，已经移交的 B 仍返回原 Message/ingress、B、原 opened event 和 epoch。
- 在冷重启后的工作台实际打开第二个本项目 Task，旧 A 正在输出时从模型菜单选 B，输入并点击 Send。选中 B、原回复及已接受的新输入均在真实页面可见；释放首流后，看到原回复和新跟进各自完成。数据库证实同一旧 Assistant/activation 有已完成的文本 step 和真实 `no_action`；新回复有独立 activation 和 Tool 结果，真实物理请求 A/A/B，跟进 User Message 记 B。复核了 4 张 1280×720 截图，详见[证据](../../artifacts/2026-11-10-task-operator-model-and-active-turn/README.md)。
- 聚焦 Task 接受/流式测试 2 项、12 断言，覆盖既有 per-agent 模型清理和非模型提示配置确实改动时返回原 typed `StaleCatalogOccurrenceError`；现共享 Task 控制与崩溃恢复 3 项、10 断言，现 Catalog 4 项、11 断言，原生 Mission 双进程/真实流关闭 2 项、2 断言。Worker 保留 descriptor/`explicitModel` 分支，本批无外部语义验收。后端类型、文档、架构及现仓库钩子检查通过。没有运行界面自动化。已关闭隔离页面和自有进程并验证所有四个端口退出。
