# 公开站收敛改版方案

日期：2026-08-18。取代 2026-08-17 的 B 档多页方案。
最终形态：**一个落地页 + 一个专家团市场页（含 SSR 详情）**，公开站从 8 个 surface 收敛到 2 个。

参考基线：`https://www.deepseek.com/harness/`，实测对象为其线上产物——静态 HTML（99 KB）、
编译 CSS bundle（`_next/static/css/6f322bb0cffe2c36.css`，44.7 KB）、4 个 JS chunk。

状态：**期 0–8 已实施完毕，期 9 部分完成**（截图基线受本机环境阻塞，见第十一章）。
改造范围仅限 `packages/web` 公开站表现层与信息架构。
不改 registry/API 路由、不改 health 端点、不改 Starlight 文档渲染管线。

实施结果核对（全部为【测】，在生产构建的服务器上实测）：

| 项 | 改造前 | 改造后 |
|---|---|---|
| 公开站 surface | 8 | **2**（落地页 + 市场） |
| 公开站路由 | 18 | **6**（2 静态 surface ×2 语言 + SSR 详情 ×2） |
| 退役 URL 重定向 | — | **12/12 实测真 301** |
| 删除的组件行数 | — | **2497**（5 个组件 + 页面壳） |
| `public-site.css` | 2103 行、零深色模式 | **已删除**，换成 `tokens.css` + `primitives.css` |
| 深色模式 | 无 | 双主题，83 项令牌对账 |
| 公开站测试 | 0 | **44 项**（令牌对账 / 文案预算 / 刻度纪律 / 降级守卫 / 平台事实） |

## 数字出处标记

上一版文档把估算和测量混在同一张表里，且带一位小数，造成假精度。本版每个数字必须带标记：

- **【测】** 从产物直接提取或计数，可复验（附提取方式）
- **【算】** 由【测】值推导的算术结果，输入变则结果变
- **【估】** 无基线的判断。**按 ±40% 读**。本仓库没有可比的改版历史，也没有速度数据，
  所有人日都属此类。不要拿【估】值做承诺。

无标记的数字视为缺陷。

## 一、目标与边界

> **公开站收敛为一个落地页 + 一个专家团市场页，把「自动化地优化你的每日工作流」讲清楚；
> 其余全部内容进 Starlight 文档。表现层同时切到玻璃拟态 + 着色器底图 + 令牌纪律，
> 并补齐当前缺失的双主题与移动端。**

定位口径：

- Slogan：**自动化地优化你的每日工作流**
- 三支柱：**开源 / 定制 / 控制**

收敛的理由不是省工期，是**滚动深度和维护面**。18 条路由没人逐条看；
参考站正是靠「一个落地页 + 外链文档」拿到它的观感密度。

**市场是唯一的例外，且理由明确**：它不是一篇要人读的说明页，而是一个有 99 条记录的
可检索目录，带深链、分享预览和搜索流量诉求。这三样都不是落地页的一个段落能承载的。
除市场之外，任何新增独立页面都要先说明它凭什么不是文档的一节。

### 法务与原创性边界

1. **不移植其编译产物中的着色器源码。** 期 5 基于开源 mesh-gradient/warp 方案重写。
   本方案对其着色器只做了 uniform 签名级别的复杂度判定。
2. **不沿用其品牌色。** `--ds-color-brand: #4d6bfe` 属品牌标识，我们保留自有 cobalt 色系。
   对观感影响极小——品牌色在该页只出现在小号链接与 CTA 标题上，气质由中性表面层决定。
3. **不沿用其文案、字标与二维码。**

### 明确不复刻清单（有意偏差，提前签掉）

| 项 | 参考站 | 我们 |
|---|---|---|
| 品牌色 | `#4d6bfe` / dark `#6799fe` | 自有 cobalt `#2946d3` 系 |
| 字标 | `Edit Undo` 像素字 + text-stroke | 现有 `logo-*.svg` |
| 产品截图 | 插件设置图、trajectory 视图 | `src/assets/lander/harness-gallery/` 现成 4 张 |
| 社群入口 | 微信公众号二维码 | GitHub + Discord（`config.mjs`） |
| Host Grotesk | display 字族 | 不引入，由 Montserrat 覆盖，省一次字体往返 |
| 自定义光标环 | `.ds-cursor-ring`（mix-blend-mode 跟随环） | 不做。收益低、可访问性风险、移动端需整块屏蔽 |
| 着色器参数 | 其调校值 | 自行调校，以期 0 静态基线定版 |

“还原度”一律以本方案的规格为靶，不以参考站线上表现为靶——它会变。

## 二、参考基线实测

以下全部为【测】，提取方式：`curl` 取产物 → `tr '}' '\n'` 拆 CSS 规则 → `grep`/`python` 计数。

### 2.1 令牌体系

`:root` 定义 **83 个** `--ds-*` 令牌【测】，其中 **49 个**在 `[data-theme=dark]` 被重定义、
34 个仅 light【测】。（上一版写"约 90 个"是目测估值，已由 `qa/restyle/tokens.reference.json`
的机器提取取代。）按前缀分组：`button 21 / surface 14 / space 13 / border 8 / text 7 /
radius 6 / brand 4 / font 4 / static 3 / effect 2 / other 1`【测】。五组语义：

