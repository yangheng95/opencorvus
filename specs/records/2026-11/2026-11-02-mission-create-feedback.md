# 创建意图与草稿保存结果可见性（896）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，真实页面验证后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的三Astra。895为progress：8760287bf2b2d591cfbc28f351e1dd24fd1edf60正常推送，fresh HEAD=origin/main/0/0，本人29普通文件/46本地化字段/三索引行干净，177项无关变化保留。源895-reviewed严格259474行/schema9/92表/100项目文件及Git/229附件保全；原服务94405已消费exit0、HTTP（Hypertext Transfer Protocol，超文本传输协议）200、原生物理身份/输出/请求闭合、认证与完整模型目录副本配对退休；0模型请求，累计1260。旧闪烁已修复，不回溯它。

已读895完整Recall与23图/资格/推送、本仓AGENTS；MissionCreateDialog全部状态/加载/选择/请求/两种提交/关闭与表单、MissionDraftEditDialog全部、MissionBoard现卡片及唯一创建绑定、main创建/打开/dispatch与真实服务、MissionCreateDraftResponse、MissionRecord及完整分页reader、现Feedback和diagnostics、两语言所有创建/编辑字段、07-panel作者/校验/模型就绪/保留输入合同、api/api-state的capture/assert/isCurrent和响应归属、现mission-board CSS。全仓搜索全部onCreateManual/createMissionBoardDraft、description/ai_prompt/ai_placeholder/submitting和manual_draft定义调用；未发现其他创建绑定。读取mission-lifecycle-request-settlement测试仅为传输正向合同，没有UI组件或源码文案断言，未运行。没有产品修改。

## 修改前深度与影响分析

可观察线索：895的22图中文请求字段仍为“Mission描述”；创建当前选项为“通过AI创建/手动创建”，主按钮“发送并创建/创建草稿”。完整代码证明两者实际边界为wakeMission立即发送执行，或createMissionDraft只存草稿，且手动提交后直接关闭窗口。第一种文案强调实现方式，未直接说明是否开始执行，不能清楚表达用户选择。

更实质的可见结果缺口：main.createMissionBoardDraft丢弃真实创建响应，仅增加既有共享刷新token（令牌）；MissionBoard直接把Promise<void>传给Dialog，成功即关闭。search/project按原状态保留。如果新标题/项目不匹配当前筛选，新记录被正确过滤，用户却没有保存确认或直达入口，页面近似无变化。diagnostics.reportSuccess只写AppLog，不是可见通知，不能拿它代替产品反馈。before必须在真实项目筛选/查询与创建目标不同的情况下实际保存一个本人新草稿并截图，以确认触发和旧路径；此前895仅打开/取消，没有覆盖提交后反馈。

选择：保留所有筛选、加载、创建、执行和导航owner（归属者）。main返回现createMissionDraft的完整MissionRecord响应，经现API（Application Programming Interface，应用程序接口）归属assert后触发原刷新；MissionBoard的唯一onCreateManual公开返回值同步为Promise<MissionRecord>。Dialog的Promise<void>和原关闭/错误/执行路径不变，由Board唯一包装回调记录“已保存”回执。回执仅保留真实missionID和捕获的ApiAuthority，既有响应事实说明已提交；isApiAuthorityCurrent读取现响应归属的reactive revision（响应式修订号）而非新增连接状态。原记录、标题、请求、目录和导航目标全部从missionBoardStore现完整reader按原ID派生，不复制响应快照、另查标题或新建缓存/重试/双源。更换服务后旧回执立即失效。

在当前页面筛选之外显示现Feedback成功确认与Dismiss；Open Mission按钮从同一完整reader取得真实记录后调用既有onOpenMission，读完尚未就绪时禁用该按钮。读取失败仍显示现明确错误/重试，同时保存事实不被读失败覆盖。文字描述历史保存结果，不伪造当前执行状态。无需重置查询、强制跳转、新弹窗、host路由旁路、消息、调度或持久配置。只记录最后一次本人创建回执，明确关闭可移除；不增加业务记录事实来源。

