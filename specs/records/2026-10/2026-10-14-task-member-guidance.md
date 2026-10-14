# Task成员指导与侧栏流中恢复

## Recall

持续目标为自主体验UI（User Interface，用户界面）/UX（User Experience，用户体验）、功能与缺陷，重点Sources及成员侧栏Rendering。最新人工约束只允许root单agent开发，不执行旧goal的Astra并行要求。用户已授权实际gpt-6.1-sol端到端验收及既有OpenAI凭据使用；完整auth/models配对、真实流式请求、原生进程收尾仍为必要证据。schema v1已交付，本轮复用412当前基线，不再清空旧库或给未版本化库强行标版本。

上一轮412为progress：50cf35a83baa9467e59aa91f541fc0d53dd8756b修复普通Session成员误显示Task指导入口；11张原图、12条Sol流、原8消息/来源保持、新2206字元回复及两个正常Native scope。当前Task根存在时的显示条件和原发送端未改，但没有新增Task实页资格。流中All agents返回可读；关闭面板后一次locator在派发前超时，再打开已完成，所以完整流中关开和不同成员切换未验证。初始旧库拒绝、工具路径/捕获错误和错误页27受浏览器策略限制均保留。原正常push24250 joinac0b17 exit0，fresh fetch/merge后的pending唯一50cf35，ls-remote精确50cf35；本轮承接其实际交付原件。

当前工作区有其他permission/Session、相关测试、overlay投影测试清理和spec索引改动，全部保留。本轮只当前分支，自己的修改范围commit，fresh fetch/merge、完整pending审阅与正常push，不绕hook、不force/rebase、不创建branch/worktree或发布。

## 已读资料、现象与影响分析

已重读412 Recall、当前task-control-plane、03-control的协调请求/响应/action/终态契约及07-panel-reactivity；当前workerSteerTargetSessionID、Card/ChatBubble三个调用点、OperatorSteerBox、sendOperatorSteer、Task公开operator-steer路由、Task根选择器；真实Task创建CLI脚本和成熟Native包装器的Task监测分支。全仓workerSteerTargetSessionID及operator-steer搜索定位了唯一共享显示helper、唯一前端sender与后台Task协调路由；没有第二种发送方式。UI测试不运行；其他任务正在清理的投影测试不修改或混入提交。

412的直接失败是普通Session进入Task专用入口，根因已通过要求Task根解决。本轮不是为证明该局部改动而省略实际Task行为：需要真实Task worker、原target/root身份、指导接受回执与真实编排处理事实。现有OperatorSteerBox共享同一Session草稿/在途requestID，提交后保留失败原文、成功显示request_id；接受不是worker已执行，不能把回执当业务完成。Task端按原WorkerTurnDescriptor冻结目标，事务记录请求和root ingress，后续真实编排响应/action与终态独立。待核实UI反馈和阅读生命周期是否准确；当前未知，不预先修改调度或推断模型失误。

若发现调度/唤醒/终态异常，立即横审Task/Mission/Session的正常/终态/重试/重启、全部生产入口、轮次、串并行及多项目，不归因为一个成员或一个模型。当前仅调查，API/schema/Provider/配置/权限与模型协议不计划修改。Task成员适用范围与普通Session读取保持一个事实来源，不添加失败后直接Session回复的后备路径。

## 有界真实验收方案

复用已关闭的member-live-rendering-412-fresh隔离project/runtime，其中README为明确标注的界面测试材料，数据库v1。独立task-member-guidance-413诊断namespace，当前源码Node Vite私有bundle，正式开发`http://localhost:18529/ui/`。构建、输入和脚本准备均在启动前完成；沿已审410 Native Host/Target/ProcessFacade与真实Provider审计，不另建运行器。新scope预先限定40条累计请求（含预检、helper与实际Task），Native固定600秒、模型无活动180秒，不延长已开启scope预算。

使用正式Task创建CLI，明确Work/Base、当前project、唯一requestID与实际发送/接受时间。输入限定读取README、一个真实成员完成短说明，避免无关写文件和外部搜索；不制造Task、worker、消息、Source或调度事件。CLI接受后向现有Task monitor写实际receipt绑定（原Task/project/request/输入时间），由生产持久化事实验证。Task控制路径仍由真实LLM（Large Language Model，大语言模型）流式决策，不在host加流程门或工具白名单。

页面从真实Work Ledger打开Task，进入真实worker侧栏，在已有来源/正文可见时通过Add guidance提交一个明确补充说明。记录可见请求回执和其后真实响应/action/完成事实；若root正在工作，保持原运行，不因观察超时重建Task或重发指导。仅对丢失响应的明确同一次操作保留原requestID。UI操作全部CUA、原截图、人工查看；辅助只读DOM/后台事实不做UI自动断言。流中关闭/重开采用当前实际AX控件，及时截图确认状态；完成态结果不冒充流中结果。

