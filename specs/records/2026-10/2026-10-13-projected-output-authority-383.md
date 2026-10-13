# 383 投影工具大结果的执行授权传递

## Recall

用户持续要求分批并行体验和调查 OpenCorvus，完成根因与影响分析、落盘方案、真实修复、聚焦正向验证、必要真实页面/模型验收及范围提交推送。主 agent 将383独立委托本子任务，禁止再次委托。拥有范围为 `src/expert-squad/prompt-profile-resolver.ts`、新建聚焦后台测试、本记录及 `.tmp-projected-output-authority-383`。不得改Truncate授权规则、共享README/架构/CHANGELOG、其他线程正在修改的permission/session/file代码，不使用真实Provider/凭据，不运行UI（User Interface，用户界面）自动化，不提交；主 agent 最终复核、页面、统一文档和提交推送。

本批起始工作区有并行文件路径、Permission结果恢复、Session来源、用量页等未提交改动。已逐项查看git status，保留全部无关更改。382已进入范围提交，其代码与归档冻结，本批不改webfetch或text-file长行合同。

原始目标是只读调查共享工具输出的字符/字节预算。实际生产 `Truncate.output`、仅有read的合法工具surface、调用options仅sessionID的纯数据复现：51200字节正常返回、51201字节报 `executionAuthority is required before persisted output can be selected`；2000行正常返回、2001行报同一错误。没有写入文件或调用模型，此证据只证明共享截断合同与这组实参的精确结果，尚不等于三个投影包装器的完整调用验收。

已读AGENTS、当前 `capability-search-runtime.md` 的exact materialization合同、`task-runtime-directory.md` 的项目/Task/Session目录所有权、`04-extensions.md` 的包工具与MCP边界；完整Truncate、Tool包装器、task-tool-execution-scope、task-tool-invocation、AI SDK（Artificial Intelligence Software Development Kit，人工智能软件开发工具包）适配器、prompt-profile-resolver的三组wrapper及scheduler/worker调用；已读正式隔离runner、现有process-authority-runtime、package-tool-native-runtime、artifact-publication-execution、projected-mcp-calltime-stale及MCP回环HTTP服务测试。检索路径未发现UI自动化测试。

## 深度、根因、历史和完整影响分析

### 可观察现象与直接触发

通用Truncate在不超过2000行和50KiB时直接返回结果；超出任一预算后才选择持久保存目录，并要求显式 `SessionExecutionAuthority`。三个实际适配器都在工具执行成功、结果取得后调用Truncate：package Tool、package MCP（Model Context Protocol，模型上下文协议）、default MCP。当前都只传 `{ sessionID: scope.sessionID }`，因此只要恢复surface具备read且输出达到上述阈值，就会在后处理阶段将已成功工具结果变为错误。没有read或明确禁止读取保存路径的surface仍应维持原有明确错误合同，不得绕过授权。

### 唯一授权来源与数据流

`resolvePackageTaskToolExecutionScope`委托 `resolveProjectedTaskToolExecutionScope`。其入口首先验证当前真实invocation authority及project/session/message/call/part/provider身份，再读取持久Task lineage、项目根目录、Session runtime contract、包revision/projectionHash、当前assistant和running tool part；worker另校验WorkerTurnDescriptor。最后证明Harness execute grant和当前active ref均包含精确包/默认MCP能力，产出冻结的 `TaskToolExecutionScope`。

同文件既有 `executionAuthorityFromTaskToolScope(scope)` 已是将该已验证scope转换为冻结Task型SessionExecutionAuthority的唯一helper，保留projectID/taskID/sessionID及projectDirectory。不得从裸sessionID猜Task、重新查询一个可能不同的owner、添加旁路或新授权结构。Truncate使用该对象校验session一致，再经 `taskPrimaryProjectRoot` 与 `ProjectRuntimePaths.toolOutputDir` 选择同一主项目Task/Session所有权目录；它不根据worker当前worktree猜保存位置。scope的executionDirectory仍用于原工具执行，当前helper及Truncate目录策略本批都不改变。

