# 编辑器资源链接保留声明的媒体类型

## Recall

- 用户要求本人持续按批调查，先落盘根因和影响，再实施、真实 Windows 桌面交互及截图人工复核、聚焦正向检查、范围提交、合并上游及普通推送。第 316 批 `d55713e8c` 已推送，上游同步，177 项原有工作区状态逐行一致。
- 已读 `AGENTS.md`、[扩展架构](../../current/architecture/04-extensions.md)、[编辑器上下文](2026-11-12-acp-command-context.md)、[文件名解析](2026-11-13-acp-file-uri-display-name.md)、`SessionPrompt` 文件物化、`ReadTool`、附件存储、真实模型图像输入和现有 ACP（Agent Client Protocol，智能体客户端协议）检查。全仓查 `resource_link`、`parseUri`、`mimeType`、`isTextLikeMime`、`localFileContextParts`、普通和注册命令输入、链接回放及文件读取。检索路径未见界面自动化测试。[ACP 资源链接的 MIME（Multipurpose Internet Mail Extensions，多用途互联网邮件扩展）字段](https://agentclientprotocol.com/protocol/v1/content#resource-link)
- 使用官方客户端、实际协议进程、隔离本机流式 `acp-review/local` 及开发网页。验收有明确媒体类型、无类型的普通文本链接、注册命令附带链接、规范图片字节、消息身份及真实重载。无外部凭据。

## 基线现象、根因和影响

实际协议端口 `40096` 读取文件 `inspection`，原文件没有扩展名，内容是 100 字节 PNG。客户端提交的资源链接明确包含 `mimeType=image/png` 和显示名 `Inspection capture`。原生编辑器会话和公开 Chat（交互对话）都收到 `-32603`。实际服务日志中，原生请求 `2989f01f-410e-4300-8951-7d3cab582426`、对话请求 `30b9e3f3-58d5-4df0-8154-be4c517fb466` 均报 `Cannot read binary file`，文件路径对应同一个真实原件。公开历史返回零条记录，实际网页也显示空会话。相同文件以包含必需图像字节的图片内容块提交，真实流式结果为 `end_turn`，持久化 `image/png`，公开原件下载的 100 字节逐字节匹配。[实际日志、协议对照和网页](../../artifacts/2026-11-19-acp-linked-resource-media-type/README.md)

`ACP.parseUri` 对本地 URI（Uniform Resource Identifier，统一资源标识符）返回默认 `text/plain`。`resource_link` 分支取客户端的明确 `name` 后直接传递该对象，遗漏同一内容块已有的 `mimeType`。后续物化器因而选择文本上下文路径。`ReadTool` 的文件名类型推断无法识别无扩展名图片，再按实际字节识别为二进制并拒绝文本读取。普通图片分支已明确采用其 `mimeType`，走规范字节物化，因此对照成功。第 314 批修复了同一解析器的名称边界，媒体字段在上层输入映射中仍丢失。

普通提示和注册命令共享资源链接转换，均受影响。公开文件输入已经接受明确 MIME，保持当前图片物化、附件验证、模型能力、原件与回放合同即可。无 MIME 的文本链接继续采用现有文本读取，以获取原文和明确行范围。远端或非本地链接仍走当前文本引用合同，本批修复限于已经被识别为本地文件的对象。客户端给出的文件类型继续经过当前实际字节读取及模型能力处理。已有失败输入未成为消息，无法从其空历史重建原件；用户重新提交链接后按新合同处理。数据库结构、持久格式、权限、文件名、模型配置和既有历史均无需迁移。本次失败发生在输入物化、消息接受之前，未观察到调度、并发、唤醒、执行轮次恢复或终态归属异常。

## 实施与验收

- 在既有本地资源链接映射中同时采用客户端的明确名称及可选媒体类型；不提供媒体类型时继续使用当前文本合同。实际物化和附件写入仍复用公共输入路径。
- 聚焦正向检查普通提示和注册命令传入无扩展名图片，验证明确 MIME、原件字节、输入与助手父级及协议重载。保留无 MIME 的文本链接读取验证。实际网页打开对应对话，查看图片、预览、下载和原文件，逐张复核。核对实际流式请求携带的图像字节，运行相关 ACP、附件和模型图像输入检查、类型、文档和架构索引，完成范围提交及普通推送。

## 实际结果

- 候选原生会话 `ses_-zUOe8KIUzzZSsgSVKGS` 和网页对话 `ses_hKbz4eDkeYZUIJ0e2KnR` 均返回 `end_turn`。公开历史 `5ce654db-ea45-4f91-aadf-d7678a4688e5`、`b18dbd0f-968b-459c-b203-4ff0f8a535ca` 分别保存正确 `image/png` 文件及独立助手终态。原生用户 `msg_g0VbLrflO00iABfFOFF0` 与助手 `msg_g0VbLrfor00IghBNxBtj` 对应，重载图像仍属于同一持久用户消息，字节为原来的 100 字节。
- 实际本机流式请求收到 `image/png` 和 100 字节图像。公开原件下载 `d533c42c-31e4-4f46-b509-8e13cacd04c2` 与原文件相同。真实网页显示客户端名称 `Inspection capture`、原图和已完成回复。预览、真实下载均完成，浏览器建议名 `Inspection capture.png`，下载逐字节相同。截图已逐张人工复核。
- `bun test './test/acp-prompt-terminal.test.ts' './test/acp-prompt-response.test.ts' './test/server/attachment-download.test.ts' './test/session-model-image-input.test.ts'` 从 `packages/opencorvus` 通过 42 项和 208 个断言，包含普通提示和注册命令的声明媒体链接以及无 MIME 的文本上下文。后端类型、接口文档和架构索引通过。专用浏览器、协议服务和本机模型已正常退出。[最终截图与运行证据](../../artifacts/2026-11-19-acp-linked-resource-media-type/README.md)
