# Ordinary Skill mount cold-path diagnostic preparation

## Recall

Root 要求下一阶段复现实际Write02 GET /skill/mounts 19456ms的具体阶段，而不是再次仅跑N0/1/32快夹具。当前source冻结；本阶段只读准备，不实施或运行，不新建runtime、不读取auth/models内容、不接触私人Skill目录，不委托。只新增本文件，不改shared README/record/index。Root拥有后续授权、真正UI/process/physical目录角色事实、shutdown与交付。

已完整读取canonical packages/opencorvus/script/skill-mount-cold-start-check.ts，actual02 README/timing-review及月度record，实际Write02 timeout review与launch fact；完整current live-sol-launch.ps1、tool-detail-ui-launch.ps1；util/test-runtime-environment.ts、Global runtime/home resolution、Config managed-dir入口、Skill builtin/discovery/mount/manager/publication diagnostics、ordinary serve CLI startup和live-sol wrapper的真正serve/preflight入口。全仓检索testenv、managed config、external开关、builtin输入和共享装载调用。

既有事实：19456ms请求晚于15s client timeout但server200，暖244/498ms。慢phase未知；兼容发现disable=1已明确，不保留external enabled候选。旧actual02曾测27HTTP200+1callerAbort、完整phases，但原19.675s未复现。当前文档是方案，不是已完成新qualification。

## 一个checker，两种明确输入profile，不能平行runner

唯一HTTP/phase/owner checker继续是skill-mount-cold-start-check.ts。建议最小增加显式输入profile参数，原有fixture profile保持既有资格用途，新增ordinary profile选择真实普通隔离环境和empty owned Project，不复制另一个runner。两个profile共用occurrence、request capture、phase平衡校验、HTTP projection和publicshutdown/terminal事实逻辑。profile必须显式写入结果，普通profile才有资格调查这次慢路径；fixture成功不能代替ordinary。

建议参数（只是待实施合同，当前脚本尚不接受）：
- --profile ordinary --output <fresh-evidence-dir> --run-root <fresh-owned-root> --port <free-loopback-port>。
- matrix固定为cold/warm/sameProject-parallel/twoProject-parallel/refresh/restart/cancel，不以N计数创建人为Skill。每个case有唯一prefix与occurrenceID，输出CreateNew，禁止overwrite。
- 若Root希望真正UI参与同一次首加载，可增加明确--admission root-ui的bounded等待，让Root自行打开已有serve/UI；HTTP checker在Root确认首cold观测已保存后继续，不在启动后抢跑Skill GET导致UI变warm。不做浏览器自动化、不伪造pageClosed。

无需改生产Skill/queue/timeout/Provider/SDK，不增新tool或API。具体代码触及仅原checker参数/env/bootstrap/fixture选择/矩阵/异常证据收敛，必要既有纯非UI脚本类型测试；新的普通环境仍用ordinary src/index.ts serve作为唯一服务。launcher只作为环境/入口参考，不复制其Auth/Provider wrapper。

## 当前输入差异是必须记录的事实

| 当前入口 | 改变的真实输入与状态 | 对慢路径结论的限制 |
| --- | --- | --- |
| 旧checker bootstrapIsolatedTestRuntime + isolatedTestChildEnvironment | 创建OPENCORVUS_TEST_HOME/PROCESS_ROOT/MANAGED_CONFIG_DIR、专用测试home、XDG/TEMP；删除CONFIG/CONFIG_DIR/CONFIG_CONTENT等用户配置；fixture写N个Skill和risk子文件；启动不传--project-dir，cwd为fixture launch；native test supervisor作owned_tree父helper | 不是ordinary运行环境；test managed directory替代真实系统managed面；N32人工风险量不能代表真实builtin/package/config path；冷无UI并发，不含普通defaultProject startup |
| live-sol-launch真正Write02 | 普通HOME/USERPROFILE/APPDATA/LOCALAPPDATA/XDG/TEMP全部owned，OPENCORVUS_HOME=runtime、disablecompat=1、disableautoupdate=1；CONFIG_CONTENT仅指定model/smallmodel；wrapper先pairedstage+catalog/preflight后UI，--project-dir绑定owned project | 环境profile已与test不同；真正preflight会warm若干Config/Role/catalog状态，不能在noProvider诊断里伪造其影响或reuse旧auth/runtime |
| tool-detail-ui-launch | ordinary bun run dev serve --project-dir、INFO，普通ownedhome但复用旧live-sol-cli runtime/project展示历史；auth/models须已清理 | 是ordinary serve环境参考，不是fresh cold输入；旧runtime/cache/history不得借用来声称fresh复现 |

Global.resolveHome优先TEST_HOME，普通路径经os.homedir及HOME；Config managed directory在TEST_MANAGED_CONFIG_DIR存在时改用它，否则system managed面。因此普通profile必须不设置任何OPENCORVUS_TEST_*，不能保留旧bootstrap单纯叫它ordinary。当前hostKeys scrub/expectedTestProcessSupervisor是旧test所有权机制，不是Skill source政策；若保留已存在native supervisor作为真实process ownership实现，须明确其helper角色、它不会另行引入testenv，不宣称普通无helper。最小安全选型由Root核读当前NodeProcess deployment primitive决定，不新实现process supervisor。

