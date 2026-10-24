# 持久投递效果与成功回执的横向审计

## Recall

- 用户要求：继续审计其他持久投递链路的“效果已发生但缺成功回执”，覆盖删除重建、重启、并发和升级；设计真实故障注入，分析根因后修复，独立子agent裁定，直到有界审计中找不到新的明确问题。不能以停在报错、仅改调用工作流或模型自述收敛。
- 前序已交付：c2fd5291f/0617ce48d新增v6保留数据的Permission记忆恢复，独立裁定和正常push完成。已交付schema/data迁移1–6不可修改。本轮不能把前序83项/真实模型验收当作其他链路已通过。
- 初始工作区：171项无关删除、577的三个spec索引条目、.bun及package下bun目录未跟踪，全部保留；当前main，不创建branch/worktree。本任务提交仅包含自己的文件/hunk，正常fetch/merge、hook与push。
- 适用benchmark-debug-template：先验证checker确实命中生产边界，保留红例和原件，再根修并重跑。当前是后端持久化审计，不运行UI自动化，不操作现用服务/窗口。使用自有isolated test runtime，无模型/凭据用途；若新证据实质需要此类授权再明确精确范围。
- 已读AGENTS.md、前序存量恢复Recall/结论、02-data及03-control相关投递/调度契约、Bus exact/wildcard/global与delivery transaction、EventService、Project generation、Interaction、Protocol scheduler-message及Task物化调用点、Skill replacement/DurablePublicationStore、当前测试运行器与真实进程故障fixture。全仓搜索durableID、subscribeInTransaction、普通Bus/GlobalBus监听、receipt/outbox、scheduler settlement和文件publication入口。
- 独立裁定者/root/independent_judge只读，禁止再委托、写数据/代码/索引、使用凭据或操作服务。它独立定位与主agent一致的Event修订重投窗口，并指出普通exact发布与transaction exact的owner校验不一致；这些目前仍是待真实红例的候选。
- 实施阶段在各分区真实红例与落盘方案之后，已授权Channel与publication agent修改其明确分区实现及聚焦后端测试；仍不准再次委托、改索引/迁移或提交。Channel闭合后追加只读Expert全局receipt生命周期实际probe，主agent负责其若证红后的公共修复。最终裁定者始终不改实现。
- 延续用户此前明确的多个专家团授权，另将Channel与文件publication分别交给/root/channel_audit、/root/publication_audit；一层且禁止再委托，只读tracked代码并可运行自有隔离backend探针，不改代码/索引/服务或用凭据。主agent负责Bus/Event/Automation、统一方案与实现，独立judge继续裁定全部证据。反馈必须写入本记录，不以委托者自述当作通过。

## 初始深度分析

可观察风险来自效果与回执分开的持久边界：普通Bus durable subscriber先await effect，再把success与lease release写入receipt事务。声明idempotent_by_occurrence只是一项消费者合同，不能以声明本身证明正确。已有Permission同步效果采用subscribeInTransaction；Question结果与记忆采集绑定不可变interaction outcome。异步调度必须以原始效果事实恢复，不能仅将其改成同步调用。

全仓生产durable订阅共11项：Permission3、Question5、Memory Organizer1、EventService wildcard1、MessageMoved桥1。当前无生产durable global注册，但global分发共享Bus lease/receipt机制。普通监听仍需按实际效果分类，不能因未声明durable就排除：Session mirror/bridge、插件回调、formatter、配置失效、Mission caller通知及控制/实时订阅分别核其原始持久事实和可重放语义。

候选A：EventService每次accept同occurrence都重新分页读取当前定义；createFires只按物理revision与occurrence去重。Fire提交后Bus success前故障，若新增或修订匹配定义，原事件可能产生第二个Fire。首次无匹配没有EventOccurrence，空匹配接收边界也未持久化。旧测试仅证明同revision重投，未证明接收集合冻结。应核EventOccurrence能否作为唯一已接收效果事实，保留原Fire/revision/queue/Session，不添加平行processed状态；避免为每个瞬时流式事件制造持久写。