| 组 | 内容 |
|---|---|
| 文本 | `text-primary` / `-primary-bluish` / `-secondary` / `-description` / `-inverse` / `-placeholder` / `-link-blue` |
| 品牌 | `brand` / `brand-deep` / `brand-medium-reverse` / `brand-light-reverse` |
| 表面 | `bg-page` / `bg-surface-1..5` / `bg-surface-raised` / `bg-overlay` / `bg-hero-cta` / `bg-code` / `bg-hover` / `bg-input(-hover)` / `bg-dark` |
| 描边 | `border-subtle` / `-default` / `-divider` / `-hover` / `-strong` / `-secondary` / `-input(-focus)` |
| 按钮 | 6 变体 × {bg, text, border, hover-bg, hover-border} |

刻度：

- 间距 13 级：`4 / 8 / 12 / 16 / 24 / 32 / 40 / 56 / 80 / 120 / 160 / 200 / 240` px
- 圆角 6 级：`pill 100px` / `card 24px` / `panel 16px` / `media 10px` / `input 10px` / `sm 8px`
- 玻璃模糊：`12px`
- 卡片阴影：light `0 0 0 1px #f1f5f9, 0 2px 4px rgba(0,0,0,.05), 0 12px 24px rgba(0,0,0,.05)`；
  dark 换成内高光 `inset 0 1px 0 hsla(0,0%,100%,.12)`。**暗色不是反色**，这是暗色玻璃质感的关键

关键中性值（通用中性色，直接对齐）：

| 语义 | light | dark |
|---|---|---|
| 页面底 | `#f9f8f8` | `#0a0a0a` |
| 主文本 | `#1e232c` | `#fff` |
| 次文本 | `rgba(0,0,0,.7)` | `hsla(0,0%,100%,.8)` |
| 说明文本 | `rgba(0,0,0,.65)` | `hsla(0,0%,100%,.5)` |
| 抬升表面 | `hsla(0,0%,100%,.45)` | `hsla(0,0%,100%,.25)` |
| 细描边 | `rgba(0,0,0,.06)` | `hsla(0,0%,100%,.08)` |
| 主按钮底 | `#1a1615` | `#fff` |

全量令牌见 `packages/web/qa/restyle/tokens.reference.json`（期 0 交付）。

### 2.2 版式

容器：`min(100% - 48px, 1140px)`；≥768px 收到 `min(100% - 144px, 1140px)`；
≥1560px 放到 `min(100% - 160px, 1280px)`。比我们现在的 `min(1344px, 100vw - 96px)` **更窄**。

字阶——**克制的文档型字阶，不是大字营销页**，这点最容易做错：

| 类 | 字族 | 字号 | 字重 | 字距 | 行高 |
|---|---|---|---|---|---|
| hero | Montserrat | 36 → 46px @768 | 500 | -.02em | 150% |
| heading1 | Montserrat | 28 → 36px @768 | 500 | -.02em | 150% |
| subtitle | DM Sans | 20px（页面内常覆写为 22px/400） | 500 | -.01em | 150% |
| title | DM Sans | 18px | 500 → 400 | -.01em | 150% |
| body | DM Sans | 16px | — | — | 160% + `text-wrap: pretty` |
| caption | DM Sans | 14px | 400 | — | 150% |
| xs | DM Sans | 13px | 400 | — | 150% |

字族 5 套，13 条 `@font-face` 全自托管、全 `font-display: swap`，仅 3 个文件进 preload
（`host-grotesk-latin` / `dm-sans-400` / `dm-sans-500`）。

两条对中文优先站点最关键的发现：

1. **它没有任何 CJK 网络字体**——中文全部落 `Noto Sans SC` / `PingFang SC` / `Microsoft YaHei` 系统字体。
   我们**同样不必**下发 CJK woff2（动辄数 MB），中文观感照样对齐。
2. `:lang(zh) .ds-cjk-spacing { letter-spacing: .1em }`——中文标题单独加字距。**必须复刻**，
   缺了它中文标题明显显得挤。

### 2.3 组件与动效清单

48 个 `ds-*` 类【测】，归为：

- 按钮：6 变体 × 3 尺寸（`s 14px` / `m 15px, 11-18px padding`）。pill 圆角 + `::after` 悬停填充层
  （`overflow:hidden; isolation:isolate`——用伪元素铺色而非改 background，过渡才不打断 backdrop-filter）
- 导航：`ds-header-wrapper` 固定居中 pill 条；`ds-header-bar::before` 承载玻璃层，
  滚动时 `opacity` 淡入（`transition: opacity .4s, visibility 0s .4s`）
- 移动端：`ds-mobile-menu` 全屏三段；≤448px CTA 组转竖排满宽
- 语言切换：`ds-locale-toggle` 32px pill 分段控件
- 浮层：`ds-glass-dropdown` / `ds-qr-panel` / `ds-tooltip`
- 底纹：`ds-grid-bg` 90px 网格 + **双向 mask 渐隐**（标准 `mask-composite: intersect`，
  `-webkit-` 用 `source-in,xor`，两套都要写）
