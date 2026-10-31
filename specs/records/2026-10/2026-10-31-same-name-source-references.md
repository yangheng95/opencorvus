# 同名附件来源的引用辨识

## Recall

用户要求持续单 agent 自主体验、分析、修复、真实界面和截图复核、提交并正常推送；后续禁止子 agent 的明确要求覆盖旧 Goal 的三 Astra 文案，不委托。上一轮833为 progress：fe7d1f68d4efefb9da0a070d4eff1744ba954852已推送，2026-10-31T09:19:48Z main/upstream 0/0，24普通文件/三索引自有行结清，176外部状态保留。待发送同名标签已修，16张实图、真实gpt-6.1-sol两次read与两Sources原件验证通过；基线2/候选4请求，共6/8，累计1124。两个scope公开shutdown200、原exec/native/launcher0、物理/输出/请求/出生身份结清后四配对副本退休。最新833-after schema9/92表218548行，739账本事件；75旧附件、十三Git项目28 tracked、旧对话/Goal/Sources/原文件保持，另两833真实会话及原十文件各自完整。本轮开始git status176行、HEAD仍fe7d1f68d。用户18571真实服务、数据库和窗口不操作，不建branch/worktree，不重复Dependabot重扫，不发布。

已读AGENTS、833 Recall/实际交付/16图范围、07-panel来源及附件合同、SourceParts完整呈现/打开/复制/摘录、CardParts的消息与执行/引用分组、ChatBubble三入口和Card调用、conversation-source identity/location、FilePart历史阅读、read工具的原件标题发布。全仓调用确认SourceParts只有CardParts一调用；SourceParts.sourceLabel也服务ConversationSearchDialog，必须保持原语义，不改搜索。相关路径未发现UI（User Interface，用户界面）自动化；不新增/运行。只读检查当前生产调用、现存真实消息和来源事实，不根据文件名或模型自述判定存储丢失。

## 问题深度与影响面

833实图14–16与公开导出已有真实复现：两次read依次读取同名notes.txt的BRAVO29与ALPHA17，两source-file有不同path/sourceId/toolPartID，原件均52字节、可实际打开。UI却有两个相同“打开来源文件: notes.txt”“复制来源位置：notes.txt”和相同“附件”副标题。直接触发点是不同附件保留相同原名；根因是CardParts在消息/执行/连续引用分组之后，只把单个小组sources传给SourceParts，原有组内序号看不到同卡其他小组。833只处理composer attachments数组，明确未重设计历史来源，不能认为它已经解决此问题。

修复范围限同一CardParts呈现范围内的同名附件来源。CardParts从原始displayParts派生完整sources，作为必须传入的内部contextSources，沿现有PartCollection递交每个SourceParts，位置与消息顺序均不改变。来源组件只对origin=attachment、原显示标签相同但真实path不同的来源派生按首次出现排列的“附件 · 引用 N”副标题；同一路径重复引用共用同一编号。编号属于当前卡片的引用语境，不宣称与上传顺序/用户FilePart顺序对应。普通磁盘路径已有目录副标题，网页已有URL（Uniform Resource Locator，统一资源定位符）细节，不改变其编号或打开行为。

同一派生引用说明用于可见副标题、打开/复制无障碍名、Tooltip（悬浮说明）及已有摘录入口/标题，避免只改视觉。sourceLabel、公开title/path/range/sourceId、真实原件打开、复制位置/摘录内容保持原值。不添加来源身份或序号缓存、全局索引、host路由、消息合成、schema（数据库结构）/持久格式/SDK（Software Development Kit，软件开发工具包）变更。历史用户附件FilePart继续保留原名，本轮不扩展为所有文件呈现重设计；当前这轮是真实来源引用的辨识。

风险是上下文必须在消息/执行分组之前取得，沿内部必需prop传递；不能让单来源组退回组内编号、把不同range/网页来源误当附件，或改写复制值。流式追加只根据当前真实数组重新派生；现Key/sourceIdentity保持原引用归属与展开状态。不触及调度、队列、唤醒、恢复、并发和终态；如发现异常立即按共享机制横审全部生产Task/Mission/Session轮次、正常/终态/重试恢复/串并行/多项目，不局部归因。

## 实施与验收方案

先完整续存已退休833-after到source-labels-834-before/38457，以其冻结main-Cjs5Jyw6.js实页重开原833会话。只读旧真实模型消息/两read来源，零新模型请求，累计保持1124；模型目录和授权认证仍按配对复制与独立投影检查，秘密不进入prompt、日志、spec或提交。不重新请求模型制造重复证据，不动三个官方管理凭据。原有739账本与92表业务行逐列保持。

首启固定60分钟deadline，候选38458共享且不延长，至少五分钟结清余量。完整复制现namespace，包括833两新项目的能力快照/原件/metadata；75旧附件与833已发送的六namespace文件分别保护，两833会话原十文件各自保持；未发送的833-before副本按现volatile生命周期独立记录，原source目录和fixture保持。十三旧Git项目/28 tracked及旧Task/Mission/Chat/Work、Goal/Sources/README、原文件、两paused定义保留。无新Session/Task/模型调用，不复用物理容量租约。

基线页真实打开两来源、英中标签和复制实际位置；人工截图。复现后保存相关源码原字节/差异，修改CardParts/SourceParts、两语言目录和当前07-panel合同。普通前端build/renderer、类型和i18n（国际化）检查后启动首次候选，不单起Vite。候选通过UI实际打开两个可区分来源并见BRAVO29/ALPHA17、复制每个精确原始位置，中英切换、右侧面板关闭重开/会话重开、普通文件/网页来源回归；截图人工查看。源码/DOM（Document Object Model，文档对象模型）检查不冒充视觉验收，不新增/修改/运行UI自动化或无目标全量bun test。

