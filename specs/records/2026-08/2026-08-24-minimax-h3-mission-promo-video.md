# MiniMax H3 Long-Horizon Mission Promo Video

## Recall

| Item | Record |
| --- | --- |
| User request | 搜索并安装 MiniMax H3，编写并实际迭代一支 OpenCorvus 宣传视频：从长程任务的重要性与痛点、同类软件为何难以做好，讲到 Mission 的设计与愿景，展示真实 DeBERTa ABSA Mission 执行；长任务命令使用打字效果，穿插真实截图，美化最终产物，并通过抽帧分析验收。 |
| Desired outcome | 一套可复现的视频生产流水线、中文旁白与分镜、真实产品/产物素材、可播放的本地样片，以及在具备 MiniMax API 凭据时用 `MiniMax-H3` 生成和替换氛围镜头的端到端命令。 |
| Acceptance | 16:9、1080p、H.264/AAC；叙事覆盖痛点→差异→Mission→实例→真实产物→行动号召；命令逐字出现且停留可读；产品画面来自真实 7884 或已留存运行证据；不伪造训练/论文/发布结果；逐段抽帧、黑帧/冻结/时长/音轨自动检查和人工接触表复核通过。 |
| Hard constraints | 不重启、刷新或修改用户正在使用的 7884 服务；不把模型自述当作运行证据；H3 生成镜头不能伪装成产品截图；API Key 不落盘、不入日志、不入提交；先用 768P 草稿迭代，只有通过验收的 H3 镜头才升级；不得下载一个本机无法合理加载的 200GB 级权重包。 |
| Repository sources read | `AGENTS.md`、`README.md`、`README.zh-CN.md`、`specs/current/architecture/public-website.md`、`2026-08-12-promotion-case-engine-strategy.md`、`2026-08-09-deberta-absa-mission-e2e.md`，以及 DeBERTa Mission 的训练监控、图表、论文与 GitHub 发布证据目录。 |
| Whole-repository search | 搜索了 `Mission`、`long-horizon`、长程、视频、宣传、Artifact、Expert Squad 和现有媒体。当前已有 1:44 无声演示、Mission/Work 真实图库，以及本次 Mission 的监控页、推理页、模型架构图和发布回执；没有现成 MiniMax H3 客户端或凭据。 |
| External research | MiniMax 官方 H3 发布说明、模型仓库、Prompt Writing、Brand Promo、3D Animation 与 Paper Collage Skills；H3 V2 API；Google ABCD 与 YouTube 制作指南；Adobe 动画流程与十二原则；Wistia Explainer 指南；vLLM-Omni 与社区 5090 适配。 |
| Local environment | RTX 5090 32GB、系统内存 64GB、FFmpeg/FFprobe 可用、D 盘剩余约 1.7TB。官方 BF16 路径不可行；用户进一步要求寻找单卡第三方适配。选定 ComfyUI 原生 H3 节点、约 20.97GB 的 pruned INT8 ConvRot DiT、约 15.69GB 的 NVFP4 AWQ Qwen3-VL、约 5.8GB 的视频/音频 VAE 和 DynamicVRAM（动态显存卸载）。第三方 5090 实测证明该组合可在 32GB 显存运行并输出 H.264/AAC。 |
| Credential status | 当前没有 MiniMax API Key。主路径已改为本地开源权重，不需要 API Key；官方 API 仅保留为用户主动选择的可选路径。 |
| Existing dirty worktree | 开始时只有无关未跟踪 `packages/opencorvus/script/benchmark/` 与 ``；必须保留且不纳入本任务提交。 |
| Independent agent feedback | 实施前无。首轮验证后按仓库规则委托未参与实现的 agent 只读复核。 |
| User correction | 首版 animatic 被明确否决：不能做成 BPPT（带轻动效的幻灯片），必须用连续动画形式科普。保留真实截图、旁白、命令打字和 H3 本地生成要求，但痛点、机制、Mission、执行和产物段落必须通过对象运动、因果关系、状态变化和镜头连续性来解释。 |
| User correction 2 | 第二版仍被否决。用户要求先学习文案、视频、推广与 H3，而不是继续盲目生成。已停止在途动画渲染；正式生成前新增强制创意确认门，并以 `script/video/minimax-h3-mission-promo/creative-brief-v2.zh-CN.md` 为当前创意事实源。 |

## Impact analysis

### Observable need

