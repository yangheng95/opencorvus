# CS-007 — 删除 Overlay 不可达功能岛并收敛真实入口

## Recall

### 用户原始要求

- 持续完成 OpenCorvus 代码气味审计剩余重构清单，逐项深挖根因，实施单一事实源修复，不得拆东墙补西墙。
- 当前分工只做 `CS-007` 的调查与实施方案：不改生产代码、测试、共享索引，不 stage、不 commit；方案后续交给另一名未参与调查的 agent 独立只读复核。

### 验收指标

- `TerminalPanel.tsx` 与其 Overlay terminal service、`browser-preview-link.ts`、`expert-squad-market-catalog.ts`、`utils/path.ts` 不再作为不可达生产模块存在。
- 当前仍被产品使用的能力只保留一个真实入口：
  - Pseudo Terminal（PTY，伪终端）的公开服务端 API、OpenAPI 与 JavaScript Software Development Kit（SDK，软件开发工具包）继续存在，但不再由一个未接入真实 composition 的 Overlay 面板冒充已交付界面；
  - 消息中的 Hypertext Transfer Protocol / Secure（HTTP/HTTPS）链接继续由 `main.tsx` 的真实 document ingress 打开现有 Browser Preview 或外部浏览器，不保留第二套零调用 service；
  - Expert Squad Market 的可浏览目录继续以公开网站为唯一展示面，Overlay 的真实设置页只保留当前更新/修复所需的 live projection，不保留测试专用 catalog；
  - `relativePathFrom` 只剩 `utils/tool.ts` 一个生产 authority，并保留混合分隔符、大小写和目录边界语义。
- 删除只服务于废弃岛的测试、样式与翻译；仍验证 live production authority 的纯逻辑测试改为直接导入现用模块，不再让测试 root 使死模块看起来可达。
- 生产 reachability checker 不再报告上述五个 `CS-007` 文件；已归属 `CS-008` 的 `native-menu.tsx` entry false positive 与 Overlay 未使用依赖不在本批次掩盖或顺手修复。
- 因本批次会删除 Overlay stylesheet 引用，实施时必须通过真实开发页面截图和人工视觉复核确认当前可达桌面界面未回归；不新增、修改或运行 User Interface（UI，用户界面）自动化测试。

### 硬约束

- 一个能力只有一个当前实现和一个事实来源；不增加 compatibility reader、fallback、shadow state、平行 service 或“以后可能重新接线”的保留层。
- 对纯删除且没有替代契约的岛删除对应过期测试；对路径 helper 这种仍有 live consumer 的替换，保留聚焦正向非 UI 契约测试。
- 禁止运行或修改任何 UI 自动化、Document Object Model（DOM，文档对象模型）断言、snapshot、Playwright test、截图基线或像素差异测试。真实页面只做人工交互与截图复核。
- 不删除或改写仍由公开 route、生成 SDK 和文档消费的 PTY backend；不因删除 Terminal panel 同时删除仍被 `TerminalArtifact.tsx` 使用的 xterm dependencies。
- 保留脏工作区中的并行任务改动。实施只触及本方案列出的 Overlay 文件、必要架构/台账索引，并在首轮验证后接受未参与实现的独立只读复审。

### 已读资料

- 审计权威：`specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md` 中 `CS-007`、refactoring order 与 `CS-008` 邻接项。
- 总体计划：`specs/records/2026-08/2026-08-12-code-smell-remediation-program.md`。
- 当前架构：`specs/current/architecture/README.md`、`specs/current/architecture/04-extensions.md`、`specs/current/architecture/task-control-plane.md`、`specs/current/architecture/task-runtime-directory.md`。
- Overlay entry/composition：`packages/overlay/src/main.tsx`、`components/RightDock.tsx`、`index.html`、`package.json`、`tsconfig.json`、`knip.config.js`。
- 候选岛与当前替代实现：`components/TerminalPanel.tsx`、`services/terminal.ts`、`services/browser-preview-link.ts`、`services/expert-squad-market-catalog.ts`、`services/composer-expert-squad-catalog.ts`、`components/settings/ExpertSquadPanel.tsx`、`components/settings/ExpertSquadMarketPanel.tsx`、`utils/path.ts`、`utils/tool.ts`、`utils/file-change-summary.ts`、`components/SourceParts.tsx`、`components/interactive-artifact/TerminalArtifact.tsx`。
- 相关测试与 runner：`terminal-output-stream.test.ts`、`composer-expert-squad-catalog.test.ts`、`path-util.test.ts`、transport-protocol `contract.test.ts`、Overlay `script/run-unit-tests.ts`。
- PTY 公共实现：`opencorvus/src/pty/**`、`server/routes/pty.ts`、`server/routes/terminal.ts`、`transport-protocol/src/index.ts`、生成 SDK 和双语 API 文档。
- Git history/blame：五个岛最初随 `65d0bfc9` 进入；market catalog 后由 `3b4e5ea9` 新增但从未接入生产；Browser Preview 的 live document handler 与 controller 同样自 `65d0bfc9` 起直接存在于 `main.tsx`；后续提交没有把这些岛接入真实 entry graph。

