# 父会话与成员并发时的 Sources 与 Rendering

## Recall

持续单开发agent，不委托。旧goal三Astra文案已被后续单agent人工要求覆盖。上一turn为progress：470/471/472三个完整修复分别81eecc8b7、45f8be8f1、358c49a6de2d99c72c6367c81a847205ddb07527，全部正常push/fresh fetch；当前main只有原.bun/和packages/opencorvus/bun/未跟踪。472的两个真实Goal达到一轮预算，10张实图，4/预设10实际Sol全200/stream/EOF；原81175 exit0、公开shutdown200、native/physical/output/request/launcher及runtime/private完整auth/models对退休，tab24关闭。完整139 Project/188 Session/schema3，原137/185身份/目录/归属保持。Goal整体active；配置保存原10s/5s及未采样Rendering仍未完成。

用户主要要求Sources显示、侧栏Rendering闪烁根因、实际体验后修复并提交推送；不能只改提示或重复静态截图。已应用benchmark-debug-template、computer-use，使用已授权IAB/browser2的自有页面及既有OpenAI/完整models目录和实际gpt-6.1-sol，不操作用户18571进程/窗口/数据库。禁止任何UI自动化测试、组件/DOM/源码文案断言或截图基线。

## 修改前调查与当前证据

已读472 Recall/实际资格、469 Sources/成员单流、420侧栏历史根因及被动owner诊断、412成员首流、431父单流，以及现行07-panel-reactivity的单writer、HTML产物、稳定target/request分离和阅读锚点。全仓搜索Rendering文案及TextPart/text-part-model/markdown-render worker/service，CardParts/消息分区/引用run，SubagentConversationPanel、main/dock、SideChat、实际Solid1.9.14 Show/Switch实现与全仓唯一AGENTS。旧修复已经存在：占位仅pending且HTML为空、相同实际文本不重提渲染；同target transcript保留、forceMount、非keyed真值分支和稳定card reader。当前代码不能仅凭“Rendering”字样证明新根因。

直接触发条件明确：StreamingMarkdownPart的新owner尚无HTML，或模型接到真实空text后清空；持续HTML的同owner不应重新出现该占位。当前Switch对非keyed truthy条件保持分支，排除“每个非空字符串都换owner”的简单猜测。Citation/body的Index槽在真实插入或分区变化时可能退休旧owner，worker分批挂载也可能改变局部高度，但未有当前真实复发证据，不能先补丁。worker单队列、两个文本流和main/card投影属于共享影响面；当前还没有新的业务调度/恢复/终态异常。

469只补了成员自身流，431只补了父会话流；二者同时输出、父子实时投影同时变化时的Sources/owner/阅读连续性仍未知。本轮选择这个缺口，沿已有普通parent ses_-zUS0X33CzzWEKMgCk98与唯一既有member ses_-zUS0WzzQzzDOGrIbYwN，不新建委派树或修改角色。公开Session prompt的实际authority/稳定input ID合同已由412/469验证；Task投影worker不可旁路，本轮不向其直接写入。两个会话各接受一次真实用户输入并各自产生流，属于真实并发验收，不是开发委托或合成消息。

## 方案与验收

1. 开始readonly保留完整139/188/schema3身份、目录和owner，以及这两个Session、所有原Message/Part/Tool及Source原始行。输入只基于原README测试事实连续输出较长Markdown（20个小节和核对表），独立PARENT473START/END与MEMBER473START/END；不用工具、不重新read、不创建成员、不改文件，不要求模型等待。并行发送使用两个独立Session的真实公开POST和原生产输入，不调用工具伪造Sources。原来源继续保留原归属。
2. 复用431的私有Node Vite被动诊断transform，当前源只增加Markdown create/dispose、empty/streaming/error转换、scroll/bubble owner记录与诊断DOM标识。pending每token变化不作为日志key，避免500条console保留上限吞掉生命周期事实；记录原pending及文本长度，手动时点DOM只读观察绑定真实Session/Message/owner。只观察，不改变渲染分支、解析/缓存、状态、顺序或原输出。日志是诊断，不加UI断言/自动点击；实际截图人工查看。若有真实复发，先补齐根因/公共影响分析再改生产，禁止隐藏占位或扩大cache掩盖。
3. 两个顺序且完整结算的自有native scope：18793诊断、18795正式。每scope最多8、整批最多16实际Sol，预检与业务共享上限，不能延长任何已运行scope。每次完整auth/models一起准备并分别验证credential/catalog/actual gpt-6.1-sol/stream；不refresh/exchange/写源。20分钟为自有监管安全寿命，原HTTP以180s无活动观察而不是到时重发。只有原Provider/native/output/request/launcher全结算后才能下个scope。正式源码未变时复用472当前正式bundle；如修生产则正式重新build，页面均来自项目开发服务/ui，不独立Vite。
4. 初始打开原父会话与同一成员的原read/Sources，暂停跟随在既有来源段。两条实际assistant均未完成且Provider source-reader已绑定时采集阶段事实，并人工列表往返、关闭重开、实际Source文件定位/返回，必要时只读设置页切换返回；对每个操作重新读取页面状态。结束帧不得冒充并发流中。实际HTTP/持久消息和审计证明两流时间重叠，不能凭Running徽章或标题推断。无活动观察不是请求/进程终止；不因工具超时重启。截图不排除每一个瞬时帧，owner日志按对应对象和实际覆盖范围解释。
5. 共享异常出现立即横审所有Task/Mission/Session occurrence、入口、正常/终态、重试/重启、串并行和多Project；只有代码、持久事实和运行证据排除后才收窄。未发现复发则不制造生产修复，记录新增并发资格和下一行动，仍保留完整配置性能等未达项。
6. 所有原输入/回复自然收敛、公开shutdown、原句柄join、physical/output/request/launcher后退休runtime/private完整对；raw buffer日志在下个scope前保存。最终readonly完整历史与原双会话Message/Part/Source逐行核验，schema保持3。秘密值扫描、三索引/当前docs检查、范围提交、fresh fetch/merge及完整待推送集合复核、正常push/fresh fetch；无branch/worktree/PR/tag/Release。整体goal active。

