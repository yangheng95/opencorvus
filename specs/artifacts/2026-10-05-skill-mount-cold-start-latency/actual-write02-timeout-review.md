# Actual Sol Write02: Skills mount deadline recurrence

## Recall

Root 报告 fresh02 真正 Sol Write/Read/86bytes/UI/copy/source/reopen通过，但730行正式 runtime log 有2026-10-05T18:41:52.084Z overlay:project-load skills timeout，要求作为独立未解决问题调查。Root已精确shutdown PID36512及conhost38880/17954、两paired copy清理；当前native03由Root运行，生产冻结。本agent gpt-6.1-sol，无再次委托，只读源码及既有sanitized artifacts，唯一新增本调查。不操作实际服务、UI、Provider、凭据、Git，不改source/test/index/record。

已读现有 skill-mount-cold-start-latency 月度record及actual02 timing-review；当前04-extensions架构Skill单一authority合同；完整Write02日志中相关请求与错误、overlay extensions/init/host-transport；backend skill Routes/mounts/manager/skill/read-diagnostics/replacement-publication；shared DurablePublicationStore锁；所有 installed/installedCatalogSnapshot/withCatalogProjection及overlay loadSkillMountMatrix调用搜索。历史19.675s原问题未根治，actual02只资格化已有诊断和DEBUG sink，不是latency修复。

## 本轮真实证据

| 对象 | 时间UTC/结果 |
| --- | --- |
| 首个 GET /skill/mounts，request 6dee6232-f567-4710-9053-335a4df449e4 | runtime.log:216，18:41:36.586Z started |
| overlay project-load extensions load failed | :253，18:41:52.084Z，skills: signal timed out，目录指向live-sol-write-02/project |
| 同一请求backend完成 | :256，18:41:56.042Z，HTTP200，duration19456ms |
| 同轮MCP/config | 18:41:36.587→.590 MCP200/3ms；.591→.593 config200/2ms |
| 后续 /skill/mounts request4d7696ed-b97d-4a0a-9561-7a4d0a59b702 | 18:42:23.633→.877，HTTP200/244ms |
| 再后续 /skill/mounts request502c1278-cc1a-49a4-a401-140ace010a5b | 18:49:16.547→17.045，HTTP200/498ms |

首请求到客户端错误为15498ms；backend仍继续并在错误后3958ms完成。计时与现有15s transport deadline一致，但该498ms差不能当精确browser timer调度延迟或network阶段证据。请求日志没有query，因此exact sessionID/expertSquadID/refresh未知；错误目录定位Project，不补造query。本轮再次出现与原19675ms同量级冷慢/暖快，不可因数字接近断言完全相同慢阶段。HTTP200不证明aborted客户端收到了matrix；暖成功不能自动消除先前projectLoadIssues，也不能证明冷启动正常。

## 直接触发和控制流

host-transport.ts:23/118–122 默认15000ms AbortSignal.timeout。extensions.ts:248–250 的loadSkillMountMatrix走唯一apiJson(skill/mounts)，未覆写deadline。loadExtensions:207 对matrix与MCP并行allSettled，技能拒绝保留skills错误；init在conversation/task/meta恢复后独立启动extensions/config并据现有authority/selection应用错误。因此慢Skill不再阻断selected Conversation（Write仍能成功），却仍超时并产生真实项目加载issue。这是保留错误反馈的当前正确行为，不应隐藏、吞错或改成假ready。

GET /skill/mounts验证optional activeProject Session，再调用SkillMount.matrix；matrix含config/effective Session+package revision、installed inventory、PromptProfileResolver Skill projection、HostAgentRegistry及完整scheduler/worker行组装。路由没有把请求AbortSignal交给这些domain读。客户端超时后server按既有共享读事实继续，19.456s后200并非“timeout被修复”。不能为减时删掉scheduler-only agents、risk/provenance或exactgrant合同。

## 共享慢阶段候选及未知

SkillManager.installedCatalogSnapshot→withCatalogProjection持有唯一跨进程Skill catalog publication owner，先recoverOpenSkillReplacement/revision与Config失效收敛，再installedAtPublication；inventory实例initializer通过Skill.all发现Skill，并并行做manifest/provenance/risk扫描。Skill.all/get通过同一publication projection及Skill state initializer；共享context重入避免创建平行owner。replacement-publication.ts:99–100委托DurablePublicationStore.withSubjectLock。durable-publication.ts:225–229现有proper-lockfile admission采用forever重试25–250ms；held scope覆盖filesystem/config投影。19.456s可以来自admission，也可以来自held工作或后续projection，当前证据不能选其一。

Skill discovery包含builtins、兼容external global/project(.claude/.agents/.codex)、OpenCorvus目录、configured paths/urls，默认来源决定真实工作量。实际02旧checker明确关闭external compatibility discovery，N0/1/32人为isolated inputs，冷374–503ms、max705.65ms；其N32 admission4/held135/inventory119/Skill61ms说明该数据集正确而快，但不能排除当前明确配置来源/文件量、publication重置或cross-process contention。事实校正：实际执行的同一live-sol-launch.ps1:44明确设置taskEnvironment.OPENCORVUS_DISABLE_EXTERNAL_SKILLS=1，正式live-sol-write-02-launch-owner.json的environmentNames也记录该键；launcher将重建环境传给该真实owned child，wrapper没有覆盖该键。Flag getter按truthy读取这一值，当前source据此跳过skill.ts:674–691的整个兼容目录分支，包含home的.claude/.agents/.codex以及project/worktree祖先兼容目录。不能再将external compatibility enabled作为本轮同等慢因候选。这个开关不关闭builtins、Config.directories下显式OpenCorvus目录、config.skills.paths、config.skills.urls以及inventory/projection/recovery/lock；这些实际扫描来源、数量和阶段仍缺日志，不能推成全Skill来源关闭，也不能读取真实Skill内容补猜。

