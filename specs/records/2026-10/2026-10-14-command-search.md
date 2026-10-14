# 命令面板全历史搜索

## Recall

用户要求持续自主迭代UI/UX与功能、修复实际问题；最新明确只使用单agent，旧goal内三个Astra条款已失效。主目标仍包含Sources显示和成员Rendering，本轮不借搜索修复宣布整体完成。旧数据清理、删除MySQL转换、当前版本1迁移基线已经交付，不再删除或重建用户数据。

上轮是progress：8dad4d664ff50d58141cc16c15bd11f5ddc3e9fe已正常提交并push（原9027 exit0），本轮开始git status仅他人CardParts/SideChatPanel/side-chat/interaction/transcript、语言文件、CHANGELOG和索引/架构等修改。数据库回写、共享运行时退出结算及Bus恢复已交付，最新独立复制3388ms/完整263事件789回执3674ms，既往6353ms波动保留；20条Sol流200/EOF且所有自有进程/页面/配对退休。持续goal仍active。

408的真实中文localhost /ui中，命令面板搜索“请独立完成一次逐条阅读”显示无结果；关闭后展开项目列表，确有原Session ses_-zUS2EY0ezzjFidQwBy1且能打开38条消息/36组Sources。该事实来自真实交互，尚无该失败状态的独立截图，409先补拍修前。408的AX索引复制差异未稳定复现，不能误认其根因或与此搜索混为一事。

已读CommandPalette.tsx全文、work-ledger服务、WorkLedger完整分页reload、公共work-ledger路由及projection搜索/分页、ComboboxControl、cmdk样式、相关中英文文案、当前07-panel与07-panel-reactivity、2026-10-04产品体验记录和10-05连接所有权决策；检索CommandPalette全部调用/事件/快捷键、loadWorkLedger所有生产入口与现有后台测试。历史要求保留最近项上限并复用现有后端，未授权第二搜索数据库。本轮继续遵守此合同。检索到的text-search.test是纯字符串数据映射测试，不是UI渲染测试；未找到命令面板UI自动化，禁止新增/运行UI自动化。

## 现象、根因与影响

CommandPalette只在打开或API authority变化时请求loadWorkLedger(limit12)，丢弃Project行、展开Mission子Task后slice0..9。query仅对这份截断结果本地过滤；输入不会调用已有search参数，也丢弃nextCursor。因此9条以外的Chat/Task/Mission不可能成为候选。主WorkLedger已有80行分页完整读取，解释了列表可见但命令面板找不到。旧Mission行修复和连接所有权修复处理的是候选种类及迟到请求，并未处理查询数据流。

当前Ctrl+1..9从未过滤commands取值，搜索后仍可能选择隐藏项；groupStart也在过滤前计算。无结果提示在加载/失败时都可能显示，读取错误仅去全局诊断。需要一起修复当前查询、可见行、快捷键和状态反馈的契约。

共享后端WorkLedger当前使用未经转义的LIKE模式：%和_会被当通配符；面板声明的是大小写不敏感的完整子串，且本地keywords包含kind。接入服务器查询时须明确统一当前语义，不能用过宽结果截断或双份本地全历史缓存绕过。计划把现有搜索参数定义为literal子串，统一转义反斜线/%/_，在原SQL语句显式ESCAPE；Chat/Task/Mission的技术kind和Mission内Task也作为现有可搜索字段，匹配当前面板关键词。它作用于同一active/archive projection，各自原归档/删除/Project边界保持。没有schema、事件、调度、LLM或写入协议改变；不需要数据库迁移。Unicode原文、身份与目录不翻译；本轮界面资格为中英，SQLite非ASCII大小写折叠范围不扩大或猜测。

## 唯一实施方案