候选B：Bus outbox只有project_id/directory，没有原Project generation；executeDurableOccurrence按目录重开Instance，未核原Project identity。普通publishOwnedExact既有ID分支仅核type/properties，而transaction exact另核Project/directory。真实Project删除后同目录重建（包括同ID新generation）可能把缺receipt旧事件交给新Project消费者。须横向覆盖所有发布、exact重用、retry、resume、bootstrap、显式domain Project发布及身份收敛/删除入口。新来源应由唯一outbox冻结完整owner；旧数据没有generation时不得按同ID或时间猜补。升级保留原数据且提供明确保全/退休/未定归属合同，不能伪造旧success或阻止整个库升级。

候选C：Bus先查terminal，再另事务取得lease，可能在等待提交期间被另一进程完成；需核取得lease时重验terminal和effect后的fence，分别验证同步效果与异步自有幂等效果。Protocol、Event/Automation、Task/Mission的类似claim/terminal与重开必须使用各自原occurrence，不能因最后状态成功就忽略重复真实效果。

影响面：定义/调用/公共合同涉及Bus、EventService及其事实表、Project生命周期与identity convergence、Protocol与调度、独立恢复入口、数据库迁移/完整性检查、后端诊断读取与相关测试/当前架构。实际schema、迁移和公共API方案须在真实红例及独立意见后补全再实施。不可变文件身份摘要可用于其真实协议；不得用可变源码摘要冒充功能验收。不涉及UI、模型工具选择或外部发布。

## 实施与故障矩阵

1. 先建立生产入口/效果/receipt/永久重放依据清单；标记已证、未知及排除证据。审计共享机制时覆盖Task/Mission/Session正常与终态、串并行、多Project和重启，不按单用例局部归因。
2. Event真实Bus发布：在原Fire已提交、原success前用现有FireAccepted切点抛错；修订同definition、增加匹配definition、删除重建definition，再retry原publication。另核空匹配及新独立publication。明确输出原EventOccurrence、原revision/Fire、实际wake、receipt和后续新输入。
3. Bus真实owner：同exact ID跨两个Project与不同目录、原Project删除后重建同ID新generation、旧pending/retry/restart，记录原source与实际consumer owner。只修改自有原件/运行目录。
4. 并发：真实两个/多个进程共享隔离SQLite，效果提交与receipt切点、原lease竞争、terminal提交后另一claim、失效owner晚回执。锁竞争按既有SQLite busy合同记录并在释放后以新进程重开，不把busy伪称效果成功。
5. 升级：若需要v7，在旧源码自有runtime生成真实歧义原件，再由当前正式Database.Client升级；原1–6不改。逐原表/原行/rowid核保留、原备份、故障回滚、重复开库、并发与新输入继续工作。无法确定旧owner/effect时保留未知事实并提供可用的明确读取/结算，而非仅报错挡升级。
6. 其他链路：Protocol Task/Mission物化与receipt同事务故障、Event/Automation wake已提交后终态receipt前中断、Question/Permission投影及原owner删除、MessageMoved原来源退休、Memory Organizer重开、Skill/MCP/Expert Squad文件publication已重命名或已配置后receipt前真实进程退出。以原事实决定每一链的实际验收深度，不把mock端口当真实外部副作用。
7. 采用当前runner运行聚焦正向后端合同；纯fixture或模拟只能证明局部。真实进程probe进入正式生产opener/恢复器；测试模型端口不等于模型语义验收。长用例采用有界无活动检查与定时查看结果。
8. 每个红例先记录现象、触发、控制/数据流根因、旧路径漏治原因、定义/调用/数据/文档/风险，再补本方案并根修。独立agent直接核原件/代码/日志反证；新明确问题回到同循环，所有已知问题闭合后才能裁定完成。

## 验收与交付边界

真实效果计数、冻结来源/owner与回执事实一致；原持久数据和备份保留，恢复不跨新occurrence或Project generation执行。所有发现的合法历史窗口可升级和继续运行；损坏输入才映射明确完整性错误。最终记录每个生产入口和矩阵结果、剩余未知、独立裁定及实际提交/push事实；不声称穷尽无限状态空间。

## 最终横向闭合范围

本轮继续追出的共享根因还包括两类生命周期错配。Worktree 的原逻辑路径可以在排队、intent 持久化后或首次 Git 创建之前改指另一物理目录；修复将同一 operation 的物理目标贯穿 Git、cleanup、startup、ownership 和公开结果，逻辑路径仅保留请求身份。Expert Squad 全局安装效果长于原 Task/Project，原 Artifact 不能拥有唯一成功事实；新增安装级不可变 receipt，与原报告在唯一 writer 的同一事务提交。缺过去回执的冷 journal 保全 before/current/staging 与完整原文，允许后续明确操作，不猜测过去成功或自动回滚。详见两个分区方案及真实红例。