创建界面直接显示Start now/Save a draft（立即开始/先存草稿）及各自说明；主按钮Create and start/Save draft（创建并开始/保存草稿），提交中的保存/开始也使用现对应文案。默认仍是现ai模式，不改变流程。两种模式和编辑器共用现request状态、同一请求字段名称及占位；删除只为旧模式分叉服务的ai_prompt/ai_placeholder/submitting翻译键。模式说明与主按钮通过原生aria-describedby关联，不修改SegmentedControl公共合同。中文相关创建、项目/工作类型、校验、错误、草稿提示统一用可理解的多步任务/请求语义；原文、文件名、模型/协议/包标识保留。mode/请求/标题、项目、专家团选择及未保存输入仍由原状态拥有。

影响：main及MissionBoard/MissionCreateDialog的唯一绑定、两语言、mission-board CSS、07-panel和三索引；Conversation原draft Badge共享manual_draft文案同步含义，但不改其数据或布局。后端/路由/SDK（Software Development Kit，软件开发工具包）/schema/持久格式不变，接口返回合同是现服务结果，不新增服务接口。无执行、调度、并发、队列、唤醒、恢复或终态机制改动；若运行发现此类异常必须立即横向审计，不能以本页通过降级。风险包括提交成功但读取未到、回执跨后端残留、开错项目/原任务、帮助挤出表单、模式切换丢输入、保存被误认为开始。用现响应归属、单一reader及真实跨项目原身份验收验证。

## 实施与验收

首次before/after模型额度各0、共同75分钟绝对截止/5分钟闭合预留；本人CLI（Command Line Interface，命令行接口）38621/38622的`/ui/`，before用895-reviewed最终UI，after用Node.js构建私有目录，不启独立Vite，不动用户18571或用户数据库。源数据从895-reviewed单链继承，配对认证/完整模型目录验证/复制/退休，全部旧行/100项目文件及Git/229附件严格保全。只在本轮副本实际新建本人标记的未执行草稿，并仅编辑after新草稿，不修改/删除任何原记录，不启动模型或提交立即开始。

1. before初始公共reader记录原13条；真实页面筛选773项目+886，打开创建/两模式截图，改创建目标到801项目并保存本人896-before草稿。实页确认原筛选正确保留但没有可见保存确认；公共reader精确核对14条及新草稿请求/目录/状态，全部原13逐字段一致。关闭本人页面/原服务句柄exit0、HTTP200、物理资源/配对副本/严格旧数据资格通过后才改产品。
2. 按本方案实现唯一回执、派生入口、创建语义与字段统一。类型/本地化/CSS（Cascading Style Sheets，层叠样式表）/文档/构建；纯UI不新增、修改或运行UI自动化、源码/DOM（Document Object Model，文档对象模型）/组件断言、快照或浏览器测试。
3. after同一项目/查询交集，切换两种模式验证原输入保留、清楚的开始/保存提示；实际创建本人896-after草稿，确认反馈在筛选外可见，直达同一801项目原请求，返回筛选仍保留；从该新草稿编辑并保存本人补充文本，公共reader精确回读且原14条完全保留；清除反馈和英中截图人工复核。不得把上述本地草稿保存说成真实模型执行验收。
4. 正常关闭本人服务、原exec消费0/HTTP200/物理身份输出请求/配对副本闭合、严格旧数据资格；补齐证据/三索引/文档检查、清晰提交、fresh fetch/普通merge/完整待推集合/正常hook与push/fresh0/0，Goal继续active。

## 实页反馈与布局收敛

before的01/02确认两种旧创建方式；03在773项目/886查询下，新801项目草稿fd04403bfcd09ec9实际保存但当前结果区没有确认或直达入口。公共reader原13条精确保留，新草稿请求/目录/待规划正确。原服务28348消费0/HTTP200/物理链/配对副本闭合，严格259474→259545保留全部旧行/100项目/229附件。

