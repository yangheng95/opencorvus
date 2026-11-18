# 原件响应遵循已发布媒体

## Recall

- 用户要求本人持续分批调查 UI（User Interface，用户界面）、功能及缺陷，完整根因/影响分析先落盘，再实施、聚焦正向检查、真实桌面交互与截图人工复核、范围提交、拉取合并上游及普通推送；明确不使用子 agent。本批第 324 批。前批 `b5e22ebaa`、`24a43e1bc` 已完成推送，分支 0/0，原有 177 项工作区改动逐项一致。
- 已读根 `AGENTS.md`，当前数据原件发布/校验和界面下载/派生架构，完整 `AttachmentRoutes`、`AttachmentStore` 的扩展名选择、回执验证及派生读取、Office 资格注册表，下载/上传正向检查，前端 FilePart、ImagePreview 与附件 URL helper（辅助函数）。全仓搜索 `attachmentHeaders`、`MIME_FROM_EXT`、`mimeFromName`、`attachment.get`、`attachmentImagePreviewUrl`；原件响应的后缀映射只有一处，前端展示另有当前 SVG（Scalable Vector Graphics，可缩放矢量图形）派生选择。读前 320/322/323 批决定，不将已记录的独立问题当作已解决。
- 验收目标：公开原始上传后，真实 HTTP（Hypertext Transfer Protocol，超文本传输协议）响应以规范回执的 MIME（Multipurpose Internet Mail Extensions，互联网媒体类型）及其参数为依据，原名后缀不改变媒体或下载处置；保留同一原件、长度、规范 URL、原名、字节和缓存合同。明确列出的安全预览类型可内联，Office 可编辑原件下载；SVG 及预览合同外的媒体继续为下载用通用二进制，不能借此把任意上传变成同源活动页面。
- 只用自有本机 `acp-review/local` 流式参与者，先查真实 Provider（模型供应方）投影再提交，实际请求精确 `local`。不使用外部凭据或 GPT-6.1 Sol，不委托。禁止新增或运行 UI 自动化；只真实 Windows Chrome `/ui/`、坐标/键盘及本人截图复核。

## 可观察现象与真实基线

隔离开发服务 `40136/ui/` 用公开 SDK（Software Development Kit，软件开发工具包）原始字节上传九种原件。所有 200，字节均正确，但规范响应把 11791 字节 `original-picture.dat` 的 `image/png` 改为 `application/octet-stream`；90 字节 `original-note.png` 的带 UTF-8 参数纯文本改为 `image/png`；Latin-1 文本 `.pdf` 改成 PDF（Portable Document Format，可移植文档格式）；SVG `.png`、Office `.jpg`、二进制 `.png`、空文本 `.mp3`、JSON（JavaScript Object Notation，结构化数据格式）`.dat` 同样错配。

本人实际查看真实网页会话 `ses_hJHMd8JKFpeZLjjzzCLs`。此前 FilePart 的明确 MIME 修复使消息缩略图显示正确，不能据此认为公开响应正确。通过实际地址栏打开上述 PNG 的规范链接，Chrome 发生实际下载，页面停留原对话；查看自有下载面板确认完成，实际保存原名 `original-picture.dat`、11791 字节且逐字节相同。不是坏图片、解码器故障、字节损坏或会话执行失败。真实对话正常 `stop`，基线服务已正常退出 0。

## 根因、深度与影响

`AttachmentStore.extensionFor` 优先保留调用者原名的后缀，所以 `<sha>.<ext>` 并不保证 ext 表达真实 MIME。公开 GET 已正确通过 `readVerifiedReference` 取得同一规范回执与字节，但随后 `attachmentHeaders` 丢弃回执媒体，仅用独立 `MIME_FROM_EXT`/`mimeFromName` 重新推断；Office 下载和 SVG 下载限制也由错误推断驱动。此前输入框、SDK 和存储身份修复各自解决真实入口或持久合同，未改变这段独立响应投影；旧检查只选取后缀与媒体一致的输入，未发现错配。

