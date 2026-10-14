# 项目元数据慢读取阶段与入口资格

## 当前单人写入实施方案 Recall（2026-10-14）

用户最新收尾要求：完成已知问题即可结束，不进入下一调查批次。已知目录替换选择遗漏现已原案例真实通过；仍须最终共享资格和当前源码桌面收敛。已知提交自动文案错误现在有精确根因：原请求771d5d38-387a-4f2c-95a9-85658392728f 日志为 MissingModelConfigError(summary)，resolveAgentModelRef 的严格单一配置解析返回合法配置前提错误；当前唯一 VCS SSE 错误 writer 无条件转换为 UnknownError 公共摘要，前端又把事件转成普通 Error，丢失可操作原因。全仓读取 error-handler 现有400归类、vcs-stream-error、commit-message resolver/stream、transport事件定义、meta decoder、TaskDirBar与两语言字典；没有真实 Provider 调用，不能称模型成功。

文案错误方案在实施前冻结：VCS error事件增加必填、有限的 code（model_not_configured/generation_failed）；writer只对既有 MissingModelConfigError 公开稳定模型配置前提码与安全操作摘要，其余生成错误保留当前安全公共摘要与真实日志/requestID。前端service保留code为领域Error，TaskDirBar按现有i18n为配置缺失显示可操作的当前语言提示，手工输入和流式模型生成原路径保持。同步更新协议所有调用点与正向公共事件/实际无模型SSE测试；禁止默认模型、隐藏错误或非流式调用。此UI改动必须重新构建当前前端并用新隔离开发服务完成英文/中文真实截图人工复核及手工提交。不扩大到未授权真实Provider凭据或新发布。

目录变化诊断原证据进一步指出选择层遗漏：实际提交只保留3个原条目，目录下的新 note/back 仍以 untracked2 返回。当前 Git others directory 查询不报告已在 index 中作为文件跟踪、但工作区已变成目录的边界；旧枚举仅展开 others 边界，因此暂存无法收到这些子条目。根治位于唯一选择层：共享读取实际 stage index 条目，以其 tracked path 验证祖先；真实非链接普通目录替换 tracked file/link 时也进入同一物理 walker 与 Git ignore 裁决。indexed160000 gitlink 保留 terminal 语义，包括尚未初始化的子模块目录；不把它降级成普通目录。暂存目录替换只移除旧 terminal，再处理该枚举器完整选出的有限孩子。须重跑原失败案例及共享读取、Engine 嵌套 gitlink 与规模验收。