独立复核追加公共 writer 的条件更新问题：先 SELECT 选中不等于随后 UPDATE 成功；catalog revision 分配可改变合法 WHERE 的事实，实际更新零行时不得登记 receipt 或发布更新事件。三个 patch 入口保留原 WHERE，在实际 UPDATE RETURNING 得到行后才登记 authority 和 Protocol，仍在同一 SAVEPOINT。两个 where writer 当前无生产外部 caller，此项是新公共合同的真实数据库边界验收，不冒称已有业务运行事故；现用 browser-preview 持久报告更新同时回归。

当前目标数据库版本为8；已取证的7原件保持原版本，1–7迁移不改写。原6 Channel 四案及 Automation 四案均重新通过最终6→8正式 opener，旧 Worktree/Skill 原6与旧 reset 原7也通过最终8，Expert 三份原7通过7→8。迁移前后比较原列、原行、rowid及完整原备份，未知归属保留 NULL，不能用当前 registry 或 Session 猜补。每个分区的原7中间验收仍保留为历史证据，不改称最终8。

最终文件发布矩阵为 Worktree 21项/56断言、Workspace 4项/11断言；独立裁定者已直接核对原目录、启动次数、升级 stage 和备份。当前8数据库与迁移聚焦四文件52项/164断言通过。Event 真实重启及目录、Bus 竞争与规范回复边界另见原实际日志；局部 Provider 使用真实流式协议，但结果只证明运行时，不代表真实模型推理能力。专家团 writer、完整授权 Evolution、Manager compare-and-swap 与现用报告 writer 的最终回归结果及全仓检查在独立裁定记录中汇总。

## 最终检查器停顿与证据保全方案（实施前）

当前8的九文件终验中，前八文件完成，第九 Channel 第三条真实 Question 恢复在 `await expect(pendingPromise).rejects.toThrow(...)` 停顿。原 worker 单核持续占用，Question Asked/Replied 已持久、Interaction request 已存在但 outcome/Asked receipt 尚未完成，lease 未 renewal；成熟360秒无活动 watchdog 在371.47秒结束。独立只读查询输出留在协作记录，但原 runtime 被现有 runner 清理，**没有保留该次整库快照**，不能将查询输出称为已归档 SQLite。该失败不被之前绿色覆盖。

原完整同序、仅增加现有 inspector/profiler 的复跑再次到达同一 Question 行。两秒真实 ScriptProfiler 记录明确包含原生 `toThrow` 及该测试调用点；该轮60秒 timer超时后出现“active instance callback 内 disposeAll”及后续 suppressed cleanup 错误。单独完整 Channel 文件可通过，不能以此判偶发或否定同序失败。直接缺陷是异步错误断言让运行器原生 matcher 接管未完成 promise，阻止真实异步投影正常推进；生产 receipt 路径尚无独立错误证据。完整 profile 和失败日志保留，后续以真实 hook/错误输出与同序重跑复核该定性。

修复限定检查器：受影响断言先按普通 JavaScript await 等待真实结果/异常，再同步核明确 Error 类型与 message；或使用成熟的 `node:assert/strict` 异步错误合同。不得先让原生 matcher 等待未完成 Promise，不改生产调度/lease、不提高超时、不跳例。横向搜索本任务触及的相关测试中相同 `.rejects.toThrow` 用法，沿用同一错误合同修复，补实际失败后成功及真实效果事实；不扩大到无关界面测试。

另一个明确工具缺陷是 `script/run-tests.ts` 的 finally 仅按 physical/output settlement 决定删除 runtime，故已结算但验收失败会丢失全部原件。方案是完整验证成功才清理；任意 test failure、watchdog failure 或 runner exception 都保留原 runtime，物理未结算原保留合同不变。复用既有 runtime/managed-directory primitive，增加真实 CLI 聚焦验收：刻意失败的 checker 返回实际 exit1且其原始数据/证据字节可读。不得另建日志/数据库事实源或以工具失败替代产品验收。完成后重新跑原完整九文件，由独立裁定者核实热栈归因、异常合同、原效果及新 runner 保全。