- Hero CTA 卡：`@property --border-angle` 注册角度变量驱动 conic-gradient 旋转描边（6s linear），
  mask 挖空成 2px 边
- 入场：`ds-hero-enter` 0.8s ease-out backwards，`translateY(var(--enter-y,20px)) + blur(var(--enter-blur))`，
  靠 CSS 变量错峰
- 4 个 keyframes：`ds-hero-enter` / `rotating-border` / `blink`（终端光标）/ `arrow-sweep`
- 终端演示：双 `pre` 叠放（一个 `invisible` 占位撑高，**否则逐字打字会抖动整段布局**）+ tab + 复制

**零动画库**：无 framer-motion、无 gsap、无 lenis。`IntersectionObserver` 与
`requestAnimationFrame` 各出现 7 / 9 次（**出现次数，非独立实例数**）。
结论照旧：我们也不引入动画库，引入了反而做不出这种轻量感。

### 2.4 着色器背景

3 个 WebGL2 片元着色器（原生 WebGL，非 three.js），串成一条链：

1. **鼠标 flowmap**：ping-pong FBO，`u_prev` 采样 + `u_decay` 衰减 + 高斯笔刷 `exp(-d²/r²)`，
   把鼠标位置与速度写进 RG 通道
2. **warp / mesh-gradient**：5 色 + `u_proportion / u_softness / u_shape / u_shapeScale /
   u_distortion / u_swirl / u_swirlIterations`，读 flowmap 做增益，附 3 色 glow
3. **噪声层**：simplex noise（标准 `mod289/permute/taylorInvSqrt`）+ `u_grain` +
   `u_lightPos/u_lightCore/u_lightHalo` + `u_vignette` + `u_bloomThreshold/Range/Strength`

页面上 3 处 `<canvas>`：hero 两个（flowmap + 主渐变），末尾 CTA 区一个（hover 时 `scale(1.08)`）。

全站唯一高成本项，也是观感差异最大来源。

## 三、现状盘点

`packages/web`：Astro 7 + Starlight，`output: "static"` + node adapter。

**公开站现有 18 条路由**【测】（提取方式：`find src/pages -type f`，非从 `PublicSiteLayout`
的 `current` 联合类型推断——上一版正是这么数错成 14 的）：

| 路由 | 组件 | 行数【测】 | 本方案处置 |
|---|---|---|---|
| `/` `/zh-cn/` | `Lander.astro` | 759 | **重写为落地页 7 节** |
| `/market/` ×2 | `MarketplacePage.astro` | 423 | **保留**，换皮 |
| `/market/[ns]/[id]` ×2（SSR） | `SquadDetailPage.astro` | 476 | **保留**，换皮 |
| `/download/` ×2 | `DownloadPage.astro` | 724 | **删除**，并入落地页第 6 节 |
| `/use-with-agents/` ×2 | `AgentHostsPage.astro` | 893 | **删除**，100% 进文档 |
| `/mission/` ×2 | `MissionPage.astro` | 303 | **删除**，压成第 3 节 1 段 |
| `/publish/` ×2 | `PublishPage.astro` | 222 | **删除**，压成第 7 节 1 段 |
| `/trust/` ×2 | `TrustPage.astro` | 179 | **删除**，压成第 6 节 3 行 |
| `/architecture-explorer` ×2 | `EnterpriseArchitectureExplorer.astro` | 2036 | 只删两条独立路由，**组件保留**（见下） |

不动的非页面路由：`api/registry/v1/**`（3）、`api/site/v1/visitors/**`（2）、
`health/live`、`health/ready`、`[...slug].md.ts`。

样式现状：[public-site.css](../packages/web/src/styles/public-site.css) 2103 行【测】，
顶层类选择器 99 个【测】（`^\.[a-zA-Z0-9_-]+` 去重，**漏复合选择器，方向对不精确**），
4 个宽度断点 + 1 个 `prefers-reduced-motion`【测】，**零处深色模式**【测】。

美学差距是方向相反，不是调参可达：

| 维度 | 现状 | 目标 |
|---|---|---|
| 页面底 | `--paper: #eeeae0` 纸质暖白 | `#f9f8f8` / dark `#0a0a0a` |
| 描边 | 2px 纯黑印刷线 | 1px `rgba(0,0,0,.06~.1)` |
| 圆角 | 基本为 0 | pill + 24px 卡片 |
| 字族 | Arial Narrow + IBM Plex Mono | Montserrat + DM Sans + Fragment Mono |
| 深色模式 | 无 | 双主题 |
| 响应式 | `min-width: 1100px` 兜底，≤1099 才解除 | mobile-first，768 主断点 + 448 CTA 断点 |
| 容器 | `min(1344px, 100vw - 96px)` | `min(1140px, 100% - 48px)`，≥1560 放 1280 |

有利条件：

- 内容层已隔离：[landing.ts](../packages/web/src/content/landing.ts)（424 行，双语同构）+ `src/i18n/`
- `src/assets/lander/` 已有 20+ 张产品截图与概念 GIF，参考站截图位**现成有料填**
- 已用 `@fontsource/ibm-plex-mono` 自托管字体，加字体通路现成
- `PublicSiteLayout` 已有 `data-*` + inline script 的偏好机制，主题切换可挂同一处
- squad 详情已是 `prerender = false` SSR，没有静态路由爆炸问题

