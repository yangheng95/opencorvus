# OpenCorvus 论文生产前置证据基础包

Status: implementation package committed; independent workflow review pending; push blocked by unrelated outgoing commit

## Recall

| 项目 | 记录 |
| --- | --- |
| 原始要求 | 在 OpenCorvus 仓库内核验论文、架构、实验、图表、证据与集成材料的正式落点和并行写入边界；建立可直接由后续学术综合消费的内部证据基础包；严格区分已实现、部分实现、规划中、概念设计；真实核验 AutomationBench、七角色案例、默认 Expert Squad 数量和自进化边界。 |
| 验收指标 | REQ-1 至 REQ-12：正式方案与 Recall、唯一落点/边界、机器/人工证据矩阵、四级状态、AutomationBench 审计、七角色过程证据、Squad 三层清单、自进化缺口、图表输入、真实聚焦检查、独立只读审查、范围清晰提交与上游同步。 |
| 硬约束 | 只修改本任务拥有的 `specs/records/2026-08/2026-08-26-opencorvus-paper-foundation-evidence.md`、两个 specs 索引及 `specs/artifacts/opencorvus-paper/**`；`specs/current/architecture/**`、`packages/web/**`、`packages/opencorvus/**`、`expert-squads/**` 只读；不运行用户界面自动化测试；不伪造 benchmark 数据、历史事件或安装状态；不泄露凭据；不操作用户进程。 |
| 已读规则与当前权威 | `AGENTS.md`；`package.json`；`specs/current/architecture/{README.md,01-agents.md,02-data.md,04-extensions.md,task-control-plane.md}`；`specs/records/2026-08/{README.md,2026-08-22-website-data-analysis-expert-squad-demo.md,2026-08-25-landing-automationbench-proof.md}`；`specs/README.md`；指定网页常量/测试、内置包加载面和七角色 manifest。架构目录 28 项和当月记录目录已枚举，后续矩阵引用调查 Artifact 已完整核验的精确位置，不重写当前架构。 |
| 已读任务 Artifact | `IntentAnalysis`、`RequirementSet`、`OpenCorvus 论文生产前置仓库证据调查包`、`ArchitectContractGraph`、`GoalGraphProjection`、首轮 Build Host observation、Mission acceptance resume receipt；均已完整读取并选择为本交付语义来源。 |
| 全仓搜索结果 | AutomationBench 的 100/8.07/34 只定位到网站 typed 常量、正向常量测试和 dated 网站记录，没有版本化数据集、100 个 case、评价器、逐 case 结果、重复运行或统计入口；四个 embedded Squad 由架构和 `getLoadedBuiltInPackages()` 唯一加载面交叉支持；七角色 DAG 与历史事件记录可交叉核验；自进化拥有 typed Artifact、mutation/history/route 和聚焦测试原语，但效果证据不闭合。 |
| 开始工作区 | 本次恢复 occurrence 首次 `git status --short` 为空。更早调查曾观察 8 项无关 `packages/opencorvus` 差异；本 Session 首次检查曾观察 11 项 package 差异和两个索引并发改动；首轮 Host observation 另记录 3 项 SDK 生成差异。恢复后它们均已由外部所有者收敛，不在本任务起点差异中。本任务不接管、不编辑、不暂存这些路径。 |
| 独立审查 | 当前为“无”；首轮验证通过后委托未参与实施的 Advanced reviewer 只读审查完整差异、证据、验证和潜在回归，并把发现及处置写回本记录。 |

## 影响面与证据策略

- 可观察现象：当前仓库有分散的架构、网页、历史案例和自进化材料，但没有任务专属、机器可读且带写入边界的论文前置基础包。
- 直接触发点：论文后续研究若直接消费营销常量、历史标题或终态，会把“展示一致性”“报告存在”“机制原语存在”错误升级为实验复现、过程正确或效果提升。
- 数据与控制流根因：材料由不同权威生产，缺少一个任务专属 manifest 把主张、状态、精确来源、可引用性、未知、补证条件和下游独占面统一起来。
- 旧路径未根治原因：网站 typed 常量只负责展示；历史案例记录只负责一次运行；当前架构只负责实时系统契约；它们均不应成为论文综合的第二份或聚合事实源。
- 相关定义/调用/契约：本任务不修改公共接口或产品代码；所有生产路径只读。机器材料以稳定 JSON 字段表达来源和限制，人工 Markdown 解释允许与禁止结论。
- 测试与交付：运行 JSON 全解析、文档 checker、`git diff --check`、网页 benchmark 正向常量测试、内置 Squad 真实加载命令及安全可运行的自进化聚焦测试。无法运行的 live Provider/浏览器/历史数据库重放作为权威缺口，不用静态检查冒充。
- 风险：并发索引改动、历史记录与当前代码漂移、作者源数量与 installed/default 混淆、聚焦测试漂移、Git 上游并发。共享索引只在最终串行集成时编辑；package 路径始终只读。

