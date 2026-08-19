# Artifact gallery — one Mission-produced case per Interactive Artifact renderer, carousel on the public landing page

## Recall

**用户原始要求**（逐条，按到达顺序）：

1. 「opencorvus目前有几十种artifact，我需要你为每一个都设计一个case，抛出一个效果图，生成轮播效果放到网站首页顶部」
2. 「在安装目录的数据库进行任务」
3. 「用mission不要用task」
4. 「用openai/gpt-5.6-luna」
5. 「要真实case，不要瞎编测试」
6. 「重置DB，重新跑完，再做完轮播的一整套」（授权重置安装库）
7. 「删除所有任务重新用研究室专家团重新做任务」→ 澄清为 **research studio**（`builtin/research-studio`）

**验收指标**

- `InteractiveArtifactPayload` 判别联合里的每一个 renderer 都有一个真实产出的 case。
- 每个 case 有一张真实渲染截图（真实 Overlay 页面，元素级截图），不是手绘、不是 mock。
- 公开站首页 hero 之下有一个轮播，按顺序展示这些效果图。

**硬约束**

- 产出路径必须是 Mission（`POST /mission/draft` + `POST /mission/:id/dispatch`），不是 Task。
- 每个 Mission 持有 `expertSquadIDs: ["research-studio"]`。
- 模型固定 `openai/gpt-5.6-luna`。
- 数据必须是真的：现场抓取或现场计算，不许编数字；办公交付物必须是真的落盘文件。
- UI 验收只能用真实页面截图（AGENTS.md 四），禁止新增 UI 自动化测试。
- 公开站样式必须走 `var(--oc-*)` 令牌，`test/style-discipline.test.ts` 会拦裸数值。
- 首页文案受 `test/landing-copy.test.ts` 预算约束；图片受 `test/lander-assets.test.ts`
  的「必须被组件按名引用 + 必须在 captured.json 里声明出处」双重约束。

**已读资料**

- `packages/opencorvus/src/interactive-artifact/schema.ts`（803 行）— renderer 判别联合与全部 refine 约束。
- `packages/opencorvus/src/interactive-artifact/persist.ts` — `publishInteractiveArtifact` 的宿主校验
  （附件必须先在 `AttachmentStore` 里落地并且 sha/size 一致；glTF `model/gltf+json` 只允许内嵌 data URI，
  `model/gltf-binary` 不受此限；MCP App 的 html 摘要必须自洽）。
- `packages/opencorvus/src/tool/publish-interactive-artifact.ts` — 工具入参是
  `PublishableInteractiveArtifactPayload`，**不含 `mcp-app@1`**。
- `packages/opencorvus/src/interactive-artifact/mcp-app.ts` + `src/mcp/index.ts` —
  `_meta.ui.resourceUri` 是 MCP App 的唯一入口，资源 mimeType 必须是 `text/html;profile=mcp-app`。
- `packages/opencorvus/src/server/routes/mission.ts` — draft / dispatch / status / delete 的真实契约。
- `packages/overlay/src/components/interactive-artifact/ArtifactFrame.tsx` — 外框 class `msg-artifact`；
  `data-artifact-id` 只有渲染器传了才有，**不能当截图锚点**。
- `packages/web/src/components/OcLanding.astro`、`styles/tokens.css`、`test/lander-assets.test.ts`。

**全仓搜索结果**

- renderer 全集 20 个：`document@1 table@1 chart@1 diagram@1 code@1 diff@1 candlestick@1 media@1
  file-preview@1 map@1 notebook@1 presentation@1 spreadsheet@1 dashboard@1 timeline@1 network@1
  tree@1 terminal@1 model-3d@1 mcp-app@1`。
- 仓库里没有叫「研究室」的专家团；`research-studio` 是内嵌的内置研究交付团队
  （Planner / Deep Researcher / Evidence Analyst / Fact Checker / Report Writer），不经 Market 分发。

**独立 agent 反馈**：无（实施完成后按 AGENTS.md 三委托只读复核）。

## 环境事实（本轮实测，与既有记忆冲突处以此为准）