builtin discovery来自同一编译入repo资源，不见一个testflag把它关闭。Skill.all初始化builtin descriptor与後续builtin materialization不同，只有真的执行相关解析/投影才有阶段证据；不能因N0=0宣称没有builtin工作，也不能凭builtin目录存在称它是19s根因。普通profile必须保留当前builtins与默认package/grants政策，不向fresh config写人为N-Skill或另一个强制空目录。

## 普通fresh环境与noAuth/noProvider admission

Root批准执行后才创建fresh run-root：runtime、project-a、project-b、home/appdata/localappdata/temp/xdg四面与evidence，空Project不得写Skill或消息。父环境只保PATH/SystemRoot/WINDIR/ComSpec/PATHEXT及locale，按同一ordinary launcher重建HOME/USERPROFILE/HOMEDRIVE/HOMEPATH、APPDATA/LOCALAPPDATA/TEMP/TMP/TMPDIR、XDG_CONFIG/DATA/CACHE/STATE、OPENCORVUS_HOME。固定disablecompat=1与disableautoupdate=1。为尽量保Write02 configuration shape，可保其仅model/smallmodel的非秘密CONFIG_CONTENT字符串；这不授权Provider请求，noAuth/models不会因模型名字而跳过检查。

不调用live-sol-cli-owned.ts：它无条件检查/copy真实Auth+Models、绑定actualaudit并preflight，直接违反本阶段noAuth/noProvider。ordinary serve直接启动，不发送任何Session prompt或模型请求，不用假Provider、不创建syntheticmessages。不复用tool-detail-ui旧runtime/project/cache或旧Solpair。startup health读取只安全paths/owner身份，metadata存在性可fs.stat但绝不读取内容；若fresh auth/models意外存在，明确admission失败而不是删除用户文件或继续。

ordinary system managed路径保留默认合同；Root可用launcher已有存在性precheck证明无managedjson，若有则停止并单独审查，不设置TEST_MANAGED_CONFIG_DIR隐藏它。proxy/PAC source admission仍按已有普通launcher只检查安全事实，值不写证据。configured paths/urls只能来自当前fresh-owned配置及正常builtin/package defaults，不借私人Skill或任意网上下载输入；若实际默认有远端URL或outside-owned显式path，报告source种类/计数并请求具体授权，不能自动遍历/拉取，也不能静默清空配置改集合。当前source集合未知时明确不是已完成原根因复现。

## 共用ordinary serve与HTTP矩阵

共用既有spawn/日志流，args保持src/index.ts serve --hostname127.0.0.1 --port参数 --project-dir project-a --startup-receipt --startup-occurrence --parent-pid及process-instanceID --print-logs --log-level DEBUG。Startup必须匹配receipt occurrence/pid/url和实际owner；defaultProject改为explicitordinary输入，冷阶段包含它真实startup初始化。若startup已发生Skillinitializer，保存creatorHTTP=null等现diagnostics，不能HTTP后才开始截log遗漏真正cold。

1. cold-a→warm-a：原transport默认15s，完整校验matrix scope/activeprofile/skills refs/sourceType/risk/所有agents与grants，保存安全统计与正确身份。不要fixtureNames过滤导致误丢非夹具来源。
2. sameProject-parallel与twoProject-parallel：真实同时GET，准确querydirectory，对比安全完整投影与phasecreator/join/admission/held，区分initializer重用和catalogowner排队。
3. refresh=true：唯一现SkillMount.matrix refreshDiscoveryState入口，保revision/reset/重新初始化事实；不能把refresh当写安装或删包。
4. restart：同一个owned runtime/projects自然shutdown全退出后新的serveprocess/occurrence，复用持久配置缓存但重建in-memorystate；另一个fresh runtime重复cold只有新root才能叫freshcold。不要重启用户服务。
5. caller cancel：沿现checker等待真实state.initialize started后abort一个caller，记录exact requestID和AbortError，等待原backendrequest自然完成及balancedphase，再后续A/B正确matrix。若初始化已自然完成就记录cancel-not-exercised，不说cancel覆盖。不能mockdelay强制造慢。

关键checker修复风险：当前read只识别主动controller AbortError，默认timeout会throw并立即进入finally shutdown，可能在慢请求结算前停止服务并丢最有价值阶段。普通profile须真实捕获TimeoutError作为观测failure（保原15s，不override），仅允许读/收敛该已观测原request的backendterminal；独立bounded诊断结算窗不算延长用户HTTP期限，也不将late200当clientpass。该等待必须按真实requestID/phase完成检查，不用pollcount/httphealth当progress；超过独立窗保存缺失phase后按既有exactowned清理，不能无期限等待。客户端timeout读不到responseheader时，以唯一正在执行的该label对应serverstartedrequest匹配，不拿最新任意request兜底；并行需要明确分离或已有requestcorrelation支持，否则unknown。