两scope自有页关闭、公开shutdown200、原执行句柄/native/launcher0及物理/输出/请求/OS（Operating System，操作系统）出生身份结清后退休配对副本，源auth元数据及models字节/元数据保持。更新本记录/产物/三索引并执行docs:check；只提交本轮普通文件与三索引自有行，保留外部工作区改动。每次push前fresh fetch、普通merge与完整待推集合复核，正常hook验证并自动push；不rebase/force/no-verify，不创建Release/tag/PR，Goal继续active。

## 基线实测与实施决定

38457/main-Cjs5Jyw6.js，自有隐藏页23真实打开原833四消息/两read来源，01显示两组相同notes.txt/Attachment及相同打开/复制名称，02/03分别打开BRAVO29/ALPHA17。copy第一次后立即读取clipboard过早得到空字符串，未据此认定产品复制失败；第二次真实复制读到ALPHA原完整路径，候选将等待界面完成反馈后分别核对。三图均人工查看。新私有read-original-cases初次重复拼接query导致source-content404，按现路由参数修正原checker并重跑退出0；该失败路径的Node/libuv收尾由测试监督器确认物理/输出结清，不是产品调度异常，不修改生产路由。

十组真实公开回归通过；原833两/四消息、选择、空Goal及两52字节Source内容完整，零新模型请求。公开shutdown200、原exec51556/native/launcher0、物理/输出/请求/出生身份结清后退休认证/目录配对副本，余3461103ms。schema9/92表218548→218550，所有原业务行保持，新增仅一次正常control activation lease/grant；81保护附件、十三Git项目28 tracked及两833各十文件/Git事实保持。固定60分钟deadline未延长。

修改前已保存五个相关源码原字节和空diff。实施按方案只让CardParts从未分组的displayParts派生完整contextSources，沿必须传入的内部prop交给SourceParts；按同显示标签的真实不同path首次出现顺序派生引用说明，同path重复共用。引用说明贯通可见caption、打开/复制名称、Tooltip和摘录入口/标题，位置与复制原文不变。两个语言目录各一键；sourceLabel/search原合同不改，无后端、SDK、schema或持久数据变化。

## 最终实际体验与数据验收

候选main-CB_Qh88y.js/38458自有隐藏页24：04两个分散工具小组的notes.txt副标题变为Attachment · Reference1/2，打开与复制名称也各自唯一。05/09引用1打开BRAVO29，07/10引用2打开ALPHA17；06/10悬浮说明包含同一引用。08切换中文并关闭面板，14离开普通文件/网页历史再重新加载原会话，引用1/2仍按原来源顺序保持。01–14全部实际呈现人工查看。

复制UI完成反馈后，Tab.clipboard.readText读到此前ALPHA路径，而真实Ctrl+V粘贴引用1得到对应BRAVO的bd5…完整原路径，引用2得到ALPHA的c05…完整原路径；06/07截图包含该未发送草稿及相应原件。切换中文后引用1同样实际粘贴bd5…原位置。工具直接clipboard读值不代表该页面实际粘贴结果，不据此修改生产clipboard writer或宣称复制缺陷。草稿随后通过实际输入框清空，没有发送新消息。基线第一次过早读值亦不作为通过证据。

11/12普通文件历史八Sources保持原行列号/组内序号/展开语义；13网页两来源保持真实标题/域名/链接和原摘要入口。所有来源仍位于对应真实工具后，没有合并成平行来源列表。历史用户FilePart两原名保持，本轮只修来源语境，不宣称其同名条目也被重设计；同path重复与流式追加的派生规则经过当前代码审查，没有新造模型用例或把静态检查当实页证明。

普通前端build/renderer、类型和双语2673键均退出0，未执行完整build:overlay。候选十组真实公开回归均通过：Task68/Mission80/Chat3/完成Work8全量响应，预检2/Goal9（242063 Token /1轮）、Web4消息/2来源和文件3/8来源、README4/176字节、824六消息/94及90字节来源、825两/四消息和六/八文件、报告Goal12/380471/1、空输入22原文件、两paused定义与828三文件；两833原会话2/4消息、选择和空Goal也完整保持，两个source-content各返回完整52字节及原toolPartID/sourceId。

候选页关闭，公开shutdown200、原exec54738/native/launcher0、物理/输出/请求/OS出生身份结清后退休配对副本，余2895272ms；与before共用固定60分钟deadline，未延长。schema9/92表218550→218552，所有原业务行/原739用量保持，新增仅一次正常control activation lease/grant，物理容量槽未复用。81保护附件、十三旧Git项目28 tracked、十三+三十九原文件及两833会话各十原文件/Git事实完整。两scope共零新模型请求，累计1124，exhausted=false；源auth元数据和models字节/元数据相等。

原私有serve模板的earlierPhysicalPreflight仍继承833“pending”描述，并不证明本轮执行了预检；真实launch maxRequests=0、审计0请求、739账本保持和原执行回执才是本轮事实。后续准备模板已修为明确只读既有真实记录；已退休的输入和回执保持原样，不回写验收历史。零请求/既有Sources验收范围在首启前已声明，没有借模板自述扩大为新模型验收。

待最终docs:check、范围commit和fresh fetch/普通merge/完整待推集合复核及正常hooks push。没有UI自动化、全量bun test、schema/版本或发布操作，单agent，Goal继续active。

最终docs:check通过（352 ops /26 groups）；交付22普通文件和三索引各一自有行，保留176外部状态。私有index提交不混入媒体删除及共享索引其他行。
