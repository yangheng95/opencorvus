# Dependabot upgrades and test compatibility

## Recall

2026-10-13 07:49（Asia/Shanghai）完整资格确认：run38312512597已success，verify、dependency audit、service tests、Linux/macOS/Windows完整unit和最终CI passed全部success。三个真实job日志各592条文件级DONE，全部exit=0；日志位于.scratch/dependabot-upgrades/full-{linux,macos,windows}-38312512597.log，公开运行与job身份见artifact README。旧run38302496808的Windows也已跑完592文件，其5个失败与旧Linux/macOS完全相同，没有新增类别；不混入新轮成功证据。当前隔离HEAD=09592d963相对已测dced22e42只有本记录文档差异。

合并前分析/计划：main=524de3220，期间6个已推送并行提交修改来源预览、搜索行列及编辑器定位；其实现路径与3b0562c97修复路径交集为空，依赖图未变。已读取366/367/369交付证据，保留其各自验收范围（不把别的任务部分scope升级为完整成功）。main另有6个未提交文件，涉及file-reference映射和相关spec索引/07-panel，已保存完整unstaged/staged binary patch、status和HEAD到.scratch/dependabot-upgrades/main-before-sync-20261013并逐项审查，与本任务交付文件不重合。先在现有隔离分支合入最新origin/main，跑共同会话/Provider及新增source数据合同聚焦回归和正式hooks；再刷新main状态，普通合并或fast-forward仅引入本任务已验证差异，保留全部并行内容。完整待推送集合只允许本任务提交/合并，fresh fetch/merge后推送main。确认本地main和origin/main都包含交付、记录提交且无本任务未提交修改后停用自动跟进。