## 现有diagnostic primitive与安全证据

SkillReadDiagnostics.phase/request/initialize/readState/catalogOwner只DEBUG时观察原值/Promise，已批准的Log multistream修复支持print DEBUG。复用它，不加第二计时缓存；记录request/catalogadmission-held-release/recovery/revision/reset、state creator/disposition、builtin/external-explicit-configured-remote scan、inventorymanifest/provenance/risk、package/skills/capabilities/selectors投影。累计parallelaggregate不能直接相加成walltime。

安全统计：Project角色a/b与ownedroot、requestID/occurrence、source_type→count、builtin/nonbuiltin数量、configuredpath/url计数（不打印值）、agents与grant数量、riskcategorycount、initializer/spanID/creatorrequest、publication revision与lockphase、实际requestwalltime和clienttypedoutcome。避免Skill正文/frontmatterdescription、prompt、工具key、auth/models/proxy内容。若Skill名字/路径不是owned或builtin，证据按匿名source类计数，不输出私人路径；完整raw DEBUG日志须先确认现sanitizer不会泄露源码warn中的privatepaths后交Root审查，不能把“安全phase”说成所有raw日志天然安全。

旧checkerfinalassert目前initializations>0对warm-only发生不合理；普通矩阵须按occurrence的完整startup/cold已读事件判资格，不在每个warmcase强制新init，也不把缺debug判成零成本。保存原始失败与全部phase，最后summarizer再明确clientpass、backendsettled、timingqualified三层。15stimeout仍exit失败/未达目标，late200只是后端收敛证据。

## 边界、验收与下一决策

noProvider初始scope与Write02已做preflight不同，真实UI还触发MissionSkill/ChatCapability/ExpertSquad/config等并发。普通无Auth首matrix若再次19s，可按phase直接确定共享瓶颈；若很快，只能证明该baseline，不排除真实UI并发/前序状态变化。Root可随后在同一approvedowned普通UI启动自然Project load并保存请求mix，仍不发模型任务；不能造preflight替身或乱打endpoints冒充UI。只有Root的实际页面/目录/进程事实能完成这层资格。

后续实施前Root核对当前单一source/脚本diff，明确checkerordinaryprofile范围。聚焦非UI正向checker合同验证正确输入profile/safeprojection/TimeoutError观测与完整phase结算；显式types须包含checker所有新增branches和相关types，不通过mock阶段声称latency复现。真正验收要实际HTTP完整matrix、真实DEBUGbalancedspan、ownedwholechain/publicshutdown/全部自然退出+portfree和freshrootcleanup物理事实，Root独立复核。无real原因不优化，绝不增deadline、绕cataloglock、关builtin/真实来源或隐藏projecterror。

当前只产出本方案；尚未修改脚本、创建runtime或执行任何HTTP/UI/进程。原19456ms根因仍未知。

## Root checker preparation admission

Root reread this entire Recall/plan, the full current canonical checker, ordinary/presentation launcher source, existing transport deadline and safe phase diagnostics, test-runtime environment distinctions and actual Write02 source policy. Delivered c59cf33b is pushed; later Instance slice A is source-frozen with17/41 local contracts and formal/explicit types, awaiting Root's separately scoped delivery. No ordinary diagnostic runtime exists and no actual slow phase has been identified.

Approve PREPARATION ONLY in the single existing skill-mount-cold-start-check.ts: explicit fixture versus ordinary benchmark input, ordinary fresh root/port and actual default Project startup, shared current HTTP/phase/owner/public-shutdown logic, complete ordinary matrix projection rather than fixture-name filtering, original15s client timeout retained as failed observation with separately bounded exact-request backend convergence. These are benchmark input contracts, not a product configuration face or parallel runner/Skill owner. Do not duplicate occurrence/read/cleanup implementations; retain fixture input's truthful prior purpose, never call its pass ordinary acceptance. Source ordinary environment must omit test home/managed flags, reuse existing NodeProcess ownership and existing installed helper without implicit compile, retain same ordinary default builtin/configured policy and disablecompat=1, and fail before any unexpected managed/proxy/private input use. Clear all credential/Provider/embedded keys; no Auth or Models copy/preflight/prompt/synthetic Message.

The optional Root UI observation admission may be a single explicit nonsecret parent fact bound to the exact startup occurrence and actual first UI request, with a bounded wait. It must not be a browser driver, guessed request identity or a selector/HTTP gate teaching a model. Use existing request IDs and phase spans as facts; timeout/client-abort/late200/backend missing completion remain distinct outcomes. If parallel timeout correlation cannot be proven, record unknown and fail that qualifier, never choose latest request as fallback. Refresh/restart/cancel are actual scope-preserving inputs to the current public primitive, not synthetic delay. Keep exact evidence CreateNew and all failed original outcomes, whole observed child/helper/port closure; no user process/window action or fake pageClosed.

