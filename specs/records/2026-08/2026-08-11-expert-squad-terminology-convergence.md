# Expert Squad Terminology Convergence

## Recall

| Item | Evidence / requirement |
| --- | --- |
| User request | 把项目内旧的专家团产品名全部统一为 `expert squads`。 |
| Acceptance | 所有当前产品文案、公开说明、接口说明、内置生成专家团名称、正向测试描述与生成产物统一使用 `Expert Squad` / `Expert Squads`；中文界面不再夹杂旧英文产品名。 |
| Hard constraints | 保留 `expert_squad`、`ExpertSquad*`、`expert-squad` 与 `.opencorvus/expert-squads` 等现行公共契约；不把“一个 Squad 中包含若干 Agent”的普通成员计数变量误改成产品身份；不运行 UI 自动化测试；真实页面和截图是 UI 验收。 |
| Repository identity | `D:/myhexin-local/opencorvus`, branch `main`, commit `1e552c414f2348724a9db3f3e72776fd49da5060`, upstream `origin/main`, divergence `behind 29 / ahead 6` at investigation time. |
| Dirty-worktree boundary | 工作区已有大量并行改动，包含两份 i18n、OpenAPI、生成 SDK、架构文档与 transport protocol；本任务只修改精确术语片段，保留同文件其他差异。 |
| Read materials | `AGENTS.md`; `specs/current/architecture/04-extensions.md`; `specs/README.md`; `specs/records/2026-08/README.md`; `script/generate.ts`; `packages/opencorvus/script/generate-portable-expert-squad-template.ts`; `packages/web/script/generate-public-market.ts`; Browser skill instructions. |
| Repository search | 不区分大小写的旧产品短语命中 23 个 tracked 文件；主要分布在 Overlay 双语文案、`squad-sdk` 作者源、API 描述、transport 注释/正向测试、历史/current specs、portable template 和 public Market 生成事实。`AgentSquad` camel-case 命中仅是按 Agent 数量分组的测试变量，不是旧产品身份。 |
| Independent Agent feedback | 无（实施前）；完成首轮实现和验证后按仓库规则委托未参与实现的只读 Agent 审查。 |

## Problem depth and impact analysis

### Observable phenomenon

当前架构、目录、类型和大多数产品表面已经以 Expert Squad 为唯一名称，但 Overlay 仍显示旧英文名称，内置 `squad-sdk` 仍叫旧的生成名称，API/SDK 描述、测试标题、公开 Market 事实和部分文档也继续传播旧术语。同一能力因此在相邻界面和契约说明中出现两个产品名。

### Direct trigger and data flow

旧名称来自三个作者源并向下游扩散：

1. `packages/overlay/src/i18n/{en-US,zh-CN}.json` 直接渲染 Composer、Market、配置与 launcher 文案；
2. `expert-squads/builtin/squad-sdk/**` 定义内置包的人类可读 identity、Agent labels、selector 与 projected Skill 文本，并进入 payload、portable template 和公开 Market facts；
3. server route 与 transport protocol 的说明文字进入 OpenAPI、JavaScript SDK 和开发者可见契约。

历史与当前 specs、正向测试标题又会让旧名称继续出现在维护和验收入口。

### Root cause

此前已经把运行时事实源迁移为 `expert_squad` / Expert Squad，但产品语言迁移没有覆盖所有作者源和生成闭包；生成文件中残留的旧名称容易让局部手工替换看似完成，下一次 generation 又恢复旧词。根治边界必须同时修改作者源、重生成全部受影响产物，并以仓库级残留扫描封闭结果。

### Why old paths did not converge

现有目录、类型和 API 字段已经是正确契约，不应再次重命名。问题不是存在第二套运行时，而是人类可读名称的迁移不完整。只改 Overlay、只改内置 manifest，或直接手改生成文件都会保留一个可重新传播旧名称的来源。

### Impact surface

- Definitions and call sites: Overlay i18n、内置 `squad-sdk` package、authoring tool receipt、global route 描述、transport 注释。
- Public contracts: OpenAPI 描述及 JavaScript SDK 生成注释；字段和 route 不变。
- Data and persistence: manifest human-readable `name` / `label` 与 package digest 会变化；canonical manifest `id: "squad-sdk"`、安装路径与选择 identity 不变，不需要迁移或兼容层。
- Tests: 更新聚焦正向契约描述和期望值；不新增“旧词不存在”的测试。
- Documentation and delivery: current/historical specs、spec indexes、portable template、payload/Market facts 必须闭包一致。
- UI: English 使用 `Expert Squad(s)`；中文面向用户的旧英文产品名改为“专家团”，普通 Agent、Skill、Mission、Squad 成员语义保持不变。
- Risk: 脏工作区同文件重叠、生成器扩大无关差异、package digest 变化、真实页面未加载到本次源代码。以上分别通过精确 patch、生成前后 diff 审计、聚焦包测试和隔离服务截图处理。

## Implementation plan