三个包装器分别由scheduler与worker的精确extension materializer进入，default MCP还共享相同wrapper；因此修复覆盖所有使用这三种producer的投影角色。数据变化仅为超限结果恢复到已存在的完整文件+有界preview+outputPath/truncated metadata合同；小结果、MCP content/attachment/App binding、包metadata/title、Source、权限审计与结果恢复逻辑不改。操作发生在结果生成之后，原工具可能已产生外部效果，故不能把本次后处理失败解释为业务未执行或无条件重试依据。

### 历史核对与旧测试遗漏

初步只读报告曾将遗漏归于首次引入显式授权，完整git diff纠正了这一点：`374f5444f`引入Truncate显式授权时，已经同时增加scope helper并补齐全部三个调用。`git log -S executionAuthorityFromTaskToolScope`及 `git show 3b4e5ea9f`证明后者在“bound catalog context retrieval”修改中删除helper import及三处executionAuthority参数，但Truncate授权要求仍保留。这是后续回归，不是原设计未考虑投影工具。

现有process-authority-runtime直接向Truncate传入正确Task/Conversation authority，证明底层保存合同；package-tool-native-runtime调用更内层capsule，输出短且未走外层截断；MCP stale测试覆盖声明漂移错误，未执行超限成功结果。因此阈值相关的包装器回归没有被这些用例捕获。

全仓 `Truncate.output` 生产调用只有五处：本文件三处遗漏；`tool/tool.ts`传入ctx.executionAuthority；`session/loop.ts`原Host MCP调用传入已解析executionAuthority。后者只读确认当前实参，不修改或复验该线程未提交的结果恢复实现。现有直接测试调用也已显式传递authority，无其它遗漏。当前未观察到调度、队列、唤醒、并发、恢复或终态收敛异常；此错误来自确定的工具结果适配器数据缺项，不改变调度状态。如真实测试暴露此类异常，立即按AGENTS共享机制横审并通知主agent。

## 实施方案

分析现已完成。仅在prompt-profile-resolver恢复既有 `executionAuthorityFromTaskToolScope` import，三个Truncate调用都传入由刚刚验证的同一个scope派生的executionAuthority。旧省略实参路径被替换，不新增fallback、配置、缓存或公共接口，不放宽任何guard。需要的公开架构说明由主agent整合至现有单一文档。

生产修改前，新建后台正向测试，使用真实发布/加载的最小测试包、正式Task/Session持久化身份、runtime contract/Harness及现有capability occurrence fixture，沿实际materializer和Permission invocation进入三个包装器。package Tool在真实native capsule中生成明确字符串；package/default MCP通过官方SDK（Software Development Kit，软件开发工具包）与回环HTTP服务真实tools/call返回同样文本。测试不替换Truncate或scope resolver、不mock工具返回，也不把测试建立的Task状态冒充真实模型或调度端到端。

聚焦覆盖精确51200/51201字节和2000/2001行，断言小结果完整输出、超限结果truncated/outputPath、保存文件完整字节与主项目Task/Session路径归属。各包装路径使用独立临时项目和当前会话；尽量增加同Task不同Session保存范围验证。测试只触及本次包装合同；worker实际调度、重启恢复、模型/UI流程不外推通过。

通过正式 `bun run --cwd packages/opencorvus test <新测试文件>` 隔离runner先记录红测，确认实际报错来自本次授权缺项而不是测试准备失败；再实施并重跑同checker，按必要性补类型检查。全部命令日志只进入 `.tmp-projected-output-authority-383`。任何测试准备/工具链问题先修本任务测试准备后重跑，保留失败事实，不能改生产公共契约来迁就测试。实际MCP连接owner、native capsule和临时项目都在finally/asyncDispose中收尾。

## 交付与风险边界

