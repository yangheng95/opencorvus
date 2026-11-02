# 归档项目身份与项目名检索（892）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，实际体验验证后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的三Astra文字。891已推送556ff8513fb90addc542cc4d7999cb4f56d966c2，fresh HEAD=origin/main、0/0，24普通文件/4本地化字段/三索引行干净，177项无关改动保留。源891-after严格资格259051行/schema9/92表、100项目/229附件；原句柄71863消费exit0、关闭HTTP200、物理输出/请求闭合及配对副本退休，累计1260模型请求。上一轮属于有真实实页与权威提交的progress，本轮转归档页面，不追查已解决的旧闪烁问题。

已读：AGENTS、891 Recall/资格/fresh推送；ArchivePanel完整加载/搜索/恢复/打开/删除及界面，相关样式/两语言，07-panel Archive queries与项目显示合同；前端work-ledger API（Application Programming Interface，应用程序接口）及runtimeRows/project查找、WorkLedger全部分页加载；后端projection共享topRowCandidates的Project/Mission/Chat/Task四分支、active/archive两个入口与路由；transport严格行/游标类型和SDK（Software Development Kit，软件开发工具包）调用；Project.update当前name写入；project-directory现单一显示primitive（基础组件）；完整work-ledger-search.test.ts真实内存数据库/生产读回/HTTP（Hypertext Transfer Protocol，超文本传输协议）测试，无UI断言。全仓生产调用搜索确认active/archive共用同一候选查询、原游标和同一Project.name事实，不能只修归档旁路或已加载页面过滤。

只读原数据库盘点10个已有自定义名字的Project，其当前archivedSession数量均0，包括Project journey773；是否有其他归档Task/未命名项目记录待实页盘点，不猜。已有命名项目773仍有当前Mission/Chat，适合作为修改前共享搜索实证。新增归档案例只在after通过真实UI创建本轮手动草稿，不构造消息或夹具、不改旧记录。

## 修改前根因与影响分析

- 可观察候选：Archive只呈现原directory，缺少用户命名Project的可读标识；搜索占位文案没有解释可检索范围。现共享SQL（Structured Query Language，结构化查询语言）中Project分支匹配Project.name，但归档明确不返回Project行；Mission/Chat仅匹配类型、标题、ID及directory，Task亦未匹配其已有Project join的name。直接数据流为输入search → 现searchPattern字面量转义 → 共享候选查询 → 游标分页，Project.name没有参与三种工作候选选择。因此按自定义项目名无法找到其工作；改显示名而不改共享查询会继续搜不到。before实页/公开接口确认具体表现后再实施。
- 新合同：在同一topRowCandidates里把归属Project的当前name作为Mission/Chat/Task的一项真实搜索字段，沿用原参数化LIKE/ESCAPE及大小写语义，不拼接输入、不缓存名字、不新增查询/配置或兼容路径。Session按已有project_id关联Project；Task复用已有Project join。搜索仍在分页前执行，原Project/目录隔离、pinned/updated/kind:id游标、Mission子任务归属和archive条件保持。
- 全部生产影响：同一reader的active工作列表、命令搜索和归档均受益；不是仅归档的关键词旁路。改名前后读取当前Project.name；不把目录基名、类型文案或UI翻译写进数据库。公开接口形状、SDK生成、路由/输入校验、schema（结构）/迁移均不改，OpenAPI（开放接口描述）检查按原真实链路执行。
- Archive元信息使用现workLedgerProject与projectLedgerDisplayName显示已加载的规范项目名，同时保留完整真实directory及日期；WorkLedger现加载全部页后提供项目事实，不另建名称映射。目录匹配沿现规范化identity，不新增前缀猜项目或平行元数据。搜索占位文案两语言说明标题、项目或路径，数量按当前locale（地区格式）呈现。原作者标题/路径/日期身份保持，恢复/删除/打开的owner和权限不变。
- 非UI共享查询增加聚焦正向测试：真实生产reader及公开路由覆盖当前命名Project的Chat/Work/Mission/Task，active/archive、两个Project、字面量特殊字符/ASCII大小写、分页和改名后的精确身份；先保留原实现失败证据，再修并重跑。现文件未发现负向核心断言或UI自动化测试，不新增/运行UI测试；内存测试只证明局部查询合同，实页/公开真实数据另验。
- 不涉及调度、队列、唤醒、恢复执行、终态收敛、Provider（模型服务提供方）或模型协议。归档恢复仍为原停止轮次，不开始任务；发现共享调度异常则立即按全入口横审。没有证据不改删除/请求世代/焦点等既有机制。当前错误摘要只作线索，未实跑不并入修复。
- 风险：关联范围错误、SQL转义、游标窗口重复/漏项、前端只显示名字却搜不到、名字和路径排版过密、别名误当文件身份。必须真实页面与截图复核，不能靠源码文案/DOM（Document Object Model，文档对象模型）断言验收。命名Project当前无已归档Session，故after新建明确本人草稿作真实归档/恢复验收；所有原行保持，禁止用改原数据或放松保全检查凑案例。