现有 1:44 演示没有音轨，也没有解释长程任务的故障模型、Mission 的责任边界和 DeBERTa 案例的真实证据链。用户需要的是可用于宣传的叙事成片，而不是模型生成的一组无关短片。

### Direct trigger and data flow

V2 先以 `creative-brief-v2.zh-CN.md` 冻结受众、单一承诺、故事主线、视觉方向、证据与 CTA。用户确认后再重写唯一的 `storyboard.zh-CN.json`，由它驱动旁白、命令打字、H3 官方格式提示词、时间线和抽帧检查点。被否决的 121 秒 storyboard 保留作证据但带拒绝状态，生产入口在其获批前必须失败。

### Root constraints and why a naïve path fails

- H3 每次生成 4–15 秒，不能直接一次生成一支叙事完整、产品 UI 字体准确的长视频。
- 生成模型不适合复刻可核验的小字号 UI；让 H3 画产品界面会制造假截图。
- 当前主机不足以加载官方完整 BF16 组件，必须使用经过 5090 实测的量化和动态卸载组合。
- 本地适配来自 Comfy-Org 权重重打包、ComfyUI 原生节点与社区 API 工作流；必须固定提交、核对文件 SHA-256，并把“第三方量化”写进生成 manifest。

因此采用单一事实源：真实截图和产物用本地合成，本地 H3 只负责明确标注的生成镜头；旁白、字幕和画面时间线由同一分镜文件生成，避免双源漂移。

### Affected surfaces

- 新增独立宣传视频工具，不改 OpenCorvus Runtime、Overlay、Mission、Provider 或网站产品代码。
- 输出写入仓库外的演示目录，避免把大体积中间视频混入源码历史。
- `specs/README.md` 增加本记录索引。
- 不新增或运行 UI 自动化测试；7884 只做隔离标签页的人工截图采集。

### Risks

- 本地 H3 权重约 42.5GB，安装与校验耗时较长；下载必须可恢复并逐文件 SHA-256 校验。
- 当前 pagefile 只有 4GB，且约 39GB 物理内存空闲；先以 0.4MP、3秒、10步做单镜头验收，监测 RAM/VRAM。若内存不足，降低到 0.2MP，不修改系统 pagefile，除非另获授权。
- 真实页面可能含敏感或无关信息：截图前只显示本案例区域，成片再裁切。
- 中文字体与 FFmpeg 文本转义易出错：文本先由 Pillow 渲染为帧，不依赖 `drawtext`。
- 长生成卡死：API polling 以状态变化为活动信号，草稿 12 分钟无活动即失败；下载 2 分钟无字节活动即失败。

## Story structure and frozen claims

| Beat | Narrative | Evidence/visual |
| --- | --- | --- |
| 1. Hook | 真正困难的任务，不是回答得快，而是几小时后仍能把结果交出来。 | H3 时间隧道或复杂工作流氛围镜头；不出现伪 UI。 |
| 2. Pain | 长任务会停、结果难核、修正无法积累。 | 三条执行路径推进后依次爆裂，错误与后果随断点出现。 |
| 3. Why others struggle | 单一会话或匿名 agent 池缺乏固定责任、可恢复状态、带来源交接和独立验收。 | 上下文条溢出并丢失状态，对照具名节点与 Artifact 接力；避免点名或无证据贬损具体产品。 |
| 4. Mission | Mission 在目标层组合多个 Task；每个 Task 固定一个专家团版本和工作流，以 Artifact 交接。 | 7884 Mission 真实页面和 README 架构图。 |
| 5. Command | 展示完整 DeBERTa 长 Mission 输入，以打字效果呈现关键条目。 | 终端风格文字层，注明已压缩展示完整要求的关键条目。 |
| 6. Execution | 下载模型和数据、CUDA 训练与监控、迭代、架构图、ACL 短文、复核、GitHub。 | 7884 Task 列表与真实训练监控、推理页面。 |
| 7. Deliverables | 最佳模型架构图、实验生命周期图、论文、公开仓库。 | 原始产物从不同路径飞入并装配成可交付集合，仅做版式美化，不改变数据。 |
| 8. CTA | OpenCorvus 让一支可检查的 Agent 团队，把模糊目标推进到经过验收的交付。 | Logo、案例路径、GitHub 和官网。 |

禁止口径：`100% autonomous`、`production-ready`、未验证的性能提升、未发生的 H3 生成、对具体竞品能力的绝对否定。

## Animation grammar after user correction