## 正式落点与唯一所有权

| 材料 | 唯一规范落点 | 本阶段所有者 | 并行/串行与交接 |
| --- | --- | --- | --- |
| 方案、Recall、最终记录 | 本文件 | 最终串行集成者 | 单写者；最后汇合全部证据包、验证、审查和 Git 状态。 |
| 内部主张、状态、Squad、自进化 | `specs/artifacts/opencorvus-paper/evidence/**` | evidence producer | 可与实验/案例并行；完成后只读交给 figures 与 integration。 |
| AutomationBench | `specs/artifacts/opencorvus-paper/experiments/automationbench/**` | experiment producer | 独占 experiment ID；不得把网页内容改写为实验真源。 |
| 七角色案例 | `specs/artifacts/opencorvus-paper/cases/seven-role-data-analysis/**` | case producer | 独占 case ID；事件记录完成后只读。 |
| 架构/实验图表事实输入 | `specs/artifacts/opencorvus-paper/figures/**` | figure-input producer | 消费前三包；不制作最终视觉图。 |
| 基础包 manifest 与验收 | `specs/artifacts/opencorvus-paper/integration/**` | 最终串行集成者 | 共享汇合面；所有上游包稳定后写入。 |
| 根/月度索引 | `specs/README.md`、`specs/records/2026-08/README.md` | 最终串行集成者 | 共享文件，最后编辑并保留并发已有内容。 |
| 当前架构 | `specs/current/architecture/**` | 后续架构 owner | 本任务只读；若发现矛盾在矩阵披露，不创建平行架构。 |
| 外部文献、完整研究稿、30+ 正式目录、最终图表 | 后续 Stage 定义的独占路径 | 后续研究/生产 owner | 本任务只提供内部事实与接口，不预占文件或伪造内容。 |

共享冲突面包括两个 specs 索引、单一 claim registry、实验聚合统计、图号/视觉规范、最终论文源和参考文献。只有前驱输入完整、可变路径互斥、产物可独立审查且下游只消费稳定文件时才允许并行；共享汇合与最终验收始终串行。

## 实施计划

1. 写入 `material-boundaries.json`，固定路径、所有者、阶段、交接和共享冲突规则。
2. 生成主张—证据 JSON/Markdown、四级状态矩阵、Squad 三层库存和自进化机制/效果边界。
3. 运行网页常量正向检查与当前内置集合加载命令，生成 AutomationBench audit/run ledger/README，逐项闭合或标记科学复现字段。
4. 从声明 DAG 与历史真实事件生成七角色 event ledger、dependency graph 和人工说明，量化真实并行与两个提前创建违规。
5. 生成架构与实验图表事实输入，明确组件、层级、数据/控制/反馈流、字段、单位、样本、分组、口径、来源和未知。
6. 生成 foundation manifest 与 acceptance ledger，更新本记录和两个索引；执行 JSON、docs、diff 及聚焦检查。
7. 首轮通过后进行独立只读审查；修复有效发现、复验并在有修改时再次审查，直至无未解决发现。
8. 精确暂存本任务路径并审查 staged diff；提交后按规则拉取并合并 upstream，检查 `upstream..HEAD`、必要复验并推送。任何外部阻塞在本记录中精确披露。

## 当前结论门槛

- 可直接引用：当前代码/架构交叉支持的内部机制，或带完整时间、身份、产物和限制的历史真实运行事实。
- 仅线索：网页营销常量、用户更正、截图、历史标题或未带原始 protocol 的摘要。
- 需外部/用户权威：AutomationBench 版本与数据许可、完整 case/protocol、重复运行、统计；30+ 正式 taxonomy；投稿模板；无法取得的历史运行库。
- 状态值只允许：`已实现`、`部分实现`、`规划中`、`概念设计`。

## 实施、验证、审查与 Git 记录

### 已交付材料