## 首次资源与验收顺序

首次prepare前声明before/after模型额度各0，75分钟共同绝对截止和5分钟闭合预留，不加额、不续期、不重启。本人隔离开发CLI（Command Line Interface，命令行接口）38610/38611的/ui/；before复用891合格main-CIjqGyl0.js，after用Node.js构建，不启动独立Vite。凭据与完整模型目录成对验证复制及退休，不输出秘密。用户18571窗口和真实数据库不操作，全部259051旧行、100项目文件/Git、229附件保全。

1. before真实Archive空/非空、搜索与原项目信息；公开active/archive读取命名项目773的范围，截取真实差异。正常关闭HTTP200、原句柄exit0、物理输出/请求闭合、配对副本退休及全旧数据资格后改产品。
2. 聚焦后端正向测试在原实现失败；按方案修唯一查询及Archive显示/占位，更新07-panel。原测试重跑、Node构建、类型、本地化/CSS（Cascading Style Sheets，层叠样式表）/docs聚焦检查。
3. after通过真实UI在Project journey773创建“归档项目检索892（未执行）”手动Mission草稿，明确不启动。归档 → 按项目名/大小写/路径/原标题搜索 → 打开同一归档历史 → 恢复 → 原待规划身份/请求保持 → 再归档。只操作该本轮新实体；不永久删除任何工作，不改旧数据。公开reader逐步核对身份/状态，原所有行严格保全；中英文截图人工复核。新记录不是假模型消息或fixture（夹具）网页。
4. 本人服务与配对副本闭合、原句柄消费、全旧数据资格、三索引；仅本轮提交、fresh fetch/普通merge/完整待推集合审查、正常hook与push、fresh 0/0。Goal保持active；未知覆盖如实说明。

## before真实确认及正向失败

38610公开reader HTTP200：Project journey773目录范围有项目+2条Chat/Work+2条Mission共5条，项目名查询仅项目1条。01真实Archive仅1条其他未命名项目的旧Chat；02项目773归档搜索为空是当前没有该项目归档的正确状态，不冒充缺陷。03真实命令面板按项目名也只返回Project本身，而侧栏同项目下工作实际可见。未操作唯一旧归档的打开/恢复/永久删除按钮。

原句柄13837消费exit0，关闭HTTP200、原native/launcher物理身份/输出/请求闭合，配对副本两文件退休。严格保全259051旧行、100项目文件/Git、229附件及源DB；当前259053行仅新增两条本次租约，schema9/92表，模型请求0/累计1260。初始准备脚本曾把已落盘的本人reader文件目录误判为既有运行，服务/凭据启动前修正为精确初始文件清单；未重启服务、改额度或截止。

新增聚焦后端正向用例使用真实memoryProject、Project.update、生产listWorkLedger/listArchivedWorkLedger和原Task事实夹具，验证命名Project的4种工作身份、字面量/大小写、目录、游标与改名。原实现运行同一文件：6 pass/1 fail，40个expect；失败精确缺Chat/Work/Mission/Task四项而仅返回Project，与公开真数据一致。没有无效摘要/哈希断言，也没有UI自动化；夹具结果只作局部合同，不替代下面真实草稿流程。

