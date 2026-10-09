# 225 VCS 事实读取与 Source 中文操作

## Recall

用户要求持续自主体验/改进UI（User Interface，用户界面）、功能与Sources/Rendering，最新只使用单agent，不委托。224已推送d81ba114，开始git status干净，前轮为真实进展。继续223/224General中真实GET /vcs400/ProviderModelNotFoundError，改善文件Source中文“源码文件”操作措辞。用户IAB（In-App Browser，应用内浏览器）23/进程不动；禁止UI自动化测试、假来源/消息、额外工作分支、重启旧scope或无分析修补。

已读224Recall/真实页面与HTTP（Hypertext Transfer Protocol，超文本传输协议）窗口、05/07架构、server项目上下文分类与中间件、app routes三个VCS（Version Control System，版本控制系统）GET及branch/commit/push/commit-message stream、Vcs.info/branches/diff/当前分支/state/FileWatcher/BranchRefresh owner、loadMeta/General反馈、SourceParts/i18n；全仓生产与测试使用/错误/schema搜索。VCS三GET只用现有Project身份和实际hostGit，写入/模型生成有不同契约。相关旧测试把GET /vcs当通用runtime初始化探针；须迁移到真正runtime入口GET /command，不能保留错误读路径取悦旧测试。

验收：无可执行模型的项目可读取真实VCS info/branches/diff，实际多Project隔离与热分支变化返回当前Git事实，非Git/先决错误保持明确输出；实际runtime入口仍返回原配置/模型错误。General和Environment读取实际项目事实，中文Source打开及原文件正文正常，截图人工复核。模型/PROMPT/写入能力不绕过，SDK（Software Development Kit，软件开发工具包）与API文档同步当前合同。

## 修改前深度、根因与影响

观察：223/224的General显示meta API400 /vcs；原Source/文件依旧可读，且原授权OpenAI有效，当前历史副本特意无模型目录。触发是loadMeta并行GET path/vcs；path已identity，vcs仍runtime。Server中间件先Instance.provide(init=Bootstrap)，原配置显式gpt-6.1-sol完整校验失败，在Vcs.info前拒绝。根因是读取能力选错现有项目authority，而非凭据、Git或某个工作流。221改文件读者、224改客户端语言，都未改VCS三读者。

定义/调用/公开合同：info只读磁盘Git状态、HEAD/remote，branches列实际local refs，diff读HEAD/default branch差异（既有unborn empty-tree primitive保持），三者不需模型、FileWatcher启动或Prompt。info与branches目前又从state.branch读取依赖Watcher更新的缓存；identity仅初始化项目事实不启动Watcher，若保留该依赖可能热分支陈旧。代码已明确此依赖，修改前通过真实Git/现有identity/state路径正向probe核对，再决定现有currentBranch物理reader复用范围，不新建branch cache/owner或fallback。Runtime BranchUpdated owner、启动/终态disposal与控制流不拟改变。

按已有PROJECT_IDENTITY_ROUTE_KEYS精确列入三GET，不扩大POST/stream；只读Info/branches若确认缓存问题，复用currentBranch当前Git reader。原VcsPrerequisiteError、Git过程/timeout/drain、diff限制、Project目录/Worktree事实保持。实际Git branch/commit/push写入及commit-message流式模型合同保持，当前模型校验仍在真实runtime入口；不能通过隐藏错误、另一API或合成消息完成。

公共响应：GET /vcs当前400专门描述runtime模型/candidate错误，应移除其过期descriptor并同步OpenAPI/SDK/文档。server shared error handler与真正runtime错误原类型不改。旧config-candidate-status/builtin-collision/candidate-reader-provenance的冷runtime案例迁到/command；VCS元数据测试改当前200字段。继续明确原资源读取错误/typed候选拒绝/原模型错误，而非负向断言旧路径不可用。

并发/恢复审查范围：三GET同一Project context原directory与Instance lifecycle；Git实际进程采用现有公共Facade与timeout。两Project串/并与读取后的实际HEAD变化需测试；没有调度、Task/Mission/Session执行轮次或终态异常证据。若branch probe发现Vcs refresh队列/终态异常，立即扩共享机制横审；当前缓存依赖是假设，尚未作队列根因结论。

UI范围：SourceParts的source-file含普通文档/文件，不仅代码；en“Open source file”准确，zh“打开源码文件”误将来源译为代码。改同一现有key为“打开来源文件”，不改identity/Tooltip/打开路径/range/排序。只有真实页面/截图验收，不创建文案、DOM（Document Object Model，文档对象模型）、组件或截图自动化测试。General不隐藏Model/其他真实错误；只修成功读取事实。