Before edits save exact current checker and its clean diff under a uniquely owned before directory. Sol meta may edit this checker and only necessary focused pure non-UI checker-input/observation tests using existing test location/primitives, then run strict explicit types including the entire checker and relevant production inputs plus those focused tests. No UI automation, production Skill/config/timeout/logger/Provider behavior, shared index/record or Git mutation. No canonical import/spawn/HTTP/owned directory creation or real checker invocation in preparation. Return full source/diff/config, original failures and final checks, safe environment/source policy and exact proposed Root-only command; freeze before Root full review. Root alone decides actual diagnostic run after inspection. Configured outside-owned/private inputs remain unknown and require review; repository builtin source and the verified empty owned/default configuration are already within scope. Goal remains active.

## Sol preparation implementation and freeze

Only canonical skill-mount-cold-start-check.ts and its necessary pure skill-mount-cold-start-contract.test.ts changed. Before text is ordinary-checker-before.ts.txt, full final diff ordinary-checker-preparation.diff.txt, final source ordinary-checker-after.ts.txt. No production Skill/logger/timeout/config/Provider source or instanceA file changed. No second runner/module was created.

Checker execution is now guarded by import.meta.main; all production runtime/process/schema imports are inside main and occur only on a future actual checker invocation. Tests import only the same file's inert pure parameter/correlation/typed-outcome/count functions. Actual preparation checks used Node experimental type stripping and node:test directly, avoiding both repository Bun preloads/test runtime bootstrap. No checker main, production import, spawn, HTTP, runtime mkdir, auth/models or Provider was invoked.

Input profile is explicitly fixture or ordinary. Ordinary environment omits all test home/managed flags, rebuilds ordinary HOME/APPDATA/XDG/TEMP, retains the nonsecret model/smallmodel configuration shape, builtin/default policy and disablecompat=1, uses fresh owned root and default project-a startup, and reuses the same installed helper/NodeProcess/occurrence/read/cleanup. It checks unexpected outside-owned ancestor configs/.opencorvus, managed config and credential-proxy/PAC input before serve, records no values. Metadata stat must prove no fresh auth/models. Complete SkillMount.Matrix schema parsing and complete in-memory cold/warm comparison replace fixture-name filtering for ordinary; persisted projection contains source/risk category counts, actual role IDs and grant counts. Unexpected outside-owned nonbuiltin source is a hard admission failure. Runtime is retained for Root's independent physical review/cleanup rather than applying test-root deletion authority to it.

Original15s timeout is unchanged. It stays client-timeout/clientAccepted=false and final failed status/exit1 even if exact backend later200. Separate60s convergence is only for observed backend receipt; ordinary parallel ambiguity records unknown identity plus independently settled candidate receipts, fails qualification, and never assigns newest request to an input. HTTP response-header identity is preserved if already obtained. The same convergence helper handles all reads. Cold/warm/A+B parallel/refresh/restart/cancel reuse one occurrence/read implementation. Cancellation qualification requires actual caller-aborted; naturally finished initialization does not count as a cancel pass. Existing exactowner/physicalhelper/port/publicshutdown/terminal checks remain.

Optional Root UI-first request admission was not added: it is optional in admission, and no safe exact actual UI observation contract was supplied. Current ordinary command qualifies noProvider HTTP baseline only; it does not claim actual UI/preflight reproduction. Root may request that bounded input before electing a UI-first diagnostic run. No synthetic prompt or model action is introduced.

Commands actually run during preparation:
- node --experimental-strip-types --test packages/opencorvus/script/skill-mount-cold-start-contract.test.ts: final ordinary-checker-pure-tests-03.log,6 pass/0fail,exit0. Earlier01/02 pass logs retained; no failed test/type attempt occurred, so no failure is invented.
- node --max-old-space-size=8192 packages/opencorvus/node_modules/typescript/bin/tsc --noEmit -p .tmp-product-iteration/ordinary-skill-checker.tsconfig.json: final03 exit0, strict=true with the ENTIRE checker, its focused test and backend src. All earlier01/02 pass logs retained. Exact config preserved as ordinary-checker-explicit-tsconfig.json, whose relative paths refer to original .tmp execution location.

Proposed ROOT-ONLY command, NOT executed, requires Root full source/diff/environment/helper/port review and fresh path admission:

```powershell
bun packages/opencorvus/script/skill-mount-cold-start-check.ts --profile ordinary --run-root C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-06/skill-mount-ordinary-01 --output specs/artifacts/2026-10-05-skill-mount-cold-start-latency/actual-ordinary-01 --port 17955
```

17955 is proposed, not observed free; the checker performs exact bind admission and Root owns process/physical review. Paths must not exist. This command does not call liveSolwrapper or stage a pair. A fast ordinary baseline still cannot prove the original Write02 preflight/UI request mix healthy; slow phase is unknown until actual diagnostic evidence. Existing fixture qualification must now be explicitly invoked with --profile fixture and retain its fixture label.

Source/test FREEZE after strict types and pure tests. Actual runtime, raw phases, real shutdown/helper/port facts, real source counts, visual UI qualification and any following latency fix remain unexecuted/Root-owned. Shared indices/record/docs integration and Git also remain Root-owned.

## Root actual ordinary HTTP admission

