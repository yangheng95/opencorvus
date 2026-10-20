# 独立回调的数据库上下文审计

## Recall

持续单 agent 自主迭代；后续用户禁止子 agent 覆盖旧goal中的三Astra文字。467为progress：c2b572b63684901e9ed442ed5aeed8f301260671已正常push，fresh fetch确认HEAD=origin/main；审批/历史结构化单行呈现、Task后台交接与Task/Mission控制driver的Database上下文脱离已修复。24例/124断言、17张人工截图和真实Task epoch4/Goalcomplete193569tokens/1turn、独立Chat真实write通过。原39988/48568/2523全部exit0，三个公开shutdown200，15/预设16 Sol流全部200/eof、native/output/request/launcher和runtime/private复制对已退休，tab16/17/18关闭。131 Project/176 Session/schema2及三份原身份/目录/归属完整保留。仅原.bun/及packages/opencorvus/bun/未跟踪。配置性能、Sources/侧agent直播Rendering仍无新资格；当前未关闭的共性范围为scheduler event/Session/OS独立回调owner，不以Task两个失败通过宣称全根治。

沿用benchmark-debug-template。已读467 Recall/最终事实、当前Data/Control/Task与Security架构，重新查EventService discovery/lease恢复timer/rollback reopen/settle，全部reenter生产调用、FileWatcher callback/subscription/native HEAD路径、Session loop正常/终态/standby与SessionWake、独立Project owner、Bus transient/durable publish及post-commit clear、Database.effect/closed owner/Instance lease契约。已读scheduler-event-durable-fire、session-created-effect、file-watcher-runtime-isolation相关测试。后者现有“repository removal -> undefined branch”以缺失为核心，不再作为验收：删除该case及专用imports，保留明确诊断/释放的正向case。无UI改动或UI自动化。

## 修改前深度与影响分析

已证实根因类别：异步操作只脱离原Instance lease而保留调用者DB transaction/effect AsyncLocalStorage，原effect返回后owner关闭，独立回调第一次DB操作失败。467修复Task两个后台入口共同helper和Task/Mission driver reentry适配。当前EventService的runInstanceBackgroundWork discovery与runRecoveryOperation只进行Instance层脱离；FileWatcher persistentCallbackRunner亦如此。来源名称相似只作线索，尚需实测，不能按关键字或逐处盲包函数。普通Session wake生产入口明确通过runWithInitializedIndependentProject，已经同时清DB和Instance上下文；standby/terminal重入是该独立loop的后续生命周期，仍需测试/运行支持排除。

横审维度：Task/Mission/Session occurrence、首次/正常/终态、等待/重试/重启、串并行、跨Project、删除/关闭后的回调；覆盖公共Session/Task wake、EventService初次accept/recover/discovery及retry/lease/rollback、原生HEAD/Parcel回调。旧测试多直接调用acceptEnvelope或初始化在普通Instance scope，未覆盖原post-commit owner关闭后的独立回调。Event机制影响durable fire/receipt和真实Session Message，Watcher影响真实文件事件和VCS刷新；不放宽closed-owner校验、不吞错或换新事件身份重试，不新增gate/fallback/影子状态。不触及schema/持久协议、Provider配置/模型选择或UI渲染；历史不可变事实不改写，公开API沿原结构。未知项以真实code+失败/通过记录保留，未排除前不判为局部。

## 方案与验收

