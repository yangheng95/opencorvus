# 权限提示的焦点离开与主动关闭

## Recall

530单agent、无委托，用户后续单agent约束覆盖长期Goal旧Astra文字。529是progress：c5e4fe0aeaacc61670e790f9bfd4cdd2511494f7已正常push/fresh HEAD=origin/main、0/0；当前Git仍该提交，仅原.bun/和packages/opencorvus/bun/未跟踪。用户要求持续真实体验、Sources/Rendering优先，发现问题修复并提交推送。529实际12/16 Sol、23图和198被动事件，修复成员导航失焦；权限提示在外部focus后的关闭归因仅有时序/代码推断，尚未直接观测原因。原POST idle超时已经ownedJSON绑定原生host deadline，但还没有新POST实测资格。本轮直接追查这一真实边界，不能重新命名为Rendering已修复。

已读529 Recall/实际待决与恢复ledger、InteractionDialogHost、Dialog/类型、utils/interaction-dialog、已安装Kobalte Dialog源码，当前07-panel/reactivity、所有Dialog imports及modal/backdropClose/onFocusOutside同语义调用。显式非模态Dialog唯一生产调用是InteractionDialogHost（权限/问题共用）；WorkspaceSplitLauncher与command-menu分别使用DropdownMenu/Popover，不是Dialog。其余Dialog沿默认modal=true。当前相关检索未发现UI自动化测试，不新增或运行；纯UI修改以真实页面/截图人工复核。历史索引指向的2026-08-02-consecutive-interaction-dialog-identity记录实文件不存在，全spec文件搜索未定位，不重建缺失历史、不把标题当根因。

## 修改前问题深度与影响分析

可观察现象：529第二MDN请求持久pending，用户可见提示关闭，重新加载自有页后原请求恢复并一次批准/执行成功。直接触发未知；当前代码链表明外部focus可以进入关闭：Dialog.backdropClose类型注释只声明click，handleInteractOutside在true时放行全部interaction；Kobalte nonmodal onFocusOutside不prevent，DismissableLayer.onDismiss=context.close；InteractionDialogHost.onClose把ID纳入host dismissed集合。因此普通Tab离开最后控件也可能使未答权限提示消失，而不是只由Esc/外部点击主动关闭。需要真实Tab和原因日志确证，不能从pending或最后stale词推断队列/恢复丢失。

数据/控制流：权限事实仍在唯一PermissionAuthority ledger，Main hydrate/connected投影完整Session树，Task EngineInteraction按原owner投影，DialogHost只消费规范interaction parts；Dismiss只是本host表现决定，不产生授权/拒绝。旧keyed current Dialog/导航focus/权限恢复修复没有区分focus离开与pointer关闭。若确证，仅在现有共享Dialog的Kobalte onFocusOutside阻止dismiss，保留非模态焦点可外移、Esc/允许的外部点击、modal=true trap、backdropClose=false和原reply mutex；不新增modal策略/配置、第二pending store、轮询、重试、隐藏消息或host工具gate。不改公开API/schema/执行/持久数据。影响面覆盖共享权限与问题提示，其余modal=true Dialog本已有相同防离开语义，仍需真实普通Goal表单对照。

共享机制审计承接529并按实际证据复核：通用tool/MCP/interactive-artifact、Task/Mission的Task/Session authority、普通Session/SideChat共享PermissionAuthority；waiter先登记再publish，exact request/project/message/occurrence绑定、normal/terminal/重试重启及项目隔离的恢复/退休合同保持。当前问题候选属于UI dismissal，未确证新队列/唤醒/终态异常；若真实状态冲突则立即重新横审全部生产入口、Task/Mission/Session轮次、normal/terminal、重试重启、串并行、多项目，不能降级为单成员偶发。

## 实施前方案