生产风险低且范围明确：复用既有helper，恢复历史已有授权传递，未新增数据或授予能力。主要验收风险是正式wrapper测试依赖已存在的大型runtime配置/权限准备；若并行Permission/Session修改导致检查异常，保留具体失败并与主agent协调，禁止擅自修改其文件或把准备错误称作本批根因。

主agent后续真实GPT-6.1 Sol建议：独立开发`/ui`与已授权模型/凭据成对预检，真实配置一个读取公开大文本的MCP或只读package Tool，让模型执行后获得截断preview及实际outputPath，再通过正式read读取选定范围，人工查看工具状态/正文和来源；核对实际请求、保存文件及运行正常收尾。若只做本轮后台验收，应明确未覆盖真实Provider、UI或worker调度。共享索引、架构、CHANGELOG、最终复核与范围提交/推送由主agent负责，本子任务不独自提交。

## 正式红测准备记录

新增测试已进入正式Bun1.4.0隔离runner。首轮before.log exit1：package Tool真实native capsule返回51200字节正常，51201字节进入实际wrapper并准确报本次缺失executionAuthority错误；两个MCP用例在准备阶段因测试声明遗漏当前必填transport而失败，尚未进入目标wrapper，不能计作产品复现。已将本任务测试的远端声明补为明确streamable-http，不改任何生产配置或旧合同；保留首轮日志并在生产改动前再次跑完整三路径。

第二轮 `before-confirmed.log` 由同一正式runner运行，exit1、0 pass / 3 fail / 6 expect，测试耗时20.92秒。三个生产包装器均先成功返回51200字节结果，再于51201字节结果的实际Truncate调用抛出完全相同的缺失executionAuthority错误，栈分别定位package Tool、package MCP和default MCP。两个MCP路径本轮已通过真实回环HTTP的tools/call进入目标边界，不再有准备错误。这一轮为正式红测证据。

正式红测后按方案恢复唯一helper的import及三处显式授权实参。未修改Truncate、scope resolver、工具效果、MCP内容及Permission/Session逻辑，下一步使用同一runner验证阈值、完整文件和两个Session路径归属。

## 实施与后台验收结果

生产差异仅为 `prompt-profile-resolver.ts` 增加既有helper导入，在package Tool、package MCP和default MCP三个包装器的Truncate options中增加 `executionAuthority: executionAuthorityFromTaskToolScope(scope)`。全仓再次检索仍为五个生产调用点，另外两处已正确显式传参，本次无遗漏或新数据源。

新测试 `packages/opencorvus/test/capability/projected-output-authority.test.ts` 由官方隔离runner执行。每个family运行51200/51201字节与2000/2001行四次实际producer调用，共12次。package Tool进入真实native capsule；两个MCP family进入真实官方SDK回环HTTP tools/call，并核对四次请求正文。三个family各使用独立memoryProject、真实创建Task、同Task下两个真实持久Session与当前runtime contract/Harness授权；Session、消息和运行中tool part由测试建立，这是后台集成测试准备，不是模型自然交互记录。

六个超限结果均断言 `truncated: true`、精确preview和恢复提示、保存文件完整正文，以及 `ProjectRuntimePaths.toolOutputDir(project.path, taskID, session.id)` 的精确目录。六个阈值内结果均断言 `truncated: false` 和原样输出。每个family同时验证两个独立Session的保存归属。正式测试完成后dispose runtime contract/MCP owner、关闭HTTP服务、销毁临时项目并正常join runner；无保留服务或使用凭据。

| 检查 | 正式结果 | 证据 |
| --- | --- | --- |
| 修复前确认红测 | exit1；0 pass / 3 fail / 6 expect；20.92秒；三处同一缺authority错误 | `.tmp-projected-output-authority-383/before-confirmed.log`、同名`.exit.txt` |
| 修复后正式绿测 | exit0；3 pass / 0 fail / 44 expect；63.49秒（runner 64.87秒） | `.tmp-projected-output-authority-383/after.log`、同名`.exit.txt` |
| 核心包typecheck（类型检查） | exit0 | `.tmp-projected-output-authority-383/typecheck.log`、同名`.exit.txt` |
| 范围diff whitespace检查 | exit0 | `.tmp-projected-output-authority-383/final-review.log` |

