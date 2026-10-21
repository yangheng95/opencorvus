# 配置来源优先级与资源目录职责

## Recall

520继续单agent，不委托。用户要求持续自主体验修复、真实页面验证后提交推送；最新单agent要求覆盖长期Goal旧Astra描述。519为progress，8064d7d981576ea9149e88564b2247a369bbc7c8已正常push且fresh upstream一致，660次真实查询排除了复用which结果的稳定吞吐收益；六原scope全闭合，90表157001原行与166目录保持。只有原.bun/和packages/opencorvus/bun/未跟踪。保存10秒/恢复5秒仍未达。

本批起初沿native启动调查，复核490/491/519后未发现可直接投产且满足流式、取消、恢复及物理归属的简单替代。继续读完整配置链时发现独立可复现候选：loadStateOnce先加载global，再加载OPENCORVUS_CONFIG自定义文件；随后ConfigPaths.directories恒含Global.Path.config，资源循环又将同一global合并一次，可能覆盖custom的显式值。转向先验证并修复这一正确性问题，不以微小I/O变化宣称原14秒性能已解决。

## 修改前分析

已读当前Config.loadStateOnce/loadState/readOnlyProjectSnapshot/loadGlobalConfig/mergeConfigConcatArrays、ConfigPaths.directories/assertCanonicalProject/assertCanonicalDirectory、Flag静态OPENCORVUS_CONFIG与动态CONFIG_DIR、Global懒root、官方隔离runner及layer/peer正向合同；全仓搜索定义调用和相关优先级决策。当前05-config架构是事实来源。代码注释声明remote→global→custom→project/resources→inline→managed，资源列表包含global是为了加载其command/plugin等，不应再把global文件变成custom后的高优先层。existing extension列表去重掩盖重复来源，普通标量仍可能被低优先global覆盖。原layer合同覆盖global/project/inline/显式资源，但没有静态custom入口的独立进程合同，疑似因此遗漏。

影响面：唯一loadState服务普通Config.get、只读snapshot、project/global候选、Provider/Model/MCP/权限/Skill/Task/Mission/Session启动和重启。不能只修HTTP投影或新造配置实现。尚未实测，custom覆盖是否实际失败标记未知。此问题不是已观察的调度、终态或数据库兼容故障；若出现相关异常立即横审全部入口/执行轮次与恢复。schema、迁移、API/SDK形状、提示词及UI源码不需变化；风险在来源优先级、扩展目录资源保留和canonical校验，不能简单从directories删global或绕过原revision复核。

## 实施前方案与验收

1. 新增聚焦正向后端合同，通过正式test runner的原监管启动独立源码子进程，在导入Flag前绑定静态custom文件。每case独立自有runtime/home/managed/project/global/custom/resource文件，不使用真实用户库、Provider或凭据。覆盖custom胜global、project胜custom、显式资源/inline/managed正常优先、global command资源仍加载，及CONFIG_DIR明确等于global时仍保持custom。断言明确有效值/资源输出，不用“不读某文件”的负向调用计数，不运行UI自动化。
2. 先以未修改生产源码运行新增正向合同，保留真实失败。若证实，仅在既有资源循环中排除已经作为低优先来源加载的global配置文件，保留同一global资源目录及其plugin/command/依赖安装职责；原global canonical断言、完整source revision、新鲜读取和错误路径继续执行。显式独立CONFIG_DIR仍为原高优先来源，project、inline、managed不变。若证据不支持，不先补丁。
3. 修复后运行新增合同及相关layer、peer、global candidate正向合同，backend typecheck与文档/架构检查。同期当前05-config明确低到高来源与资源职责，三索引同步；无版本/schema/Release演进。
4. 用原Source CLI开发服务/ui和正式现有前端，在隔离数据上设置唯一受控custom显示值/模式，实际API/页面交互和截图人工复核优先级及项目覆盖。不开单独Vite、不操作用户18571或其窗口/进程。若需模型目录完成实际页面初始化，先另记固定预算、完整auth/models配对和精确Sol流式预检，再按原native/source/launcher/物理链结算退休；当前预算0、无授权副本。不能以空模型配置失败冒充页面验收。
5. 全部原句柄、页面、数据与可能授权结算，归档真实输出/失败/截图，正常检查、范围提交、fresh fetch/merge、完整pending复核、正常push与fresh equality；原10/5秒未达继续保留，长期Goal active。

## 修改前真实复现与页面资格边界

官方隔离runner原79508 exit1：新增六例中四例通过，custom与CONFIG_DIR精确指向global的custom两例失败，12断言。实际结果为global-user/ask/3，明确预期custom-user/full_access/8；global command资源在失败结果仍存在，证明问题位于文件优先级而非资源缺失。原precedence-before.log保留，源码尚未修改。既有project/resource/inline/managed四正向流程通过，不据此掩盖custom错误。

