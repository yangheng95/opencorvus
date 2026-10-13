# 385 能力搜索完成时保留不可变请求 metadata

## 当前验收状态

后台10项/74断言与核心类型检查通过；后续Attempt04真实Task scheduler的两次OpenAI metadata-bearing能力搜索、package工具大结果/read接续及Task completed通过，页面截图人工复核和正常物理收尾已完成。此前失败独立保留，不外推Mission/worker/MCP的新增真实模型覆盖。成功证据见[Attempt04档案](../../artifacts/2026-10-13-projected-output-authority-383/live-attempt-04/README.md)。

## Recall

用户持续goal要求每批先完成根因/影响分析落spec，再实施真实修复、聚焦正向测试及必要真实GPT-6.1 Sol/页面验收。383的真实Task暴露共享metadata错误后，主agent委托本子任务完整横审并创建385方案，分析完成后可独立修 `src/capability/reveal-owner.ts`、新增聚焦后台测试；禁止放宽immutable合同、修改并行permission/session文件、再次委托、共享索引或提交。383原修复及其证据独立交付并冻结，385后续真实Sol沿383流程重新使用新scope，不能覆盖首轮失败。

已读AGENTS、`task-control-plane.md`的write-ahead request/outcome合同、`capability-search-runtime.md`的occurrence/CAS/replay合同、383真实失败原文/Provider审计/正常物理收尾、完整reveal-owner、tool-part-facts、Session updatePartRow与Processor request/completion/error/retry、SessionLoop tool materializer/recovery、caller-authority、catalog binding及相关测试。已全仓搜索createCapabilityRevealOwner、SessionProcessor.create、SessionPrompt入口、writePartInTransaction、reconcileToolRequestFact及metadata/重放历史。检索到的测试均为后台合同或后台LLM桩测试，无UI自动化。

## 实际现象与证据

383首轮Task `tsk_g00VXudNQE00V1AFy1DS` 的orchestrator和实际explore worker共四次capability_search失败，规范错误为HostProcessingFaultError，stored metadata带OpenAI itemId，received=undefined。相同元数据没有阻止skill/read_agent_message/dispatch_agent及最终manage_task fail_task，说明不能按所有工具失败或模型异常归因。模型自然fail_task后规范lifecycleStatus=failed，15次目标模型请求全部流式HTTP200/EOF；未进入383投影报告/截断/恢复read。精确输入与规范数据见[383证据](../../artifacts/2026-10-13-projected-output-authority-383/README.md)。失败场景未取得页面截图，未声称UI通过。

## 根因与公开合同

Provider tool-call由SessionProcessor带顶层 `metadata: value.providerMetadata` 写入真实running ToolPart；toolRequestData将该顶层字段记录在immutable Tool request中。Request顶层metadata是Provider传输注释，`state.metadata`是执行结果/reveal receipt，二者含义不同，不能互相替代。

唯一createCapabilityRevealOwner生产实例在SessionLoop.resolveTools建立。reveal-owner的CAS（Compare-And-Swap，比较并交换）事务通过toolPartByID读取真实current请求并验证message/session/call/tool/input、catalog绑定、当前revision和没有其它open execution，随后却用id/message/session/call/tool/state重建completed ToolPart，遗漏current.metadata。Session.writePartInTransaction→updatePartRow→toolRequestData→reconcileToolRequestFact准确发现已有Provider metadata被丢弃并拒绝提交。当前目录/能力计算可能已经成功，但CAS transaction回滚，reveal receipt没有合法completed落点；Processor将原Host错误规范记录为failed，模型看不到所需搜索输出。

旧路径为何未根治：`49028f70c`（2026-08-18）只处理Provider后到metadata（stored缺省、incoming有值）并维持首条事实，不允许已经记录的值被替换/删除。`5a33d07f5`（2026-08-31，search-native改造）引入此completed构造时已遗漏顶层metadata；现有reveal-owner测试的runningSearchPart和Processor replay模拟tool-call均不提供providerMetadata，只验证无注释请求，因此绕过真实触发条件。不是应继续放宽reconcile规则的理由。

## 全共享机制横向审计

