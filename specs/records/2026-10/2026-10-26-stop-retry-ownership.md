# 已接受停止的持续收敛

## Recall

用户要求自主、持续体验和改进整个产品，单 agent（代理），完成真实验收、独立提交与正常 push（推送）；只在无法安全判定的真实冲突时等待。旧 Goal 文本中的 Astra 委托要求已被用户后续指令覆盖。Rendering/Sources 闪烁已关闭，不再追查。不得操作用户18571服务、窗口或数据库，不建立 branch/worktree（分支/工作树），不修改同行发布/版本文件与176项清理工作。

上轮是 progress（实际进展）：e856a518a 已正常提交、全部 hooks（钩子）通过并推送；fresh fetch/merge（新鲜拉取/合并）后本地与上游0/0，自有源码/证据无未提交修改。623/624自有服务、原exec、native/launcher（原生宿主/启动器）、输出和请求全结清，自建标签关闭，配对auth/models副本退休。真实gpt-6.1-sol请求累计179。23项后端合同50断言、最终测试扩展类型检查及普通Node构建通过。保留首个中文Python cp1252失败、预算耗尽及冷重启同一会话续聊成功的事实。

已读当前AGENTS、上轮完整Recall及未完成项、03-control/07-panel当前合同、Task取消与原独立owner、唯一TaskControlDriver（任务控制驱动）、Task控制扫描/回调配置、Instance identity/runtime准入与dispose（释放）、InstanceBootstrap、Mission关闭/启动恢复。全仓搜索了configureTaskCancellationReconciler、configureTaskIngressRunner、reenterActiveInstance/tryProvideActive和所有生产取消调用。Task取消回调只有Bootstrap绑定；原runner（执行器）绑定与测试覆盖范围已查明。未发现/运行本轮UI（User Interface，用户界面）自动化测试。

## 修改前深度与影响分析

可观察事实：上轮完整Server停止入口、请求外迟延物理收尾和冷启动清理已通过；冷identity入口取消失败后的在线周期接管仍未知。源码显示原callback与driver只在完整Bootstrap后启用；driver的周期reenter只接受initialized缓存。入口模型独立并不自动建立重试所有权，第一次失败可能只保留cancelling/closing直到下一次显式重试或重启。需用真实canonical（唯一当前）取消失败、原请求收据和仅观察状态的checker（检查器）证实，不以模型自述或静态线索当作运行根因。

控制流候选根因：清理与执行共用了“完整能力初始化后才允许周期回入”的边界。原Task取消实现已经有join、独立Project lease（租约）、物理证明与终态writer；原Mission也有唯一closing意图、生命周期lease及原关闭执行器。缺的是这些已接受意图到原周期驱动的连续所有权。不能新增另一取消队列/循环/状态，也不能把失败直接写成已停止。

共享横审覆盖Task/Mission/普通Session的生产入口、当前occurrence（执行轮次）、重复/并发/终态、两个Project隔离、冷恢复/在线恢复、删除准入/全局关闭与模型不可用。普通Session没有Task/Mission的持久取消收敛状态，仍由原Prompt物理owner与abort响应持有，明确排除新增重试域。已初始化执行路径继续完整能力验证；冷清理不得顺带执行同Project兄弟工作。schema（结构）、迁移、消息原文、公共取消响应与凭据不变。中文命令环境先保留未知，不在取消机制根因未收敛前夹带改动。

## 验收与待确认实施决策

1. 先用原Task cancel及25ms收尾无活动超时产生真实TaskCancellationIncompleteError，原owner随后finish；保留同一cancelling/requestEventID，在不可用模型的冷identity上下文中只观察，要求原驱动自动收敛，不再显式调用取消或host recovery。另用原Mission关闭的已中断请求产生closing，观察其原请求/operationID与子Task最终状态。
2. 比较已完整初始化与冷identity的接管证据，覆盖原失败、迟延收尾、重试、两个Project并发与终态收据。fixture（夹具）或局部注入只证明对应合同，不冒充实页或端到端。
3. 若原失败证实候选：在现有Bootstrap抽出唯一清理初始化，注册原稳定Task取消callback和原Task/Mission driver，完整Bootstrap与已接受取消/关闭/冷恢复共用它。完整runner绑定仍只在原执行Bootstrap。原Instance cached reentry显式区分identity清理与默认runtime执行，保留缓存、Project关闭、全局结算、rollback（回滚）与租约边界；identity不能重新发现或复活已关闭缓存。
4. 原Task/Mission扫描先处理原取消/retention（保留策略）清理，只有原runtime准入成功才进入未改的执行扫描。周期回入使用缓存identity；不创建新上下文、不初始化模型、不调用LLM（Large Language Model，大语言模型）来清理、不发明另一执行路径。删除、关闭和State.dispose须证明清理driver也结清。
5. 聚焦正向测试、当前扩展类型和架构/接口/文档检查。需要实际页面验收时只启动自有开发CLI（Command Line Interface，命令行界面）/ui，普通Node构建、手工操作与原图人工复核。真实Provider需要成对复制auth及完整模型目录，分别预检凭据/投影/实际Sol流式请求，有限预算；每次20分钟物理边界、10分钟目标关闭、至少5分钟结算，原物理/输出/请求结清后退休副本。当前尚未启动新付费运行。
6. 最终更新当前合同、证据及三索引，独立提交；正常fetch/merge、审查完整待推集合、全部hooks通过后push。保留持续Goal active（活动），本批通过不代表整个产品完成。

