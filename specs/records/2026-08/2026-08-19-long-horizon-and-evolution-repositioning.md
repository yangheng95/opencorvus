# 长程任务与自进化：公开站与 README 重定位（v0.0.49beta）

## Recall

### 用户原始要求（逐字）

> 把网站和readme都往长程任务和自进化靠拢。痛点有：长程任务执行不彻底，任务结果不能稳定可用，长程工作流不会自动进化。多专家团组合天生时候极长任务。然后从调研资料到写论文（盘点需要夺少专家团）作为一个case，然后再从已经集成的专家团中找出组合工作的例子。完善后bump到v0.0.49beta发布二进制和网站

### 验收指标

1. `README.md` 与 `README.zh-CN.md` 的主张从「开箱即用的 harness」转到「长程任务 + 自进化」，并显式回答三个痛点。
2. 公开落地页（`packages/web`）双语同步同一主张，新增长程任务段与专家团组合段。
3. 「从调研资料到写论文」作为主 case，盘点出精确的专家团数量与角色数量，每个数字可从代码权威推导。
4. 再给出至少三组「已集成专家团」的真实组合示例。
5. 版本 bump 到 `0.0.49beta`，发布二进制与网站。

### 硬约束

- `AGENTS.md` §2：一个能力只能有一个事实来源，禁止 fallback 与双源。
- `AGENTS.md` §5：方案落 `specs/records/2026-08/`，同步更新 `specs/README.md`。
- 记忆 `verify-public-claims-against-code`：公开文案里的每个数字必须来自代码权威（registry 或 generated 常量），
  不得用目录数、文件数或手抄数。已有生成常量的必须 import 插值。
- 记忆 `research-competitors-before-design-changes`：改公开内容前先调研同类产品怎么做。
- 记忆 `website-restyle-plan-location`：公开站只有落地页 + 市场两个 surface，样式必须走
  `var(--oc-space-*)` / `var(--oc-radius-*)` 令牌，`test/style-discipline.test.ts` 会拦裸数值。
- 记忆 `squad-package-bytes-are-published`：**不得**为本次改动修改 `expert-squads/builtin/*` 的包字节，
  否则 115 个包的 `package_digest` 全部漂移。本方案只读取它们。
- 记忆 `specs-dir-is-gitignored`：本文件必须 `git add -f`。
- `AGENTS.md` §4：UI 只做真实页面截图人工复核，不新增任何 UI 自动化测试。

### 已读资料

- `README.md`、`README.zh-CN.md`、`AGENTS.md`、`RELEASE.md`、`CHANGELOG.md`
- `packages/web/src/content/landing-copy.ts`（落地页真实文案源）、`landing.ts`（**无人 import，死代码**）
- `packages/web/src/components/OcLanding.astro`、`packages/web/astro.config.mjs`
- `packages/web/src/content/platform-facts.ts` / `.generated.ts`、`expert-squad-distribution.generated.ts`
- `packages/web/script/generate-public-market.ts`、`src/lib/landing-featured-squads.ts`
- `packages/web/test/landing-copy.test.ts`、`platform-facts.test.ts`
- `specs/current/architecture/task-control-plane.md`
- `packages/opencorvus/src/expert-squad/{feedback-revision,evolution-mutation,evolution-history,mutation-authorization}.ts`
- `packages/opencorvus/src/tool/expert-squad-feedback-revision-tool.ts`
- `packages/opencorvus/src/mission/{schema,expert-squad-authority}.ts`
- `packages/opencorvus/src/expert-squad/builtin/ids.ts`
- 全部 116 个 `expert-squads/builtin/*/expert-squad.jsonc` 与 4 个内嵌包的 manifest

### 全仓搜索结果