不利条件：

- `packages/web` **无浏览器测试**（只有 `test:registry` / `runtime:smoke`），视觉回归从零搭
- `astro.config.mjs` vite target 钉在 `safari14.1`，`@property` 需 Safari 16.4——旋转描边须降级

## 四、目标信息架构

### 4.1 路由

**6 条**【算】，两个 surface + 一条动态详情，各 ×2 语言：

| 路由 | 类型 | 职责 |
|---|---|---|
| `/` `/zh-cn/` | 静态 | 落地页，§五 的 7 节 |
| `/market/` `/zh-cn/market/` | 静态 | 专家团目录：检索、筛选、分段浏览 |
| `/market/[ns]/[id]` ×2 | **SSR**（`prerender = false`，现状即如此） | 单个专家团详情，深链与分享预览目标 |

文档留在 Starlight。非页面路由不动：`api/registry/v1/**`、`api/site/v1/visitors/**`、
`health/live`、`health/ready`、`[...slug].md.ts`。

两点定死：

- **落地页第 5 节是市场的引流位，不是市场的副本。** 静态渲染精选 6 个 + 一个「查看全部 N 个」
  跳 `/market/`。不做页内 drawer、不做页内全量列表、不做页内搜索——那是市场页的职责，
  重复实现两套筛选逻辑是最容易腐化的地方。
- **下载不单独成页** → 落地页第 6 节，客户端读已有 `public/downloads/latest.json` 做平台识别，
  SSR 输出全平台兜底，校验码折叠收起。

### 4.2 内容迁移目标

5 个迁移目标里 **3 个 Starlight sidebar 已有**，不新建信息架构：

| 来源 | 目标 | sidebar 状态 |
|---|---|---|
| `AgentHostsPage`（OpenClaw / Hermes 配置） | `acp` 或新增 `integrations/agent-hosts` | 已有 `acp` |
| `MissionPage` | `reference/mission-task` + `concepts/delivery-slice-task` | **已有** |
| `PublishPage` | `plugins` 或新增 `expert-squads/publish` | 已有 `plugins` |
| `TrustPage` | 新增 `expert-squads/trust` | 新增 |
| `EnterpriseArchitectureExplorer` | 保持嵌在 `concepts/enterprise-architecture` 里，不降级 | **已有** |

**实施期偏离一处（已执行）**：原计划要删掉 explorer 的 2036 行、在文档里换成静态图。实际保留了组件，
只删两条独立路由。三条理由：它零 import、不用 `public-site.css` 里任何类，所以期 5 删样式不影响它；
它已经嵌在两个文档页里，那是读架构文档的人真正会用它的位置；而本机采不到截图（见第十一章），
"换成静态图"没有可交付物。删掉一个能用的交互组件、换成一张拿不到的图，是净降级。

### 4.3 重定向

**12 条静态路由退役**【算】（6 个 surface × 2 语言）。全部配 301，不许 404——有外链和搜索索引。
`/market/` 与 `/market/<ns>/<id>` 保留原 URL，**不需要重定向**。

| 旧 | 新 |
|---|---|
| `/download/` ×2 | `/#start` ×2 |
| `/mission/` ×2 | 文档 `reference/mission-task` |
| `/use-with-agents/` ×2 | 文档 agent 接入页 |
| `/publish/` ×2 | 文档 `plugins` |
| `/trust/` ×2 | 文档 `expert-squads/trust` |
| `/architecture-explorer` ×2 | 文档 `concepts/enterprise-architecture` |

实现优先级：**优先在 deploy 层配 301**（`deploy/racknerd`）。若不便，保留 stub 页
（`<link rel="canonical">` + meta refresh + 无导航壳）。**stub 不算"页面"，不进视觉基线。**

## 五、落地页规格

"没人会看"不只是页数，滚动深度同样。每节带**高度预算**与**字数预算**——可执行约束，不是口号。

总高度预算 **≤ 7.5 屏** @1440×900【算】。超预算的内容进文档或市场页，不进落地页。

预算调过一次，理由记在这里而不是悄悄放宽：2026-08-18 用户要求新增 FAQ 段落（0.87 屏），
同时把字阶整体上调（正文 16→17px、hero 46→60px），两项合计约 +1.05 屏。同一轮把产品实景的
截图框从 640px 高收到 480px（`object-fit: cover` 从顶部裁切，构图重点本来就在上半部），回收约 0.15 屏。
**新增段落要么带着预算一起加，要么就别加**——不允许悄悄突破旧数字。