全仓同语义调用点复核另证 `script/run-with-inactivity.ts` 有相同 cleanup 条件，连同修复；不修改公共删除 primitive。两 runner 分别持有本地完整成功事实，只有全部实际 exit0且正常走完才删除 ownerRoot，失败输出真实 ownerRoot便于定位同级 test-*数据。复用现有 failure/selected-file、command-inactivity-settlement和runtime fixture追加冷只读原行/二进制字节断言；实际短 watchdog 或实际 stdout observer故障进入原失败合同，不以 mock替代进程。Publication agent获授权只改这两个脚本、直接相关后端测试/fixture及自身记录，禁止再委托、公共primitive改动和提交；root统一审阅/验收。

横向重跑触及的 algorithm-batch-one 全文件又暴露旧 checker 的 Windows 目录期望：正式 reset 的实际物理返回路径与 create 返回路径大小写不同，原 `path.resolve` 字符串比较失败。生产操作和 owner/removal 结果均已返回，不能为此改生产目标或简单折叠字串掩盖 alias。最小调整在正式 remove 前分别读取两真实目录的 bigint dev/ino/birthtimeNs，并比较精确物理身份；其余原拒绝、结算与删除输出保持。fresh同用例须证明实际身份一致，原失败日志保留，不把这个旧字串假设当新目录切换事故。

## Task-scoped 物理路径的后续真实回归（实施前）

上述全文件还出现了不能归于 checker 的生产错误：`Ownership.Worktree.releaseSessionOwner` 返回 `INVALID_AUTHORITY / path/content identity mismatch`，随后 Session 清理持续超时。实际 Task/Session 目录名全小写，marker 内的真实业务 ID 保留 mixed case；独立裁定者因此撤回此前 Worktree 分区通过，整体继续未通过。原21用例只覆盖了普通命名目录，没有证明带业务 ID 的父目录首次创建正确。

直接触发在本轮防 alias 换目标修复：`Worktree.create` 把 `resourceOwner.directoryKey` 当 `physicalInfo.directory` 传给首次 Git。`ProjectDirectoryAdmission.key` 在 Windows 将整条比较/锁 key 小写，而 Task-scoped 路径来自 `ProjectRuntimePaths.worktreeDir(primary, TaskID, SessionID)`，尚不存在的 suffix 含有区分大小写的真实业务身份。Git/mkdir 先创建小写父目录，后续 marker 仍记录原 ID；正确的严格 parser 读取实际 Dirent 后拒绝。已有目录的路径大小写等价不表示可以改变尚未存在目录的身份。禁止改 parser 忽略 ID 大小写或重写业务 ID。

已在原 worker 活着时用只读事务 serialize 保全完整 DB8，并保留原 process tree 与两份 marker 原字节：`publication/runner-evidence/scoped-path-original-manifest.json` 指向本次原件，不借用前轮 profile 旧库。另以新 Task-scoped 正式创建复核精确控制流。

根修方案：提取现有 ancestor+realpath 为单一 resolver，一次返回保真实大小写及原 missing suffix 的物理执行路径和现有 normalized comparison key。`key/keySync` 公共合同保持；withOwner 一次冻结路径与 key，Git、readiness intent、startup、owner record、reset cwd 和 publicInfo用物理路径，锁、比较与目录 admission用 key，不再次沿可变 raw alias 解析效果目标。当前 schema/迁移7/8不变，不改旧合法 marker、Task/Session ID或历史 journal；未知原件继续保全。目前证据证明本轮隔离坏版发生此回归，没有证据把它改称已交付旧数据格式缺陷。

实施前全仓复核全部 resolver、key/keySync 及同义比较 key 的生产调用，区分现存路径操作与首次 missing suffix 创建。验收必须真实 Task-scoped create→record/list/renew/release/Session结束，精确 Dirent与原 ID、marker、物理 occurrence、原包数据均一致；再重跑原全 algorithm 文件和 alias/firstGit/late-effect 的21项，以及真实旧6/7→8升级保全。Publication agent只改对应 resolver/Worktree当前唯一实现及直接相关测试，不新增兼容旁路或重复配置，独立 judge 按新原件重新裁定。

Channel agent独立只读横审反馈：Build保原Task/Session ID进入唯一Worktree.create；Task API/ImplicitProject的其他Admission调用只核occurrence。Project/Instance/恢复保原目录，Capsule使用保case真实realpath，GC保持key→displayDirectory，文件copy/move保持原sourceFull/targetFull。Bun install receipt存在folded分组key→fs.rm，但仅清理已登记、终态/死亡owner的现存UUID staging，不创建业务ID suffix，不构成本次新红；未扩大修改。Readiness begin曾把key直接写intent.directory，checkout/start又消费该字段，与create/reset是同一根因链，已同步修正。该反馈是静态数据流审计，不充当运行验收。

