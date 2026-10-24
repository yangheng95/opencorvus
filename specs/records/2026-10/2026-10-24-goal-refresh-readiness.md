# 持续目标的首次读取与后台刷新

## Recall

565继续用户授权的单agent自主迭代，后续单agent要求覆盖旧Goal内的Astra，不委托。用户已授权OpenCorvus热认证OpenAI和完整模型目录用于有限真实Sol验收。上一Goal turn为progress：c5b95e2d0已提交推送长流验收，102秒真实Sol流、七图、流中上翻/EOF后原读位/显式恢复、另一页原Sources稳定，四模型原reader EOF；原93807/native93056正常闭合、auth/catalog各退休1，源90表175427原行/字节/时间保持。最终分支同时包含已独立审阅并由原任务正常送达的747423bd4，fresh0/0。整体Goal active。

564安全请求实际观察到空目标三个owner查询72/62/59次，总193；protocol_event continuous_goal.created是事实源，不与engine_goal的Task验收目标混同。计数本身没有证明闪烁或缺陷，本批先查当前公开合同及慢请求的真实行为。开始git status完整保存，当前HEAD以实际Git为准，保留全部其他删除/修改/新增和暂存，不建branch/worktree、不操作用户18571进程/页面/数据库。

已读AGENTS、564 Recall/原请求和closure、continuous-goal当前架构、组件全部source/resource/refresh/form/mutate路径、service及SSE/Side调用、原生Session过滤与Task协议转发、store事件/usage关联和controller正常/终态/恢复入口。已查看Goal service/refresh两文件，都是纯HTTP/失效通知合同，无DOM/组件/截图断言；不作为网页验收。Subagent现有refresh controller处理revision/timer/in-flight/trailing，与Goal依赖现成createResource.loading的职责不同，不直接耦合两个子系统或复制整个coordinator。

## 修改前分析

当前组件唯一HTTP projection读loadContinuousGoal；定时器、focus、visibility、connected/intent/settled通知均在可见/当前owner/非busy时直接refetch。Solid只合并同一microtask的refetch，后续refetch会替换当前Promise；安装的solid.js load(342–380)已直接核明，最新Promise才能loadEnd。组件initialLoading仅在resource.state=pending，openRequest在此期间不处理。因此若首次GET慢于五秒，周期调用可能持续替换首次读取，已有响应也不能把当前resource推进ready，表单一直等待。当前只是代码与协议推导，必须用真实延迟路由/页面先复现，不能仅凭193计数判断失败。

当前五秒周期有明确合同：原生Session流没有完整持续目标协议，usage关联在stream聚合而非owner native流；其他进程直接提交的durable变化也未必有当前执行通知。因此本轮保留五秒、focus/visibility、原事件失效与明确mutation后重读，不用删除周期掩盖问题，不扩展公开Goal协议或引入第二数据源。Task/Chat/Mission/Side共用组件；同一source的首次/后台请求必须允许完成，期间背景失效合并成一次待刷新，完成后用同一resource重读。

根因候选是当前背景触发未观察既有resource.loading，不是Scheduler/Goal执行队列错误。Source key已绑定authority、selection、kind/id/directory，retired owner不能调度下一读取。嵌套effect与本source lifetime一起清理局部pending flag，不保留Goal值、影子缓存或跨项目队列。明确mutation保留即时权威重读，不能把写后读取错误合并进旧快照；后台仅在其busy/当前loading结束后收敛。若实际发现调度/唤醒/并发终态异常，立即扩大为AGENTS要求的全部生产入口/occurrence/重启/项目隔离审计，不能以UI现象降级。

本批不改API/工具/模型行为、schema、持久格式或执行逻辑。正式schema5已经提交，隔离源564实际4；使用正常生产4→5迁移验证，不改迁移或给旧fixture绕过检查。完整源数据/配置/版本/对象/行字段时间与目标真实差异均核对。若遇历史歧义拒绝，保留该失败及备份并按当前数据合同处理，不清库或虚构收据。