### 全仓搜索与当前 checker 证据

- 2026-08-13 在当前工作树执行：

  ```text
  bunx knip@6.27.0 --config knip.config.js --no-progress --production \
    --include files,dependencies,unlisted,binaries --workspace packages/overlay

  Unused files (6)
  packages/overlay/src/components/TerminalPanel.tsx
  packages/overlay/src/native-menu.tsx
  packages/overlay/src/services/browser-preview-link.ts
  packages/overlay/src/services/expert-squad-market-catalog.ts
  packages/overlay/src/services/terminal.ts
  packages/overlay/src/utils/path.ts
  Unused dependencies (1)
  @opencorvus-ai/util
  ```

  其中五个具名文件与 `CS-007` 完全一致；`native-menu.tsx` 由 Vite multi-entry 配置缺失导致，unused dependency 也属于 `CS-008` 的 checker surface，不能拿来扩大本批次。
- `TerminalPanel` 的唯一 production import 是它自己对 `services/terminal.ts` 的 island-local import；真正 entry `main.tsx`、Right Dock catalog 和所有 mounted `TabPanel` 都没有 terminal panel。terminal service 的唯一岛外 consumer 是 `terminal-output-stream.test.ts`。专用 `terminal.css` 只在 `index.html` 被无条件加载，两个 `terminal_panel.*` 翻译 key 只被死 panel 读取。
- PTY backend 并非死系统：`/pty` routes、`/terminal/profiles`、`PtyHost`、`PtyOutputStreamEvent`、生成 SDK、API docs 与 transport-protocol 正向测试均有真实引用。`TerminalArtifact.tsx` 也是 live lazy component，并继续使用 `@xterm/addon-fit`、`@xterm/add-search` 与 `@xterm/xterm`。因此 `CS-007` 只能删除未接线 Overlay client 岛，不能把后端或共享 dependencies 一并删除。
- `browser-preview-link.ts` 两个 exported function 全仓零 caller、零 test。相同产品行为已有 live authority：Markdown/Source link 生成 `data-browser-preview-url`，`main.tsx` 的 document click ingress 检查真实 host capabilities，再通过 mounted `BrowserPreviewPanelController.navigate()` 打开 Right Dock，或调用 `nativeOpen`。死 service 还保留旧的 `activeTaskID -> selectTarget -> open/refresh` 模型，重新接线会恢复第二套导航协议。
- `expert-squad-market-catalog.ts` 仅被 `composer-expert-squad-catalog.test.ts` 直接 import。真实 `ExpertSquadPanel` 自己读取 bounded market page 和 exact details，只为 installed-source/update recovery 投影所需 rows；当前架构明确“公开网站是唯一可浏览目录，Overlay 不复制搜索、筛选、条目或详情目录”。把测试专用 projection 接入设置页会扩大产品面并制造第二个 catalog owner。
- `utils/path.ts` 仅被 `path-util.test.ts` import。生产 `relativePathFrom` 位于 `utils/tool.ts`，被 `SourceParts.tsx`、`file-change-summary.ts` 与 `shortRelativePath` 调用。死 helper 对 mixed slash/backslash 的比较更稳健；直接删掉而不把该语义收敛到 live helper 会丢失已有正确行为，属于拆东墙补西墙。
- `composer-expert-squad-catalog.test.ts` 混有一个 live `mergeComposerExpertSquadOptions` case 与一个死 market-catalog case，不能整文件删除；只删除 dead case/fixtures/import，保留对真实 production function 的正向契约。
- 当前 task-owned Overlay paths 在调查开始时无 dirty diff；共享工作区存在其他 agent 的 OpenCorvus/Engine/Tool/architecture/index 修改，本任务不得接触或 stage 它们。

### 独立 agent 反馈

