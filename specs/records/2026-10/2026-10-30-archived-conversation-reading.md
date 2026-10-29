# 归档会话的阅读与明确恢复

## Recall

用户要求持续单agent自主体验UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能、修复真实问题、实页截图复核后范围提交推送；后续禁止子agent覆盖旧Goal三个Astra文字，不委托。803是实质progress：8bea17e72修复Goal保存错误来源混淆，d64553837修复SDK（Software Development Kit，软件开发工具包）共享编译目录锁外竞争，均已正常push。22:31:48.714Z fresh fetch/merge HEAD=origin/main=d64553837934574c6da7135eee2d46283ff68bb1、0/0；正常hooks（钩子）全部通过。bcc14ace8与c357af62e是另一个已授权任务已验证的运行时/描述同步，保留其实现，不重复修改。长期Goal active，不将一批完成当整体完成；Dependabot单次重扫授权已消耗，不再重复。

803十张实页证据里，正确原生Chat ses_-zUQWKSgYzzXgm2YLTag归档后直接URL和同URLreload出现缺标题/归档说明的空视图；它原本是空会话，不能推断丢失了消息。普通POST/session产生的另一个Session不是原生Chat，GET coding/chat/session的404已明确排除，不能拿它冒充归档准入。当前源为已完全退休803-after，schema（数据库结构版本）9/92表/204260行；原203938条全部精确且完整SQLite EXCEPT核对，75已发布附件和三个QA项目16个tracked文件保留。Provider（模型服务方）0/累计1083，授权auth/完整models复制对均已退休，native全部终态，不复活旧scope。

当前起点git status保留177项外部工作（旧媒体删除、三个spec索引及L05规格修改、.bun/和packages/opencorvus/bun/），产品源码无其他未提交修改。已重读803 Recall/结果、07-panel归档合同、conversation-session claim/hydrate/archive、WorkLedger完整分页reload/runtimeRows、main标题/Goal归属、Chat/Work原生身份、Task/Mission选择入口、公开WorkLedger路由/projection、transport-protocol当前row类型和现有相关后端测试文件名。未读或未证处继续标明未知，不以标题/模型自述定根因。

## 当前分析、影响面与未决证据

直接触发是归档会话通过真实claim读取后继续选中。selectConversationSession取得包含time.archived的Session并写入已有会话列表缓存，再加载真实conversation/SSE（Server-Sent Events，服务端事件流）；没有归档阅读呈现。main的标题、header actions和ContinuousGoalControl的owner却来自workLedgerActiveItem；其runtimeRows只由WorkLedger加载的全部未归档列表替换。已检查reload读取所有分页且没有search过滤，所以不是当前分页/搜索漏行，而是归档成员范围与当前阅读身份被混用。普通会话缓存又会被列表替换，不能用缓存fallback（后备路径）补标题形成双源。Task/Mission同样依赖该activeItem，具体归档链接表现尚待实证，不先泛化消息损坏。

目标体验是保留准确标题和历史、明确归档状态、把执行输入和目标修改置为只读，并提供调用原恢复入口的明确动作；恢复沿现有停止/暂停事实，不自动发消息、续Goal或重开Task/Mission occurrence（执行轮次）。当前WorkLedger row已有archived字段，投影工厂已生成真实归档属性；需进一步审查如何对一个精确选中Task/Session独立读取同一投影，不能让侧栏集合决定当前对象是否存在，也不新增持久化状态。现Goal GET对归档owner也拒绝；若归档阅读需要展示已有目标，须明确改为同一resolver的includeArchived只读契约，写入/执行仍走原owner校验，配聚焦正向后端测试。HTTP（Hypertext Transfer Protocol，超文本传输协议）/SDK描述与生成保持同步，不变数据库schema。

