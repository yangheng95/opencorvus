# Dynamic Expert Squad

## Recall

### 用户原始要求

调查 Codex 和 Claude 为何能够轻量生成 Agent Team，并在专家团入口增加一个名为 `dynamic` 的机制。该机制应按当前请求即时生成动态 team 和 workflow 描述，避免让用户等待现有冗长、复杂的专家团生成算法。

### 验收指标

1. 发布清单新增可安装、可选择的 `builtin/dynamic`，其用途与永久专家团包生成入口 `builtin/squad-sdk` 清晰分离。
2. Dynamic 的 Orchestrator 不先调用 Agent 或 authoring 工具生成专家团；它在首个调度 Turn 的同一条可见流式 assistant 消息中直接写出最小 team 描述和 workflow 依赖描述，并立即提交当前 dependency-ready frontier。
3. 动态成员是本 Task 内的临时 Session 实例。每个成员有本轮生成的短名称、目标、能力模板、边界、输出和依赖；运行身份只复用 manifest 固定投影的 `dynamic-generalist` 或 `dynamic-builder`，不运行时改写 active package。
4. `virtual_workflows: {}` 明确表示 direct-dispatch；动态 workflow 描述是 Orchestrator 的可见本轮编排说明，不是第二个 Host workflow engine、隐藏状态机、持久化 Task Board 或新的事实来源。
5. 同一 Orchestrator Turn 可对同一个 projected Agent identity 发出多个独立 dispatch，并形成多个具有独立上下文、lineage 和 Session identity 的并行真实 Session。
6. Dynamic 包含并显式投影一个 package-local Skill；源包、生成 payload、中文搜索投影、安装后 capability projection、direct binding 和同身份并行 Session 通过聚焦正向测试。
7. 首轮验证通过后，由未参与实现的独立 agent 只读审查完整差异、测试、规格、生成闭包和潜在回归；所有有效发现修复并复验。

### 硬约束

- 当前工作树已有 Session 格式化、网站分发元数据和规格索引的并行改动。本任务只拥有 Dynamic 源包、Dynamic 测试、Dynamic 规格、中文搜索条目以及由这些源产生的精确生成闭包；不得混入或回退其他改动。
- Active Expert Squad 与 Task 的精确 package revision 继续冻结；Dynamic 不运行时创建 manifest identity、修改 `prompt_profile.active`、安装新 package 或把临时角色写入 catalog。
- Orchestrator 是唯一调度决策者。不得新增 Host 路由 gate、关键词匹配、自动 frontier、workflow state、并发运行器或第二套 Session 生命周期。
- 所有 Large Language Model（LLM，大语言模型）交互继续流式；team/workflow 描述、dispatch、worker 消息、Tool/Result 和最终综合都由真实参与者自然产生并完整可见。
- `squad-sdk` 继续唯一负责持久、可复用、可安装的专家团生成；Dynamic 不调用 `expert_squad_author`、`multica_import` 或 evolution 路径。
- 非 User Interface（UI，用户界面）任务不新增、修改或运行 UI 自动化测试。
- 真实 Provider、凭据和模型成本不在本任务授权范围内；确定性运行时测试不得冒充真实模型质量或端到端语义验收。

### 已读资料

- 用户提供的仓库级 `AGENTS.md`
- `specs/current/architecture/01-agents.md`
- `specs/current/architecture/04-extensions.md`
- `specs/current/architecture/08-agent-tool-adapter.md`
- `specs/current/architecture/11-agent-oop-protocol.md`
- `specs/current/architecture/14-agent-runtime-mode.md`
- `packages/sdk/js/src/expert-squad-manifest-v1.ts`
- `packages/opencorvus/src/agent/dispatch-adapter-contract.ts`
- `packages/opencorvus/src/agent/dispatch-adapter-input.ts`
- `packages/opencorvus/src/agent/runtime-template-registry.ts`
- `packages/opencorvus/src/agent/tool-pool-data.ts`
- `packages/opencorvus/src/engine/workflow-binding.ts`
- `packages/opencorvus/src/orchestrator/dispatch-agent-tool.ts`
- `packages/opencorvus/src/tool/expert-squad-author.ts`
- `expert-squads/builtin/squad-sdk/**`
- `expert-squads/builtin/light/**`
- `packages/opencorvus/test/expert-squad/light-package.test.ts`
- OpenAI 官方 Codex Subagents、Multi-agent 与模型提示词指南：<https://developers.openai.com/codex/agent-configuration/subagents>、<https://developers.openai.com/api/docs/guides/responses-multi-agent>、<https://developers.openai.com/api/docs/guides/latest-model>
- Anthropic 官方 Agent Teams 与 Dynamic Workflows 指南：<https://code.claude.com/docs/en/agent-teams>、<https://code.claude.com/docs/en/workflows>

