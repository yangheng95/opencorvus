# Sources与侧栏布局阅读稳定性

## Recall

552继续用户单开发agent自主体验和修复Sources/Rendering、Goal/默认布局并提交推送的要求。551是progress：共享选中流重试状态根因修复、7服务测试、7实图/4次Sol闭合，3e1a36950已正常推送并fresh0/0。原两处缓存未跟踪；无活跃自有服务/页面。Goal继续active，旧Goal文字中的多agent已被后续用户指令覆盖，不委托。

沿用computer-use和benchmark-debug-template的真实checker及截图人工复核。已读551Recall、550/549后续范围、source-keyboard-dock原实测、544来源Output滚动修复；读取SubagentConversationPanel完整资源/显隐/scroll控制、RightDock tab/overflow/子内容、main宽度拖动和键盘入口、SourceParts源身份/摘要及开合、TextPart和text-part-model、dom-utils完整follow/恢复、conversation-reading-anchor、inspector CSS、当前07-panel。全仓搜索调用/锚点/ResizeObserver和相关测试；检索到的成员测试是数据/传输合同，未发现此次触及路径的UI自动化，不新增运行UI自动化。

## 修改前分析

已知用户历史反复Rendering/来源难读，本批未复现新的缺陷。当前text模型由文本、streaming、locale/localeSeq驱动，不直接订阅宽度；相同HTML保留块。成员transcript target keyed固定到authority/source/session/directory，尺寸不改变目标；显隐仅暂停请求与scroll控制，已有snapshot刷新保持resource storage。右Dock以稳定tab id保留内容；overflow Set相等不更新。main拖动宽度用一帧调度，键盘Home/End/左右按现有tokens边界变化并持久化；不应触发正文owner退休。

阅读恢复采用现有正文块或source identity+offset锚点，激活时恢复；持续打开且非following时依赖浏览器滚动锚定（成员CSS只在follow=true禁用overflow-anchor）。正文加载/工具展开通过既有ResizeObserver通知follow controller。尚未知持续宽度变化、长输出开合及隐藏页改宽后返回是否丢失阅读锚点、Source焦点或制造Observer循环。需实际截图与原owner/状态辅助观察，不能由存在Observer或日志标题直接判根因。

影响面覆盖主/侧/成员共享SourceParts、ToolPayload及文本模型；本批先验证原成员长历史的这些组合。没有发现调度/队列/恢复/终态异常，预期不改后台Task/Mission/Session执行、schema、配置策略或公共协议；如发现此类问题立即横审所有共享入口/轮次/终态/重启/跨项目。若纯布局缺陷确证，补全根因和定义/调用/历史/交付风险后再改唯一owner，使用已有primitive，禁止新shadow状态或遮蔽症状。

## 实际体验计划

先启动source-layout-reading-552-before，19133；after19135仅在确证改动后启用。before复用551最终Node正式诊断UI资产（生产逻辑对应3e1a36950），读取已闭合549-fixed-after完整90表165802原行及原canonical。当前OpenCorvus完整OpenAI条目和相邻全models目录配对，每scope2次Sol实际流式预检、最多4次/批次8次，不创建业务Prompt/成员/Task/Mission/Goal。20分钟原生资源边界、180秒启动/模型无活动界限、至少五分钟收尾。用户服务/页面/真实库保持不操作。

在内置浏览器2自有Source CLI /ui打开原parent/member：先原35正文/11来源完成呈现，实际上滚到最后W3C来源及长输出；依页面控件展开工具/Output、真实滚轮，拖动侧栏宽度、键盘极值，再添加现有Files工具切换并改宽、返回成员，检查阅读位置与来源可读性。截图每次真实呈现人工看，原body/source owner、首个可见锚点/屏幕偏移、pending与错误只作辅助。无自动动作循环、DOM断言、截图基线或像素比较。

如确证问题，先收尾before再实现并以fresh after实页复验；没有问题不制造补丁。结束前公开shutdown、原exec/native/launcher/output/request/精确出生完整闭合、退休4配对文件；90表原字段/时间/canonical/source字节mtime及schema3核验。最小非秘密证据与三索引/当前文档检查，范围提交，fresh fetch/merge/audit/push后fresh0/0。未覆盖组合明确保留。

## 确证与实现决策