已全仓搜索setWorkLedgerRuntimeRows、workLedgerActiveItem/SessionExecution/TaskExecution全部调用、selectConversationSession/Task/Mission入口、归档写者、当前row schema与projection定义。尚未实施；选中投影读取、恢复后资源刷新、只读composer和Goal展示的具体代码方案须在实页及剩余定义审查后补齐本文件。当前没有业务队列/唤醒/调度/恢复异常；如果发现，立即按全部生产入口、Task/Mission/Session轮次、正常终态、重试重启、串并行和多Project隔离进行共享审计，不降为单一UI场景。

## 实施前实证与交付计划

### 804实页结论与实施决定（修改源码前）

before38375真实打开ses_-zUQZxfS4zzCqp9pVfVD，3条原消息、70字节原附件与Sources可读，截图01；经真实Archive conversation后重开原URL，消息完整而标题退为Chat、状态/菜单丢失（02），真实输入草稿使Send启用（03，未发送，随后清空）。原生claim200返回time.archived=1793313817211；archive列表200包含准确标题/归档字段，active列表为空；原message端点200仍3条；Goal GET409 owner_unavailable。根因是选中阅读身份误用active集合，不是消息丢失。before已公开shutdown200、原exec/native/launcher0、物理与输出结清、复制凭据对退休，实际模型请求0。after从这个已结清且真实归档的804-before连续复制，保留同一ID和归档事实，不从未归档803源重置；沿原60分钟截止，不延长。

实现精确GET /work-ledger/selection/:kind/:id（kind task/session，directory必需），直接读取真实Task/Session并复用现有WorkLedger工厂与WorkLedgerArchiveRow契约；验证当前Project、既有Project.samePath、删除与原生Chat/Work/Mission身份。集合仍只服务侧栏，当前阅读由Solid owner内单一可取消资源提供，绑定authority revision、selection epoch、完整source和directory，重用现有集合刷新通知，不建立备用缓存/双源。标题、状态、Goal owner与当前composer类型统一用选中投影；读取错误有真实Retry，不能吞为泛标题继续执行。归档Feedback显示本地化日期、只读解释和Restore按钮；沿原Task/Mission/Conversation archived=false端点，仅刷新原选择，不自动执行或清草稿。composer保持挂载且不可输入，原草稿寿命不被归档呈现销毁。Goal GET通过已有includeArchived只读resolver展示原目标，写入resolver保持现有契约，归档原因区分owner_archived；Goal控制增加只读呈现，详情可读而修改控件不可用。公开路由正向测试覆盖原生Chat/Work、Mission、Task及目录/删除错误，官方生成SDK/OpenAPI。数据库schema和消息格式不变。

首个候选main-vPf32J9i.js实页出现本轮新增的启动空白（04截图）。真实浏览器错误TypeError reading row，定位selectedItem中current?.key === selectionRequest()?.key：无选中项/资源尚未返回时两边undefined相等，却读取current.row。不是原归档问题，也不是渲染闪烁。修正为先要求current存在再比较完整key；横向复核本轮资源key/owner读者，Goal既有投影对value有可选访问，不受同一解引用影响。旧候选不热改冻结UI：正常关闭/退休后以新scope和新普通构建复验，沿原804截止不延长；保留失败截图/控制台及原exec证据，不把类型通过冒充呈现成功。

交付前源审进一步区分恢复提交失败与恢复已提交后的详情读取失败，沿803原则：前者Retry只明确重试恢复，后者由resource读取错误呈现并只重试读，不重放已成功写入。现有SSE通知与显式恢复可能重叠，选中读者共用同一个在途Promise并合并刷新意图，让恢复动作等待真实刷新完成；无新持久队列、调度或执行状态。这里只是UI请求完成归属，业务调度/执行轮次未变。

第二候选main-DrNR2YyU.js成功呈现真实标题、3条历史、Sources和禁用输入；公开选中读取200、原消息/Part全值相同、归档Goal GET200/null（目标原无Goal）。截图05发现本轮日期文案错误使用单花括号而显示{time}，并且ChatComposer旧禁用placeholder覆盖传入文案，错误要求Reconnect。使用现有archive.archived_at双花括号日期key，删除重复新增日期key；禁用placeholder与Send共用unavailableReason，归档原因不再被泛连接提示覆盖。再冻结新普通构建于新scope复验，不热改已启动页面。库中实际归档Session及Task均没有已创建Goal，现有目标归档后的详情视觉分支未实证；不能宣称已覆盖该分支，已有15项独立Goal正向合同测试另列。