影响覆盖任何调用者发布的规范原件、公开链接、前端认证 Blob（原始二进制对象）读取及下载；所有 Task（任务）、Mission（持续目标）、Session（会话）引用最终共享该原件路由。已有原件读取验证、项目命名空间、权限、模型输入和执行轮次无须改变。本次没有发现调度/队列/恢复/终态异常，不修改这些机制，不用一次 HTTP 成功替代其完整验收。

相关合同和风险：

- 唯一来源应是已验证回执，删除扩展名反向 MIME 映射；保留 `name` 仅作为无显式显示名时的文件名，不当作媒体来源。传输参数按原声明保留，不臆测字符编码或改变持久字符串。
- 已有预览媒体集合是有边界的：常用光栅图片、PDF、纯文本/Markdown/CSV（Comma-Separated Values，逗号分隔文本）/JSON、当前音视频。把任意上传 MIME 直接内联会新增 HTML（Hypertext Markup Language，超文本标记语言）等活动页面行为，因此在同一响应策略中按规范基础媒体选择已有内联集合；集合外使用下载处置和通用二进制，SVG 原有下载用通用二进制合同继续。Office 使用唯一资格注册表的 MIME，保持真实原媒体及下载处置。比较基础类型时忽略大小写/参数，返回允许的原始 MIME 字符串。
- [MDN Content-Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type)说明响应媒体用于解释返回数据，参数可以声明编码；[Content-Disposition](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition)区分内联和下载；[X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)说明 `nosniff` 尊重明确媒体。这些支持上述传输决定，不用后缀或浏览器嗅探充当数据来源。
- 原件路径/回执/数据库结构及字节不变，无持久迁移；一年 immutable（不可变）缓存合同继续，既有客户端已缓存的旧响应头不能由服务器追溯替换，本批用独立浏览器冷读取验证新响应，不宣称清除用户缓存。无版本变更、发布、Release（版本发布页）或标签动作。
- 当前前端 SVG 派生 helper 仍按规范 URL 后缀选择 `image-preview`，与媒体错名独立，需要下一批实测后分析；本批不改该 helper、不把原件媒体头修复当成 SVG 显示全修。其他 `file`、channel（通道）及工作产物分块路由各有自身来源和合同，不合并为第二套原件媒体策略。

## 实施前方案

1. 删除 `MIME_FROM_EXT` 和 `mimeFromName`。在现有唯一 `attachmentHeaders` 策略中使用 `reference.mime`，基础类型经分号切分、trim（去空白）及小写后选择明确安全内联集合/Office 集合。安全预览及 Office 返回原 MIME（含参数），预览集合外返回 `application/octet-stream` 并下载；保留原名 UTF-8 编码、原长度、缓存和 `nosniff`。
2. 添加非 UI 的聚焦正向 HTTP 检查，实际原始上传再下载，覆盖错名 PNG、两种编码文本、带参数大小写 SVG、Office、HTML、通用二进制、JSON、零字节、正常 PDF/音视频与重复下载。每项断言明确状态、媒体、处置、长度、原名及字节。继续原下载、上传、发布身份和保留检查；不新增或运行 UI 自动化。
3. 公共操作、参数、错误及响应 body（正文）结构不变，不需要手改或重新生成 SDK/OpenAPI（开放接口描述规范）；运行后端类型、路由、文档及架构检查。更新当前界面架构中原件响应的事实，明确原件媒体不再由后缀确定。
4. 启动独立候选开发服务 `40138/ui/`，公开入口创建真实对话及附件；本人查看消息、展开文本、打开图像预览并实际下载。经真实地址栏打开错名 PNG 应内联显示；错名文本按已声明编码显示。SVG/HTML 直接链接实际下载并验证字节。每个目标区域重新截图并逐张查看；正常退出自有服务和窗口，采只读库及流式日志，范围提交、同步上游和普通推送。

