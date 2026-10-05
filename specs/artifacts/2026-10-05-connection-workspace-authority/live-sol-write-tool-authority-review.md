# live-sol-write-01 工具授权与模型投影审查

## Recall

Root 要求仅以当前生产源码及 owned actual public facts 调查真实 Work Write→Read 未执行：区分合法角色限制、通用工具隐藏与提示不一致；不得根据模型自述判根因。当前全生产冻结。本 agent 为 gpt-6.1-sol，不再次委托；不运行 Provider、读取凭据/模型文件、操作进程/UI/Git、执行生产 imports 或修改源码/测试。只新增本审查，索引与提交由 Root 统一。

验收目标是说明授权→工具投影→能力目录→模型声明的共享路径，记录真正调用输入/输出，列出精确修复边界、正向验证和后续真实场景。实际执行与 UI 证据由 Root 负责。前序 Write preparation 的脚本与 E2E（End-to-End，端到端）方案不构成这次工具可用性的证明。

已读：根 AGENTS 约束；current architecture/capability-search-runtime.md；live-sol-write-e2e-plan.md 的既有上下文；本轮 authored-requirement、readiness、actual-input-observation、first-actual-messages JSON；Root 保存的 ui-02-actual-first-outcome PNG；agent/tool-pool-data.ts、primary-assistant-registry.ts、native-agent-permissions.ts、work/harness.ts、conversation/capability.ts、tool/registry.ts、tool/execution-surface.ts、tool/capability-runtime-catalog.ts、tool/capability-search.ts、capability/routine-tools.ts、session/loop.ts、session/llm.ts、agent/prompt/coding.txt、session/prompt/system.txt、global-tools.ts，以及既有 task-owner-direct-delivery.test.ts 的模型分支。全仓搜索 ToolRegistry tools/projectableRuntimeToolIDs/exactRuntimeTools、providerCompatible、工具授权与模型声明调用点；未运行任何测试。搜索中几次 Windows 路径猜测或 glob 无匹配均随后改用 rg --files 定位真实文件，未作为证据。

## 真实观察及边界

Root 的 fresh ordinary CLI 为 PID 67760、127.0.0.1:17953；readiness 保存真实 credential usable、paired catalog projected、实际 gpt-6.1-sol streaming preflight。Session 为 ses_-zUSnbI21zzR0tkl1Ik5，真实用户输入 msg_076c8229-b3af-4cfb-a2f8-c3d01552f10b，agent=work、experience=work、source=right-sidebar-conversation、模型 openai/gpt-6.1-sol。该 public user message 的 tools 中 read/write/edit/apply_patch/bash/glob/search_code 都是 true。它证明已保存的本轮请求开关，不独立证明 Provider 最终收到的工具声明。

用户在实际 UI 要求使用 Write 新建 project/actual-write-result.txt，再 Read 同一路径，内容是唯一实际 marker 及中文行、末尾换行；authored requirement 记录目标之前不存在、期望 UTF-8 内容 86 bytes。未注入合成消息或预写目标文件。本审查未独立读取目标磁盘，因此不把消息中缺少写调用等同于物理文件状态证据。

公开消息中真实调用如下：

| call / assistant message | 实际输入 | completed 输出 |
| --- | --- | --- |
| call_VJ5h3Q4j0nQLA6aYEXrxiAHb / msg_g0VXCOi7C004Q9ubniqq | queries=["Write tool create file exact UTF-8 contents"], kinds=["tool"], next_owner_kinds=["call_tool"], exact_refs=[], deactivate_refs=[], limit=5 | candidate=34, matched=34, returned=5, complete=false；命中 apply_patch、bash、capability_search、delegate_agent、external_code_search，均 visible/call_tool；active_refs=[] |
| call_PrxSdIb3Oc3XZPediI2z3ZFs / msg_g0VXCOk2D00A72Y2wZM9 | queries=["write"], 同一 kinds/next_owner、exact_refs=[]、deactivate_refs=[]、limit=5 | candidate=34, matched=3, returned=3, complete=true；命中 work_artifact_deliver、work_artifact_inspect、work_artifact_validate，均 visible/call_tool；active_refs=[] |

