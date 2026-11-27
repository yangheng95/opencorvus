# 记忆整理失败后的租约与可重试状态

## Recall

- 用户要求本人持续按批次迭代直至明确停止；不用子代理、新聊天、分支/工作树。每批先根因/影响分析及本规格，再有证据修复、聚焦正向检查、真实桌面交互/截图本人复核、必要的精确GPT-6.1 Sol真实任务、范围提交、获取/普通合并上游/正常推送后继续。现有Provider（模型提供方）凭据和完整模型目录已授权，精确openai/gpt-6.1-sol流式请求不限；不刷新/披露，不发布/tag（标签）/PR（拉取请求）。
- 上批f05238d6026d75ef1f1e36c92d0e287cafd545fb已实际推送，原75387明确退出0，本地/上游/实际远端相同0/0、暂存空、原177条状态逐项保持。修复正文附件授权预览和错误重试焦点；7项112断言、真实业务5工具/6流EOF（End of File，流末尾）、20张原生图本人复核。7个自有API（Application Programming Interface，应用程序接口）/前端服务退役、配对凭据副本/临时身份退役、中文系统恢复。旧392标签失去绑定未安全关闭；草稿本地文件选择器未实测，不能改写成已达成。
- 本批线索来自真实run134：第3条memory源读取持续进展后以read/TypeError/ECONNRESET（连接重置）终止，源读取持续约15分钟；6个主业务流正常结束，错误原因未知。run135重启后确有额外memory恢复流EOF，持久化同项目revision55/status idle，无整理lease（租约）。因此不能仅凭重启通过，认定失败时已正确收尾。
- 本批私有目录opencorvus-iteration-20261128-memory-lease-settlement已核对上批交付/退役/HEAD（当前提交）及177条状态；保护23原文件、473消息/1401片段/403请求/403结果/45发表共2725旧项目行、原两完成Task（任务）及23引用行。原示例Git仍f7bf091156c9b137c4eb3d5b822721294e9a8f24，源项目脚本/测试不执行，原文件不变。已保存三个脏索引原始字节和差异，第四个10月索引不触碰。
- 已读当前project-memory架构的来源/归属/流式整理/FIFO（First In First Out，先进先出）/租约/失败与恢复合同，ProjectMemory的统一采集、begin/release/状态/提交函数，整理器的自动/手动/工具/启动入口及background runner（后台执行器），统一控制租约和现控制租约owner（持有者）清单、相关记忆事务/后台/恢复测试和11月19日初始状态规格。全仓检索相关定义/调用/同语义释放与现行历史决策；继续补全横审，未闭合前不改生产实现。
- 沿用computer-use、benchmark-debug-template技能。禁止UI（User Interface，用户界面）自动化/DOM（Document Object Model，文档对象模型）/组件/文案/快照/像素断言，仅本人真实页面交互及原生截图视觉复核。非UI本地事务或脚本化传输只证明对应机制，不能冒充真实Provider端到端。

## 实施前调查与验收计划

1. 代码线索尚待真实事务验证：ownsOrganizerLease同时要求ID、可用性generation（代次）、文档revision（版本）和未到期。它被语义提交/不可用删队列和失败release共用；如果已到期且未被新持有者替换，失败release可能留下organizing。原实现的防过期写入保护有必要，不能为了释放而弱化提交/队列/新持有者保护。
2. 先用现生产事务和真实持久行重现短租约自然到期后的release结果；不伪造界面、Provider成功或自然业务消息。核对原文档、pending、代次、版本与公开状态。进一步审计全部生产采集/整理入口、Task/Mission（任务编排）/Session（会话）执行轮次、成功/失败/取消/重启恢复、串并行与多项目；统一控制租约的“已过期物理行”与记忆文档状态不可只按名字类推。
3. 分析闭合后补记唯一根因与方案，再实施。必须保留一个租约事实源，旧结果提交和队列消费仍要求当前有效租约；失败收尾只能结束自身当前身份，不能覆盖接替者或新代次。若不是本地缺陷，保留精确证据和未知部分，不因连接重置构造无根据补丁。
4. 聚焦正向后端检查验证具体持久输出：有效/过期自身失败的可重试状态与完整输入、接替者继续提交、配置代次、并发及项目隔离。必要时修正本批触及的过期测试，只运行直接相关非UI检查。真实精确Sol使用完整凭据/目录成对预检，可用/模型投影/实际请求模型分别验证；真实任务与开发/ui页面截图本人核对，不能以模型自述或分数代替。
5. 不把原Provider连接重置解释为本地根因，不凭通过一个场景降级共享审计。原项目保护、旧Task/CSV原件、服务原句柄/流终态/配对副本清理、已知失效旧页限制必须如实复核；规格/证据/索引与当前架构同步，范围提交后获取/普通合并上游、完整待推集合审查/正常推送。