## 实施前计划

先新增聚焦正向Git/identity probe，保存原失败，实证后追加分析才修改生产。三读者/分支物理事实、过期runtime测试/schema、中文key按上述合同落地；实际backend HTTP测试与聚焦原runtime错误案例、types/SDK生成/docs。新SDK生成复用当前transaction工具，不手写另套types。所有运行器/检查故障先修并重跑。

复用原222before完整自然Source历史：fresh只读配置/两个Project/Task-Mission-Session/请求/发布/lease/恢复/终端准入、原birth/port/pair闭合，再全90表actual逐行相等复制，原directory/Project/Session/Source保持。fresh vcs-source-225-after-01/18152固定900000ms，无模型、auth复制、历史Task/子agent重启。真实开发serve /ui，新asset actual200；General/Environment和中文Source操作/原文件正文/返回截图人工复核，不单开Vite，不操作用户23。

自己页关闭、sole公共shutdown、原foreground0、Native真正exited0/fullphysical-output-request、独立birth/port/pair；最终13表actual行与原Project属性审查，不能用hash/count冒充。所有observer/checker闭合后归档精确自己出生生成文件，包含测试实际进程出生证据，逐文件Move不递归清理。spec/root/月/本目录索引、docs、范围commit、fetch/merge上游/待推送集合核对、正常push。缺口明示，goal持续active。

## 修改前实际branch证据与追加影响

实际正向Git probe原1保留：同identity第一次info/master，真实branch rename到current-reader-225后仍info/master，branches只有新名但current=false。第二probe同问题原1保留，实际linked checkout成功且Instance.directory/worktree都指向该检出，排除worktree/directory混用假设，不修改currentBranch的现有cwd。新测试只在managed temporary scratch Git repo创建/更名/linked checkout，不在用户交付仓库创建额外branch/worktree。

已横审Vcs state/createInstanceState/State.dispose、BranchRefreshOwner串行tail/active/dispose、Bootstrap FileWatcher→Vcs.init及全部resetState调用。identity并不启动Watcher，因此初次缓存没有真实HEAD通知，非refresh队列失效；原probe完整实例/进程终态正常。复用currentBranch在info/branches读实际事实；runtime Vcs.branch及BranchUpdated owner保持。switchBranch原resetState后曾由info隐式reattach，改为显式await init再返回fresh info，保持原监听生命周期。resetState当前唯一生产调用是该mutation；注释同步移除info重新初始化的旧契约。不会清理其他state/写入目录或新建observer。

## 首次检查与运行探针调整

三读者/分支修复及SDK生成后首次38例35pass/3fail原输出保留。schema测试误把namedErrorResponse的当前inline schema当ref，按实际公开name/data合同修正；分支列表含两条真实refs，改为校验实际current项，不用单元素数组长度取悦测试。

迁到/command的README恢复案例在完整candidate恢复后500；直接Command.list实证原错误是声明的computer MCP（Model Context Protocol，模型上下文协议）连接失败，diagnostic c7f91dec…，与锁释放/模型启动校验不同。Command.list在相同runtime Bootstrap后额外调用MCP.prompts连接已配置server。此测试原目的是真实锁读取/candidate/完整runtime初始化，现选GET /session/status：当前同一InstanceBootstrap与完整candidate校验，返回真实执行状态映射，不查询额外专业server。不是让坏candidate通过或换成identity路径；原MCP500/直接诊断保留后续独立调查，当前不将它宣称根治。三个旧冷runtime案例一致迁到此真正runtime入口，VCS读取另外独立验收。

## 最终结果与继续项

[当前实际证据](vcs-source-225/README.md)与[月记录](../../records/2026-10/2026-10-09-vcs-source-225.md)。最终38例/101断言及types/SDK/build/docs通过；真实General中英文、Environment实际分支计数与中文Source打开原正文人工复核。分支按钮实际transformCallback错误和工作树400保留，继续分析；原computer MCP500仍未修复。不能宣称整个环境面板已通过。

自身IAB47关闭；exec10041和Native实际0/fullphysical-output-request，完整90表启动复制与最终13表逐行相等。无新模型/Task/子agent执行。主Project只.git目录mtime变化，两个Project无新增/删除内容。全部观察和检查器闭合后精确5个Native出生文件逐文件归档。提交和正常上游同步推送后继续单agent迭代；不因本轮完成将持续goal标记complete。