## 中途证据与检查器修复方案（修改前）

18793诊断两流真实重叠，4/8实际Sol，原74013及业务58458均exit0、shutdown200、输出/请求/physical/runtime对结算；原始dev日志已在下次启动前保存。103条去重console覆盖12:02:47—12:09:16 UTC，侧栏scroll owner1仅一次创建；旧成员正文owner9—18和新成员回复owner22在已接受HTML后保持同一身份与非空HTML，列表/关闭重开/file tab切换均保持原阅读。主区owner21在关闭dock时退休，重新投影owner23，不能误报为侧栏owner退休。23个Markdown owner包含主区初始虚拟化，不把总数当作闪烁。

18795当前正式UI的旧Sources与列表往返实际一致；新增parent/member回复分别7013/6284字，HTTP200/stop。实际出现检查器证据缺口：12:12:49快照父回复已3102字且未完成，但最新Provider文件父work仍awaiting_binding，父memory仍reading。最终EOF快照却包含正确父work Session/request/assistant。直接代码根因是RealProviderAudit在fetch响应和settlement发布快照，onBind只改内存而不发布；绑定后若没有另一个fetch/terminal触发发布，磁盘观察者会读到过期等待状态。capture-live读取最新数字revision正确，不能靠放松reading判定修复，也不能把该现象报成业务请求缺失。

已全仓检索RealProviderAudit/安装点、onUpdate、注册/take observer、当前架构及对应测试：该类只为验收脚本/原生审计插件所用，单一Response WeakMap绑定不参与LLM路由、业务队列或终态权威。Task/Mission/Session、重试attempt与多项目都经过同一真实Provider source-reader，观察器身份直接来自其输入；普通/EOF/错误/abort/cancel共享settlement保留。当前实际HTTP与最终持久消息/输入身份完整，无调度或终态异常证据。先修唯一审计器onBind完成身份复制后发布一次；不按chunk写磁盘、不加轮询状态、缓存或fallback，不改变真实流的读取/取消/错误结果。现有throwing publisher正向发布序列增加reading。新增两条实际本地HTTP响应并发，经现有source-reader wrapper绑定真实context、磁盘publisher，在消费结束前读取到两条reading及精确身份，再消费相同原字节并核验EOF；本地HTTP只证明审计器合同，不能冒充Sol或UI。

两原scope已完整结算且原生句柄join后，新增一个固定18797 scope，上限7，仍不超过最初整批16实际Sol（已用4+5=9）。复用当前正式UI，无需重建UI：只改验收脚本，不改产品前后端路径或schema。新scope在启动前采用修复后审计器，重新执行原checker及两条真实Sol有限输入；不得修改已运行scope或增加整批预算。最终三个scope均须结算和成对退休，再交付。

## 实施与最终核验

唯一实现改动为审计器onBind完成实际身份复制后调用原#publish一次；保留既有异常隔离和EOF/错误/abort/cancel路径，不按chunk发布。新增实际双HTTP读取的磁盘合同，既有发布失败正向序列纳入reading；三文件共41例/174断言通过（原56935 exit0），覆盖SDK同模型并发、同Session不同actor、延迟使用、逐步响应、真实source字节与终态、诊断异常和凭据状态。backend typecheck原25408 exit0。产品UI正式bundle仍为当前472，无schema变更。

修复后18797原capture-live在12:17:09、12:17:49、12:18:11 UTC分别确认两条实际work source-reader都reading，回复均已有文本且未完成；两个Session/request/assistant/activity身份准确。期间实际列表往返、关闭重开、来源文件定位到原L2–3再返回，旧来源/正文/阅读位置一致。最终parent7104字、member6490字，均明确START/END、HTTP200/stop及EOF。18793诊断6695/6491字，18795正式7013/6284字，均自然完成。[21张实际截图与完整限定证据](../../artifacts/2026-10-20-parent-member-render-continuity/README.md)。

原生74013/19684/85274、三个真实业务输入句柄58458/34183/79935全部exit0；第二窗口等待检查器40738自然结束并如实返回bothLive=false。三次公开shutdown200、native/physical/output/request/launcher全结算后退休runtime完整对；每轮raw dev.log已在下一启动前保存。最后扫描186个实际文件中的源/复制凭据值后退休private完整对，源元数据保持，未refresh/exchange；临时IAB25/26/27已关闭。

最终请求计数纠正：此前中途写4+5=9使用了未结算快照，漏计第一scope的真实memory调用。最终数字revision审计为5+5+5=15，仍低于原整批16实际上限。第三scope上限7是在错误中间计数下计算，理论可允许总17；本轮实际未越限，不能声称这个单scope上限足以保证全批16。此后剩余额度必须用已物理结算scope的最终审计计数计算；不改写本轮上限历史或把memory剔除计费。

保留完整原139/188身份/目录/归属，最终142/191/schema3，各轮一个实际预检Project/Session。原双会话20 Message/48 Part/38 protocol含rowid全部逐行相同，原Session仅time_updated随新实际输入变化。当前无新Rendering复发证据，不给渲染器制造补丁；已补齐父与成员同流这一实际缺口。配置保存10秒/5秒等既有未达项保留，整体Goal active。提交前运行docs:check、差异与凭据复核；范围提交后按当前upstream正常fetch/merge、完整待推送集合核验及push，最终Git事实追加于交付。
