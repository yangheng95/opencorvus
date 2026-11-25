# 长标题聊天导出保留会话标识并可下载

## Recall

- 用户要求本人独立连续分批迭代，先验证事实并落盘根因和影响，再修改、实际桌面交互并复核截图、做聚焦验证、范围提交、普通合并上游并推送。上批 [标题分隔符导出修复](2026-11-25-conversation-export-keeps-title-segments.md) 已推送 `ac2d55399`，与远端一致，保持 177 条原工作区状态。
- 已读[现行下载架构](../../current/architecture/07-panel.md#conversation-downloads)、[导出状态和标题归属](2026-11-10-conversation-export-feedback.md)、[下载名规范化](2026-11-08-download-filename-whitespace.md)。全仓核对 `conversationExport`、`artifactFilename`、`downloadBlob`、快照读取、`Session.setTitle`、`Identifier.schema` 和各格式媒体类型。读过真实服务器路由、现有非界面导出及下载检查、浏览器下载限制对应公开源码和文档。所查触及路径未发现界面自动化测试。

## 实施前证据及根因

- 同一个自有开发项目 `41810/ui/` 使用当前 `main-03BGpuDf.js`。经真实会话创建、标题写入和公开导出读取，建立 `ses_hYvPVI59rPF6ZUxGC82K` 与 `ses_hK7MlPWFwj5RXnCi1VqS`。两个标题共享 364 个前缀字符，末尾分别为 `Europe` 和 `Asia`，总长 370 和 368 个字符。标题都含原中文文本。两份正式快照 `59be883e-a361-4bb7-ac40-29e572a4ee83` 与 `0b23f2ac-217e-41c4-9feb-6ea4e5153680` 均正确，消息为空。
- 在真实聊天标题菜单选择第一条的 JSON（JavaScript Object Notation，结构化文本）和第二条的 Markdown（轻量标记文本）。两个浏览器下载事件都报告取消，页面却已发出下载开始提示。保持第一个会话和下载格式相同，通过正式标题写入缩为 157 个字符，随后实际成功保存。下载正文与该会话公开快照 `a64af63b-15fb-4f54-84ee-a429e4a4f40c` 相等，保存名含原会话标识。已把该自有会话恢复为 370 字符原名并取得正式回执 `4bf871de-f002-4e7c-80f8-d0c398cc1cc9`。[基线截图、下载结果和回执](../../artifacts/2026-11-25-conversation-download-keeps-long-title-identity/README.md)
- `conversationExport` 会直接把被允许的任意长度标题、会话标识及扩展名拼成下载名。`artifactFilename` 负责路径末段和字符清理，从不处理长度。`downloadBlob` 只提交浏览器保存意图，对象地址生成及公开会话读取成功无法证明系统接受文件名。实际结果只给出取消，浏览器的内部错误码未知。对同一会话只缩短标题后即可保存，说明缺口在生成过长的下载名；此前内容和文件字符修复未约束这个输入。Chromium 的下载路径保留会按目的文件系统文件名限制检查并预留下载/平台后缀，重复文件还会预留区分后缀。Windows 文档说明单组件通常为 255 个字符，实际值由卷决定。[Chromium 下载路径保留](https://chromium.googlesource.com/chromium/src/%2B/refs/heads/main/components/download/internal/common/download_path_reservation_tracker.cc#314) [微软文件路径限制](https://learn.microsoft.com/windows/win32/fileio/maximum-file-path-limitation)
- 影响普通 Chat/Work 共用的两种下载。标题内容、公开快照、数据格式、项目归属、后端及消息持久化正确。界面已明确表示开始交接，本批无需修改提示。其他文件和附件名称不经过聊天专有拼接，因此保留其当前合同。这里没有调度、唤醒、队列、执行轮次或终态收敛异常。

## 方案与验收

- 两种格式共享文件名主干。用最长扩展名为当前真实会话标识和格式预留位置，仅缩短超出的显示标题，确保短标题和两种格式的同一可读主干。取 232 个 UTF-8（Unicode Transformation Format，8 位统一字符编码）字节作为聊天下载名的预算，低于常见 255 组件上限，并为 Chromium 在 Windows 上的 16 字符后缀与常用重名编号留出空间。浏览器和具体卷仍决定最终路径。按完整 Unicode 码点截取，保留现有分隔符替换和共享文件名字符规则。生成器产生的当前标识长 24 个字符；旧的非定长标识仍全量保留，预算不会使已存标识写入失败。若非定长标识本身已超出现有应用文件名预算，保留原标识，不承诺该异常路径可以由浏览器保存。保留原序列化内容、界面标题和持久标题，无新依赖、配置、接口及语言键。
- 聚焦数据测试覆盖 Unicode 截断边界、不同会话的精确标识和两种扩展名、正文原样，保留普通标题和文件分隔符原契约。实际候选页对原两会话分别重做前置失败的下载，复核页面与浏览器实际落盘、名称中的各自标识、原正文和用户消息。对短标题用原会话再次确认现有行为，或用现正向测试与上一批实页结果保留短路径佐证。进行构建、类型及文档检查。此处无模型推理或提供方凭据需求。

## 首个候选复核及预算修订

- 首个候选 `main-B2UcDRD6.js` 以 232 字节的文件名出发。该实际标题的文件名有 224 个 UTF-16 代码单元，完整浏览器保存路径 249 个单位，附加 `.crdownload` 后达 260 个，附加 `:Zone.Identifier` 后达 265 个。实际浏览器仍取消下载。此前估算只从文件名组件的常见上限扣除保留字符，漏计了父路径。Chromium Windows 实现会同时计算卷允许的组件长度和扣除父路径后的完整路径余额。浏览器事件未报告底层错误码，实际取消与该长度机制相符。[首个候选及对照](../../artifacts/2026-11-25-conversation-download-keeps-long-title-identity/README.md) [Chromium Windows 路径计算](https://chromium.googlesource.com/chromium/src/%2B/HEAD/base/files/file_util_win.cc)
- 用同一候选页面和同一会话，把标题暂时缩到最终文件名恰为 200 个 UTF-8 字节，真实浏览器保存，完整路径为 217 个 UTF-16 单位。JSON 原正文等于正式回执 `41b2f2dd-75f1-40fa-91d7-1a467526a2c9`。已恢复原长标题，正式回读 `530537f0-a5d6-4cd5-a226-334278c3d1d3`。
- 用实测成功的 200 字节修订聊天下载名预算，为父目录、临时后缀和重名编号预留空间。应用生成同一可读前缀、完整实际会话标识和两种扩展名，原会话标题继续原样进入界面和正文。不读取本机下载目录配置，也不对任意深度的下载目录作成功承诺。

## 最终验收

- 最终候选实际加载 `main-B4aSnKDn.js`。同一 1280 × 720 英文桌面上，原 370 字符 `Europe` 聊天成功下载 JSON 和 Markdown，原 368 字符 `Asia` 聊天成功下载 Markdown。三份实际文件名分别是 200、198 和 198 个 UTF-8 字节。两个 `Europe` 文件主干完全一致，均含 `ses_hYvPVI59rPF6ZUxGC82K`；`Asia` 文件含 `ses_hK7MlPWFwj5RXnCi1VqS`。人工复核三张截图和三个真实文件。[最终实拍和保存回执](../../artifacts/2026-11-25-conversation-download-keeps-long-title-identity/README.md)
- JSON 与正式会话快照逐字段一致，Markdown 标题完整并保留原会话元数据。下载后两个公开源快照仍逐字一致，回执 `d8fa75a2-ebb8-45e6-8536-bf66cf9c8cde` 和 `872a531f-5e23-466e-b3b0-071f8a3d3d4e` 返回零消息，隔离监听器记录零模型请求。[源数据回执](../../artifacts/2026-11-25-conversation-download-keeps-long-title-identity/README.md)
- 四组聚焦数据测试 66 项、108 条断言通过，含 Unicode 码点边界、完整精确标识与双格式命名。类型、最终页面构建、渲染器公共接口、文档和架构索引通过。构建保留既有的分包大小提示。实际平台验收覆盖当前 Windows 浏览器和默认下载目录。
