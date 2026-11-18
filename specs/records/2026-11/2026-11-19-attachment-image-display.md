# 按发布媒体选择完整图片显示

## Recall

- 用户要求本人持续分批调查，先完整根因/影响分析并落盘，再实施、真实 Windows 桌面页面交互、逐张截图人工复核、聚焦正向检查、范围提交、拉取合并上游并普通推送；明确不用子 agent。本批第 325 批。前批 `29092d9c4`、`38fc8323f` 已推送，分支 0/0，原有 177 项工作区改动逐项一致。
- 已读根 `AGENTS.md`，当前界面与原件数据架构，前批媒体声明、原件响应、全图读取归属、原图尺寸和缩放记录。读取完整附件资源 helper（辅助函数）、FilePart、全图 Host（显示宿主）及预览状态服务；全仓搜索 `attachmentImagePreviewUrl`、`PreviewableImage`、`openImagePreview`、`resourceUrl` 和派生常量/类型，覆盖消息/输入框、图片画廊、截图浏览器、浏览器证据、项目文件、Markdown（轻量标记文本）及全局委派入口。读取原件路由及唯一派生管线、传输协议常量、SDK（Software Development Kit，软件开发工具包）正式生成脚本和相关后端正向检查。
- 验收：发布为 SVG（Scalable Vector Graphics，可缩放矢量图形）的错名原件能够在完整预览显示，同一原件缩略图及下载继续正确；发布为 PNG（Portable Network Graphics，便携式网络图形）的 `.svg` 原件使用原始光栅图，不因后缀触发矢量派生或将大图缩到 4096 像素。选择只依据已验证媒体回执，原件 URL、字节、名称、下载限制及现有两个派生 profile（图像规格）不变。
- 本机隔离模型 `acp-review/local`，先查真实 Provider（模型供应方）目录投影，实际请求精确 `local`、全流式；不用外部凭据或 GPT-6.1 Sol，不委托。UI（User Interface，用户界面）只真实开发服务 `/ui/`、坐标/键盘和截图人工复核，不新增或运行 UI 自动化。

## 真实基线、触发和根因

开发服务 `40142/ui/` 通过公开 SDK 上传三件 800×450 原件：`vector-original.dat` 为 `Image/SVG+XML; charset=utf-8`，`vector-original.png` 为 `image/svg+xml`，两件各 349 字节；`raster-original.svg` 为 `image/png`、17078 字节。原件响应正确遵循前批下载策略，三个 `image-preview` 及 `screenshot-browser-thumbnail` 的实际 HTTP（Hypertext Transfer Protocol，超文本传输协议）响应均 200，实际解码图像尺寸和媒体正确，原件字节相同。

本人在真实会话 `ses_hIvMcwUxGSir55sSgB6P` 查看三张正常缩略图，分别实际点击前两张 SVG，完整预览均显示 “Could not display this image”。真实模型输入正常 `stop`，发布、会话和派生管线没有失败。正常退出基线服务 0，未操作用户窗口或进程。

根因是 `attachmentImagePreviewUrl` 仍把规范 URL 末尾 `.svg` 当作媒体事实，而 `AttachmentStore.extensionFor` 实际保留原名后缀。缩略图统一使用服务端派生，所以正常；全图 Host 按 URL 判断，错名 SVG 选择下载用通用二进制，浏览器无法作为 SVG 解码，错名 PNG 则被误送入有 4096 上限的 WebP 派生。此前明确 MIME 的消息分类和原件 HTTP 响应修复没有替换此独立选择。全图读取归属已统一到 Host，本批不能重新增加调用者预读、隐藏失败、备用图或第二 loader（读取器）。

## 影响面、公共合同与取舍