## 根因与影响分析闭合（生产改动前）

- 实际复现：私有expired-lease-probe通过仓库正式隔离检查器、现ProjectMemory/Session/SQLite（嵌入式关系数据库）事务及真实时钟，创建1毫秒短租约，实际等待自然过期后调用现release。得到released=false、公开status=organizing、revision0、pendingCount1，完整pending前后相同，原始JSON已保存。这是生产事务的局部机制证据，未冒充Provider或UI端到端。最初私有脚本使用裸Windows绝对模块路径导致BusEvent重复注册，未进入用例；改为规范file URL（文件地址）入口后重跑原checker（检查器）明确退出0，未清空事件注册表或改产品来绕过工具问题。
- 控制/数据流根因：runUnlocked的Provider/解析/容量/提交/取消错误都经catch调用releaseLease；releaseOrganizerAttemptInTransaction复用ownsOrganizerLease，要求未过期。因此“当前仍是自己的已过期租约”也被拒绝清理。序列为pending持久化→租约status organizing→超过租约期限→已知失败→release=false→文档仍organizing；新请求或项目重开可再取新租约，所以重启通过不能证明失败时的公开状态正确。原防过期结果提交检查只证明写入权限，不能充当失败收尾的身份条件。
- 共享横审覆盖：全仓三个生产采集调用域是Session.persistMessage（Chat/Work/Coding/Channel及Mission输入经其真实Session）、engine.pipeline中用户Task创建、engine.interaction中的显式权限/问题答复和拒绝。owner统一追溯Task根Session或会话父链，Mission Control使用真实根会话/相应Task，不存在另一份Mission记忆队列。它们全部进入同一Project pending及持久organization request。自动Bus订阅、启动恢复、配置代次变化、手动HTTP（超文本传输协议）和memory.project_organize工具都调用同一run/runUnlocked，按projectID串行并合并again；正常commit/容量或不可用状态分别通过有效租约收敛，错误/取消只有当前release调用，finally释放自身scheduledRuns槽。重试与重启沿原pending，不能删除或改写输入。
- 横审全部物理控制租约：现清单18 owner/25 acquire（获取）点检查通过，覆盖Bus投递、Channel effect、build cleanup、dispatch admission、永久OS（操作系统）进程身份、Task完成/根入口、Mission关闭/恢复/删除、权限effect、Protocol投递、Automation/Event、Session控制/删除/shell及Task取消。实际局部事务对12种可过期目标分别自然过期，现release均false但新持有者可立即获取并正式释放（48断言）。物理行以expires_at表示已经结束，返回false不会留下另一份“运行中”文档状态。Task/Mission/Session终态和重试还以各自正式事件/结果事实收敛；Session.settle有当前断言与终态事件，Mission关闭的事实/释放同事务及finally手回，Task closure通过当前激活读取；Channel跨过期错误收尾已有精确原持有者再获取/结束合同。永久进程身份由OS观察决定死亡，不按普通短租约测试或重写。没有据名称把这些策略替换为记忆文档方案。
- 共享根因范围：确认缺陷位于所有Project记忆输入共用的文档envelope（封装）失败释放，不能按某个Task/Mission/工作流降级；不改变物理控制租约的到期语义。上批源ECONNRESET为何发生仍未知，也没有失败当刻的旧envelope快照，故不声称该次必然走到了过期释放失败分支。依据是当前生产路径和此次真实事务复现，不是错误标题或模型自述。并行接替与多项目隔离还须用当前正确输出及实际独立进程验收，不能只凭单一复现宣告完成。
- 唯一实现方案：抽出当前租约身份匹配（ID、可用性代次、文档版本）作为唯一谓词，begin幂等复用、活动写入检查、失败释放共用。语义提交、删队列和状态设置仍额外要求未过期；仅已知失败的自身当前租约允许到期后释放并写retry_wait。接替者/新代次/新版文档不匹配，旧失败不能释放它们。同步删除begin中的重复身份表达式，不保留旧释放路径或增加后备状态/配置/LLM路由。
- 接口/数据/文档：函数签名、SDK（Software Development Kit，软件开发工具包）、HTTP响应schema（结构）、数据库schema13及封装version1不变，现已声明retry_wait用于正确终态；不增加字段、数据格式或迁移。旧已过期尝试仍沿既有项目打开/新输入恢复，不要求清库。公开读取、现MemoryContextPanel/服务类型已检索，界面正文不直接显示status字段，不能虚称修复了未观察到的前端spinner（等待指示）；本批仍用真实UI读取正式已整理正文。更新当前project-memory架构与证据，不改提示词、工具可见性、模型或用户原文。
- 检查/风险：新增正向服务检查覆盖有效及自然过期失败的完整输入/原文档→retry_wait→下一版本发布、过期结果明确错误契约、接替者继续成功提交、配置代次及多项目。实际多进程检查覆盖接替与失败/退出恢复；真实Sol任务和页面只据实际经过路径报告，不将局部事务/脚本化传输当Provider端到端。在已检索到的control-lease-settlement.test中发现一个not.toBe的旧负向断言，改为显式接替leaseID及当前持有者输出，保留真实接替保护合同；不扩大为无关清理。风险为错误身份释放和弱化提交期限，前述正向提交/Typed Error（明确错误类型）合同必须覆盖。不存在新不可逆副作用或发布授权需求。

