# 项目元数据慢读取阶段与入口资格

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
