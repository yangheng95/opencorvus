# Task 与 Mission 的原消息查找

## Recall

用户要求持续单agent自主体验UI（User Interface，用户界面）/UX（User Experience，使用体验）和功能、分析后落盘、实页/截图人工复核、范围提交与fresh upstream合并后正常push；最新禁止子agent，覆盖长期Goal旧的三个Astra。只在无法安全取舍的实际冲突等待，不新建branch/worktree，不操作用户18571页面/窗口/进程/数据库。Dependabot一次重扫790已消耗，不重复。长期Goal保持active。

806为实质progress：e81a37e8d9c06f554b0aef0dc7c0b26e1c16c2c7已推main，01:26:53.924Z fresh fetch/merge HEAD=origin/main、0/0；56本批文件干净，三共享索引行HEAD/working各一次，179外部改动保留。新增归档库Open和已有导航ready分支关闭Settings；15本人实页/20原生HTTP读取、build/type/i18n2638键/docs352操作26组和全部正常hooks通过。两个scope全部shutdown200、原exec/native/launcher0、物理/输出/请求结清，配对auth/models副本退休、源auth metadata和catalog字节/metadata保持。源806-after库schema9/92表204849行，204673原行精确保留、75附件/六namespace和五QA项目12tracked/Git保持；模型0/累计1083。

本轮起先检查Goal默认流程；重读729/764/763等当前记录后，确认真实Goal创建/预算/完整执行已有证据，不将旧反馈当当前复现。转向任务结果的原消息查找。已读当前AGENTS、07-panel导航/查找/导出合同，App内ChatViewTitle快捷键和菜单，ConversationSearchDialog完整快照与定位，conversation-snapshot/search/export、公共完整Task transcript和Session export路由、taskSessionIDs目录/Project校验、conversation历史80尾窗及现有旧页reader、tree-writer实际message→rendered-card映射/可达性和scroll writer。已搜索全仓定义/调用及763查找历史。触及源无外部更改；当前无807服务，未发Provider请求。

## 修改前分析与已知边界

当前App快捷键和Find菜单均只允许WorkLedger kind=chat（包括Chat/Work）；Task/Mission没有入口。Dialog target只有sessionID，locate明确拒绝source.kind=task。已有真实Task/Mission信息量较大，却不能使用同一原消息查找。先以真实页面确认缺口，再实现；不靠标题判断Bug。

Task已有GET /task/:taskID/transcript，单一loadFullTaskTranscript从同Project的真实Task根Session树读取全部原Message，按producer order投影。默认scope经requireRouteTaskInCurrentProject校验；不需要复活已退休Task JSON/archive导出、新建接口或反复抓有限80/2000尾窗。Mission沿原GET /export/session/:id完整Session快照；原Session ID校验继续有效。实际可用Task g00VZH4Swp00oZbphtIe有68消息，Mission ses_-zUQYZsqLzz6t3a5Qq9O有80消息。没有超过80的真实Chat/Work，不注入假消息或开模型循环造数据，不宣称分页分支已实页通过。

当前readConversationSnapshot的原Message/Part校验可抽出单一消息数组reader，Session调用保留原Session身份严格校验，Task数组调用允许各真实参与者Session身份并验证其非空、真实Message ID唯一、role/author/time/parts。保留原对象、Session身份、生产顺序与错误合同；不把Task伪装成根Session、不改写消息、不新增持久快照或后备数据源。find函数只依赖messages，可按该最小结构接收两种既有公开读取结果。

Dialog target应明确kind+id+directory；load/定位/退休共用当前authority、selection epoch与精确身份。Task和Session均沿现有ownsConversationHistory、loadOlderConversationHistory、真实tree-writer卡片定位、父级展开和唯一scroll writer，不从DOM抓文本。App将Find与Chat独有导出分开，保留现有导出范围。所有新增控件复用当前语言键、日期/数字；用户/模型原文和Agent身份保持。

未证点：Task多参与者原消息不一定都已在主卡片树可达。必须实际搜索并定位原始人类/协调者与Builder/Tester记录，若已有映射不足，先补充根因与当前子会话导航/卡片合同分析后修复，不能以仅最终摘要定位成功宣称全覆盖。若观察调度/队列/唤醒/恢复/并发或终态异常，立即横向审计全部生产入口、Task/Mission/Session轮次、正常终态、重试重启、串并行和多Project；不以只读UI范围为由掩盖。