最后助手以 stop 结束，公开消息没有这轮 canonical write/read 调用。Root 截图显示同一结果及模型“Write unavailable”的表述。表述仅是症状线索；第二个完整搜索结果与源码投影共同支持实际不可发现 canonical write 的解释。active_refs=[] 是动态 reveal 的回执，不能据此说所有常驻工具都不存在。第一次搜索 incomplete，不能用它证明全目录缺项。

**实际 outgoing toolNames 仍未知。** 这组正式 artifact 没有携带本次请求的工具名称清单。session/llm.ts:313–325 的既有 AgentTrace.recordLLMRequest 可记录 tools:Object.keys(tools)，session/loop.ts:2223 的 context-diagnostics 也记录装配后 toolNames；前者更接近真实 Provider 请求边界，后者是装配诊断。需要 Root 从该 owned occurrence 的真实既有 trace 核验，不能把源代码推导或 preflight 的请求当这轮请求清单。

## 源码根因及授权链

Work 是生产/交付角色，不能归类为合法只读。agent/tool-pool-data.ts 的 primaryExecutionGlobal 明确包含 read/edit/write/apply_patch，codingGlobal 复用它；chat 与 work 使用 codingGlobal，Work 额外加入 work_artifact 工具。Task owner 的 TASK_OWNER_REGISTRY_TOOL_IDS 和 delegated worker generic 集也包含 edit/write/apply_patch。primary-assistant-registry.ts 构造 Work/Chat 的 nonDesign 权限，native-agent-permissions.ts 默认通用操作 allow；Work harness 使用 coding/system 基础提示，并声明共享 permission/tool infrastructure。特定配置仍可能限制权限，本轮用户 switches 的 true 不覆盖所有其他权限层，但共享默认不是 Work readonly。

直接抑制点是 tool/registry.ts:17–21 的 providerCompatible：

```ts
const usePatch = modelID.includes("gpt-") && !modelID.includes("oss") && !modelID.includes("gpt-4")
if (toolID === "apply_patch") return usePatch
if (toolID === "edit" || toolID === "write") return !usePatch
```

它不检查 Provider SDK 能力、实际 schema 错误或权限，而以模型字符串选择互斥文件操作接口。gpt-6.1-sol 落入 usePatch=true，已授予的 write/edit 被移除；反向模型集合则移除 apply_patch。这是一项共享 host 工具选择规则，不是模型自然选择，也不是用户拒绝写授权。

过滤有两个共同落点：projectableRuntimeToolIDs:119–135 在工具初始化前删除身份；materialize:63–70 再次过滤实际定义，projected-worker 的 expected 集:101–104 同样过滤，因而内部一致性校验接受已经删减的集合。exactRuntimeTools 复用 materialize，没有另一个可绕开的 canonical Write 实现。三种 file tools 在 global-tools.ts:111–119 都是真实注册；缺失不是没有实现。

SessionLoop:1949–1966 将 occurrence harness grants 经模型 projectability 过滤，再经 CapabilityRules 的 agent+session permission、message switches 形成 policyProviderToolIDs。tool/execution-surface.ts:20–35 执行当前真实 permission/switch 规则。catalog 构造以 executionToolIDs 与 discover grants 的交集建立 visible platform view（capability-runtime-catalog.ts:364–388），所以已被模型规则删除的 write 不会变成可搜索候选。SessionLoop:3900–3937 同一过滤生成 visibleOccurrenceToolIDs/permanent refs，再 exactRuntimeTools 装配常驻定义。routineToolRefs 对已授权可见 platform tools 直接投影，不额外限制角色；routineToolPrompt 明确直接使用 routine tools，无需 search/reveal。搜索不能恢复 registry 上游删掉的工具，不应新增另一条恢复路径。

prepareProviderTool（loop.ts:954 起）经 ProviderSchema.input 归一化已选中的定义、保留执行闭包；这里是成熟的 Provider schema 边界。llm.ts 用同一 tools 进入 streamText，trace 记录其名称。当前只观察到了该代码链，未取得本 occurrence 的最终 serialized wire request。