### 全仓搜索结果

- 当前没有 `builtin/dynamic`、同 ID 源包、翻译或运行时特殊分支。
- `capability_projection.agents.<agent-id>` 是 worker runtime identity 的唯一 package 来源；`base_role` 只选择既有 runtime template、Session kind、adapter 和 Tool seed，不是可调度身份。
- Manifest v1 允许 `virtual_workflows: {}`。当前架构把它定义为 direct-dispatch：没有预声明 node 数、Host frontier、step state 或一次性 workflow occurrence fence。
- `dispatch_agent` 已按 exact projected identity 生成真实 child Session 和 immutable dispatch lineage。同一 direct-dispatch Task 可以重复使用相同 target identity；每次 initial dispatch 仍有独立 Session、message authority、dispatch ID 和 workflow occurrence。
- `ToolTurnExecutionCoordinator` 与 detached dispatch pipeline 已支持同一 assistant Turn 的多个 dispatch call；不需要新增并发执行层。
- 平台现有 `delegated-worker` 提供通用调查、规划、验证和协作能力；`build` 提供 Task-scoped mutation、验证、commit 和 managed-worktree merge contract。二者足以作为动态成员的最小 capability envelope。
- `squad-sdk` 当前拥有四个固定 worker、两张 Planner-first binding workflow，并在完整分析/审查后调用 canonical writer 或 importer。该路径正确服务永久 package 生产，但其多轮证据图、安装、digest 与 closure 验证正是即时 Task team 不应支付的延迟。
- `light` 已证明 direct-dispatch 能让多个相同 Planner/Investigator identity 在一个 Turn 形成并行 sibling Sessions，但它是严格只读咨询边界，不能替代通用 Dynamic。
- 分发闭包由 `generate-expert-squad-payload.ts` 和 `generate-expert-squad-search-localization.ts` 产生；中文搜索 projection 要求每个 payload package 都有审阅过的中文条目。

### 独立 agent 反馈

第一轮独立只读审查发现 2 项 P1 和 2 项 P2：Generalist 错投影会启动进程的 `browser_preview`；运行时测试未把可见 team/workflow Text Part、dispatch Tool Part、lineage、终态与 Builder adapter 串成同一正向证据；Market 暂存混入 Base 与 evolution-lab 的无关格式化；规格缺少 Codex Subagents 一手资料和实际收据。四项均已接受并修复：移除该权限并重生成发布闭包；增强测试为同一 Orchestrator assistant Message 的增量 Text Part 与三个 dispatch Tool Part，两个 Generalist 和一个经生产 Build adapter 的 Builder 重叠运行；Market index 只保留 Dynamic hunk；补入本资料和验证记录。

第二轮独立只读审查发现 1 项 P1 和 1 项 P2：测试中的可见 workflow 曾写成 `source-a || source-b -> implementation-owner`，但三者实际同批 dispatch；本轮触及的 Market 测试仍保留“不包含 localization 文件”的负向断言。两项均已修复：三个成员现在明确拥有互不依赖的 ready partition，可见 workflow 与实际并发统一为 `source-a || source-b || implementation-owner`；Market 测试删除负向 loop，仅保留每个发布包都有三项中文 localization projection 的正向契约。第三轮独立审查在复验后执行。

第三轮独立只读审查继续发现 1 项 P2：同一 Market 测试还有“code 查询不含 commercial-legal”和“安装后 available 查询不含 commercial-legal”两条历史 absence 断言。两条均已替换为正向状态契约：删除不产生结果的冗余 code 查询；正向核验 install receipt、`availability=installed` 市场中的 project-scoped commercial-legal，以及 effective catalog 中的同一包。第四轮独立审查在复验后执行。

第四轮最终独立只读审查确认上述闭环、完整 staged 差异、生成闭包、正向测试、60 秒路由预算、Market 精确 hunk 和架构边界均一致，结论为“无未解决发现”。

## 调查结论

### 可观察现象

用户所说的“轻量”不是较快地运行一套专家团 package 生成算法，而是根 Agent 在已有权限和 Session primitive 上即时决定是否拆分、拆成几份、哪些可并行，并直接创建短生命周期 worker。当前 OpenCorvus 若把 `squad-sdk` 当成这一入口，会先产生永久 package blueprint、独立分析和 contract review，再物化、校验并安装 package；用户要等完整生产线结束后才能开始真正任务。

### Codex 与 Claude 的共同模式