实施前追加真实前后页面资格：固定before18987、after18989，各最多4次Sol真实流，整批8，包括预检与所有memory/helper，无业务输入/Task/Mission/Goal/成员。完整private/runtime auth+models配对，原源不变、目标投影、凭据可用和实际gpt-6.1-sol/stream分别核对；不refresh/exchange。各20分钟native/180秒启动无活动边界，原reader EOF/原scope结算后退休四成员配对，失败也独立清理，不重启活跃scope/扩额。

两scope从已关闭518-after完整90表157001行/schema3/canonical复制，新initial project位于各自owned run内，避免原项目文件掩盖custom；原166登记目录仍保留。各受控custom文件只声明QA用户名及full_access，原global Ask不变，OPENCORVUS_CONFIG在源码CLI导入Flag前绑定。复用原正式main-DhV28lza/UI与Source CLI开发模式，before实际API/页面观察Ask、after观察Full access及真实来源值；没有UI源码变化，不用重复编译同一前端假冒新版本。真实额外project覆盖若执行仅作用新自有Project，事实完整保留，不回填源数据。

## 真实 before 与最终实施裁决

首次页面验证工具7e2bff实际exit1：504验证器仍硬绑定旧412项目，在任何凭据运行副本/Provider审计/API服务前拒绝新的owned project。原native/output/request/launcher完整、两原物理出生均dead_or_reused，runtime/data只有原库，实际0请求。原四份证据经验证同一owned父目录后精确移入failed-before-startup-evidence保留，不删/覆写。private配对尚未使用。修正私有验证器为实际realpath确认同run/project，显式准备Base项目source，原before四次分配仍全部未用；只重新启动已失败且物理闭合的工具轮次，新native occurrence，未重启活跃服务或扩额，原错误保留。

有效before原8872/87108/18987与IAB112：完整凭据/目录/实际Sol预检通过，2/4实际chat+memory均stream/200/原source EOF。01真实首页与02实际模式菜单均已人工看图，Ask me被选择而custom声明full_access，足以复现用户可见错误。只读HTTP工具44bfd5错误预期global缺席username也应覆盖custom，实际为QA custom source 520/ask；这是工具前提错误，恰说明稀疏global只覆盖它声明的叶子。两HTTP读取均已200后才进入标量断言，未持久结果文件，不能补造未保存的request ID或完整前态JSON。原工具快照、已观测标量和失败事实保留；随后工具改为先保存响应并按真实稀疏来源计算预期。Node25在此未捕获断言退出还输出UV_HANDLE_CLOSING，属于这个工具退出事实，不归因产品。无需为这项证据再增加模型或重跑before。

公开shutdown200，原8872 exit0/native/output/request/launcher与精确出生完整，112关闭。runtime/private auth/models四成员退休，unused2退休；63文件52045489字节实际秘密值扫描0命中，源auth/catalog不变。原90表157001行全字段与原源size/mtime/schema3/integrity/canonical保持；目标仅2原容量租约正常变化，原业务行保持，Provider activity392→393和全实际2不同口径。冻结before-data-preservation-observation防止after覆盖。

根因已由前两新增合同和真实页面确认。最终生产只改loadStateOnce的loadsConfig条件：Global.Path.config已作为低优先文件来源加载，此循环只加载project或独立显式CONFIG_DIR文件；global目录继续扫描command/plugin并保留依赖安装角色。以现有Filesystem.resolve比较global目录，覆盖同一目录的规范相对投影；不新增缓存、配置或替代loader。首个global canonical校验与sourceRevisions现有完整复核保留，已有project/resources/inline/managed顺序不变。修复恢复声明优先级，不改API/SDK/错误码/数据库/Provider/模型入口。05-config同步明确这一合同。

## 已通过的主流程与路径比较追加复核（实施前）

修复首轮官方51914 exit0：6来源/23继承/7跨进程/4全量候选，40pass/118断言；3478 backend typecheck exit0。新增规范dot投影后单文件ce6de3 exit0为7pass/14断言，替代原6例后最终唯一用例集合41pass/120断言。格式化本地.bin入口缺失，发现实际Bun安装存储内Prettier3.9.5并沿原CLI格式化成功，未改依赖。此前只是找错入口，不宣称仓库format脚本故障。