| 范围 | 当前定义/调用及结论 |
| --- | --- |
| 全部生产能力搜索入口 | 仅tool/capability-search.ts调用ctx.extra的occurrence owner；唯一owner factory生产调用位于SessionLoop.resolveTools。不存在Task专有修复位置。 |
| Chat/普通Session | Control message、server Session route及其他正常prompt经SessionPrompt.prompt/run或loop进入SessionLoop；caller-authority映射conversation，共用同一CAS。真实本轮未单独运行Chat搜索，覆盖来自代码和后续后台正向测试。 |
| Mission | 同一SessionPrompt链与SessionLoop.resolveTools；caller-authority的mission仅改变catalog/held-squad搜索授权，之后共用同一completed写入。其productPillar/held-squad合同不改，真实Mission搜索尚未运行。 |
| Task scheduler | orchestrator/agent.ts通过SessionPrompt进入同一loop；projected-scheduler映射task_scheduler。383真实主会话已复现。 |
| Worker | agent/runner.ts通过SessionPrompt/loop进入同一processor；projected-worker映射task_agent。383真实explore worker已复现，串行/并行调度均可进入同一边界。 |
| Occurrence与项目 | owner绑定Instance.project.id、input occurrenceID、session/message，CatalogOccurrenceBinding.readAssistant检查项目authority；current请求按messageID/partID查询，事务重新检查同session和assistant.parentID。修复应只取这一current的metadata，不引入全局缓存、跨会话合并或裸callID查找。 |
| 正常completed与错误终态 | 通用Processor completeToolPart及failToolPart/stream tool-error沿 `{...match/part,state}` 保留顶层metadata。搜索owner手动CAS writer独立丢字段，现有正常错误路径并无同样重建。失败后的实际Task自然failed证明该Task终态收敛，不证明其他恢复/并发域无问题。 |
| 重放/重试 | owner先从当前occurrence读取已completed搜索；同callID、partID、input返回原结果。Processor preserveCompletedCapabilitySearch/confirmCapabilitySearchCompletion保护原receipt。首写失败的搜索没有可返回的completed receipt；重试新call仍触发同一遗漏。 |
| 重启恢复 | MessageStore/projectToolPartInTransaction从Request重建顶层metadata。既有跨进程Processor replay重建同occurrence；completed快路返回原result。并行新recoverCompletedToolResult针对已有Permission执行结果且使用`...part`，不能恢复从未完成CAS的搜索，也不修本次漏字段。真实进程重放将在正向测试覆盖，业务Task重启不外推。 |
| 串行 | 每个真实call按当前revision递增，首个metadata-bearing搜索即在CAS提交失败；无metadata搜索旧路径正常。 |
| 同occurrence并行 | 现有同进程及双进程测试以同revision准备两个调用，CAS只接受一个、另一个为明确CapabilityRevealConflictError。修复不改其比较条件/锁/事务，必要关联测试复跑；正常并发不是本次根因。 |
| 多项目/多会话 | 所有Catalog/Request查询均随当前Instance及真实Message关系；新增双项目并行正例采用相同callID、不同metadata，验证各自completed与原请求metadata归属。不能仅凭一个项目通过排除共享误绑定。 |
| 当前并行diff | 15:40前后已核对permission/authority及session/index/loop/processor/result-recovery的实际diff，它们没有修改reveal-owner或tool-part-facts，均不保留此CAS重建遗漏的字段，因此无同义修复；不修改这些peer files。 |

全仓Session.writePartInTransaction生产直接调用只有reveal-owner及Session内部统一writer；底层immutable guard是一份单源，不新加旁路。暂未发现需要修改调度/队列/唤醒机制的证据；本问题为共享搜索结果事务的数据缺失，保持横向影响判断，不能称单个包局部错误。

## 实施与正向验收方案

分析至此完成。在reveal-owner最后CAS写入completed ToolPart时明确传入 `metadata: current.metadata`，来自事务内刚刚验证的规范请求。保留全部身份、input和immutable guard；不改变前段候选计算、state.metadata receipt、replay条件、CAS比较、事务边界、权限或调度。无fallback、双写、元数据推测或新增配置。