## 实施与聚焦验收结果

- `currentOrganizerLease`成为唯一身份匹配；`ownsOrganizerLease`在其上检查期限。begin复用身份，失败release按当前身份写`retry_wait`；语义写入期限保持。没有新增配置、队列、持久格式、接口或版本变更。
- `bun run test test/memory/project-memory-lease-settlement.test.ts test/control-lease-settlement.test.ts`通过正式隔离运行器，最终原39163退出0：4项记忆检查26断言、5项物理租约检查19断言。覆盖原文档及完整Unicode待处理输入、自然过期后的明确错误、重试发布下一版本、接替者提交、新配置代次、多项目隔离。格式化后重跑仍通过。
- `bun run test test/memory/project-memory.test.ts '--test-name-pattern=fences competing Organizer|revokes an active Organizer lease|instance disposal cancels an in-flight Organizer run'`原23329退出0，3项20断言。前两项为真实事务合同，第三项使用局部流替身证明实例销毁的取消/可重试收尾，不冒充Provider验收。此轮聚焦仓库检查合计12项65断言；未运行全量测试或UI自动化。
- 私有真实多进程checker经正式运行器原25571退出0，2项16断言，6个独立Bun进程共享真实SQLite：原进程租约自然到期，接替进程持有新租约时旧失败手回false，新持有者完整提交版本1；另一用例同时运行两个Project且租约同名，A已知失败得到retry_wait，B自有进程主动直接退出后由新进程到期接替，两个Project分别完整提交。全部原子进程退出句柄已加入并为0；这是数据面进程验收，不是Provider端到端。详见[multiprocess-facts](../../artifacts/2026-11-28-memory-lease-settlement/multiprocess-facts.json)。物理控制租约另有12类自然到期/新持有者成功检查，1项48断言，不改变其生产实现。
- 后端typecheck原84927退出0；文档检查354操作/26组、架构索引20文档、控制租约18owner/25获取点均通过。推送前仍执行仓库正常hook（钩子）。

## 真实Sol任务、桌面复核与重启