Root has read the complete631-line checker, all six pure contracts, exact strict config, source/default environment and physical lifecycle branches. Full repository current source-call search finds only the new pure-test import; historical recorded commands retain their original invocation. Existing installed supervisor is available, separately checked17955 has no listener, and the exact proposed run/output roots do not exist. Current source snapshot includes only frozen InstanceA predicate/tests and frozen checker preparation; no Skill/timeout/Provider/logger/UI implementation has changed.

Root now executes the exact proposed ordinary command with fresh C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-06/skill-mount-ordinary-01 and formal actual-ordinary-01 output. The checkpoint keeps ordinary HOME/config/default-project inputs, compatibility discovery disabled, no test-home/managed substitutions and no Auth/Models staging/preflight/model prompt. The mature exact-owned supervisor handles only new checker children. HTTP matrix/phases and exact natural shutdown/helper/port facts qualify this noProvider baseline only; the actual Write02 preflight/UI mix and its19.456s root cause remain unknown until evidence is obtained. Original15s timeout remains a failure, with separate60s original backend observation. Root will independently review results and physical state before deciding any performance patch or new actual UI scenario. No user service/app or window is touched; the continuous goal remains active.

### Actual initial guard failure and production-boundary repair admission

Original invocation fails before any runtime/output creation or process start at the added ancestor guard. Metadata-only inspection finds C:/.opencorvus at the drive root; its contents are not read. The independent failure receipt retains exact outcome and empty runtime/service facts. Root source audit resolves why this guard is incorrect: Project.resolveNonGitDirectoryIdentity returns worktree=directory for a fresh empty local-nonGit project; ConfigPaths.directories uses that worktree as its Filesystem.up stop, and Filesystem.up checks stop at the starting Project before walking parents. assertCanonicalProject uses the same findUp boundary. Skill explicit discovery uses only those Config.directories, while compatibility discovery is disabled. Thus C:/.opencorvus is outside the actual fresh Project source set, not a missing private-directory authorization or latency cause.

Root approves correcting ONLY the checker admission to that proven ordinary input boundary. Remove the drive-root ancestor blanket check; preserve fresh root/member creation, explicit ordinary HOME/XDG/config and no extra config env, exact system-managed/proxy guards, actual outside-owned nonbuiltin result check and noAuth/model staging. Assert actual public Project.worktree identity equals the fresh owned Project directory after startup before cold matrix; do not import/initialize a parent Project as a probe or disable project configuration. No private ancestor directory content is read, no source set is rewritten and no test-home workaround used. Add a focused positive public-project-boundary contract with actual typed wrong-worktree error, strict types and pure checks, retaining original failure. Return freeze to Root before the identical original command is rerun. This is a local checker scope bug; no production Config/Project/Skill change is admitted.

### Boundary repair preparation receipt

The earlier blanket ancestor-walk admission was a checker bug: it rejected C:/.opencorvus even though production's fresh nonGit worktree boundary does not consume it. That walk is removed entirely. Previous implementation notes describing this guard are historical failed preparation, not the current contract. Root's actual ordinary-checker-admission-failure-01.json remains unchanged; no content of the private directory was read.

Before this delta, full checker source was saved as ordinary-checker-boundary-before.ts.txt; prior pure test source is preserved in the earlier complete preparation diff. Current checker retains fresh root/member creation, ordinary HOME/XDG/config/noAuth, system-managed/proxy admission and outside-owned nonbuiltin result guard. The single existing occurrence now calls actual public GET /project/current?directory for both owned A/B before any cold Skills read. It verifies exact public worktree===fresh member through one pure ordinaryProjectBoundary function and saves safe requestID/status/directory/worktree facts. It does not import/provide a parent Project, scan ancestors or rewrite Config/Project/Skill policy.

Pure positive contract verifies exact fresh Project boundary and OrdinaryProjectBoundaryError with expected/actual identity for a wrong boundary. The first pure run failed on Node strip-only TypeScript parameter-property syntax; ordinary-checker-boundary-pure-tests-01.log is retained. Constructor fields were expressed with ordinary explicit assignments, using the same strict types and real error contract; subsequent02/final pure runs pass7/0fail. Strict whole-checker/backend/test configs are unchanged. Final boundary diff/source are ordinary-checker-boundary-final.diff.txt and ordinary-checker-boundary-after.ts.txt.

No checker invocation, production import, service/process/HTTP/runtime action, credentials/models/Provider/UI/Git mutation occurred in this repair preparation. Root must review freeze and rerun the original exact ordinary command; no deadline/source-policy change or fixture fallback is introduced.

### Root boundary repair actual rerun admission

Root reread the complete corrected checker, seven positive contracts, retained failure and strict config/output. Fresh run/output paths are still absent and port17955 has no listener. The public Project check occurs in the same source occurrence before cold matrix without a parent-side production initialization. C:/.opencorvus contents remain unread. Root now reruns the identical original ordinary command; previous pre-runtime failure remains intact. No Auth/Models, Provider, synthetic delay, deadline increase or UI automation is admitted. Actual baseline qualification and original Write02 preflight/UI-mix uncertainty remain separate.