after原45522/92780/18989、113页：实际/config200为QA custom source 520/full_access，/global/config200仍Ask；03/04真图显示Full access已选择。手动在自有project选择Ask，05图与后续真实/config200、原project canonical证明项目Ask覆盖custom Full access，全局未改；所有HTTP工具的requestID头为null，原样保留，不补造ID。该scope2/4真实Sol（chat+memory）全stream/200/EOF，公开shutdown200/原45522 exit0/native/output/request/launcher/精确出生闭合，113关闭、四成员配对退休，unused2退休。原数据90表157001行全字段/source/schema3/integrity/canonical保持，目标仅2原容量租约自然更新。全批实际4/8、八成员配对已退休。独立只读519冻结字节复核原SQLite/canonical bytes/size/mtime及全部166目录dev/inode/realpath精确保持。

完整复核发现Filesystem.resolve保留Windows目录大小写，而现有Filesystem.normalizeForCompare已拥有当前跨平台路径比较合同。仅resolve相等仍可能让同一global的大小写别名再次加载。先补Windows真实大小写别名正向合同并记录旧条件结果，再用这一个现有primitive比较两侧已resolve路径，不另写大小写/物理身份实现；POSIX大小写语义保留。原资源职责继续，非配置的目录遍历仍沿原实现，不扩大为物理alias合并或清理。

为最终条件提供新真实页面资格，追加独立final-read18991，严格0模型预算、20分钟native/180秒启动无活动，仍从完整原518-after复制数据。仅复制同一完整公开models.json以投影现有目标模型，**不复制auth或使用凭据，不做Provider可用性资格**；原4次Sol主流程事实仍保留，原unused额度已退休不复用。静态custom及空managed绑定自有路径，CONFIG_DIR明确使用自有global目录的Windows大写/点投影。复用原0模型审计和Source CLI开发服务，实际API/内置页面确认Full access及原global Ask，再公开shutdown/join/原物理链、0模型和数据完整复核，关闭自有页。此追加不改变8次真实调用批次，也不把缺少凭据当错误或冒充新的模型验收。

## 最终源码与完整交付事实

新增Windows大小写别名后，旧resolve条件原52378 exit1，7pass/1fail/16断言：同一global目录不同大小写再次将三值覆盖为global-user/ask/3。最终仅采用既有Filesystem.normalizeForCompare比较两侧resolve结果；88046正式复跑8pass/0fail/16断言。加保留的23继承/7peer/4global候选，当前唯一用例42pass/122断言（不是把中间重复轮累加）；final backend typecheck1609 exit0。首40例、中间dot7例、case失败和最终8例原输出全部保留。生产仍只是同一loadStateOnce的来源角色条件，没有新loader、缓存、协议、API或身份源。

最终18991原43298的源码CLI/UI，实际CONFIG_DIR是自有global目录大写加/.；真实/config200为QA custom source 520/full_access，/global/config200保持Ask。06完整首页、07模式菜单选中Full access均实际查看；IAB114关闭。该scope公开shutdown200/原43298 exit0/native/output/request/launcher及精确出生链完整，实际0/0、无auth，公开models副本结算后精确退休。此零模型范围只证明最终来源/页面，不伪称新增凭据可用性。三个有效scope共7张原图，五张主流程加两张最终别名；UI源码和正式main-DhV28lza未改，没有新frontend build声明或UI自动化。

final-read原90表157001行全部字段/身份/时间精确保留，schema3实际对象/integrity/canonical保持，**零原行变化**；provider_activity392→392。前后带模型范围各仅2旧容量租约自然更新，原业务行保持，新预检/Project/Session/事件保留。最终对原519闭合源字节与全部166物理目录再次独立核对，不回填数据。八个runtime/private配对成员已退休，全部原Sol4/8流式200/EOF、unused4退休；失败首工具0调用的完整原结算和错误保留。用户18571/实际用户库/窗口未操作。

本批交付修复可观察的配置优先级错误。原10秒保存/5秒恢复性能目标仍未达，本轮没有新的全量配置性能资格；不能把减少重复配置读取当已证明提速。Sources/成员Rendering、Mission与原生WebView2亦没有本轮新资格。归档脚本、错误、原HTTP字段、正向合同、7张图、数据与全部资源结算；随后执行文档/架构/差异和实际值安全扫描、范围提交与正常push，长期Goal active。

最终文档检查实际通过：docs:check 345 ops/26 groups，architecture-index 20 current documents；已跟踪差异检查通过。所有本批运行已完成，无等待句柄或开放自有页面；最终打包安全扫描与完整暂存差异、正常hook/push以实际后续输出为准。

首次实际值扫描79文件/19解压payload零命中，暂存差异通过。复用扫描脚本的scope末尾“no authority copied or provider calls”指扫描器操作，并非整个本批（本批真实4/8）；保留首扫，清晰范围描述的最终交付复扫覆盖全部当前文件/解压内容/源码/测试/架构与索引，不用模糊标签覆盖原调用事实。