1. Lead/root 直接持有本轮计划：用自然语言给 worker 命名并分配有界任务，而不是先生成一份完整插件或 agent manifest。
2. Host 只提供少量通用原语和安全边界：spawn/dispatch、message、wait/idle notification、interrupt、list/task status 和并发上限。
3. 每个 worker 是独立 context/session；独立分区可并行，结果回到 lead 综合。
4. 角色描述是 spawn-time instruction 或可复用 capability definition；team 的临时成员表不是项目级永久配置。
5. 只有大规模、可重复、需要脚本变量/循环/恢复的场景才把 workflow 提升为可审阅脚本。普通少量协作仍由 lead turn-by-turn 编排。

OpenAI 的 Codex Subagents 文档明确把该机制定义为 Codex 并行启动专门 Agent thread、回收结果并由主 thread 综合；Codex 负责 spawn、follow-up、wait 和 close，子 Agent 默认继承 parent model、reasoning 与 sandbox/permission，且建议优先并行 read-heavy 的有界工作、谨慎处理并行写。Responses API 的 Multi-agent 指南进一步说明 root model 按需创建并协调有界并行 workstream，小任务、严格顺序和固定 deterministic graph 通常更适合单 Agent。Anthropic 的 Agent Teams 同样由 lead 根据自然语言直接 spawn 独立 teammate；其最新 Dynamic Workflows 则用于 dozens-to-hundreds 规模，把循环和中间变量提升到 runtime script。两者都没有要求先运行领域专家团 authoring pipeline。

### 直接触发点与根因

- 直接触发点：用户选择 Dynamic 并提交一个需要按当前内容自适应拆分的 Task。
- 数据/控制流根因：OpenCorvus 当前 catalog 只有固定 package roster/workflow，临时执行与永久 package authoring 在产品入口上没有清晰分工；因此用户只能选固定图，或误用 `squad-sdk` 先生成一个持久 package。
- 旧路径未根治原因：`squad-sdk` 的 digest、Skill closure、source/license、contract review、atomic import 和 inactive-install 语义是永久复用 package 必需的，删除这些步骤会破坏其契约；优化它不能得到真正的临时 team。正确修复是增加一个独立的 direct-dispatch Dynamic package，复用现有 runtime primitives，而不是削弱 authoring。

## 设计

### 唯一运行模型

`builtin/dynamic` 声明两个固定 capability envelope，而不是固定 team roster：

- `dynamic-generalist`：`delegated-worker` runtime，用于调查、规划、比较、审查、验证、综合和非专用工作；同一 Task 可并行复用多次。
- `dynamic-builder`：`build` runtime，用于明确需要 repository mutation、真实检查、commit 和可选 managed-worktree merge 的成员；同一 Task 可按不重叠 ownership 复用多次。

临时成员的实际角色由 Orchestrator 在 dispatch instruction 中生成，例如 `api-investigator`、`migration-owner`、`acceptance-challenger`。这些名字是本轮描述，不是 runnable agent ID、package record、alias 或第二身份源。`dynamic-generalist` 和 `dynamic-builder` 是仅有的 exact dispatch targets。

### 单 Turn 快速路径

在首次 domain dispatch 前，Orchestrator 直接在当前流式 assistant 消息写出两段紧凑描述：

1. `Dynamic team`：每个临时成员一行，含短名称、target capability、单一责任、边界和预期输出。
2. `Workflow`：用 `A || B -> C` 或等价简短依赖表表达当前 ready frontier 和 join；无并行价值时只声明一个成员。

描述完成后，同一个 assistant Turn 立即调用 `dispatch_agent` 提交所有 ready members。此路径没有额外“生成器 Agent”调用。后续证据若实质改变分区，Orchestrator 以可见消息说明 delta 并继续/补充 exact Session lineage；不建立隐藏 mutable plan。

### 调度与安全边界

- 优先一个 Agent；只有独立、边界清晰且并行收益真实时才增加成员。
- 并发 member 必须拥有不重叠的事实分区或文件 ownership；共享 mutable state、同文件编辑或严格顺序改用串行 continuation。
- mutation 由 `dynamic-builder` 承担；调查/计划/独立 challenge 默认由 `dynamic-generalist` 承担。需要命令或 UI 证据时必须匹配实际 projected Tools，不能仅凭生成的角色名假设能力。
- Orchestrator 从真实 worker messages、Tool/Result、Artifacts、Host observations 和当前 state 综合；临时 workflow description 本身不是完成证据。
- Task 仍绑定 `direct` workflow authority。Dynamic 不写入 manifest workflow、Task Board、Goal、Delivery Slice 或 package authoring provenance。

## 影响面