提示冲突同样有明确源证据：session/prompt/system.txt:101 要求文件操作使用 Read/Edit/Write，93 行是单文件 edit 优先 apply_patch 的建议；coding.txt 要求实施并核验真实请求；Work 继承这些基础提示。偏好不应成为按模型剥夺已授权 Write 的理由。当前 architecture/capability-search-runtime.md 的 revision-zero 契约要求角色已授权通用工具直接提供；guidance 不能进一步收窄它。只改提示叫模型搜索 Write 或改用户请求用 patch，仍会保留共享根因并违背本轮明确 canonical Write 验收。

## 横向影响与已有覆盖

全仓生产调用集中如下：SessionLoop 的 exactRuntimeTools 在 1100（既有 occurrence 装配）、3937（常驻集）、4081（后续注册集）、4558（动态候选），projectableRuntimeToolIDs 在 1949（目录政策集合）与 3900（实际执行集）；server/routes/experimental.ts:198 的 ToolRegistry.tools 也复用 materialize，展示模型相关工具集合。无需改成双源，也不能只特判 Work。

影响面是**已授予这些工具并经过共享 registry 的角色及模型集合**：interactive coding、Chat、Work、Task root、实际获授权的 worker 都可能被删减。Task scheduler 或其他专职角色没有授予 write 时不能据此强行扩权；Mission 路径以实际 occurrence harness grant 为准。多项目、重启或同 API 选择 epoch 不改变这个纯模型字符串过滤；本次没有调度异常或所有权泄漏的证据。不能凭一次 Work pass/fail证明其他 role 的实际请求。后端同名 task创建接口、Provider auth、模型目录、CLI owner控制不需要修改。

现有 task-owner-direct-delivery.test.ts:30–38 用 usePatch 两分支改变模型名，101/190 只验证分支对应工具，证明过往接受了互斥选择，不能证明当前“全部已授权通用工具直接提供”契约。该测试可保留其真实交付行为场景，但须改为每个模型都正向验证 write/edit/apply_patch 的完整授予并任选合适工具；不能为了旧 fixture 继续保留模型过滤，也不能新增“过滤不存在”等负向核心断言。其他相关正向集包括 execution-authority-tool-surface.test.ts、capability/task-routine-tools.test.ts、fixture/capability-occurrence.ts；fixture 只是局部装配证明，不能替代实际 Provider/UI 验收。未扫描或执行 UI 自动化。

## 最小待批准修复与验证

建议删除 registry 的模型名称互斥选择及其三处调用，让已有 builtIn availability、role/harness grants、真实 permission、message switches 单独决定授权可用性。保持三个现有 canonical 实现，全部获授权时同时常驻声明。ProviderSchema 的 schema normalization 和真实 Provider 错误契约照常工作；没有已验证证据需要另增模型能力表、fallback、keyword routing、动态补工具缓存或 host gate。删除此规则是修复共享能力投影，不是新增 Work 专属文件通道。

在改动前 Root 核读方案并确定精确范围，保存现 registry/test 差异。聚焦正向测试应使用真实导出 projectableRuntimeToolIDs 与 exactRuntimeTools，在 gpt-6.1-sol、既有非 gpt、gpt-4/oss 分支的模型输入上验证授权 read/write/edit/apply_patch 的确切集合与可调用 schema；以既有 permission/switch primitive 验证明确当前授权集合，不能以“不调用/不存在”为核心。通过当前 occurrence fixture 验证 Work/Chat/Task root 的 revision-zero routine refs、实际工具定义及 catalog visible/call_tool 一致；用既有 task-owner delivery 场景验证 file创建→读取具体内容与最终交付状态。实际文件工具测试需独立临时项目、明确新文件内容与读回输出，禁止合成用户消息冒充真实链。必要错误测试只验证明确 typed error/错误码。

执行相关 formal typecheck、显式含全部触及测试 TSC 和聚焦正向 tests，保存真实失败及修复后结果。源码级集合检查只是局部合同。修改的 current architecture 若只删除违约实现可无需新增并行设计；历史方案和测试对互斥模型选择的陈述需在触及范围更新。Root 统一索引/docs检查、真实 UI 与提交。