| # | 锚点 | 节 | 一句职责 | 素材 | 高度 |
|---|---|---|---|---|---|
| 1 | — | Hero | slogan + 4 个去处 | `landing.ts` hero + 着色器 + `npx` 打字机 | 1.0 |
| 2 | `#why` | 三支柱 | 开源/定制/控制，**每支柱配一条证据不配形容词** | MIT+仓库链接 / 专家团数+插件点 / 本地运行+权限门 | 0.8 |
| 3 | `#how` | 怎么工作 | 3 步讲完，细节外链 | 已有 `concept-flow` GIF + `MissionPage` 压成 1 段 | 1.0 |
| 4 | `#look` | 产品实景 | 让人看见东西长什么样 | `harness-gallery/` 4 张，tab 切换 | 1.0 |
| 5 | `#squads` | 专家团 | **引流位**：精选 6 个 + 「查看全部 N 个」跳 `/market/` | `public-market*.ts` 取前 6 | 0.8 |
| 6 | `#start` | 开始使用 | 平台自动识别 + 双 code block + 可信 3 行 | `latest.json` + `TrustPage` 压成 3 行 | 1.2 |
| 7 | `#faq` | 常见问题 | **6 条折叠问答**，含与 Claude Code / Codex 的定位区分 | 自写 | 0.87 |
| 8 | `#join` | 参与 | 贡献入口 | `PublishPage` 压成 1 段 + GitHub/Discord + 旋转描边卡 | 0.6 |
| — | — | Footer | MIT + 法务 + 访客数 | 现有 `PublicSiteFooter` + `VisitorCount` | 0.3 |

字数预算：**每语言正文 ≤ 1200 字**；节标题 ≤ 12 字；导语 ≤ 40 字；每卡 ≤ 60 字。超了往文档挪。

导航：固定 pill 条 = 品牌 + 5 个**锚点**（`#why #how #look #start #faq`）+ **`/market/` 真链接**
+ 语言 + 主题 + GitHub。锚点滚动，市场是跳转。移动端收进全屏菜单。
市场页与详情页共用同一条 pill 导航，锚点在非落地页时降级为「回首页 + 锚点」。

关键动作是**删，不是搬**。4 个退役页面共 1597 行组件【测】，整段搬进落地页会得到 20 屏怪物。
压缩比在 §三 表格的"处置"列已逐页定死，`AgentHostsPage` 893 行**页上只留一个链接**——
这是最大的单笔削减，也是最容易被"顺手保留一点"破坏的一笔。

## 六、令牌映射表（期 1 交付）

前缀 `--oc-`。刻度/中性对齐参考值（通用手法），品牌保留自有色。

```
/* 刻度：直接对齐 */
--oc-space-1..13   4 8 12 16 24 32 40 56 80 120 160 200 240
--oc-radius-pill   100px      --oc-radius-card   24px
--oc-radius-panel  16px       --oc-radius-media  10px
--oc-radius-input  10px       --oc-radius-sm     8px
--oc-blur-glass    12px

/* 字族：自托管 3 套，无 CJK 网络字体 */
--oc-font-display  "Montserrat", var(--oc-font-body)
--oc-font-body     "DM Sans", system-ui, "Noto Sans SC", "PingFang SC", sans-serif
--oc-font-mono     "Fragment Mono", ui-monospace, Consolas, monospace

/* 中性：对齐（见 §2.1） */
--oc-color-bg-page / -surface-1..5 / -surface-raised / -overlay / -code / -hover
--oc-color-text-primary / -secondary / -description / -inverse / -placeholder
--oc-color-border-subtle / -default / -divider / -hover / -strong

/* 品牌：不对齐 */
--oc-color-brand        #2946d3   (dark: #6f8dfa)
--oc-color-brand-deep   #172b8f   (dark: #fff)
--oc-color-accent       #e04b22   /* 现有 clay，保留作强调态 */

/* 阴影：light 三层柔影 / dark 内高光，不反色 */
--oc-shadow-card
```

期 1 必须同时产出 `packages/web/test/tokens.parity.test.ts`：断言每个 `--oc-color-*`
在 light 与 dark 两组下都有定义。这条专治「某颜色只在 dark 块里定义」——
玻璃拟态换皮最常见的翻车点，单一主题下肉眼看不出来。

### 对比度红线

不照抄参考站的低透明度令牌。以下三项为手算【算】（输入取 §2.1 令牌值，WCAG 相对亮度公式）：

| 令牌 | 参考值 | 对比度【算】 | 判定 |
|---|---|---|---|
| dark `text-description` | 白 50% on `#0a0a0a` | ≈ 5.3:1 | 过 AA，可用 |
| light `text-description` | 黑 65% on `#f9f8f8` | ≈ 6.8:1 | 过 AA，可用 |
| dark `text-placeholder` | 白 30% on `#0a0a0a` | ≈ 2.6:1 | **不达标，提到白 45%** |

## 七、分期

**人日全部为【估】，±40%，无速度基线。**

