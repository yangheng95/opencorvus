# Light Expert Squad

## Recall

### 用户原始要求

增加一个 `light` 专家团，只负责咨询、调查、提问等场景；专家团只包含 Planner 和 Investigator 两种角色，但允许同一个 Task 内并行运行多个 Planner 和多个 Investigator。

### 验收指标

1. 发布清单身份为 `builtin/light`，动态专家团成员恰好为 `light-planner` 和 `light-investigator`。
2. Planner 与 Investigator 都关闭基础工具继承，只获得规划、咨询、调查和澄清所需的精确读取、检索、既有 Artifact 读取与 Skill 能力；两者都不承担实现、写入、共享 memory 或外部执行责任。
3. Light 使用 manifest v1 的 direct-dispatch 合同，不把并行度固化为 `planner-1`、`planner-2` 等身份或固定节点数；一个 Orchestrator Turn 可提交多个同身份 `dispatch_agent` 调用，每次形成独立真实 Agent Session。
4. 包包含真实的 package-local Skill，并由 scheduler、Planner 和 Investigator 全部显式投影。
5. 源包、生成的桌面发布 payload、搜索本地化、安装后的有效投影和并行 dispatch 合同通过聚焦正向测试。
6. 首轮验证通过后，由未参与实现的独立 agent 只读复核完整差异、测试、文档和潜在回归；所有有效发现修复并复验。

### 硬约束

- 当前工作树包含 Mission、Session、Overlay 和既有规格的并行改动；本任务只拥有 Light 包、新测试、新规格及相应生成闭包，提交不得混入任何无关改动。
- Active Expert Squad 完整替换先前投影；不得从 Base 或 Advanced 继承成员、工作流或事实来源。
- Orchestrator 是唯一 Task 调度决策者；Light 不新增 Host 路由 gate、固定状态机、自动 dispatch 或第二套并发机制。
- 所有 LLM 交互保持流式；消息、问题和调查结果由真实 Orchestrator、Agent 与 Tool/Result 自然产生并可见。
- 非 UI 任务不新增、修改或运行 UI 自动化测试。
- 真实 Provider 验收和凭据使用不在本任务授权范围内。

### 已读资料

- `AGENTS.md`
- `specs/current/architecture/99-principles.md`
- `specs/current/architecture/11-agent-oop-protocol.md`
- `specs/current/architecture/08-agent-tool-adapter.md`
- `specs/current/architecture/04-extensions.md`
- `packages/sdk/js/src/expert-squad-manifest-v1.ts`
- `packages/opencorvus/src/agent/runtime-template-id.ts`
- `packages/opencorvus/src/agent/runtime-template-registry.ts`
- `packages/opencorvus/src/agent/tool-pool-data.ts`
- `packages/opencorvus/src/engine/workflow-binding.ts`
- `packages/opencorvus/src/engine/workflow-node-occurrence.ts`
- `packages/opencorvus/src/orchestrator/dispatch-agent-tool.ts`
- `packages/opencorvus/src/tool/execution-mode.ts`
- `packages/opencorvus/src/expert-squad/builtin/base/expert-squad.jsonc`
- `packages/opencorvus/script/generate-expert-squad-payload.ts`
- `packages/opencorvus/test/expert-squad-payload-sync.test.ts`
- `packages/opencorvus/test/expert-squad/shipped-skill-completeness.test.ts`
- `packages/opencorvus/test/tool-decision-coordination.test.ts`

### 全仓搜索结果