1. namespace permission-focus-dismissal-530，before19029、条件after19031。只读serialize已完整闭合528-after全部90表156566原行、schema3/实际对象/integrity/完整canonical；source bytesmtime及全部原行/字段/时间校验。沿529/413/446原生owned Source CLI开发/ui，20分钟原生资源边界及180秒启动无活动观察，不另起Vite、不操作用户18571/真实库/窗口，不造Task/Mission/Goal/产品委派/开发agent。预检允许原helper自然建立独立普通Session/自有预检项目，不称Session零增长。
2. 固定8+8=16实际请求上限，含预检/记忆；每scope最多一条既有member可见用户输入。原当前OpenAI完整entry和相邻完整models目录成对准备，分别验证credential usable/catalog projected/actual gpt-6.1-sol+stream，源凭据不改/不刷新/不记录。closed后runtime与私有source配对退休，每scope4成员；after仅确证修复才准备。HTTP使用529修复后的ownedJSON，与原native host deadline共同限制idle/总时间，不重发消息。
3. before当前c5e4源代码的私有正式Vite配置诊断构建，只在Dialog既有focus/interact/escape/close和DialogHost.onClose增加被动原因/ID/时间日志，不prevent、不改分支/消息/状态/visible DOM，不是UI fixture或自动化test。内置浏览器2自有页，首次即开启日志采集，再由合法parent打开既有member。一次真实输入各webfetch公开W3C Tabs和MDN writeText一次，输出有限4节说明/首尾marker，不修改文件、运行命令或新建owner/委派。
4. 每次操作先读新实际状态，第一权限出现后使用普通Tab逐步导航，记录焦点位置和提示是否仍在；若关闭，立即读同一public pending ID及被动关闭原因，截图。随后仅重载自有页恢复该同一请求，分别真实Esc、外部空白点击对照，再恢复并Allow Once；第二URL权限出现后及时一次批准，不在未知新提示上强制定位外部控件。所有动作是人工浏览器操作，不写UI断言/像素门槛/fixture。两请求批准后等原POST与源流EOF、有限文本完成。
5. 若Tab确证focus关闭，先补证据/影响，再在共享Dialog增加单一onFocusOutside preventDefault，更新原backdropClose注释/当前架构与DialogHost行为注释，使之明确区别于Esc/外部pointer。保留一实现，不给单一对话框另开绕行配置。after正式Node构建、原类型检查，用同一公开真实流程复验：Tab外移提示保留、Esc/外部点击主动关闭及同一ID恢复/一次批准；在原Create goal只打开未提交的默认modal表单，用Tab和Esc对照，不创建真实Goal。当前有限权限流程不等于真实问题输入/Task/Mission/多项目重启全资格。
6. 两scope原输入/服务exec join、所有原source reader EOF、public shutdown200、native physical/output/request/launcher/精确出生链闭合；原数据保持/自然更新如实记录，成对凭据退休与实际秘密值扫描。必要实图/日志/Provider/数据最小归档、三索引/docs/architecture、范围commit、fresh fetch/merge/完整待推集合审查、正常push/fresh一致。无新版本/Release/tag/PR，Goal active，未确证根因不猜补丁。

## before直接复现与实施前确证

before19029/原service94717/input59476/IAB130，诊断正式Node原13009构建7314模块/1m8s，main-95KA8fEn，日志从输入前开启。真实W3C pending per_hYaWWVU9ELIAhzbBoAx0，public GET initial与after-tab均200且同ID/session/host/timeCreated，未提交任何decision。

01实际Requested operation初始焦点；普通Tab依次Exact scope details、Allow Once、Always Allow、Reject（02），再Tab到BODY（03，提示仍在），继续Tab到页面首个Hide sidebar（04）。03:45:23.487–.488日志同步记录focus-outside originalEvent=focusin/defaultPrevented=false → interact-outside focusin/modal=false/backdropClose=true → close-request nextOpen=false → interaction-dismiss同一permission ID。没有pointer/escape输入、授权/拒绝或源Session切换。因此确证根因是非模态Dialog把正常focus离开当主动dismiss，非正文owner、权限ledger或调度丢唤醒。03 BODY边界本身没有关闭，不能把它写成第一次离开Reject即关闭。

