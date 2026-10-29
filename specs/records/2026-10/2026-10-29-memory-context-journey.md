# 项目记忆可达性与检索体验

## Recall

用户要求单agent持续自主体验、调查和修复当前产品，先完整根因/影响分析及spec，再实现、真实开发页交互/截图人工复核、适用的聚焦正向非UI测试、范围提交、fresh fetch/merge和正常push。后续单agent要求覆盖旧Goal中Astra文字，不委托、不建分支/工作树，不把早已修复的Rendering重复当当前问题。791为progress：9c54d33aa修复共享SearchField非空Esc错误退出设置，18张真实原图，普通构建/类型/docs/架构及完整正常push检查通过，10:57:50Z fresh main相同、0/0、Dependabot开放0。单次重扫授权已消耗，不再次触发。整体Goal仍active。

当前171旧媒体删除、4共享/外部文档修改与2缓存目录是其他工作，保留。791两个自有实例已公开shutdown200、原exec/native/launcher0、精确出生链退休、auth/models副本清退，累计模型请求793。源QA库116028行未变，最后791-after恢复副本schema9/92表116092行；两QA附件命名空间17+10份逐字节一致。新轮不复用旧deadline、不重启旧实例或用户18571/窗口/数据库。

已读791 Recall/实际结果、10-13清除原意、MemoryPanel、其唯一MemoryContextPanel调用、project-memory服务、backend panel知识路由、Memory当前类型/fromFile、project-memory架构三权限与受保护内容、现有ProjectMemory GET/原始read，以及FileChangesView筛选处理和历史文件差异旅程。全仓检索定义、调用和历史决策。当前Memory设置仍必须选Task并传taskID，而实际所有知识路由按Instance Project查询、忽略taskID；项目上下文MEMORY.MD使用独立受保护GET，不在通用语义记忆列表。现QA库33条memory_file均为project_context，5个真实Task分属3项目；原文读取尚待真实UI验证。SearchField.clear复用Memory的onClear，当前加载会临时禁用输入，旧规则明确不安排异步抢焦点。FileChanges已显式拥有非空清查询/空查询回列表的Esc。

## 本轮调查与验收方案

先从完整791-after一致备份到新自有scope，保留全部真实消息/Task/项目/内存格式和对应附件；不SQL伪造消息、目标或记忆，不借名称代替真实事实。以当前普通Vite构建私有输出，通过项目开发serve的/ui在38357（必要改后38358）体验。新启动前固定60min绝对截止，每自有实例15min正常公开shutdown，全部实例/重试沿同一截止，至少5min收尾；用成熟native-host和原exec证明物理、输出、请求终态，关闭后退休认证+完整模型目录副本。模型预算0、累计793，不启动/恢复目标，不触发Organize，不创建Task，不永久删除记忆。认证与模型目录同时复制，只验证本地投影，不能冒称本轮真实Provider请求资格。

真实交互从设置Memory & Context当前未选/选Task、语义搜索Enter/无结果/清空/退出、双语空态开始，确认是否能发现和阅读真实项目上下文。FileChanges按可用真实Task历史检查搜索/清空/切换/焦点；没有数据时保留未覆盖，不伪造fixture或硬造diff。首次截图与持久事实决定是否改动，不凭代码先断言缺陷。实现前补齐可观察现象、触发、控制/数据根因、旧路径不足、全仓公共契约/数据/测试/文档/交付及风险；若当前Task选择确实造成项目记忆不可达，按当前单一Project权限模型消除旧Task依赖，不平行保留两套入口。是否需要只读MEMORY.MD呈现、现有primitive与作用域边界待真实结果和完整影响分析。

UI（User Interface，用户界面）只用真实页面交互、截图和人工视觉复核；不新增/运行任何UI自动化、DOM（Document Object Model，文档对象模型）/组件/源码文案/截图断言。当前检索没有发现相关UI自动化；后续触及时按规则删除其专属文件。类型、构建、i18n（internationalization，国际化）仅辅助，不替代实页。非UI变动须聚焦正向真实checker。若出现任何调度、恢复、队列或终态异常，立即横审所有生产入口、Task/Mission/Session执行轮次、重试/重启、串并行及项目隔离；没有证据时不推测模型原因。

