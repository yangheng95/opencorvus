# 旧权限记忆投递的存量审计与保留数据恢复

## Recall

- 用户原始要求：继续处理旧版已尝试投递却缺成功回执的歧义数据；先只读审计真实存量，基于原始证据设计保留数据的恢复方案，完成真实升级验收，由独立子 agent 裁定，不能仅以报错阻止升级收敛。
- 前序交付：747423bd4将Permission原Replied同步SQL效果与原Bus success receipt原子提交，修早答/迟到Asked和Question重复登记；8acd4e98c修复迁移检查器版本漂移。已交付迁移1–5不可改写。前序182项和三个专家团真实模型验收不等于此次存量已经恢复。
- 本轮工作区有并行owner的overlay输入框、i18n、composer工具、07-panel、continuous-goal和三个spec索引改动，以及原171项删除和其他未跟踪文件，均保留；不用branch/worktree隔离，不混入提交。只在自身索引条目追加本记录。
- 授权边界：第一阶段只读用户数据，直接使用SQLite readonly/create=false/query_only事务，不经应用Database.Client、HTTP、恢复器或启动服务，避免隐式迁移/调度。不得读出或使用凭据，不操作现用进程。升级先在自有隔离的原始快照上验收；原库保持。任何对实际现用库的写入须在具体恢复方案和验证结果可审阅后另行明确其操作范围。
- 适用benchmark-debug-template：先建立可重复输入/输出、运行环境、真实无活动边界及明确验收；保留红例、诊断和原始证据。只读审计脚本仅审计，不自带apply。没有UI改动，不运行UI自动化。
- 已读：AGENTS.md、前序专家团记录Recall和末尾、project-memory/02-data、runtime-paths与Database.Path、迁移registry/执行器/v5、Permission/Bus原事实、ProjectMemory采集与消费、Organizer和LLM调用、已有原SQLite/旧源码升级探针。全仓搜索readonly诊断、数据库路径、永久Organizer证据和迁移入口。
- 独立裁定者/root/independent_judge：用户明确要求，一层且禁止再委托；只读代码、spec、原SQLite与日志，可只读Git，不改数据/文件/服务，不使用凭据。先核原始证据，再核方案、实现和真实升级。

## 第一阶段：只读存量审计

- 唯一生产默认根由packages/util/src/runtime-paths.ts派生，Windows为LOCALAPPDATA/opencorvus；Database.Path是其data/opencorvus.db。工作区.opencorvus是项目配置/运行产物，不是另一数据库配置面。
- 首个实际只读结果：C:/Users/hengu/AppData/Local/OpenCorvus/data/opencorvus.db为v3，project1/session0/message0/permission_ledger0/outbox0，memory仅一个project_context；query_only=1。v5原SQL命中0。此结论只覆盖该库，不能外推其他保留库。
- 另外发现私有product-iteration目录有698份opencorvus.db，仓库临时目录有10份db/sqlite（包括前序受控案例与备份），以及默认根原v1→v3备份。它们包含大量克隆和隔离验收，不能按路径名/日期把它们等同独立真实用户库。需按实际database_authority、schema、原请求和来源元数据分组；生产默认库、保留业务运行、工具夹具、受控缺口案例和备份明确区分。
- 审计输入：上述明确根与已知原始证据目录下的数据库元数据；不扫描auth/models内容。每库单个只读一致事务，核版本/原identity、目标table/columns、真实requested与human Replied、精确subscriber receipt/lease/phase、已有interaction源与owner、pending和document覆盖。对schema不同或读取失败返回明确unknown，不能算零命中。输出只含聚合、opaque身份和安全定位，原人类正文/密钥不进入公开日志或Git。
- 只有命中后才读取相关Project/Session/Task、Organizer提交日志、AgentTrace、原备份和实际canonical Entry。pending存在可正向证明capture；真实recentCovered含原ID可证明消费，缺席不能证明未消费。Organizer不创建memory helper Session Message/Part，不能虚构永久历史；其模型请求/候选不等于DB成功commit。OrganizationRequested只有Project，不能当输入capture凭据。
- 审计完成条件：每个发现的路径有明确只读结果与类别，命中记录有原source/decision/interaction/receipt和可用证据，范围缺口公开。读取过程中保持原库与业务状态，不执行重试、模型或副作用。审计途中只在自有目录保存报告，禁止给原DB加表/receipt或清理记录。