明确验收对象为Task指导适用性、真实提交反馈、原成员正文/Source阅读及流中恢复。后台checker核对原输入、Task/descriptor/协调事实和模型/Native边界；不会把UI单帧、后台green或接受回执替代完整链路。若Task尚未收敛、请求未被消费或deadline失败，保留原scope精确状态并继续根因调查，不缩小为按钮可见通过。

交互结束后先关闭自有页面、公开shutdown、join原句柄，核对原PID/启动身份及物理/output/request，再清除复制的auth/models；Task状态按实际终态记录。有产品根因先补影响/实现方案再改代码，按非UI正向合同及UI人工复验验证。更新三索引、文档检查与必要types/build，范围commit、fresh合并/完整pending/正常push；整体goal active。

## 实际Task与完整指导链路

Node构建原7909 exit0。preflight Target85088确认凭据/目录/实际Sol流一致；正式CLI原2f8378 exit0接受tsk_g00VXzaV3900TZX3V9DQ，request65da5f73-f4e1-4344-b1a1-68ecc9be0881，发送03:48:57.554Z、接受03:49:02.975Z。原Task monitor从生产事务绑定epoch1/root ses_-zUS0PUoUzzFg2gkNt5M/opened event pev_g0VXzaVCE00Uv4xmSWid。Task自然安排唯一base-tester成员ses_hE2vLKo2M333MIa0Vuq1，实际read2—3行和Source、成员结论、root汇总及manage_task完成完整。原task-complete为03:50:59.506Z、17请求、completed且实际prompt owners已收尾。未把CLI202当完成。

页面30底部操作通过滚动/悬停呈现；最初没看到入口是footer呈现位置，不能归因于412的Task根条件。05图确认Add guidance可用。向已完成Task的同成员发送补充1800字/12节说明，06是Steering中，不是接受完成；07显示实际接受编号art_d8a7b88ce41c4c8fa127。原持久事实完整链为operator_steer request→Orchestrator真实模型Tool respond_agent_coordination→response/action acknowledge_terminal→completed outcome，引用原terminal event pev_g0VXzazUg00IDCal0wfN。response.message明确只确认收到、尚未执行补充工作。原成员没有新轮次，因此本轮补充长回复/流中关开目标未达成；此前短答关闭时成员也已完成，只能资格完成态重开。

自有页面30已关闭，公开shutdown原f38b6c HTTP200，启动45947 joinc31763 exit0；physical/output/request和pair退休原件存在。当前服务已关闭，后续调查不占用原600秒期限。

## 共享终态横向审计与UI根因

读全部生产operatorSteerAgentSession/createOperatorSteerCoordinationRequest调用、当前Task消息入口handleTaskMessage、任务根ingress接受/投递、Orchestrator.loop/agent/tools、TerminalConversationAuthority与Session.loop恢复的精确协调Tool路径。public route只有Task-scoped sender；普通Session public prompt拒绝Task投影worker，Mission/连续目标只能经各自类型化恢复authority，不能以协调请求获得重开资格。Task API用当前Project、Session lineage和原WorkerTurnDescriptor绑定目标；requestID全局冲突、同语义replay和并发事务均走唯一不可变request。协调请求冻结原dispatch lineage的execution_epoch，不能作为新执行轮次的授权。

现行task-control-plane明确只有真实新operator Message、Mission验收恢复和continuous-goal receipt三种重开来源。handleTaskMessage在同事务保存真实Message、配置/附件、epoch+1和ingress，覆盖completed/failed/cancelled；deleted保持边界。普通协调请求接受后仍属于原轮次，terminal Task由Orchestrator.processTerminalConversation及匹配terminal event的authority限制；Session.loop重启恢复用原request/Tool输入和相同terminal reference重建该authority，不解释为新请求。root ingress恢复扫描覆盖terminal后接受的operator/coordination，并按原FIFO、Task/Project/epoch隔离处理。上述是共享代码审计，真实运行仅覆盖本Task completed及同进程串行；并行、多项目、失败/取消/重启没有本轮新的实测资格。

据代码、request/response/action/outcome和root ingress实际收尾，本次可排除“漏唤醒/消息丢失”归因；成员未续跑符合已声明的终态合同。实际体验缺口是输入框只写发送局部指导，未在发送前说明终态指导不能重启工作，接受回执也容易被当成执行承诺。不得把协调请求改写为Task-root用户消息或直接child prompt来绕过契约。