测试命令为 `bun run --cwd packages/opencorvus test test/capability/projected-output-authority.test.ts`，PATH显式前置仓库已存的 `.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64`，实际runner报告Bun1.4.0。类型检查命令为 `bun run --cwd packages/opencorvus typecheck`。仅使用既有本地prettier格式化新增测试；生产文件未做整文件格式化。

本轮证明生产投影materializer→Permission invocation→作用域解析→三包装器→Truncate→真实文件的成功结果边界。没有使用真实Provider、模型或凭据，没有UI自动化，也未验证真实页面、模型接续read、worker调度、重启恢复或任务终态。测试中的Task ingress runner明确关闭自动模型启动，因此不将后台集成覆盖外推为这些端到端项目。尚未完成项由主agent按照上节建议安排，并同步共享文档索引、运行文档检查、最终复核及提交推送。

## 真实Sol端到端验收补充计划

主agent随后根据用户持续goal授权本子任务完成真实GPT-6.1 Sol→投影大结果→read接续验收，允许必要凭据使用；前述后台阶段的不使用凭据约束仅属于该已完成阶段。源代码与正式测试现冻结。本阶段只写本spec、`.tmp-projected-output-authority-383`和对应383证据目录，不改共享runner/文档，不提交、再次委托、操作用户进程或运行UI自动化。主agent负责真实桌面截图。

已重读benchmark-debug-template技能、382/380/384真实记录、既有 `live-sol-locale-377-after.ps1`、`live-sol-cli-owned.ts`、`live-sol-shutdown.ps1`、生产stageDiagnosticProvider/RealProviderAudit、SDK（Software Development Kit，软件开发工具包）包安装、项目配置与正式CLI Task创建入口。既有runner的project模式限定QA16包路径、身份和mission能力，不能用于本次最小报告包；不得篡改QA16或复制大runner。已向主agent报告选择：原样复用NativeService/builtin Base模式承担隔离环境、配对授权预检、模型流审计及物理owner收尾，预检成功后以生产SDK在其独立project安装最小报告包，正式CLI `task create`显式选择该包。NativeService回执只证明服务/Provider物理资格；本批独立只读规范数据checker另证Task与工具真实完成，二者不混称。

固定scope `projected-output-authority-383-live`，RunRoot `.tmp-projected-output-authority-383/provider-run`，回执 `.tmp-projected-output-authority-383/provider-live`，端口18502，桌面入口 `http://localhost:18502/ui`。本次优先package Tool，不另启18503 MCP服务。沿既有377完整私有UI包及当前源码CLI启动；NativeService固定600000ms原生上限、累计16次真实Provider请求（包括预检）、有意义活动后180000ms无活动限制。原截止不延长；定时读取回执，不持续追日志。创建真实Task前再次核对原生剩余预算，确保留足主agent页面查看与正常收尾窗口。

凭据只由既有stageDiagnosticProvider暂存授权OpenAI记录，并完整复制相邻models.json。先分别确认有效凭据、模型目录投影及真实preflight实际请求为gpt-6.1-sol且streaming=true；当前Task也显式指定 `openai/gpt-6.1-sol`，独立checker核对真实Task配置、assistant/provider请求模型身份。秘密不进入prompt/日志/spec/归档，复制OAuth不刷新原授权。最终既有shutdown与原launcher确认精确Host/Target/output/request/端口闭合后成对删除副本。

公开输入为最小包 `projected-report-383` 的只读 `load_public_report`：静态包asset保存超过50KiB且超过2000行的公开报告，工具真实native capsule直接返回报告原文。用户真实Task请求仅要求核对报告开头审核代号与末尾行数，遇到部分输出依真实工具恢复提示读取所需正文。包正常声明scheduler能力及read，不增加host路由/gate或隐藏消息。模型自行决定加载/调用与read接续，任何实际错误保留，不伪造工具结果、消息、终态或Task控制事件。