- 仓库审计的独立交叉复核已确认：这些 tests 直接导入 abandoned modules，不能证明 shipping application reachability；`CS-007` 作为具体 finding 被接纳。
- Focused plan review 第一轮：**CHANGES REQUESTED（2 项）**。
  1. `/ui` 只能证明真实 Web UI 页面与样式；Browser Preview 的 live document ingress 依赖 Tauri native surface/capability，必须另用隔离可执行 Tauri host、明确启动/端口和实际导航截图验收。若环境不能安全启动，不得用普通浏览器 `/ui` 冒充，当前批次只能证明删除边界，并把 live ingress 标成未触及而不是已验收。
  2. path 方案不能 canonical compare 后按 raw `base.length` 切 suffix；必须定义 segment-aware canonical-to-original boundary，并补 base/target 各自重复分隔符、drive/root、`proj` 对 `project` 的正向矩阵。
- 本文已按这两项修订。Focused plan review 第二轮：**CHANGES REQUESTED（2 项）**。
  1. 原生 Browser Preview 验收仍只写了“隔离 Tauri host”，但仓库默认 `dev` 实际是固定 `localhost:5173`、正式 `ai.opencorvus.overlay` identifier 且启用 single-instance plugin；必须给出不会接管用户实例的临时 config、端口、数据根和窗口身份隔离步骤，或把 native 验收明确标为交付 blocker。
  2. 路径矩阵虽覆盖 Windows case variance，文字却只规定 drive letter 不敏感，且没有 POSIX case variance；必须按 path flavor 明确 Windows 所有 segment 大小写不敏感、POSIX segment 大小写敏感，并保证 suffix 从原始 target boundary 切片而保留原始 casing。
- 本文已按第二轮两项反馈再次修订；第三轮 focused plan review 待同一独立 reviewer 复核。

## 深度分析

### 可观察现象

TypeScript 会检查 project glob 内所有模块，而 Bun tests 能把任意文件当作 root；两者都不要求模块从 `src/index.html -> src/main.tsx` 的 shipping graph 可达。因此五个已失去 composition 的模块仍能 typecheck，三个 test 又直接 import 其中的 service/helper，造成“代码存在、测试通过、能力已交付”的假象。只有 production reachability checker 暴露了真实状态。

### 直接触发点

- 维护者修改 terminal panel/service、market reconciliation 或 path helper，并把 isolated unit result 当成真实 Overlay 行为证据。
- dependency/version update 因死 `TerminalPanel` 的 imports、死 stylesheet 或死 service type surface 产生维护成本。
- 新功能误用 `browser-preview-link.ts` 或 `expert-squad-market-catalog.ts`，在 live handler/panel 旁恢复第二套入口和状态投影。
- 删除 `utils/path.ts` 时忽略 mixed separator 语义，使 production helper 在跨 Windows/portable path 表示下继续返回 absolute fallback 或隐藏路径。

### 数据与控制流根因

这些文件不是因 tree-shaking 偶然未用，而是功能演进后没有同步完成“接入或删除”决策：

1. terminal panel 保留一个完整的 `Solid mount -> apiJson/openStream -> PTY route` 链，但链头没有被任何真实 composition 挂载；test 从链中部直接建立 host transport，绕过了缺失的产品入口。
2. Browser Preview 的 live controller/document ingress 已经直接拥有消息链接导航；旧 service 从未成为该 ingress 的 dependency，形成两个语义不同的潜在 owner。
3. Market 架构后来收敛到 public website + Overlay local install/update surface，但一次 bounded-catalog 修复新增了独立 market reconciliation helper，只在同次新增 test 中消费。test 固化了一个已不属于当前 Overlay 产品面的 selected catalog state。
4. path utility 被复制到 `utils/tool.ts` 后，真实 callers 全部迁移到后者，旧文件和旧 test 没有一起迁移；两个实现已经有 mixed separator 行为差异。

没有任何 durable data 或 database row 以这些 Overlay 模块为 owner。除 terminal service 调用公开 API 外，其余都是 renderer 内存 helper；删除不需要 migration。

### 旧路径为何不能根治

