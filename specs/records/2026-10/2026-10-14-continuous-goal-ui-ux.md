# 持续目标 UI/UX 补齐

## Recall

- 用户要求持续目标的“UI/UX也要全面跟上”，随后明确“不要使用子agent”。现由主agent独立调查、实现、真实页面交互、截图复核和Git交付，不继续委托。此前独立审计已产生的运行准备与证据由主agent接管。
- 持续目标后端及Task/Mission崩溃恢复已交付。用户已授权复用原worktree及现有Provider凭据/模型目录做隔离验收。本轮复用`C:/Users/hengu/.codex/worktrees/continuous-goal-mode/opencorvus`，开始clean，拉取合并至`c641a01b9`。主工作区含其他任务改动，实施与运行在原worktree，结束时保留其他改动并收敛回main。
- 已读AGENTS.md、continuous-goal当前架构、07-panel与当前数据/会话定义、前轮Recall、UI基础组件和computer-use指导。已全仓搜索continuous-goal SDK/HTTP/事件、Composer/主会话/SideChat入口、owner身份、预算合并与错误合同。当前overlay只把三个goal事件消费为noop，没有实际创建/控制/状态UI；现有GoalGroup/GoalDialogHost属于交付切片，不能复用其语义。
- 已读App共用会话区域、board/work-ledger/conversation-session/API authority/选中生命周期、Dialog/TextField/Button/Checkbox/i18n与样式tokens。Task使用Task ID，Chat/Mission使用canonical Session ID；Mission logical ID不可替代。Mission draft必须先启动。预算只约束新自动轮次，已接收执行可继续结算；设置后预算可提高/调整，当前API不提供清除已设置预算。
- 先前独立审计反馈与代码复核一致：共享主会话区域覆盖三模式，SideChat需独立会话身份；不要依赖usage事件必然到达owner SSE。UI只持有当前HTTP投影与表单草稿，不建立第二份目标状态。
- 本轮真实请求硬上限事先固定为96，包含preflight和后续手工验收，跨服务重启累计。runtime1的2请求因检查器在Chat完成时要求辅助Memory也已EOF而误失败，原失败保留、进程/端口/配对副本已清理；runtime2按剩余94开始，精确Chat reader+所有辅助结算后成功提供正式`/ui`，启动时累计4请求，最终累计24请求。不是产品或凭据失败。详见同轮artifact runtime-plan/manifest/preflight/settlement。

## 问题深度与影响

可观察现象：真实桌面Chat页只有会话状态、模型、权限和输入控件，缺少目标入口、状态与预算；即使模型已创建目标，用户无法直接辨认、暂停或恢复。直接触发是后端已提供执行意图，但overlay未消费对应读取/修改接口。根因是UI交付缺失，不是新模式路由或调度故障；过去真实模型/恢复验收不能证明可用的操作体验。

影响面为overlay共用组件、主会话/SideChat挂载、类型化API适配、en-US/zh-CN、现有样式入口、架构与本记录。后端目标事实、数据库格式、调度、权限、发布与版本不变；不会创建第四类会话、合成消息、假owner或目标状态缓存。若真实页面发现新的共享调度/恢复问题，须按AGENTS横审再修复。暂未知：三模式真实视觉及控件在各状态下的最终布局，实施后逐项验证。

## 实施方案