## 深度分析与待决恢复边界

- 可观察现象：v5对old human Task Replied存在attempt而缺success的库返回SCHEMA_MIGRATION_REQUIRED，整个升级未完成。旧capture与成功receipt分事务；Organizer消费/容量丢弃会删inbox，因此缺receipt且inbox为空不能唯一还原原效果。
- 前序根修保证未来同一SQL效果与receipt原子性，但没有提供旧存量恢复；仅保库报错只证明拒绝猜测，不满足本轮继续使用与数据恢复要求。
- 当前未知：真实命中数量、可恢复证据覆盖、原消费与从未capture比例、是否存在实际业务数据缺损。必须以本轮审计补足，不能把前序old-gap夹具冒称真实用户事故。
- 方案须覆盖：仍pending、确已消费、从未捕获、真实已成功、超出覆盖且保留/缺失原日志、早答缺interaction、跨Project与原owner冲突、Task/Session已删除、正常/终态/重启与重复升级、多库隔离。
- 必须保留：原ledger、原Replied字节/occurrence、原attempt/failure/success receipts、原Message/Part/文档和备份；不能制造旧success、猜时钟/rowid、将旧输入当新用户命令或覆盖现有记忆。不可证明的历史应明确保留其不确定性并提供可用恢复结果，不能仅把整库堵在升级前。
- 迁移合同：新增版本化恢复，保留已交付1–5原件。如何跨越尚未完成的v5拒绝边界、完成当前唯一存储协议和可重入升级，需要基于实际证据设计，不临时改user_version或删attempt绕过。此处尚未选实现；实施前补全调用点/契约/数据/测试/交付/风险分析与独立意见。

## 验收要求

1. 原始真实存量只读报告可复核，明确实际命中与来源，原库状态保持。
2. 自有隔离原快照经正式Database.Client迁移至新版本，完整原数据保留；恢复输出能明确区分已恢复内容、原已消费效果及尚不可判定历史，不能伪装success。
3. 原未完成v5、已v5、旧正常库、重启/重复/并发与不同Project均走单一当前实现；故障切点回滚结构/版本/数据/恢复事实，原备份可用。
4. 在真实持久投递/Organizer路径验证原source只产生正确的一次效果，旧业务决定和外部工具不因升级重新执行，真实新输入继续工作。需要模型时另行明确最小验证范围；当前阶段无模型和凭据用途。
5. 聚焦正向合同、现有迁移/交互回归及真实checker全部完成，独立子agent实质裁定；正常提交、fetch/merge、待推集合检查与push，保留所有无关工作区改动。

## 只读审计结论与原件边界

- 第一遍720个路径均成功只读：v0=492、v1=12、v2=3、v3=180、v4=16、v5=17；338个database_authority身份。不是720位用户，克隆保留同身份且可以有不同后续事实，未以身份去重跳过读取。
- 716有原v5所需表，4份缺表均为checkpoint/WAL工具探针（sqlite-checkpoint-408的probe.db、compiled probe.db/main-only.db及fork-latency-407/wal-index-probe.db），不是应用库。v0历史应用快照早于已声明基线，不在本次v1+自动升级合同内；仍实际执行原筛选而非当作零风险。
- 202路径含7998个human Replied副本行。另据before.json精确引用，只读增加9个受控原runtime/backup路径，总覆盖729；合计8007个副本行、108个唯一Replied occurrence、82个唯一Task Replied，目标ignored终态0。
- 命中仅受控gap的before.sqlite、原v4 runtime及3份原v4→v5备份，共5份同一原publication；原文档revision2、recentCovered500且该interaction缺席、pending0、lease1、success0。明确是前序刻意在旧capture→真实commit消费→501真实输入消费→receipt前退出23的案例，不是新发现的用户事故。默认库及私有保留业务运行库均未命中。本结论不覆盖未声明目录或已删除文件。
- 全部报告在自有ignored目录permission-memory-stock-recovery，原用户正文/凭据未输出或进入Git。代码只用bun:sqlite readonly/create=false+query_only+BEGIN/ROLLBACK，原库未经过应用初始化/恢复；没有模型、外部工具、进程或现用库写操作。

