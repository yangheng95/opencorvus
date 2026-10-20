# 首页 Goal 的确认边界

## Recall

持续单开发agent自主迭代，不使用子agent。471已交付45f8be8f162f04e1dc823687a64d1e6a713fee23，原push12245 exit0，全部正常hook通过，fresh fetch确认HEAD=origin/main；当前只有原.bun/与packages/opencorvus/bun/未跟踪。公共成员入口中英名称已修，8张新正式构建实图复核Sources、首页Goal说明/草稿。自有18789原27569 exit0、公开shutdown200，native/provider/source-reader/output/request/launcher完整结算；2/最多4实际Sol全部200/stream/EOF，runtime/private完整auth/models对退休，源未写入/refresh/exchange。完整137 Project/185 Session/schema3保留。

新实际缺陷：从全局首页点击创建目标，尚未填写/确认，就创建了匿名Project和Work Session ses_-zURPXrRrzzcvguIfGye。关闭表单后它仍出现在列表；公开GET Goal为200/null，真实Message数0。保留了原记录和截图，不以删除补救。用户原要求Goal易发现、会使用、默认页布局合理，同时要求实际浏览器验收、修复、提交推送；单agent和数据保留约束持续适用。沿用benchmark-debug-template/CUA已选IAB2，只用自有隔离服务，不操作原用户18571。

## 修改前根因与横向影响分析

已读461草稿移交Recall/实施/失败保留合同、471新实图/GET/SQLite事实，当前Goal architecture及main/App/ContinuousGoalControl全部GoalFormRequest/onStartGoal定义与调用，composerDraftKey/moveComposerDraftToNewSession、conversation-session创建/选择、SideChat ContinuousGoalControl、连续Goal现有HTTP service/route/store/controller。全仓只有main→App的一个Home创建handler；App先await main.onStartGoal，main立即调用project/global canonical conversation factory并选择，返回真实Session/authority/epoch，selected owner control才打开目标表单。关闭只关闭表单，不能倒转已提交会话/Project。此前461修的是创建后草稿移交，明确失败时保留真实已创建会话，未改变确认边界。问题是UI把“打开表单”当成“授权创建会话”，不是Goal调度、持久化损坏或需要删除旧数据。

公共路径：Home global/project与Code/Work均经同一handler；选中Chat/Task/Mission及SideChat的Goal CRUD仍作用于已有精确owner，不需要Home创建。GoalFormRequest只在这三个UI文件内部使用，现无外部协议。continuous-goal服务现有POST requestID已幂等，现有controller产生真实goal-controller输入并全流式执行；本轮不修改API/SDK、LLM工具、调度/队列/occurrence或DB格式，schema保持3。没有新的运行时唤醒异常证据。Delivery Slice的GoalDialogHost是另一现有能力，排除本次修改。

当前continuous-goal架构明确记录旧行为“Closing the form retains the empty Chat”；它是旧路径的事实合同，本次按用户授权的体验迭代替换此确认设计，并同步当前架构，不保留双行为。461保留已提交失败会话的原则继续适用：只有确认后才提交创建；已确认创建过程失败仍保留真实已提交会话与移交草稿，不能用取消时删除模拟事务。Home表单UI源变化可退休表单；原Home提交Promise按同一owner结算busy，不能因自身Workspace admission更换epoch后留永久busy。帮助入口在提交期间使用相同busy状态。

方案选择：Home直接使用现有ContinuousGoalControl唯一表单，先收集和验证目标/可选预算；“如何使用”单独about模式。只有表单确认才进入原canonical会话创建/选择，再把已经确认的原input和同一requestID通过原GoalFormRequest移交给选中owner，沿现有Goal POST提交一次。目标请求仍是真实用户授权，不能合成Message、伪造Session ID、添加server旁路或复制另一Goal实现。已有owner的手动创建、暂停、预算、完成逻辑保持同一mutate。

Home表单读取原composer单一草稿，打开/关闭不搬运；确认后的草稿移动仍在原factory receipt→select边界。pending附件/quotation提示复用现有规则，不自动发送。表单打开捕获API authority/选择epoch/草稿key，提交前复核；main在原Workspace admission前核对原owner，不能把旧表单提交到新连接/项目。外部导航/连接替换退休旧Home表单。原创建过程失败继续由既有诊断/选择所有权处理；确认后已经创建的真实会话/已移交草稿保留，不回滚/删除，Goal失败仍在精确owner表单中保留字段与原requestID供重试。不引入持久Goal草稿、第二配置源、兼容分支或自动业务重试。

## 实施与验收

