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

[本批原始证据与验收](../../artifacts/2026-11-19-attachment-image-display/README.md)。以上为实施前方案，已先提交 `e33e2ff8f`；候选结果如下。

实施后精读共享错误字段时，明确新显示请求选择 SVG 的 `image-preview` 规格，故命名错误的 `variant` 仍是实际派生规格 `image-preview`，不是表示选择器 `image-display`。补充对应正向 HTTP 500 名称、字段、请求标识及原件继续可读的检查；不扩大持久格式、错误 enum（枚举）或增加 UI 自动化。

## 实施结果与最终验收

已在唯一传输协议常量面声明 `ATTACHMENT_IMAGE_DISPLAY_VARIANT`，公开原件路由以严格快照的实际媒体选择显示表示，SVG 复用原完整 WebP 规格，其他类型复用原响应。两个明确派生规格和新显示路径共用同一派生响应函数。前端唯一 helper 改为规范原件的 `image-display`，完整删除后缀判断，没有新预读、媒体状态、文件格式或兼容路径。正式生成的 SDK/OpenAPI 只有该参数说明的真实差异；正式 API 文档生成无正文差异。

- 最终在 `packages/opencorvus` 执行 `bun test ./test/server/attachment-image-display.test.ts ./test/server/attachment-response-media.test.ts ./test/server/attachment-download.test.ts ./test/server/attachment-upload.test.ts ./test/attachment-media-identity.test.ts`，17 项、180 断言、5 文件通过。新检查实际上传/读取错名 SVG、带参数大小写 SVG、宽 5000 像素的错名 PNG、明确二进制 `.svg`，验证 WebP 的格式/尺寸/像素、PNG 原始尺寸/字节、重复响应及原下载；另验证新显示请求命名 HTTP 500、所选规格及原件继续可读。没有 UI 自动断言。
- 后端、前端、协议和 SDK 类型检查通过。正式 SDK 生成通过；前端语言检查两语言 3229 键、样式检查、普通前端构建及渲染器公开面检查通过。`bun run docs:api`、`bun run docs:check` 的 353 操作/26 组、`bun run api:routes-check` 的 6 规则/36 文件、`bun run check:architecture-index` 的 20 文档通过。检索到的 4 项预览 UI 状态自动检查已删除且未运行，其通用传输依赖仍有生产用途，不删除。
- 新候选服务 `40144/ui/` 的实际公开会话为 `ses_hln3nudxMmyEBrAgEtp0`。本人逐张点击三张缩略图，三张 800×450 图像均完整显示，原名和 100% 缩放正确。两张错名 SVG 的全图分别使用 WebP 4960、4776 字节；错名 PNG 的全图实际使用 `image/png`、17078 字节，和原件相同。实际浏览器响应记录与截图共同证明选择，未用网络文本或自动断言代替视觉验收。
- 三次实际点击预览下载得到 `vector-original.dat` 349 字节、`vector-original.png` 349 字节、`raster-original.svg` 17078 字节，逐字节等于各自原件，SVG 原件没有被替换成 WebP。第三次下载的原生面板短暂覆盖关闭按钮，按新截图确认并用 Escape 关闭原生面板后再关闭预览；没有操作私人文件、窗口或剪贴板。
- 本人通过应用设置的语言菜单选简体中文，返回对话再次实际打开 SVG A，完整图案及原名正确，操作菜单的复制、适应宽度、适应图片、原始尺寸均为中文；没有点击复制。英文三张全图、中文全图及菜单截图全部实际呈现并逐张人工查看。
- 两个隔离库最终均 1 会话、2 消息、8 部件、3 文件部件，提示所有权计数 0；实际轮次正常 stop。4 次模型请求精确 `local` 且全流式，4 次完成。仅使用自有脚本参与者证明数据、传输与运行链路，没有使用外部凭据、GPT-6.1 Sol 或委托 agent。
- 两个自有 ACP（Agent Client Protocol，编辑器客户端协议）服务和本机模型均正常退出 0，Chrome 正常关闭，40142/40144/40146 已关闭。持久库和回执仅只读采集，原有 177 项工作区改动保留。

SVG 显式 `image-preview` 的既有 4096 像素上限保留；它不是光栅全图的原始尺寸上限。本批不自动恢复旧版已改写的媒体回执，也不处理网页角色 ACP 加载。没有版本变更或发布动作。