## 实施方案（审计后选定）

1. 新增不可变v6数据迁移；registry显式声明其准备动作在v5前、v4完成后执行。迁移器仍先取得原exclusive WAL锁、保存原库完整backup，全部历史版本、准备动作、原v5校验与v6在同一个BEGIN内提交。1–5函数/DDL不改；不catch跳过v5、不提前设版本、不删lease/receipt。from5走同一个v6修复函数；完成receipt使重复调用自然幂等。准备声明须验证版本范围/同步性，错误全笔rollback。
2. 选择原human Task Replied且缺success的原publication，验证原requested/唯一decision、publication Project/Session/decision/autoReply及原human输入；按原ledger source找唯一interaction，核原owner及Session祖先Task。早答缺interaction时只补原source引用的投影行，不合成用户消息或批准决定，不运行被批准工具。跨Project/原owner冲突是明确完整性错误，不猜测归属。
3. 将现有Entry格式、身份、脱敏与inbox插入下沉成一个无Instance/运行时启动依赖的primitive，当前capture与迁移共用。原pending按source身份、surface、time、脱敏text/structured验证，整份canonical Entry逐字保留，不能按当前Task标题或后来消息重构历史。原recentCovered存在ID是正向消费证明，原文档保持；缺席只表示未知。
4. 未知旧消费：将原输入重新登记到同一个现有inbox，ID仍为原interaction，使用原surface/decision时间/text/structured；不虚构历史context。Entry可选recovery字段记录migration6、原publication、实际恢复时刻、previousCapture=unknown。它仅是来源说明，不参与去重；Organizer明确按历史证据与现有文档合并，可能已整理过，不解释为新的执行命令。现时真实succeeded receipt证明本次验证/登记完成，不倒填旧成功。原attempt/failure/lease/source/文档全部留存，正常Bus后续沿同一个success事实收敛。
5. 已合法删除的owner须核原task.deleted/session.deleted持久事实，尊重原退休语义并保留原输入原件，不复活Task/Project或归给其他Project。整项目物理删除与同ID重建按下文补充方案处理：当前Project仍存在而原owner缺失时保全为待审阅输入；Project也缺失且没有合法退休证据时才返回明确缺证据错误。ignored目标并非本subscriber生产合法终态且存量0，按明确错误合同处理，不能删除原terminal去伪造success。
6. 方案局限公开：缺永久消费证据时，无法保证旧输入从未被Organizer考虑；本方案保证本次只重新登记一次、现有文档和原输入均保留。不会以短窗口缺席、模型请求/候选、时间猜测、关键词或日志缺行证明从未消费。独立裁定已认可此恢复语义及同事务准备方向，最终仍须核实现和真实原件升级结果。

影响面：migration registry/执行器、现有Entry解析/持久化primitive、Organizer上下文及相关正向测试、数据/记忆当前架构。LLM调度/工具选择、UI、Schema1–5、权限执行/决定、数据库路径、模型与凭据配置不改。交付包括原件只读报告、隔离真实业务库升级及前序gap原快照正式opener升级、全原表/rowid保留对比、备份/重启/并发/故障回滚与独立裁定。若触发真实模型需求，先核已有授权范围；当前数据库恢复不需要凭据。

### 独立复核追加：整项目物理删除

