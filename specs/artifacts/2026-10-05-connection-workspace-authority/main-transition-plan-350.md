# 350 阶段交接与主会话阅读位置

## Recall

用户要求持续自主改善UI/UX（User Interface/User Experience，界面与体验）和功能，重点Sources和子Dock闪烁；最新只使用单agent，覆盖旧goal的并行Astra措辞。349为progress：真实36网页Source/37独立正文/47个Sol流、主会话交接跳位线索及完成态排除证据，716438ee433e8521e0f46d60c728fa5ee159eb34已推送且开始干净。全部349原句柄/页面/Native/Host/凭据配对已闭合。

349的05为11:44:24.195Z，主会话显示orchestrator/研究员进度卡；06为11:44:43.958Z，主会话却显示更早用户R20—R25。worker EOF11:44:38.846Z，负责人新reader11:44:42.538Z开始。child始终保持R05/R06和top1137.6。completed态两种重开均保留主会话位置，因此既不能把所有width变化判错，也不能把此问题写成worker流中反复Rendering。

## 已读、搜索与根因候选

已读349 Recall/截图/实际后端检查/阶段关联，196 completed缓存原边界，Conversation全部reading owner/保存锚点/恢复/Virtualizer generation/focus pin，SubagentConversationPanel、shared auto-scroll、App main/RightDock/右栏store、tree-writer resetWriter与全部reset调用、conversation hydrate/tail-merge及公开Task operator message/reopen合同、完整历史隔离帮助器。Task/Mission/普通Session主界面共用Conversation；Side和child共享auto-scroll，各有自己的阅读owner。

新读取349完整已脱敏runtime：11:44:30—51只有child transcript GET，无主conversation hydrate记录；11:44:39.982Z真实overlay:runtime报ResizeObserver loop completed with undelivered notifications。故当前证据不支持凭cache32就宣布主tree reset，更不支持从警告文本宣布某个observer死循环。

全仓找到27个生产ResizeObserver注册点，已分共享布局与挂载面审计。当前实际页面同时可能持有Conversation virtual-root/composer-clearance、shared auto-scroll、Card sticky header、ChatComposer toolbar、AutoGrowTextarea、RightDock tab reflow、main dock handle以及Virtua内部resizer。主/Side/child正常和终态都经这些同一入口；Card、Conversation、RightDock、main、Source/Tool阅读恢复通过既有animation-frame调度并在dispose取消；AutoGrowTextarea按width判等再写height，ChatComposer按width分档。未打开的Browser native preview、图片/PDF/截图、对话框、mention、CodeEditor和各类interactive artifact观察器不在349页面目标树内，不能凭注册存在归因。跨项目切换/重试/重新启动与worker错误仍须按真实owner退休核验，不能以单Task成功排除共享问题。