before页176图01—05中原来源卡在380→441→280宽度及Files隐藏改宽后返回均保持顶端约6px，35正文/11来源owner保持。图06展开最后W3C webfetch完整Output；图07真实滚轮下移后读到Page Contents/About This Pattern，top57168且viewport里全是工具输出。切Files、End收窄280、通过More tabs返回成员，图08仍top57168却显示早期msg_g0VYdvApy00OT0zAmME0第33—37段；来源输出已位于远下方。这是实际错误阅读恢复，不是Markdown重新Rendering，不能把未重建owner当阅读通过。

直接根因为captureConversationReadingAnchor只选data-quotation-message和data-source-identity；ToolPayload原内容未提供所属Message/稳定slot身份，故工具输出全屏时返回undefined，激活只能恢复旧像素top。544只修展开后滚轮的父级传递，旧source/text锚点只覆盖其元素，因此未根治本例。全仓确认共享捕获/解析被Main Conversation、SideChat和成员三处使用；Main靠anchor.messageID定位虚拟历史卡片。ToolPayload只有InlineToolPart的input/metadata/output三个调用点，stateKey已是规范Session/Message/Part/slot，复用该身份不另建状态源。

扩展现有内存reading anchor为tool-payload分支，保存既有stateKey、Message、已渲染文本的字符位置和该字符相对viewport偏移；ToolPayload内容仅补这两个身份属性，三个调用点传原Message。捕获使用原生TreeWalker/Range找到首个可见文本位置，恢复在相同payload按原字符位置解析当前布局；不能只保留整个pre的像素offset，否则换行改变后仍漂到另一段。采用[DOM Standard](https://dom.spec.whatwg.org/)与[CSSOM View Range几何定义](https://drafts.csswg.org/cssom-view/#extensions-to-the-range-interface)，不拆改实际输出、不添加模拟文案/新scroll writer/定时器或shadow store。空/不可见内容依原undefined/null合同处理。现有Source与Markdown路径保留其当前身份合同，引用三处调用者自然获得新分支。

该类型仅当前conversation UI内存，不写localStorage/schema/API，无迁移。纯UI几何逻辑按规则不新增DOM/组件/源码断言测试；类型/build支持验证，必须after实页同路径并查看实际文本。风险包括宽度变化后的字符位置、隐藏几何、input/metadata格式及主会话虚拟消息定位；复验当前Output原页与引用调用核对，未覆盖独立Main/Side页和专用code/diff输出不得泛化。

before已公开shutdown200/原1249退出0、native/launcher/output/request/精确出生闭合；2次Sol均最终200/原EOF，4份配对退休，90表原行检查完成后才修改。首次observe时第0reader尚reading，后续原observe确认settled，不以preflight-ready替代EOF。

## after发现的连续改宽缺口

after页177图09→10验证显隐恢复：441宽读Output字符276、相对顶端-10.40625；切Files、280宽返回后仍字符276、偏移-10.0625，top57297正确调整为81879，原35正文/11来源保持。图11接着在成员一直可见时直接Home改宽441，原生滚动把锚点推到字符320、约下移59px。不能将显隐通过称作全部改宽通过。

共享控制流事实：Main Conversation已有viewportWidth比较及虚拟历史恢复；成员/Side只在激活/选中变化时提供initialPosition，之后setupAutoScroll在following=false、restoreTop=null时直接返回，ResizeObserver虽看见布局变化，却没有恢复原阅读锚点。其onScroll又会把布局造成的新位置保存，覆盖变化前锚点。字符锚点修复了身份缺口，但没有补上持续布局恢复的调用入口。

继续修唯一setupAutoScroll：用它已有ResizeObserver/contentChanged检测真实scrollport宽度变化，增加可选onViewportResize回调取得当前owner已保存的同一reading position；把该定义交回现有restoreTop/resolveTop/settlement路径。成员和Side在宽度尚未处理且没有真实滚动输入时不覆盖记录，回调期间沿既有restoring标志，完成后保存新布局。只增加控制器的实际宽度测量，不复制锚点/持久记录，不增加Observer/timer/第二scroll writer；Main继续其虚拟历史定位合同，通用controller默认行为不变。全部setupAutoScroll调用点只有Main、Side、成员，AutoScrollController无外部替代实现。position格式和数据库保持不变。

after原47957与页177已关闭，2次Sol最终EOF、4配对退休、原数据核验。新增final19137，沿同固定源与当前认证，预期累计6次/批次上限8；重新构建完整最终实现后才启动。实页复验显隐改宽和持续改宽的双向组合，确保字符位置保持，再收尾提交。

## final成员复验及Side补验准入

final页178图12—14在441→280→441持续可见往返，原工具字符276与相对位置保持，top57297→81879→57297；图15实际下滚新读到字符682，再隐藏缩窄返回图16仍是同一原输出段落，解析字符682在新换行后的行上，保存下一阅读观察自然变为该行首665。35正文/11来源owner保持。未把不同宽度的行首字符数必然相同当合同。

为对此次直接改动SideChatPanel获得实际页面证据，final继续使用原数据库中已有、消息数为0的Side Chat ses_-zURQsHHDzzntY8gGKW8，其真实metadata.sideChat.sourceSessionID为ses_-zURQsjwjzzB06w0DRDL、kind assistant、项目目录是已隔离412 runtime/data/projects/2026/10/20/8630733e-7ed0-4749-b134-b0f455fabcc9。原子查询核验身份，不猜URL或从标题推导关系。页178关闭后打开同一自有origin的新页进入该真实父Chat及Side入口。

允许一条有界真实Side用户消息，只webfetch一次RFC2606公开文本、简短总结后结束，不新建成员/Task/Mission/Goal、不读写文件、不执行命令、不换地址或重试。此为补验新界面路径，替代原“无业务Prompt”的计划限制；仍在用户授权真实Provider测试范围。final上限4、全批8不变（已用6，剩余2供工具前后实际流），按原审批UI Allow once批准只读网页请求。验证实际Source与工具Output、宽度切换和原输入/输出可见；若预算/资源不足如实记录，不能伪造历史输出。至少五分钟收尾余量保持。

### Side验收预算修正

实际final audit显示两次preflight分别memory/chat；Side输入也先产生memory/chat，两次均200/EOF，此时webfetch尚在Permission request等待批准，scope4次已用完。先前为Side预留2次遗漏自然memory，不足以再覆盖工具结果后的chat，属于验收设计错误，不能拿四次EOF宣称侧聊完整通过。未继续触发已知超预算的模型请求；页179实际Stop side chat使调用cancelled/session aborted，图17保留当时中间画面（该帧许可卡仍显示，不作为终态收敛证明）。原50214/public shutdown200/native/launcher/输出/request0闭合，4个reader全部EOF、4配对退休。final原行变化额外有Side session摘要/更新时间和对应自然memory两行，原源保持。

修正工具链后重跑原验收：增加side19139 fresh scope，仍从原闭合549固定源复制已有空Side，复用final57.18s最终UI资产；scope最多8次，整个552批次上限前瞻调整为16（已用8，不改写原scope上限或既有audit）。只重做同一条真实网页读取，正常允许实际只读scope，一次真实webfetch后自然结束。自然memory、全部工具前后chat/潜在SDK重试均计额度，20分钟原生资源边界及至少五分钟收尾仍约束所有资源。

### Side实际尺寸通知缺口与最终固定历史复验

side页180真实Allow Once后webfetch成功，原8008字符输出、真实Source和四句中文总结自然完成；5次scope请求（preflight memory/chat、Side memory/chat/chat）均200/EOF，共13次。图20实际来源卡、图21展开Output与原生滚轮可读。图22从380收窄280时没有ANCHOR552解析事件；真实DOM只读观察证明scrollport唯一直接子DIV.quotation-scope是display:contents，宽高均0，原观察器只观察直接子节点，故漏掉viewport宽度变化。成员的直接子有实体盒，所以其已通过的同构操作不能代替Side证据。

把滚动容器自身加入同一个contentResizeObserver观察集合，保留原直接内容盒/初始layoutRoot；不增加Observer、定时器或另一恢复路径。共享检测现在可靠触发onViewportResize，Main默认回调留空，现有虚拟历史owner不变。实际scope34401/public shutdown/native/launcher/输出/request0、5readerEOF与4配对退休已完成后才补改。

新增verified19141，只读复制刚闭合side真实完整数据库（含这次真实输出）和canonical，从源90表实际字段/行数动态核验，不合成消息或把同业务Prompt重发。模型预检2次，scope最多3次，批次16不变（现13）；只阅读已有Side和成员，复验viewport改宽与显隐返回。原side source5次EOF和closure/退休是复制准入。预计累计15次，修复后必须实图通过再收尾。

verified页181图23→24已出现真实onViewportResize解析：原Side字符499在缩窄后保持同一行的相对偏移，来源/两正文/8008原输出保持。但完成回存时重新选了换行后的行首478；持续反向缩放可能逐次改变原字符目标。为保证多次尺寸变更仍追踪同一原文字，capture沿原Source优先规则延伸：若上次tool-payload字符在当前真实可见区域内，保留该字符身份，仅更新偏移；真正手工滚动移出视口或内容退休后再捕获新字符。

页181已关闭，verified服务和Provider仍为同一已准入scope（两次EOF，无新增业务请求）。仅重建自有bundle的UI资产，再以新自有页面加载；不重启后端、不操作用户页，原20分钟边界和至少5分钟收尾保持。累计15次不变，前后资产构建日志分开保留。最终双向尺寸变更及隐藏返回必须再次人工复核。

### 冻结UI资产的验收加载修正

上述同服务重建的验收假设不成立。页182实际document.scripts仍为main-qim-clqU.js，磁盘最终index引用main-i1jR4B4Z.js；已读overlay-ui.ts的freezeOverlayUiDirectory，服务启动捕获全部资产原字节，后续磁盘build不改变当前source。图25/26只支持此前viewport观察修复，不支持最后保留原字符分支；不得回写成最终通过。此为验收加载错误，生产冻结所有权行为保持。

verified原87464已public shutdown/native/launcher/输出/request0结算，两次EOF及4配对退休。新增stable19143 fresh服务，复制已完成58.62秒的最终UI资产，沿同闭合side真实数据/完整canonical，只阅读已有结果。启动后先核对实际页面script与本次捕获入口，再进行真实宽窄往返；不以文件名替代视觉验收。scope上限3，整个552批次上限前瞻改20（已有15，预计最终17）；不改变原scope记录，不增加业务模型请求。

## 最终结果

[十九张关键实图与原证据](../../artifacts/2026-10-23-source-layout-reading/README.md)。stable页183实际main-i1jR4B4Z.js，图27—30中Side原8008字符结果按字符323保持，宽441→280→441的top859→1013→859，偏移4.578125/4.640625px；隐藏到Files、改窄返回仍为同一原段落。可见改宽两正文owner1/2保持，显式切页正常退休重建为3/4，原Source/披露/阅读恢复，不伪称全程owner不变。最终成员页184图32—34，原字符276保持，top57297→81879→57297，35正文/11来源owner保留。页183/184已关闭。

最终生产改动为同一reading anchor增加tool-payload规范身份/实际字符位置并保留仍可见的原目标；原scroll controller复用位置恢复并观察自身viewport及直接内容；成员/Side在布局尚未处理时保留原记录，手工滚动可接管。没有第二套scroll writer/锚点store、Observer、任意延时或输出改写；没有公共API/schema/版本改动。

六scope依次2/2/4/5/2/2，共17/20次Sol流式200/API模型完全一致/原reader EOF。原exec1249/47957/50214/34401/87464/67156全部public shutdown200、native/launcher/原exec0、精确出生dead_or_reused、输出/request闭合，每个都留出超过五分钟收尾余量。24份复制auth+models退休，原App条目/完整catalog字节与mtime保持。前四源90表165802原行、后两源90表166963原行，源全部字段/时间/字节/mtime/canonical保持；目标schema3/实际对象/integrity相同。真实Side scope的原行额外变化是对应Session和自然memory，其他只变更两条运行租约；无用户数据库操作。

最终类型检查通过、Node构建58.62s；中间一处自引用类型错误修正后重跑。没有UI自动化测试。Side预算和冻结资产加载两次验收错误均保留并修正后重跑，旧页不算最终资格。Main/Mission独立页、专用code/diff、JSON格式切换仍未覆盖，未宣称全部Rendering问题已根治。

## 新发现：停止后的Permission终态

对图17的许可残留已立即转入共享取消链调查。闭合final的实际SQL证明Message已MessageAbortedError且completed，Tool outcome为failed/session aborted，但其Permission request per_hXbjERkxfRGkMrzw23VL仅有requested、decision_slot=null。PermissionAuthority.list按requested且无decision返回，不能用“只是中间截图”排除持久缺口。Side connectSideChat已订阅permission.replied/terminated，当前证据指向后台终态未产生，不能以隐藏卡片修复。

已全仓搜索35个共享取消/结算调用点，读取engine/cancellation-scope、session.abort、right-sidebar-conversation、PermissionAuthority取消/list/continuation退休和Task API显式许可结算。普通Session及右侧对话使用cancelSessionPromptInScope→awaitSessionPromptFinishedInScope，当前路径只等待Prompt和发布终态；显式cancelPendingForSessions生产调用仅Task API的删除/停止路径。已按共享机制开始审计，尚需完成Task/Mission/Session全部生产入口、执行轮次、正常/终态、重启、审批并发和跨项目的实际合同/运行验证，禁止先定为Side局部问题。该后台修复作为下一批紧接处理，当前布局提交不宣称已解决停止许可残留。Goal保持active、继续单agent。