随后仅重载自有页恢复同一持久请求：05原提示，真实Escape在03:46:13.909记录escape-key→close-request→同IDdismiss，06实际关闭。再重载07，点击原提示外主区域空白[600,95]，03:46:44.687记录originalEvent=pointerdown→close-request→同IDdismiss，08实际关闭。公开after-explicit-close仍原ID pending。09是后续第二URL MDN真实独立提示；两URL只各一次Allow Once，不永久授权，不通过API代答或重发原输入。一次只读document.hasFocus探针因CUA只读DOM能力不支持被拒绝；没有据该失败判断产品状态，使用原activeElement/真实AX和截图。

最终实施范围保持：共享Dialog新增onFocusOutside preventDefault（与Kobalte现有modal=true的防dismiss语义相同，但不把nonmodal改成trap），类型注释明确focus移动不等于外部pointer；DialogHost注释说明Esc/外部pointer仍可主动关闭。焦点可以离开非模态提示，提示和原pending身份继续可见；不恢复旧focus、不新增弹窗/轮询/授权策略/host gate，所有答复沿原InteractionCard/authority。当前库只有InteractionHost显式nonmodal，问题与权限共用相同链；其余modal默认行为通过原Goal未提交表单实际对照。after做正式构建及完全相同Tab/主动关闭流程。

before原POST59476 HTTP200/stop/846字符，11实际末尾图含四节与PERMISSION530END；10初开成员仍在旧历史阅读位置，只是成员打开过程，不能冒充新完成页。原94717服务及59476输入均join exit0，公开pending[]/shutdown200及native物理/输出/request/launcher/exact birth完整闭合，130关闭，4配对凭据成员退休，6/8实际Sol全部stream/200/EOF。原90表源精确保持，target5自然更新行（记忆chunk/file、两lease、memberSession时间），Provider activity391→395。

after补充原工具资格：原native服务仍以20分钟为边界，sender沿同一ownedJSON deadline。一次新POST的真实权限等待保留到dispatch至少315秒，再经原UI批准并等待原HTTP200完成，以直接验证529旧5分钟idle故障修复。期间以原输入handle与同一public pending ID核实仍是同一次活跃等待，定时短唤醒，不新增消息、不重试、不刷新原POST；这不改变产品权限/执行策略。其余原Tab/Esc/pointer对照和Goal未提交表单照原计划，真实模型与自然数据结果单独结算。

## 正式修复与实页结果

生产仅Dialog一处onFocusOutside preventDefault，外加Dialog.types及DialogHost行为注释；同一Kobalte组件/受控open/current interaction、reply mutex和authority保持。原95340 Overlay typecheck exit0；原34457正式Node构建7314模块/1m1s/exit0，main-O1FFGd25.js，CSS仍main-CVd9TkT1.css。after没有诊断插桩、隐藏UI或UI自动化；当前正式版本由原Source CLI实际/ui提供。

after19031/原service60460/input86812/IAB131：12新W3C原Requested operation焦点，普通Tab依次details/Allow Once/Always Allow/Reject（13）、BODY（14）、页面Hide sidebar（15）。这次15真实焦点在外部按钮，dialogCount=1仍可见、aria-modal未改true；公开initial/after-tab/restored-for-wait同ID per_hdRGSc8ZYvL1WJ8lN68E。未把非模态改成focus trap。16在外部焦点按Esc仍主动关闭；自有页重载17恢复同一请求，外部空白点击仍关闭（18），再恢复原请求。没有伪造新Request/消息或API代答。

after原input自03:53:59.853开始，03:59:47.440 public pending见elapsed347593ms和同一W3C ID；04:00:17原86812 handle仍live，原工具回执写入after-long-wait-handle。19是同一提示长等待后实图，随后只Allow Once；20是第二MDN原提示，实际一次批准。原POST最终HTTP200/stop/851字符/四节，roundTrip438778ms（约7分19秒），原86812 join exit0。before原POST266843ms/HTTP200/stop/846字符。529修复后的ownedJSON已在新真实POST超过旧5分钟idle后完成正向实测，未重发或用最终GET代替原连接成功。