1. 新增一个共享持续目标状态条和详情/设置Dialog，挂在App的共用会话区域、SideChat真实已选Session区域。通过当前work-ledger/board的确切owner及directory读取现有`/continuous-goal/{kind}/{ownerID}`；空首页说明打开/开始会话后启用，Mission未启动时保留明确错误/引导。既有交付Goal入口保持其原语义。
2. 当前状态条包含目标标题/正文摘要、active/paused/blocked/complete/budget_limited状态、累计tokens和自动轮次、暂停/恢复与设置入口。详情展示完整原文、最新真实原因/证据、本地化更新时间、预算用量与边界。进行中、暂停及阻塞有不同提示；完成后可创建新目标，旧目标不被重写。
3. 创建表单含不可空的目标与可选正整数token/轮次预算，不强制默认额度。修改预算保留累计用量和目标内容，不能清除已设置预算；暂停/阻塞状态可选择明确保存并恢复。标记完成要求用户填写实际完成依据。恢复/暂停是显式用户动作，停止当前执行仍由现有Stop负责。
4. 单一类型化HTTP适配复用生成SDK类型、apiJson、directoryScopedPath与ApiAuthority。所有请求绑定owner/项目/服务authority；Dialog和异步操作在切换owner时退役。当前投影通过有限5秒可见页面刷新及focus/手工刷新读取，mutation后立即重读。定时刷新只读数据，不驱动后端调度。失败显示本地化摘要和完整原错误；revision冲突重新展示当前事实，不能自动重放到新owner。requestID绑定同一提交内容，重试同一操作不制造第二次意图。
5. 使用已有Dialog/TextField/Button/Checkbox/Icon、设计token和布局密度。所有产品文案、状态、提示、错误摘要、无障碍名称、数字/日期覆盖中英文；目标/模型原因原文保留。目标条保持紧凑，长正文在详情中可完整读取。

## 验收

- 禁止新增或运行UI自动化/组件快照/源码文案断言。已检索路径尚未发现对应持续目标UI自动化；新UI仅通过真实交互、截图和人工复核验收。
- 正式私有开发服务`http://127.0.0.1:<owned-port>/ui/`，由已有隔离runtime/正式serve/startup/RealProviderAudit启动；不独立启动Vite。已授权auth/models配对复制、精确`openai/gpt-6.1-sol`投影、真实流式preflight及累计请求额度分别检查。只控制本任务持有的私有服务，通过控制文件restart/finish，保留DB与错误证据，最终清理配对副本和进程/端口。
- 已查看before真实Chat截图（desktop1280×900）。因内嵌浏览器默认窄面板不能代表仓库要求的桌面布局，验收使用临时desktop视口，完成后恢复。改动后对Chat、Task、Mission实际进入并截图；覆盖创建、暂停/恢复、预算限制与调整、阻塞原因、完成依据、新目标、刷新重开、跨owner选择及中英文。有限说明请求禁止外部网站、部署、凭据、权限变更和额外任务；必要Task创建限本隔离验收目标。
- API适配的非UI合同有聚焦正向测试，只证明请求/输出/错误和authority；真实UI及真实Provider证据另列，不能以mock/typecheck/build代替。完成overlay typecheck、build、i18n/CSS token检查、文档检查及正常push hook。
- 新增记录/artifact同步更新specs根、月度和artifact索引。结束前提交范围明确的变更，fetch+merge upstream、检查待推送集合后正常push，收敛主交付来源并保留其他任务改动。

## 当前状态

方案、实施、证据归档与本轮真实UI/UX验收已完成，代码和证据已独立提交。真实页面的冻结基线与后续Git集成验证分别记录；结果见文末，最终推送及工作区收敛状态由交付说明报告。

## 首轮真实页面发现与修订

Chat经真实UI创建目标后已接受2轮、累计62,953 tokens并收敛为预算限制。原截图`chat-active-en.jpg`实际记录的是该终态，纠正为`chat-budget-before-source-fix-en.jpg`，不能将其标作进行中。

可观察问题：两条真实goal-controller消息被折叠成“Handoff context”，归入Chat助手卡片，作者不明确。直接触发是transport-protocol的`isDelegatedContextMessage`将全部非main、非human、Provider user-role消息判作代理交接。数据根因是把控制器这一真实编排参与者误当作收到的委托上下文；Task main channel的既有修复不覆盖Chat/Mission非main channel。全仓搜索覆盖conversation view、tree-writer的live/part-first/hydrate/regroup、subagent-conversation、ChatBubble及SideChat投影，确认共享定义是唯一显示分类来源。SideMessage另丢弃author并按Provider role强制human，扩大了同一问题。