- 不使用逐页标题加卡片或要点列表的演示文稿语法。
- 每个非 H3 段落必须表现一个正在变化的系统：路径断裂、状态丢失、节点接力、Artifact 传递、Task 完成、曲线更新或产物装配。
- 文字只做运动标题、对象标签和必要字幕；核心解释必须从运动关系中看懂。
- 真实截图以摄像机推拉、局部放大、扫描光、时间轴或对象窗口进入动画，不能静态并排超过 3 秒。
- 相邻段落用共享对象连续转场：断裂的工作光点进入 Mission 图；Mission 的 Artifact 光点进入 6-Task 执行；执行完成节点汇聚成最终产物。
- 接触表之外，至少抽取每个动画段的首、中、尾帧，确认对象状态确实发生有意义变化，而不是只做整体缩放。

## Pipeline contract

### Inputs

- `storyboard.zh-CN.json`
- 7884 真实截图、已留存 DeBERTa Mission PNG、PDF 和 JSON
- 隔离 ComfyUI、本地量化权重和扁平 API 工作流
- FFmpeg、FFprobe、Python 3.11、PyTorch CUDA 13.0、Pillow

### Outputs

- `draft/opencorvus-long-mission-animatic.mp4`
- `final/opencorvus-long-mission-h3.mp4`：只有全部声明的 H3 镜头真实存在时生成
- `frames/contact-sheet.jpg` 与逐段 PNG
- `reports/media-check.json`、`reports/frame-check.json`、`reports/generation-manifest.json`

### Commands

```powershell
python produce.py prepare --output D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824
python produce.py animatic --output D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824
python generate-local-h3.py --scene hook --width 864 --height 480 --duration 5 --steps 10
python generate-local-h3.py --scene cta --width 864 --height 480 --duration 5 --steps 10
python produce.py compose --output D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824
python produce.py inspect --output D:\myhexin-local\demos\opencorvus-minimax-h3-promo-20260824
```

### Benchmark acceptance

- 1920×1080、25 或 30 fps、H.264 视频；最终版含 AAC 音轨。
- V2 目标总时长 68–72 秒；叙事覆盖具体失败、运行层原因、Mission 接力机制、真实执行、受限指标与唯一 CTA。
- 每个段落的中点帧非黑；连续检查点不得全同；实际媒体时长与时间线误差不超过 0.5 秒。
- 命令字号在 1080p 下至少 34px，逐字出现后完整停留至少 1.5 秒。
- 真实截图不由 H3 重绘；产物数据、指标和文件名保持来源一致。
- 字幕与旁白共用同一文本源，字幕安全区距离边缘至少 80px。
- 接触表人工检查无黑帧、错误裁切、文字溢出、UI 假字、内容重复或 CTA 截断。

## Iteration policy

1. 先生成不计费的本地 animatic，验证叙事、时长、截图裁切和打字效果。
2. 先在单张 RTX 5090 上生成一个 0.2MP、3秒、10步的 H3 烟雾测试镜头；成功后只为 Hook 和 CTA 生成 2 个本地 H3 镜头；机制解释全部使用可控的连续对象动画。
3. 抽取每个 H3 镜头首、中、尾帧；发现人物或文字畸变、闪烁、黑帧、叙事不符时，只改该镜头 prompt 并重生成。
4. 合成后再次自动检查和人工接触表检查。
5. 只把抽帧通过的本地镜头纳入最终合成；最终 1080p 由 FFmpeg 高质量放大与真实 UI 原生 1080p 图层共同完成，不把插值描述成 H3 原生 2K。

## Single-5090 local acceptance

- 固定 ComfyUI 提交 `0764232429b8cfb10b79b6f186c8cb23e0b22897` 或验证过的更新提交；运行时与 OpenCorvus 隔离。
- 使用 Comfy-Org `minimax_h3_fl2va_pruned_int8_convrot.safetensors`、`qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`、两个官方重打包 VAE；所有文件按公开 inventory 校验大小和 SHA-256。
- 通过 ComfyUI `/prompt` 提交扁平 API 工作流；不得依赖人工点击完成烟雾测试。
- 烟雾测试必须含 24fps H.264 视频和 32kHz 双声道 AAC 音频；无黑帧；首、中、尾帧可辨且有运动差异。
- 记录峰值显存、峰值系统已用内存、冷启动时长和完整请求时长；任何 OOM 或系统换页失控都视为失败，并先降分辨率再评估，不隐藏故障。