- 仅给 Knip 加 ignore 会隐藏真实孤岛，并保留测试制造的交付假象。
- 为 `TerminalPanel` 随意加一个 Right Dock tab 会把未知产品意图升级为新 UI 功能，要求 terminal session ownership、关闭/恢复、布局、可访问性和真实页面验收，不是 code-smell 清理。
- 删除全部 PTY backend 会破坏真实公开 API、SDK 和非 Overlay consumer，把 renderer reachability 缺陷错误扩散到 server contract。
- 把 dead Browser Preview service 重新接到 live handler 会保留 controller 与 service 两套导航 authority，且旧 service 的 task target mutation 与当前 blank-tab/controller 语义不一致。
- 把 dead market helper 接进 `ExpertSquadPanel` 会违背当前架构的 public-only browsable catalog，重新引入本地 selected market catalog shadow。
- 直接删除两个 path helpers 之一而不比较语义，会漏掉 mixed separator 与 path-boundary contract；保留两者则继续双源。
- 保留 feature-only tests 或改成“旧文件不存在”的断言仍是负向交付假证据；正确做法是删除废弃 test，或让 test 直接穿过 live production authority 并验证明确输出。

## 产品意图结论与明确排除

当前证据足以把“删除还是接线”的 medium-confidence 产品意图收敛为删除废弃 renderer islands：

- **Terminal:** 当前 UI composition、Right Dock catalog 和当前架构均未声明 interactive PTY panel；但公开 PTY API 明确存在。因此删除 Overlay panel/client，不删除 PTY platform capability。未来若产品重新要求交互终端，应从真实 navigation/composition、session ownership 与视觉验收重新交付，不能把这批死文件当兼容实现复活。
- **Browser Preview:** 产品能力明确受支持且已有 live ingress；只删除旧 service，保留现行 controller path。
- **Expert Squad Market:** 当前架构明确 public website 是唯一 browse surface；只删除旧 local catalog projection，保留 live update/recovery reads 与 public handoff。
- **Path:** 产品行为由 live caller 明确需要；迁移较强的 normalization 到现用 helper，再删除副本。
- **`native-menu.tsx` / `@opencorvus-ai/util`:** 明确属于 `CS-008` 的 checker configuration/dependency inventory；本批次不修改 Knip entry、dependency 或命令。
- **UI tests:** 调查范围内的三个测试都是纯 service/utility tests，不是 DOM/renderer/snapshot automation；实施仍不运行任何 UI automation。terminal test 随死 service 删除，market mixed test删除 dead case，path test转向 live helper。

## 实施方案

### 1. 删除未交付的 Overlay terminal client 岛

删除：

- `packages/overlay/src/components/TerminalPanel.tsx`
- `packages/overlay/src/services/terminal.ts`
- `packages/overlay/src/styles/surfaces/terminal.css`
- `packages/overlay/test/terminal-output-stream.test.ts`

并从 `packages/overlay/src/index.html` 删除 `terminal.css` link，从中英文 i18n catalog 删除仅被 dead panel 使用的 `terminal_panel.title`、`terminal_panel.empty`。

保留且不改：server PTY/terminal routes、PtyHost、transport protocol、OpenAPI/SDK/API docs、transport-protocol contract test，以及 live `TerminalArtifact`. 保留 xterm dependencies，因为 `TerminalArtifact` 仍真实消费它们。不存在 replacement panel、隐藏 tab、feature flag 或 compatibility service。

### 2. 删除 Browser Preview 的第二套零调用 service

删除 `packages/overlay/src/services/browser-preview-link.ts`。不改 `main.tsx` 当前 document click ingress、`BrowserPreviewPanelController`、Right Dock composition、native capability checks 或 `nativeOpen`。

此项是纯删除，无替代 public contract，不新增“service no longer exists”测试。生产 handler 的真实页面行为在本批次 UI 人工验收中覆盖，不通过 DOM/source assertion 冒充。

### 3. 删除与当前 Market 架构冲突的测试专用 catalog

删除 `packages/overlay/src/services/expert-squad-market-catalog.ts`。

在 `packages/overlay/test/composer-expert-squad-catalog.test.ts` 中只删除：

- dead service import；
- `ExpertSquadMarketIndexItem` / `ExpertSquadMarketItem` fixture types；
- `marketIndex` / `marketDetail` fixtures；
- `reconcileExpertSquadMarketCatalog` case。

保留并运行 live `mergeComposerExpertSquadOptions` case，因为其 production caller 在 Composer catalog path 中真实可达。保持 `ExpertSquadPanel` 现有 update recovery projection、`ExpertSquadMarketPanel` public-link/local-install surface 与 `04-extensions.md` 的唯一 public browse authority；不抽取新共享 market abstraction，不把 dead selected state移入 live panel。

### 4. 将路径语义收敛到唯一 live helper

在 `packages/overlay/src/utils/tool.ts` 的现有 `relativePathFrom` 中吸收 dead helper 已证明的 normalization contract：