下一实际场景必须先由 Root 对 PID67760/17953 的 exact owned chain 完成既有 publicshutdown、全退出事实与 paired cleanup，再以 fresh owned runtime/project/evidence 进行新的 paired credential+catalog+actual model三项核验。保留全部 LLM streaming、累计12预算、真实活动180s watchdog和独立 bounded handle admission。真实用户在 UI 用新的唯一 marker 要求 canonical Write→Read 新文件；不得预写目标、换 bash/patch、mock Provider、合成 tool消息或沿用旧 occurrence catalog。核验同一 accepted user occurrence 的真实 outgoing toolNames 包含 write/read，真实 write completed 回执、read completed 完整字节内容，以及同一 parent/accepted-input 的 assistant stop/time.completed、无 error。Root 再查看真实卡片/文件状态截图；UI Write 回执布局目标只有发生 canonical Write 后才可验收。

## 结论边界

已证明共享生产模型字符串过滤在 gpt-6.1-sol 上删掉角色已授予 write/edit，且目录和常驻装配继承该结果；与实际完整 write 搜索结果吻合。已排除“Work 本来只读”这一源码契约解释。未独立证明这轮 wire serialized toolNames、目标物理文件状态、模型若获得 Write 必然调用它或新 UI 回执表现；这些均须 Root 在精确实际链中验证。当前未改生产、测试或运行任何真实任务，本 artifact 是批准前源审查。

## Root implementation admission after actual occurrence cleanup

Root 已完整读取本审查、当前完整 registry、原 Task owner 模型分支及 experimental GET 工具定义公开调用。当前固定 Source 的六个实际 gpt-6.1-sol 流式请求均200，预算12未用尽；真实 final stop 只证明26s用户回复结算，不满足 Write/Read/86byte要求。Root 实际查目标仍未创建、31组 durable snapshot 成功，关闭仅owned tab24后通过精确 publicshutdown 完成 PID67760/whole observed chain/17953退出并独立移除两个copy，保留原 user/assistant/capability_search事实。Trace路径查询没有找到本run的JSONL，不能把此空查询当工具不存在或最终请求清单；原 wire declarations 仍unknown。

Root 批准删除唯一 registry 模型名称互斥函数及其三个使用点。已有 builtIn availability、harness/Role grants、真实permission、message switches、Skill独立初始化、Tool definition plugin和ProviderSchema归一化继续是当前各自契约；所有获授权 read/write/edit/apply_patch 同时可投影，模型自然选择。不得新增按Model/Role的替代特判、host选择文件工具、fallback、搜索补回已授权common工具、另一目录或提示白名单。本轮保留当前单一 registry 调用上下文与实验性HTTP query签名；这些仍是唯一当前调用契约，删除互斥实现不依赖另建旧协议路径。若参数变为未消费，先记录精确接口清理影响而非扩大到未验证SDK/API改造；不得保留旧过滤或双源。

授权代码仅registry及直接相关既有非UI工具投影/Role/Task owner交付测试（必要聚焦正向registry案例），先保存review before并按当前完整已授权集合修正旧model二分fixture。正向证明各模型实际导出的确切注册ID、初始化工具schema和Role routine/catalog/声明集合一致，实际本地小文件 write→read/edit/patch与Task交付状态；真实permission拒绝验证既有typed合同，不能核心断言工具不存在。MockLanguageModelV3只保流式局部Owner/工具执行测试，不能冒充真实Provider/E2E。formal后端TSC与触及全部测试显式TSC、直接聚焦checker均须完成，保原失败，其他queue/native/UI source冻结。

Root 的后续真正Sol场景仍用 **Work/Chat + Fullaccess** 保持同一复现条件，不能通过切Code掩盖共享根因；明确Code/Task是后续独立Role矩阵资格。先由单一audit真实观察最终发送的声明安全名称，fresh runtime/project/evidence重新paired staging/usable/projected/actualmodel/stream验证，既有12累计预算和真实180s活动监视。自然UI发送canonical Write→Read同一新文件，公共accepted input/tool/result/physicalUTF8和截图分别验证；在Write真实执行前，既有Write结果标签建议仍未具备actual visual acceptance。Root拥有最终接口review、真实运行、完整actualshutdown、native build及scope commit/upstream merge/push。Goal继续active。

## Implementation and verification (Sol owned slice)