- `integration/material-boundaries.json` 固定任务子树、共享串行资源、只读权威和后续 Stage 独占面。
- `evidence/` 同时提供机器/人工主张矩阵、四级状态、Squad 分层和自进化机制/效果边界。
- `experiments/automationbench/` 保存网页常量检查原始输出、九项科学复现缺口以及允许/禁止结论；未伪造 case 或统计。
- `cases/seven-role-data-analysis/` 保存七个 occurrence、声明 DAG、566,808 ms 并行区间、最终产物和两项提前创建违规。
- `figures/` 提供架构组件/层级/流/关系与实验字段/单位/样本/分组/口径/来源/未知。
- `integration/foundation-manifest.json` 是后续消费入口，`acceptance-ledger.json` 映射 REQ-1 至 REQ-12。

### 真实检查

| 命令 | 结果 | 证明边界 |
| --- | --- | --- |
| `bun test packages/web/test/landing-benchmark.test.ts` | 1 pass, 0 fail, 1 expect | 只证明网站 typed 常量和算术投影。 |
| `bun -e` 加载 `getLoadedBuiltInPackages()` | `["base","advanced","research-studio","squad-sdk"]` | 证明当前 embedded 默认集合为四个。 |
| `git ls-files 'expert-squads/*/*/expert-squad.jsonc' \| wc -l` | `116` | 证明 tracked 作者源 manifest 数；不证明 installed/default。 |
| `bun test packages/opencorvus/test/expert-squad/data-analysis-package.test.ts` | 4 pass, 0 fail, 36 expects | 证明当前 package DAG/投影合同；历史过程事件来自案例记录。 |
| `bun test packages/opencorvus/test/evolution-comparison.test.ts` | 6 pass, 0 fail, 20 expects | 证明 deterministic comparison 原语。 |
| `bun test packages/opencorvus/test/evolution-lab-package-projection.test.ts` | 0 pass, 1 fail | 只读现有测试期望 `2026.08.18.1`，实际安装 payload 为 `2026.08.19.1`；属于 package 测试漂移，本任务无权修改。 |
| 递归 JSON 解析及跨包合同检查 | 13 个 JSON、15 条主张、四级词表、566,808 ms 算术和 4/116 分层全部通过 | 证明机器材料语法与关键交叉引用可消费。 |
| `bun run docs:check` | `docs:check ok (332 ops, 25 groups)` | 证明当前 API 文档生成一致。 |
| `git diff --check`（任务 record/artifact 子树） | 通过，无输出 | 证明首轮差异没有 whitespace 错误。 |

### 允许、禁止与未知

- 允许：引用当前系统内部契约、embedded 4 个身份、116 个 tracked 作者源数量、七角色真实并行及过程违规、Evolution Lab 机制原语。
- 禁止：把 AutomationBench 常量称为投稿级可复现实验；把 116 作者源或历史 115 安装称为默认 30+；把七角色终态称为严格 DAG 成功；把机制存在称为自进化效果已证实。
- 未知闭合：AutomationBench 需外部/用户 benchmark 权威；30+ 需批准 taxonomy；历史案例全量重放需隔离数据库/Artifact；自进化效果需预声明 repeated campaign、稳定 evaluator、统计和独立评审。

### 独立审查与 Git

本实施节点不能代替所选 Advanced workflow 的独立测试与 integrity reviewer。完整实现证据已准备供下游节点只读消费；当前不宣称 REQ-10 已完成。

基础包提交为 `c2a8c07a65f6242c4d639ea8e9d85a3dace07958`。`git fetch origin` 成功，随后 `git merge --no-edit origin/arch-debt-remediation` 报告 already up to date。`origin/arch-debt-remediation..HEAD` 含本任务提交及其未推送前驱 `7786b642d7ed4572ed31ed6a0710521a6a89239d`；后者修改 6 个无关 `packages/opencorvus` 源码/测试文件，未经本任务授权、验证或独立审查。推送 HEAD 会连带发布该提交，故未执行 push，也未使用 reset、rebase、force 或另建分支绕过。后续动作是由 `7786b642d` 所有者先验证并推送；本任务随后 fetch、重新审计 `upstream..HEAD`、复验并推送论文提交。

结束前工作区另有 5 个并发无关修改：`packages/opencorvus/src/engine/pipeline.ts`、`packages/opencorvus/src/tool/grep.ts`、`packages/opencorvus/src/tool/grep.txt`、`packages/opencorvus/src/util/process.ts`、`packages/opencorvus/test/tool/search-code-bounded-execution.test.ts`。它们保持 unstaged、未编辑、未提交。