1. 扩展内部GoalFormRequest为携带已确认input；新增仅UI的GoalLaunchContext（原authority/selectionEpoch/composerDraftKey）。删除原打开后再手动提交的旧Home握手，全部唯一调用点同步。App把原source epoch/key/pending上下文传入Home control。Home按钮打开create，帮助打开about；明确提示确认后新建对话。选中control核对真实Session/authority/epoch后使用同一input/requestID自动进入原mutate。更新中英文、当前Goal架构与三索引。
2. 禁止UI自动化/源码文案断言/组件/DOM/截图测试；本次纯UI不新增测试。编译/类型/语言目录检查仅补充。正式build:overlay --skip-tauri，新冻结bundle由新自有native18791提供，不用独立Vite。原137/185/schema3完整readonly快照先保存，全部历史保留，凭据+完整models成对预检；整批/本scope最多10个实际gpt-6.1-sol流，不延长scope，20分钟只作自有原生安全寿命。
3. CUA实际全局/项目Home输入草稿→打开目标表单→关闭→原首页/原草稿仍可编辑，实际截图和原生HTTP/readonly观察记录真实变化（不写“没有创建”的UI自动断言）。确认创建两个不同有限Goal，分别全局/项目，目标要求只输出GOAL472GLOBALREADY/GOAL472PROJECTREADY，turnBudget1、tokenBudget100000。经真实页面提交，在原生产controller/Sol流中完成，核对真实目标/Session/Project/已接受输入/requestID/完成回复/预算状态；不能用fixture或静态文案冒充。原Task/Mission/SideChat路径按实际覆盖明确边界，不无目标扩大业务。
4. 实际中英文页面、草稿预填/取消/修改确认和预算说明截图人工查看；若失败修真实根因，重新正式构建和新scope时先完整结算原scope并从既定总预算扣除实际数。正常原生shutdown/原句柄join/provider读流EOF/output/request结算后退休runtime/private完整复制对，源metadata保持，所有原Project/Session身份/目录/归属和schema3核验。
5. 文档检查/必要编译和正常push hook，范围提交，fresh fetch/merge、完整upstream..HEAD审阅、正常push/fresh fetch。不开branch/worktree/PR/tag/Release。配置性能与未采样Rendering仍未完成，整体goal active。

## 实施与实际资格

Home使用原ContinuousGoalControl表单：create/about分开，打开create只捕获原API revision/选择epoch/composer key和原草稿；外部scope变更关闭过期表单，已接受Home Promise按原owner结算busy，帮助与主入口使用相同pending状态。App/Main的唯一Home handler只在确认时收到原input和launch context，先复核原上下文再进入原Workspace admission/factory。GoalFormRequest现在携带已确认input，选中control设置字段并将原requestID绑定原mutate；旧“先创建再让用户确认”的Home握手删除，没有另建Goal POST、备用sessionID或持久Goal草稿。Home pending附件/quotation提示沿461合同，确认后的文本搬运/消费及真实失败会话保留不变。

正式build原55931 exit0，Vite50.25s；最终overlay typecheck原91508 exit0；check:i18n 2 locales/2521 keys。18791使用全新冻结bundle。原137/185/schema3 readonly基线保留，preflight后138/186。全局Work原首页输入“全局草稿472：保留这段输入。”→表单预填/关闭，原launcher URL及输入保持；实际前后均138/186。重新打开、修改成果/100000令牌/1轮并确认，真实Goal pev_g0VYaXcT300osY85ityb、Session ses_-zURPSNu3zz6SIH4nxQ7自动回复GOAL472GLOBALREADY，33,733 tokens、1/1、budget_limited。

原project选择Code并切中文，输入“项目草稿472：取消后继续编辑。”→预填/关闭，原项目首页和输入保持；实际前后均139/187。修改成果并确认后仍归原Project prj_hSQinOa1MIVoNEeARpn5，Goal pev_g0VYaYkAL00R3JWBJBHG、Chat Session ses_-zURPRFwZzzTe6qazRhB真实回复GOAL472PROJECTREADY，37,196令牌、1/1、budget_limited。两个普通文本草稿在成功消费后输入框为空；没有用取消时创建/删除补偿。Project URL实际reload、既有Goal详情表单和原英文恢复均人工查看。一次UI索引在输入后变化导致误打开帮助，按新AX重新定位后打开真正create；该图片明确保存为帮助图，不伪称表单。

后端observer最初误读Goal.owner.projectID，实际schema把projectID放顶层；修正checker、读取同一个已完成Goal后通过，未重跑模型。实际读取核对精确Goal/Session/Project、原budget/input、真实goal-controller author及assistant parent/model/finish/实际正文；只读持久化creation事件绑定同一request_id/input、真实owner与user author。没有把fixture或DOM文本当作端到端。两个Goal是有限回复已完成且预算停止，不称Goal状态complete。

共10张1280×720实图人工查看。[产物入口](../../artifacts/2026-10-20-goal-confirmation-boundary/README.md)保存真实Goal结果、creation/continuation、取消观察和完整结算。4/最多10实际Sol（预检memory/chat、目标work/chat）全部200/stream/source-reader EOF；原81175 exit0，公开shutdown200，native/physical/output/request/launcher完整结算。runtime/private完整auth/models对在实际秘密值扫描后退休，源metadata未变，无refresh/exchange；自有tab24关闭，原用户18571未操作。

最终readonly139 Project/188 Session/schema3，原137/185的全部ID/目录/归属保持，包括471真实空会话。无新schema或后端API变化。本批未新执行Task/Mission/SideChat、附件/quotation、连接替换/失败或流中Sources/Rendering，保留明确边界，不凭共享代码或静态截图扩称。整体goal继续active，后续保持原完整配置性能和未采样场景范围。