## 合格红测试与确定决策

原checker（检查器）15项中13通过、2失败，46断言；原exec37421已exit1且physical/output结算。Task通过canonical cancelTask/25ms真实物理Prompt超时产生TaskCancellationIncompleteError，原owner.finish后仅观察五秒仍cancelling；Mission原请求AbortSignal中断后仅观察五秒仍closing、实际子Task仍active。不是网页/真实Provider验收，未用注入假终态。原请求/event/operation身份保留，确认连续所有权缺口。

确定复用方案：从现有Bootstrap抽出initializeProjectCleanupControl，原稳定Task callback、Task driver与Mission driver只在此注册；完整Bootstrap、原cancelTaskOnce、closeMissionExecutionOperation及启动清理均调用。仅向既有cached Instance reentry增加显式identity admission；默认runtime准入不变，不创建缓存或复活已释放身份。Task/Mission周期扫描以identity处理原cancel/closing/retention，真正执行扫描再进入原runtime cached准入。Task的IntentBundle materialization（意图文件投影）也放回runtime扫描，不让停止触发新执行投影。无新队列、计时器框架、另一取消实现或模型初始化。原disposeAll遍历全部缓存（含identity-only），先结清lease再State.dispose；Project deletion与cache convergence相同，已核对源码。


## 实际页面运行边界

626只读复制已关闭624自有库，逐表核对并保护原9类事实，使用原普通Node构建main-Dm1PjLZY.js与新后端的真实CLI /ui，单独38133监听。配对复制已授权auth/完整models并逐项预检；最多12次Sol流式请求（含预检/辅助），累计179起、最多191。通过当前公开task.create API提交一个明确的真实验收请求，精确Dynamic身份，无文件更改、委派、子任务或子agent；真实页面点击停止并观察原取消收据。模型若没有直接Shell工具则保留实际回复，不伪造工具调用。只观察原ProcessSupervisor返回handle的物理/输出/请求Promises及精确进程身份，不改变执行输入、输出或调度。仍采用20分钟物理边界、10分钟关闭目标、五分钟余量；原exec/native/output/request结清后关闭标签、退休副本。没有UI自动化测试，本轮尚未启动该运行。

## 当前验收与新增实页问题

实施后原15项停止合同全通过47断言。进一步增加cached identity正向身份/会话输出及实际执行准入的ProviderModelNotFoundError；修复冷恢复夹具释放时点，避免在线接管使其失去真正的重启前状态。扩大6文件回归仅旧freshPassObserved观察点失败，其实际取消attempts=1已通过；旧观察误把取消完成后的source reconciliation当作新驱动pass，已改为记录原driver真实pass，保留原收据/状态断言并删除不再读取的测试trace。最终16个停止、3个控制取消、10个路由均0；另38个liveness、3个scope、4个原生关闭和1个能力刷新均0；总75项139断言，当前测试扩展类型检查0。没有把局部夹具称为真实Provider端到端。

626真实task.create202产生tsk_g00VZ9I3ro00dzgkqHTO，原真实user请求与主orchestrator回复完整可见。模型报告主角色无bash，实际工具仅no_action；原ProcessSupervisor观察记录为空，不算长命令物理停止验收。原Task epoch1由人工Composer Stop写原取消收据、task.cancelled；随后真实用户输入要求只回复一句，面板提交实际创建epoch2，主assistant同一Message产生3个不同text Part及3个stop step，最后原task.infrastructure.failed显示exhausted(semantic_limit)。这是持久化模型输出与控制事实，不是UI重复渲染。第二次人工Stop保留epoch2自己的请求/终态。正常Task执行、当前取消入口及原两轮收据实页复核通过；取消后终态续聊并只回复一次未通过，根因尚须追查TaskMessage重开准入、真实no_action决定与Prompt/continuation，不能用显示去重、隐藏消息或关键词gate掩盖。当前改动没有触及该发送/LLM决策实现，原始事实用于下一批继续根治。

626共10次真实gpt-6.1-sol流请求，全HTTP200/reader settled，累计189，剩余2额度退休；副本auth/models在原exec12066/native/launcher全0、输出/请求结清后退休，来源元数据/模型字节保持。shutdown200、提前999599ms关闭、tab11关闭。原92表12926行来源保持，目标原9类370事实保持；没有用户数据库/服务操作，schema仍8。截图01–04均人工查看，原1119x720左侧捕获保留；不存在可冒充已运行Shell的输出或新子agent。