修订方案：在共享分类中精确识别真实`goal-controller` author，使其作为独立参与者沿现有user展示stage显示，执行role/channel/source不变；保留其他委托上下文的当前语义。ChatBubble用本地化“持续目标控制器”显示该已知作者，同时保留真实作者身份；SideChat保留author并遵循共享stage。新增transport正向合同验证三模式相关channel的明确stage输出，不新增UI自动化。真实重载与新自动轮次截图验证历史及live投影。没有调度、队列、重试或持久化格式变更。

创建Dialog首轮截图在桌面仍仅380px宽，两列预算说明过度折行。采用现有Dialog wide primitive改善正文和预算阅读；修改后重拍确认。

复核Solid Resource切换source时会保留旧值到新请求完成。读取投影返回同一次请求的source key与数据，渲染只接受当前key；这是单一HTTP结果的归属标记，不新增目标缓存。避免跨owner加载期间暂显另一目标。现有authority检查仍约束服务切换及写入。

中文详情截图发现Badge在flex-column默认伸展为整行，削弱原有小状态标签层级；将其交叉轴对齐到start，复用既有Badge样式。Task root Session原始message GET为空不是执行故障：正式Task conversation包含orchestrator子Session与真实准备/goal-controller轮次，已复核生产投影、9条transcript和Provider ledger。证据采集改为读取Task正式conversation，不将root Session空数组误报为未运行。Task已真实创建、调整预算、暂停已接收第2轮并结算，之后从暂停恢复。

复核预算与暂停/阻塞的组合：这两种显式状态会保留已耗尽预算，不能仅依据status=budget_limited决定恢复入口。暂停/阻塞且用量达到任一已设置上限时也应“调整并恢复”，进入同一预算详情表单；仍保留原始状态和证据，不能直接触发一个没有剩余额度的active revision。

Mission真实公开API设置blocked前置条件，在已打开预算草稿中提交旧revision，UI显示真实409、保留150000/2草稿；显式“载入当前状态，保留草稿”后再核对。不是模型发现外部阻塞。随后保存预算并取消恢复复选框，状态保持blocked，但reason被通用“用户调整预算”覆盖。根因在UI save每次提供新的reason，API忠实投影最新revision；需在status保持paused/blocked时沿用该revision的原reason，只有显式恢复/完成才改变原因。该改动不修改后端revision、历史或schema。修改后重新执行公开前置条件与真实UI保存，采集HTTP reason保持证据及截图。

原因保留复测通过：英文深色UI将Mission预算调整为200000/3，取消恢复后仍为blocked，公开HTTP与截图保留同一完整前置原因。打开右侧SideChat真实桌面分栏后，主栏单行状态条的目标摘要几乎被挤掉；根因是固定不换行的usage/control占据狭窄主栏。沿用现有`chat-workbench` container与760px桌面分栏断点，窄主栏依次显示状态、目标摘要、累计用量及操作，保留全部控件；不扩展为移动端验收。SideChat已有compact布局。重建后重新呈现分栏与真实侧聊目标。

SideChat通过真实UI创建、发送准备输入并设置自己的Chat目标，1轮实际回复“侧聊目标持续中”，32,451令牌；主Mission保持blocked、83,487令牌与原原因。英文详情的“1 automatic turns accepted”改为不依赖单复数的“Automatic turns accepted: 1”；compact截图中Details单独落行，将用量独占一行，预算调整及详情操作保持同一行。最后重建后在同一真实预算状态复核，再完成两目标。

最终本地化复核发现保存反馈与本地校验signal缓存了调用时翻译后的文本。同一owner保持选中、切换语言时，正文控件订阅locale，但这些signal不会重新翻译。改为保存语义文案键、渲染时通过当前t翻译；API原错误和用户/模型原原因仍保留原文。没有目标事实或协议变化。真实语言切换在同一目标的新保存反馈仍可见时复核。

## 首轮最终验收结果