| 期 | 主题 | 人日【估】 | 状态 | 退出标准 |
| --- | --- | --- | --- | --- |
| 0 | 基线固化 | 0.5 | ✅ | `tokens.reference.json` 入库（83 项【测】）；截图基线**采集失败**，见第十一章 |
| 1 | 令牌 + 3 套字体 + 双主题管线 | 1.5 | ✅ | `tokens.parity.test.ts` 13 项通过；浏览器实测主题切换无闪白 |
| 2 | 原语层 | 3 | ✅ | `primitives.css` + `OcHeader` / `OcFooter` / `OcLayout` / `OcHeadBoot` / `OcNotFound` |
| 3 | 内容迁移进文档 + 12 条 301 | 2 | ✅ | 5 份内容落 4 个新文档页（双语 8 个文件）；12 条旧 URL 实测全部真 **301** |
| 4 | 落地页 7 节实装 | 3.5 | ✅ | 7 节齐；1440×900 实测 6.35 屏 / 预算 6.8；无 JS 时全平台下载兜底 |
| 5 | 市场页 + 详情页换皮 | 1.5 | ✅ | 两页迁到新原语；URL / 筛选 / 分段 / 深链 / 404 均无回归；`public-site.css` 已删除 |
| 6 | 着色器 hero + 三重兜底 | 3 | ✅ | 三层链路跑通（`data-shader="live"` 实测）；三条兜底路径就位 |
| 7 | 动效与交互演示 | 2 | ✅ | 错峰入场 / 单一共享 observer 揭示 / 打字机 / tab / 复制 |
| 8 | 双语文案按预算重写 | 1.5 | ✅ | `landing-copy.test.ts` 14 项；中文 430 字 / 英文 207 词【测】，均在预算内 |
| 9 | QA 与回归门 | 2 | ⚠️ 部分 | lint + 降级守卫 + 对比度红线已进测试；**24 张截图基线在本机采不到** |
| | **合计** | **~20.5** | | |

依赖：0→1→2→{4,5} 是硬依赖（基线→令牌→原语→页面）。3 / 6 / 7 / 8 可与 4、5 并行。

对比历史档位【估】：2026-08-17 的 B 档 24（21.5 主线 + 2.5 期 10）；纯单页方案 19。
本方案 20.5——比纯单页多出的 1.5 就是市场页与详情页换皮，换回 per-squad SEO、
分享预览和一个真正可检索的目录。

真正的收益不在工期，在**路由从 18 条降到 6 条**【算】、删掉 4357 行组件【算】、
以及公开站从 8 个 surface 收敛到 2 个。

## 八、逐期细节

### 期 0 · 基线固化（0.5【估】）

- ✅ `packages/web/qa/restyle/tokens.reference.json`：83 个令牌全量入库，
  带 source URL + `sha256` + 提取方式。**机器提取，禁止手改。**
- ⚠️ `packages/web/qa/restyle/reference/` 截图基线：**未能采集。**
  本环境的应用内浏览器对该外部域的导航被拒（`navigation to https://deepseek.com was denied`），
  只能用 `curl` 取到 HTML/CSS/JS 文本产物，拿不到渲染像素。
- 本文档定版

**因此还原度靶标调整**：以 §九 的两张清单（令牌 83 项 + 组件 48 项）为准，
这两张都由文本产物支撑、可复验。**放弃像素叠图对位**——没有参考截图，
§九 第 4 条里"叠 50% 透明度对位"的做法不成立，改为纯规格勾选。
若日后拿到截图（用户手动截、或换一个允许该域的环境），可再补回像素对位作为加强门。

退出：令牌基线入库；截图缺口已登记为约束而非待办。后续对位以本地基线为靶，**不再抓线上站**。

### 期 1 · 令牌 + 字体 + 双主题（1.5【估】）

- 新增 `src/styles/tokens.css`：§六 全量令牌。`:root` 定义 light，
  `:root[data-theme=dark]` 与 `@media (prefers-color-scheme: dark) :root:not([data-theme=light])` 双写
- 字体：`@fontsource/dm-sans`(400/500/700)、`@fontsource/montserrat`(400/500/600)、
  `@fontsource/fragment-mono`。**不引入** Host Grotesk 与任何 CJK 网络字体
- `PublicSiteLayout.astro`：`<head>` inline script 增加主题读取（复用现有 localStorage 偏好机制），
  首帧前写 `data-theme` 避免闪白；正文字体 preload；`meta[name=theme-color]` 随主题两值
- 新增 `test/tokens.parity.test.ts`

退出：parity 测试通过；主题切换无闪白、无未定义变量。

### 期 2 · 原语层（3【估】）

新增 `src/styles/primitives.css` + 少量 `.astro` 原语：

- `oc-btn-{primary,secondary,ghost,ghost-static,liquid,text}` × `{s,m}`，
  pill + `::after` 悬停层 + `isolation: isolate`
- `oc-container` 三档宽度
- `oc-header-wrapper` / `oc-header-bar` 固定 pill 导航 + 滚动玻璃层淡入
  （用 `IntersectionObserver` 哨兵，**不用 scroll 事件**）
- `oc-mobile-menu` 全屏三段 + ≤448px CTA 竖排
- `oc-locale-toggle` + 主题切换（同一组分段控件）
- `oc-glass-dropdown` / `oc-tooltip`（**不做 drawer**——squad 详情是独立 SSR 页）
- `oc-grid-bg` 双向 mask 网格（`-webkit-mask-composite: source-in,xor` + `mask-composite: intersect` 双写）
- `oc-cjk-spacing`
- `@property --border-angle` + `oc-cta-block` 旋转描边，**带 `@supports` 降级**

退出：原语在 sandbox 页全量渲染正确；`primitives.css` 无裸 px 间距/圆角（lint 见期 8）。

### 期 3 · 内容迁移 + 重定向（2【估】）

按 §4.2 把 5 份内容写进 Starlight（3 个目标已存在，2 个新建），按 §4.3 配 301。
迁移完成后删除组件：`MissionPage` / `AgentHostsPage` / `PublishPage` / `TrustPage` /
`EnterpriseArchitectureExplorer` = 3633 行【算】。