- run138使用当前源码开发服务的`http://127.0.0.1:59641/ui/`，未单独启动Vite。现凭据与完整目录成对投影，预检分别得到credential usable、catalog projected、actualModel gpt-6.1-sol且streaming true。自然提交两个独立Project只读交接任务，同名`handoff.md`分别为北仓153字节、南仓159字节；没有执行来源项目脚本、写入来源文件或委派。
- 北仓Project `prj_hZ6Mj0J1wZUIfIIkFSeE` / Session `ses_hwDi486mdEq5Y2pVWKiJ`，发表`art_g0VcDaJWl00RuPnZAJ9D`《北仓交接单｜接班复核说明》；南仓Project `prj_he6efZFwavshsL4BEGOG` / Session `ses_hDJ0XbkbIPQvS3StOaC1`，发表`art_g0VcDaJ1x00LEy0VVxOn`《南仓交接复核说明》。各自真实read及publish工具completed、主消息finish stop，发表工具输入与公开存储文档一致。本人已阅读两篇全文：负责人陈晨/李青、各自检查点及输入约定准确，文件所载与实际业务验证边界清楚。
- 两份正式记忆均revision1、idle、pendingCount0，分别保留“按记录行计订单/退款负数/无日期不判断趋势”与“保留样品退款原记录/金额非利润/无成本不算毛利”。整理证据是首条用户输入，生成时尚无本轮读取/发表结果，因此英文模型原文保留这些结果未知，不能宣称记忆已记录最终文档。它是人类输入上下文，不是执行账本，未翻译或合成模型消息。
- 本人使用独立自有Chrome标签407，经原生控件/键盘/截图复核中文界面、两份中文文档、同名来源第3行定位、记忆Project搜索与选择、各自版本及正文首尾。北仓来源显示陈晨，南仓显示李青；记忆设置切换Project仍保留原打开对话。11张目标原生JPG（图片格式）已查看并归档，未使用DOM或像素断言。首次绘制/动画中截图和一次误命名私有截图没有作为验收证据；后续明确重截实际目标。南仓首次打开文件的右栏尚窄，属于动画中捕获，来源正文身份由实际页面和同轮原件共同复核，不将该帧当排版基线。
- run138正常退出后，以同端口启动run139，再分别读取公开消息、工具、发表物、记忆正文；六类数据两Project均与重启前逐字节一致。本人在真实重开页面复核南仓文档和两Project记忆首尾、版本及原日期。语言/系统主题保持原设定，本批无UI生产改动；没有增加其他端或主题验收承诺。
- 私有首次业务观察脚本将Windows文本模式创建的CRLF（回车加换行）误按LF（换行）比较，检查失败；已按创建前确定的输入字符串及Windows写入合同纠正，重跑原观察器通过。未改来源文件、生产代码或读取当前文件自算期望。无效旧脚本预期不会被算作产品故障。
- run138十条、run139两条，共12条精确Sol实际流均HTTP200并自然EOF，reader settled。正常停止后原5844与75717明确退出0，全部Provider读取收敛；两份配对凭据/目录副本已退役、端口59641已停止。本批407页面已由绑定API关闭。上批失去绑定的旧392页面仍未安全关闭，限制如实保留；未操作用户窗口。见[重启/退役事实](../../artifacts/2026-11-28-memory-lease-settlement/restart-cleanup-facts.json)。
- run138/run139分别核对原23文件字节、2725旧项目行、SQLite完整性、示例Git身份、两完成Task及23引用行，均保持；旧CSV（Comma-Separated Values，逗号分隔值）59字节经实际artifact-read响应200、与原件一致，华东3/28.25、华南2/7.35。原177条工作区状态的非本批差异保留。

## 交付范围与限制

范围为一个Project记忆失败释放机制、其正向服务测试、触及的一个旧负向断言修正、当前架构及本记录/证据/三处索引。失败到期缺陷由现生产事务和独立进程明确证明；真实Provider任务证明正常处理、多Project隔离、持久化和页面可用，没有故意制造Provider连接失败，也没有将其声称为真实Provider失败路径验收。上批ECONNRESET的传输原因与失败当刻旧封装未知，本批没有宣称修复该网络故障。没有新增UI自动测试、清库、迁移、版本、标签或发布。

提交前获取并普通合并上游、审查完整待推集合，正常推送及原句柄退出结果见交付回复；如果有上游新变更，须按合并后的实际范围继续验证，不能把本条描述当已推送事实。