- `expert-squads/builtin/light` 不存在，当前没有同 ID 的源包或内嵌包。
- Manifest v1 的 `capability_projection.agents` 是 package worker 的唯一身份源；`orchestrator` 是保留的 Host 身份，不是专家团成员。
- `virtual_workflows: {}` 是当前架构定义的 direct-dispatch Squad 合同；它不固定人数或节点，一个 Task 可以按当前证据直接选择 projected worker。
- `ToolTurnExecutionCoordinator` 明确接受同一 assistant Turn 的多个 `dispatch_agent` 决策回执；direct binding 不创建 `workflow_node_id`，因此不同 dispatch lineage 可重复使用同一动态 Agent 身份并形成独立 Session。
- `delegated-worker` 的默认工具池包含写入能力，不适合直接继承；`explore` 不可挂载 Skill，且其基础池包含可写 `memory` 与 worker 通信能力。两个 Light worker 因此都复用 `delegated-worker` dispatch adapter，但关闭继承并使用完全相同的精确只读工具投影。
- `SkillMount.matrix` 是 operator-visible Skill 有效面；它能同时证明 projected runtime 可挂载 Skill、`skill` 工具可用、manifest grant 已生效且 package Skill 为 `enabled: true`。
- 发布 payload 由 Git index 中 `expert-squads/builtin/**` 的 tracked bytes 生成；新增源包必须先精确 stage，再重建 `generated/expert-squad-payload.ts` 和搜索本地化闭包。
- shipped Skill checker 要求每个发布包至少有一个落盘 `skills/**/SKILL.md` 且被有效投影。

### 独立 agent 反馈

首轮实现和验证后，未参与实现的 `light_squad_independent_review` 只读审查发现三项有效问题：

1. `explore` 不可挂载 Skill，且继承的 `memory`、通信工具破坏严格只读与并行无共享可变状态合同；Planner 也误获 `memory`。修复为两个角色都使用 `delegated-worker`、关闭继承并投影同一精确只读工具集。
2. 首轮测试只验证 direct binding 和通用 Turn coordinator，没有通过真实 `dispatch_agent` 创建 Session。修复为 production-shaped 测试：同一 Task 并发执行两个 Planner 与两个 Investigator 调用，在同步屏障处证明四个真实 child Session 同时 in flight，并核对 lineage 与 descriptor。
3. worker 与 Orchestrator 提示词把最终消息和未定义 schema 的持久化 Artifact 混成两个结果事实源。修复为每个 worker 的完整可见 final assistant message 是唯一 Light dispatch 结果，Orchestrator 读取其引用的现有工具证据；Light 不定义第二种 package-specific Artifact 协议。

修复和复验后，`light_squad_independent_review` 完成第二轮独立只读审查，结论为通过且无未解决发现。审查确认两个 worker 的精确只读工具面与 Skill enabled 事实、真实 `dispatch_agent` 四 Session 重叠路径、lineage/descriptor/lifecycle 证据、visible final assistant message 单一结果事实源、生成闭包和本地化均与当前合同一致。残余边界是未使用真实 Provider、真实用户 `question` 往返或实际容量上限运行；本任务不包含 UI 源码改动，无视觉验收要求。

## 问题深度与影响面

### 可观察现象

当前目录、payload 和 Market 搜索事实中没有 `light` 专家团，用户无法选择一个明确排除实现责任、只面向咨询/调查/提问的轻量团队。

### 直接触发点

用户需要一个比 Base 更窄的 package-owned capability projection，并要求角色种类固定为 Planner 与 Investigator，同时并发数量不被清单身份数限制。

### 数据与控制流根因

这不是调度器缺少一种 native role，也不是现有专家团上的开关缺失。Expert Squad 的事实来源是独立 manifest 包；没有 `builtin/light` 包，就没有可安装、可检索、可绑定版本、可投影 Skill/Agent 的 Light 身份。并发已由 `dispatch_agent` fan-out 和每次 dispatch 的独立 Session lineage 提供，新增 Host 并发机制会形成双源。

### 旧路径未根治原因

不适用：当前不存在 Light 的旧实现、fallback 或兼容路径。Base 能执行调查，但还拥有 Developer/Tester 与实现工作流，扩大或条件化 Base 会破坏其现有契约，并不能形成独立的窄能力包。

### 定义、调用点与公共契约

- 定义：新增 `expert-squads/builtin/light/expert-squad.jsonc`、selector、README、scheduler/worker prompts 和 package Skill。
- 读取与准备：复用 `ExpertSquadRegistry`、manifest v1 schema、`PromptProfileResolver` 和现有 package resource closure。
- 调度：复用 `dispatch_agent` direct binding、assistant Turn fan-out、独立 child Session 和既有 Task lifecycle；不修改公共 API、route、SDK schema 或数据库。
- 发布：更新生成的 payload 与搜索本地化模块；Market、安装和 catalog 继续消费同一 payload 事实源。