成功指标：真实Task被正式API/CLI接受，规范工具request/outcome显示投影package Tool completed且truncated/outputPath完整；磁盘文件与公开asset逐字节一致并精确属于该project/Task/Session；后续实际read请求指向该outputPath，返回此前preview之外的报告首部；模型答复给出正确审核代号与尾部行数；实际请求均为目标模型流式HTTP200/EOF，Task最终completed及其助手消息真实结束。若Task调度/恢复/终态发生异常，立即按共享机制要求通知主agent做横审，不能降级为单场景失败或以直接wrapper测试替代。

预计留存公开asset/请求、安装与可发现回执、Task创建/终态、精确正文checker、无凭据模型审计和物理收尾证据。主agent获得实际Task/Session URL、原始截止及owner句柄后自行进行桌面交互，回报页面关闭再由本子任务执行既有shutdown/join和精确副本清理。未完成项与首次失败原样保留。

### 首轮真实输入、运行及共享失败

启动前SDK原始定义遗漏显式空capability_sets，被正式validator拒绝；补齐后写入成功。原工具ID使用下划线，被正式import-folder端点以Package tool ref格式错误HTTP400拒绝；保留原输入及receipt，不改生产校验。将本次新建工具ID改为规范 `load-public-report` 后，第二份SDK源码经正式 `/expert-squad/import-folder` 项目安装成功，packageDigest为 `f8309f5d56cb68a6fc29fadb0205cc9a02ae5a1d2d2f926a50c6928d68cde5cf`。该digest只用于真实不可变package身份对应，不作为可变源码验收门槛。独立GET config证明项目默认仍Base，未做配置翻转。实际公开报告96717字节、2104行。

实际scope `projected-output-authority-383-live-088ab7c6-be2f-4e78-bbb7-31884b80ad7f`，18502，Native Target4340、Host76408，launcher句柄52508。原截止北京时间2026-10-13 15:37:19.801，不延长。真实preflight分别返回credential usable、catalog projected、actualModel gpt-6.1-sol、streaming true。正式CLI在15:29前接受Task `tsk_g00VXudNQE00V1AFy1DS`、project `prj_hvlmjlS0kIFNijcVQxpE`；root `ses_-zUS5McL2zzZ0dw7CcRv`，实际orchestrator `ses_-zUS5MbHczzU5ORXN735`。输入、SDK/正式安装回执、CLI退出码和接受回执保存在本任务临时目录。

本轮未完成383实际大输出验收。真实模型先调用skill成功，但后续四次capability_search均以 `HostProcessingFaultError` 失败：不可变Tool request的OpenAI itemId metadata已存在，而后续接收值为undefined。相同错误跨orchestrator和实际派发的explore worker `ses_hXA8bUS608rQ27NvRxcX`；因此已立即向主agent共享规范SQL事实并要求permission/session横向审计，不能归为单包、模型行为或383截断器故障。深层共享根因仍由该线程核实，本子任务未更改其代码、权限或运行事实。

模型自然读取真实worker结果后，于15:31:16调用 `manage_task action=fail_task` 如实声明未取得报告正文；其completed outcome和immediate_park已规范持久化，正式status返回lifecycleStatus failed。实际没有进入报告包装器或read恢复链，因此后台三包装器绿测不能替代该未达成项。只读事务checker `retain-failed-live.ts` 已精确核对四个failed请求横跨两个会话、自然fail_task工具结果、全部assistant目标模型和完成时间，并记录15个真实Provider请求均gpt-6.1-sol/streaming/HTTP200/EOF，预算16未耗尽。证据收集器exit0仅代表失败事实核对成功，`live-check-failed.json` 明确acceptance=not-achieved；不称模型验收通过。

第一批保留证据为 `.tmp-projected-output-authority-383/live-failed-canonical.json`、`live-failed-provider-audit.json`、`live-check-failed.json`、带时间的observation及原始owner/预检/输入/安装回执。所有输出经CredentialRedactor处理，auth/models本体不归档。服务仍按原预算供主agent查看实际失败页，之后按既有shutdown、launcher join和精确副本清理收尾；收尾结果待追加。