独立agent发现Task单独删除与Project物理删除不同：后者的deleteTask(projectDeletionAdmission)在追加task.deleted前返回，再直接物理移除Task/Session/Project，不一定有单个owner墓碑。成熟永久原件是data/maintenance/project-deletion-cleanup下绑定databaseInstanceID/projectID/projectGeneration/operationID的active或completed manifest；completed为原manifest durable rename，旧v5的completed只按不可变envelope投影。此前仅seed task.deleted的绿例不能证明整项目删除可升级。

补充方案：复用并提取该现有历史identity/envelope投影为pure primitive，迁移上下文传实际databasePath，只读其同目录既有manifest，不调用Database.Identity初始化、不读取凭据、不执行cleanup。仅原Project/Task/Session全缺席、原DB authority与canonical manifest路径/Project匹配，且登记根按成熟Filesystem.contains合同包含原publication.directory时，确认整个原Project退休。等目录及真正子目录有效，相邻字符串前缀无效；不以owner缺席、时钟或字符串模糊匹配推断删除。当前Project已复用同ID但原Task/Session归属缺失时，ledger/outbox没有generation，不能把旧输入归新generation。必须补真正Project.delete之后原缺receipt库的正式升级正向验收；原manifest作为数据库以外必需原件一同保留和只读绑定。

真正旧Project.delete已产生原件：old-project-deleted-owner-fixed，生产删除committed、原Project/Task/Session全移除、原human Replied及failure保留且success0、原completed manifest保留、进程在明确切点退出23。其余试验因夹具surface/creator元数据错误未完成删除，不能冒充生产验收。

对同ID重建的generation未知，继续升级采用现有protected inbox的明确‘待owner审阅’投影。真正旧删除原件证明interaction审计行及原interaction.requested owner事件仍然保留，因此先验证原source与不可变owner，复用原interaction ID；只有原interaction确实缺失时才使用原bus publication ID，不猜测旧ID。原pending存在时整份canonical Entry原样保存；不存在时实际保存原human输入，保留原Task/Session字符串及原时间/surface/text/structured，recovery.ownerResolution=unresolved，不伪造旧上下文或标题。

单一inbox投影统一识别显式unresolved、原owner缺失、task.deleted、原source Session缺失或session.deleted。旧Entry无需改写也可如实报告原owner不可用；跨Project owner/source仍返回完整性错误。这些证据不进入当前generation的Organizer FIFO、prompt、commit或缺模型容量丢弃；普通新输入保持原owner路径。Task原source Session仍有效但绑定root缺模型时，继续原来的明确unavailable模型合同，不能混为旧来源未定。

ProjectMemory.read、HTTP和现有memory.project_read返回unresolvedCount及每页最多50条的来源游标；memory.project_read还可按occurrenceID以每页最多4000个UTF-16代码单元读取同一canonical Entry。offset/nextOffset均使用此精确单位；JSON保留页内代理项，续页串接后完整重组含非基本平面字符的原文，不声称每页终点一定落在完整码点。旧pending没有recovery时publicationID允许缺省。没有新processed表、归档库、影子原文或owner复活。当前成功receipt只证明本次原输入已实际保全且可审阅，不证明旧消费或新owner归属。缺Project且没有任何合法退休原件仍是损坏/缺证据合同；现有Project但旧owner不明可用此保留未知路径继续升级。测试证明51条来源完整分页、新generation真人输入正常消费、原待owner输入原样保留且可完整审阅。

## 真实升级与回归验收

