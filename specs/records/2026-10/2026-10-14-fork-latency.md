# 长历史分叉耗时调查与修复

## Recall

用户要求持续自主迭代UI/UX和功能，重点包括Sources、成员侧栏Rendering，最新明确只使用单agent；旧goal的Astra文字已被覆盖。本轮不委托。上一轮406是progress：74ff844f6已在远端main，修复主树重建丢失阅读锚点及侧聊空引用解释；47次真实gpt-6.1-sol流式200/EOF、23张人工截图、原Native/Host/端口/配对副本清理完整。当前工作区有其他任务的compaction和Provider错误等未提交改动，保留且不纳入交付；Session.index、storage.db和Bus当前无原始未提交差异。

旧用户数据已经回收，当前版本1数据库迁移基线已交付，本轮不再次删除或初始化用户库。实验复用本轮自有406的版本1真实数据：主Session ses_-zUS2EY0ezzjFidQwBy1，38消息、37份正文、36次read与36组Source行范围；该文件有144行，不等于36篇独立来源。Side 1无完成引用，Side 2—4复制完整38消息。

已读AGENTS、406 Recall/失败/修后/提交归属记录、07-panel侧聊及阅读契约、Session.fork和全部生产调用、persistMessageBundleRows/upsertMessageRow/updatePartRow、Database.immediateTransaction/savepoint、Bus.publishOwnedInTransaction、ProjectMemory.captureMessageInTransaction、现有fork atomic和side-chat后台测试。沿已应用benchmark-debug-template技能，UI只通过CUA真实交互与人工截图；不新增或运行UI自动化。测试/静态计数不能冒充真实性能和视觉资格。

## 现象与当前分析

406诊断04的正式POST /session/<main>/side-chat从20:57:54.208到20:58:03.137，8929ms；健康探测在浏览器20:58:02.122超时，服务20:58:03.233才处理相应health，随后connection-rebind整树恢复。阅读跳顶已有独立修复，耗时未修。直接同步占用候选是完整复制事务或提交后逐事件处理；尚无函数采样，不将最后错误、savepoint数量或代码长度当根因。

fork的唯一当前实现覆盖公开/session/:id/fork、/side-chat及panel fork工具；执行中的Task边界由现有准入拒绝，Side是独立assistant根且只继承完整回复前缀。它预分配Message/Part映射、保留accepted-input/compaction关系，随后在一个immediate事务内写目标Session、完整用户与assistant束、Source/Tool及durable Bus outbox。事务先完成再对外可见；任何优化必须保留原子发布、失败回滚、重试、引用身份、跨Project检查和完整真实事件，禁止分批提交暴露半份历史、删验证、隐藏事件、后备复制路径或调大健康超时。

共享审计须追到实际热点所属层：若在Message写入、事务或Bus队列，覆盖全部调用而非只优化侧聊，包括Task/Mission/Session执行轮次、正常/终态、失败重试与冷重启、串并行和多项目。现有测试含后台原子失败及Project隔离；原fork测试有“失败期间无事件”的附加断言，若修改该路径测试应改为明确错误及回滚/重试后的真实状态契约，不延续负向核心断言。当前未发现本轮目标路径的UI自动化测试。未取得共享层的真实运行证据前，不称问题仅限Side chat。

## 输入输出、环境与采样

首次诊断启动独立fork-latency-407-before occurrence、端口18521，通过已审阅的406 owned Native Host、正式serve及既有私有UI bundle。复用406私有runtime/project，先验证auth/models旧副本已回收且没有占用该端口；按原授权经成熟helper配对复制。请求预算8次，包含真实Sol预检和产品辅助；复制目标为固定原主Session。目标模型投影、凭据可用和实际流模型必须分别通过预检；不制造消息或读缓存伪装完成。