已读安装版Virtua README及其solid实现，内部ResizeObserver直接处理测量；README明确该浏览器警告可由其通知产生。权威[Resize Observer规范](https://www.w3.org/TR/resize-observer/#deliver-resize-error)将其定义为未送达通知的loop error，警告本身不识别哪个回调或是否导致可见跳位。不会过滤该错误作为修复。

候选包括：同时改变viewport与card高度时，虚拟列表尺寸补偿/浏览器overflow-anchor/主跟随控制竞争；当前reader在preserve treeEpoch只contentChanged、source切换才bind；后续stage改变实际items/order也可能参与。没有足够证据选择其中任何一个。正常worker完成及负责人继续都有完整47请求/终态证据，不构成引擎调度异常；若后续发现执行轮次/队列/恢复/并发异常，立即扩展至Task/Mission/Session全部生产入口、重试重启、串并行和多项目持久化事实横审。

## 诊断实施范围（不是修复）

临时在唯一Conversation组件的真实生命周期、已有onScroll、已有content/measured/epoch回调记录实际reader owner、treeEpoch/cause、following、scrollTop/height/width、已挂载card与可见文本锚点几何。使用现有AppLog通道，记录实际时间，几何相同不重复，最多4096条并保留达到上限事实。不给模型或界面注入任何消息/Source/状态，不改滚动写入/调度/缓存，不注册自动点击、截图循环或UI断言。诊断读布局可能改变时序，须明确作为限制；未复现不当成修复成功。

修改前保存并审查当前Conversation差异，仅该精确文件允许临时诊断；诊断源码与运行构建会归档。结束必须移除临时诊断并构建当前正式源码，不能留下第二实现或隐式配置。若取得直接根因，先补充所有定义/调用/公共合同/数据/测试/文档/交付影响再修唯一生产路径，并重新真实复核；无根因不得留下观感补丁。

## 真实重现与交付

使用349相同36题顺序网页读取，完整保留长原用户输入、37正文与既有缓存压力，而非替换成短易过样本。唯一隔离产品研究员用gpt-6.1-sol流式，root单独开发/操作。fresh main-transition-350-live-01，18327/ui；预先累计64请求、原Task openedAt起900000ms/无活动180000ms/native1500000ms，不续期。auth与完整models授权配对，分别预检usable/projected/实际模型。提前打开页面，正常CLI create、同request-id处理未知创建结果，真实API观察器记录text/Source，不属于UI测试。

在研究员结束前停留child旧段，同时主会话停在实际orchestrator/进度卡；在R35/R36至负责人新正文期间人工关闭、记录关闭状态截图，再重开并记录截图，解决349关闭阶段缺图的问题。观察正常生成与completed重复，实际截图逐张查看；原API/Provider/日志时序仅辅助归因。若本次没有恰好覆盖交接则如实写未达，不以Task Running替代worker streaming。

全部原句柄actual exit、Task与Provider闭合、自己的页面/精确Native/Host/output/request/端口/配对清理，脱敏完整证据。同步根/月/目录索引、docs和相关检查；任何修改都范围commit、fresh fetch/merge、全部待推送审查与正常push。goal继续active，原问题和新跳位均不得提前宣布完成。

## 直接复现与实施前根因补充

350第一次打开child就已跳位（01图），当时仅3段正文；02—04再次由开关路径复现。因此349关联的交接时刻不是必要条件，32缓存也不是必要条件。实际diagnostic owner=1/epoch=2保持，markdownPending=0；12:09:04.855先因Open焦点从following=true改false，width927、scrollTop2448，长user文本只有最后约19px仍在viewport中。随后width927→546，user card height2483→3541，scrollTop只在最初变为2424.8后保持，orchestrator从viewport top87→1168移出。原组件/正文没有清空或重建，直接原因是宽度重排增长发生在第一可见长item内部，当前主reader没有以所读段落补偿。

安装版Virtua的item resize补偿根据item起止与scrollOffset选择调整；停止滚动时首个仍相交的长item不按内部段落补偿。主Conversation现有anchor只定位整份TextPart及像素offset，且只在source/主动读位恢复时使用；viewport宽度变化只contentChanged，following=false时不恢复。旧196缓存处理remount、206处理child重开几何，349completed重复的首个可见叙述是orchestrator（长user已经离开viewport），所以没有触及此条件。ResizeObserver warning不是此修复对象，保留真实错误。

全仓MainConversationReadingPosition/保存/读取只在conversation-ui与Conversation，属于不持久化的当前authority/source阅读记录，没有外部API、数据库、模型、调度或配置契约。Task/Mission/Session所有主会话共享同一路径；Side/child已有独立owner不更改。没有相关UI自动测试，仍只用真实截图验收。

实施：把同一个main reading anchor细化到真实message/textIndex/blockIndex及块的viewport offset，同时记录当时viewportWidth；宽度改变后，普通scroll回声不得覆盖旧读点。已有measured-content回调把该记录交回现有pending/resume/controller，不加第二读位store、计时器或Dock专用旁路。仍已挂载的目标不必先滚到card起点，直接用现有pin与resolveTop恢复；未挂载历史仍沿现有分页/card-scroll。等待的是目标真实块可用，不因无关当前消息还在streaming而阻止旧段恢复。现有用户输入/authority/source退休继续优先，明确输入可采纳新width并取消旧恢复。所有临时诊断会先精确移除，再实施正式路径。

风险与验收：同段内部重新换行只能保留同段及相对像素，不能宣称字符级定位；无Markdown块的tool-only区域仍沿原absolute位置合同。本次必须在长user尾部可见时开/关右栏验证R34—R36及进度上下文，而非用orchestrator已是首可见item的容易样本。另验跟随底部、主动向上阅读和source切换恢复，检查新输入能停止恢复。完整37正文实际Task保留继续运行，但旧诊断画面只证明旧bundle；正式构建后需真实新截图，不把build/types当视觉通过。

## 当前恢复点（01完成，补在线回底验收）

01真实Task tsk_g00VXpv1u90022h0hCd6，worker ses_hhpfLk7aNEsSfk5buQuE；37段/36来源、47次Sol流全部EOF，原事件观察器75162 join0。原启动55633已在Task openedAt+900000边界按正常退出并实际join0，Native64056/Host76456物理/output/request/配对清理闭合；不是native25分钟超时。原时限不延长。自己的140页已关闭。正式图05/06/07在12:21:15—55，08返回图12:22:46均早于native12:22:55结束；09回底图12:23:23已离线，不算在线验收。

诊断bundle main-tXbiLIQv.js仅调查，源码保存在main-transition-350/Conversation.diagnostic.tsx。Git reverse patch初次因行末空白不匹配；核对完整diff与保存patch逐行完全一致后，ignore-space-change精确反向patch成功，没有覆盖无关内容。所有临时diagnostic已移除。正式改动只有Conversation.tsx、conversation-ui.ts及07-panel-reactivity，blockIndex/viewportWidth合同和既有restore路径。

正式build第一次12193/typecheck42041均0，随后新增width>0保存条件，最终build25822/typecheck60838均0，实际正式bundle main-BlTZ2Fml.js。正式真实图05—08证明R35块在width546/927/546切换、另一预检Session往返后保持，offset约-10.47/-10.72/-10.47。旧bundle02—04则从R35尾部跳回R23。尚需新短时在线Session验证回底/主动阅读，不能用09离线图代替。拟fresh main-transition-350-live-02、18328/ui、NativeService固定600000ms/12累计请求；普通单一Chat只确认收到同一36题长输入，用同一主Conversation补验，不创建产品研究员。auth+完整models仍分别预检。02结果只补共享Main回底/用户控制，不代替01实际Task和child证据。

## 在线补验暴露的输入接管边界

02原生fresh在线Chat已真实流式确认同一36题长输入。正式bundle main-BlTZ2Fml在正常开关和R35保存恢复通过，但11图“关闭侧栏后立即在chatScroll按PageUp”仍留在R31，之后实际稳定观察也未上翻。代码直接原因：auto-scroll先退休恢复并调用onUserScrollUp，但resize仍继续；新的measuredContentChanged看到下一帧width不同，又用按键发生前的段落记录启动恢复，覆盖了实际smooth PageUp。

共享auto-scroll已有inputIntent及250ms有效期、pointerScrollIntent，且它们已由真实wheel/key/touch/pointer入口持有和退休；不应在Main再造手势计时器。新增只读hasScrollInput访问器返回这一已有输入所有权。Main在输入有效期间允许实际scroll保存新width/新段落，且measured callback不重启布局恢复。其余Main/Side/child跟随和输入状态机不变，无新增调度或策略。全仓AutoScrollController只有该工厂构造，三个UI消费者读取原方法；新访问器仅Main调用。仍属UI修复，不新增UI测试。

必须用真实在线“暂停阅读→关闭栏同时PageUp→稳定后更早段落→再次开栏仍保持新位置”复验，11失败图保留，不改写为通过。旧临时diagnostic已经移除；本次正式UI验收不重新注入诊断。

## 按键注册顺序根因与03计划

02输入优先访问器加入后，Playwright locator.press组合仍未上翻；同一真实页面的原生PageUp能从R31到R19。13为原生操作，14再次开栏回到R31且已处于离线，不可当完整在线成功。02原启动81777实际exit1 / OWNED_QUALIFICATION_BOUNDARY_REACHED；全部请求/物理/配对已闭合，但其600000ms资格失败须保留，不延长。141页面关闭，02原件已归档。

代码另有确定的注册顺序缺口：首次setupAutoScroll的keydown先于Conversation自定义PageUp处理器；宽度恢复会cleanup并重建controller，新keydown监听反而排在Conversation监听之后。后者preventDefault，前者因defaultPrevented提前返回，无法登记inputIntent和退休restore。读取hasScrollInput本身不能补回一个未收到的输入。标准事件派发的capture先于bubble，参照https://dom.spec.whatwg.org/#concept-event-dispatch。改为shared auto-scroll在capture阶段登记键盘意图，removeEventListener使用同一capture参数；仍保留nearest-transcript/编辑框/combobox/slider/modifier/defaultPrevented边界，不阻止事件传播，不改Main实际PageUp动作。Main/Side/child所有controller重建均复用这一实现，无法再受重新注册先后影响。

03将在全部代码和构建准备完后启动独立NativeService，18329/ui，原600000ms/12请求边界，只用同一36题长输入的真实普通会话，原生键盘复核“R31暂停→关栏后PageUp到更早段→再开栏保持新段”及回底。用实际动作前后时间、DOM只读宽度、截图说明是否处于动画；不从快速组合推断精确动画时段。运行目标四分钟内完成和shutdown，不能让调查/编译耗尽已启动窗口。没有开发子agent。

## 最终恢复点

正式实现为Conversation.tsx、conversation-ui.ts、dom-utils.ts，架构07同步；全部临时diagnostic已移除。最终build59190/typecheck27988均实际0，bundle main-Byx48Ve-。03真实页面142、4个Sol流EOF；15→16→17为原生PageUp R31到R19后重开保留，16实际按键前width927，不能声称动画中。18使用与失败11/12相同的立即关闭+locator.press，按键前width860，确在动画中且成功到R19；19重开保留，20回底following=true。03启动26612主动shutdown后join0，Native71556/Host69948，219389ms，完整配对/输出/请求闭合；所有页面140/141/142已关闭。

01/02/03所有原件已归档，finalize实际后端检查通过（包含02的精确失败合同），121文本含解压内容凭据0。01Task512066ms、47流、37段5474字、36题完整读取；02Native599181ms/启动1资格失败，03Native219389ms/启动0。图片09和14晚于原服务退出，明确排除在线资格。证据入口main-transition-350/README.md与checks/actual-qualification.json，布局片段checks/first-open-diagnostic.json。现在剩余docs:check、范围commit、fresh fetch/merge、完整待推送集检查和正常push；goal继续active，单agent约束保持。