由主agent独立完成；未继续使用子agent。正式隔离开发`/ui`桌面1280×900已真实呈现并人工查看。6个目标、10个自动轮次全部由真实Provider执行，并通过UI填写依据完成。Provider总计24请求（含runtime1原检查器失败的2请求），runtime2的22请求均实际流式EOF，模型全部精确为`gpt-6.1-sol`，HTTP全部200，固定96请求额度未补充。7个正式服务generation全部退出，端口已关闭，auth/models配对副本已删除，浏览器临时页关闭、视口恢复。

| 范围 | 真实结果 | 主要证据 |
| --- | --- | --- |
| Chat原目标 | UI创建、2轮、62,953令牌，完成依据保留；历史控制器作者独立可见 | chat-complete-fact.json、chat-complete-zh.jpg |
| Chat新目标 | 从完成详情创建新identity，1轮、31,775令牌，未设置令牌预算，完成 | chat-new-goal-complete-fact.json |
| Task | 3轮、309,114令牌；创建/预算校验/提高预算/暂停已接收第2轮并结算/显式恢复/软预算/完成 | task-paused-fact.json、task-complete-fact.json、task-complete-details-final-zh.jpg |
| Mission原目标 | 2轮、83,487令牌；公开API前置blocked、真实409草稿保留、显式review、恢复、保持blocked调整预算且保留原因、完成 | mission-blocked-precondition.json、mission-reason-retained-fact.json、mission-complete-fact.json、mission-conflict-zh.jpg |
| SideChat | 自己的Chat Session，1轮、32,451令牌；主Mission状态/用量独立，控制器真实作者、创建/预算/完成、桌面分栏重开 | sidechat-complete-fact.json、sidechat-dock-final-dark-en.jpg |
| 实时语言 | Mission新目标1轮、42,451令牌，英文完成反馈在同一owner保持选中时实际切换为中文 | mission-locale-complete-fact.json、mission-live-locale-feedback-zh.jpg |

中英文、浅色/深色、全宽/桌面分栏、空首页、未启动Mission草稿说明、键盘Escape关闭、跨owner选择及重开已人工检查。快速在关闭过渡内点击Task未生效，关闭完成后正常重开；源码审计确认新草稿清空selectedSource、三种正式入口以当前source判定admission，未发现需要修改会话选择逻辑的证据。过渡截图与选择加载截图按实际状态命名，不能作为最终画面证据。私有服务热重建后旧页面的懒加载chunk请求失败已通过加载新构建页面处理；原开发日志保留，没有将工具/旧页错误包装为产品验收通过。

[公开HTTP检查器](../../artifacts/2026-10-14-continuous-goal-ui-ux/verify-live-state.ts)重新读取4个真实owner的当前目标与正式conversation，验证complete、计数、真实goal-controller作者与明确user stage、实际回复结算，并核对6个完成identity、暂停结算及原阻塞原因。结果live-acceptance.json为passed。它验证后端公共投影，不能替代上述截图和手工视觉复核。没有新增或运行UI自动化测试。

非UI聚焦检查：Goal HTTP适配8测试/15断言；共享作者投影8测试/28断言。overlay和根目录8个package类型检查、最终build、2语言2284键、CSS tokens、docs:check通过。初次服务合同测试的query/path误期望、i18n脚本错误cwd及最初preflight辅助Reader检查误判已修复检查工具/用法并复跑，原失败证据保留。CLI build现有大chunk/use-client提示不影响构建成功，不以这些检查替代视觉证据。

完整audit共有445原始文件，按8个目录保留内容一致的gzip归档；原文件保留本地且不入提交。日志gzip保留原始字节，归档仅用于证据完整性，不以源码或图片摘要代替功能验收。对文本与解压归档执行已知凭据扫描，通过。未变更持久化schema、产品版本或发布渠道；本轮交付为代码、文档及真实运行证据。

## Git集成验证