新增聚焦后台测试，使用真实持久Message/ToolRequest、现有capability occurrence fixture及SessionLoop materializer调用实际capability_search，使其进入实际CAS。先在未改生产代码时正式runner红测，证明带OpenAI itemId的合法请求在提交点失败；然后实施并复跑。正向期望为精确completed输出/reveal revision/current projection、原Request顶层metadata与结果state.metadata分别正确、原call重放结果相同及跨进程重建结果相同。另以两个独立项目并行同callID验证metadata归属；明确输入冲突映射既有错误类型的合同继续由既有guard保持，不通过宽松metadata合并求通过。

复用已有后台进程replay fixture，不把其LLM桩当真实模型验收。正式命令日志进入唯一`.tmp-capability-request-metadata-385`；复跑关联reveal-owner/CAS及Processor幂等测试，必要核心类型检查。所有新测试是正向行为/明确错误合同，无UI自动化。完整后台通过后再用新scope重跑383公开报告真实Sol，原首轮failed证据不覆盖；主agent负责页面、共享文档索引、最终复核和提交推送。

## 风险与未满足项

修复只恢复既有请求字段，既不改变Provider后到metadata的现行规则，也不迁移历史failed outcome。风险在于旧测试没有真实transport注释且可能存在其他独立场景遗漏，须以真实CAS及已保存的Sol失败复验补齐。Task/Mission全生命周期、外部Provider服务可用性和页面验收不由局部测试保证。当前尚未实施385、未运行新红绿测、未完成新Sol复验。

## 正式红测与实施记录

新增 `test/capability/reveal-request-metadata.test.ts` 后，未改生产文件运行官方隔离runner：Bun1.4.0，exit1，0 pass / 2 fail，24.11秒（runner25.51秒）。两例均进入生产reveal-owner.ts:539的CAS写入并报精确metadata冲突；第一例OpenAI itemId，第二例其它Provider嵌套metadata，均为已有值被错误重建为undefined。没有准备或工具链错误，日志`.tmp-capability-request-metadata-385/before.log`及退出码文件保留，句柄26330已join exit1。

红测后仅在该事务末尾的completed ToolPart增加一行 `metadata: current.metadata`。Session/Permission、immutable guard、CAS比较、result state.metadata及其它文件未修改；开始同checker绿测与必要相关检查。

正式绿测exit0：2 pass / 35 expect，39.60秒。用例一进入真实CAS两次，核对原请求与completed结果、revision2 current projection、revision1原call重放、已有后台fixture的真实子进程重建后精确原Part；用例二在两个不同Git身份的项目并行使用相同callID、不同嵌套metadata，分别完成revision1并回读各项目原值。这里跨进程fixture使用受控LLM流重送已有call，只证明恢复合同，不是Provider端到端。

同一正式runner关联文件分别7 pass / 33 expect（reveal-owner，含同进程及双进程CAS）和1 pass / 6 expect（Processor revision1在revision2后重放及跨进程恢复），均exit0。新增与关联合计10项/74断言。typecheck尚在运行；无UI自动化。

主agent已要求绿测通过后立即重跑真实Sol：新的scope `projected-output-authority-383-live-02`，数据与回执位于 `.tmp-projected-output-authority-383/live-attempt-02`，18502复用已释放端口；仍以未经修改的NativeService runner、Base默认和正常CLI显式Task选包，600000ms原生固定边界/16累计真实请求及180000ms无活动约束。383首轮失败独立保留；本轮将公开请求工具名纠正为安装中的规范load-public-report，不改变生产权限或消息来源。主agent提前得到ready URL、真实Task和原截止进行页面体验，子任务负责正常shutdown/join及配对凭据清理。

核心包typecheck实际exit0，句柄24650已join。新正式绿测4189与关联64983均已join exit0；生产diff仅一行，范围whitespace检查exit0。

Attempt02在业务包导入/Task创建之前的原runner preflight失败，`failed.json`为TimeoutError。生成时间15:55:31；生产RealProviderAudit.preflight本地HTTP使用15秒请求超时，而最终唯一实际Provider请求为memory助手且HTTP200/EOF（约15:55:56），因此不能推断凭据缺失、未投影或远端Sol流失败。原scope Host49672/Target64196已正常exited0并完整排空，15:56:00成对副本清理；launcher91783实际exit1保留预检资格失败。本地请求准备时限与初始目录/记忆准备的具体时序需保留，不修改共享runner或取消真实失败。