1. 先只读确认完整803-after原件，选择原生Chat ses_-zUQZxfS4zzCqp9pVfVD（原真实附件788会话、3 Message、metadata.conversation、未归档、无Goal）。保留原ID/正文/附件/Project，不造SQL消息或Goal。新804完整复制库、durable publications、包revision及六个当前实际附件namespace（75文件），记录所有原行和文件字节、三项目Git状态。
2. 自有开发/ui before38375/after38376，原始固定60分钟总诊断物理寿命，到原截止前5分钟正常shutdown，启动真实receipt/dev.log inactivity180秒。首次启动前已将所需公开投影/SDK/后端检查纳入此单次寿命，不延长任何已启动scope，也不把它当用户目标预算。长期native直接由现有exact-process host监管，不再用stdout静默wrapper误杀服务；短命检查仍用现有inactivity工具。授权OpenAI auth与完整models成对复制供精确gpt-6.1-sol本地投影，Provider固定0，不宣称实际模型可用性或执行通过。不操作18571、用户窗口/进程/真实数据库，不重启旧任务。
3. before真实打开有历史会话、查看原历史，再经现有归档操作和真实URL恢复/reload，截图区分标题/状态/输入/消息实际结果。归档/恢复只修改本scope副本的明确目标；保留原消息与参与者。Task/Mission横向入口优先只读检查；不为了此UI验证运行其业务或自动恢复。
4. 补齐根因和公开契约分析后落盘实施决定。优先复用现有WorkLedger工厂、当前选择/权限/请求寿命、归档/恢复及Feedback/Button/Goal/composer primitives（基础组件）。精确选中元数据与侧栏集合分开用途，但只由同一canonical投影定义，禁止备用列表扫描、跨页猜测、影子owner或Host替模型选工具。新增公开读取若必要须覆盖真实路由、目录/删除身份、active/archived和Task/Mission/Chat/Work正向输出/错误合同，官方生成SDK/OpenAPI并重跑原检查。
5. 不新增、修改或运行任何UI自动化；触及路径遇到现有UI自动化时删除而不运行。UI负责者本人启动正式新冻结页面，实点/截图人工复核中文/英文、原历史、明确恢复、草稿/选择寿命和Goal只读范围。类型/build/console不冒充视觉验收；非UI改动有聚焦正向真实checker。
6. 所有自有页、公开shutdown、原exec/native/launcher和物理/输出/请求结清；源全部204260原行保持，副本对真实归档/恢复的Session/Task字段变动按原writer逐项解释，其他原行以原生SQLite完整值比较。全部原消息/附件/项目Git字节保持，已归档新scope实体按真实事实保留，不清数据。复制对退休、源auth metadata及catalog bytes/metadata核对，秘密不进spec/日志/提交。
7. 更新三索引/相关当前架构、当前package文档检查；本任务所有项目修改范围提交，fresh fetch/merge复核完整待推集合、正常hooks/push和fresh fetch确认。实际冲突才等待；不新增branch/worktree、不绕hook、不发布版本/tag/Release/PR。没有完成的维度明确保留，长期Goal继续active。

## 最终实现与实际验证

最终普通前端构建main-Dqywgej9.js，在新804-after3/38378启动前冻结。精确选中读取复用既有WorkLedger工厂，活动/归档列表不再决定当前标题、状态和Goal owner；Task/Session与Project/directory身份校验共用现有定义，数据库仍schema9。归档提示与输入占位符/Send共用当前语言原因，日期复用现有archive.archived_at。Restore调用原archived=false writer，读取成功后保留当前选择并归还输入焦点；已提交写入的后续读取错误只重试读。Goal GET包含归档owner，原写入准入保持，归档boundary准确为owner_archived，详情/编辑按只读呈现。