- **安装目录数据库已按用户授权重置两次**（`opencorvus db reset --force`，第一次重置前把
  `opencorvus.db{,-wal,-shm}` 备份到 `tmp/installed-db-backup/`）。第一次重置的原因：
  该库含 `engine_iteration` 表，仓库 HEAD 的 canonical DDL 已经没有它，开库直接
  `DatabaseUnavailableError: … unexpected schema object table:engine_iteration`；
  预发布构建不打补丁迁移，唯一出路就是 reset。第二次是用户要求「删除所有任务」重跑。
- **Playwright 可用**（与 `website-restyle-plan` 记录的「任何浏览器都起不来」相反）：
  Node.js + 显式 `executablePath` 指向 `~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe`
  可以正常启动并截图；Playwright 自带的版本解析会去找未安装的 1217/1228 而失败。
- Claude Code 的 Browser pane 仍然不合成帧，`computer{action:"screenshot"}` 5s 超时；只能用 Playwright。
- `deepseek` 余额为 0（HTTP 402），`openai` 走 rate_limits 账户，成本表为 0。
- 数据源实测：stooq 有 JS 反爬、Yahoo chart 接口 429；Coinbase Exchange、World Bank、USGS、
  npm registry、GitHub releases、unpkg 都可直连。

## 已定位的宿主缺陷（本轮撞到，未修）

1. **Mission 里的 `question` 会产生没有 Task owner 的 interaction**，之后
   `projectInteractionRowInTransaction` 抛 `Interaction … has no immutable Task owner`，
   把整个 `listWorkLedger` 打成 500 —— 侧栏全挂。触发条件：Mission 会话在没有 Task 的情况下发起问询。
   规避：prompt 里禁用 `question` 工具。
2. **删除 Mission 后 session 行仍在**（`DELETE /mission/:id` 返回 true，`session` 表未清），
   目录被删掉后 work-ledger 就 404。
3. 编排器对「数据量大」的 brief 的第一反应是开 Task 委派，撞 workspace identity conflict 后
   十分钟什么都没产出。prompt 必须显式禁止建 Task，只禁止 sub-agent 不够。

## 落地形态

- **驱动**：`packages/web/qa/artifact-gallery/`
  - `cases.mjs` — 19 个 case（第 20 个 `mcp-app@1` 由 `run-mcp-app.mjs` 拿），带三段 phase。
  - `prepare-attachments.mjs` — 真实字节进附件库（仓库自带 PNG、RFC 9110 PDF、Khronos DamagedHelmet.glb）。
  - `run-missions.mjs` — 每个 case 一个 Mission，持 `research-studio`，产物按 phase 依赖串起来；
    phase 之间把 Mission 真正写出的 `.pdf/.xlsx/.docx/.pptx` 上传成附件（agent 没有上传工具）。
  - `run-mcp-app.mjs` + `mcp-app-server.mjs` — 真 MCP stdio 服务器，工具返回 `ui://` 资源，
    宿主自己 mint 出 `mcp-app@1`。
  - `capture.mjs` — Playwright 打开真实 Overlay，逐个会话对 `.msg-artifact` 做元素级截图（2x DPR）。
  - `sync-results.mjs` — 从库里重建索引（两个并发 run 会互相覆盖 JSON）。
  - `publish-assets.mjs` — 缩放进 `src/assets/lander/artifact-gallery/` 并写 `captured.json` 出处。
- **首页**：`OcArtifactCarousel.astro` 插在 hero 之后（第 2 节），scroll-snap 轨道 +
  自动播放（悬停/聚焦/隐藏页/reduced-motion 时停）+ 前后箭头 + 圆点，
  文案在 `landing-copy.ts` 的 `showcase`，标题与 lead 已纳入文案预算门。

## 未决 / 风险

- Mission 产出的内容质量取决于模型：已知需要盯的点是 spreadsheet 要镜像整张表而不是前两行，
  presentation 不要用整屏图片当首页，terminal 要有可读的 build log。
- 采集脚本不是 UI 自动化测试，不进 CI，不做断言，只产图。