实现与完整视觉/真实Provider验收使用冻结基线`c641a01b9410d91d41aa2b0e48b0dac0767cd087`及本轮UI改动，功能提交为`740db2638`。随后以普通merge合入远端`461d9856a`，生成`c09dd8d7b`；三份spec索引冲突保留双方条目。远端带入Provider连接生命周期、compaction工作上下文及会话阅读锚点等交付。16个Goal HTTP/作者合同测试仍通过，i18n为2语言2286键，docs:check与architecture-index通过，overlay正式build通过。

首次集成typecheck报告overlay的`ProviderConnectionTestResult`无法从SDK导入。全仓定义与package exports复核确认当前生成源码已有类型，但本地SDK的types出口指向旧`dist/index.d.ts`。在检查清理目标限定于SDK package后执行其现有build，生成产物没有造成tracked源码差异；重跑原根目录typecheck，8个package全部通过。此为本地构建产物更新，不新增源码兼容层；初次错误由工具输出记录，最终构建及复跑原始日志归档。

主工作区另有已授权并独立提交的`b3fb10aad`事件投递批次改善，其记录明确保留未达到5秒复制指标的边界，不能算作本轮Goal功能或视觉结果。为保留主交付来源，以普通merge生成`405e9f74b`，只在三份索引冲突中保留双方条目。在隔离worktree补跑该提交涉及的Bus投递和Session fork原子性合同，16测试/51断言通过；再次运行原根目录typecheck，8个package通过。未纳入主工作区其他未提交的Question、Provider、compaction或Sources改动。

[集成原始日志](../../artifacts/2026-10-14-continuous-goal-ui-ux/integration/)与页面/真实Provider证据具有不同用途：前者证明合入代码后的合同、类型和构建，后者证明已实际呈现并人工查看的目标操作。没有把静态检查替代视觉验收，也没有运行UI自动化。收敛主工作区只允许对精确三份重叠索引保存/复核原差异后合并，再完整恢复其他任务原文；其余dirty文件保留，正常pre-push检查不可绕过。

## 当前提交补验方案与Recall

持续Goal继续要求验收至找不出新问题；执行方式遵循用户最新明确的“不要使用子agent”，主agent独立完成，不恢复旧的Sol子agent委托。上一轮为progress：真实页面发现的问题已修复，`548660a8b`已推送main且收敛主工作区，原35个dirty tracked文件与96个untracked文件保留核验通过。新一轮开始worktree clean，主工作区HEAD相同但其他任务仍在修改，继续隔离实施。

已重读本Recall、当前continuous-goal架构、共享控制组件、公共HTTP采集/检查器、私有运行器以及benchmark-debug-template技能。全仓聚焦检索确认当前6组Goal后台合同覆盖原子状态/预算/Project隔离、模型工具、迟到计量、多进程与流式重启恢复；这些局部或受控Provider合同不能代替真实模型或页面。原完整视觉验收在`c641a01b9`加本轮UI源码；其后合入共享Bus投递批次修复。当前已推送代码的真实闭环是本轮需要补强的证据，尚不能仅凭上轮截图证明。

验收输入输出与边界：在`548660a8b`复用已审阅的正式serve私有运行器，新增runtime-3，沿用原已授权auth/models配对、精确`openai/gpt-6.1-sol`以及跨runtime固定96请求总上限。此前24请求，剩余72；绝不重置额度。启动前分别核对模型投影、凭据可用及实际流请求模型。只控制新建私有页面和所持服务，不操作用户进程。

运行计划：通过真实桌面`/ui`分别创建Chat、Task、Mission目标，有限两轮预算，实际确认自动轮次、可见原始controller与累计计量；Task在已接收轮次后暂停、正常结算、显式恢复；读取每个确切公共owner验证预算终态，填写真实完成依据。再正常冷重启同一私有DB，复读三种owner的完整目标身份、revision、用量及已接收轮次，并人工重新查看页面。已有上一轮409、blocked原因保持、SideChat作用域与双语/主题/分栏截图仍作为那些具体场景的证据，不虚构本轮再次覆盖。发生新问题则记录触发、控制/数据流根因、影响面、修复与原验收复跑；发现调度/恢复异常立即横审全部生产入口和occurrence。