Root admission was reread before edits. Before texts were saved at .tmp-product-iteration/write-authority-before-registry.ts.txt and write-authority-before-task-owner.test.ts.txt; unchanged task-routine-tools was also saved. Only registry.ts, existing Task owner delivery test, and new focused registry-file-authority test were changed. The unified review diff is live-sol-write-authority-implementation.diff.txt. No other production surface changed.

The model-name mutual exclusion function and all three uses were removed; registry JSDoc now describes available identity. BuiltIn availability, Skill separate initialization, exact identity validation, plugin definitions and all downstream grants/permissions/switches/schema normalization remain their existing single implementations. Registry model context is now unused by materialize/projectableRuntimeToolIDs; projectable's config/agent context was already unused. The current public signatures and sole experimental HTTP query remain per Root admission: cleanup would affect all SessionLoop materialization/projection callers, fixtures and experimental endpoint/SDK consumers, and is not necessary to remove the faulty behavior. This is an unused current context parameter, not retention of an old filter/fallback contract.

The new test verifies coding/chat/work across Sol, gpt-4, oss and non-gpt model identities: exact authorized read/write/edit/apply_patch IDs, actual initialized definitions, write input schema, permanent routine references and real catalog call_tool identity. Existing Role matrix still proves exact role-grant intersections, including restricted roles. Task owner delivery now uses gpt-6.1-sol for BOTH natural tool-choice scenarios and asserts all four file tools in actual MockLanguageModelV3 outgoing options. It retains real local canonical Write/Read/Edit and ApplyPatch/Read production tool execution, physical value=1→value=2 content, independent reviewer evidence, reused child lineage and completed Task outcome. The mock Provider proves streamed local Owner contracts; it does not prove real Sol or UI success.

Raw evidence is retained rather than overwritten: tests-01 passed before the catalog assertion was added; tests-02 failed because this new fixture initially granted execute but not discover_execute. registry-tests-final then failed because the positive next-owner expected object omitted its real tool_id. Both fixture contract errors were corrected against the canonical source; registry-tests-03 passed. explicit-types-01 exposed existing Task test stream literal widening, two unnarrowed settlement outcomes and its obsolete undefined Auth.get mock. These were fixed using LanguageModelV3StreamResult annotation, explicit final_message_id outcome narrowing and an obviously fake isolated mock API value (no real credential access). Subsequent explicit-types-02/final/04 retained new fixture errors: exact next-owner shape and optional native permission typing. Final permission assembly uses the existing CapabilityRules.merge primitive, matching production's existing rule semantics.

Actual verification commands:
- packages/opencorvus: bun run test test/capability/registry-file-authority.test.ts test/capability/task-routine-tools.test.ts test/task-owner-direct-delivery.test.ts (tests-final log: exit 0, 22 tests / 277 assertions; last registry-only rerun covers the final permission normalization).
- packages/opencorvus: bun run typecheck (formal-01 log, exit 0; production has not changed since).
- workspace: node --max-old-space-size=8192 packages/opencorvus/node_modules/typescript/bin/tsc --noEmit -p .tmp-product-iteration/write-authority.tsconfig.json (explicit-types-05 log; config text separately preserved as explicit-tsconfig.json for review, its relative paths are relative to the ORIGINAL .tmp execution location).

Correction to the earlier outgoing observation suggestion: session/llm.ts AgentTrace.recordLLMRequest is inside AgentTrace.isEnabled AND taskID. Work cannot rely on this existing Task-only trace. The loop context-diagnostics toolNames can show an owned Work assembled set, but actual serialized wire tool declarations remain unknown until Root captures the true request boundary; no empty trace query proves absence. No new audit implementation was added in this slice.

No UI automation, actual Provider, credential/model directory access, live process/UI manipulation, native build or Git action was performed. Index/docs integration, exact actual outgoing names, fresh Work/Chat canonical Write→Read physical bytes and UI visual acceptance remain Root-owned. Raw logs contain isolated checker facts, not private credentials.

Final freeze receipt: formal backend TSC exit=0; explicit touched-test TSC (05) exit=0; full focused batch exit=0 (22 pass / 277 expect); final registry-only checker (05) exit=0 (1 pass / 207 expect) after permission normalization. Production and test source are frozen for Root full review. The before texts, exact final unified diff and all raw failed/passing logs are retained. No outstanding local type/test failures remain; real Provider/Work/Chat/UI evidence remains required.