在所有本批测试进程完成后，用fresh attempt03再次执行同一预检与原预算；不复用已终止run、不延长时限。scope `projected-output-authority-383-live-03`、相同已释放18502、独立`.tmp-projected-output-authority-383/live-attempt-03`。若仍出现相同15秒本地请求超时，必须先修正式预检工具链并协调共享脚本拥有范围，不能继续盲重试。本次只在现有任务专用input/observation脚本增加明确第三个scope参数，未复制运行器。

## 真实复验、收尾与交付状态

Attempt03通过原真实preflight，精确credential usable/catalog projected/actual gpt-6.1-sol streaming；正式SDK包导入后再次证明默认Base，CLI显式建Task `tsk_g00VXulckc00yVjGRiGb`，project `prj_hGKT7rn29hQas1doFa3D`。真实首轮orchestrator `ses_-zUS5EKXQzz3q1aHTJ2B` 在业务工具执行前收到 `AI_StreamProviderError: Our servers are currently overloaded. Please try again later.`，正常重试后规范Task failed；不是metadata修复再次失败，也未证明其真实功能成功。

主agent实际打开18502 tab17、查看该Task失败原文并截图，然后关闭自有页。截图和规范SQL/HTTP状态均归档，子任务也人工查看截图，明确只作Provider失败证据。按主agent指示停止当前连续scope重试，避免额外模型成本，后续批次再做目标功能复验。

原scope Host76344/Target82164，原截止16:08:56.207。收到PageClosed后经既有shutdown正常退出，Target16:04:14.182 exited0，16:04:18.334完整outputDrain/requestCleanup及auth/models配对副本清理；launcher14588实际join exit0，shutdown实际exit0。NativeService回执7个目标模型流HTTP200/EOF只是传输与物理收尾资格；canonical assistant错误和Task failed保留，不将SSE（Server-Sent Events，服务器推送事件）流正常结束等同于模型成功。Attempt02 launcher91783实际exit1、native正常清理已独立保留。三次独立运行均无残留自有服务或复制凭据。

[385证据档案](../../artifacts/2026-10-13-capability-request-metadata-385/README.md)保存正式红绿、关联CAS/重放、核心类型、范围diff与凭据扫描；[383档案](../../artifacts/2026-10-13-projected-output-authority-383/README.md)保存三轮真实失败、实际公开输入、规范checker、Provider审计和owner收尾，跨scope的失败事实不覆盖。源代码仅一行；新增测试只有后台用例。未完成项是成功真实Sol搜索→投影大结果→read接续→Task完成以及其对应成功页面验收；本批后续索引、文档检查、独立复核、提交推送由主agent执行。

## 后续goal轮次Attempt04

383/385独立提交已推送，当前HEAD为3d4adff49；2026-10-13 16:27主agent再次授权fresh attempt04（前三scope均已核对正常物理收尾和配对副本删除），原预算仍600000ms/16请求，默认Base不变、CLI显式选同一报告包。16:32:56独立checker exit0，真实Task `tsk_g00VXusvo400gWdUSw6w` completed。Sol的两次capability_search均携带实际OpenAI itemId并completed，随后真实package大结果保存96717字节、按实际outputPath读取首尾、自然完成Task。11个实际请求全部目标模型流式HTTP200/EOF；本轮直接补齐385曾失败的真实Task搜索边界。详情、原始身份及完整checker见[383记录Attempt04](2026-10-13-projected-output-authority-383.md#attempt04真实后台结果)。主agent真实页面与原owner物理收尾待分别记录，前三轮失败保持原样，未外推新的真实Mission/worker模型验收。

主agent已完成独立tab19的真实Completed答案、截断恢复头部、首尾read交互截图与人工复核并关闭；子任务也逐张查看4张关键截图。16:37:27.512原Target exited0，16:37:31.771 exact Host/Target/output/request/端口及配对auth/models清理闭合，shutdown和原launcher33430均实际exit0，早于16:39:15.173原截止。Attempt04成功归档包含30项明确文本证据、4张关键截图、原文/规范checker/流式审计/实际owner句柄和凭据扫描，当前383/385 README均区分成功新事实与历史失败。代码未再修改，范围交付待主agent统一提交。