- `landingContent`（`src/content/landing.ts` 唯一导出）在 `src`、`test`、`script` 中**零引用** → 死代码，本次删除。
- `builtInTools` 生成值为 **43**，而 `README.md` 多处写 42 → 数字漂移，本次修正。
- 公开站现有文案零处提及 evolution / 进化；`concepts/mission.mdx` 已有长程叙述，可作为落点。
- Mission 的多专家团事实：`MissionVisibleExpertSquadIDs` 是 Mission 启动时冻结的**集合**，
  每个子 Task 从中解析并锁定**一个**精确 revision（`mission/expert-squad-authority.ts`）。

### 独立 agent 反馈

**第一轮（对 `995f751f` + `50e61b7d`）**，全部核实为真，已在 `90c99bb1` 修复：

- **P0**：六个新文档页共 **14 条同级相对链接**写成 `./name/`，浏览器按以斜杠结尾的页面 URL 解析，
  全部 404（实测确认）。仓库既有文档用的是 `../name/`。**主 agent 首轮链接扫描只抓了绝对 href，
  整类相对链接一条没测到** —— 这是本次最该记住的教训。
- **P1，六处主张说过了头**：
  1. 恢复被写成「从历史里挑一个」；`evolution-mutation.ts` 只允许退回**一份被引用回执见证过的两个
     digest**，代码注释原文即「an undo button instead of a way to reach any revision」。
  2. 「追加不算修订，会被拒绝」是无条件表述；实际只在候选声明 `conflicting_instruction: "rewritten"`
     时才校验，声明 `none` 不被二次猜测。
  3. 「携带你的原话」被写成保证；`feedback` 是模型入参，"verbatim" 只是提示词要求，宿主逐字校验的是
     **授权确认文本**，不是它。正撞上仓库自己的 [[host-must-own-derivable-facts]] 规则。
  4. Deep Research 的引文复核不在「成文之前」：工作流是 draft-writer → citation-reviewer →
     report-writer。
  5. 「三支专家团带怀疑角色」实为**四支** —— Research Studio 自己就有 fact-checker，还在同一张表上。
  6. Work Artifact 的渲染检查路径只覆盖 `office.presentation@1`，不是「任何真实文件」。
- **P2**：新加的组合测试**拿生成物和它自己比**，生成物过期照样全绿；README 里的数字完全没有校验 ——
  正是「42 个工具」漂移的同一个洞。已改为从已发布 manifest 重新推导角色数，并把 README 数字与生成物
  对账；两个测试都**实测过会咬人**（故意改脏生成物 → 2 红；故意改脏 README → 1 红）。
  另修：组件改名进样式门扫描集、角色列补真正的表头（中文原来用的是量词「个具名角色」）、
  组合视图按位配对加显式断言、生成物去掉无人读的 `workflowCount`、改版方案文档不再链已删文件。

**第二轮**：对 `90c99bb1` 的修复复审（结论见交付说明）。

---

## 一、调研：同类产品怎么讲长程与自进化

| 来源 | 怎么讲 | 可借鉴的 |
| --- | --- | --- |
| LongHorizon-Harness（AMAP-ML，arXiv 2608.01964，`lh-harness.pages.dev`） | 先点名四个失效模式：compounding errors、context rot、task-state loss、unverified premises；核心主张是「长程能力是 model–harness **整体**的属性，不是模型的属性」 | **先命名断点、再给机制**的结构；以及「独立审计过的结果才成为可信任务状态」这一句式 |
| DeepSeek Harness | 有子 Agent 调度；**没有**长程、重启恢复、自进化的任何主张 | 对比表里可诚实标注「未主张」 |
| Awesome-Self-Evolving-Agents（XMUDeepLIT）等 | 自进化被拆成 model-centric / environment-centric / co-evolution；产品侧几乎全是研究原型 | 我们讲的是**产品化的、要人点头的**进化，这是差异点，必须写清楚「不是自动改自己」 |

结论：采用「三个断点 → 三个机制」的骨架；差异化落在 LongHorizon-Harness 也没有的两件事上——
**多专家团组合**与**要操作者授权的自进化**。