本轮日志没有可用的request关联SkillReadDiagnostics分阶段输出。已有instrumentation具备request、catalog admission/held/release/recovery/reset、state initialization/read、external/configured/remote scan、manifest/provenance/risk与projection细分。原DEBUG sink已修，不代表每个ordinary CLI INFO运行自动保存DEBUG阶段；本次不能从没有stage日志推断某stage没运行。旧instrumentation和当前deadline不需重新发明。

## 横向影响、重试与恢复

所有生产installed消费者共用这个owner/initializer：SkillMount.matrix（项目/Session/ExpertSquad）、SkillManager读/安装/删除/refresh后读、server skill installed路由、ConversationCapability的Skill设置与available/projection，RuntimeCapabilityCatalog的Skill publication，Config相关Skill验证；Skill all/get自身也共享catalog projection。Primary Coding/Chat/Work、Mission和Task scheduler/worker通过各自真实grant投影消费同一Skill事实，不是只Work可受影响。

refresh/reset会失效Config/Skill/inventory；首次读取重建，warm fast不证明refresh fast。publication revision改变会resetAll inventory/config；重启state缓存丢失，catalog durable owner/recovery仍由同一store收敛。并行同Project读可能join pending，也可能各自等待串行catalogowner；不同Projects仍共享全局catalogpublication，所以一个长held可影响多个Project的读，实例inventory不能替代global publication一致性。重试HTTP在原请求仍held时可追加等待，客户端取消不释放域共享工作。当前没有锁泄漏、死锁、错误终态、恢复循环或queue异常的实际证据；必须按共享机制核验，不把一次普通Work成功当排除。

现有actual02覆盖N0/1/32串行/重启并行A/B、callerabort后backend200和正确后续行；这证明该isolated数据集的recover/并行读合同，不证明此真实19.456s场景。显式OpenCorvus/configured来源的真实并行量/其他进程catalog写/read owner、实际Skill数量、publicationrevision、recoveropen事实未知；不能按用户目录名称推断。

## 旧路径为何未根治与下一最小slice

之前修的是DEBUG multistream丢日志及真实checker计时qualification，没有优化Skill discovery/lock/inventory/projection，也没有原慢实际source集合复现。所以再次timeout并非那项修复回归，而是已明确保留的原性能问题重新真实出现。conversation-independent loading修复了解锁UI路径，没有改变Skill duration；把deadline调大或隐藏错误只掩盖本次缺口。

建议下一slice先复用现有diagnostics+同一个checker/ordinary CLI入口进行真实冷路径分阶段资格化，不先改性能源码：由Root另行批准fresh owned无LLM isolated actual /ui project load；单一当前CLI使用现支持print-logs DEBUG，保留原skill sources/config policy，读取内容不得进入证据，仅安全数量/phase/ownerrevision/request关联。记录已证明external兼容开关保持关闭及其余来源种类/计数，不复制凭据、无需Provider请求。首次matrix同时的真实MCP/config可作为请求分离事实，必须同requestID平衡所有spans/initializer creators；保请求query的safe exactscope事实以区分Session/ExpertSquad/refresh，不能用猜路径。

最少真实矩阵为cold/warm、sameProject parallel、twoProject parallel、refresh、fresh restart；取消一个真实caller后核验backendnatural结算及后续完整matrix，遵守原owner公共shutdown/全退出/cleanup。若阶段已能明确指认瓶颈，先实施该唯一source修复并原矩阵重跑，不无目标继续扩测。不得在现native03/用户进程上重启、刷新或变更环境。

根据真实分区才给修复：admission慢则核验正在持有的确切publication occurrence/lease与crossprocess角色，不绕锁；held discovery慢则优化现canonical扫描primitive的实际重复或无效遍历，保留真实Skill/来源错误；inventory risk慢则用现有安全package/revision生命周期避免已证明重复工作，不新增cacheowner；projection慢则消除已证明重复解析，保持immutable package/grants来源。没有phase证据时不指定一个猜测优化，不创建另一目录或UI-onlyquickmatrix。

若改非UI primitive，正向测试验证完整installed/matrix行、risk/provenance/rolegrant、revision更新后的正确结果，实际完整checker验证性能；mock delay只能局部deadline错误类型，不能冒充原慢根因。真实接受指标是当前完整catalog正确、cold请求在原15sdeadline内实际返回并UI正常投影，以及restart/refresh/parallel正确结算。不要以固定sleep或脆弱walltime单元测试替代真实qualification。

## 当前结论

已证明本轮19.456s真实mount超过默认15s，clienttruthfultimeout、server晚200、warm244/498ms；Write功能通过仍有这条未解决项目加载错误。具体慢phase、source量、catalogowner事实尚未知，下一slice应优先取得现有分阶段证据后根治，不调deadline/绕锁/隐藏错误。本轮只新增本文件，无源码、测试或运行操作。


## Root factual correction

前一版本关于“launcher未看到DISABLE_EXTERNAL_SKILLS”的陈述不正确，已原位更正。复核实际launcher:44、其传入taskEnvironment的child创建与正式launch-owner.environmentNames、Flag getter及唯一Skill调用分支后，当前Write02兼容home/project发现明确关闭。未变更这个运行事实，也不保留external enabled为等价候选。其余显式/configured/builtin来源及共享锁/projection实际慢阶段仍未知。本次仅更正本独立md。