- 分别把 `base` 与 `target` 解析成 path segment，并在解析时记录每个 non-empty segment 在原始字符串中的 `[start,end)` 边界；`/` 与 `\` 都是 separator，连续 separators 形成一个 boundary 而不产生空 segment，尾随 separators 被忽略。
- drive/root 参与 identity，而不是被普通 segment 或可丢弃 separator 处理。以 drive prefix（如 `D:`）开头的是 Windows flavor；以 `/` 开头以及无 drive 的 relative path 是 POSIX flavor。rooted 与 relative path 不相等，不同 drive/root 或不同 flavor 直接返回 empty sentinel；POSIX root 与 Windows drive root 不互换。本批次不凭空新增 Universal Naming Convention（UNC，通用命名约定）路径支持，未被当前 caller/fixture 证明的 UNC 输入映射为 empty sentinel。
- canonical segment comparison 必须服从唯一、显式的 flavor 规则：Windows drive letter 与 **所有 path segment** 都按 case-insensitive identity 比较；POSIX 的所有 segment 都按 case-sensitive identity 比较，即 `/home/me/Proj` 与 `/home/me/proj` 不相等。`/` 与 `\` 在两种 flavor 中都只作为可移植输入的 separator 解析，不改变 segment 的 case rule。
- 比较只在上述 canonical segment vector 上进行：`target` 的前 `base.segmentCount` 个 segment 必须逐项相等，并且 target 必须至少多一个 segment。由此 `proj` 不会命中 `project`，equal path 也不是 descendant。
- relative suffix 从 **target 第一个未消费 segment 的原始 `start` boundary** 切到 target 最后一个有效 segment 的原始 `end` boundary；禁止使用 raw/canonical `base.length`、canonical string length 或在 normalized string 上切完再映射。这样 base 或 target 任一侧的重复/混合 separator 都不会使 raw suffix 偏移，同时逐字保留 target suffix 的原始 segment casing 与内部 separator。
- empty base/target、equal path、非 descendant、rooted/relative mismatch 或不同 root/drive 映射为现有明确的 empty relative-path sentinel；`shortRelativePath` 的 absolute display fallback 仍由其 caller-local contract拥有，不进入 `relativePathFrom`。

随后删除 `packages/overlay/src/utils/path.ts`。将 `packages/overlay/test/path-util.test.ts` 改为直接 import `../src/utils/tool`，保留/整理为输入到明确输出的正向 contract table，覆盖 POSIX、Windows、mixed separator、case variance、trailing separator、equal/outside/empty sentinel。删除“旧 helper 不存在”或“不得调用 fallback”式负向措辞，不新增静态 source assertion。

最低正向矩阵必须包含以下明确输出（同语义 cases 可 table-drive）：

| base | target | expected |
| --- | --- | --- |
| `/home/me/proj` | `/home/me/proj/sub/a` | `sub/a` |
| `/home//me///proj/` | `/home/me/proj/sub/a` | `sub/a` |
| `/home/me/proj` | `/home//me/proj///sub\\a` | `sub\\a`（从首个未消费 original segment 切片，保留 target suffix 表示） |
| `/home/me/proj` | `/home/me/proj/Sub/A` | `Sub/A`（保留 target suffix 原始 casing） |
| `/home/me/Proj` | `/home/me/proj/sub/a` | empty sentinel（POSIX segment case-sensitive） |
| `D:\\Dev\\Proj\\` | `d:/dev/proj/sub/a` | `sub/a` |
| `D:\\\\Dev\\Proj` | `D:\\Dev\\Proj\\sub\\a` | `sub\\a` |
| `D:/Dev/Proj` | `d:\\dev\\proj\\Sub/a` | `Sub/a`（Windows 所有 segment case-insensitive，输出保留 target casing） |
| `D:\\proj` | `E:\\proj\\sub` | empty sentinel |
| `D:\\` | `D:\\workspace\\repo` | `workspace\\repo` |
| `/` | `/workspace/repo` | `workspace/repo` |
| `relative/proj` | `/relative/proj/sub` | empty sentinel |
| `/home/me/proj` | `/home/me/project/sub` | empty sentinel |
| `/home/me/proj` | `/home/me/proj` | empty sentinel |

实现者应以 path parser 的 segment/boundary contract 为 authority；上表不是允许用字符串 replace/prefix 特判逐项通过的许可。

### 5. 文档、台账与交付状态