结束前核对92表、原数据与附件/持久file part、0模型调用与自有资源关闭；更新当前架构、双语Unreleased和索引，运行当前docs检查。所有本轮修改范围提交并fresh合并上游、审查完整待推集、正常push，不绕hook，不发布。保持整体Goalactive，当前未证实的新缺陷和未覆盖范围如实记录。

## 实页证据与实施前完整分析

38357/main-CNl0qeoM.js真实普通构建启动，schema9→9 validated。设置Memory & Context在真实Chat项目下显示Task选择要求、禁用搜索（图01）；菜单只有5个Task/3项目，当前仅Chat项目根本不能选择。选真实已完成账单Task后显示No context entries（图02），Enter搜索invoice为No matching context found（图03），Esc调用原onClear回到No context entries（图04），证明791特殊回调已按合同执行；加载期间禁用输入会失去焦点，旧合同明确不异步抢焦点，不另外改变。以生产GET /experimental/project-memory分别读取当前Chat项目及该Task项目，200/scope=project/revision3、2091/1926字符，与原持久markdown逐字相同；页面没有入口阅读这份真实项目上下文。

根因是UI沿用旧Task/cwd/global/session语义及Task必选状态，后台当前唯一权限是Project，路由list/get/search/delete只读Instance.project.id，taskID query/body被schema忽略。MemoryPanel本身也把Task判为可用性条件，并把搜索缺失scope投影成global；knowledgeScopeLabel没有当前project翻译。MemoryContextPanel虽完整分页读Work Ledger，却丢弃全部非Task项目；仅复核既有Task下的普通列表无法发现Chat-only上下文不可达。更早的authority修复正确保护来源世代、旧清除修复正确保留加载回调，都未修这套过期产品数据模型。普通语义记忆正确排除user_message/project_context，禁止为显示文档而破坏这个保护或制造相同副本。

全仓确认MemoryContextPanel是MemoryPanel唯一生产调用，导出MemoryFile没有其它消费者，旧memory.task_* / scope.cwd/global/session词条仅这两个组件使用。现有project-memory服务已经封装同一GET且只在目录/epoch/authority匹配当前应用时更新顶部notice；其返回类型自行只写meta、遗漏content等已有OpenAPI字段，现SDK已生成完整ExperimentalProjectMemoryGetResponse。计划用这个SDK类型保留notice已用形状，扩展现返回类型，不新增第二GET helper或API。纯UI加载/选择以同一完整Work Ledger的Project rows与当前实际目录为源，默认当前项目，独立于当前对话；现唯一MemoryPanel移除Task依赖与taskID无效参数。只读文档沿既有服务显示原content/版本/更新时间/待整理计数，原文pre可选择及键盘滚动；不新增整理、写入或删除受保护文档操作。语义记忆维持原真实列表/搜索/详情/删除API，scope与时间遵守当前Project/界面语言，原source事实保留。删除被替代的Task选择实现及过期词条，不保留兼容分支。

影响仅Memory设置、MemoryPanel、现有服务的类型声明、两语言及关联样式/架构/更新日志；API/SDK生成产物、schema/迁移/存储/LLM/组织器/调度不变。来源异步风险：项目切换/连接世代/卸载后旧结果不得进入新视图；沿现effect失效和authority校验，文档加载立即清旧数据，成功/失败/结束只作用于原选择，拒绝回填到另一项目。当前项目可能没有Work Ledger项目行时仍以已打开真实目录呈现，不伪造工作记录；列表加载失败不自动选另一个项目。未保存设置和当前对话选择不改变。新文案/空态/错误摘要/无障碍名、日期和数值均双语；文件身份MEMORY.MD和原上下文不翻译。

UI验收覆盖Chat-only默认项目真实2091字、切换真实Task项目1926字、快速A/B选择后身份/原文一致、空项目文档及语义列表/搜索/清空、双语/键盘/焦点/返回原对话；无UI自动化，类型/构建/i18n/docs为辅助。语义记忆当前真实数据全是受保护文档，正向非空note/fact列表未具备，不能造SQL假数据或冒称非空语义搜索已验收；本轮不产生模型请求。原始GET与SQLite完整markdown可核对只读文档真实性，不以源码摘要代替行为。

实际还打开该完成Task的Review（图05），稳定后显示No file changes，而会话存在两份交付；当前ChangesPanel确实读取持久观测/工具区间而非交付附件，空结果不能仅凭标题或模型自述认定丢失改动。该新线索的原持久观测/工具类型/比较源尚未知，保留后续完整专项调查，不修改FileChangesView或假造diff，本轮未覆盖其非空筛选。没有发现调度/恢复/队列或终态收敛异常证据。

