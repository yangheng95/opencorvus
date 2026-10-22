# 任务面板的真实空状态

## Recall

528单agent、不委托，后续人工单agent指令覆盖长期Goal旧Astra文字。527为progress：b1aa27752febc1ff074df54c28bdd705fdb31b1c空工具页打开焦点修复正常push/fresh HEAD=origin/main、0/0；12实图、两个零模型范围和原90表全部数据/原生资源闭合。下一线索是普通Main会话的Requirements空态显示分析pending。开局仅原.bun/和packages/opencorvus/bun/未跟踪，保留。

用户要求持续自主体验和修复，优先Sources/Rendering、Goal可理解性及默认布局，真实内置浏览器后提交推送。沿已应用computer-use/benchmark-debug-template，不新建开发/产品成员、Task/Mission/Goal或消息，不操作用户18571/真实库/窗口，不新增或运行UI自动化。已读527、526记录，当前07-panel Task scope契约，RequirementsPanel/Board/GoalGroup/ArchitectPanel/Feedback、空态CSS、i18n校验器/语言偏好、board store/source/Task选择、Session conversation公开hydrate、TaskBoard模型/workbench需求产物投影及Task状态定义；全仓搜定义/调用/同语义空态和相关测试，未发现本路径UI自动化。无委托反馈。

## 修改前根因与影响分析

527两张真实Requirements页（Main为合法普通work conversation而非Task）显示Requirements analysis pending，中文现键为“需求分析进行中…”。RequirementsPanel唯一caller是Board，hasData=false无条件使用该键；未读取真实执行活动。后端TaskBoard.requirements来自requirement_set产物内容，空列表是没有可展示需求，不能推定需求分析正在执行。Session conversation board只有kind/session/status/title/directory/selectedTaskID等，不投影Task需求；activeTaskID是当前selectedSource.kind=task的唯一选择事实。TaskScopePanelShell同时承载Requirements/Deliverables；后者未选择Task也描述this task，应在共同容器说明Task上下文。

旧关闭/打开焦点修复和Goal引导处理的是控件生命周期及持续目标，不涉及此空态文案/Task上下文。当前empty-hint--card的蓝点是通用静态装饰，不是运行事件，也不能当作运行证明。适用面是全部无Task的普通会话/Home/Mission选中场景，以及Task已有但需求空的面板；现有结构化需求列表、逐项接受/优先级、Goals事实、徽标数值保持原投影。公共API/schema/持久数据、LLM工具和执行流程不变。

只读闭合527-after全90表数据：requirement_set数0；原Task tsk_g00VYhrJxy00qIC54qvM有真实Task/Session/目录及task_completion_decision产物，但按protocol_event.task_id查task.completed未定位，不能据标题或产物名称宣称终态，须以公开Board真实状态为准。该0行查询是调查口径未匹配，不是新执行异常。未观察调度/队列/恢复/并发/终态收敛异常；若真实公开状态与持久事实冲突，立即横审Host/Task/Mission/Session occurrence全部入口/正常终态/重试重启/串并行/多项目。

## 实施前方案

1. before19021/after19023，实际/最大模型0，不复制auth/models，不Provider预检，不造需求数据/消息/业务owner。沿527成熟Source CLI开发/ui、413/446原生owned链、20分钟资源边界与180秒启动无活动观察；只读serialize已完整关闭527-after的90表156566原行/schema3/integrity及完整canonical。before用527正式main-BZBJ5jFW；after正式Node构建。
2. 内置浏览器2自有页，实际打开既有合法Main ses_-zURzTlJFzzacrP6FufN的Requirements/Deliverables，截图人工查看；再从真实侧栏进入原Task511，公开Board核对真实TaskID、状态和requirements数组，再查看相同面板。不可从query拼装假Source、插表、脚本改UI store或创建模型输出来补数据资格。当前源无非空需求，非空列表仅代码审查与原字段保持，不宣称独立实页通过。
3. 确证现象后补完整影响/调用合同再关闭before。唯一修复：TaskScopePanelShell按现有activeTaskID在未选Task时使用现有中性Feedback，说明从侧栏打开Task查看需求/交付和验收，徽标同一上下文显示；当前Task仍用原children。RequirementsPanel的空数据呈现改成中性的无可展示需求及用途说明，删除旧pending键，两语言同源更新；不增加执行状态推断、另一Task store、流程gate、重试或新API。全局Task切换进度和加载错误保持现有Main所有者，不建立第二加载流程。
4. after真实同组合复验普通会话/已有Task空需求与两语言；通过原Settings语言控件切换中文、最后恢复英语，只修改隔离UI偏好，不编辑用户或测试材料文件。沿现有组件样式，无新的视觉体系；纯UI不加测试。聚焦typecheck、catalog parity、正式Node build、docs/architecture，并真实截图复核。
5. 两原public shutdown200、原exec join/native physical/output/request/launcher/精确出生链闭合，自有页关闭；逐90表原行/字段/身份/时间/schema/canonical/source bytesmtime核对、模型0/最大0。原语言偏好通过UI恢复；未预设UI偏好文件字节相同。最小归档/三索引/实际秘密值扫描、范围commit/fresh fetch/merge/完整pending审查/正常push/fresh一致，长期Goal active，无分支/worktree/发布。

## before真实证据与实施约束补充