## 实施前验收方案

1. before38384/after38385，从完全退休806-after原生SQLite backup保留204849行/92表/schema9、durable数据/包revision和75附件。除原五项目外快照上述Task与Mission两个现有QA项目的Git/index/status和全部tracked字节。启动前固定60分钟物理诊断截止，候选沿原截止、至少提前5分钟shutdown；native用精确物理进程寿命，短checker用既有inactivity工具。配对复制已授权OpenAI认证+完整models，只本地注册/精确gpt-6.1-sol目录投影，模型最大0/累计1083；不启动Goal或执行历史指令。
2. 原版真实Task/Mission标题菜单和Ctrl+F确认缺口，保留原截图。正式GET捕获完整Task transcript、Mission完整Session及各conversation hydration/Goal/status的原值、原Card/事件身份。新UI前先写入最终根因/影响分析，不预设实现即通过。
3. 复用当前Find对话框/键盘/焦点/错误反馈，接两种现有完整消息reader与单一校验；Task/Mission作为真实source进入原定位，不增加API/SDK/schema。非UI解析变更补聚焦正向数据/错误合同测试，既有pure JSON序列化测试非UI；不新增/修改/运行UI自动化、DOM/组件/文案/快照测试。实际HTTP和页面证明完整原路径，fixture单元结果不冒充端到端。
4. 本人实际查找真实Task68/Mission80消息，验证原全文/作者/数量/本地日期、键盘Enter、定位高亮、原参与者消息、刷新/Esc返回焦点、查询中切来源的退休，以及原Chat/Work回归。截图原样保存并亲看，build/type/i18n/docs不替代视觉。范围不足如实标记；Task参与者映射若失败须修真正来源问题，不过滤掉难定位结果。
5. 原数据只读，除正常runtime/通知消费事实外所有原业务行和计数须由原生SQL EXCEPT精确保持，原库和附件/项目字节/Git不改。所有自有页关闭、公开shutdown200、原exec/native/launcher0、物理/输出/请求及原出生身份结清；退休认证/models复制对，核对源metadata和catalog字节。同步产物README与三索引/当前架构、当前文档检查，范围提交、fresh fetch/merge、完整待推集合、正常hooks push和fresh同步；不发布版本/tag/Release/PR，Goal继续active。

## 04:11 UTC 恢复核对

原807-before的完整实际HTTP已取得Task68/Mission80/Chat3/Work8消息，Task completed、Mission非进行中、Goal complete/148493/3、所有原历史已保留；但仅打开了Task的加载中页面，尚无标题菜单缺口截图。恢复时已超过原绝对期限；原exec84849实际正常0，定时器在02:39:05.392Z公开shutdown200，原native/launcher0、物理/输出/请求及出生身份结清。原始截止02:44:05.296Z未改写，原页面只作停服页面清理，不当产品故障或菜单验收。

复制auth/models已实际退休，源metadata/catalog字节核对全true，Provider0。旧retire诊断器把“提前300000ms发出shutdown”误作为“native完全退出后仍剩300000ms”断言，实际终态余299787ms，所以原检查exit1保留；独立timer-retirement-qualified核对原计划、真实发出时间、200、0退出和已退休复制对，记录清理已完成及终态300000ms指标未达，不伪装原UI验收通过。原库204849，旧scope仅增加runtime lease/grant成为204851。

后续用新807b-before38386/after38387，从已完全退休旧807-before的204851行续存，7项目/25tracked与全部75附件继续保全。新的单次60分钟截止在首次启动时固定，候选共用该新截止；不复活旧服务或延长旧期限。原公开接口、0模型与全部业务范围不变。先尽快完成真实原版两类菜单证据并正常关闭，再离线实施和构建。

## 04:19 UTC 实页确认和实施决定

新807b-before已实际读取相同四类原快照/历史/Goal，Task原68消息、Mission80、Chat3、Work8及原终态保持。本人已看图01/02：在线Task菜单只有诊断/置顶/重命名/归档；在线Mission菜单同样没有Find。历史Mission显示的旧恢复失败与shutdown消息是已捕获的原历史，当前只读请求无新执行，不以历史最后错误当本轮新故障。该scope已手动shutdown200、原exec26046/native/launcher0、三项物理结清，余3436400ms，复制对退休，原metadata/catalog保持。可离线实施。