1. 空查询仍显示最多9个最近可选择项及原常用命令；数据通过当前work-ledger入口和规范cursor取到足够有效行，Project行不占命令名额。非空查询向同一接口发送search并保留分页；初页与“加载更多”使用同一API authority、查询和AbortController所有者。连续输入、关闭、重开、连接切换均退休旧响应及错误/结束回调，不新增共享缓存、备用接口或epoch。
2. 查询页保持有界，必要时跳过仅含不可选择Project/不匹配父Mission的页，直至取得有效结果或cursor结束。Mission子Task来自同一规范行，不另查或合成记录。已接受的分页结果按kind:id去重；没有数据改写或合成消息。更多结果通过现有Button/文案明确提供。
3. 本地命令与远程工作项组成唯一可见列表；过滤后计算组头与前9个可见工作项的数字快捷键，Ctrl+数字使用同一可见列表。Kobalte Combobox仍拥有高亮/焦点/键盘导航，现有onSelect Chat/Task/Mission保留真实源/目录/模式与取消合同。
4. 加载、失败、空结果区分；搜索失败用现有Feedback展示本地化摘要及原诊断，重试仅针对当前读请求。分页失败保留已接受页并重试当前cursor；不把失败包装为无结果。使用现有设计token及组件，不做无关样式重设计。语言文件已有他人修改，只提交自己的键及文案差异。

## 验收与交付

先用独立正式开发服务 /ui补拍旧标题查无结果和列表可打开的修前事实，再改代码并构建独立前端产物。沿已资格Native Host 600秒/8请求的完整auth+models配对预检与原物理关闭流程；这是自有406长历史数据，不操作用户应用。必要新验收输入只经正式Session/Chat接口建立真实空对话标题，不制造用户/模型消息；真实模型调用仍流式。

后台聚焦正向测试覆盖旧会话被准确查出、字面%/_/反斜线、大小写ASCII与中文、技术kind、目录/Project作用域、稳定cursor及归档合同；使用package声明bun run test。UI只实际交互截图人工查看：原旧标题可搜索并打开同一38条正文/Sources，快速改查询、关闭重开、更多结果、Ctrl数字选当前可见结果，空/加载/错误/重试及中英文。未实际资格的范围明确列出。现有相关UI自动化一旦发现须删除而不运行。

改动范围预期CommandPalette、cmdk样式、中英少量键、work-ledger/projection及聚焦后台测试、07-panel架构和本记录/证据/三处索引；先保存已有差异，保持其他文件。运行类型、构建、当前docs:check及正常push hooks。范围提交前重读最新HEAD，以临时index只包含本批（共享索引仅本条），检查实际父提交并同步正常index；fresh fetch/merge，审核完整待推送集合后普通push，不发布、不建branch/worktree。直到全部要求有相应证据前，不把本批或持续目标标为完成。

## 修前与初步实现证据

修前Native Target79676、occurrence command-search-409-ad9c5dba-cdcb-438b-a39c-82962b4aeac8，凭据usable/模型catalog projected/actual gpt-6.1-sol streaming预检通过。Root在自有Tab12实际输入旧中文标题，01截图无匹配；展开项目并打开原Session，02截图显示真实正文/read/Source。公开GET work-ledger?limit=12实际返回6Chat+6Project并有nextCursor；同一接口带search可直接返回原ses_-zUS2EY0ezzjFidQwBy1。原页面已关闭，公共shutdown与原76184句柄exit0、Native/Host/output/request和配对退休齐全。此两GET不是UI自动化。