before19021/原75007/IAB126，当前main-BZBJ5jFW。01普通work conversation的Requirements实际显示pending且Main Not running；02无Task的Deliverables仍称this task。通过原Recents的Task511进入（初次项目scroll容器中有项目/Recents两份同名按钮，strict定位拒绝后读新AX，精确Recents成功，未计失败动作为成功）。03 Task页面明确Completed而Requirements仍pending，04 Task Deliverables原空态正常。4图均真实呈现人工查看。

公开GET task/<原ID>/board按原持久Task目录读取HTTP200，精确TaskID相同、status=completed、requirements=[]、goalsCount=0。没有重启/重新运行Task或改变其终态。与后端数组产物投影及前端无条件静态pending文案共同证明这是呈现错误；之前按protocol_event.task_id的0行不构成生命周期矛盾，当前状态以原公开checker返回为证据，不虚构task.completed原行。没有共享调度/恢复异常需要补造修复。

具体实现采用既有中性Feedback：共同Shell用activeTaskID为Task上下文，未选择Task时显示“未选择任务”、侧栏打开Task的指引，并用现有Continuous goal标题说明跨轮次工作入口；徽标同一上下文显示。Task选中仍使用原children，不新增影子Task投影、加载状态或第二请求；现有Main切换进度和加载错误继续拥有真实加载反馈。Requirements空列表用“暂无可展示的需求”及当前Task结构化需求/验收用途说明，不推定已运行/正在分析/失败。旧pending语言键删除，不留兼容副本；两语言同时更新。非空列表/Goal列表/接受事实/原计数完全沿原代码，当前零requirement_set数据不冒充非空实页。

## 实施与真实页面结果

Board共同Shell和RequirementsPanel按上述唯一方案实施，复用原Feedback和设计token，无新CSS/依赖；原ProgressiveList、RequirementItem/GoalList和后端契约保持。英文/中文各添加同样的5键、删除原pending键，净增4键。第一次patch因猜错中文邻接锚点被原工具校验整体拒绝，git diff证明无生产改动；读取实际“契约”后重跑原patch成功，没有覆盖用户更改。

原62029 Overlay typecheck与check:i18n均exit0（2语言/2533顶层键），原91900正式Node构建exit0，7314模块/58.92秒，main-BmEZdO0X.js与原main-CVd9TkT1.css；完整原构建stdout保留，既有use-client/静动态共同引用/大chunk提示保持。语言检查器仅验证catalog键/类型/placeholder结构，不是UI文案或DOM断言；未新增或运行UI自动化。

after19023/原30794/IAB127：05/06英文普通会话Requirements/Deliverables都显示No Task selected、真实Task打开指引和Continuous goal区分；07在原Settings/Appearance选中文；08/09同一普通会话的两面板正文、标题、导航和可访问名称均使用中文，显示未选择任务及「持续目标」，模型/用户原文保持。中性Feedback文字完整可读，未复用原蓝点pending卡片，也没有引入另一套样式。

实际Recents打开同一Task后，10中文需求面板显示暂无可展示的需求，Main仍已完成；11 Task交付面板保留原任务说明及真实空列表。通过原Settings外观控件恢复English（12），返回同一Task的13显示No requirements to display及用途说明，Main Completed。原13张实图全部实际呈现并人工查看。恢复语言只触及隔离UI偏好，没有保存测试文件或修改Source/消息；不据语言控件推断偏好文件bytes/mtime相同。

after公开Board再次HTTP200，精确TaskID/status completed/requirements[]/goalsCount0与before相同。当前源无非空requirements/Goals，本轮不声称非空卡片、验收列表、真实新流/全部Rendering、Home/Mission逐页或Native WebView2实页通过；Task选择进度和失败仍由原Main反馈拥有。当前TaskScope共同容器未新增Architecture页面或后台读取。

## 资源、原数据与交付

before75007/after30794原exec均join exit0，公开shutdown200，原native physical/output/request/launcher与精确host/target dead_or_reused完整闭合；126/127关闭。两scope模型实际0/最大0/exhausted false，无auth/models副本，无新Session/消息/Task/Mission/Goal或业务文件编辑；语言与工作区UI偏好按真实交互持久化。两轮preserve checker逐90表156566原行/全部字段/身份/时间差异0，表计数及Provider activity391→391保持；schema3实际对象/integrity、完整canonical/source bytesmtime保持。用户18571和真实库/窗口未操作，没有schema/版本演进。

最小归档保存13图、真实公开Board数据、语言/上下文只读观测、原构建和完整物理/数据结算；原runtime error按实际小写level保留，不报告全console clean。三索引、docs/architecture/实际秘密值扫描与范围commit/fresh fetch/merge/完整pending审查/正常push/fresh一致按实际结果交付，长期Goal active。

交付检查：docs:check345操作/26组、architecture-index20当前文档及git diff --check均exit0；原类型/catalog/正式构建已按上述原执行通过。before/after各19条原runtime error保留：7条project.open、7条server/400 ProviderModelNotFoundError、3条project-load和2条模型投影UI诊断，均对应本轮明确无catalog的只读初始化，不报成凭据或数据库失败。实际秘密值扫描覆盖4个本轮UI源码/catalog、架构/记录/三索引与全部归档及6个解压payload，0实际凭据值匹配，原凭据bytesmtime保持。