21以真实MDN来源link的End到新正文末尾，PERMISSION530END完整可见。22仅打开当前parent Chat的Create goal未提交表单，真实aria-modal=true，初始Objective；23 Shift+Tab环绕到末尾Create goal，再Tab回Objective，默认模态focus边界保持；24 Esc正常关闭。没有填写/提交Goal或创建持续任务。24/原AX及DOM同时显示Goal关闭后焦点BODY，这是本轮新增的可复现线索；本批不声称Goal关闭焦点已修复，后续继续分析共享Dialog关闭focus所有权，不能将默认modal trap通过外推为返回焦点通过。

24图全部实际呈现并人工查看。before10只代表初开成员仍在旧历史位置，11才是新完成正文。两轮均只各读取W3C/MDN一次；公开pending最终空列表、相同原请求ledger完整。before被动事件共10唯一条，focus-outside1/interact-outside2/close-request3/interaction-dismiss3/escape-key1，直接区别focus、Esc和pointer三因。问题输入、Task/Mission生产者、所有Dialog类型或所有Rendering未新增真实资格；共享primitive影响依代码审查及默认Goal对照限定，不虚称全入口完成。

## 持久事实、工具修正与资源

描述器首次按session_id过滤全部ledger后果事件只读到requested，这是查询口径问题：当前归属由requested行表达，后续事件通过request_id关联。立即改成从本轮requested owner子查询匹配同一request_id全部事件，并使本地自有派生result-observation可幂等更新；原日志/源数据不改。原描述命令重跑后，两scope各2条真实请求均requested→allowed_once(invocation)→execution_started→execution_succeeded→stale，reason为The continuation reached its persisted conclusion；不是生命周期缺失或最后stale代表失败。四次真实一次性授权、执行成功与自然终结直接保留，未新增生产恢复/队列路径。

两scope各6/8，总12/16（含预检/记忆），所有model/API model gpt-6.1-sol、stream=true、HTTP200、原source reader EOF，预算未exhausted。两个原service94717/60460及input59476/86812均join exit0；public shutdown200/native physical/output/request/launcher/exact birth chain dead_or_reused完整闭合。130/131关闭，runtime及私有source四对共8凭据成员退休，源auth/catalog字节/mtime保持。所有数据/服务在独立副本，用户18571、真实库/窗口未操作，无版本/schema演进。

原source完整90表156566行身份/全部字段/时间及文件bytesmtime不变，schema3实际对象/integrity/完整canonical保持。两个target各5原行自然更新（记忆chunk/file、两capacity lease、memberSession时间），Provider activity各391→395；原数据不回写伪造不变，Goal表单未提交也没有新增Goal事实。最小归档排除全DB、原行快照、原auth/models及无关业务消息。helper依赖529准备来源、413/446监督器、504 Source CLI及497冻结Bun，不是独立安装器。

交付检查以原类型/构建、docs/architecture、diff check、实际秘密值扫描及正常Git hooks为证；不新增/运行UI自动化、不执行无目标全量bun test。三索引和当前reactivity同步，范围commit/fresh fetch-merge/全部待推审查/正常push/fresh一致后进入后续单agent迭代。长期Goal active，Rendering全入口和默认Goal关闭失焦等剩余要求仍未达成。

归档检查实际结果：docs:check345操作/26组、architecture-index20当前文档、git diff --check均exit0；实际秘密值扫描覆盖当前归档、10个解压payload、记录/三索引/三个UI源与当前架构，0匹配，源auth bytesmtime仍等于准备时。两个runtime error计数均0，API model额外逐请求验证为gpt-6.1-sol。只提交本批三个UI文件、架构/记录/索引及证据，原两个缓存目录保留。