- 所有原库只读，一致快照写入自有隔离runtime；正式Database.Identity/Client执行v1+单一迁移。两个保留业务原库分别v3→6（90表171548原行）和v5→6（90表203799原行），逐表逐原行及rowid保留、原备份完整相等、重开identity保持。默认v3库的隔离快照也通过；未升级现用原库。
- 旧源码真实HTTP/Bus/Organizer制造的pending、已消费、窗口外gap、从未投递及已成功原件全部经当前正式opener通过。pending的后来Task改名不影响原Entry字节，已覆盖的原文档保留；gap保留未知消费并实际登记一次。真实Bus原publication重复投递、真实Organizer事务提交、消费后重投及新human Message均使用生产路径；此处没有模型调用，不声称验收了模型语义合并。
- 真正旧Project.delete原件、同ID重建原件及真正父根/子目录历史通过4→6。子目录案例使用真实Project.fromDirectory(parent)→addSandbox(child)→child Reply效果后失败→removeSandbox→deleteProject(parent)；原publication ProjectID为父项目，目录为child，最终manifest仅登记parent，child不等于任何登记路径。90表47原行和原备份保持。早先仅按目录命名的‘子目录’其实是独立根，不能证明该合同，旧日志保留并以此严格案例替代其覆盖声明。
- 真正相邻前缀案例只改自有manifest副本的登记根（原basename少一字符），直接证明原目录startsWith该字符串但path.relative越界。正式opener返回SCHEMA_MIGRATION_REQUIRED，原schema、版本、全行及原备份完整保留。原先追加.neighbor的样本只证明一般不匹配，不能证明相邻前缀边界，保留其诊断并修正checker。
- gap原件注入prepare后真实异常，v4/90表3044行整笔回滚；随后三个真实独立开库进程initial为current/busy/current。实际SQLITE_BUSY是既有公开独占锁合同，全部进程退出后以新进程重开该调用者，最终全部v6、同identity、1个输入/1条成功回执，两份原备份均完整相等。首版checker错误要求所有首开成功的红日志保留，不新增生产重试或把busy伪称成功。
- 最终聚焦合同：permission-memory-recovery 20项/101断言；project-memory-recovery-read 4项/46断言；schema-migration 25项；project-memory 25项/143断言；interaction-memory-replay 9项/74断言。补充原v5选择器、permission ledger/provenance及真实Project物理删除回归通过。fixture曾缺少竞争Task导致SQL外键错误，先补真实Task再重跑20项；红日志未删除，不能当作生产修复证据。
- 使用当前runner：packages/opencorvus下bun script/run-tests.ts <明确测试文件>；物理删除仅选择deletes a terminal Task and its managed root through one Project authority。未运行UI自动化。packages/opencorvus typecheck、packages/sdk/js build、根目录check:database-migrations与docs:check通过；SDK/OpenAPI与当前读取合同同步生成。
- 旧源码生成器必须显式绑定已验证native supervisor。两个新样本预运行遗漏绑定导致旧源码尝试重建工具，未完成业务生成；日志保留，正式案例绑定现有helper后完成。没有现用进程操作、凭据或模型请求。

证据聚合及可复用探针见[artifact](../../artifacts/2026-10-24-permission-memory-stock-recovery/README.md)。原SQLite、原human正文与私有定位只留自有ignored证据目录，不进入Git。缺永久消费证明仍然未知；本次保证原输入保全和当前恢复完成，不能恢复已经丢失的历史消费事实。

## 独立裁定与交付

只读独立子agent `/root/independent_judge` 最终裁定：实现、公开文档与证据通过；有界矩阵及横向审计未发现新的已证明机制问题。它直接核原件与备份、原interaction身份、旧pending原样保全、同ID重建的新输入消费、严格父子目录与相邻前缀、并发busy与新进程重开、UTF-16分页完整重组，以及提交范围。其裁定没有以模型自述、测试名称、文档checker或单个绿例代替原始证据。

实现提交 `c2fd5291f` 共29个本任务文件，已正常推送 `origin/main`。推送前fetch并merge upstream，待推集合只有本提交；正常hook的typecheck、SDK/AI runtime/迁移、路由/文档、control lease、architecture/package/module/release topology及secret-scan全部通过，未跳过hook。已交付迁移1–5保持，其他owner的577索引改动、原171项删除及非本任务未跟踪文件未混入。现用原库保持未写入，本轮无模型或凭据用途。