只给目标进程增加运行时自身CPU（Central Processing Unit，中央处理器）采样参数，保留生产命令与协议。当前Bun1.4.0 --help和[官方性能采样文档](https://bun.sh/docs/project/benchmarking#cpu-profiling)确认--cpu-prof/--cpu-prof-name/--cpu-prof-dir；正常退出产生调用栈采样，归档前仅检查函数/路径/计数，绝不采集堆快照或凭据变量。原始请求时序、采样栈与数据库事实共同判断同步热点，不只看总持续时间。

实际Provider请求按180秒无活动判定；Native保留独立600秒物理租约用于拥有服务和凭据回收，不作为性能通过标准，不延长已启动owner。服务必须公开shutdown并验证原Target/Host整体物理、输出和请求结算及端口释放后回收配对副本；join原句柄。失败保留原事实，修本地调查器再跑，不绕过检查。

## 验收与实施顺序

1. 在主区早段打开已有侧聊，再新建一个长引用副本，保存实际完成截图与服务请求持续时间。只读数据库核对完整38消息/36工具来源及绑定，source保持原事实。
2. 正常结算后分析CPU profile与实际HTTP时间窗；必要时对已发现热点补精确被动计时，先落盘根因和全调用影响再修。
3. 修改唯一当前实现，增加聚焦后台正向输出/错误/事件契约；覆盖共享层真实路径。性能标准是同等真实历史的侧聊创建在健康探测5秒预算内完成，且并发只读health能够及时返回；不得以成功UI提示替代实际HTTP与时序证据。更大输入与其他入口依据热点扩大，不把当前36条作为全局规模保证。
4. 重新进入正式/ui人工复核主/侧栏阅读、Source和创建反馈；原子复制、重启读取、多项目及共享调度矩阵仍需各自运行事实。未满足项明确保留。
5. 本轮文件独立提交；提交准备和实际commit紧前都检查HEAD，避免重演406并发索引事故。fresh fetch/merge、审阅完整待推送集合、正常hooks后push。持续goal保持active。

首轮页面创建Side 5已完成，图03保留38条引用和R06阅读点。独立12次health观测在UI触发前已结束，不能声称覆盖复制窗口；追加一次正式POST /side-chat，并在发出后100ms发出一个并发GET /global/health，保存请求时间/持续时间/实际响应。这是后台接口时序取证，不是UI自动化，不合成Message或修改数据库；只新增另一个完整真实引用副本，Provider累计预算8不变。

首轮Native原句柄60910已join exit0，完整CPU profile已在正常退出生成，父脚本核对原Host/Target和端口后退休auth/models。追加复制返回真实Side 6，POST15504ms、并发health15479ms，浏览器21:28:42.640实际TimeoutError。4次Sol流全部200/EOF。采样按这15.508秒实际窗口裁切，共2079条样本，最大采样间隔152ms；大部分栈在Bus.dispatchDurableTargets及Database.immediateTransaction，最高native transaction.run叶约6.879秒，另同类栈1.780秒/1.172秒。不能把整个进程idle间隔或累计父子时间重复计成CPU总量。当前连接显式synchronous=NORMAL，禁止未经证据改持久化策略。

下一次诊断只在自有启动包装器对实际Bun SQLite公开transaction函数加被动计时，分别记录开始到callback、callback正文、callback返回到transaction返回，按调用栈聚合；保留this/参数/返回/抛错及immediate/deferred/exclusive原入口，不记SQL参数、不改变事务或业务控制流。这将判明热点在SQLite提交还是JS正文/查询；结果只在正常进程exit同步写到自有evidence。仍用同一真实主历史，累计预算8的新独立occurrence与600秒物理租约，准备器须先检查唯一路径及配对退休。

## 共享根因与实施合同

timing原案因Proxy读取Bun不可改写的transaction.immediate属性触发TypeError，启动失败；原90508整体退出1并回收配对。工具改成同描述符的可调用包装，实际内存SQLite四模式/this/参数/返回/回滚正向检查通过；timing-02正式启动成功。原句柄66724与取证92316均join exit0、配对清理完整。POST9826ms；100ms后的health为8.72ms，说明它在同步热点前返回，不能用它否定上轮15.5秒的真实阻塞。

实际9826ms请求窗口有4676次外层事务：BEGIN合计43ms，正文1557ms，COMMIT6114ms。复制本身唯一事务291ms（正文289ms/提交2ms）；Bus约264个publication在exact/wildcard/global阶段逐目标执行请求注册、lease取得、成功/失败receipt与phase结算，重复提交占主导。同步启动全部post-commit effects及后续Promise微任务让这些独立提交持续占用事件循环。这是共享持久事件投递写入粒度问题，不能仅给Side加异步旁路、跳过瞬时订阅者或改变SQLite同步级别。

全仓调用审计以Bus唯一入口为边界：Session消息/Source及状态、Task writer/retention/终态、Mission/execution-closure/caller-receipt、Permission决定、Scheduler wildcard接收、Project/Workspace生命周期、global观察共同进入现有durable outbox。publishOwned/Exact、事务owned/Project-owned提交、bootstrap.resumeDurablePublications和当前retryDurableOccurrence最终共用executeDurableOccurrence→executeDurableRow→dispatchDurableTargets。exact/wildcard之后仍是global；subscriber独立lease/幂等合同/失败receipt、缺失durable订阅者的retry与唯一publication owner都保留。RuntimeExecutionSettlement在任何await之前reserve且settleWith覆盖整条operation，runAsInstanceActivity/independent Project owner持有原Project至完成；关闭与重启沿这些已有owner收敛。volatile publish仍是原非持久事件路径，不改它。

实施只合并Bus投递的数据库写入提交，不合并/删减事件或外部效果。新增一个Bus内部commitDeliveryTransaction原语，暂存已被现有publication owner持有的同步写回调；每个定时器轮次最多64条，以一份immediate事务提交。每条经既有Database.savepoint隔离自己的明确输入/租约错误，fatal数据库不可用使整批回滚并通过当前normalizeError；返回/拒绝Promise只发生在真实commit或rollback之后。该队列不是业务状态源，只有原outbox、delivery/phase/attempt receipt和control lease决定事实，进程退出丢失暂存后仍由原outbox恢复；没有第二delivery owner。回调只执行原SQL和完整性检查，订阅者callback始终在数据库事务之外。

请求注册、lease取得、success/failure receipt加release、phase receipt四处统一用该原语。lease时间在实际写入回调中计算，以免排队消耗租约；每个subscriber仍在其receipt提交后退休续租timer并进入下一目标。每个有界批次让出一次事件循环，避免巨型微任务连续占用；64是这一内部写入原语的唯一工作批量边界，不添加用户配置/并行策略。独立Project的回调携带明确payload/target，不依赖flush发起者的Instance来确定数据归属。禁止在源事务内排队，否则失败源事务可能留下独立写入，必须给明确错误。

公开接口/Schema/版本/Source及消息合同均不变，无新数据库迁移。本次新正向后台验收覆盖实际SQLite批量写入/独立失败回滚/提交后可观察返回、真实Bus全部receipt身份和lease终止、多Project、派生publication、shutdown/resume和物理跨进程竞争重放。读取到的旧Bus测试中“disposed=false”“outbox=[]”等核心负向断言改为实际callback/settlement顺序和明确receipt结果，不为旧断言保留同步旧路径。通过局部后必须重跑正式API同输入时序及真实页；变慢或丢事件即继续调查，不能以批量次数减少替代资格。

实现后首轮三文件组共33项/136断言通过：新提交原语与Bus回执13项，原子fork/SQLite事务及物理4进程100条发布重放10项，Task occurrence/终态与Mission跨进程流式关闭接管10项。正式Backend typecheck通过。以上是后台/物理路径资格，不代替真实UI和OpenAI模型验收。after服务继续被动事务计时；正式API观测从POST发出开始逐次health读取，并在响应后继续直到目标Session所有规范outbox都有exact/wildcard/global三份phase receipt，避免只测HTTP响应而漏掉后续投递卡顿。

64条批次首个真实后态未通过完整性能目标：正式POST7490ms、全部263个publication/789份phase在7604ms内结算；32个贯穿请求/投递的health均响应、最大374ms，修复了长时间连续占用，但实际页面再创建9251ms，主区R06和38消息引用保持正常。4条模型流全部EOF，76222已join exit0并回收配对。新计时表明外层事务降到351次，其中82个批次正文1450ms、COMMIT4128ms，源复制仍仅253ms；不是savepoint正文成为热点，物理提交仍占主导。单批正文观察最大约30ms，慢提交可达360ms。

下一版将唯一内部批量边界调整到256：以当前每64条约20—30ms正文的真实测量估算，单批正文仍约80—120ms，继续每批让出事件循环；减少重复物理提交与重复页写入，不修改健康超时、SQLite同步/自动checkpoint或任何事实。采用[SQLite关于事务批量提交的说明](https://www.sqlite.org/faq.html#q19)作为工具机制参考，是否达到本产品目标仍由正式请求和全部回执实测决定。新helper正向用600份真实独立行跨批验证，事件、失败隔离、跨Project/进程和原子源合同保持。若仍不达标继续调查，不放宽5秒指标。

256版实际POST7660ms、263个publication/789份phase在7745ms结算，22次health最大614ms，仍未通过5秒目标。人工截图07—09显示Side 10→11、38条引用和主区R06—R08阅读位置正确，当前英语控件与中文原文各保留事实；没有本轮UI源码改动。原始服务句柄54062已实际join exit0，原Host 88892/Target 64184终态及配对退休记录完整。聚焦14项78断言通过。请求窗口22个批次正文1579ms、COMMIT3868ms；单纯扩大批次未消除剩余提交成本，不继续无依据调大批次。

下一步仅扩展自有诊断包装器，记录实际连接的journal_mode/synchronous/wal_autocheckpoint/cache_size/auto_vacuum及事务提交阶段的process.cpuUsage，区分计算占用与等待；同时记录SQLite WAL（Write-Ahead Log，预写日志）文件大小和修改时间，不执行checkpoint、不读取数据页或SQL参数。Bun 1.4.0实际版本[事务实现](https://github.com/oven-sh/bun/blob/bun-v1.4.0/src/js/bun/sqlite.ts)在callback返回后调用原生COMMIT；现有时间窗口确实包含该步骤，但尚不能归因于磁盘、checkpoint或运行时内存回收。新的只读诊断必须先通过四种真实事务模式的本地正向检查，再启动新的600秒自有occurrence。原业务事件、完整源事务、所有约束和SQLite持久性策略保持。

## 本批提交边界与后续

额外commit诊断已完成：正式POST9095ms、全部263/789规范回执9187ms，26次health最长804ms。实际连接为WAL、synchronous=1（NORMAL）、wal_autocheckpoint=1000、cache_size=-64000、auto_vacuum=2。请求窗口提交4558ms中user CPU 236ms、system CPU 3875ms；没有证据支持改写JS文案或减少原子检查能消除该成本。[SQLite的WAL说明](https://www.sqlite.org/wal.html)指出超过1000页的COMMIT在当前线程触发checkpoint；实际WAL文件尺寸变化与慢提交相符，但尚未读取真实backfill计数，因此暂列强候选而非已经证明的唯一根因。后续需观察公开格式的WAL-index字段并核对实际回写页数，再分析写入放大与生命周期安全的优化。禁止只为通过当前复制将自动checkpoint关闭或将成本推迟到未观测路径。

本批保留每批256的唯一实现，交付范围是将持久事件投递写入合并、有界让出事件循环并保持完整原始事实。所有实际目标回执及38消息/36工具引用检查通过，18条Sol流式请求均200/EOF，六个诊断occurrence（含一个工具启动失败）均物理终态并回收配对；最后服务70463已join exit0。9张真实截图已人工检查。后台共33个不同用例覆盖Bus、SQLite源原子性、Task终态/occurrence、Mission跨进程及共享恢复；当前256批次再次通过14项78断言。具体原记录与局限见[证据索引](../../artifacts/2026-10-14-fork-latency/README.md)。

这是一批已验证的响应改善，**原先5秒复制总耗时目标未达成**；整体goal保持active，继续下一轮日志回写调查。成员Rendering及其他UI范围不能据此宣称完成。独立提交/上游合并与正常push后继续，不将未满足要求写成完成。

## 提交后追加：回写的被动实证

`b3fb10aad`独立提交已建立，fresh fetch/merge后待推送只有该提交。正常pre-push完成整仓typecheck及迁移一致性检查，随后因共享工作区另一组Question connected.pendingQuestions新增与生成SDK尚未同步而退出1；本批未修改这些接口/生成文件，不覆盖仍在实施的源和独占SDK生成事务。保留原失败日志，修复正常生成差异后必须重新fetch/merge、检查完整待推送集合并重跑原hook，不跳过检查。

等待共享生成事务收敛期间继续本批已有回写调查：依据[SQLite WAL-index公开字段](https://www.sqlite.org/walformat.html#the_wal_index_header)，只读目标`-shm`前100字节中的两份48字节头、mxFrame（偏移16）、nPage（20）、nBackfill（96）及真实WAL salt。读头不取文件锁、不修改参数、不执行checkpoint；头副本不一致时仅作为撕裂观察而不能判定回写事实。格式表中的nBackfill偏移96与后文文字128存在表述不一致，因此以表及实际SQLite输出验证：全新自有机制探针默认1000页，先观察27帧/0回写，再真实写入后1380帧/1380回写，完整1220行读取通过。它只验证采样器，不能替代产品验收。

新独立`fork-latency-407-wal` occurrence仍使用原38消息和8请求/600秒租约。在原被动计时中增加提交前后WAL-index计数，公共API采样覆盖全部回执，结束复制原服务的相关请求日志再启动其他服务，防止dev.log覆盖证据。新的事实将决定下轮改动，不先更改生产SQLite生命周期或checkpoint策略。

追加正式运行完成：POST9678ms、全部263/789回执9775ms，25次health最大908ms；10次慢COMMIT合计4700.682ms。每一次均观察到相同salt、两份头一致、nBackfill从0增至mxFrame，回写1079—1763页，准确发生在跨越默认1000页的提交；其余281次外层事务提交均不超过50ms。这将同步自动checkpoint确认为剩余复制路径的直接耗时，而不只是文件尺寸相关性。源复制及事件正文仍需单独计入总耗时，不能把4.7秒简单当作移走checkpoint后的保证值。

本轮额外3条Sol流全部200/EOF，总数21；原Target61484、原Host、输出/请求与配对清理完整，72943和API取证9985已join exit0。新增Side13完整38消息/36工具来源及所有旧副本通过只读核验；没有UI源码/新人工页面。原日志已及时保存。下一批须先横审Database初始化、所有写入、close/reset/resetForTests、checkpointTruncate/vacuum、进程重启及多Project/多进程的生命周期，形成一份唯一回写策略，再实施与验收；本轮仍未关闭自动checkpoint、降低同步级别或引入后台进程。