1. 先用现有正式后端driver建立基线：事件持久化/配置wake/重试/多Project及Session Created正向合同；不无目标跑全量bun test。新增聚焦正向复现：Event accept/discovery从post-commit effect交接后仍形成原定义/occurrence的成功fire/receipt；原生FileWatcher在post-commit初始化结束后，通过真实HEAD写入触发Bus、实际DB操作与原Project身份，跨两个Project核对隔离。失败应证明具体owner/状态，不以超时或日志最后一行为根因。先记录实际失败再改生产。
2. 对被代码+运行证实的独立边界使用已有Database.runOutsideContext与原独立Instance primitive；覆盖其全部入口/终态/重试/恢复，不修改低层Instance公共契约或扩大到未证实回调。保留原signal、lease、capacity、completion、request/occurrence身份、原错误和Job生命周期。用明确输出/成功receipt/实际文件事件和Project归属作正向回归；直接测试hook只能证明局部合同，不冒充端到端。
3. 非UI改动不需要新前端build/自动化。必要真实验收使用自有18779 native开发服务、当前后端和467当前正式UI，完整QA412历史；原413 NativeService监管，启动前捕获131/176历史。全批最多8实际gpt-6.1-sol流；复制授权auth时同时完整models，分别预检credential/catalog/实际model，不refresh/exchange/写源。原用户18571/窗口/进程不动，不委托/建branch/worktree。
4. 通过既有公开event-schedule API创建有限oneShot定义，匹配自有QA项目的真实file.watcher.updated/HEAD；写回该自有HEAD的原字节触发原生路径，使用原真实SessionWake/流式Sol输出EVENT468READY，核对单个原fire/receipt/Message和正常终态；无工具写入、网络或委派需求。若HEAD已有不能安全操作的变化，不覆盖，先调查。公开API/readonly SQLite/原Provider reader构成实际功能checker；如打开页面则新IAB tab、实际截图人工查看，不替代功能证据。不可用入口或不同实际归属必须如实记录，不私造事件冒充OS路径。
5. 原运行工作/全部Provider与native/output/request/launcher结算，关闭自有页/公开shutdown/保存日志；实际秘密扫描后runtime/private完整复制对退休。全部原Project/Session身份/目录/归属和schema2保留。三索引/架构/证据与docs:check；范围commit，即便未完全满足也明确；fetch/merge/upstream..HEAD集合审查、正常push/fresh fetch。Goal维持active，继续未满足的Shared audit及Sources/Rendering体验，不创建Release/tag/PR。

## 基线证据与实施前确定边界

正式driver基线：Session Created 1例/2断言、原事件配置wake/瞬态输入/跨Project/重试4例10断言均通过。新正向case在当前生产源码上均失败；带原Log.flush/read诊断的第二次复现明确给出event-fire-discovery的Database.use继承closed effect owner，以及两个真实native HEAD回调的Database.immediateTransaction继承closed effect owner。Event原fire已经持久化、attempt0/status pending；Watcher通过原FileWatcher.init在post-commit初始化后写回两个fixture HEAD原字节，但原回调在Bus内实际DB操作失败。诊断见私有independent-callback-context-468/baseline-diagnostic.log；不是以超时或命名推断根因。

确定修改：Event discovery整个独立background-work链用原Database.runOutsideContext启动；其lease/retry/rollback的runRecoveryOperation同样脱离原DB owner再原active reentry。实际fire执行及lease续租位于该discovery持有的serving lease下，running全部结算后才退出，fence在终态先dispose；不另改容量或租约协议。FileWatcher persistentCallbackRunner在原native/Parcel共用callback边界清DB上下文再原lifecycle.reenter，保留原目录、日志、订阅资源和关闭语义；不改底层Instance API。SessionWake.executeWakeLoop已有runWithInitializedIndependentProject（同时清DB/Instance），standby/terminal是独立loop后续；公共Session和跨Project/恢复测试及真实运行继续支撑排除，而不是按Session名字区别。

测试仅新增当前正向合同，Event的wake hook用于局部context/fire合同，不冒充模型E2E；后续原API+真实native文件事件+Sol核验生产SessionWake。新FileWatcher case使用真实OS监听和Session.create/get证明原Project数据库回执；修正其watchdog清理以避免成功后残留诊断timer。原缺失branch负向case已删除及专用imports，其VCS生产能力未改。

## 横向复核与当前验收