修后真实fresh Task-scoped原目录与marker的Task/Session ID逐字一致，完整snapshot与明确release receipt通过；原全algorithm最终37项/98次Bun断言通过（另有成熟Node异步断言），原alias/crash矩阵21项/56断言通过。新scoped测试正常release后要求AbortSignal.aborted属于错误checker假设，修为真实ownerless/complete合同；旧remove expected漏掉正式receipt也按完整公开输出补齐，未删生产receipt或改Session release语义。修后Task-scoped raw与坏版原件分开保留，独立judge已直接核目录、marker字节、DB8及完整37/21日志。

新增真实旧Task-scoped producer由git archive HEAD原schema6代码、同tracked生成物及现有受控依赖运行；先前SDK/依赖缺失只属准备工具错误，原日志保留。实际原6的Task/Session目录和marker合法，当前正式6→8保留90原表4原行及rowid、原整库backup、原marker字节；真实reuse保原业务ID、用户字节及startup效果，旧unknown startup不重播，原owner可按当前合同release。原件/迁移stage/final分别见publication/runner-evidence/legacy-scoped两manifest，最终仍由judge raw核实后收敛。

两个runner的真实保全验收为3文件10项/40断言通过；另5个独立CLI原退出1/7/observer1/watchdog1/selected先失败后成功整体1，其6份原synthetic SQLite、BLOB及binary冷读精确，physical/output均实际结算。独立judge已核原路径、rowid与字节。常规测试只在完整验证预期失败合同后，清理精确自造fixture ownerRoot；原失败运行的一般用户证据不会被清理，独立raw五原件继续保留。这不追回原97852丢失的整库，也不把synthetic fixture说成用户业务库。

有界矩阵覆盖生产入口、Task/Mission/Session 执行轮次、正常与终态、删除重建、同 ID 新 generation、重启、串并行、多项目和保留数据升级。外部安装脚本与网络注册表副作用未运行；任意操作系统物理置换的绝对原子性亦未宣称。未知 startup 不自动重跑；Worktree 当前 Project 元数据历史扫描、Expert 单包归档枚举仍为 O(history)，有界响应不代表常数扫描成本。最终独立裁定及提交完成前，本目标保持 active。

## 已证红例与根修决策（实施前）

- Event真实Bus+FireAccepted切点已复现：原Fire已提交、wildcard失败receipt精确为ACCEPTED_FIRE_BEFORE_BUS_RECEIPT；随后正式create新匹配job、retry原publication得到两个Fire。原测试首版只匹配AggregateError外层错误文本，未到实际断言，已纠正并保留initial-red；event-red-contract.log是真正效果集合红例。普通exact跨两个真实Project也收到resolved publication而非immutable-owner错误。
- 独立judge在Automation真实SessionWake Message提交后退出23，正式Project.delete committed并同ID重建不同generation；等待原120s lease自然到期后恢复同Fire/Run，在新generation重造同Session/Message后退出24。4个真实SQLite快照16表逐行验真、原Run/Fire相等、ProviderRequest始终0，证据位于自有automation目录。不能只在进入目标前读一次owner，最终wake commit fence同样必须核原generation。
- Channel真实settled/gap accepted都使正式Project.delete因immutable trigger与Project cascade冲突回滚。真实Permission与Question效果后硬退出、同authority重开仍unknown。该分区将保留accepted/outcome、移除Project cascade、冻结原generation及真实effect选择，利用原Bus causation和真实完成结果恢复；不会接受caller自述补写结果。旧无原因果者仍保留未知。具体方案由Channel独立记录。
- 文件publication已证Worktree populated后terminal前退出重启导致真实启动脚本1→2且丢tracked编辑，目录移除重建复用旧READY、双进程重复effects以及失败startup仍READY。Skill configured后停止态合法jsonc无关字段编辑使全局revision检查阻塞恢复。分区先落盘独立方案再实现，原件和红日志保留；MCP/Evolution候选仍需反证。