另有可见布局根因：07图中发送按钮随接受回执向下偏移；现有绝对定位top50%以整个form为定位祖先，而form包含textarea、回执和错误。补帮助说明若仍用该祖先会进一步偏移。已有field包装正是输入与按钮的共同容器，给它position:relative即可让按钮始终对齐输入，不增加布局状态。

## UI实施方案与修后验收

在现有OperatorSteerForm加入简洁帮助，明确“指导不会重启已结束任务，继续工作请在任务主输入框发送新消息”；中英文均为现行唯一i18n的两个支持语言，不引入其他语言面。使用Solid既有createUniqueId将帮助关联到输入aria-describedby，并补已有本地化字段的无障碍名称。相同功能现有中文Steer/Steering/operator术语改成自然的发送指导/已受理文案；接受文案只陈述受理事实，不伪称仍等待或已执行。单一field定位祖先修正按钮布局；主卡片/嵌套/侧栏共用，不改sender、草稿、requestID、持久化或调度。

这是UI说明、可访问名称与布局修复，没有非UI合同变更，不新增/运行UI自动测试。修后独立413-after scope复用原Task及v1历史，Native600秒、12累计请求、180秒无活动，不扩展原scope。真实页面先查看已完成成员、打开指导，确认英文说明与输入/按钮布局；一条明确只要求确认、不追加工作的真实指导用于验证实际接受回执下布局，不能拿它证明此前1800字请求执行。切换中文看同一表单和回执文案，再正常关闭、join、配对退休。原完整Task链、原补充工作未达成及其原因均保留。下一轮仍需活动Task指导与真正流中关开资格。

初次实施patch因猜错英文原标点整体拒绝，git diff确认没有部分修改；读原文后重补成功。after首次实际页面31的08截图表明说明在输入框下方，当前视口中按钮已可见而说明仍在下方，因此不接受该布局。改为先说明、后输入；field作为按钮定位祖先保持。关闭31并正常shutdown后，再准备独立after02新bundle/scope，原600秒/12请求不扩限，after原图和运行边界保留。此阶段没有发送修后新指导。

## 最终实页、数据与剩余范围

after原75595 joina603fb exit0；after02新构建80496 join68d1f4 exit0、67秒。页面32首先从Task进入成员的快速locator动作后，未留下可见Dock，随后的Add guidance定位超时；完整AX/截图确认面板关闭后，按当前真实Open控件进入，才获得完整成员表单。该首个动作未获得成功反馈，根因未知，不以重试通过覆盖，也不猜成用户窗口/DOM重挂载。语言命令菜单一次AX ID随候选刷新而失效；重读状态并用实际文本定位成功，没有重复发送指导。

09图说明位于输入前；10实际填写时说明完整可见、发送按钮在输入框内居中。通过页面发送真实“仅确认收到、不追加工作”的输入，接受编号art_fcba9ba90aca406cad3f；11切中文，同一表单的帮助、输入无障碍名称、发送和回执均为中文，12切回英文仍保留相同请求编号和布局。自动清空的成功输入没有再次发送。真实后台仍为该精确请求的acknowledge_terminal，符合这次只确认的输入，不能替代前一1800字请求未执行的事实。

自有32关闭后公开shutdown原1bac8e HTTP200，原28989 join486b36 exit0。三scope分别18、2、3条，合计23条实际gpt-6.1-sol流，全部200/reader settled/eof；均Native正常0、physical/output/request和auth/models退休齐全。12张原JPEG逐张人工查看。原15条Task消息及其Part/Tool/outcome、既有不可变Artifact payload保持；原Source绑定completed read2—3行。两条指导各自完整request/response/action/outcome链，精确引用原Task completed terminal event，证据在[persisted-check](../../artifacts/2026-10-14-task-member-guidance/persisted-check.json)。

原typecheck61009 exit0，三次构建7909/84230/80496均0；最后构建包含说明前置。没有新增或运行UI自动化测试。归档器首次把尚在写出的自身stdout采为空，业务核验原0d3644仍0；保留不完整捕获和首版脚本，修正为排除活动日志、原命令结束后捕获，完整重跑d6a05b exit0。没有把空日志当验证结果。

剩余：活动Task指导触发真实成员续跑、真正流中关闭重开、两个成员切换仍未满足。本轮证明Task入口可用和终态请求完整确认，修复的是说明/语言/名称/布局，不宣称改变终态执行能力。另观察到同一主区Orchestrator旧正文在后续终态确认后，AX时长由2分钟增到27分33秒，而Task总时长仍1分55秒；需结合原Message时刻和段聚合语义判断它是跨度展示还是耗时缺陷，当前不据AX数字下根因结论。继续单agent，整体goal active。