## 二、三个痛点对应的真实机制（每条都必须有代码出处）

| 痛点 | 机制 | 代码权威 |
| --- | --- | --- |
| 长程任务执行不彻底 | Requirements 产出 `REQ-N`，每条带 `acceptance` / `non_goals` / `evidence_refs`；Architect 负责分解；工作流按依赖推进 | `src/requirements/types.ts`、`src/architect/types.ts`、manifest 的 `virtual_workflows` 节点依赖 |
| 同上 | 入口归约是一个全序，`ready` 之外的每种状态都有名字；`exhausted` 是有限栅栏而不是静默丢弃 | `specs/current/architecture/task-control-plane.md` §Task-root ingress |
| 同上 | 进程租约 + 事件日志 + 协调器：进程丢失后由 recovery 终结被遗弃的 assistant，再取后继激活 | 同上 §Physical leases / §Decision-gap continuation |
| 同上 | 终态不是终点：completed / failed / cancelled 都能被操作者的一条消息重开为 `epoch + 1` | 同上 §Task lifecycle |
| 任务结果不能稳定可用 | 带类型的 Artifact + 精确 locator + provenance；`step-start` 是唯一因果读边界 | `src/artifact-catalog`、task-control-plane §Decision-gap continuation |
| 同上 | 宿主观测独立于 agent 自述记录文件与命令事实 | task-control-plane §Authority rule |
| 同上 | 具名校验阶段：fact-check、integrity review、visual QA | `src/fact-check`、`src/integrity`、`src/visual-qa` |
| 同上 | Work Artifact 必须过验证权威（真实渲染 + 检查）才算交付 | `src/work-artifact/validation-authority.ts`、`profile-registry.ts` |
| 长程工作流不会自动进化 | 反馈修订：操作者原话 → 宿主复制精确 revision、套用改动、校验为可运行包、发布候选 Artifact → **必须操作者接受**才安装；回执即撤销凭据；能力面不得变宽 | `src/expert-squad/feedback-revision.ts`、`src/tool/expert-squad-feedback-revision-tool.ts` |
| 同上 | 度量式进化：Evolution Lab（7 角色 / 3 工作流）冻结目标版本、用例、评分器、环境、臂序、预算与变异面，跑完出完整性审查与对比建议 | `expert-squads/builtin/evolution-lab/expert-squad.jsonc` |
| 同上 | 三种变更都要真实操作者确认消息：`promotion` / `restoration` / `feedback_revision`；历史可列，但恢复是**撤销**——只能退回一份被引用回执见证过的 digest，不是任意历史版本 | `src/expert-squad/evolution-mutation.ts`、`evolution-history.ts`、`mutation-authorization.ts` |

**必须写清的边界**：进化不是自动的。没有操作者的确认消息，任何修订都不安装。

## 三、主 case：从调研资料到一篇论文

盘点结果 —— **6 支专家团，33 个具名角色**（全部来自 manifest 的 `capability_projection.agents`）：

| 阶段 | 专家团 | 角色 | 交出什么 |
| --- | --- | --- | --- |
| 立题 | Scientific Research Design | 4 | 证据地貌、竞争假设、严谨性与伦理 → 研究决策登记册 |
| 取证 | Deep Research | 6 | 多视角检索、证据策展、提纲、初稿、**独立引文复核**、成文 |
| 分析 | Data Analysis & Business Insights | 7 | 口径对账、表现与分群分析、洞察合成、**事实核查**、报告 |
| 成稿 | Research Studio（内嵌） | 5 | 计划、深度检索、证据分析、事实核查、模板化交付 |
| 审稿 | Academic Paper Review | 8 | 文献、新颖性、逻辑、方法与统计、图表呈现、**引文幻觉审计**、整合修订 |
| 物料 | Office Delivery | 3 | 来源分析、规划、可编辑 PPTX（真实图表 + 校验回执） |