after的04/05明确开始/保存说明、共用请求字段、模式往返保留已填标题和请求；06实际保存新草稿75d061fcb26b308c后，原773/886筛选保持不变但有可见Feedback，Open Mission随原reader加载变为可用；07打开同一ses_-zUQCrQsDzz5sIfjyrSV/801项目请求，返回保留原筛选。08实际编辑该新草稿并保存，09由同一入口回读补充原文。10中文保存确认，11中文立即开始，12真实空字段错误与首个标题焦点，13关闭反馈后原保存结果正常。公共reader原14条逐字段保留、新记录保存/编辑同一ID和Session、准确回读请求。原服务52643消费0/HTTP200/物理链/配对副本闭合；严格259545→259650/9版92表/全部旧行/100项目/229附件保全，0请求/累计1260。

04/05/11图显示新增说明的flex-column（弹性纵列）默认stretch（拉伸）把SegmentedControl撑到说明行宽。并非公共控件宽度规则或业务问题；只将现创建方式容器align-items设为flex-start，使控件按自然宽度展示，说明照常换行。关闭并资格通过后才修改此样式。final首次模型额度0，仍用原75分钟绝对截止/5分钟预留，不重启续期加额；38623新CLI/新构建只读复核英中两种方式，全部15条保留，不新增业务写入。

## 最终验收与交付边界

最终main-DmZ_yhYj.js仅将创建方式控件恢复自然宽度；14—17英中立即开始/先存草稿均实际打开查看再取消，英文控件宽164.8125px、说明容器596.328125px。17图及after的10图保存原图再次查看。主按钮aria-describedby在英文开始和中文草稿都指向当前对应说明；只读观察，无DOM断言。after已实际验证创建/模式切换/保存反馈/直达/返回保留筛选/新草稿编辑保存回读/中文空字段校验/关闭反馈；最后CSS改变不涉及这些业务或数据流。

本人两个新草稿均留在隔离副本：before fd04403bfcd09ec9/ses_-zUQCt1D9zzfFl4ktqBJ，after 75d061fcb26b308c/ses_-zUQCrQsDzz5sIfjyrSV，目录为原801项目。公共reader按真实路径核对原13→14→15条，原13或14条逐字段一致，after保存/编辑准确回读同一ID/Session与补充原文，final全部15条完全等于after-edited；没有改原项目文件、原任务记录或执行模型。本轮API输入日志有实际POST创建与PATCH编辑，不使用mock（模拟）或fixture（夹具）替代运行。

最终本人tab192及之前190/191全部关闭；原final服务73967消费exit0、HTTP200、settle原native/launcher和原生物理身份/输出/请求清理闭合，配对认证与完整模型目录副本退休。严格259650→259652仅两条本轮控制租约；三阶段全部原行、100项目文件及Git、229附件、源DB和认证/模型目录元信息保全，9版/92表不变；模型请求0/累计1260，沿原绝对截止退休余3607899ms。原到最终新增178行，包含两份本人未执行草稿及其真实发布事件、回执和租约；不对未知行作删除或摘要替代。

overlay类型、本地化2762键/2语言、CSS9076引用/402TS或TSX、文档352操作/26组与Node构建通过，保留现有大chunk提示。后端/路由/SDK/schema/执行/调度机制未改；本轮改动属于UI呈现与提交结果交接，用真实公共reader正向核验，不写或运行UI自动化。未实际提交立即开始或模型调用，未验收连接轮换/读失败的保存反馈、市场操作/安装、typed conflict（类型化冲突）或提交忙态像素，其他页面继续迭代；不能把草稿验收说成上述覆盖。三索引仅本人行、35本地化键共70字段（含3项退休键）及本轮普通文件范围提交；正常Git同步/推送最终回执为准，Goal保持active。
