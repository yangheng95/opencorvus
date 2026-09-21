# OpenCorvus V5R 双语网站视频

状态：**COMPLETE / 三轮独立只读复核后无未解决发现**

## Recall

### 用户要求

- 在已通过的中文 V5R 之后制作一个完整英语版本。
- 中文版与英文版都放到网站；网站根据当前 locale 自动切换版本。
- 英语版必须是完整本地化母版：英语口述、字幕与画面字段一致，不能只替换音轨或字幕。
- 中文版继续使用当前 4:11 故事、动效、DeBERTa 与 AutomationBench 受限证据口径。

### 验收指标

1. `zh-CN` 与 `en-US` 使用相同 12 段、251 秒、证据数字、动画相位和片尾品牌；自然语言按 locale 本地化，技术身份与 URL 保持精确。
2. 英文口述固定 `+25%`，不得再用 `atempo` 二次加速；每段物理语音必须在对应场长内。
3. 两个 master 均有 SHA-bound gate、逐段五帧人工复核、receipt、inspection、字幕与 48kHz 双声道音轨。
4. 网站根路径使用英文视频，`/zh-cn/` 使用中文视频；现有 EN/中语言开关自然切换页面和媒体，不增加浏览器语言旁路或双源状态。
5. 网站播放器默认不静音自动播放：用户主动播放后获得旁白；原生 controls、poster、preload 和可访问名称按 locale 正确。
6. 两个 web MP4 使用 H.264/AAC、`faststart`，画面文字在 1080p 可读；各自 poster 来自同一物理文件。
7. 删除网站旧的无声 NVDA demo 事实源与未使用媒体，README、landing copy 和 provenance 同步到新双语版本。
8. UI 只通过真实 Astro 页面交互、截图和人工视觉复核验收；不运行或新增 UI 自动化测试。
9. 修改后独立只读复核无发现；用户明确要求放到网站，但外部 push/部署仍需在当前历史中的用户观看边界与发布链路核对后执行。

### 已读资料与搜索结果

- `script/video/minimax-h3-mission-promo/produce-desktop-v5r.py`、中文 storyboard、当前 final/receipt/inspection。
- `packages/web/src/components/OcDemoVideo.astro`：当前只提供单个无声 `opencorvus-demo.mp4`，强制 muted/loop 并以 IntersectionObserver 自动播放。
- `packages/web/src/content/landing-copy.ts`：英文与简体中文 landing copy 已有独立 `demo` 投影。
- `packages/web/src/pages/index.astro` 与 `zh-cn/index.astro`：站点 locale 已由路由确定；`OcHeader` 已提供 EN/中手动语言开关。
- `packages/web/src/assets/lander/captured.json` 与 README：仍绑定 2026-08-19 的 NVDA 无声录屏、poster 和 GIF。
- `packages/web/public/media` 当前只含该旧单语言 demo；新交付必须替换而非并列保留旧事实源。

### 独立 Agent 反馈

- 第一轮发现英文句点规则拆断小数，阻止发布。
- 第二轮发现中文分号孤行与比例断行，再次阻止发布。
- 第三轮核实当前 `67f1192dae55` / `771513f83c88` ASS、gate、receipt、master、inspection、Web 摘要、poster、locale、播放器与事实口径，无未解决发现。

## 影响面与根因

- 直接触发点：V5R renderer 的旁白与少量可见中文硬编码在一个脚本中，CLI 只有单 storyboard；网站 demo 也固定单文件并假设无音轨。
- 数据根因：locale 已存在于网站路由，却没有传入媒体选择；视频生成的 locale、voice、screen copy 和 final filename 没有进入同一构建输入。
- 旧路径未满足原因：仅换字幕会留下中文画面；仅由浏览器 `navigator.language` 换源会与当前页面 locale 分歧，并形成第二个语言事实源。
- 修改影响：V5R storyboard/renderer/tests、英文 storyboard、网站 demo component、landing copy、media provenance、README、双语 MP4/poster 与本 spec/index。
- 排除：不改变 Mission 技术事实、benchmark claim revision、其他网站章节、App release 版本、下载 manifest、GitHub Release 或 desktop binary。

## 实施方案

1. 将 V5R locale、storyboard、voice 与可见自然语言收敛到一个 renderer 入口；英文只新增 locale 数据，不复制渲染器。
2. 建立 `desktop-storyboard-v5r.en-US.json`，逐段英语口述按物理 TTS 时长修订，保持所有场长与动画事件。
3. 对少量可见中文使用显式 locale 字典；已有英文技术字段、模型名、指标、URL 与产品名不翻译。
4. 为英文候选执行 gates → 五帧人工复核 → accept → compose → inspect；重新验证中文当前 master 与同一事实版本。
5. 将两个 master 编码为 locale-specific web MP4/poster，写入 `public/media` 并更新 provenance；删除旧 NVDA demo 媒体。
6. `OcDemoVideo.astro` 只按传入页面 locale 选择唯一 source/poster；移除无声自动播放逻辑，保留原生有声 controls。
7. 构建并在隔离 dev 页面检查 `/` 与 `/zh-cn/` 的 source、poster、copy、播放、控制条、无溢出和 console；完成独立复核、提交，再处理已授权的网站交付边界。

## 验收证据

- `en-US` master：`opencorvus-desktop-v5r-en-US-67f1192dae55.mp4`；251 秒，1920×1080，H.264/AAC，48 kHz 双声道；gate、receipt 与 final inspection 均通过。
- `zh-CN` master：`opencorvus-desktop-v5r-zh-CN-771513f83c88.mp4`；251 秒，1920×1080，H.264/AAC，48 kHz 双声道；gate、receipt 与 final inspection 均通过。
- 英文质量门拦截并修复 AutomationBench 说明粘连和片尾结构线穿过口号；随后修复官网品牌源先缩小再放大的糊边。
- 网站媒体：`en-US` 21,932,471 bytes；`zh-CN` 21,436,523 bytes；均为 H.264/AAC + faststart，poster 来自各自 250 秒附近的物理文件。
- `python -m unittest script/video/minimax-h3-mission-promo/test_produce_desktop_v5r.py`：14/14 通过，包含英文小数边界、比例 token 与标点禁孤行保护。
- `bun run --cwd packages/web check`：0 error；`bun run --cwd packages/web build`：通过。首次并行 build 与 check 竞争 `.generated` 目录失败，串行重跑原 build 后通过。
- 真实构建页面：浏览器中文 locale 从 `/` 进入 `/zh-cn/` 并加载 `zh-CN`；手动点 EN 回到 `/` 并加载 `en-US`。两个 video 的 `duration=251`、`readyState=4`、`controls=true`、`muted=false`、`autoplay=false`、`loop=false`，暗色桌面截图无裁切或溢出，console 无 error。
- 本地 dev 的 registry seed 被现有进程锁定，未终止占锁进程；视觉验收改用同一成功 build 的 `dist/client` 隔离静态服务。此限制不影响两条 prerendered landing route 和公开媒体的验收。
- 第一轮独立只读复核发现小数字幕被英文句点规则拆断，阻止发布；修复为仅在英文标点后接空白或结尾时切分，并重新完成两种 locale 的 gate、compose、ASS 物理检查、inspect 和 Web 转码。复核同时确认提交必须排除并行 assets 删除和两个无关未跟踪目录/文件。
- 第二轮复核发现中文分号孤行及 `100 / 600` 比例断行，再次阻止发布；换行器现将比例规范为不可拆 token，并禁止标点成为新行首。第三轮 ASS 物理检查确认不存在 `\\N；`、`\\N/` 或 `/\\N`，`8.07%；` 与 `100/600` 完整可读。