基线证据和后续结果集中于[本批原件响应验收](../../artifacts/2026-11-19-attachment-response-media/README.md)。此文先于产品修改落盘并提交。

## 实施与最终验收

实施前规格提交为 `29092d9c4`。已删除完整的后缀反向映射和 `mimeFromName`；同一 `attachmentHeaders` 从已验证回执读取 MIME，以基础类型选择当前明确内联集合/Office 注册表，保留允许媒体的完整参数。其余类型采用下载处置及通用二进制。规范引用、回执、上传、字节、文件名编码和缓存均沿用既有来源，没有另建媒体猜测或兼容实现。

- `packages/opencorvus` 中 `bun test ./test/server/attachment-response-media.test.ts ./test/server/attachment-download.test.ts ./test/server/attachment-upload.test.ts ./test/attachment-media-identity.test.ts ./test/attachment-publication-retention.test.ts`：18 项、159 断言、5 文件全部通过。新增 HTTP 检查逐一实际上传 16 种声明/后缀组合并各读两次，正向验证具体响应及字节。包含 PNG、大小写、两种字符编码、零字节、SVG、带参数 Office、HTML、脚本、自定义媒体、二进制、JSON、PDF 和音视频。Office/PDF/音视频的部分输入只验证传输身份，不声称原生内容可读。
- 后端 `bun run typecheck` 通过；根 `bun run docs:check` 的 353 操作/26 组、`bun run api:routes-check` 的 6 规则/36 文件、`bun run check:architecture-index` 的 20 文档通过。公共操作结构未变，SDK/OpenAPI 无须重新生成。没有界面源码或翻译改动，使用前批已构建的同一前端，通过真实开发服务 `/ui/` 验收；没有新增或运行 UI 自动化。
- 候选 `40138` 九种实际公开 SDK 原始上传全部 200。PNG `.dat` 响应 `image/png` 且内联，UTF-8/Latin-1 文本保留原声明，Office `.jpg` 使用真实 Office 媒体并下载；带大小写及参数的 SVG `.png` 和 HTML `.txt` 为下载用通用二进制。通用二进制、JSON、零字节亦有各自明确结果，所有原字节相同。
- 本人真实展开网页会话 `ses_hBPF9bqpINnGj0pNSqTZ` 的 90 字节中英文文本，原文完整；打开 640×320 PNG 的 100% 预览，图案、原名和控件正确。实际点击正文下载与图像预览下载，分别保存 `original-note.png` 的 90 字节和 `original-picture.dat` 的 11791 字节，与各自原件逐字节一致。
- 本人经真实地址栏打开 PNG `.dat` 规范链接，浏览器直接内联显示完整原图，与基线触发下载的行为形成实际对照。再打开声明为 Latin-1 的 `.pdf` 文本，浏览器正确显示 `Café original`。直接打开 SVG 和 HTML 原件各触发实际下载，分别为 346 和 72 字节，保留原名及全部原字节。截图逐张实际呈现并人工查看；原生下载面板显示的内部临时标识不是发布文件名，下载对象给出的建议名和最终保存字节另有实际记录。
- 两个隔离库最终均为 1 会话、2 消息、7 部件、2 文件部件，提示所有权计数 0，实际模型轮次均 `stop`。只读持久库及完整回执可核对，没有直写消息或历史。4 次本机模型请求均为精确 `local` 且 `stream: true`，4 次完成；不冒称外部模型理解或 GPT-6.1 Sol 验收。
- 两个自有 ACP（Agent Client Protocol，编辑器客户端协议）服务及本机模型均正常退出 0，自有浏览器正常关闭，40136/40138/40140 已关闭。原有 177 项工作区改动保留，交付仅本批范围。

限制仍为实施前已声明的旧响应缓存，以及前端按文件后缀选择 SVG 派生图的独立问题。此批没有恢复旧版已改写的媒体回执，也没有发布新版本。
