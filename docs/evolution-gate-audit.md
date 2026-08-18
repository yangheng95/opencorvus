# Evolution 链路 gate 扫荡（Phase 6 四问）

日期：2026-08-18
依据：`docs/host-reform-plan.md` 宪法第 5 条与 Phase 6 四问
证据：luna1–luna13 隔离运行；`scratchpad/research-*.md` 五份业界调研

## 规模

| 位置 | 门数 |
| --- | --- |
| `tools/publish-evolution-artifact.ts` | 41 |
| `tools/execute-evolution-metrics.ts` | 16 |
| `lib/evolution-lab/comparison.ts` | 16 |
| `lib/evolution-lab/candidate-integrity.ts` | 9 |
| `tools/rehydrate-evolution-resources.ts` | 6 |
| `tools/expert-squad-package.ts` | 4 |
| `src/expert-squad/evolution-mutation.ts`（宿主） | 15 |
| `src/expert-squad/evolution-history.ts`（宿主） | 12 |
| ABI schema `superRefine` | 6 |
| **合计** | **125** |

先前一直引用的「53 道」低估了一倍以上。

## 分类轴的修正

最初的判据是「门保护什么边界」。真实运行的证据要求换一个更准的轴。

门本身**不直接杀 campaign**：工具报错回到模型，模型可以重试。campaign 死于
`semantic_limit` 耗尽（`task-root-ingress-reducer.ts:422`）——重试次数用完，Task 失败，
Mission 随之终止。luna12 的终态错误原文即 "the control plane recorded an exhausted
semantic-limit ingress"。

所以真正的判据是：**模型能否从错误信息里自纠？**

- **可自纠**：错误点名了要改什么，且模型有能力produce它。代价是一次重试。
  luna11 观测到两例真实自纠：多传 `reason` 键、续跑身份写错（24 秒后成功）。
- **不可自纠**：要求模型逐字复现高熵派生数据，或声明它并不拥有的事实。
  重试不会提高成功率，只会消耗 semantic 预算。**这类门是伪装成重试循环的死刑判决。**

luna12 的 10 次发布失败里，7 次属于不可自纠（64 位摘要正则），2 次属于可自纠
（JSON 畸形、多余键）。

## 三类处置

### 一、删除并由宿主盖章（不可自纠，最高优先级）

模式：`X must equal the exact Y`。宿主已经算出 Y，然后要求模型提交一份逐字节相同的
X。四问全不及格——Q1 产生者是模型自己的载荷而非进程外事实，Q2 发布工件是一次可逆
append 而非不可逆 effect，Q3 无普通出口，Q4 冻结整个 Task。

| 门 | 状态 |
| --- | --- |
| `candidate parent revision must equal its exact development campaign target and baseline` | **已改**（2026-08-18，改为从 parent resource set 证明） |
| candidate 的 revision/manifest/changed_paths/diff/frozen_files/receipt 比对（8 字段） | **已改**（发布器盖章） |
| `evaluation-result identity and values must equal the exact metric receipt` | 待改 |
| `run-evidence-bundle does not equal a fresh collection of authoritative Task facts` | 待改 |
| `run-evidence-bundle does not match its canonical collector and package revision facts` | 待改 |
| `comparison-recommendation must equal the deterministic Campaign, Candidate, run, and evaluation matrix` | 待改 |
| `campaign-spec resource set must equal every exact frozen campaign input` | 待改 |
| `integrity-review slot identity must equal its exact evaluation result` | 待改 |

宿主面同源缺陷已于同日修复：证据定位器、mailbox、orchestrator decision、
complete_task 四个入口改为 Input 变体 + 宿主盖章（见
`specs/records/2026-08/2026-08-18-model-transcribed-content-digests.md`）。

### 二、保留（可自纠，且点名了真实边界）

这些门的错误信息足以让模型下一次调用就改对，代价是一次重试：

- `failure-attribution requires exactly one opportunity Engine Artifact source`
- `candidate authoring requires an exact development campaign`
- `comparison requires exactly one campaign-spec and one candidate-revision source`
- `comparison has undeclared / duplicate ... slot ${key}`（点名了具体 slot）
- `... is not exact canonical JSON` / `is not readable JSON text`

**保留的前提是错误信息必须写出 expected/received**（见记忆
`model-facing-errors-need-expected-value`）。已验证有效：给续跑身份错误补上
「该 agent 的确切可续跑身份列表」后，luna11 里模型 24 秒自纠成功。

### 三、降级为评分，不再是门（质量判断）

这些门表达的是「候选质量不够好」，而不是「边界被跨越」。业界共识是坏候选丢弃后
继续（DGM：「其余全部丢弃」；ADAS：失败候选以低分存档而不中断整轮；OpenEvolve：
「Individual failures don't crash system」）。

- `candidate parent mutable path closure must equal its exact development campaign`
  ——出面即判该候选不可用，不应杀 campaign
- `comparison evaluation slot ${key} does not contain the exact scorer set`
- `comparison run slot ${key} differs from the frozen Campaign runtime`

处置：产出 typed 的 `infeasible` 终态而非抛错，让比较阶段把它当作一个失败样本计入。

## 与业界的结构差距（不在门的范围内，但同因）

五份调研的一致结论，按可执行性排序：

1. **失败模型颠倒。** 六个进化系统全部「坏候选丢弃、循环继续」；我们是任一门失败
   杀全轮。合取可靠性：0.95^53 ≈ 6.5%，0.97^53 ≈ 21%。0/13 无需其他解释。
2. **N=1 无统计内容。** 配对设计 + McNemar 检验是正确形式，但仍需数十例；
   实践下限 20–50。位置偏置翻转 22–30% 判决；15 裁判研究中全体一致仅 23%。
3. **单 agent 对照。** arXiv 2606.05670：六个多 agent 系统中至多一个超过匹配的单
   agent 基线；「交接会压缩上下文并隐藏约束」。7 agent 收敛回路正是输得最多的形状。
4. **MAST（1600+ trace）**：79% 的真实多 agent 失败是规格与交接问题，非推理问题。
   我们的失败日志全部落在这两类。
5. **无人在生产跑全自主自我修改。** 促升决策一律留给人。

## 执行顺序

1. 第一类剩余 6 处改为宿主盖章（纯宿主代码，无需模型配合）
2. 第三类 3 处降级为 typed infeasible 终态
3. 第二类逐条补齐 expected/received
4. 以上完成后再谈 N=1 → 20 和候选池——那是算法层，不是门层

前两步预计能把不可自纠门清零，这是 0/13 里最大的单项因子。