退出：文档侧内容完整可搜；12 条旧静态 URL 全部 301，无 404。

### 期 4 · 落地页 7 节实装（3.5【估】）

`Lander.astro` 重写为 §五 的 7 节，吸收 `DownloadPage` 的渲染逻辑后删除它（724 行【算】）。

- 第 5 节只做引流：静态渲染精选 6 个 + 「查看全部 N 个」跳 `/market/`。
  **不实现筛选、搜索、drawer**——那是市场页职责，两套筛选逻辑必然腐化
- 第 6 节：客户端读 `latest.json` 做平台识别，SSR 输出全平台兜底（**JS 失效也能下载**）
- 落地页部分从 `public-site.css` 摘出，改用 `tokens.css` + `primitives.css` + 页内局部

退出：7 节齐全；无 JS 时页面仍可读可下载；高度 ≤ 6.8 屏。

### 期 5 · 市场页 + 详情页换皮（1.5【估】）

`MarketplacePage.astro`（423）与 `SquadDetailPage.astro`（476）迁到新原语，**保留现有功能与 URL**。

- 筛选、分段浏览（`public-market-zh-*` 四批）、空态、404 态逐一过一遍
- 详情页保持 `prerender = false`；OG 与 meta 描述按单个专家团生成（这是保留独立页的主要收益）
- 迁完即可删除 `public-site.css`（落地页在期 4 已摘出）

退出：两页新皮渲染正确；筛选/分段/深链/404 无回归；`public-site.css` 退役。

### 期 6 · 着色器 hero（3【估】）

- 基于开源 mesh-gradient/warp 方案重写三层链路，**不移植参考站源码**
- `IntersectionObserver` 懒挂载 + `requestIdleCallback` 编译着色器，不进 LCP 关键路径
- 三重兜底：`prefers-reduced-motion: reduce` → 静态 PNG；WebGL2 不可用 → 静态 PNG；
  `(hover: none)` → 关闭 flowmap
- 静态兜底图由自身着色器截帧生成，纳入 `script/generate-brand-assets.ts`

退出：桌面 60fps、移动不掉帧；三条兜底均验证；LCP 不因 canvas 退化。

### 期 7 · 动效（2【估】）

- `oc-hero-enter` 错峰入场（CSS 变量控 `--enter-y` / `--enter-blur` / `animation-delay`）
- 滚动揭示：**单个共享** `IntersectionObserver` + `data-reveal`，不逐元素建 observer
- 终端打字机：双 `pre` 占位撑高（**必须**）+ tab + 复制 + `blink` 光标
- `arrow-sweep` 链接箭头

退出：所有动效在 `prefers-reduced-motion` 下降为瞬时；CLS 0。

### 期 8 · 双语文案（1.5【估】）

按 §五 段落映射与字数预算重写 `landing.ts` 的 `root` / `zh-cn` 两份；
中文标题走 `oc-cjk-spacing`；同步落地页与市场页的 OG 与 meta 描述。

退出：两语言 ≤ 1200 字且齐平；无遗留旧文案。

### 期 9 · QA 与回归门（2【估】）

- 新增 Playwright：**24 张基线**【算】= 落地页 3 宽 × 2 主题 × 2 语言（12）
  + 市场页 2 宽 × 2 主题 × 2 语言（8）+ 详情页 1 宽 × 2 主题 × 2 语言（4）。
  `bun run test:visual`
- 样式 lint：公开站 CSS 禁止裸间距/圆角数值，只允许 `var(--oc-*)`
- 对比度：两主题全量文本对 ≥ 4.5:1（§六 红线）
- 性能：LCP < 2.5s、CLS 0、着色器不阻塞首屏
- 浏览器：按 `safari14.1` 目标验证 `backdrop-filter` / `mask-composite` / `@property` 三处降级

退出：`test:visual` 进 CI 并作为门；四项指标达标。

## 九、还原度怎么度量

**不用百分比。** 上一版写的"~90% 还原"是把手感写成数字，没有度量支撑，本版删除。

改为**勾选率**——两张清单，缺一项算一项缺陷：

1. **令牌清单**：`tokens.reference.json` 的每个条目，在 `tokens.css` 里有对应 `--oc-*`
   或在 §一「不复刻清单」里有登记。二者皆无 = 缺陷。由 `tokens.parity.test.ts` 机检。
2. **组件清单**：§2.3 的 48 个 `ds-*` 类逐条判定「已实现 / 已登记不做 / 缺失」。
   人工勾选，结论记在 `qa/restyle/component-checklist.md`。

外加三道机检门：

3. **刻度纪律**（期 2 建立，期 9 上 lint）：公开站 CSS 无裸间距/圆角数值。
   参考站的节奏感是刻度纪律的产物——这条不做，后面所有像素微调都是白干。
4. **视觉回归**（期 9）：24 张**自身**基线进 CI——防的是我们自己退化，不是对参考站对位
   （参考截图未能采集，见期 0 限制说明）。