Event根修采用现有EventOccurrence作为唯一受理事实：同一immediate事务先核原outbox输入/owner及既有fact；已受理直接恢复原队列，不再匹配当前定义。新durable publication即使空匹配也登记fact，volatile只有正匹配才登记，避免每个流式token写库。全部匹配Fire仍在同一原事务；后续调度通知在commit之后。这个幂等事实与普通异步Bus receipt各有清晰职责，不新增processed表，不把durable-only事务订阅强加给瞬时事件。

v7将冻结新publication与已reserved调度执行的Project generation，旧不明来源保留并明确未定/退休处置。由于不可变v6语义迁移直接使用原BusPublicationOutboxTable列投影，不能往该导出当前table加列后令v1–5升级执行v6时查询不存在的新列；Bus采用唯一1:1不可变owner绑定事实，仅引用原outbox identity与generation，不复制Project/目录/正文或completion。Event Fire及Automation Run可在其唯一原reservation事实追加generation（v3为原SQL显式投影，v6不查询这些表）。公共定义的stable Project ID未来成员语义与已reserved旧执行分开：本轮冻结原执行，不能借未来目标重解授权旧Run跨代执行。独立judge的resumed.sqlite证明，旧代码连同确定性Session/Message都可在新generation重造，因此所有缺generation的旧来源保留NULL；当前Session/Message不能补证历史归属。正常升级保留原件，未知归属是可读取的历史事实，不阻断开库。

Bus对未完成旧来源由实际host owner verifier登记自己的ignored处置receipt，包含owner_unresolved或owner_retired明确原因；即使旧source尚无delivery注册，也有这次真实校验的证据。旧subscriber success/ignored及已完成phase不改写，不伪造旧callback成功。缺owner绑定行属于完整性错误，NULL才表示历史未知。公共后端读取按Project提供有界分页，完成处置后仍可读取原canonical正文、owner、原delivery/attempt/phase与lease事实。当前Instance不匹配但原Project仍活着，不能标为retired；冷恢复使用注册的原Project目录并在执行与提交分别重验generation。Project合法目录迁移不创建新的publication或抹掉旧来源。

后续横向真实红例：MCP两个独立backend都成功返回却丢失有效definition引用的stage/active，根因是stage与Config写分离的owner生命周期；用现有唯一Config mutation authority覆盖stage、definition持久化和promotion，并在startup settlement同owner内重读definition。Channel长effect超过原租约后终态保存失败，按原lease仍为当前同ID/owner的实际事实在同一writer内取得新租约保存已返回结果；若发生接管仍受fence约束。两项的详细证据与修复由分区spec记录，仍须独立复核。

Automation范围补充：Session与delay和project同样在Run reservation冻结真实Project generation，恢复/首次Message提交/Prompt owner准入/成功结算都检查原owner。global默认creator目前直接ImplicitProject.create，没有原始allocation，不能假设现存GlobalCreationAllocation可补证它。新global执行复用现有GlobalCreationAllocation的分配、物化和删除保留primitive，增加automation_run种类及原Run请求合同，在Run reservation前分配一次真实Project，Run冻结该owner后才创建Session/wake；不会建立另一套目录/owner配置。旧global Run不按当前Session猜补，归属未知按owner_unresolved保全；旧终态保持。此改动须覆盖global真实cut/delete/restart与正常新输入，且不可修改1–6迁移。

独立judge的真实Message/Tool持久读合同反证四项回复边界漂移：普通tool-calls步骤、summary及缺finish的completed assistant被Scheduler当成成功；真正stop回复的acceptedInputMessageIDs批次中非parent输入被当成未答。直接触发为protocol/session-wake-state与delivery两个SQL自行重写parent/completed/error三条件，绕过Session已有completed-reply的最终步骤、typed turn control、summary与受理集合契约。processor确会合法完成普通工具步骤；Session loop正式写acceptedInputMessageIDs，故不是损坏夹具。当前证据仅局部持久reader，完整Mission streaming恢复验收由judge另行构造，不冒称已完成。修复由现有completed-reply模块统一提供SQL投影，全部Scheduler SQL/reader调用该公共predicate；保留现有JS reducer并补真实持久各分支一致性测试，typed turn control从原Tool outcome事实读取，不能用工具名、字串或host流程gate推断回复。需同时覆盖失败回复、Mission closed与批次输入；不改历史Message或伪造assistant。