[SQLite官方表达式合同](https://www.sqlite.org/lang_expr.html#like)确认%/_及单字符ESCAPE规则，默认仅ASCII大小写不敏感；实际生产LIKE语句已统一显式转义。首批后台3项通过，Mission案例因本测试漏传当前必填heldExpertSquadIDs而失败，已按当前定义传入真实基线base后4项16断言通过，没有修改Mission产品合同或保留旧入口。前端首个检查命令误猜本package TypeScript磁盘路径而失败，改用package声明typecheck；正式类型检查准确指出新增Button漏传size/tone，已补齐已有primitive必填项。原失败日志保留。

前端读取只复用现有loadWorkLedger/search/cursor，仍由原AbortController与API authority确认当前查询；本地字段子串匹配使用已有matchesSearchParts。修后画面、分页布局、键盘、加载/失败重试以及中英资格仍待真实页面检查，类型通过不能替代。

## 实际页面追加发现与实施边界

修后Tab13已实际搜索旧标题并用Ctrl+1打开原38条历史/36组Sources；03、04截图人工查看。搜索Reply with OK实际取得12条并用加载更多取得17条，05、06截图显示面板与结果保留、长列表可滚动；初步担忧的点击footer导致面板关闭没有复现，不为此增加primitive旁路。实际确认的问题是最后一页button移除后AX焦点落到WebArea，键盘用户失去输入焦点。

修复限定当前读操作：记录加载更多/重试按钮原本是否有焦点，await同一个当前查询完成后，只有当前source仍有效且DOM焦点确实落在body时，才以preventScroll恢复输入焦点。用户已聚焦别处、关闭、换查询或API authority已变化时均不抢焦点；不添加时间重试或自动选择命令。

中文AX还实际报one option available和Suggestions。读取当前安装的Kobalte公共combobox.intl及ComboboxBaseOptions确认默认是固定英文，I18nProvider只管理Locale/方向不会替代这些文案；其已有translations参数正是支持的入口。本任务检索ComboboxControl全部两个调用者（CommandPalette、ScheduledAutomationsPanel），在唯一wrapper接入当前t/localeTag，包括焦点/选中、选项计数、本地化数字及建议列表名称；保留原option文本，新增中英文键，不修改node_modules或加入另一Locale来源。第三方依赖附带的测试未运行，也不作为仓库UI测试处理。新增wrapper和两个实际调用页面都要做人工可访问状态/截图确认。

当前Backend类型检查在他人的新compaction-user-text.ts第104行报output unknown；本批projection与UI没有对应类型错误。继续独立UI验收，交付前必须复核并解决正式检查，不能把此失败写成通过。

## 最终手工页面与工具链状态

13项后台合同48断言通过，原66625 join0；官方前端类型检查原74881也0。加入共享翻译时，Kobalte0.13.11的公开translations类型把countAnnouncement返回值错误收窄成英文literal（其default分支还漏return）；源码实际交给announce的是任意string。只在该公开回调边界做类型断言，保留其余字段类型检查与唯一当前t/localeTag，未修改依赖或返回假英文值。真实页面已分别显示18 options available、有12/1个可选项及候选项。修正后官方typecheck原38160 exit0；该断言只改变静态类型，不改变已构建的翻译回调行为。

修后首版Target77688/原59447 exit0已退休，7张当前累计截图包括查询旧标题、Ctrl+1进入原Sources、分页、英语空状态。最终版Target84172、occurrence command-search-409-d3b97b5b-9d6e-427a-9e5d-f69eab751ac2、原28421 exit0，使用独立final-bundle；最终UI截图08确认18个结果并焦点在输入，09真实Loading、10精确命中“409 搜索_50%\\中文”，其选项data-command-id实际为ledger:chat:ses_-zUS13uVxzzlSBCKZmJ4，与正式POST201/PATCH200记录一致。这个新对象是实际空Chat，只设置标题，没有合成消息。

11中文旧会话查询及Ctrl+1确认原Session；12/13实际进入未提交的定时表单、键盘展开419个时区候选，中文计数/候选名正确，Asia/Shanghai原值保留，随后取消，没有建立定时任务。14/15是在精确自有Target84172正常shutdown且物理/输出/request与配对退休后，真实网络不可达引出的中文错误/原TypeError诊断；没有用mock响应或浏览器故障注入。

保持同一Tab14及原查询，创建新独立recovery occurrence command-search-409-780cd138-ae97-4669-b2fb-c2dedad2bd17，Target88044配对与实际Sol预检通过；真实点击重试后16截图重新得到原38消息会话且焦点回到输入。随后英语切换、正常关闭recovery（原41175 exit0），17截图显示英语失败摘要/Details/Retry，最后Tab14关闭。正常关闭没有扩租约或调用用户进程。修前原Tab12、首修Tab13及最终Tab14均已关闭。

该恢复资格是同一URL、同一持久数据在新进程中的恢复。不同URL/凭据authority切换时的迟到返回仍只具有保留并复核的代码合同，没有本轮跨URL手工资格；不得冒称已覆盖。快速换词只证明实际当前输入与结果一致，未借此宣称人为延迟响应竞态或全部极端负载通过。原生date/time控件仍按浏览器格式显示，本轮仅资格共享组合框，不扩大为整个定时页面的全部语言/行为完成。

后端整包类型检查仍需重新执行：上次失败来自其他任务未跟踪的compaction-user-text.ts（output unknown）。保留其完整工作，不把该新功能混入搜索提交，也不绕过hook。当前搜索/共享控件功能及真实页面是进展；剩余资格和推送结果必须按实际后续结果报告，持续goal保持active。

## 最终检查与范围收敛

恢复上下文后已先重读Recall和git status。旧并行检查的工具返回未进入本次可读上下文；查看物理进程确认相应tsc已结束，不以空日志推断0。重新执行后端正式TypeScript检查并join原67257，实际exit0；原compaction未知类型问题已由其所属改动d6fc0a555解决，本任务没有改动该功能。重新执行check:i18n与docs:check原命令实际0。前端最终官方类型原38160、构建原69675的0及后台13项48断言原66625的0保持有效。没有新增产品修改导致这些验收失效。

四次Native最终provider audit逐一读取，实际共8条gpt-6.1-sol streaming，均HTTP200且provider-source-reader terminal.kind=eof；四个physicalCompletion/outputDrainComplete/requestCleanupComplete与配对退休事实均完整。17张原始截图、直接API调查、失败和通过日志及原最终Native审计已归档到[验收证据](../../artifacts/2026-10-14-command-search/README.md)。截图11/16再次人工查看，确认相同长中文标题、原Sources正文以及重试后的候选。所有自有页面与进程均已关闭，未再清空数据。

当前共享工作区还有权限、InteractionCard/Checkbox、定时表单和相应文档等他人改动。提交只包含本批搜索/共享组合框、后端字面搜索及正向测试、语言七个相关键、自己的07-panel末节和三处索引条目；使用临时index从最新HEAD构造，外部新增文案与其他架构段落不混入。提交后仍须fresh fetch/merge并检查完整待推送集合与正常hook，推送状态待实际结果补录。持续目标保持active。

## 提交与实际推送结果

范围提交为`2d800e4a92a1508f1386be8e01a4d309d08f11d6`，实际父提交与准备器声明一致，均为`8c42e5d39806cd844a7f072439580e8e32b1402f`，共75个本批路径。原92998工具整体返回1来自提交后的普通index同步阶段：并发Git持有index.lock，Git commit本身已成功。未删除他人锁；在后续锁已正常释放后，对同一审阅patch重新check并apply --cached，实际0，普通暂存区恢复为空，本批工作区无未提交源码，未覆盖他人修改。

fresh fetch/merge实际up to date。审核完整九个待推送提交：本批搜索；8c42e5d39定时语言（10项57断言、12张实际图）；e3c3d1aa7与0fe812062 Provider身份（真实双配置保存、IPv6 51项91断言及截图）；b767b9325目录浏览（正式真实两Project和链接工作流、独立Native/截图/正向合同）；d6fc0a555压缩（95项合同、最终72条真实Luna流及双方向20动作100字段）；其余79ee53039、3c5f8d2a0、ce798bfc4是各自授权交付和失败回执文档。依据是各自已提交Recall/原证据，非提交标题；原有限验收边界保持。

正常push原34161实际exit1。迁移v1检查、SDK/AI运行时检查、八个工作区类型任务、路由和docs检查已通过；随后共享control-lease-owners检查明确失败：工作区`permission/authority.ts`声明1个acquire入口，实际2个。该文件及权限测试仍是其他独立任务的未完成修改，当前已提交版本与本批搜索没有该新增入口。没有为绕过检查修改注册表、还原他人文件或no-verify。原失败日志与退出事实归档；本批已提交但尚未推送，后续等待该真实权限实现与其验证声明收敛，再重新fetch/merge、复核整个pending集合并正常push。持续goal仍active，可继续其他调查，未将此单次共享检查阻塞标为全局blocked。