- `specs/current/architecture/04-extensions.md` 已明确 public Market 的唯一 browse authority，本批次实现不重复新增同义架构段落；若实施 diff 显示该段仍不足以说明 live update projection，可只做最小澄清，禁止新建第二份 Overlay architecture。
- 实现完成时更新 remediation program ledger、`specs/README.md` 与 `specs/records/2026-08/README.md`，记录 `CS-007` 的 plan review、验证、delivery review 和 commit；共享索引必须与并行任务协调后再改，不在本 planning-only pass触碰。
- 删除文件属于当前 shipping graph 的清理，不修改 route/OpenAPI/SDK public schema，也不需要 `docs:api` regeneration。

## 公共契约、数据、调用点和风险矩阵

| 面 | 决策 | 主要风险与控制 |
| --- | --- | --- |
| Overlay composition | 不增加 terminal tab；Browser Preview 与 Expert Squad 保持现有入口 | 防止借清理扩张未知 UI 产品面；`/ui` 与 Tauri host 验收严格分开 |
| PTY API/SDK | 完整保留 | 用全仓 reference inventory 与 typecheck/build证明未误删 server/SDK contract |
| Browser Preview | `main.tsx` controller path 是唯一入口 | Knip/search 证明删除边界；只有隔离 Tauri host 的真实 navigation + screenshot 才能证明 live ingress，普通 `/ui` 不可替代 |
| Expert Squad Market | public website browse + live settings update/recovery reads | 删除 selected local catalog shadow；保留 live composer test |
| Path display | `utils/tool.ts` 唯一 helper | 用 production import 的 pure test覆盖 mixed separators 与 boundary；不保留副本 |
| Durable data | 无 schema、row、cache migration | 五个岛均无 durable owner；不添加 tombstone/compat reader |
| Styles/i18n | 删除 terminal-only CSS 与 keys | `check:i18n`、CSS token checker、build 和真实页面截图复核 |
| Dead-code checker | 本项五个文件归零 | 不隐藏 `native-menu`/unused dependency；在 `CS-008` 前如实记录 checker仍非零 |

## 聚焦正向验收

### 静态与真实 production graph

1. 运行 scoped production reachability checker：

   ```powershell
   bunx knip@6.27.0 --config knip.config.js --no-progress --production --include files,dependencies,unlisted,binaries --workspace packages/overlay
   ```

   在 `CS-008` 未修前允许命令因已知 `native-menu.tsx` entry false positive / unused dependency 非零退出，但输出中必须没有本项五个路径。不得通过 Knip ignore 取得假 green；原始输出写入 verification log。
2. 全仓 reference inventory 对 `TerminalPanel`、`services/terminal`、`browser-preview-link`、`expert-squad-market-catalog`、`utils/path`、`terminal_panel.` 与 `.terminal-panel` 返回零 current reference；纯删除 search 只作为交付证据，不写成测试。
3. `relativePathFrom` 的 production definitions 精确为一个，current callers 均指向 `utils/tool.ts`。

### 聚焦非 UI 正向测试与编译检查

```powershell
bun run --cwd packages/overlay test:unit test/path-util.test.ts test/composer-expert-squad-catalog.test.ts
bun run --cwd packages/overlay typecheck
bun run --cwd packages/overlay check:i18n
bun run --cwd packages/overlay check:css-tokens
bun run --cwd packages/overlay build:vite
bun run docs:check
git diff --check -- <task-owned paths>
```

- 不运行已删除的 `terminal-output-stream.test.ts`；PTY event schema 的 current positive authority 仍在 transport-protocol contract test，本批次不修改它，也不用另一个 narrow mock 冒充 Overlay UI 端到端。
- 不运行整个 Overlay unit suite，因为其中包含 UI-oriented tests；只运行上面两个 pure service/utility files。

### 真实页面视觉验收（两个不可互相替代的层次）

由于删除了全局加载的 stylesheet link 与 i18n entries，实施者必须把 Web UI 样式验收与 native Browser Preview ingress 验收拆开记录。

#### A. `/ui` 真实 Web UI 页面与样式