同时使用仓库隔离test runner执行6组Goal后台聚焦合同；不运行全量test或UI自动化。运行器以真实活动变化更新180秒无活动超时，HTTP/启动/清理操作30秒，长等待只轮询本轮活句柄且每次不超过60秒。成功标准为三种owner实际两轮结算、完成依据与计量由实时公开HTTP证明、冷重启投影一致、匹配模型的真实流式EOF、截图实际呈现并人工查看、全部后台合同通过、私有进程/端口/配对凭据退休且没有未解释异常。最后归档更新已有证据索引、正常提交/push并保留其他任务改动。

## 当前提交补验结果

runtime-3实际基线为`548660a8b882b4e481014a7e8daee7faab5bc181`，主agent独立完成，无新委托。三种Goal均通过真实UI创建、每种实际2轮、填写真实依据完成：Chat 62,978令牌；Task 204,414令牌；Mission 83,481令牌。Task第1轮在显式暂停之后完成，保留101,491令牌，之后通过UI恢复并完成第2轮。公共检查器对Task以实际完成的`read_task_message`输入`message_id`精确关联各controller，再验证回复完成和`no_action`已结算；Chat/Mission通过真实parentID关联。不是仅凭模型自述或目标标题判断执行。

首次本轮采集脚本误把Task创建正确的202 Accepted响应当作200失败。产品实际已经接受`tsk_g00VXyL1hX00nCG95WjT`，通过该确切ID读取公开详情和conversation保存owner，而未重复创建Task。检查器按生产route合同修正Task创建预期为202，Mission为200；当前helper保留显式取证命令。原观察见[检查器误判记录](../../artifacts/2026-10-14-continuous-goal-ui-ux/runtime-3/seed-checker-failure.json)，不是产品失败或凭据问题。

[重启前](../../artifacts/2026-10-14-continuous-goal-ui-ux/runtime-3/before-restart.json)与[冷重启后](../../artifacts/2026-10-14-continuous-goal-ui-ux/runtime-3/after-restart.json)均为passed。generation1/2保持同一个私有DB，重新公开读取三个完整Goal对象，identity、revision、status、reason、budget、tokensUsed和turnsAccepted均精确一致；三种正式conversation仍保留2个真实controller及明确独立stage，每个实际回复已结算。重开页面后逐一人工查看Chat、Task、Mission截图，完成依据和原计量保留。加载过渡截图单独命名，不能冒充最终图。

通过仓库隔离test runner，持续目标的5组后台合同合计36测试/196断言通过：store/HTTP/Tool 13/60，独立作用域与计量15/119，多进程1/4，真实生产路径受控流式重启1/4，crash checker选择与活动合同6/9。原计划第6组`goal-workload-coverage-contract`对应既有Delivery Goal Workload而非持续目标，实际也通过33/95，但不计入持续目标指标或真实Provider资格。没有UI自动化。

runtime-3新增14条真实`gpt-6.1-sol`请求，均streaming、HTTP200、实际EOF；连同runtime1/2累计38/96，额度没有补充。冷重启后的generation2真实请求为0，累计数维持38。88852、89776两个自有正式服务均SIGTERM结算，7878端口关闭，auth/models配对副本移除，cleanupErrors为空；临时tab关闭、桌面viewport恢复。全部原始audit和日志归档并再次凭据扫描。没有发现新的产品故障、调度/恢复异常或未解释终态，因此本轮不修改已验收生产代码。

证据打包工具同步扩展为按原始runtime序列核对累计账本及额度。首版误要求初始runtime1也提供后续才加入的`previousRunRequests`字段，实际原初始结果没有该字段；改为明确验证首轮编号1、所有轮次连续、后续轮次carry值等于前轮总数，不回写或伪造原初始记录。真实账本38请求、36条成功验收EOF，10个完整audit档/668原始文件，文本及解压档凭据扫描通过。此为证据工具校准，与产品行为无关。