## after发现命令面板的第二层遗漏（修改前补充）

共享查询修复后同一后端文件7 pass/46正向断言、两端类型/构建/本地化/CSS/docs通过；真实公开reader按项目名已返回原5项，目录和旧归档完整一致。但04实页命令面板只显示Project/Chat/Work三项，不能把API通过当全链路完成。读取CommandPalette全部paletteLedgerRows/rowMatches/loadLedger路径确认：服务端返回的Mission另经本地rowMatches决定保留父Mission和相关子Task；其候选字段仍只有title/id/directory/kind，没有Project自定义名，因此被丢弃。全部rowMatches调用仅这一父/子分支。rowCommandHint还自行取路径末段，统一检索后仍只提示project，不能解释项目名命中。

追加final独立阶段，首次模型额度0，沿首次75分钟共同绝对截止/5分钟闭合预留，不加额/续期/重启。after未创建本轮实体：先关闭HTTP200、原句柄15287 exit0、物理身份/输出/请求闭合、配对副本退休和严格全旧数据资格259053→259055、100项目/229附件/schema9/92；仅两条当前租约增加，0模型请求。然后在原rowMatches加入现workLedgerProject规范当前name，父/子仍沿原相关性规则；hint改用已存在的projectLedgerDisplayName而非私有目录split。现全页WorkLedger投影负责当前项目事实，不另造缓存/路由或删掉子Task筛选。函数签名和导航callback保持。此补充仍是同一共享搜索链路，归档及真实草稿验收移至final，不能声称04已经通过。

## final真实验收及闭合

38612开发页面实际加载main-BBrHDDYe.js。05命令搜索Project journey773完整显示两条原Mission、Project及原Chat/Work共5项，各工作提示均为当前自定义项目名；真实reader返回的5个kind:id完全相同。06通过实际手动创建表单选择原项目773、Work/Base，保存本轮“归档项目检索892（未执行）”，未点击Start或AI创建。生产读回确认Mission bd4c3e6cf63ff486、Session ses_-zUQDIqBhzzV3puN2erj、backlog及完整pendingPrompt原文。07–10依次实际搜索项目名、混合大小写、真实路径、原中文标题，均显示同一本轮归档记录；完整路径分行、项目名/日期不混淆。11从归档打开历史，同一Session保留同一归档时间，只读提示正确。12恢复反馈明确显示原标题；13原Mission仍为同一待规划手动草稿，请求原文不变。随后只把该本轮实体再次归档，14–15中文显示项目名、完整路径、地区日期、搜索说明与打开/恢复操作。唯一旧归档803完整读回一致，未打开、恢复或删除它；全部截图人工查看，05/14保存原图额外本地复核。

非UI验收：共享reader聚焦后端7测试/46正向断言通过；core/overlay类型检查通过；final本地化2753键/2语言、CSS9066引用/402TS/TSX及文档352操作/26组通过；Node构建通过，只有既有大chunk提示。未运行或新增UI自动化测试。第一次final准备命令漏传必填final参数，入口断言即退出、未创建服务或凭据；读取现帮助后以正确参数运行一次，未改额度或绝对截止。构建/检查原生工具输出曾因传输截断丢失外层句柄显示，以原runner的started/closed/code0持久化事实确认完成，未因此重跑这些操作。

本人tab181关闭后，公开shutdown HTTP200，原服务句柄57462消费exit0；settle确认原native/launcher/物理身份/输出和请求全部闭合，两份凭据/模型目录副本退休。严格资格259055原行全部保全，当前259215行仅本轮新草稿及其原生发布/租约事实；100项目文件/Git、229附件、源DB及认证/完整模型目录元信息均保全，schema9/92表不变，0模型请求、累计1260。final沿同一首次截止，退休时余2998571ms。此轮只验证页面和查询/归档契约，不宣称重新执行真实模型任务、永久删除或发布新版本。提交推送事实以本轮Git回执为准，持续Goal仍active。