1. 用项目开发模式在明确记录的隔离端口启动后端，并通过 `http://localhost:<port>/ui` 打开默认桌面 Web UI；不得单独启动 Vite，除非项目 dev mode 明确不提供目标页面。
2. 记录启动命令、实际端口、project/directory fixture 和截图路径。在改动前查看当前可达 workspace/Right Dock 与 Expert Squad settings；改动后重新打开同一真实 surface。
3. 截取改动后桌面截图并人工检查布局、全局 stylesheet cascade、Right Dock 与 Expert Squad settings 没有因移除 terminal-only CSS/catalog island 回归；若视觉结果异常，修复后重新截图。
4. 此层只证明 Web UI 真实页面/样式与可达 surface。普通浏览器没有 Tauri native Browser Preview surface/capability，**不得**把 `/ui` 中的 DOM、按钮、link markup、controller 存在或 external navigation 当成 Browser Preview live ingress 验收。

#### B. 隔离 Tauri host 的 Browser Preview 实际导航

仓库默认 `bun run --cwd packages/overlay dev` / 裸 `tauri dev` 使用固定 `http://localhost:5173`、正式 `ai.opencorvus.overlay` identifier 和 single-instance plugin，**本验收禁止运行这两个默认命令**。它们可能撞占现有端口或把启动请求交给用户正在使用的正式实例。实施者只能按以下 recipe 建立一次性 host；所有变量值和检查输出进入 verification log，但临时目录不进入仓库：

1. 在 PowerShell 中创建唯一 run id、绝对临时数据根、fixture project 和临时 Tauri config；先用 loopback ephemeral bind 选择 Vite port，释放后立即以 `strictPort` 使用，任何竞争占用都必须使启动失败而不是换端口。临时 config 从当前完整 `src-tauri/tauri.conf.json` 深拷贝后只改以下 identity fields，避免丢失 base window/security/plugin 配置：

   ```powershell
   $runID = "cs007-" + [guid]::NewGuid().ToString("N")
   $previousOpenCorvusHome = $env:OPENCORVUS_HOME
   $runRoot = [IO.Path]::GetFullPath((Join-Path $env:TEMP $runID))
   $isolatedHome = [IO.Path]::GetFullPath((Join-Path $runRoot "opencorvus-home"))
   $fixtureProject = [IO.Path]::GetFullPath((Join-Path $runRoot "fixture-project"))
   New-Item -ItemType Directory -Force -Path $isolatedHome,$fixtureProject | Out-Null

   $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
   $listener.Start()
   $vitePort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
   $listener.Stop()

   $overlayRoot = [IO.Path]::GetFullPath("packages/overlay")
   $configPath = Join-Path $runRoot "tauri.cs007.conf.json"
   $config = Get-Content (Join-Path $overlayRoot "src-tauri/tauri.conf.json") -Raw | ConvertFrom-Json
   $config.identifier = "ai.opencorvus.overlay.cs007." + $runID.Substring(6)
   $config.productName = "OpenCorvus CS007 " + $runID.Substring(6, 8)
   $config.build.devUrl = "http://127.0.0.1:$vitePort"
   $config.build.beforeDevCommand = "node ./node_modules/vite/bin/vite.js --config vite.config.ts --host 127.0.0.1 --port $vitePort --strictPort"
   $config.plugins.'deep-link'.desktop.schemes = @()
   ($config.app.windows | Where-Object label -eq "main").title = $config.productName
   $config | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $configPath -Encoding utf8
   $env:OPENCORVUS_HOME = $isolatedHome
   ```

   唯一 identifier 隔离 single-instance identity；唯一 title 隔离可见窗口身份；唯一 Vite port/devUrl/beforeDevCommand 隔离 frontend；绝对 `OPENCORVUS_HOME` 隔离 embedded backend、runtime 与数据。临时 config 必须清空 deep-link schemes，因为此项验收不需要 deep link，且 Windows/Linux 上 `register_all()` 会写系统协议处理器；绝不能让隔离 host 接管用户的 `opencorvus://` handler。fixture project 只能在这个新窗口内选择，不能选择用户当前 project/directory。