追加类型变化原证据：transitions 原实例中 rename 和 unmerged link 正向案例通过，但 junction 替换为普通文件后，实际提交仍为120000。根因不是 lstat 或链接字节，而是当前 Windows 仓库 core.symlinks=false 的 placeholder 语义；Git2.45官方文档明确说明 add/update-index 不会把这种条目改为普通文件（[官方配置契约](https://git-scm.com/docs/git-config/2.45.0#Documentation/git-config.txt-coresymlinks)）。因此源条目抽象集中声明仅用于有限暂存与工作条目比较的 per-process core.symlinks=true，表示按真实条目类型处理；不写仓库配置，不改变 checkout、restore 或 Windows 创建链接权限。普通文件 attributes/clean 仍由 Git 处理。若旧 tracked terminal entry 实际变为非仓库普通目录，先从准备索引精确移除该 terminal，再暂存枚举器选出的子条目；绝不把普通目录作为递归 add pathspec。需补真实同字节类型变化、目录中含循环链接、rename 和冲突收敛资格后才能交付。

首轮真实写入测试保留两项失败：Git 子目录 others directory 的合法 ./ 边界需要作为内部遍历前缀展开，不能作为返回条目；合并链接比较后 File 状态需按原 canonical 路径排序。修复后第二原 Native 发生实例实际8 pass/56断言。原 Engine 事务整文件在父层120000ms静默窗口中未结算，只能记为未资格；原三 joins 的 inactivity_timeout 完整保存。计划补齐 checker 的明确单案例选择（现 runner 把全部参数当文件，无 test-name-pattern 支持），使用原文件和原每案例60000ms预算按案例重跑，不提高产品 Git 期限、不伪造进展消息。已检索到原 Engine 事务 fixture commit 的4处 --no-verify，按仓库硬约束移除，使用正常 fixture commit；原测试没有负向断言，索引完整性依据实际索引字节身份，不用可变源码摘要作功能门槛。

用户原始要求持续分批调查、先落盘分析、真实桌面截图复核、聚焦正向功能测试、范围提交与正常同步推送；最新明确要求停止全部子 agent，由 Root 自行验收。此轮不委托。读取并复核本记录前述全部 Recall、原生写入六次发生实例、当前 Git 源枚举架构、Vcs/File/Snapshot/Build/Worktree/GitHub CLI 全部生产暂存入口、Engine Git 的 canonical index 准备/安装/清理/恢复和相关真实 Git 测试。全仓搜索 add、status、OwnedIndexLock、fingerprint、dirtyStatusPaths 与各入口调用点。已有其它任务的压缩策略、权限恢复记录与共享索引修改保留，不创建分支或工作树。仅修改本轮文件；不运行或新增 UI 自动化测试。

可观察现象和直接触发：原生 add 在有限循环 junction 图中持续产生真实输出；聚合外层静默监控误判内层仍活跃。原字节与三 joins 已证明共享静默计时器正确响应静默子进程及输出上限。数据流根因是 Git for Windows 把 junction 作为目录遍历和 gitlink 比较，而项目已有 raw readlink/120000 身份契约。旧只读枚举修复未覆盖暂存与索引比较；仅把链接写为120000仍有真实原生 T 状态，不能视为闭环。

冻结方案：源写入沿唯一 gitSourcePaths 完整选择，普通文件和删除路径以 literal/NUL 有限 pathspec 交给原 Git add，保留 caller 的配置、attributes/clean 处理、exclude、external git-dir/work-tree、index 和监督期限；链接按 lstat/readlink 的条目字节通过 hash-object 与120000 index-info 写入，绝不进入目标目录。每次操作在当前索引副本上准备，复用从 Engine Git 提取的 canonical index lock 准备/安装/所有权清理，实现 predecessor 字节比较与原子安装；Engine 恢复语义保持。所有应用拥有的整体源暂存入口同步迁移，不保留另一套 add-all 实现。普通嵌套仓库维持 Git gitlink 语义，索引已有链接后代维持明确 linked_ancestor 错误。

状态与差异以当前索引/指定 ref 中真实链接 blob、当前非跟随条目字节比较，保留真实 staged/conflict/type-change/delete；相同链接报告明确 clean 状态，目标改变报告修改及真实 patch。普通文件仍使用 Git 比较和属性语义。Vcs 与 File 使用同一链接比较 primitive，页面数据契约不变。Worktree/GC 等原生 dirty 检查横向审计并记录安全边界，禁止凭一个页面通过推断恢复全链路通过。

影响面：公共 GitOptions 输入、源条目选择和错误可见性不变；索引锁 primitive 原先 Engine 私有，抽取后删除原重复实现并保留 Engine 恢复调用；Vcs commit、Snapshot、Build pin、Worktree 保留主目录修改及 GitHub CLI 暂存为生产写入口。凭据、模型目录、LLM（Large Language Model，大语言模型）消息和调度无本轮改动，无真实 Provider 请求授权扩展。没有版本或发布修改。文件/索引在准备期间改变、外部 Git 锁竞争、unmerged index、特殊字符、嵌套仓库、过滤器和子目录作用域是必须验证的风险；NTFS 时间复用推测仍未知。涉及原始 junction 的外部原生 Git 状态仍是宿主限制，不通过改造用户链接规避。

验收：真实 Git 正向测试覆盖逐项模式/blob/index、提交后 clean、目标变化/删除/真实类型变化、literal 特殊路径、普通文件 clean filter、删除、并行项目、索引竞争错误及 Engine 原事务回归；原有限五根中的独立写入副本实际生产路径；真实开发服务 /ui 手工交互及当前截图复核；运行相关类型与文档/架构/路由检查，再单一范围提交、fresh fetch/merge、完整待推送提交审查、正常 push 和远端证明。未完成环节明确记录，不把单元测试或旧截图称为新的桌面/模型验收。

## 单人最终实现与验收收尾

最终路由交付检查捕获新增SSE code尚未同步到tracked OpenAPI，属于本轮协议影响面。使用当前SDK正常生成/编译链在独立Native发生实例执行，原Host/parent0及三joins完整；生成差异仅packages/sdk/openapi.json的code enum/required和SDK types.gen.ts的一行同字段。随后真实api:routes-check、docs:check、architecture-index、opencorvus typecheck及overlay typecheck全部0，原命令、cwd、stdout/stderr和退出值已补入同一原件manifest。没有手写生成文件或绕过检查。

Root 完成已知问题，不再开始新批次。所有应用整体源暂存入口现共享有限选择与准备索引：Vcs.commit、Snapshot、Build pin、Worktree primary recovery、GitHub CLI；Engine 原 raw checkpoint 保持其语义并共享提取后的原子索引锁。源枚举同时处理 tracked terminal 变普通目录、合法 ./ aggregate、initialized/uninitialized160000边界；普通文件仍用真实 Git attributes/clean，链接为真实readlink字节120000，真实普通文件按100644/100755处理。raw链接状态/patch与VCS、File、Worktree、GC共用比较事实。删除因替换而失去调用的旧路径解析/chunk helper，范围限于原暂存调用链。锁使用精确BigInt identity及close后的时间事实；predecessor index字节比较、原子安装和原恢复CAS不分叉。

最终原 Native 正向资格：stage-final-base6 pass/43断言、stage-final-physical5 pass/37断言；read-breadth30 pass/94断言、1项POSIX平台skip；六个Engine最终单案例共6 pass/69断言。合计47 pass、1 skip、243断言；没有UI自动化测试。最后另对Git前缀中前导空格保真重跑原native filters案例：1 pass/7断言；原先新增前导空格后，仅期望Git排序未同步造成的断言失败也完整保留，随后按真实canonical排序修正。源路径和索引路径只移除协议末尾LF，不trim路径身份。未用源码摘要作为正确性门槛。

真实开发模式与桌面：Node构建当前UI，分别在18465/18466/18467的独立新服务通过/ui操作；Root逐张查看1280×720截图。第一服务实际HTTP22次（4次API commit及其它顺序/并行读取）全部200，combined另由桌面手工提交782a128，五个有限项目的VCS clean与File status[]通过。第二服务中same-byte junction→regular file被桌面识别为1 modified；MissingModelConfigError(summary)的实际HTTP200 SSE返回model_not_configured，英文和中文正文、按钮及无障碍名称由真实页面复核。中文桌面提交4d7cf685256df718a535cad411aace59908c8a4a已真实存储root-link为100644且保持原字节。第一、第二服务均到达原声明900000ms固定总期限，保留deadline_exceeded与完整原结算，不冒称正常退出；第二服务截图04实际为离线画面，明确不作成功回执。

最终独立收尾服务在18467完成手工提交fbeaaa394a9643b520a82abe174d82ccb1c88048，Root保存并人工查看绿色成功回执05；实际VCS clean、staged/modified/untracked0及File status[]再次通过，Git HEAD与截图短ID一致，root-link真实100644 blob等于原目标字节。关闭Root自己创建的tab11后，按原PID84848/精确birth/listener身份验证，核对123个真实内部request/settled匹配且active_processes0，再POST/shutdown实际200。原Host/parent均0，terminal/settled/outputSettled三joins与完整字节均保存。未操作用户应用或进程。

提交文案失败已按既有MissingModelConfigError类型恢复有限公开原因码，保留实际日志和requestID，其余生成错误保持安全摘要；当前语言显示操作提示，手工输入/提交正向路径通过。LLM提示词、请求模型选择、流式参数和正常delta/done流程没有修改；本轮是配置前提与Git数据流修复，无凭据/模型目录复制、无真实Provider请求，不能声称GPT-6.1 Sol模型运行成功，也不需要把未配置模型误报成缺凭据。GitHub网络工作流、外部原生Git及Windows checkout/restore不属于本轮已发现问题的交付范围。

完整3532原captures/6035297B、所有原失败、help-only检查器误调用、当前工具与实际请求/截图在[单人源条目写入原件](../../artifacts/2026-10-14-project-metadata-latency/source-entry-write/README.md)。当前opencorvus与overlay类型检查均0；docs:check实际345 ops/26 groups。后续只做必要交付检查、当前分支范围提交、fresh upstream合并和正常push；其它任务的工作区改动保留，不发布版本、tag或Release。

## Recall

用户要求持续迭代当前版本：调查UI（User Interface，用户界面）/UX（User Experience，用户体验）、功能和缺陷，先根因/影响分析与spec（规格），后实现、聚焦正向测试、真实桌面交互/原截图人工复核、必要的授权GPT-6.1 Sol流式验收、范围提交、上游合并和正常推送。最新明确要求“停止所有子agent，你自己验收”；Root独立工作，不委托、不跨聊天发消息。上一goal轮为实质进展：本浏览b767b9325与独立交付记录f971e92b6正常push实际0，2026-10-14T02:14:52.584Z–02:17:41.731Z全部hooks通过；02:18:44Z fresh HEAD=upstream=remote73664470621ff6b76b84c40c554afadd6ecc8759，own ancestor0、own scope clean、index空。原02:06推送1与先前1不改写；成功原回执由本记录承接。持续目标保持active，没有完成/暂停/停止授权。

已读根AGENTS、目录浏览当前Recall与原meta-timeout-audit全文、07-panel及07-panel-reactivity公开元数据/选择合同、server-runtime-readiness、task-runtime-directory、meta/config/init/TaskDirBar/workspace入口、GET/vcs路由、Vcs.info与hasHead/currentCommit/currentBranch/hasConfiguredRemote、hostGit/taskGit、Process和共享Facade/Supervisor、现vcs-read-identity与passive-workspace-metadata合同、成熟Native Host/fixture工具。全仓搜索meta load/reload/retire、Vcs.info、hostGit、WindowsRequestObserver与原terminal/output/request结算。现工作区权限恢复、Question、压缩及其spec/index为其它任务未提交修改，保留；不建branch/worktree、不粗回退、不rebase/force/no-verify。前轮浏览87项896断言/310功能HTTP、8次手工操作/9原JPEG仅资格浏览，不能替代此元数据资格。

本轮继续使用已读benchmark-debug-template技能的原输入、活动性超时、失败保留与二次复核流程。Git实际版本2.45.1.windows.1。已查阅[Git2.45状态文档](https://git-scm.com/docs/git-status/2.45.0)与[对应Windows源](https://github.com/git-for-windows/git/blob/v2.45.1.windows.1/compat/mingw.c)：全untracked枚举可能昂贵是候选；资料不能证明本机原163秒是哪一阶段，也不能以禁用untracked、省略文件或新增缓存改变用户功能来充当根治。

## 原现象、影响与未排除根因

旧隔离run的两个真实GET/vcs分别163267/164816ms后200，客户端meta先按现HostTransport15秒期限失败；原完整服务日志有当前A目录的meta load/reload failed。GET/path同期647/0ms。meta唯一Promise.all读取path/vcs，旧scope退休检查在catch前，因此当时失败owner仍current；后来server200不能补造client成功。原envelope只保message，未保原cause/stack/requestID，Native内部请求目录已正常清理，不能倒填各Gitargv、PID（Process Identifier，进程标识）/birth或结算阶段。

GET/vcs在project-identity上下文调用Vcs.info：probe→hasHead→currentCommit（有HEAD时）→currentBranch→并行status全untracked/remote。读入口不依赖模型bootstrap；旧f00c59156已修这项耦合，不能重新以Provider配置作未经取证的原因。两个自指junction在原首次meta读取前已存在，形成有限物理候选，但Git扫描、Native准备/结算、共享竞争仍未排除。新directoryTarget浏览并非Vcs.info依赖，不将它当直接根因。

共享影响覆盖启动/重连、project reload、Runtime面板/Refresh、显式initGit读取、switch/commit/push写入后的info、Task/Mission/Session所属目录选择及多Project。消息/SSE（Server-Sent Events，服务器发送事件）是独立owner，不凭文字signal timed out归因到事件流或执行调度。原Host任务曾重叠；Task/Mission执行恢复、终态、串并行和多Project必须按既有横审矩阵核对，不能从单目录通过判共享底层排除。数据格式、数据库schema、权限/消息/Provider公共契约暂不变；未知明确保留。

## 实施前调查方案

第一阶段在全新Root自有namespace准备五个有限Git根：无link对照、健康目录junction、root self junction、祖先back junction、两自指junction共存。每根两份预声明小文本，完整正文总≤4096B，初始HEAD与真实branch固定、无remote。只本checker目录，不使用旧run或用户项目；不复制Auth/models，不发模型请求，不构造消息。五份lstat/readlink/实体target和Git事实分别保存，不按路径名字猜身份。

用当前唯一gitProcessArgs/timeout resolver和生产supervised Host Facade做原argv局部资格：原fast15秒/default90秒均为stdout/stderr活动刷新期限；分别保存admission、onSpawned、原PID/birth、完整stdout/stderr、terminal/settled/outputSettled与真正request收束。该局部直接Facade资格明确不冒充GET/vcs或Task/Mission端到端。工具只增加诊断与文件捕获，不改生产控制流、不另消费原输出流；onSpawned直接绑定原handle并保原三joins。准备/正常返回的阶段计时与真实Git运行/结算分别列出，原失败不重跑或换namespace抹除。绝对外围cap900000ms与真实无活动120000ms只属于新checker owner，不能替代产品Git/客户端期限；观察窗口到期续原handle，不restart。输出保留上限4MiB为诊断工具明确容量，若触发保留完整已取得部分/typed cause并标该案未资格，不能称产品status通过。

按原信息序列冷读各phase；有明确失败或容量异常立即保存原案并分析，不盲跑后续。对照支持后才做真实生产hostGit与GET/path、GET/vcs的完整URL/query/requestID/响应/客户端cause：串行冷/暖、同A重叠、A/B并行和正常失败/终态/重试恢复，当前scope/authority与迟到结果按原契约。工具的WindowsRequestObserver只用于这一个隔离进程，实际原markers在cleanup前透明捕获，缺失即unknown；不得为了日志伪造成功结算或新增消息。若原observer不能资格必要阶段，先记录工具缺口并设计唯一透明诊断，不先给产品补丁。

第二阶段依据真实证据补全数据/控制流根因、旧路径为何未治、定义/全部caller/同语义实现与风险，再冻结最小完整修复。禁止扩大产品timeout、去掉untracked功能、增加流程gate/影子缓存/fallback或按关键字特判。非UI修复需正式checker正向输出/状态/typed error合同；触及现测试则按当前契约修复/删除过期断言，不运行UI文案/DOM/快照测试。真实开发模式/ui桌面交互与截图人工复核检查Runtime metadata、文件数/branch及A/B切换，Node构建/类型检查不替代视觉。若没有复现，不造补丁，保有限资格与未排除项并继续实际入口调查。

Git收尾保存所有原失败、上一浏览正常push0及远端事实，更新本记录/相关README并运行当前docs:check。仅本任务文件/共享索引本条按latest HEAD精确范围提交，fresh fetch/merge、完整pending审阅、正常push与远端读回，不发布tag/Release/PR。Root所有自有服务/页面必须自然关闭、原handle/物理/输出/request收齐，未完成项明确记录。当前只完成原资料复核，尚无新运行、产品修改或此meta验收通过。

## 第一阶段真实原证据

prepare原Native/parent0，fixture acd15321-2d7a-4825-a2b3-f3a0246401d1，五根十份正文共243B、五junction。五个独立stage原Native/parent均0，25条Git原命令各exit0；原ready的PID/birth/request ID与原settled一致、active_processes0，terminal/settled/output三个原joins和父双输出均fulfilled。透明观察仅在这五个自有进程绑定原request observer、onSpawned及terminal，不另读输出流。Root全文派生review0，未造markers。

status耗时control153ms/healthy266ms/self386ms/ancestor278ms/combined44462ms；对应untracked记录1/2/32/18/11361，combined原stdout1759892B、stderr0，最长逻辑path170字符。其余HEAD/commit/branch/remote阶段仍约165–317ms（全部精确值保原json）。这证明新有限两自指输入使同一原Git全untracked扫描放大；不能把短根快/单link快排除组合图问题，亦不声称原163秒的逐命令身份已经恢复。单link的重复逻辑路径同样已出现。没有删除untracked、延长期限或修产品。

新全仓搜索发现同类枚举还可达Vcs.diff的untracked、File.status、EngineGit workspace enumeration/Task project archive；Worktree正常/merge/cleanup status也须核对具体mode，Snapshot已明确untracked=no。必须继续按共享图遍历/执行轮次入口横审，不限于一个meta UI。跨scope目标、Task/Mission/Capsule、重启/重试/并行与终态边界目前未实测，不由这25条原局部证明排除。

下一真实入口已冻结：当前工作源码Node Vite build到全新metadata-ui-bundle/bin/ui，再由Source CLI开发serve在localhost18460/ui提供，非独立Vite。Root自有新native-serve occurrence用control为startup项目，原900000ms cap/120000ms真实输出无活动，无Auth/models复制。只用既有WindowsRequestObserver透明记录原argv/cwd/call stack，watch原ready/settled文件并保原bytes；缺失保unknown，不改生产控制流/日志/消息。外部observer不另消费Process字节。

实际TCP（Transmission Control Protocol，传输控制协议）client固定15秒AbortSignal，与原UI默认期限分别资格；保存各原GET/path与GET/vcs完整URL/query、原header/body、耗时/cause及原server日志，不把后续server200写成client成功。control/healthy作基线；combined单请求先保真实client失败，原后台进程继续结算，另独立有完整读回观察预算的request保存实际最终body（不修改产品超时）。Root手工打开当前/UI、选择相同目录和Runtime元数据，查看对应原图，再两Project切换；后续串并行/recovery按已取得原结果决定下一最小输入，不能盲重放。普通公开shutdown、原Native/parent/输出/request全收束后再分析/修改。当前产品fix、HTTP和视觉仍未达成。

## 真实HTTP、桌面与收尾

当前Node构建原0（68.072秒），新Native Target23524/Host79096及原birth、occurrence metadata-serve-five-roots-08500058-4bf2-43ad-b08f-4482f02ede2c、固定deadline1791946997280完整保存。四个真实Project/空Chat注册200/201，无合成消息；对照四个path/vcs读取200，vcs770/774ms。combined固定15秒client原TimeoutError，实际15004ms/status null；独立完整观察预算120秒请求62838ms后200，原branch metadata-combined、untracked22722。这个120秒仅诊断client，不是产品期限改动，也不是把第一次client失败改成成功。

Root自有IAB4 Tab6通过当前开发/ui真实选择control Chat→Runtime，观察metadata-control及4untracked；切combined和打开Runtime后，实际Git状态不可用/signal timed out，英语与中文原JPEG显示同一失败。02原请求截图时预想Loading，捕获已经是timeout，归档前仅准确重命名，不修图/抹帧。切回独立control后正确branch/4项中文状态恢复，未承诺combined恢复。五张1280×720原JPEG逐张显示人工查看；没有UI自动化。错误文案当前呈三行窄列是另外视觉线索，根因尚未分析，未先打CSS补丁。

原服务NDJSON共有12次vcs最终200，五次慢请求59362/62801/61632/64470/45880ms，完整原requestID/开始结束和body保留；访问日志无query仍不倒填精确browser请求ID。80个真实内部Native请求各保原argv/cwd、ready PID/birth、同requestID settled/active_processes0；marker不编码各Gitexit或stdout，不能冒称全部内部exit0。外层原终态与局部25阶段分别保其真实范围。Root派生review0；原十份小正文完整bytes与五link dev/inode/raw text保持，服务正常新增.gitattributes/.gitignore/.opencorvus元数据明确另列，不能把整个fixture树伪称不变。原log error级别0并不等于页面正常，当前meta错误在实际图中。

页面关闭后精确Target StartTime ticks与原native birth及listener PID一致，80原内部settled均已捕获，普通shutdown实际200。原工具38943、Native和parent自然exit0，三个原joins/四output写入全部fulfilled、whole Job physical/output/request完整；03:03:06.448Z父join早于原03:03:17.280Z fixed cap，原namespace没有重启或deadline重置。随后原Host/Target PID均已不存在，18460 listener0。没有Auth/models副本或新模型消息，不操作用户窗口/进程。上一成功浏览29份原件和本次调查完整原件见[artifact](../../artifacts/2026-10-14-project-metadata-latency/README.md)，原失败不改写。

## 共享影响审计与下一实施边界

当前数据/控制流因果链已明确：实际两junction回到同一root，原全untracked枚举把很小物理输入展开为11361/22722逻辑路径，status慢；15秒聚合meta期限先失败，原后台仍收束并200。其它Gitphase很快，当前25原Native完整三joins、80内部零活跃结算及服务0排除了这些新发生实例的结算失败；不外推到旧163秒或所有共享执行场景。旧branch-only identity改动解决bootstrap耦合，没有改变这条枚举；目录链接浏览/迁移修复解决entry/权限/刷新，没有改变Git扫描。

已读SourceTreeSnapshot与EngineGit snapshotPaths/sourceSnapshotPaths生产调用：git.ts canonical snapshot capture、execution-capsule/tree-digest.ts源树初/终两次枚举及nested repo；filesystemTreeSnapshot本身采用lstat目录遍历，不能把它与Git source枚举混作同一合格路径。Task/Mission archive共同buildProjectArchive→listGitIncludedFiles→git ls-files cached/others；addProjectFile只lstat终端，不证明所有祖先link处理。File.status先diff，再ls-files others并逐项readText；Vcs.diff还对每个untracked做git diff numstat/patch。Worktree/GC默认为normal status需独立验证；Snapshot untracked=no排除该项扫描，仍保其其它合同。相关源已读，实际Capsule/Task/Mission archive、跨scope目标、重试/重启及全部终态矩阵尚未执行，不能判仅meta局部问题。

因此本轮先交付范围清晰的根因证据与完整共享调查，产品源码未修改、修复尚未完成。下一轮须继续冻结单一Git/目录entry枚举契约，核对所有生产消费者与现ignore、tracked/delete/rename、目录link/嵌套仓库、串并行/多Project和实际Task/Mission/Capsule数据，保留用户untracked能力与长路径配置；不得靠去掉untracked、提高timeout、后台预热缓存、增加影子目录或消息遮蔽当前根因。工具第一次归档README补丁因错误spec锚点原失败、没有文件变动；核对实际末行后修正，原tool错误保留在chat，不伪造独立进程退出文件。文档检查、范围提交、fresh同步/完整pending审阅与正常push仍需实际收尾；总体goal active。

## 继续轮次 Recall 与目录边界候选资格

上一轮实质进展：调查与697原件已提交e286cd6a9a6206f6876022a49aab37ce6a5417a3；Root正常push原0，但原stdout为Everything up-to-date，表明该次没有新对象上传，不能冒称自己上传此前他任务已推送的对象。fresh最终HEAD/upstream/remote50cf35a83baa9467e59aa91f541fc0d53dd8756b、e286 ancestor0、own record/artifact clean、index空，原证明在.tmp-codex-project-meta-01a133。Root全文复核新增纯文档27/81范围修正、artifact checker gzip/qualification合同及唯一成员指导helper适用条件，保留其Task实页/完整流中关开未资格。不恢复子agent。当前foreign permission/session/ledger、投影测试退役与共享spec记录/索引保留。

已继续读EngineGitProcess的单一隔离runtime/固定配置/实际runner，git.ts canonical raw-blob snapshot中的lstat/readlink/120000路径，SourceTreeSnapshot的stable root/file/symlink、nested repo与初/终两次Git枚举，Task/Mission shared archive；当前terminal link本来有entry身份保存合同，而legacy ls-files扫描未给junction自身、反而自动展开后代。原Git for Windows2.45 dirent明确只把SYMLINK tag当link，MOUNT_POINT进入directory分类，是本机观察的机制依据；较新宿主是否改变该行为未知，不用换机器或猜测升级代替修复。[对应源码](https://github.com/git-for-windows/git/blob/v2.45.1.windows.1/compat/win32/dirent.c)。

本阶段先资格成熟Git目录边界和ignore输入协议，不修改产品。沿上轮仍保存的control/healthy/combined有限根做只读输入，新directory-query Native发生实例和独立home/runtime；原before namespace不重启、不重新准备、无Auth/models。实际生产hostGit分别调用ls-files cached -z、others/exclude-standard/directory -z（保长路径配置、不改当前Gitglobal config）、已声明目录的literal pathspec及check-ignore -z -v --stdin/non-matching相关原协议。查询结果必须保完整NUL bytes、argv/cwd/时间与原Native输出/结算；输入固定、不搜索用户目录，不按结果迭代猜路径。复制工具版本与原input后才执行，900000/120000ms外层和fast/default原期限分别保持，观察过期续原handle。

资格目标是确认directory边界是否在两自指组合中有限返回、哪些路径仍完整可见、empty/ignored/link/nested Git目录怎样表示；不把directory aggregate当最终逐文件结果。候选最终共享primitive必须由当前Git index与当前Git ignore权威、真实非跟随entry遍历产生完整源集合，caller原scoped runner只负责传递其现repo/index/ignore配置。至少覆盖tracked/delete/rename、未跟踪普通文件、terminal file/dir links与broken/outside links、嵌套仓库、特殊字符、parent ignore与否定、嵌套ignore、index下已有alias后代、同Project并行/A-B、Task/Mission/Capsule实际调用。原native Git VCS stage/commit等写路径也须查清影响；还没有冻结替换代码，拒绝以目录计数、省略链接或隐藏错误作修复。确认这些规则后再写正式单一实现方案与正向验收，不引入缓存、fallback或第二Git配置。

## 单人实施方案：共享源条目读取

Root独立复核两次新原Native运行：directory-query的12条生产hostGit命令均0，combined目录aggregate 282ms，literal alias 197ms；semantic-query的真实NUL标准输入/四字段输出保存完整，check-ignore能返回实际.gitignore来源/行/规则/路径，glob查询只能返回父aggregate，不能用于展开。原Native/parent均0并保三joins。方案据此冻结：新增唯一GitSourcePaths枚举，以调用者原scoped Git runner读取cached index和others/exclude-standard/directory边界；只展开真正普通目录，逐层用Git check-ignore --no-index --verbose --non-matching -z --stdin裁决。终端junction/symlink作为一个条目，保留raw readlink，不展开目标；普通空目录不产生源文件，嵌套Git仓库保持一个边界条目。Git index中的删除路径保留；tracked路径若中间祖先已经变为链接，返回明确linked_ancestor错误，不能读取另一棵树。NUL协议、忽略否定、真实I/O错误必须校验，禁止静默空集合。

迁移本次已找到的全部全untracked读取：Vcs.info、Vcs.diff、File.status、EngineGit snapshotPaths/sourceSnapshotPaths、Task/Mission shared archive及其Capsule调用。保留调用者原Git隔离配置、长路径、期限与流式Process runner，GitOptions仅增加现Process已支持的输入流透传。Vcs.info的tracked porcelain与完整untracked entry集合共同构成当前计数，公开字段保持；链接计一个真实条目而非重复后代。Vcs.diff/File.status读取终端链接正文时使用raw readlink；嵌套Git目录在父diff中按边界给零文本统计。Capsule/Engine沿现lstat/readlink/raw-blob合同保存链接；archive沿现普通文件合同不导出链接目标。旧全untracked读取同步删除，不留下备用枚举。

当前Git add --all写入口、normal Worktree/GC dirty检查与此次源条目读取不同：不擅自把原生Git提交替换为手写index协议。必须独立资格并如实记录结果；若junction写入仍放大，它是下一范围的未解决问题，不能据读入口通过宣称整个Git能力完成。权限、Session/Mission调度、消息、模型、数据库schema不改，当前无凭据/新模型验收需求。

归档影响复核发现fileCount当前取候选paths长度，而addProjectFile会跳过链接和目录，manifest与实际ZIP文件数有机会分离。此次新增准确终端entry后该影响必须同时收敛：addProjectFile回传实际普通文件导出事实，Task/Mission公共buildProjectArchive累加同一个计数，manifest及返回值共用该事实；不将链接数伪称已导出文件数。新增实际ZIP读取正向验收。

规模影响复核：递归每目录单独check-ignore会令Git进程数随目录数增长，影响现2300文件/23目录的真实Engine拓扑合同。采用同一物理枚举的逐层候选批次，每层一次真实Git ignore流式请求，先过滤再进入下一层；一层中的多个普通目录共用该请求。仍仅有一个当前实现，终端link不入候选目录队列，无跨请求缓存。追加现2300文件checker，修改后重新执行接口与桌面资格。

验收：真实Git正向集合包含tracked/deleted/rename、普通未跟踪文件、忽略否定/目录规则/嵌套规则、特殊字符、嵌套仓库、healthy/self/ancestor/combined链接和linked_ancestor明确错误；实际Host runner及Engine隔离runner都执行，A/B串并行结果精确。继续现原有限fixture的GET/vcs必须在产品15秒读取内200、branch/计数正确。Root启动新的隔离开发/ui，英语/中文Runtime与A/B切换实际操作、截图人工复核；不得运行UI自动化。聚焦现source-tree、Engine raw-import、VCS服务和新增共享枚举测试，失败保原件后修根因。新原run单独namespace/原deadline/原结算，保留之前失败；文档检查、范围提交、fresh merge/完整pending审阅、正常push后进入下一批。

## 单人实现、原失败与最终资格

共享gitSourcePaths已替换全仓找到的全untracked读取，没有留下旧全扫描备用路径。GitOptions输入仍经现supervised Process；Engine隔离runner传同一个真实work-tree/index/ignore配置。现Project.isGitRepo委托Filesystem同一磁盘marker实现。Vcs tracked status与完整entry count合并，link正文为raw readlink（非UTF-8按binary）；File status沿原native path合同返回。Task/Mission ZIP的manifest及返回值共用实际导出文件数。新的[当前架构](../../current/architecture/git-source-entry-enumeration.md)定义这些公开边界。

原检查器失败完整保留：首轮移动.git遭Windows EPERM，改真实separate-git-dir初始化；消费者期望错误地把File API native path写作斜杠，按原合同修正。早期工具沿用Bun1.3.14；r3虽更换外层1.4 executable，package脚本child仍走PATH旧1.3.14，原stdout证明，不冒称1.4。r4与最终breadth同时固定原child PATH，全部实际test stdout1.4.0。追加checkpoint最初嵌套toMatchObject/expect.any(String)会把实际baseline commit改成matcher对象；独立原probe before字符串/after对象直接复现，改用原标量断言后真实Git tree、两个120000 blob与result正文均0且匹配。r4最后旧期望3 untracked与checkpoint实际已发布index不符，删除该过期假设，改验真正最终index四条路径与mode。没有为测试恢复旧实现，失败发生实例均未重启/覆盖。

最终native-source-breadth真实原0：24 pass / 1 POSIX-only skip / 83 assertions；六个文件包括新entry/consumer、VCS服务、source tree、raw import和2300-file真实Engine拓扑。最后2300文件/23目录仍保一blob import/一index import及现进程数合同。真实Task baseline/result、ZIP已实际执行；这只资格数据/checkpoint/归档路径，不冒称模型或Mission执行、重试/重启端到端。无新凭据、catalog或模型调用。最终typecheck、docs:check、architecture index（20）和module topology均原0；这些不替代下面视觉资格。

第一服务18462的17原TCP操作与8次手工流程取得combined2133ms/200、6entry、control4entry；Root查看5张原JPEG。逐层合并后新的18463/当前开发/ui再次17原TCP操作：冷combined1198ms/200、6entry，五根分别4/2/2/2/6，八次并发全部200且Project隔离，最长这些vcs2710ms（并发最长2895ms）。Root IAB4自有Tab8英文combined→设置中文→control→combined，3张最终1280×720原JPEG逐图人工查看，branch及6/4/6正确，未用DOM文本/像素/评分替代图片。Root Tab7/8分别关闭；各原固定cap不变，普通shutdown200，Native/parent0、physical/output/request三joins完整；原237/189内部请求均原ID/PID一致、active0。原十份小正文与五link dev/inode/raw target仍保留。

normal Worktree/GC同语义的五条真实git status --porcelain均0（control922ms，其余155–265ms），该读取没有元数据all扫描放大。随后combined native git add --dry-run --all原运行在无输出后达到外层120秒真实无活动期限，原inactivity_timeout/1、全Job收束保留；未取得Git自身退出、输入流或index前后保存，不倒填它们。原生写入口问题尚未修复，将在下一批结合实际请求/期限/结算开展横审，不能把读修复外推成整个Git能力完成。当前无外部依赖阻塞，持续目标active。

本轮[完整2100原capture](../../artifacts/2026-10-14-project-metadata-latency/source-entry-read/README.md)共3290049B，包括协议、原失败、修正运行、34原HTTP、两完整服务日志、426内部request原件及8原图；manifest只用于真实capture/存储/提交身份，不用源码摘要或像素gate验功能。一次缩减格式差异的辅助探针先因import路径错误、后因printer比较不等失败，未改产品；保留原工作文件，没有把该非功能检查设成交付门槛。范围提交/同步/推送由后续真实Git收据记录，不预写成功。

## 下一轮 Recall：原生写入与真实终止阶段

上一轮为实质进展：共享读取8da864d505ffdbf40ecc561f177730b60df42235实际提交2121路径，原普通index精确同步为空。首次正常push的全部hooks通过，远端并发已到8da，原expected-c6 ref拒绝/1保留；重新fresh fetch/merge、完整待推送集合复核后正常push0/Everything up-to-date，最后HEAD/upstream/remote fe0989e1456a58bbef73e5bc60167aa37163548a、8da ancestor0、own scope clean。实际回执在.tmp-codex-project-meta-01a133/source-delivery-*和source-final-proof-*。这次0没有新对象上传，不把并发推送归为Root上传。原追加调查文档9469完整Markdown和136原immutable Git blob已独立复核，不按其委托文案重新启用子agent。

用户“停止所有子agent，你自己验收”继续有效：仅Root执行，未委托。本轮初始status为foreign task-api/交互恢复、代理设置、408记录与共享索引等修改，保留。相关代码、当前共享源条目架构及上一真实失败已重读。没有新branch/worktree/粗回退或发布授权；没有新模型调用。

全仓当前写入口调查发现：Vcs.commit→hostGit add --all；Snapshot.add→独立git-dir/work-tree及可选index；Build pinBuildObservationTree→私有index read-tree HEAD/add -A；Worktree主目录merge恢复→normal status目录aggregate再分块git add paths；GitHub CLI三个提交路径→Bun shell git add .。EngineGit的checkpoint用raw-blob/index事务，上一实际Task baseline/result已资格其终端link正文。这些是不同生产入口，不能修一个按钮后判共同写能力完成。Snapshot和Build原配置、clean filters/属性、ignore、tracked删除/rename、gitlinks、index锁/用户并发、Task/Mission/Session发生实例、正常/终态/重试/重启及多Project仍需完整分析，尚未批准产品替换。

原remaining运行只记录normal五phase成功，随后hostGit(default90秒)未返回，外层120秒无输出到期，最后whole Job三joins完整。没有记录leaf onSpawned、原Git请求/终止调用与原index-before落盘，无法据外层报错判定Git默认期限、Native admission、termination或output drain哪个异常。Process.runHost原参数确实经runRequest传入共享Facade；原timed-out handle须另取证，而不是假设已经证明共享底层正常或简单提高期限。

先准备新的单次只读dry-run诊断，仍使用原有限combined root，不覆盖旧run。保存index-before与输入后才调用实际hostGit；在自有隔离进程透明绑定原Process.runHost onSpawned/terminate、原terminal/settled/outputSettled及现WindowsRequestObserver。记录真实阶段事件，不加定时heartbeat、不改Git90秒或外围900000/120000ms设置；这些实际事件输出可自然刷新外围活动期限，不能回写旧run或称产品超时已修复。每次只一个leaf Git，完整stdout/stderr及异常均保留，未知不能倒填。原handle自然结束或原限期结算后才检查原index与fixture实体；若仍缺阶段，先修工具链并收集同一真实路径。

下一候选能力须保持单一source-entry选择及原Git属性/clean-filter/配置，用实际普通文件有限path输入、终端raw link/嵌套gitlink的明确index合同；具体API和事务未冻结，不先实现手写index或抹去用户暂存状态。先独立验证Windows junction在native Git已跟踪link状态与raw正文的真实语义。正式修复后必须正向Git/checker、真实开发/ui提交交互/原截图及必要的已授权Sol验收，再范围提交/fresh合并/正常push。当前为调查，不宣称写入修复或总体完成。

新诊断第一run真实leaf128，index.lock0B/creation04:45:32.1839042Z来自原dry-run窗口；当前Git/supervisor存活实例都晚于原closure，相关自有namespace的command-line匹配只有检查shell。精确dev/inode/birthtimeNs/mtimeNs确认后，同卷单文件rename保留原锁（最初Date精度和跨C/D rename工具错误保留且未移动），没有删除用户数据或终止用户进程。第二run原leaf ready85588/Helper63316/owner91032及真实Git90秒输入已捕获；到外层120秒原终止，事件只有admitted/spawned，内层terminate/joins/hostGit返回均未观察，后读ready存在而cancel/settled不存在。不能把外层whole Job收束倒填为内层request收束。

立即按共享期限异常横审：当前util/process单一25ms Atomics.waitAsync clock同时服务physical admission/abort/deadline、inactivity、5秒settlement；全部host/task/Plugin/SDK入口需纳入。现04-extensions公开合同及814540/581fee/08d944历史已读，尚不移除其clock或keepalive。下一最小只读checker用真实Node静默进程，对当前生产host/task facade的冷读、一次自然成功后的再次调用、串并行/两目录、单deadline与单inactivity分别资格；单独原Atomics.waitAsync和host timer事实用来区别宿主机制。外围原20秒cap/10秒无活动属于这个新checker；不重启Git失败owner、不提高产品期限、不生成heartbeat。先取原handle/错误/输出/marker事实再选择修复，现mock局部settlement测试不冒充真实运行。

冷host静默真实Node进程已原0完整资格：Bun1.4的原waitAsync在298ms返回timed-out（启动加载期间host timer297ms），实际spawn68824后523ms原inactivity terminate被调用，约41ms收齐terminal/settled/output，明确reason inactivity_timeout/code1和原错误正文。此证据排除这个新冷host实例的clock失效，不外推到Task/Mission或Git。Git原hostGit会内部收集stdout/stderr直到返回，缺少final输出不等于leaf没有字节；可能持续warning刷新90秒活动期限。下一诊断在原单消费者byte source上透明观察并原样yield，保存实际完整chunk/时间/累计量，不另消费输出；显式4MiB诊断保留容量属于checker、触发output_limit必须保完整已取得内容与原三joins，不能冒充产品90秒timeout或正常写入。仅真实首次数据/容量变化事件输出，没有周期heartbeat。

## 原生输出根因与链接写入语义证据

output-probe真实hostGit原spawn77756后48.048秒才出现首stderr203B/首stdout4096B，随后真实字节持续增加（1/2/3MiB分别约70.6/95.0/118.6秒）。约125.648秒触发预声明4MiB诊断容量；原output_limit terminate、terminal/settled/output三joins及实际Native request零active在53ms收齐，terminate-returned随后保留。观察完整原stdout3457024B、stderr740644B，原index137B前后相同；source volume events自然刷新外围期限，没有修改产品90秒或旧发生实例。stderr明确显示多层重复aliases/root-back的embedded Git警告，stdout列出递归路径。当前小物理图被Native Git add展开，持续输出本应刷新内层真实活动期限；旧外围监控只看到未转发的聚合结果，错误地把活跃leaf判为无活动。没有证据支持删除共享clock或延长产品期限。

无额外timer/Atomic probe的10秒真实静默Node也原0：spawn80932→10007ms inactivity terminate→55ms内原三joins及错误正文完整，进一步排除短窗口探针掩盖长期clock失效这一候选。代码上Host/Task/Plugin/SDK共用同一个clock、控制signal和settlement契约；实际Git此次output_limit也走该唯一终止路径并完整归零。这些精确实例足以改变本Git调查行动，不泛称所有Task/Mission/retry/restart端到端已验。

新的独立link-index-protocol有限仓库实际14条hostGit均0，约5.7秒父run正常结束。真实raw readlink→hash-object stdin→update-index 120000→普通commit成功，HEAD blob与原raw字节完全相同；但commit后原native status为` T root-link`，core.symlinks=true仍同样T，原native raw diff显示120000→160000。因此当前Task canonical raw-link捕获与Native Windows Git将junction当embedded Git目录的比较语义存在真实冲突，可能令Vcs/File/Build/Snapshot比较、commit后的dirty与后续merge恢复继续错误；不能把有限staging通过当完整修复。

已查阅当前实际Git2.45相关[git-add](https://git-scm.com/docs/git-add/2.45.0)的literal/NUL path输入、[update-index](https://git-scm.com/docs/git-update-index/2.43.0)和[hash-object](https://git-scm.com/docs/git-hash-object/2.43.0)的实际对象协议；资料只支持下一实验，不证明本机index/clean filter/事务正确。现Engine canonical index-lock准备/安装/ownership清理、前驱index保真与rollback已读，不能复制另一套竞争锁或用隔离Engine配置抹掉用户clean filters。

后续完整修复必须同时分析并实现：以唯一gitSourcePaths选择有限普通文件/删除/rename、raw terminal links与真实gitlinks；保留各入口Git属性/clean filters/ignore/scoped index；当前index内容与合法user staging和外部Git竞争按原atomic index锁契约收敛；HEAD/index/raw工作树链接比较由真实Git blob及lstat/readlink产生，不能用Native错误T隐藏真实变化、缓存旧dirty或创造平行协议。范围覆盖Vcs、Snapshot、Build私有观察树、Worktree merge恢复及GitHub CLI；外部原生Git工具行为作为明确边界，不借更换用户junction掩盖兼容差异。方案尚未冻结，当前无产品staging或status补丁，避免先交付只能通过单按钮的改动。下一轮继续真实事务/比较与完整消费者方案，当前goal active。

[六原发生实例的完整138 capture](../../artifacts/2026-10-14-project-metadata-latency/native-write-investigation/README.md)已归档4842523B，Root独立逐chunk核对：stdout844chunks/3457024B、stderr3639chunks/740644B，最大观测静默间隔48047ms小于90000ms，真实output-limit请求和原Native settled身份一致、active0、原三joins53ms完成。最初R2 leaf结算缺失仍未知，不能由后一个成功结算补造。新repo .git/数据库/auth/models/executable均不归档；原真实Git输入/输出、raw-link字节与两个已退休0B锁保留。此轮没有产品修复、新的UI或模型通过声明；文档范围提交与正常Git收尾不替代未达成的写入/准确比较/真实页面与必要模型验收。