基线11:09:38Z公开shutdown200、原exec65513/native/launcher0、物理/输出/请求结算及精确身份退休，auth/models清退，模型0/累计793，原截止余3228089ms。改后实例沿本轮同一deadline，不重开旧实例。

## 实施、复核与资源结算

按唯一Project模型替换旧Task选择，完整分页读Project rows并按真实目录规范键区分；默认当前已打开项目，并在控件下显示完整目录。MemoryPanel删除taskID依赖/无效参数，保留现有源generation/authority保护、列表/搜索/详情/删除接口；scope=project显示当前语言，日期和相关度数值跟随localeTag，搜索不再伪写global或把原source替换为Search result。现服务返回类型复用已生成的ExperimentalProjectMemoryGetResponse，保留现notice形状；运行路径未增加第二GET实现。Project文档在组件内按选择/authority生命周期读取，开始清旧文档，只有原选择可结算成功、错误与loading；pre只读原文、可选中且支持键盘滚动。新双语说明/元数据、空态和错误摘要配套；受保护数据不进入普通语义列表/删除。实现仅UI和类型声明，未修改API/SDK生成、数据库/迁移、后台组织器或LLM。

普通基线build0；最终Overlay typecheck0、i18n0（2 locales/2623 keys）、普通Vite候选0后，11:18:14Z用main-D5zo1paJ.js启动38358。真实Chat-only项目默认可读2091字符、revision3/523tokens，图06；键盘End后稳定截图07可见原文末尾及焦点。Enter检索invoice→无匹配→Esc回原列表，项目文档保留，图08/09。切账单项目显示真实1926字符、revision3/482tokens，图10；A/B/A连续选择回到Chat项目原文/目录，图11。两项目GET payload与持久原markdown直接相同。改中文后元数据/日期/正文/控件/空态与无障碍名按当前语言，原模型文字不翻译，图12；实际goal-home-729空项目revision0/0tokens正确空态，图13；中文搜索与清空图14。在实际JSON会话进入设置→改选另一项目图15→返回仍是原Chat/Sources/read5行/真实模型回复，图16，没有改变对话或创建工作。

16张原图均人工查看，无UI自动化、源码文案/组件/DOM/截图断言。仅实页覆盖空的通用语义记忆；当前33份memory_file全为受保护project_context，不冒称非空note/fact排序、详情或删除已验证。错误/待整理提示、断线或人为延迟响应没有实际触发；快速切换是当前真实交互，不能扩大为完整并发证明。未新增状态队列或任务执行机制，未出现调度/恢复/终态异常。Review的空差异线索仍待原事实专项核验，未把交付文件冒充比较证据。

11:26:53Z完成38358公开shutdown200、原exec88753/native/launcher0、物理/输出/请求与精确出生链退休；auth/models副本清退，原models字节/元数据和auth元数据保持；全批模型0、累计793、清理余2194108ms。同一固定截止12:03:26.039Z有效，未复用旧791截止；自有浏览器页已关闭。92表直接比较确认791源116092行完全一致，基线116094/候选116096均schema9/integrity=ok，各仅新增1运行激活lease+1grant；所有旧行（含33份项目上下文、61Session/387Message/1161Part/5Task）保持。原件与两轮副本17+10文件全部逐字节一致。没有用户数据库升级或其他用户进程操作。

当前Project-memory架构及根Unreleased双语说明已同步；验收构建后仅修改说明性源码注释和文档，没有运行逻辑变动，未发布新版本。详见[证据入口](../../artifacts/2026-10-29-memory-context-journey/README.md)。接续当前docs/架构检查、范围提交、fresh fetch/merge与完整待推集合审查，正常push，整体Goal保持active。

交付前当前docs:check真实通过（351 ops/26 groups），architecture-index真实通过（20 documents）。全packages/script定义调用复核确认旧Task picker及cwd/global/session作用域键均已退出生产路径，唯一MemoryPanel调用按Project目录；当前检索没有相关UI自动化测试。辅助检查和实际UI原图分别保留，不用静态结果冒充运行验收。下一批优先追查图05的原始比较观测和读取路径，仍不将“无变更”或交付自述直接当根因。