1. 修改全部作者源和 tracked 文档中的旧产品名；对 `Squad agents` 这种界面成员标签只补全为 `Expert Squad agents`，不改 Agent 数量变量。
2. 从 canonical source 生成 portable template、Expert Squad payload/public Market facts、OpenAPI 与 JavaScript SDK，检查生成差异只来自本任务语义或已有并行改动。
3. 运行相关非 UI 正向测试、package typecheck、`api:routes-check`、`docs:check` 和仓库残留扫描；不运行已触及路径中的 UI 自动化测试。
4. 启动隔离 Overlay 页面，分别查看英文与中文的 Expert Squad picker/Market，保存截图并人工检查可读性、术语一致性和布局。
5. 委托未参与实现的 Agent 只读审查完整差异、生成闭包、测试、文档和回归风险；修复有效发现并复验，直到无未解决发现。
6. 使用隔离的 staged boundary 提交本任务；push 前审计 `upstream..HEAD`。若现有 ahead commits 不属于本任务且未获得本轮授权，按仓库规则停止 push 并报告。

## Acceptance evidence ledger

- Residual audit: `git grep -n -i -P '(?<!Expert )Agent[ -]Squads?' -- ':!bun.lock'` returns no tracked old product phrase after final generation. The retained camel-case test variables describe Squads containing four or five Agents and are outside the product-identity migration.
- Generated closure: an alternate Git index containing only the current `expert-squads/builtin/squad-sdk/**` author source was required because payload generation intentionally reads the index. `generate-expert-squad-payload.ts`, `generate-portable-expert-squad-template.ts`, JavaScript SDK build, API docs generation, and `packages/web` Market generation all completed. Public facts resolve `builtin/squad-sdk@2026.08.10.1` as `Generate Expert Squads` with package digest `c5e01f4f17107100306fc64036d9bd9e02173e60fde91b0189e7188fa9aef394`.
- Focused positive tests: `squad-sdk-package.test.ts` 5 passed / 37 expectations; `visible-composer-references.test.ts` 1 passed / 2 expectations; hosted Market registry 3 passed / 17 expectations.
- Checkers: OpenCorvus typecheck, Overlay typecheck, JavaScript SDK typecheck, `api:routes-check` (6 rules / 34 files), `docs:check` (330 operations / 25 groups), and Web Astro check (0 errors, 0 warnings, one unrelated existing unused-variable hint) passed. The Web checker was rerun under the same alternate index so its own `market:data` precheck validated the new label and digest instead of regenerating the old index snapshot.
- Formatting: focused Prettier check found only `packages/opencorvus/src/tool/expert-squad-author.ts`; the same check also fails on the `HEAD` version of that file, while this task changes only its one same-shape receipt-title string. No unrelated whole-file formatting rewrite was made.
- Real UI build: `bun run --cwd packages/overlay build:vite` completed with 7,104 transformed modules. An isolated backend at `127.0.0.1:17913` served that exact `dist-vite` through `/ui/`; no existing native window or server was operated.
- English visual acceptance: [Installed Expert Squads](../../artifacts/2026-08-11-expert-squad-terminology-convergence/01-installed-expert-squads-en.png) visibly renders the navigation group, selected tab, page heading, typed scope title, and package guidance with the Expert Squad name. Manual inspection found no clipping, awkward wrapping, hierarchy drift, spacing defect, or old product term.
- Simplified Chinese visual acceptance: [已安装专家团](../../artifacts/2026-08-11-expert-squad-terminology-convergence/02-installed-expert-squads-zh-cn.jpg) visibly renders the corrected “专家团包” scope guidance. The current [English Squad Market](../../artifacts/2026-08-11-expert-squad-terminology-convergence/03-expert-squad-market-en.jpg) and [中文 Squad 市场](../../artifacts/2026-08-11-expert-squad-terminology-convergence/04-expert-squad-market-zh-cn.jpg) additionally prove the navigation group, browse heading, description, filters, search, empty state, local-install disclosure, and scope guidance in both languages. Manual inspection found no clipping, awkward wrapping, hierarchy drift, spacing defect, or old product term.
- Runtime limitation: the current combined dirty-worktree bundle logs an unrelated native-menu `transformCallback` JavaScript error before backend initialization, so the isolated page reports Offline. The settings shell and both target Expert Squad pages remain interactively reachable and rendered from the real current bundle, but the Composer and Mission pickers stay disabled; their visual acceptance is therefore not claimed. Source/resource coverage, focused tests, and the current Market/Installed screenshots cover the terminology migration without claiming repair of the parallel native-menu failure.
- Independent review: the first read-only pass confirmed the runtime identifiers, paths, Agent-count semantics, generated digests, focused tests, and tracked residual audit, and found two presentation defects: three mixed-language Chinese package/catalog phrases and one duplicated word in this plan. A later pass also identified historical screenshot wording and incomplete visual-acceptance claims. All findings were corrected. The final read-only review inspected the 29-path alternate-index tree, generated identity/digests, historical records, four current screenshots, checks, and explicit picker limitation, and returned PASS with no unresolved findings.