权威资料已核[Solid createResource](https://docs.solidjs.com/reference/basic-reactivity/create-resource)与[Suspense](https://docs.solidjs.com/reference/components/suspense)：resource有pending/ready/refreshing及现成loading，后台refresh保留先前值；不能凭文档把所有Rendering标签归因于Goal。本轮优先用现有resource状态控制背景请求准入，不新增通用库、配置或双缓存。

风险：首次读取饥饿、连续失效丢最新变化、pending flag跨owner、隐藏/非busy变化后的刷新、错误/重试、写后原revision覆盖、对话框被反复刷新关闭。验收必须实际触发Goal入口并读表单，不用GET数或DOM文本代替视觉。纯UI改动禁止UI自动化测试；若最终涉及非UI公开契约再添加聚焦正向合同。

## 实施前方案

1. 独立before从已闭合564完整复制，沿完整main-BGogOrxR UI及source CLI `/ui/`。当前完整OpenAI条目/完整相邻models配对复制，分别验证凭据、投影与真实gpt-6.1-sol预检。每scope最多4请求、批次8，预期仅各预检chat/memory两次；不为页面验收启动Goal自动执行。20分钟原生边界、180秒启动无活动、至少五分钟收尾。
2. 使用现有Server.TestHooks.beforeRequest，在自有服务中仅对实际continuous-goal GET等待8000ms，原路由、数据库、响应和浏览器传输均不替换。原输入/模型流不延迟，不用sleep或host gate教LLM流程。该受控网络条件是手动实页诊断，不是浏览器fixture、mock响应或UI自动化测试。记录每个请求实际进入/延迟结束/abort与并行峰值，手动点击原主会话/Side的持续目标入口并至少跨过几个周期看图。
3. 先复现后改：背景刷新记录一次本source pending intent，已有resource.loading或busy期间等待；嵌套effect在这些现成事实结束后清一次pending并refetch。Source清理同时退休其pending。保留周期、通知、可见性、明确mutation后即时重读和错误摘要，原resource仍是唯一Goal值。必要时手动Retry也走同一背景合并入口，不能吞实际错误。
4. UI改变后正式Node完整构建到全新私有输出，不启动独立Vite、不改用户dist。after从闭合before复制，使用相同八秒条件手动打开Goal表单、输入/取消，并核对连续刷新后仍可编辑；另核原Side及切换source时归属。实际截图与请求时序证明首次进展和后续有界重读，不用源码字串/DOM/像素断言，也不声称所有Rendering入口已解决。
5. 各scope公开shutdown、join原exec/native/launcher及physical/output/request，配对退休auth/catalog，核对全部源原行/字段/时间/字节/canonical/实际schema/integrity和目标差异。更新当前架构及四索引、类型/构建/文档/必要聚焦合同；精确独立index提交本批，fetch原进程terminal→merge upstream→完整待推集合审查→正常hooks push→fresh0/0。不发布，Goal保持active。

## 修改前实页复现与方案补充

before原60282以正式schema5正常启动、真实4→5沿原迁移，主/Side读取均实际延迟8000ms。IAB227从正式加号菜单点击主持续目标，01/02跨多个实际延迟结束和后续请求仍无表单；打开原Side2并同样点击，03也持续等待。原请求记录有正常latency-end及后续新请求、部分client-aborted和同路径两个同时等待，不能称后端没有返回。15秒HTTP默认超时已核实，受控8秒在其范围内。当前主/Side组件首次resource被持续背景读取替换，openRequest等待初次ready，和实际现象一致。

初读827行把冲突后的review_current按钮误认footer；继续核实际560行footer后确认提交按钮原本已沿disabled()/initialLoading正确区分pending与refreshing，Home也有原ownsLaunch准入。排除此候选，不改正确提交逻辑，也不擅自放开需要最新revision的冲突复核按钮。Goal创建/更新继续沿唯一服务端owner与expectedRevision完整性合同；UI补充验收仍需要确认背景重读期间原表单可编辑。

实现限于当前组件：每source setup局部pending boolean，背景trigger只记一次；嵌套effect观察原resource.loading及busy，在允许时flush一次。嵌套owner随source cleanup退休，固定周期/通知/focus/visibility/显式mutation重读保留。其他子系统已有revision/timer controller不用搬入Goal或形成平行配置；不新增Goal值、HTTP缓存、公共API或UI自动化测试。

## 实施与真实验收结果

前端类型检查原83897退出0，Node.js完整Vite构建原63459退出0，64秒产出全新main-D5Ah_P6W.js；原有chunk体积提示保留，不是构建失败。修改后独立source CLI继续使用8000ms真实路由前延迟。人工在IAB228打开原主会话Goal，04实际表单出现；05输入隔离编辑文本并展开预算；06约两分钟及多轮后台读取后文本与展开状态保留，仍可操作。随后清空输入并取消，不提交目标。

同页打开原Side2，07正确显示侧聊2空表单；取消、切换Side1再打开，08正确显示侧聊1空表单。IAB229使用真实Task tsk_g00VYhrJxy00qIC54qvM，原菜单打开09表单，显示当前Task及“双成员正文流中刷新511”的真实名称，取消。IAB230沿已登记Mission ses_-zURQjvQ8zz3y3NgFyVx的正式sessionKind/directory URL打开，保留原已完成持续目标、1/1轮和41550令牌；原菜单打开10新建表单，正确显示当前Mission及原名，取消。均未启动执行、发送消息或改目标。所有自有页面已关闭。

前后请求实际统计：before主60进入/60延迟结束/57客户端取消，诊断同时等待峰值3；Side2为37/37/36、峰值2。after主53/53/1、Side2为20/20/0、Side1为12/12/1、Task为20/20/1、Mission为4/4/1，每路径峰值1。after取消均位于操作者关闭页面或切换归属边界。这里latency-end仅指钩子内八秒等待结束，不能伪作HTTP响应完成或模型reader EOF；实际表单和可编辑性由十张已呈现人工查看的[实图](../../artifacts/2026-10-24-goal-refresh-readiness/README.md)独立证明。前后都没有continuous-goal POST。

已证明的根因是背景读取在前次未完成时不断替换resource当前Promise，导致首次ready和等待它的入口无法收敛；五秒观察本身是跨进程一致性的既有合同。单一组件现在复用当前loading/busy事实保留一次背景失效，前次完成后再读取，同source退休时一起清理。未扩大成Goal调度器、执行队列或所有Rendering文本的结论，没有修改公开API、schema、持久格式、目标执行或现有mutation后重读。

## 运行、数据与凭据闭合

before原60282与after原94661均已join到退出0；公开shutdown各200，原生宿主和启动器退出0，physicalCompletion/outputDrainComplete/requestCleanupComplete均true，原进程链dead_or_reused。关闭时保留855042/541597ms，均高于五分钟。after最初误用Windows PowerShell调用仅支持当前pwsh的自有收尾脚本，ArgumentList异常发生在本地进程身份检查依赖，未发shutdown；改回仓库配置的pwsh后原命令正常200并完成同一occurrence闭合，没有重启或终止用户进程。该命令调用错误不涉及产品实现。

前后各最多4模型请求，实际各2，共4个真实Sol预检请求，全部gpt-6.1-sol、streaming=true、HTTP200、原响应reader settled/eof；没有用模型自述替代验收。每scope在真正闭合后配对退休auth/models各1。当前完整模型目录9155406字节及原mtime保持，内容与源完全相同；凭据内容不进入证据或提交。

正式schema5未被改写。before只对闭合564复制品沿生产4→5迁移；after从闭合before复制品沿5→5。源各90表176384/176819原行，原rowid/主键/全部字段/时间、数据库字节与mtime、完整canonical配置均精确保持，源与目标完整性ok、schema对象一致。目标两个运行容量租约的lease_id/owner_id/time_acquired/expires_at随当前隔离服务更新；真实新预检与运行记录为正常追加，不能误称目标库全部不变。原Provider活动433→434等细节见安全[结算](../../artifacts/2026-10-24-goal-refresh-readiness/evidence.json)。用户正在使用的18571进程、页面和数据库未作为操作目标。

## 交付范围与限制

变更为ContinuousGoalControl现有背景准入、当前Goal架构、一份本记录、十张实图及安全结算和三处索引。未新增/运行UI自动化；本批为UI状态与交互修复，无新增非UI公开契约。Goal执行/变更未在本批重跑，首页布局与Sources展示未修改，不能把本批结果当作这些范围的新验收。整体自主迭代Goal保持active，继续只用单agent。

提交前执行当前package.json的docs:check，并审查实际差异。随后使用精确独立index只提交本批文件及三索引新增行，保留其他删除/修改/新增/暂存；正常fetch完成后merge当前upstream，审查完整待推集合并沿正常hooks push、fresh fetch核对。实际Git提交和推送结果由命令与提交历史记录，不预填成功状态。