### 修改

- `expert-squads/builtin/dynamic/**`：manifest、selector、scheduler/worker prompts、README 与共享 Skill。
- `packages/opencorvus/test/expert-squad/dynamic-package.test.ts`：package projection、payload install、direct binding 和同身份并行 real Session 契约。
- `packages/web/src/content/public-market-zh-*.ts`：Dynamic 的中文搜索 projection。
- `packages/opencorvus/generated/expert-squad-payload.ts` 与 `expert-squad-search-localization.ts`：由源生成的发布闭包。
- `specs/README.md`、`specs/records/2026-08/README.md` 与本记录。

### 明确排除

- 不修改 manifest schema、dispatch ABI、Session/Task lifecycle、PromptProfileResolver、Manager、Overlay component 或 route。
- 不新增 UI 自动化、浏览器 fixture、snapshot 或静态 DOM 测试。
- 不修改 `squad-sdk`、`evolution-lab` 或 `light` 的职责。
- 不运行真实 Provider 语义验收；真实模型是否稳定生成高质量 team/workflow 描述在本轮保持未验证。

## 实施与验收计划

1. 新增 Dynamic package，保持 `virtual_workflows: {}`，投影共享 Skill 和两个 capability envelope。
2. 新增中文搜索条目，运行 payload 与 localization generator。
3. 新增聚焦正向测试：加载源包、安装发布 payload、解析 exact scheduler/worker capability、验证 direct binding，并让同一 Turn 对 `dynamic-generalist` 发出多个并行 dispatch，确认独立 Session/lineage/terminal lifecycle。
4. 运行 Dynamic 聚焦测试、payload/localization sync、shipped Skill completeness、built-in topology checker、Expert Squad TypeScript checker 和文档 checker；不得运行 UI 自动化。
5. 委托独立 agent 只读审查完整差异与证据；修复有效发现并重跑相关验收，直到无未解决发现。
6. 仅暂存本任务 hunks，创建范围清晰提交；fetch 并 merge upstream，核验 `upstream..HEAD`，必要时复验后 push。

## 实施与验收收据

- `bun test packages/opencorvus/test/expert-squad/dynamic-package.test.ts`：2 pass、0 fail、29 个断言。安装/投影测试确认两个 exact capability envelope、package-local Skill 和 direct-dispatch；运行时测试在同一 Orchestrator assistant Message 先增量持久化 `Dynamic team`/`Workflow` Text Part，再持久化三个 `dispatch_agent` Tool Part，并让两个 Generalist 与一个经生产 `createBuildTool` adapter、受控 physical runner seam 的 Builder 形成三个重叠 sibling Sessions。三者均有 descriptor、direct lineage、同一 Message/对应 Tool Part authority 和终态可见投影；Generalist 经过真实 delegated-worker/SessionProcessor pipeline，Builder 专门证明生产 adapter 到 Build Session 的映射，未冒充完整真实模型 Build 执行。
- `bun test packages/opencorvus/test/expert-squad-payload-sync.test.ts`：2 pass、0 fail、3 个断言；fresh render 与 repository tooling 闭包均一致。
- `bun test packages/opencorvus/test/expert-squad/market-discovery-chain.test.ts`：3 pass、0 fail、478 个正向断言。新增第 121 个发布包后，两项生产路由用例在当前并行工作树负载下分别出现约 28.4 秒和超过默认 5 秒的运行时间，因此把二者显式预算修正为 60 秒；最终单文件重跑分别约 4.5 秒和 4.2 秒并通过，不改变产品实现或业务断言。
- `bun test packages/opencorvus/test/expert-squad/shipped-skill-completeness.test.ts`：1 pass、0 fail；121 个 shipped package 的实际 Skill 闭包均可加载和选择。
- `bun packages/opencorvus/script/check-builtin-expert-squad-topology.ts`：通过，输出 `{"manifests":121,"workflows":133,"flat_planner_parallel_workers":11,"parallel_workers_join":93,"dependency_dag":29}`。
- `bun run check:expert-squad-types`：通过。
- `bun run docs:check`：通过，`docs:check ok (338 ops, 25 groups)`。
- 生成命令 `bun ./packages/opencorvus/script/generate-expert-squad-payload.ts` 与 `bun ./packages/opencorvus/script/generate-expert-squad-search-localization.ts` 均成功；Generalist 源与生成闭包不再含进程型 `browser_preview`。
- UI 自动化未运行；本任务未改 UI component。未使用真实 Provider 或凭据，真实 Codex/Claude 模型在不同请求上生成 team/workflow 描述的语义质量、首 token 延迟和成本仍是明确未验证边界。
