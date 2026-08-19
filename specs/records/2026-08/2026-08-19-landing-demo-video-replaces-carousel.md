# Landing page — a recorded run replaces the twenty-frame artifact carousel

Supersedes [2026-08-19-artifact-gallery-landing-carousel.md](2026-08-19-artifact-gallery-landing-carousel.md),
whose carousel, images and capture harness this record removes.

## Recall

**用户原始要求**（逐条，按到达顺序）：

1. 「@C:\Users\hengu\Downloads\opencorvus_demo.mp4 把这个视频嵌入到网站上」
2. 「bump到v0.0.48beta发布二进制和网站」（本记录不覆盖，见发布记录）
3. 「视频要替换掉网站图片的轮播」

**用户在本轮做出的决定**（AskUserQuestion）：

- 装真正的 ffmpeg（winget `Gyan.FFmpeg`）来压缩，而不是原样嵌 27MB。
- 视频放在英雄区正下方，独立一段 —— 即轮播原来的位置。
- `qa/artifact-gallery/**` 一并删掉，不保留成独立工具。

**验收指标**

- 落地页 hero 之下播放这段真实运行录屏，双语双主题都成立。
- 轮播、20 张图、采集流水线不留双源。
- `bun run test:web`、`test:style`、`astro check`、`astro build` 全绿。
- 真实页面截图人工复核（AGENTS.md 四），不新增 UI 自动化测试。

**硬约束**

- 落地页文案受 `test/landing-copy.test.ts` 预算约束（中文按字、英文按词）。
- 素材受 `test/lander-assets.test.ts` 双重约束：必须被组件按名引用，必须在
  `captured.json` 声明出处。
- 样式必须走 `var(--oc-*)` 令牌，`test/style-discipline.test.ts` 拦裸数值。
- 公开文案只能写可核对的事实。

**已读资料**：`OcLanding.astro`、`OcArtifactCarousel.astro`、`landing-copy.ts`、
`tokens.css`/`primitives.css`、`test/{landing-copy,lander-assets,style-discipline}.test.ts`、
`captured.json`、`RELEASE.md`、`docs/website-restyle-plan.md`（第一章、第六章）。

**全仓搜索结果**：`OcArtifactCarousel` / `artifact-gallery` / `showcase` 的引用点为
落地页、`captured.json`、`qa/artifact-gallery/**`、两个测试；`#deliverables` 锚点全仓无引用，
可安全改名 `#demo`。

**独立 agent 反馈**：无（本会话禁用 Agent 工具）。

## 为什么换掉轮播

二十张静图各自证明一个 renderer 能出活，但它们要求读者把一次运行**拼**出来。产品最强的主张——
一句提示词一路走到一份成品文件——是关于**时间**的主张，静图承载不了。一段真实录屏承载得了。

## 素材处理

源文件 27.16MB / 1920×1080 / 103.67s / H.264 + AAC，`moov` 在**文件尾部**——浏览器必须下完整包
才能出第一帧。两处必须修：

- `-movflags +faststart` 把 `moov` 挪到 `mdat` 前面。验证：dev server 对 `/media/opencorvus-demo.mp4`
  返回 `206 Partial Content`。
- `-an` 丢掉音轨。该音轨整段静音（OfflineAudioContext 解码全长，peak = 0，rms = 0），是录屏器留下的
  死系统声道，纯粹是体积。

`-crf 28 -preset slow` 保住 1080p：屏幕录制的静态区域压得极好，27.16MB → 6.75MB（-74%），
1080p 原尺寸下与源文件逐帧目视无差（对比裁切见 `tmp/cmp-stack.png` 的当场比对）。
降到 720p 只再省 3MB，却让应用界面里的小字失去可读性，不划算。

重跑命令写在 `captured.json` 的 `refresh.demoVideo`。

## 落地形态

- `src/components/OcDemoVideo.astro` —— 第 2 节，`id="demo"`。
- `public/media/opencorvus-demo.mp4` + `opencorvus-demo-poster.jpg`（源片 18.6s 那一帧）。
  放 `public/` 而不是 `src/assets/`：Astro 的资源管线是给图片的，视频要的是一个能发 range 请求的裸 URL。
- `captured.json` 用 `media/` 前缀同时管住这两个根，`lander-assets.test.ts` 一并巡检——
  按技术缝隙拆成两份出处文件，只会让下一次采集落进没人看的那一半。

播放契约（已在真实页面逐条验证）：

| 行为 | 结果 |
| --- | --- |
| 视口外 | 0 次 mp4 请求（`preload="none"`，脚本不碰） |
| 滚入视口 | 起播，静音 |
| 滚出视口 | 暂停 |
| 读者按过播放器后暂停 | 再次滚入**不**自动续播 |
| `prefers-reduced-motion: reduce` | 不起播，0 次 mp4 请求 |

`controls` 保留：这是 104 秒真实工作，读者会想拖动，而不只是看它飘过去。无 JavaScript 时海报图
和原生控件都还在，按下才下载。

## 删除清单

| 路径 | 说明 |
| --- | --- |
| `src/components/OcArtifactCarousel.astro` | 唯一消费者 |
| `src/assets/lander/artifact-gallery/*.png` | 20 张，3.0MB |
| `qa/artifact-gallery/**` | 9 个脚本，只为生成上面那 20 张 |
| `landing-copy.ts` 的 `showcase` 块 | 换成 `demo` 块，双语 |
| `captured.json` 的 20 条出处 + `refresh.artifactGallery` | 换成录屏两条 + `refresh.demoVideo` |

## 文案

一版草稿写了「全程一镜到底 / Unedited」，**撤掉了**：文件本身证明不了没剪辑，而且这次运行实际上
有第二轮追问（NVDA 生态）。落地文案只能写可核对的事实，所以改成录屏确实展示的东西——
NVDA 近一年日线进去，K 线图、技术分析和 Word 报告出来。

`caption` 记录录屏自身的版本 `v0.0.47beta`，**不随发布版本走**：那是这段素材的采集事实，
和 `captured.json` 里截图的 `capturedAppVersion` 同一个道理。

## 已知问题

录屏第 16 秒左右画面上有一次 `browser_session_create` 工具调用失败
（`BrowserRuntime could not connect`），运行随后走 `webfetch` 恢复并继续。已记在
`captured.json` 的 `knownIssues`，没有剪掉——真实运行里的一次失败恢复不是缺陷。

## 验收证据

- `bun run test:web` 51 passed；`bun run test:style` 8 passed；`bunx astro check` exit 0；
  `bunx astro build` 成功，`dist/client/media/` 两个文件齐备，`index.html` 指向正确。
- 真实页面截图（1440×950，浅色 / 深色 / 中文）：`packages/web/tmp/demo-shots/`。
- 播放契约五项：`packages/web/tmp/behaviour.mjs` 实测输出见上表。
- dev server 网络记录：mp4 `206`，poster `200`。
  `/api/site/v1/visitors` 的 `500` 与本次改动无关，是 `astro dev` 下 `bun:sqlite` 解析不了的既有问题。
