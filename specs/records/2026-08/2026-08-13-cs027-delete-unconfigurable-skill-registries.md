# CS-027 — 删除不可配置的 Skill registry 伪能力

## Recall

- 用户要求持续修复审计台账中的真实 code smell，并要求主 agent 直接实施、与并行 agent 协作且不得拆东墙补西墙。
- 验收目标：Skill market 不再把远端 registry 的网络、HTTP 或数据错误吞成 builtin-only 成功；保留一个真实、可说明的市场事实来源；公共路由与生成 SDK 不形成双协议。
- 硬约束：先分析再实现；只写聚焦非 UI 正向测试；禁止 UI 自动化；交付后由未参与实现的 agent 只读复审；脏工作区中仅提交本项文件。
- 已读资料：审计 CS-027；`src/config/config.ts` 的 `Config.Skills`；`src/skill/manager.ts`；两条 Skill market route；Overlay extension service/store；`specs/current/architecture/04-extensions.md`；AGENTS.md。
- 全仓搜索：正式配置 schema 只有 `skills.paths` 与 `skills.urls`；无 `skills.registries` writer、文档或示例。Manager 通过 `Record<string, unknown>` 强转读取该字段。Overlay 的 `loadSkillMarket`、`skillMarket` 与 setter 只有定义、没有 caller。真实公共消费者只有 `/skill/market`、`/global/skill/market` 及其生成 SDK。
- 独立 agent 反馈：首提的 durable last-known-good registry 系统会把不存在的产品能力扩张成新的配置、持久化、锁和刷新协议；应删除不可配置的远端分支，保留 builtin catalog 的现有数组合同，并删除零调用 Overlay 投影。

## 根因与影响面

### 可观察现象

`SkillManager.market()` 声称合并配置 registry；任何 fetch、超时、非 2xx、JSON 或 schema 错误都返回空列表，最终响应与“没有配置 registry”完全相同。

### 直接触发与控制流根因

`Config.Skills` 不接受 `registries`，Zod 解析会剥离该字段。Manager 绕过类型从已解析 global config 强转读取它，因此正常配置流永远不能触发远端分支。该分支既不可配置，又用 `catch -> []` 把所有失败伪装为合法 builtin-only 成功。

### 旧路径为何不能根治

仅增加日志或把 catch 改为 throw 仍保留不可达配置协议；补充 registry schema 和缓存则新增此前不存在的第三方市场产品能力。当前唯一有仓库事实支持的 market authority 是内置 catalog 加实时 installed 投影。

### 定义、调用、公共契约、数据、测试与文档

- 定义：删除 registry 强转、fetch、first-wins 去重；`market()` 只从内置 catalog生成 `MarketEntry[]`。
- 调用：保留两条 GET route，二者继续调用同一 `SkillManager.market()`。
- 公共契约：响应仍是 `MarketEntry[]`，OpenAPI/SDK 无 schema 变化，无兼容层。
- 数据：没有 registry 持久数据或正式配置需要迁移。
- Overlay：删除零调用 service/store 状态；不改真实 UI，不运行 UI 自动化。
- 文档：架构改为说明两条 route 共享 builtin owner，不再声称 Overlay 当前消费 market route。

## 实施方案

1. 将 `SkillManager.market()` 收敛为 builtin catalog + 当前 global install state 的唯一投影。
2. 删除 Overlay 未被调用的 `loadSkillMarket`、`skillMarket` 状态、setter 与 workspace reset 字段。
3. 保留两条公开 route 与现有数组 schema；不新增 registry 配置、refresh route、snapshot、fallback 或兼容协议。
4. 新增聚焦非 UI 测试，经真实 Manager 与两条 Hono route 验证相同的 builtin market输出和 installed 布尔投影。

## 正向验收

- `bun test --timeout=0 test/skill-market-builtin-authority.test.ts`
- `bun run typecheck`（`packages/opencorvus`）
- `bun run --cwd packages/overlay typecheck`
- `bun run api:routes-check`
- `bun run docs:check`
- task-owned `git diff --check`
- 独立 agent 对完整差异、真实调用面、公共契约和测试证据只读复审至 PASS。

## 明确不做

- 不发明第三方 registry 配置或 durable last-known-good 市场系统。
- 不增加 refresh API、远程 source identity、跨进程锁或新 SDK response。
- 不运行或修改 UI 自动化测试。

## Verification Log

- 方案独立复核：PASS（删除不可配置分支；拒绝无授权产品扩张）。
- 实现与聚焦验证：完成。Manager/Overlay/architecture 已收敛；focused test 1/1、7 assertions PASS，并以真实 managed Git 目录与 global `skills.paths` 验证 installed true/false 投影及两条 route；OpenCorvus 与 Overlay typecheck PASS；API route/docs check PASS；task-owned diff-check PASS。
- 独立交付复审：PASS。复审确认真实 managed source/config/cache reset、Manager installed 投影和两条 route 均被正向覆盖，且无 registry 残余、Overlay caller、公共 schema 漂移或双源。