实施采用最小现有接口路径：消息数组解析抽为一份内部reader，旧Session export继续严格绑定单一Session；新的Task transcript适配保留每条真实Session/Message/author/Part原对象与顺序、全局Message ID唯一。原错误名/码保留。Search仅要求messages结构，不伪造Task的Session元数据。Dialog target改为明确kind/id/directory；按kind调用既有Task transcript或Session export；原authority/epoch/target退休与history/card/scroll/focus不增加第二实现。App把Find放出Chat独有export分组，快捷键覆盖当前三种Work Ledger身份，JSON/Markdown导出范围保持。先以一份候选检验主卡片和真实Builder/Generalist消息定位，若不可达即按真实观察补根因再修，不删难定位结果。

## 候选实页发现的消息定位根因

候选main-BwGMRdi4加载Task68消息，Decimal9条覆盖mission/orchestrator/dynamic-builder/dynamic-generalist。菜单和Ctrl+F真实可用，但首条mission结果只高亮其所在协调者卡，原需求仍在Handoff context折叠中；点击Builder第一条结果会打开真实Builder Session，却停在该Session末尾。截图05是定位中间态，06/07为稳定结果，不能当原消息定位通过。代码确认：Dialog只传cardID；Conversation的scrollTarget把子消息转换为subagentProgressCardID，打开侧栏后即返回true。侧栏的唯一AutoScroll reader按其原阅读位置/默认末尾开始，未收到任何消息身份。旧Chat查找只验证卡片，没有覆盖这一跨surface语义。

修复范围扩展至现有conversation-scroll请求、Conversation主滚动owner和SubagentConversationPanel实际reader。请求携带原messageID；主owner对自身原message run展开对应delegated-context并定位该run，对子Session则在既有摘要定位后把同一请求交给子surface owner。子owner等待其原resource成功、校验相同source/authority/Session和messageID，沿既有reader暂停跟随并滚到原run，高亮该原消息；失败/身份退休应返回false并保留现有错误提示。瞬时导航请求不持久化、不复制消息数据、不增加后端读取或平行滚动writer；现有卡片导航无messageID时保持原卡片语义。无需数据库、API、调度或运行状态改变；当前仅真实历史展示，未观察新的调度异常。

第二候选main-9Cs7FvWr能把请求交给真实子reader，但截图08为异步定位中间态；稳定图09仍显示后续消息。只读DOM几何确认目标msg_g0VZH4wwO00JByRtLgon的top=-122.1875、height273.609375，侧栏内容起点约144，原消息几乎完全在视口上方。原消息身份和内容正确，错误在单次scrollIntoView后就接受，未参与侧栏加载/布局收敛。不能以打开正确Session代替消息验收。

最终候选改用现有setupAutoScroll的位置恢复事务：瞬时导航修订仅重建同一reader，初始position与resolveTop持续从原message run计算、following=false；等待原布局稳定回调后再返回实际成功并高亮，原阅读位置记录沿现有capture保存。不是另增轮询或第二滚动writer，不改通用AutoScroll实现。前两候选已手动shutdown200、原exec/native/launcher0并退休复制对；stable38389沿同一个05:17:04.614Z截止，未延长。

stable候选图10与只读DOM显示Builder原消息top159.8125、视口top144，原文稳定可见，布局恢复修复有效。但图11在选择Generalist原结果时报错。原生日志04:39:01.626Z明确为Original message has no rendered target；原完整快照和hydration都包含该Message，agentView包含同Session的completed真实记录和lastDisplayMessageID；原主tree函数却要求旧消息卡从cardTree.order/childIDs可达。成员的实际可见入口已经是独立progress tile和完整侧栏，旧消息卡可达性不能作为成员全文导航前提。

因此以真实参与者身份确定唯一展示surface：当前agentView中的子参与者消息使用现有subagentProgressCardID和完整侧栏reader；其他主消息仍使用原writer映射。完整快照提供原Session身份，当前source限定的agent record提供真实入口，未加载时沿原旧页读取补齐。不是用摘要替换结果，不生成原文或放宽Project/来源身份校验；侧栏必须找到同messageID并完成原reader恢复才返回true。原渲染卡层级与调度/终态数据无需修改，只有查找错误地把主树卡片可达性套在成员独立surface上。