| 范围 | 当前事实与本批决定 |
| --- | --- |
| FilePart 与全图 Host | 两处共用附件 URL helper。消息/输入框的内容显示及缩略图点击全图均受影响；替换同一 helper 的选择规则，不传播或猜测第二份媒体状态。 |
| 其他预览入口 | 截图浏览器和部分工具证据持有规范原件 URL；共享全图 Host 同样采用新显示表示。浏览器实时 capture（捕获）等非规范资源不改写地址。项目文件及 Markdown 独立字节/data/blob/external（数据/内存/外部）路径继续原合同，不增加凭据转发。 |
| 数据与派生 | 规范回执是已验证媒体事实；`image-preview` 为最大 4096 的 WebP，缩略图为既有规格。将所有光栅图也改用 `image-preview` 会改变原始尺寸，所以保留两个规格并增加明确的显示表示选择，不新增派生管线、缓存或文件格式。 |
| 公共路由 | 在现有 `GET /attachment/:projectID/:name` 的 `variant` 参数增加 `image-display`。它通过同一严格原件读取取得回执/字节；基础媒体为 SVG 时调用既有 `image-preview`，其他媒体返回同一原件响应。原下载路径与显式派生规格保持原合同，未知 variant 继续明确 404。 |
| 状态与错误 | 预览开关、revision（修订）、权限身份、取消、下载轮次及唯一读取所有权不变；现有派生失败继续命名错误。新的显示请求首先遵守原件验证，不能借派生绕过损坏回执。无调度/队列/恢复或终态异常，不改 Task（任务）/Mission（持续目标）执行状态。 |
| 持久与缓存 | 没有数据库、回执、原件 URL 或文件布局变化，无迁移。新显示表示拥有明确 query（查询参数）身份，由现有授权 Blob（原始二进制对象）缓存持有；不复用旧错误显示地址、不清用户缓存。原件下载仍读取无 variant 的规范资源，不把 WebP 保存成 SVG 原名。 |
| 检查与文档 | 新参数语义通过单一传输协议常量共享，正式生成 SDK/OpenAPI（开放接口描述规范）及 API 文档。新增后端真实 HTTP 正向输出检查，UI 仅真实页面。检索到 `image-preview-authority.test.ts` 以预览打开/关闭及修订状态为自动断言，按当前 UI 自动化禁令删除且不运行；通用权限/二进制传输服务不属于本批界面测试删除范围。 |

此方案将媒体选择集中在已经持有规范回执的服务端数据层，删除前端后缀判断；不新增基于可选消息 MIME（Multipurpose Internet Mail Extensions，互联网媒体类型）的另一套推断或旧路径兼容。它选择 HTTP 表示，不控制 LLM（Large Language Model，大语言模型）工具或工作流。现有 SVG 源下载限制、Office 处置、公开显示外的派生调用和原件校验继续各自唯一合同。

## 实施前方案与验收

1. 在当前传输协议常量面声明 `ATTACHMENT_IMAGE_DISPLAY_VARIANT`。现有附件路由增加该表示：复用严格原件快照，按规范基础 MIME（去参数、空白及大小写）选择 SVG 的现有完整派生；其他媒体复用原件响应头/字节。显式两个派生 route（路由）与新表示共同调用同一私有发送 primitive（基础函数），不复制图像管线。
2. 附件 URL helper 对所有规范原件选择 `image-display`，删除后缀和媒体猜测；非规范 URL 保持原地址。FilePart 和全图 Host 沿用此唯一 helper，不增加预读/额外状态。删除已检索到的预览 UI 状态自动检查，不新增 UI 测试。
3. 新增后端正向 HTTP 检查：错名和带参数大小写 SVG 返回实际 WebP、正确尺寸/像素；大于 4096 的错名 PNG 返回原始 PNG 和原尺寸/全部字节；明确二进制 `.svg` 仍按原件合同返回；原下载及重复读取正确。运行相关下载、响应媒体、上传和发布身份检查，类型、语言、样式及普通前端构建，正式 SDK 生成、路由、文档、架构检查。
4. 候选 `40144/ui/` 实际点击三张缩略图，逐张查看完整图片、原名及缩放；至少一张切中文复核，分别实际下载两件 SVG 和 PNG，核原名及原字节。实际网络响应只作显示地址和媒体证据，不作 DOM（Document Object Model，文档对象模型）/源码/截图自动断言。正常退出自有服务/窗口，采只读库、回执及流式记录，完成范围提交、上游同步和普通推送。

[本批原始证据与验收](../../artifacts/2026-11-19-attachment-image-display/README.md)。本规格在产品修改前提交；候选尚未实施。