### Actual ordinary01 explicit-model input failure and repair admission

Original guard failure was pre-runtime. After the boundary fix, actual ordinary01 ran an owned source process on17955 and public health200, then GET/project/current returned400 at config.validate: canonical ProviderModelNotFoundError for openai/gpt-6.1-sol with no available suggestions. No Skill matrix request occurred. Raw logs and exact result are preserved under actual-ordinary-01. Config initialized18ms and catalog operation210ms are this rejected Project bootstrap, not a19.456s Skills diagnosis. Public shutdown200, root63368/helper75452 naturally exit0, independent parent47108/root/helper absent and port free. No Provider generation/auth staging/UI occurred.

Root code review: config/model-reference-validation.ts collects explicit model/small_model/runtime/agent/command references and validates them through current Provider state. provider.ts modelFromState throws if that provider/model is not projected. A fresh noAuth runtime therefore cannot promise the actual authorized Sol configuration shape. Separately ModelsDev.provisionDefaultCatalog creates the sole canonical runtime/data/models.json from the bundled bootstrap even without credentials; the checker's absent-models assertion is invalid. Models-file existence is not credential staging or proof of a live available model. Original first failure precedes that assertion, so the second issue is source-qualified prospective rather than an observed assertion failure. Parent/private sources are not involved.

Root admits the smallest noAuth-baseline checker repair: ordinary config content must be empty object (no explicit model selection), preserving real default builtins/package/Config/managed/compat policy and zero Auth staging. This is explicitly ordinary fresh UNCONNECTED input; it cannot reproduce Write02 authorized Sol preflight/UI input or qualify a real model. Keep one ordinary/fixture checker and publicProject boundary, existing15s client deadline, owner/cleanup contracts. Correct metadata contract: auth must be absent; a canonical freshly provisioned models catalog may be present and is recorded only as safe metadata/provenance, not read/copy/validated as Sol. No product config/Provider/Model/bootstrap source change or fallback model is authorized. Keep actual01 raw failure immutable. Snapshot before, add focused positive ordinary input configuration contract, retain strict entire-checker types, return freeze before Root runs fresh ordinary02 (run-root suffix02 and formal actual-ordinary-02, same17955 subject to physical fresh admission). No process/HTTP/Provider/UI/credential operation in child preparation.

### Unconnected configuration and canonical catalog repair preparation

Root actual-ordinary-01 remains immutable: public Project400 ProviderModelNotFoundError was an explicit-Sol input error, no Skill GET occurred, and root/helper naturally exited. The earlier models-absent assertion had not been reached; its failure was source-qualified prospective, not an observed second failure.

Current ordinary config is the pure ordinaryConfigurationInput() returning exact empty object JSON. It selects no model and adds no fallback; ordinary profile is now explicitly fresh UNCONNECTED and cannot qualify the authorized Sol/preflight/UI configuration from Write02. Default builtins/package/managed/compat and production Config policies remain unchanged. Only auth.json must be absent. models.json is stat metadata only; its current canonical producer contract is ModelsDev.provisionDefaultCatalog (provider/models.ts:213–219), and actual provision provenance is recorded only when an existing models.dev 'provisioned bundled model catalog' log row matches the exact fresh-owned catalog path. expectedProducer and observedProvision are distinct; metadata presence alone does not validate catalog contents or projected Sol. No catalog content is read/copied and no model request is made by preparation.

Before this delta: ordinary-checker-unconnected-before.ts.txt plus ordinary-checker-unconnected-test-before.ts.txt. Final complete diff/source: ordinary-checker-unconnected-final.diff.txt / ordinary-checker-unconnected-after.ts.txt. Pure ordinary input contract positively verifies empty object; final pure Node contracts pass8/0fail. Strict entire-checker/backend/test configuration remains unchanged; initial and final logs are retained. No new failed preparation check occurred. Prior Root actual01 and boundary-checker failure remain preserved.

Root-only next command is the same canonical checker with fresh run-root .../skill-mount-ordinary-02 and --output .../actual-ordinary-02, --profile ordinary --port17955 subject to Root's independent fresh/port/owner admission. Previous suffix01 evidence is never reused or overwritten. No production source, shared index/record, process/HTTP/provider/auth/model content/UI/Git was touched in this preparation.

### Root fresh ordinary02 actual admission

Root reviewed the complete unconnected delta, positive8-test result, exact strict config and unchanged lifecycle/timeout branches. Fresh suffix02 run/output paths are absent and17955 has no listener. Root executes the canonical checker with empty ordinary configuration, preserving default package/builtins and canonical catalog provisioning with absent Auth. This remains an unconnected baseline only. Original01 Project400 and earlier guard failure stay intact. No authorized Sol/preflight/UI equivalence or original19.456s resolution is inferred.

### Actual ordinary02 canonical package-resource admission correction