2. 启动前必须同时通过以下 preflight，否则不启动：临时 identifier 不等于 `ai.opencorvus.overlay`；config 中 `devUrl` 与 `beforeDevCommand` 都精确包含同一个 `$vitePort`；`plugins.deep-link.desktop.schemes` 精确为空数组；`OPENCORVUS_HOME` 为 `$runRoot` 下的绝对路径且不是用户正常数据根；`Get-NetTCPConnection -State Listen -LocalPort $vitePort -ErrorAction SilentlyContinue` 无结果；桌面上不存在标题为 `$config.productName` 的窗口。另记录启动前所有现存 OpenCorvus 窗口的 process id/title，后续不得关闭、刷新、聚焦操作或复用这些窗口。
3. 只从 `packages/overlay` 目录运行 `bun run tauri dev --config "$configPath"`；这是唯一允许的启动命令。启动日志必须显示临时 config 的唯一 dev URL，Vite 必须绑定精确 `$vitePort`，新 native 窗口标题必须精确等于 `$config.productName`，其 process id 必须不在启动前快照中。若请求被转交到旧窗口、端口发生替换/占用、窗口 identity 无法唯一确认或 isolated home 未生效，立即判失败；只关闭本次新窗口/进程树，不操作既有 OpenCorvus 实例。
4. 在该唯一确认的 native host 中选择 `$fixtureProject`，打开一个包含 HTTP(S) link 的真实消息或 Source link并实际点击；验收必须观察 current `main.tsx` document ingress 使 mounted Browser Preview native surface 导航到目标 URL，而不是仅打开 external browser、仅看到 anchor、或调用一个 isolated helper。
5. 保存至少两张绑定当前目标的人工证据截图：点击前含真实消息/link、唯一窗口 title 和 fixture project identity 的 Overlay 页面；点击后含 Right Dock Browser Preview、实际目标 URL/页面内容以及相同 title/project identity 的同一隔离 Tauri window。记录 host capability、Vite port、embedded backend 实际 URL/port、目标 URL 与人工结论；同时确认启动前记录的用户窗口 process id/title 全部未被替换或关闭。
6. 在 `finally` 中正常关闭且只关闭本次唯一 title/process tree 的隔离 host；确认目标进程已退出且 `$vitePort` 已释放后，恢复 `$env:OPENCORVUS_HOME = $previousOpenCorvusHome`（原值不存在时移除该环境变量），再删除临时目录。不得在进程仍运行时删除目录，也不得按名称批量结束 OpenCorvus/Tauri/Node/Bun 进程。
7. 若上述隔离 host 无法安全启动或验收（缺少 executable/runtime、native capability、唯一 identifier/title、isolated home/project/port，或只能复用用户窗口），这是 **CS-007 delivery blocker**：本批次不得标记完成或宣称 Browser Preview live ingress 已验收。即使代码删除、非 UI 检查和 `/ui` 样式截图通过，交付状态仍必须列出：
   - 删除边界由 reachability search/Knip 与 unchanged live caller diff 证明；
   - current live ingress 未被本批次修改；
   - native live-ingress visual acceptance 未达成及精确阻塞；
   - `/ui` 截图仅支持样式未回归，不能补足这项证据。

两层均禁止创建 Playwright test、DOM assertion、snapshot、baseline 或 pixel diff；所有操作使用隔离页面/服务，不触碰用户现有窗口或进程。

## 独立复审要求

1. 实施前：由未参与本调查的 agent 只读复核本文，重点挑战：
   - product intent 是否足以支持删除 terminal client 而保留 PTY backend；
   - Browser Preview/Market 是否确有 live authority，删除是否会形成行为缺口；
   - path normalization 是否精确定义且不会改变 caller-owned fallback；
   - 测试删除/保留是否符合 UI 禁令与正向测试规则；
   - `CS-008` checker defects 是否被明确隔离而非隐藏。
2. 首轮实现和验证后：另一名未参与实现的 agent 只读审查完整 diff、deleted-file inventory、Knip 原始输出、focused tests、typecheck/build/docs、真实页面截图和人工结论。
3. 主 agent 核验并修复所有有效 finding；有任何修复就重跑相关验收并再次独立复审，直到 PASS 且无 unresolved finding。

## 明确不做

- 不新增或恢复 interactive terminal UI，不删除 PTY backend/API/SDK/docs。
- 不把 Browser Preview link service 包装成 `main.tsx` 的 fallback，也不同时保留两套导航。
- 不在 Overlay 重建可浏览 Expert Squad Market，不新增 selected-market store/cache。
- 不修改 Knip 配置、`native-menu.tsx` 或 dependency inventory 来顺手关闭 `CS-008`。
- 不新增 shared path module；现有 production authority 是 `utils/tool.ts`，本项只把正确语义收进去并删除副本。
- 不运行或修改 UI 自动化测试，不用 source/DOM/absence assertions证明删除。
- 本 planning-only pass 不改任何生产/测试/共享索引，不 stage、不 commit。

## 当前状态

- 深挖与方案：完成。
- focused plan review：第一、二轮各 2 项 CHANGES REQUESTED 均已完整修订；第三轮待同一独立 reviewer 复核。
- 实现、验证、视觉验收、delivery review、commit：均未开始。