15:36前已预告正常收尾计划。原shutdown在15:36:06.354取得Target exited0、Host/Target/outputDrain/requestCleanup完整生产回执，15:36:09.422配对副本清理完成；launcher52508实际join exit0，shutdown调用实际exit0，早于原截止约73秒。PowerShell的空LASTEXITCODE文件保留，实际工具退出证据另存owner-handle-joins.json。独立复查18502 listener为空且本scope auth/models均已删除。主agent未及时取得失败页截图，随后确认关闭其独立tab11，本轮明确没有页面验收，也未重启已关闭scope。

已按精确allowlist归档27项公开输入与无凭据运行事实，大JSON用gzip压缩；[383证据README](../../artifacts/2026-10-13-projected-output-authority-383/README.md)及[凭据扫描清单](../../artifacts/2026-10-13-projected-output-authority-383/live-attempt-01/credential-scan.json)记录范围。CredentialRedactor对本次授权来源中的实际秘密扫描匹配0；未复制runtime目录、数据库、auth/models或未经选择的大日志。NativeService物理资格通过与Task验收未达成分别记载。

主agent已要求继续只读横向审计上述metadata冲突的生产入口、immutable request数据流及当前并行diff，覆盖Task/Mission/Chat/worker、正常终态、重试恢复和多项目；本子任务不修改正在并行变动的permission/session文件、不再次委托。后续调查在本记录追加，不能以本次Task自然failed或单项测试通过排除共享根因。

独立385现已完成共享根因方案与一行reveal-owner请求metadata保留修复，新增及关联正式测试10项/74断言通过；详见[385方案](2026-10-13-capability-request-metadata-385.md)。主agent授权新的真实attempt02，scope projected-output-authority-383-live-02，端口18502、目录`.tmp-projected-output-authority-383/live-attempt-02`；原生600000ms/累计16请求及180000ms无活动约束不变。原runner负责NativeService资格，正常CLI显式选择projected-report-383，Base默认不变，Task/完整工具输出/read/真实终态单独核验。首次failed与未取得页面截图事实不覆盖。

Attempt02在本地preflight的15秒HTTP请求期限内未完成，尚未导入包/提交业务Task；最终唯一memory模型请求为HTTP200/EOF，因此不能称凭据缺失或远端Sol失败。原scope按immutable失败正常收尾，launcher91783 exit1，native exited0及配对清理15:56完成。所有后台检查完成后的fresh attempt03再次使用同预算，预检成功并正常安装/CLI选包建Task `tsk_g00VXulckc00yVjGRiGb`，但真实Provider首轮返回服务器overloaded，尚未调用业务工具；正常重试后Task failed。

主agent实际查看attempt03失败页、保存`actual-task-provider-overloaded.png`并关闭tab17，子任务也人工查看该图。该截图仅证明真实失败状态，不能计作383大结果/read成功验收。按主agent指示停止当前连续scope重试，待后续批次再验收。原截止16:08:56.207之前，Host76344/Target82164在16:04:14.182正常exited0，16:04:18.334 outputDrain/requestCleanup及配对清理完成；shutdown与launcher14588均实际exit0。七个Provider请求HTTP200/EOF只证明流传输闭合，不掩盖其中真实overloaded业务错误。

最终[383档案](../../artifacts/2026-10-13-projected-output-authority-383/README.md)分别包含backend-contract红绿/类型检查9项，attempt01失败/真实规范结果/owner/checker27项，attempt02本地预检失败14项，attempt03Provider失败/规范原文/真实截图/owner24项，各scope有独立清单且已知凭据扫描0。未归档runtime、数据库、binary或auth/models。后台383三包装器3项44断言通过；成功模型投影大结果→read接续→Task完成和对应成功页面仍未达成，不能包装为整体端到端完成。