Actual02 public owned Project A/B boundaries both200, first GET/skill/mounts request f7a65e72-9f4d-45f9-a713-d67d6519fa1b completed200 in168ms with balanced actual phases. Checker rejects its projection before storing observations as outside-owned. Source audit identifies missing canonical resource category: PromptProfileResolver.packageSkillFromRef produces builtin=false location=opencorvus-expert-squad-skill:// namespace/resource identity from the already prepared package snapshot; SkillMount.poolSkill preserves it with projection_source=package and source_type=unknown. This is a virtual package resource, not a private filesystem ancestor. Full default pool includes those approved built-in package resources. Root has not read a private directory or changed production input. Actual02 raw rejected outcome remains immutable;168ms is a first matrix fact, not the complete accepted matrix or original slow cause.

Root admits a focused checker category correction only: one pure current source-admission helper must classify builtin, physically contained owned root and canonical package resource (actual projection_source package and parsed exact current resource protocol), preserving all other outside-owned/remote failures and never resolving virtual URI as a disk path. Reuse current public resource identity definition/producer; no general allowed URL/unknown source exemption or source-set rewrite. Record safe counts/category/actual request identity and time before admission, so a true category rejection retains its own nonsecret observation. Positive typed rejection tests and package resource contract plus full strict checker types; save before and complete diff. No production/config/Skill change, file/read/HTTP/process/UI/Provider/credential operation in child preparation. Return freeze; Root reruns fresh ordinary03 paths on independently free17955. Original15s transport and bounded backend observation remain unchanged.

### Canonical package-resource category repair preparation

Root actual-ordinary-02's ProjectA/B200 and firstmatrix200/168ms remain immutable. That first result was rejected before checker acceptance; it did not qualify the full matrix or original19456ms source cause. Missing category was the sole producer PromptProfileResolver.packageSkillFromRef (prompt-profile-resolver.ts:2340–2346): builtin=false, canonical opencorvus-expert-squad-skill URI, projection_source=package. This is not an outside-owned filesystem path.

The same checker now has one pure ordinarySkillSource classifier for builtin, contained owned filesystem, and exact parsed package resource. Package acceptance requires actual projection_source=package and exact protocol, nonempty encoded namespace/resource segments and the sole canonical sha256 query shape; reconstruction must equal the producer's encoded URI. The immutable resource digest's declared syntax is part of that identity, not a mutable-source checksum acceptance gate or content verification. All other outside paths, remote URLs, malformed package URI or matching URI with default projection throw OrdinarySkillSourceError. No unknown-source blanket exemption, arbitrary scheme allowance, disk URI resolution or pool filtering is introduced.

Owned filesystem source first has lexical containment checked by path.relative; only then metadata realpath is taken and classification repeated against physical owned root. Virtual resources never enter filesystem resolution. Matrix's safe source/risk/counts, actualrequestID/status/timing are recorded before source admission; a rejection retains its explicit sourceAdmission=rejected/type and partial accepted category counts as well as complete safe pool counts, and the real original typed error propagates. This prevents the previous missing-observation category failure.

Before delta: ordinary-checker-package-before.ts.txt and ordinary-checker-package-test-before.ts.txt. Full final diff/source: ordinary-checker-package-final.diff.txt / ordinary-checker-package-after.ts.txt. Positive contracts cover all three accepted categories, wrong projection, outside filesystem, remote URI and malformed package identity as exact typed errors. Final pure Node tests pass9/0fail; strict entire-checker/src/test configuration unchanged. Initial and final pass logs retained; no new failed preparation check occurred. Previous actual01/02 failures stay unchanged.

Source FREEZE pending Root complete review and strict final receipt. Fresh ordinary03 run/output paths and independent17955 admission belong to Root. No production source, canonical checker main/import, filesystem runtime creation/read, HTTP/process/UI/Provider/credentials/models/Git or shared-index/record operation occurred in this preparation; only source/test/independent plan/evidence files changed.

### Root fresh ordinary03 source-category admission

Root reviewed the full classifier and unchanged sole package-resource producer, physical containment branch, pre-admission safe observations, nine positive contracts and strict whole-checker final result. Exact canonical immutable URI syntax is resource identity, not a mutable-source digest gate. Fresh suffix03 roots absent and17955 independently free. Root now executes the same canonical unconnected checker with those fresh paths, retaining all earlier original failures. No Provider/auth/actualUI qualification is inferred from this matrix.

### Actual ordinary03 warmed admission and cancellation qualification repair

Actual03 serial completed all seven matrix reads (first/warmA,firstB,A+A+B,refresh) with accepted complete pool6builtin+1canonicalpackage-resource and balanced phases. Restart then naturally completed its candidate before cancellation; checker correctly failed cancellation qualification rather than claim an abort. Both real roots/helpers naturally exit0 and ports free. Original results stay immutable. The added publicProject boundary probes preceded first matrix on both occurrences and ran real InstanceBootstrap, whose Config/capability validation initializes Skill state. Thus these are first matrix AFTER Project bootstrap, not original cold Skill admission; the same probe invalidated the cold cancellation opportunity. The admitted guard implementation preserved privacy but warmed the state it meant to observe. This is a checker ordering bug, not evidence of a product cancellation failure or latency fix.