可选扩展（同样已集成）：Patent Landscape & Prior Art（4）、Browser Research & Acceptance（3）、
Localization & Adaptation（4）→ **9 支 / 44 个角色**。

## 四、其他已集成专家团的组合示例

| 组合 | 专家团 | 角色合计 |
| --- | --- | --- |
| 交易尽调 | M&A Due Diligence · Forensic Accounting · Commercial Legal · Tax Compliance · Internal Audit | 5 支 / 29 |
| 事故到知识 | Service Reliability Incident Ops · Digital Forensics Incident Investigation · Review & Debug · Knowledge Base Ops | 4 支 / 18 |
| 产品发布 | Product Management · Marketing & Growth · SEO & GEO · Product Video · Localization & Adaptation | 5 支 / 26 |

## 五、实施

### 5.1 数字不许手抄：新增组合事实生成物

- 新增编辑源 `packages/web/src/content/squad-compositions.ts`：只声明组合 id、双语标题/导语、
  有序步骤（`squadId` + 双语阶段名 + 双语交付说明）。**不含任何计数**。
- 扩展 `packages/web/script/generate-public-market.ts`：按声明的 id 从同一份 catalog facts 解析出
  `displayLabel` / `agentCount` / `workflowCount` / 市场链接，并求和，写入
  `packages/web/src/content/squad-compositions.generated.ts`。id 不存在时**抛错**，不静默跳过。
- 落地页与文档只渲染生成物里的计数。

### 5.2 公开站

- `landing-copy.ts`：hero 改为长程 + 自进化主张；新增 `horizon`（三个断点 → 三个机制）与
  `compose`（主 case + 三个组合）两段；FAQ 补两条（长程边界、进化是否自动）。
- `OcLanding.astro`：在录屏段之后、`why` 之前插入 `#horizon` 与 `#compose` 两段，走既有令牌与
  `oc-card` / `oc-reveal` 原语，不新增裸数值。
- `test/landing-copy.test.ts`：把新段落纳入预算函数，并**显式抬高** `totalBody` 预算并写明理由。
- 新增文档页（双语）：`concepts/long-horizon.mdx`（三个断点与机制）、
  `concepts/squad-composition.mdx`（论文 case 全表 + 组合示例）、
  `expert-squads/evolution.mdx`（两条进化路径与授权边界）；登记进 `astro.config.mjs` sidebar。
- 删除死代码 `packages/web/src/content/landing.ts`。

### 5.3 README

- 双语 README 换 tagline 与首段；新增「长程工作在哪里断」「组合起来的专家团」「自进化」三节；
- 修正 42 → 43 个内置工具；
- 保留既有安装、配置、协议、致谢结构不动。

### 5.4 发布

- `bun run version:bump 0.0.49beta`；CHANGELOG 把 `未发布` 收敛为 `0.0.49beta - 2026-08-19`。
- `./script/release 0.0.49beta` 派发 `.github/workflows/build.yml`。
- 网站部署走 `deploy-opencorvus-com.yml`。**已知阻塞**：`reset-v1` 重建分支在服务器上留下未 checkpoint
  的 WAL sidecar，守卫正确回滚，线上仍是上一个好版本。该阻塞只能在服务器侧解除
  （挪走 `/var/lib/opencorvus-web/registry.sqlite3`），仓库侧改不动。

## 六、验证

- `bun run --cwd packages/web test:web`（令牌 / 文案预算 / 平台事实 / 资源）
- `bun run --cwd packages/web test:style`
- `bun run --cwd packages/web market:data` 后确认生成物与 catalog 一致
- `bun run --cwd packages/web build`，起 `dist/server/entry.mjs`，真实浏览器截图人工复核浅色与深色
- `bun run version:check`
- 独立 agent 只读审查

## 七、未完成 / 风险

- 官网部署的服务器侧阻塞不在本次可解范围；若部署失败，线上保持上一个好版本，需在服务器上处理。