5. **性能与可达性**：LCP / CLS / 对比度红线写进期 9 退出标准，不是事后补。
6. **资源完整性**（`runtime:smoke`，已落地）：6 个 surface 逐个抓取自身引用的每个
   `_astro` 资源、`og:image` 与 manifest，任一 404 即失败；再单独断言其中至少一张样式表
   真的定义了设计系统。**「页面 200 但样式表 404」会渲染成完全崩坏的页面却报告健康**，
   这一条就是为它加的，并已用「移走设计系统 CSS → smoke 必须失败」反向验证过。

## 十、风险

| 风险 | 影响 | 对策 |
|---|---|---|
| 着色器（期 6）超期 | Hero 是观感主载体 | 静态兜底图期 6 第一天就产出，可先上静态版发布，着色器后续替换 |
| 落地页把 4 个退役页内容"顺手保留一点" | 退化成 20 屏长页，等于没收敛 | §五 高度与字数预算是硬门，期 4 退出标准里量 |
| **落地页第 5 节长出第二套筛选逻辑** | 与市场页双份实现，必然腐化 | §4.1 已定死：引流位只做精选 6 + 跳转，期 4 退出标准复核 |
| 301 漏配 | 外链与索引 404 | 期 3 退出标准逐条核对 12 个旧 URL |
| 删 3633 行组件时误删共享逻辑 | 落地页缺功能 | 先迁文档、再删组件；`MarketplacePage` / `SquadDetailPage` 是换皮不是删除 |
| 旧 Safari 无 `@property` | 旋转描边不动 | `@supports` 降级为静态渐变描边 |
| 无 JS 时第 6 节空白 | 下载不可用 | 期 4 退出标准明确要求 SSR 全平台兜底 |
| `public-site.css` 跨两期退役（期 4 摘落地页、期 5 摘市场） | 中间态两套样式并存 | 期 4 只摘不删，期 5 结束才删文件；期 9 基线覆盖两页 |

## 十一、本机环境约束

三条限制在实施中撞到，都不是代码缺陷，但都影响“怎么验收”。记在这里，免得下一轮重新踩。

### 1. 拿不到任何浏览器渲染像素

- 应用内浏览器面板不合成帧（`the Browser pane is not displayed`），截图超时。
- Playwright 四条启动路径全部 60s 超时：`channel: chrome`、`channel: msedge`、
  `ms-playwright/chromium-1234`、Playwright 自带解析。
- 外部域导航被拒，所以参考站截图基线也采不到（见期 0）。

**后果**：`qa/restyle/shoot.ts` 已写好并挂在 `bun run qa:shots`，代码是对的，但要换一台能起浏览器
的机器或 CI 才能产出 24 张基线。**在此之前，落地页没有经过任何视觉确认。**

**替代验收**（本轮实际用的）：用 `javascript_tool` 读 DOM 与 computed style 逐项核对——
字族/字号/字距、圆角、`backdrop-filter`、三层阴影、容器宽度、区块节奏、着色器是否 `live`、
逐节屏高与总屏高、有无横向溢出。这能证明**令牌确实生效**，不能证明**看上去好**。
这两件事不要混为一谈。

### 2. `astro dev` 下 `bun:sqlite` 不可用

`/market/`、`/market/<ns>/<id>`、`/api/site/v1/visitors` 在 dev 下一律 500：
`Only URLs with a scheme in: file, data, and node are supported by the default ESM loader.
Received protocol 'bun:'`。这三条都是 `prerender = false` 且依赖 `lib/website-registry.ts`
（`import { Database } from "bun:sqlite"`），而 dev 期 SSR 走 Vite 的 Node 语义。

- **既有现象，不是本轮引入**（`/trust/`、`/download/` 等静态页 dev 下 200）。
- **落地页因此不读 registry**：featured squads 改由 `script/generate-public-market.ts` 产出
  `src/content/featured-squads.generated.ts`，落地页保持静态预渲染。
- **影响期 5**：市场页换皮无法在 `astro dev` 下验证，需 `astro build` + `astro preview`
  （bun 托管，`bun:sqlite` 可解析）。

### 3. 本机验证必须用随机端口，不能复用固定端口

2026-08-18 有一次「详情页崩坏」的误报，根因是本机流程而非代码：`pkill -f "opencorvus-web.mjs"`
在 Windows 的 git-bash 下没有匹配到进程，旧服务器继续占着 4331，新起的服务器绑不上端口直接退出，
之后所有 `curl` 都打在旧进程上，吐出上一次构建的 CSS 哈希（`WorkflowTopology.9H6GI_ts.css`，
磁盘上根本不存在）。页面本身是好的。

- **在本机验证构建产物，一律走 `bun run runtime:smoke`**——它用随机端口 + 隔离数据库起实例，
  结构上不可能撞上残留进程。
- 需要手工起服务时，先用 `Get-CimInstance Win32_Process` 确认端口没人占，不要相信 `pkill -f`。

### 4. Playwright 修订版钉死

Playwright 每个版本只认一个 Chromium 修订：1.59.1 要 1217，1.61.1 要 1228，本机装的是 1223/1234。
`shoot.ts` 已实现“显式 override → 已装的最新版本 → Playwright 自带”三级回退并逐个真实启动验证，
但在本机三级全超时（见约束 1）。`OPENCORVUS_CHROMIUM` 环境变量可指定可执行文件。