Root admits moving the same publicProject boundary confirmation after matrix/cancel observations within the exact owned occurrence; known production fresh-nonGit code and fresh empty owned environment already prove no ancestor consumption. No parent bootstrap probe, extra endpoint, artificial delay, cache reset, test flags or product policy change. Health and metadata remain before reads; Skills is the first Project request. Verify actual A/B boundary after the real observations before success. Keep caller cancellation qualification strict and failures immutable.

Source also shows fact.cancelOutcome stores the read return including the new completeProjection used for in-memory cold/warm comparison. Actual03 therefore persists only this public built-in/default package body, no private source/auth/model bytes; it is an unintended bulky report boundary. Record only actual outcome/requestID/safe projection counts for cancel, retaining fullProjection solely in memory. Do not edit original03 raw files or invent a missing saved request. Snapshot delta, preserve positive contracts/full strict types and return freeze; Root runs fresh ordinary04 on independently free17955. No production/process/UI/Provider/credentials/source-set changes in child preparation. Actual original Sol03 source/UI diagnostics remain separately qualified by their real authenticated/preflight input.

### Cold ordering and safe cancel report preparation

Root actual03 is immutable: serial seven matrix200 results and6builtin+1package pool were accepted, while restart cancellation was not exercised and honestly failed. It is not qualified cold: public Project probes warmed InstanceBootstrap Config/capability/Skill before the matrix. The same existing public A/B boundary block is now moved after actual matrix/cancel observations within the occurrence, before successful status; health and metadata remain before the first Project/Skills request. Strict cancel outcome remains unchanged, so if cancellation naturally finishes the occurrence fails and does not claim boundary/cancel success. No extra request, reset, artificial delay, policy change or parent bootstrap probe is added.

fact.cancelOutcome now explicitly selects only actual outcome/requestID and safe projection-count value. read return's completeProjection remains solely in local memory for real full cold/warm comparison. No built-in bundle content is saved via the cancellation return in future resultJSON; original03 public default body is retained as instructed, not retroactively edited.

Before/delta/after are ordinary-checker-cold-order-before.ts.txt, ordinary-checker-cold-order-delta.diff.txt, ordinary-checker-cold-order-after.ts.txt. Existing nine pure positive contracts remain unchanged and pass9/0fail; strict complete checker/backend/src/test config unchanged. Raw original and final preparation logs preserved. No checker main, canonical import, runtime/process/HTTP/Provider/UI/auth/models/Git/shared index/record operation occurred. Root owns fresh04 actual runtime and remains responsible for whether phases really show cold initializer and actual cancellation.

### Root actual04 admission after ordering review

Root read exact cold-order delta, safe selected cancel report, nine passing contracts and strict full-checker receipt. Fresh suffix04 paths are absent and17955 has no listener. Same Skills-first unconnected checker now runs once; it must actually exercise cancellation and balanced phases or retain failure. All original01/02/03 evidence remains truthful. No authenticated Sol/UI/source-pool equivalence or original timeout resolution is inferred.

### Root truthful unattributed initialization metric correction

Independent actual04 source/phase review confirms timing.startupInitializations currently counts http.requestID=null, including the later public Project probes. The diagnostics producer explicitly labels this startup-or-unattributed; null does not prove startup. All427 span pairs and10accepted+1cancel are valid, but this new report field's label overclaims its meaning. Full current source search finds one checker producer; historical raw reports remain immutable. Root admits renaming that single current report key to httpUnattributedInitializations, preserving its exact predicate/count and original diagnostics/requests/lifecycle. No compatibility alias, metric reset, behavior change, phase guessing or timing relaxation. Existing positive contracts/full strict types and a fresh actual05 canonical run qualify the current report. Record prior actual04 legacy name meaning in README/manual review without rewriting original raw output.

### HTTP-unattributed label preparation

Current sole timing producer key renamed to httpUnattributedInitializations, retaining exact predicate row.http?.requestID===null and same count. No alias/fallback or change in phase, request, timeout, execution or cleanup semantics. Root current-source search confirmed only this producer; actual04 raw startupInitializations and independent historical interpretation remain unchanged.

Before/delta/after: ordinary-checker-label-before.ts.txt, ordinary-checker-label-delta.diff.txt, ordinary-checker-label-after.ts.txt. Original nine pure positive contracts rerun unchanged, pass9/0fail. Same strict entire-checker/backend/test configuration used for explicit types. Preparation logs retained, no runtime invocation or shared record/index/Git changes. Root owns fresh05 actual current-report qualification and checkpoint commit.

### Root actual05 current report qualification

Root reviewed sole report-key rename to httpUnattributedInitializations, unchanged exactnull predicate, retained positive9-test and strict full-checker checks. Fresh suffix05 roots absent and17955 free. Root executes current canonical checker once to qualify real current output, preserving actual04's valid request/phase evidence and legacy label caveat. No behavior or timeout changed. This noAuth input remains separate from actual authenticated Sol03 UI/preflight, whose three real Skills reads were283/267/242ms and did not reproduce the original19.456s failure.