Worktree reset继创建后也已真实复现：startup后末端退出23，新进程因原reclamation admission连主Project都无法open。它属于共享目录持久owner恢复，不能清fence绕开或重复运行未知startup；分区将按原reset intent及physical identity恢复同occurrence，再由实际结果解除exact fence，覆盖live owner与dead owner。对应分析/实现/实际日志详见publication分区记录。

Channel独立双进程进一步证实stale Instance仍可跨same-ID新generation借registry首写，并可重放新context的accepted。原serving callback未退出，另一进程正式delete/recreate后完成新source，旧context错误接受新来源。根修同时比较实际Instance与registry及原accepted，不只增加终态fence。同一真实probe也证明Project-scoped Event create API会从旧Instance给新代次写definition（无Session输入即可）：唯一公开route强制projectId=Instance.project.id，工具分支另有原Tool授权guard。因此Event create/remove的原writer也核真实当前Project代次，并返回明确409 owner错误；只读管理不改变原件。Automation全局stable-ID未来目标管理有独立语义，不能以旧ambient Instance一刀切拒绝合法跨Project管理；其reservation冻结目标、执行与最终提交继续核原owner。

## 后续真实验收与检查器纠正

- Automation project/session/global 三条新来源分别真实 wake Message 提交后硬退出23。原120秒 lease 自然到期，正式 runDueNow 在同一目标继续原Message；每条仅一个本地 streaming prompt，原Run和user Message逐行不变，succeeded receipt与成熟Server物理结算均成功。对应 alive1 三套 before/resumed/settled 原件。另三条正式删除目标Project→重建→恢复，均原Run target_deleted，不把原确定性Session/Message造到新generation。
- global 的更早切点：目标Project已由正式 GlobalCreationAllocation 物化，beforeRunReservation 切点硬退出23，原allocation.accepted_target_id=NULL、Run=0。两个真实后继等待原lease自然到期，均正式runDueNow恢复同一原allocation；最终一个Run、一个user Message、一个真实streaming prompt、同原Project行/generation，allocation仅受理该Run，双方物理结算exit0。原件 allocation-concurrent2；首版checker错写materialized字段名的exit1留存在 allocation-concurrent1，不当作产品红例。
- Channel完整三文件23项/123断言通过，包括直接Task activity acknowledgement、stale Instance、租约过期与接管。直接activity没有Question Asked，原恢复错误要求该事实；现按原immutable source kind解释真实direct answered outcome，保留原rowid与响应。硬退出与三进程首次恢复另有真实probe。
- 原Channel连续两例CPU饥饿通过自有 Inspector采样：249/249样本顶层native toBeInstanceOf，调用点为Bun异步rejects matcher；原DB事实有界。只把检查器改为实际await/catch后同步断言同一typed error，原两例及完整23例均恢复。没有修改生产调度或跳过原顺序；独立judge核过样本。这项属于本地检查工具根修，不能冒充产品投递缺陷。
- 当前完整workspace typecheck已通过8个实际workspace任务；SDK与API文档重新生成。最终独立裁定、Event目录语义及其实际验收仍待完成，不能在本阶段宣称总目标达成。

### Event执行目录的独立反证与方案（实施前）

独立judge使用真实Project.fromDirectory→addSandbox→child Instance→EventService.create→Bus.publishOwned，在线在实际Session创建后退出24，冷恢复在FireAccepted后退出23再从主Project打开。四份SQLite/JSON十五表一致：原definition/Occurrence/Fire/Project未变、generation未变，targetSessionID仍是原created_session_id，但在线Session.directory=child，冷恢复Session.directory=root，Provider0。原checker一次过早waitForIdle未等实际创建的exit1另保留，不当作产品证据。

数据流根因为Bus回调继承当前Instance，而Event恢复只有Project identity；executeWake新建Session时直接使用ambient Instance.directory。公开CreateEventJobInput、HTTP与tool均只声明Project或已有Session，没有来源工作目录合同。11个durable消费者横审其余8个Interaction与MessageMoved只投影原ID，Organizer真实配置经EffectiveConfig从当前Project根取得，无另一源目录依赖。修复在Event唯一executeWake入口解析其实际目标：已有Session使用其持久directory，新Session使用同generation Project当前worktree；必要时以成熟初始化Project owner切换并再次校验原generation。不能给Fire增加另一个会与当前Project/Session漂移的directory来源，不能改变原Bus source.directory，也不能把合法同generation迁移判成retired。测试覆盖子目录在线、切点冷恢复、既有Session目标；先保留原件再验证当前行为。