### 数据、测试、文档与交付

- 数据迁移：无。新包是不可变版本 `2026.08.29.1`，旧 Task 不受影响。
- 测试：新增 Light package 的源包/发布安装/有效投影/direct fan-out 正向契约；运行 payload sync、Skill completeness、topology、expert-squad types 和 docs checker。
- UI：无 UI 源码改动，不运行 UI 自动化；Market UI 继续读取生成 catalog，静态包/route 事实由非 UI checker 覆盖。
- 交付：精确提交本任务文件，先拉取并 merge upstream，检查 `upstream..HEAD` 后通过正常 hook push 当前分支。

### 风险与未知

- `universal-build` 是平台始终投影给 scheduler 的非成员能力。Light scheduler prompt 必须明确禁止在咨询/调查/提问范围内选择它；manifest 成员与公开 catalog 仍只有两种角色。
- “多个”不应解释为固定的两个或固定上限。使用 direct-dispatch 保持运行时按问题分区决定 fan-out 数量；实际 Provider 并发上限仍由平台全局容量配置管理，本任务不改变容量。
- 当前无真实 Provider/长任务运行授权，因此本任务验证到 production-shaped package 安装、resolver 投影和 dispatch 决策合同；不把 deterministic contract 冒充真实模型质量验收。

## 实施方案

1. 新增 `builtin/light` 自包含包：两个动态身份共享 `light/shared/method`，scheduler 声明 `{}` workflows 并只为咨询、调查、澄清问题调度。
2. Planner 与 Investigator 都使用 `delegated-worker` adapter、关闭基础工具继承，只显式投影读取、搜索、能力发现和 Skill；角色差异仅来自身份、prompt 和责任，不来自额外可变或执行工具。
3. 在 prompts 与 Skill 中定义并行分区规则：每次 dispatch 必须有独立、非重叠问题范围；同身份可产生多个 sibling Session；结果由 Orchestrator 在后续 Turn 读取真实可见 final assistant messages 后综合或提出问题。
4. 新增聚焦测试，验证安装后的精确成员/Skill/工具投影、Skill 有效面、空 workflow 合同，以及同一 Task 中两个 Planner 与两个 Investigator 真实 dispatch fan-out 的并发 Session、lineage 和 descriptor 正向事实。
5. 精确 stage 新源文件后重建 payload 与搜索本地化，运行聚焦检查、文档检查和差异检查。
6. 完成独立只读审查；修复有效发现、复验、提交、merge upstream、检查待推送集合并 push。

## 验证命令

```powershell
bun test packages/opencorvus/test/expert-squad/light-package.test.ts
bun test packages/opencorvus/test/expert-squad-payload-sync.test.ts packages/opencorvus/test/expert-squad/shipped-skill-completeness.test.ts
bun run check:expert-squad-topology
bun run check:expert-squad-types
bun run docs:check
git diff --check
```

## 验证结果

- Light 包聚焦测试：3 pass，39 次正向断言；其中真实 `dispatch_agent` 测试创建两个 Planner 与两个 Investigator sibling Session，在四个 `SessionProcessor` 同时进入同步屏障后才释放，并核对四个独立 dispatch lineage、descriptor、相同 Orchestrator assistant Message 归属、`use_worktree: false` 与 terminal lifecycle。
- payload sync 与 shipped Skill completeness：3 pass，244 次断言；生成模块与 Git index 中的源包字节一致，Light 的 package-local Skill 可保存、选择和加载。
- Market discovery chain：3 pass，590 次断言；中文咨询请求可发现、排序并安装 Light，且本地化不修改 package bytes。
- Expert Squad topology：120 manifests、133 workflows、11 flat planner-parallel workers、93 parallel-workers-join、29 dependency DAG；checker 通过。
- Expert Squad TypeScript checker、`packages/opencorvus` typecheck、`docs:check`（338 operations、25 groups）、Prettier 和 `git diff --check` 全部通过。
- 本任务不使用真实 Provider 或凭据，因此未验证模型在真实咨询质量、真实提问交互或容量上限下的行为；该边界不冒充为端到端模型验收。