qualified候选main-lMrdy3BF已实页通过Generalist原复核（图13，message top160.453125/viewport144）、Builder中文查询（图14）、ROUND_HALF_UP8条/刷新保留（图15）、原需求展开（图16）以及Mission菜单/完整80条/counter.py2条/原需求定位（图17–19）。进一步查找真实结构化Server shutdown得到2条，但选择最后一条失败（图20，日志04:46:06.080Z：Original message could not be located）。原消息有MessageAbortedError及真实ID，主writer将多条原消息并为一张卡，只保留latest settlement在卡级；CardParts逐消息failure投影仅子侧栏具备。DOM停止容器错误使用合并卡首条msg_g0VZRQ7CL00xKzaMN4Dp，而被选中原停止消息是msg_g0VZRTEmq00YPsVX5xmm。

补齐同一CardParts已存在的messageFailures公共字段：主writer从每条真实Message现有settlement投影原ID/reason/details/cancelled，包含只有失败而无正文的原Message，建立对应boundary；稳定比较按这些字段值判断，避免每次regroup重建。卡级独立生命周期错误仍沿原显示；有真实逐消息失败时仅由逐消息owner呈现，删除重复卡级正文。该调整属于界面投影，无数据或API变更，按用户禁令不新增UI自动化，须重新实页复核两条停止记录和正常Chat/Work，不能只用类型/构建验收。

## 最终实页、数据和收尾证据

最终main-BUN5yVuf于38392开发模式实际交互：两条Mission原停止Message分别定位（图21/22，DOM原failure/message身份一致），Chat3条中原文回看788命中1并定位原回复及附件（图23），Work8条中阶段三命中4、真实goal-controller/work作者及最终交付保持，Goal仍complete/148493/3（图24/25）；Task的Generalist与Builder分别真实定位原文（图26/27）。切换隔离页简体中文后，空状态、查找标题/提示、刷新/关闭、9条Decimal匹配、中文日期和原参与者身份全部实页复核（图28）。刷新保留ROUND_HALF_UP查询和8条结果；Enter定位、Escape关闭和返回原控件通过。此前构建未结束时私有PowerShell执行链在Node前置失败后仍继续启动旧包；该accepted scope无浏览器验收，已shutdown200/原退出0/复制对退休。后续冻结与启动拆为单独顺序调用并检查前步exit，最终使用已完成构建的新包，不把误启动算通过。

最终服务已在04:57:03.125Z原exec/native退出0，公开shutdown200、输出/请求/出生身份结清，余1201573ms，配对副本退休、源auth metadata和完整catalog字节/metadata全部保持。所有7个新scope均沿同一05:17:04.614Z截止，已逐个关闭，模型0/累计1083。原始807的299787ms严格终态指标失败如前保留，不追溯延长。

原生SQLite逐表EXCEPT检查8个库（源与7scope）：92表/schema9，全部204851原行，包括TEXT/BLOB精确保留；最终204863行，唯一增加6条runtime process activation lease与6条grant，所有业务行数和原值保持。7项目25tracked文件、Git/index/status及75附件/六namespace源/副本字节保持。实页前后四类selection/full transcript/hydration/Goal完整真实HTTP响应逐值一致。原用户18571和真实数据库未操作。

最终浏览器warn/error日志为空；17个聚焦纯数据测试通过（2 transcript/8 export/7 search），最终build/type/i18n2638键通过。不以工具结果替代上述28图人工验收。真实超过80条分页、输入法组合输入、请求中切来源竞态尚未确定性实页验证，记录为本批边界，不伪装已通过。同步当前架构和三索引后执行当前docs检查、范围提交、fresh upstream merge/待推集合复核、正常hooks push和fresh回读。当前版本族、CHANGELOG、依赖与发布配置由用户授权另一会话处理，本批不改动，不因无实际文件冲突等待。

当前docs:check已实际通过（352 operations/26 groups），差异空白检查通过；最终原生build/type/data contracts/i18n/docs原始输出和退出回执均随产物保存。范围交付仅含本批9个生产文件、纯JSON解析测试、当前架构、记录、产物和三条索引行。共享README的其他会话插入/排序、版本/依赖/发布/benchmark改动均保留在原工作副本和索引中。