[14张截图及核证原件](../../artifacts/2026-10-30-archived-conversation-reading/README.md)已逐张亲自查看。最终英文/中文标题、日期、只读原因准确；实点Sources打开原70字节JSON，check/answer/status原文可读。中文点击恢复后同一Chat可输入且焦点回到原composer；跨真实已完成Task和已关闭Mission后原自有草稿仍在，随后清空。Task完成徽标/时间/交付和Mission问候历史均可读，未重开业务执行。默认页居中布局和持续目标提示保留；实点＋→持续目标显示创建表单，再关闭，未提交。Task链接初次手拼附加directory触发当前WorkspaceLocationError（Task location must contain only its taskID），按真实契约仅taskID后读取成功，不记为本轮回归。

最终聚焦验收：work-ledger-search + continuous-goal-control-identity共7项/69断言通过；continuous-goal-independent另15项/119断言通过（合计22项/188断言）。公开读取覆盖四类活动/归档对象、跨项目/目录、普通Session身份、真实删除404，归档Goal200/paused/owner_archived及原写入409合同。新增删除用例先误将无受保护历史的真实删除预期为tombstoned，实际现有writer返回physically_deleted；核对当前删除合同后改为准确输出，重跑通过，未为错误测试保留实现。SDK官方build、前后端类型、API六规则/36路由文件、352操作/26组双语接口文档校验、两语言2636key和最终普通build均通过。误输入不存在的api:check已改用package.json当前api:routes-check原验收，不把该调用失败当checker通过。未新增或运行UI自动化。

## 数据、进程与交付边界

最后服务2026-10-29T23:29:44.518Z原exec退出0；公开shutdown200，native/launcher均0，物理完成、输出排空、请求清理全部结清，原总截止尚余772894ms。before、after失败候选、after2和after3四阶段均完成各自物理关闭与auth/完整models复制对退休；原auth metadata与模型catalog bytes/metadata一致，Provider均0、累计1083。最终浏览器warn/error原件为空，截图和实际交互才是UI验收依据。第一次最终tab在HTTP就绪前打开而connection refused，等实际ready后以新tab完成验收；失败tab未作为产品测试通过证据。

原生SQLite完整值EXCEPT核对：803源204260行/92表全部不变；804各副本只允许精确目标Session的time_archived/time_updated按真实归档/恢复变化，其余原值精确保留。before/after均204292行，after2为204294，after3为204326；没有新增Task、Session、Message、Part或Provider用量。增加的66行是两次目标session.updated的Bus publications、12次succeeded投递、6个phase receipts、15个activation lease及对应grant与2个event occurrence，逐类保存核证。3个runtime_process lease的MAX_SAFE_INTEGER不是活进程证据：运行时UUID与各自authority-ready.owner完全一致，再将PID和OS birth匹配到已关闭supervisor物理链。collector初次误要求supervisor observedProcessOccurrence生成的独立UUID也相等，核对process-occurrence.ts两种身份定义与原receipt后修正证据关联，不改产品运行时，不据此制造孤儿故障。六namespace共75个原文件在四阶段副本及源字节一致，三个QA项目16个tracked文件、HEAD/ref/index/status一致。

本轮期间HEAD推进到4172af983（另一个已授权benchmark交付，origin/main同期已包含，0/0）；产品源码无冲突。保留171项旧媒体删除、无关spec重排/L05在途记录与untracked目录，只将本轮源码、官方生成物、当前架构和证据及三索引自己的条目纳入提交。提交/推送通过正常hooks并以fresh fetch/merge及完整待推集合复核，具体Git结果由当次提交与交付回复报告；不改版本、不创建tag/Release/PR。

未满足维度：当前复制库没有已有Goal的归档对象，故已有Goal归档后的详情视觉分支未实证；15项Goal后端测试不能替代该视觉分支。Task/Mission归档/恢复的真实UI路径本轮未执行，只覆盖公开投影正向合同及真实未归档终态阅读。Provider实际模型运行未执行（额度0），不宣称本地目录投影证明模型请求可用。长期产品Goal保持active，后续继续补齐这些体验维度。