全仓生产 reenter 搜索确认：Instance只提供底层生命周期原语；Task root ingress两个适配及Task/Mission host driver已在467清DB上下文，driver heartbeat/hint/retry/rearm共用该适配；本轮Event recovery operation覆盖lease/retry/rollback，discovery持有实际执行lease；FileWatcher native/Parcel共用同一callback factory。Session loop的standby和失败terminal重入仍属于原物理Prompt执行，SessionWake初次执行使用runWithInitializedIndependentProject；公开Session prompt/converge调用保留并await其实际执行Promise，Agent runner属于已独立进入的Task执行。没有修改底层Instance契约或把全部重入统一盲包；生产输入、原租约、串并行和多Project分别由代码与下述运行证据支持，不宣称任何未来回调都天然安全。

正式后端driver原18691 exit0：independent-callback-context 2例3断言、file-watcher-runtime-isolation 1例3断言、event-current-frontier 6例25断言、event-fire-claim-attempt 1例3断言、scheduler-event-durable-fire 11例24断言、Session Created 1例2断言，共22例60断言。恢复timer正向case改为在Database.effect内注册、等待effect结束，然后原远端terminal提交把计时器交接给同定义后继fire；删除其“timer不存在”负向断言，保留精确woken/fire成功状态。覆盖Mission原occurrence关闭/重开、crash recovery、跨Project容量、取消后pending、同fire重试及不可变输入错误合同。原backend typecheck40498 exit0。第一次prettier命令工作目录错误未执行，改为根目录绝对运行器后仅格式化新测试和两个修改函数，没有整文件重排。

自有18779原native13587已exit0，公开shutdown200，Host80136/Target93348的原birth identity、physical/output/request/launcher结算均有事实，runtime复制对已随原launcher退休。3/预设8实际Sol流全部200/stream/settled/EOF，其中两个preflight、一个真实Event Session；凭据usable、完整catalog projected、实际api model gpt-6.1-sol分别核对。private完整auth/models经实际秘密值扫描后成对退休，源metadata未变，无refresh/exchange。

真实公开API oneShot evt_g0VYa3Gwa001cyepmmjb，原HEAD写回触发bus-occurrence:6e182870-7851-446c-98f7-fd6ecaac38cc，原fire cal_g0VYa3Gwj002if3yEaBV、成功wake消息msg_event_1b912303118daab0c899985baa75ff5a、原Session ses_g0VYa3Gwj003t2ichNvt和assistant msg_g0VYa3Gxd00daSDZxItX。实际assistant finish stop/completed、精确EVENT468READY；输入消息不能代替模型完成。checker首轮match误写file/event，实际pick读取properties.file/properties.event；原未匹配定义公开tombstone，原observer46521无活动180秒后exit1。修正checker后重跑真实文件路径，并单独修复原初始“所有text包含marker”的错误判断，针对同Session核对assistant role/completed/实际模型。没有把工具链错误当产品失败或成功。

只读SQLite最终132 Project/178 Session/schema2；启动前131/176每个原Project/Session身份、目录和归属全部保持，原HEAD字节一致。没有构建/迁移真实用户数据，没有运行UI自动化。自有tab19直接把内部Event Session作为Chat链接打开，真实404截图已人工查看；Scheduled只呈现当前Automation列表，未据此把旧experimental Event的UI可用性计为通过。当前后台功能验收通过，Event对话入口的产品呈现合同尚未完成确认；Sources/侧agent直播Rendering、配置性能仍保留原未达项。原用户18571未操作。

[完整产物](../../artifacts/2026-10-20-independent-callback-context/README.md)保留原失败、22例、真实事件/流式模型、native/Provider/复制对结算及一张明确失败资格的页面截图。结束前正常docs/check/hook、范围提交、fetch/merge/upstream..HEAD全量审查、push/fresh fetch；长期goal维持active，继续后续独立排查。