最新远端验收对象已更新为[完整run38312512597](https://github.com/yangheng95/opencorvus/actions/runs/38312512597)：workflow_dispatch、codex/dependabot-upgrades、实际head=dced22e425cc9ae81866778daac370b5e1efc715、test_files为空；读回title=CI而非selected，状态in_progress。修复提交3b0562c97已与最新origin/main普通合并为dced22e42，合并未改变packages/opencorvus任何文件；冻结安装、1732包无漏洞及全部正式push hooks通过，已正常推送同名远端分支，upstream改为origin/codex/dependabot-upgrades。自动跟进dependabot-main已更新为这轮身份和相同完整成功条件；旧38302496808的失败仍为历史证据。main工作树未由本任务推进，新恢复修复尚待完整三平台资格。本条记录在测试head之后只增加文档，最终合并时必须检查实际差异，不能把文档推送当作新的代码验收。

本地修复验收已完成：同一原runner的ci-fixes-final.log六文件51测试全部通过，覆盖本轮五个失败文件和SDK错误分类；其中staggered dispatch完整18测试/286断言，四个原超时分支分别约4–5秒并核对重开数据库的同一Turn决策。shared-recovery-regression.log八文件59测试全部通过（LLM activity与前组重叠，不能相加称为一次完整运行），包含真实副作用拒绝重放、Host fault、Provider semantic error、跨进程活性/恢复、Mission extension和交互产物schema。根8项typecheck、docs:check与architecture-index通过。早期诊断及第一次不完整修正的failure日志保留，最终各文件exit=0为本地依据；远端三平台完整资格仍未满足。下一步提交修复、在隔离分支merge最新origin/main、冻结安装及正式hooks后推送同一codex分支并启动新的完整CI；main工作树尚未由本任务推进。

2026-10-13 05:25（Asia/Shanghai）最新：固定完整run38302496808的Linux/macOS均592文件结束，587通过、5文件失败；Windows仍运行。失败文件为session-loop-provider-tool-input、mission-streamed-recovery、orchestrator-streamed-dispatch-settlement、session/streaming-text-prefix和capability/tool-definition-budget。不满足main同步条件，隔离分支8ee20326d继续调查，main现有并行改动保持原样。原日志保存在隔离工作树.scratch/dependabot-upgrades/full-{linux,macos}-38302496808.log；旧成功聚焦结果不能替代本轮失败。后续修复仅推送已授权codex/dependabot-upgrades供CI验证，完整通过后才收敛main。

本轮实施前分析及计划：两平台同一OpenAI请求中的自由参数schema由propertyNames/string+additionalProperties:true变为additionalProperties:{}，须核对SDK7官方序列化的语义并以实际流式请求和输入验证证明，而非保留旧结构字符串；Mission定义预算32257超过既有32000，需查明具体定义增量和当前公开schema，不能直接放宽预算。网络中断真实HTTP用例返回stop，实际错误/请求及持久化状态尚未知；Mission最终assistant unhealthy/inactive，具体原因尚未知；派发四例等待claim再发送finish，与SDK7在model-call-end后执行tool的时序构成直接环，但还需实际状态证据。先增加聚焦诊断，横向审计共同LLMActivity/SessionProcessor及Task/Mission/普通Session的正常、终态、重试重启、串并行和Project隔离，再决定生产或夹具修复。保持原预算、共享调度、单一状态与所有有效正向合同，不增绕行；五文件及共享相关原checker通过后，对最终提交重新运行空test_files的三平台完整CI。文档、调用点、持久化、工具投影及交付风险随实际根因更新。

最新用户要求：“测试没问题再合并到main worktree”。本轮先完成最终升级版本的三平台完整测试，成功后才由本任务推进本地main；测试尚未确认时不再向main交付新修复。核对当前本地main=c77213c22，已由并行合并包含3897754c8升级实现；本任务工作树c6514efff与它仅差后续验收证据。已有自动run38301349049仍在执行；38301773020只是docs scope成功，不能替代完整unit。此前多轮自动run确实被后续main push的cancel-in-progress取消，故采用现有workflow_dispatch入口固定实际head的新完整运行，其concurrency按run_id隔离，不修改CI范围、超时或测试集合。启动后读回head与空test_files输入并保存run身份；后续main变化不改变这轮测试对象。通过后先保存、审查main现有未提交差异，再仅合并已验证提交；不覆盖并行工作，不把docs成功、取消或聚焦测试当作全量通过。

已启动独立完整运行[38302496808](https://github.com/yangheng95/opencorvus/actions/runs/38302496808)：workflow_dispatch、head=c6514efff587a4185a3d7383abc473e19da75b6e、test_files为空，读回身份一致。已在本对话创建自动跟进`dependabot-main`，每10分钟核对这轮真实结果，完整成功后才安全同步本地main并停止跟进；进行中无重要变化时不重复汇报，失败留在隔离工作树分析修复。计划/跟进记录提交暂保留本地，待用户要求的测试条件满足后再按规范收敛推送，不在等待期间继续推进main。自动跟进需要本机与Codex桌面应用运行。

用户原始要求：“在新的worktree升级dependbot给出的pr，测试问题被修复”。范围确认：处理全部10个开放PR（38、37、36、35、34、32、28、25、24、20）。不委托、不发布版本、不创建Release/tag或新PR。起点origin/main=c4b8d5e58，独立工作树`C:/Users/hengu/.codex/worktrees/dependabot-upgrades/opencorvus`，分支`codex/dependabot-upgrades`跟踪origin/main。主工作区的SourceParts/i18n/CSS及spec索引和CI调查存在其他未提交修改，必须保留；独立安装依赖，禁止操作用户应用或共享node_modules。

验收：十项升级在当前单一manifest/lock图中实际生效；真实安装、当前AI runtime checker、类型检查、生成固定点、无过滤依赖审计及聚焦非UI正向行为验收通过；界面依赖在隔离开发页面截图人工检查，不新增或运行UI自动化测试。记录原PR失败日志与当前结果差别。修改必须提交，fresh fetch/merge及审查全部待推送提交后推送到主交付来源；远端完整结果与本地聚焦结果分别报告。

已读：AGENTS.md、根及后端/Overlay/Web manifests、test.yml、Dependabot配置、pre-push、check-ai-runtime.ts、generate.ts、后端isolated test runner、Provider bundled/LLM wrapper/repair/session调用、ACP入口、06-provider架构及2026-10-12-ci-workflow-dependencies调查。已全仓检索十项依赖定义、调用点、同语义实现、锁图、架构和历史决定。官方资料：AI SDK 7迁移说明及实际LanguageModel类型/SDK适配实现、ACP官方CHANGELOG、setup-python v7说明和npm精确版本依赖元数据。没有委托反馈。

## 分析与影响面

### 完整CI失败的修改前证据（2026-10-13）

本地三文件原runner复现全部三类失败。HTTP真实断流后assistant持久化APIError(statusCode=200,message=Failed to process successful response)，只有一次请求及已接收前缀；SDK5.0.59的response-handler.ts将reader.read错误保存到APICallError.cause，旧分类器只读外层message，所以已知network被归unknown终态。修复在共享classify中沿SDK typed cause继续分类，仍先尊重明确HTTP错误、外部取消与Host fault，不以isRetryable布尔值泛化重试，并防cause环。真实HTTP原回归验证两次请求、一份完整答案；聚焦合同覆盖包装network、Host错误、semantic错误及HTTP优先级。Task/Mission/Session共用SessionProcessor→withLLMActivity；retry cleanup仍由原attempt scope区分已开始tool、causal message与普通message，已提交tool继续禁止重放。没有新调度队列或唤醒实现。

Mission真实数据库/HTTP transcript表明calls止于panel_query_task_artifacts，目标artifact无匹配，末条assistant的UnknownError明确Missing real catalog reference，producer只到developerStep=1。原fixture刻意丢弃finish再等待artifact；SDK7仅在model-call-end执行tool，所以artifact尚未产生。发送真实finish后再等实际持久化commit并注入断流；保持一次原始产物、continuation和独立tester的后续验收。四个staggered dispatch fixture也在finish之前await firstClaimed，形成同类环；将完整模型调用先交付，claim/release故障协调放到测试参与者，成功派发分支的no_action与dispatch在同次完成的模型调用中声明，验证实际并行冲突；全部派发失败分支在读取失败结果后的下个Provider step重新决策。Task-root相同assistant Message跨step从持久化decision重建唯一ToolTurnExecutionCoordinator，故仍验证同一Turn/ingress的成功兄弟保留与失败claim释放、重开数据库后同一决策。原Task/Session跨进程恢复、Mission/Project隔离检查保留并回归。

从npm正式4.0.38源码和安装5.0.59对比发现旧addAdditionalPropertiesToJsonSchema无条件把map值schema改成false；新版保留真实map值schema，包含交互产物多个JsonScalar map，因此定义体积增加。新版输出与当前Zod经典toJSONSchema实际一致，不能回退生成器丢失map合同。保留所有字段/值域和32000预算，压缩唯一交互产物工具描述中重复措辞，保留19种renderer选择语义；用原真实definition checker及artifact正向schema/materialization验收。旧propertyNames+false修补分支是修复旧SDK丢失unknown map的兼容逻辑，现在去除，序列化测试改为SDK7准确schema与实际非空map校验。两条既有非流式序列化测试同时改为真实流式SDK入口，保留实际wire参数检查。

1. PR基于不同旧main，失败不能直接归因升级。36的实际verify日志为生成的expert-squad版本未收敛，audit为此前五项漏洞；当前main已有对应修复。34的实际typecheck日志明确为TogetherAI新包依赖的`serializeModelOptions`在根override固定的provider-utils4.0.38缺失。必须审查当前图并重跑真实checker，不能照搬旧lock文件。
2. TogetherAI3.0.48要求Provider4/provider-utils5/openai-compatible3，provider-utils5.0.56要求Provider4.0.24；当前应用ai6、Provider3、utils4以及check-ai-runtime固定旧主版本。数据流根因为只升级叶包同时将根公共依赖强制到旧主版本。解决需要同一AI SDK 7依赖图和当前调用契约迁移，不能保留旧override或另建host兼容层。SDK官方本身接收V3模型的能力属于成熟工具链；本项目不新增平行实现。社区Provider的实际peer/API支持尚须安装与流式行为证据确认。
3. 影响面包括共享llm/api流式wrapper、Provider中间件与自有Copilot适配、Session流处理/工具repair/usage、所有bundled Provider、构建和类型checker、测试Provider及文档。仅流式交互；用户消息、控制状态、模型目录、凭据与真实Provider路由不能被迁移改变。生产调度没有新观察证据；已知主分支Windows的managed-parent和mission-acceptance失败仍保留，若本轮复现需按共享机制横审，不能归为偶发。
4. ACP升级0.14.1→1.4.0需核对JSON-RPC（JavaScript Object Notation远程过程调用）入口、方法名称、Session参数和流式通知，更新中英文版本说明并做真实双端连接契约。GitLab6.20.1保留Provider>=3/utils>=4公共范围，验证注册/初始化及模型请求。
5. CodeMirror6.43.13、Geist5.3.0、Timeline8.5.4影响真实编辑器、字体与时间线；notification2.5.1影响原生传输权限接口；Astro checker0.9.10影响官网检查工具，setup-python7保持原公开inputs/outputs且使用ESM（ECMAScript Modules，模块格式）。须修workflow正向版本预期。无需应用版本升级与发布日志，因为没有发布。
6. 风险：SDK7公开参数、生命周期事件、file消息与工具输出变化；第三方Provider尚未迁移；非UI测试fixture可能表达旧契约；独立worktree全新依赖可能暴露运行器缺陷。逐项读取定义与调用后修改并用现有checker证明。实际外部Provider凭据验收未获授权，不复制凭据、不宣称联网模型验收。

## 实施顺序

1. 保存本方案与两级索引；准备隔离Bun1.4.0运行时，不修改用户全局版本。
2. 更新十项manifest/workflow及同一AI SDK 7公共图；重新生成Bun锁图，审查全部节点及peer、patch和有效完整性。先frozen安装，再运行checker/typecheck获得明确API差异。
3. 按官方当前契约迁移单一生产入口及其调用/聚焦测试，删除触及的过期负向断言或UI自动化；更新06-provider事实来源和ACP文档。
4. 原入口验证流式请求、工具参数/结果/usage和ACP真实连接、workflow合同、审计、生成固定点及必要构建；隔离开发模式`/ui`截图人工检查界面依赖。
5. 汇总实际证据、文档检查、正常提交，fresh merge upstream后审查并推送主交付来源；检查真实远端运行。没有证据的要求明确标记未达成。

## 进度与验证

确认系统Bun为1.3.14，隔离npm Bun1.4.0已可运行；这是工具版本修复，不更改用户全局运行时。下述续记按实际结果更新。

## 实施证据与当前 Recall 续记

当前十项已进入manifest/lock：CodeMirror6.43.13、Geist5.3.0、notification2.5.1、Timeline8.5.4、Astro checker0.9.10、ACP1.4.0、GitLab6.20.1、TogetherAI3.0.48、provider-utils5.0.59、setup-python7；公共图为ai7.0.138/Provider4.0.27，官方Provider、OpenRouter3.1.0及ai-gateway4.0.1一同升级。utils采用当前SDK精确依赖5.0.59（满足PR5.0.56升级目的）。恢复原Zod4.4.3，验证表明4.6.7升级并不能解决工具类型推断且会将额外标准schema元数据带入OpenAPI；没有交付该无关升级。

SDK调用迁移为stream、onEnd/onStepEnd、instructions、telemetry及repairToolCall；usage读取当前组件字段。中间件使用V4，成熟SDK原生处理V3模型，自有Copilot和社区Venice保持单一实现，没有新增host兼容层。Tool执行Context按新公共契约明确为空对象；带可选字段的inline Schema在SDK7重载中失去参数推断，本地最小编译probe复现，直接从唯一输入schema声明z.infer参数修正，不升级TypeScript或放宽检查。六份Copilot工具文件只保留生产消费者实际调用的args/input/output schema，删除全仓没有引用的工厂及其专用类型（合计约400行）。

当前原workflow两文件22测试/213断言通过；完整工作区类型检查8任务成功；Overlay真实构建与renderer surface checker成功；无过滤audit无漏洞。独立开发服务19633/UI-runtime/UI-project已启动且1280x720桌面主页/设置人工查看，尚未完成CodeMirror和Timeline对应区域视觉资格。没有使用用户正在运行的应用或原node_modules。

新增dependabot-runtime-contract经原isolated入口4测试/20断言通过：生产Provider loader→本地HTTP流实际验证TogetherAI、Copilot、Venice的精确模型/指令/image字节与Session usage；官方ACP字节流→真实HTTP后端验证初始化、模型及variant配置选项、list、fork、resume和数据库parent身份。ACP1.4的list/resume已稳定，fork仍是unstable_forkSession。该ACP范围明确为配置禁用MCP的项目；初始测试使用未绑定host授权的Computer配置，/command启动失败已保留为测试前提问题，不据此修改MCP生产能力或宣称Computer端到端验收。RPC（Remote Procedure Call，远程过程调用）早期伪失败还复现Bun1.4的toMatchObject对实际对象写入asymmetric matcher；改为直接类型/数组正向合同，保留原API返回对象供下个真实请求使用，没有生产补丁。

原Provider policy/name/usage/request association4文件16测试通过，含真实并发和多步HTTP；原stream error/compaction/Session tool authority/multistep4文件30测试通过。对本次触及的测试删除旧的无完成字段/无旧Runtime/无受保护文件/不抛错/无竞争lease/notice不等于前值等负向断言及专用变量，保持相邻真实输出和错误类型；没有检索到这些非界面路径中的UI自动化。23文件当前原回归运行已至processor-producer-boundary，前13文件成功，但该文件第二例在beforeEach/afterEach90秒超时，不能包装为全部通过。新增4测试另行独立通过，不混成一次完整通过。

新的终态异常立即按共性共享机制审计：读取processor-producer-boundary原fixture、LLMActivity retry/cleanup、SessionProcessor tool producer admission与Instance/Session owner释放；横向核对Task/Mission/普通Session入口、正常/错误终态、重试/重启、串并行和Project隔离。先取得明确阶段、exact owner、持久化Tool/Activity/Control及真实超时输入输出证据，再修改；不增大deadline、跳过有效测试或吞清理错误。原主分支的Windows managed-parent/mission-acceptance残余失败与本次新复现分别记录，尚未证据排除共享根因。

早期运行已收尾，原失败日志保留。所有原始日志在工作树忽略目录.scratch/dependabot-upgrades；最终状态以下述记录为准。
### Producer-boundary 根因更正（修改前）

读取实际SDK7工具执行transform发现其只在model-call-end且finishReason允许时执行已收集的Tool call（dist/index.js约7896行）。原第二例的MockLanguageModelV3仅输出stream-start与tool-call，没有finish/usage；同时consumer start-step hook等待effect.promise，该promise只能由未获模型终态的Tool execute兑现。因此“已提交操作”标题与事实不一致，是旧SDK6夹具的eager执行假设，不是生产一次提交后丢终态。独立故障子进程16208的持久化库只含一对真实fixture User/Assistant及一个step-start，Assistant未完成；provider_activity_outcome空，没有Tool Part或实际写入，符合未达到producer commit的代码路径。读取只限定该新worktree当前测试根；旧PID复用留下的另一空根不作当前证据。

横向核对SessionProcessor工具执行标记与cleanupAttemptBeforeRetry、共享LLMActivity attempt/abort/cleanup、SDK7允许工具执行的model终态，以及Task/Mission/普通Session的相同SessionProcessor路径；其他真实HTTP多步/压缩/Task/Mission重启与多个Project隔离已在本轮原测试入口通过，说明当前新失败没有工具提交、丢唤醒、重启恢复或跨Project事实。不能用这些通过替代本故障重跑，但允许将有明确代码/持久化证据的无终态夹具修正为当前契约。

最小修正：给该模型真实finishReason=tool-calls与明确usage；消费者阻塞点放在tool-call回调、实际Part admission之前，以真实执行文件提交后再验证150ms idle→unsafe retry和一次写入；不更改生产重试、队列或截止预算。finally释放其自有barrier并取消自有controller，防止失败测试将清理hook永久留在await。生产注释改为准确的“可以在消费者admit之前执行”，不承诺无条件脱离consumer或缺模型终态也执行。原连续四个后续hook失败来自同一未释放fixture，旧运行保留failure并终止已明确绑定本工作树的测试子进程后继续其他选定文件，修正文件单独重跑。

### 最终本地验收续记

修正边界文件独立10测试/39断言通过。原runner同轮回归selected-tests-final.log结束码0：23次文件执行（usage-normalization被选单重复一次，22个不同文件）、200测试、0失败。未把原失败轮与不同轮结果相加冒充一次成功。

critical-build.log结束码0：Windows x64原生后端包构建并执行真正首次启动验收，sessionsCreated=4、persistedAcrossRestart=2、realProvider=false。Overlay实际构建、renderer surface checker通过。官网Astro checker先缺少被忽略的downloads/latest.json；依据当前真实GitHub Release元数据运行CI同一生成器补齐隔离构建输入后，102文件0错误、0警告、21提示。没有发布官网。最终frozen安装成功，audit-final.log检查1732包，无漏洞。根生成器generate-final.log成功，公开API只发生模型目录枚举说明变化，没有额外Zod/模板/版本变动。官网build产生的无关ZIP目录摘要元数据差异经保存审查后恢复精确文件，不将独立构建机器的归档摘要混入依赖交付。

桌面人工验收已完成：19633/ui中的真实匿名Project文件经CodeMirror编辑并点击Save，保存后截图确认；人工输入请求经受控本地HTTP流Provider、实际SessionLoop和publish_interactive_artifact发布Timeline，实际点/范围项目、Zoom in与Fit all显示正常。截图与范围说明见[界面证据](../../artifacts/2026-10-13-dependabot-upgrades/README.md)。未使用UI自动化、外部模型凭据或用户应用；原生OS（Operating System，操作系统）通知发送尚未实际验收，notification升级已通过类型与应用构建。

扩展GitLab真实本地HTTP验收发现其OpenAI聊天传输主动把User内容过滤为text（6.20.1 dist/index.js约2006行），原声明的通用图片预期不适用于该适配器。npm正式6.9.3同路径约1813行也主动过滤为text，确认不是此次升级引入；限定GitLab为明确text输入的流、指令、API模型和usage合同，其他三种Provider仍验证图片字节。ACP补充真实RPC invalidParams合同（无效模型目录项及未声明支持的MCP-over-ACP）已通过，最终新文件须重跑后记录。

远端main在本任务期间新增4个已授权其他交付提交，fresh fetch已发现，提交后必须merge并复核；主工作区现有dirty文件全部保留。尚未完成本任务提交、push与真实远端检查。

最终叶包审查发现旧root override仍将AI Gateway4声明的Fireworks3强制到Fireworks2，虽公共Provider/utils节点版本正确，叶实现仍声明旧V3/旧utils；另外Gateway和bundled分别安装Perplexity4/5。根因与原TogetherAI问题一致：旧override未随消费者公共合同收敛，原checker只核公共节点不能证明所有叶包与这些override相容。修改前核对npm正式Fireworks3.0.71依赖为Provider4.0.27/utils5.0.59/openai-compatible3.0.68，Gateway helper直接复用createFireworks且内部LanguageModelV4；将Fireworks升到3.0.71、Perplexity统一到已验证的5.0.11，保留原单一override配置面，并加Gateway helper实际流式正向测试。需重新冻结安装、类型checker与审计。

runtime-leaf-verified.log最后6测试/30断言通过，含GitLab本地direct-access与proxy实际HTTP流、Gateway的Fireworks helper与ACP typed invalidParams。最终frozen-leaf-final.log安装成功、audit-leaf-final.log检查1732包无漏洞。删除最后三项触及的负向空数组断言后，原LLM activity/Project Memory两文件38测试通过，当前typed credential终态、受保护Memory错误等正向合同保留。人工/后端范围与原始runner逐文件结果已保存到artifacts，后续不会依赖未跟踪scratch日志才能复核。

typecheck-leaf-final.log：当前最终依赖图与schema参数修正后8/8任务成功；API生成器固定点和根docs/architecture checker已通过。下一步提交、fresh merge origin/main及正式pre-push hooks；远端结果仍待核实。

## 交付与远端验证

实现提交`1fbad2847`，fresh fetch后普通merge最新main为`2ccf6a76d`；没有冲突，没有rebase或force。全部待推送提交只有本任务实现与该merge，其他4项交付已在upstream。正式pre-push的8任务类型检查、路由、文档、18控制owner/22获取点、18架构文档、10package拓扑、发布变更拓扑、1140模块/5813边/4真实导入、凭据扫描0命中全部通过。`git push origin HEAD:main`成功，远端CI（Continuous Integration，持续集成）[38298767867](https://github.com/yangheng95/opencorvus/actions/runs/38298767867)开始运行，尚未声明成功。最后公共合同检索补齐中英文models页的旧ACP setter引用。

push提示的4条GitHub Dependabot漏洞已读取真实alert metadata：rand/glib的两条位于`packages/overlay/src-tauri/Cargo.lock`，另两条属于历史before/Cargo.lock证据副本，全部Rust生态；不是本轮10个Bun/Actions升级，也不由bun audit覆盖。没有修改这些既有Rust公共图或历史证据，不能把Bun审计0漏洞表述为全部GitHub告警清零。

### 同一PR目标刷新 Recall

主交付后Dependabot在2026-10-12 19:39 UTC刷新同一PR37/34为CodeMirror6.43.14和TogetherAI3.0.68，base=2ccf6a76d。实际PR差异仅各自manifest/lock版本；npm元数据确认CodeMirror仍依赖state^6.7.0，TogetherAI依赖Provider4.0.26/utils5.0.58/openai-compatible3.0.67，当前统一override已满足。同批其他PR原目标不变，38/36/35已由Dependabot自动关闭。用户范围是全部十个PR，故在同一工作树处理这两项刷新，不增加新PR或另建事实源。修改前已读取两份真实PR diff与正式npm依赖：更新精确版本与锁图，frozen安装/audit；原六项传输检查、Overlay构建及新版CodeMirror真实编辑保存截图；提交、fresh merge、正式hooks后推送并以新code CI为准，原CI结果不冒充最终版本结果。

最终升级目标（以manifest和冻结锁图为准）：

| PR | 依赖 | 最终版本 |
| --- | --- | --- |
| 38 | actions/setup-python | 7 |
| 37 | @codemirror/view | 6.43.14 |
| 36 | @ai-sdk/provider-utils | 5.0.59 |
| 35 | gitlab-ai-provider | 6.20.1 |
| 34 | @ai-sdk/togetherai | 3.0.68 |
| 32 | @tauri-apps/plugin-notification | 2.5.1 |
| 28 | @astrojs/check | 0.9.10 |
| 25 | @agentclientprotocol/sdk | 1.4.0 |
| 24 | @fontsource-variable/geist | 5.3.0 |
| 20 | vis-timeline | 8.5.4 |

runtime-refreshed.log六项/30断言通过；frozen-refreshed.log与audit-refreshed.log结束码0、1732包无漏洞。首轮远端38298767867的verify及audit成功，包含真实Linux原生首次启动；三系统完整unit及service尚未完成，最终刷新版本必须单独跟踪。

overlay-refreshed.log实际构建1m22s、renderer surface checker通过；重新启动本任务独有19633开发服务后，真实CodeMirror6.43.14键盘编辑并点击Save，unsaved标记消失且保存截图人工确认，截图已收入同一artifact目录和索引。仅关闭自己的临时页面及服务。最终三系统完整unit尚未确认完成。

### 最终交付状态

刷新版本提交`3897754c8`已正常push到main（正式hooks再次全部通过），本任务分支相对其upstream没有待推送实现提交。最终版本CI为[38300113046](https://github.com/yangheng95/opencorvus/actions/runs/38300113046)，verify、dependency audit与service tests实际成功；verify包含全部生成固定点、8项类型任务、22个workflow合同测试及Linux x64真实首次启动（4个Session、2个重启持久化、realProvider=false）。日志摘录和正式push结果已收入[同一证据目录](../../artifacts/2026-10-13-dependabot-upgrades/README.md)。初轮38298767867后被新code run取消，不作为完整全量成功。

已完成十项升级内容的统一manifest/lock、SDK7/ACP迁移、原失败工具夹具根因修正、聚焦正向验收、手工截图、提交与主交付推送。未确认的要求：最终Linux/macOS/Windows全量unit仍在GitHub后台执行；没有最终失败日志或失败根因，不能宣称三平台全量测试通过。用户原工作区已有SourceParts/日志/说明等并行改动全部保留，不在其中覆盖文件；期间main再次收到已授权的SourceParts披露动作与QA交付，最终证据提交前按同一fresh merge规则收敛。工作树保留为干净可审查checkout，其交付事实来源为origin/main。未创建Release/tag/新PR，也未手动写入原PR的状态；Dependabot已自动关闭38/36/35/34/37，剩余旧PR的目标版本均已包含在main。

最终状态更正：38300113046的三平台unit后因后续main更新取消，aggregate因此失败，不是已经获得单元测试通过；verify/audit/service已完成成功的事实保持。并行SourceParts更新已收敛，证据合并提交`31d2cea1e`已push，最新main运行[38301349049](https://github.com/yangheng95/opencorvus/actions/runs/38301349049)继续执行。既有CI scope只将spec/docs的`.md`当作docs；本任务保存的真实`.txt`检查日志也触发code scope，故证据push启动新的完整运行。这是实际配置的cancel-in-progress行为，不是生产Task/Mission调度故障，也不修改scope来绕过验收。尚未满足的三平台全量结果明确保持未确认；其原因是后台运行与后续main并发更新，并无可据此定位的新测试失败根因。
