# 附件文本按原件声明解码

## Recall

- 用户要求本人持续批次迭代，先分析落盘、实施、真实开发网页交互及逐张截图人工复核、聚焦正向测试、范围提交、合并上游和正常推送；不使用子 agent。上一批 `040b867e4`、`0b7cb84f6` 已推送；main 与上游 0/0，原有 177 项工作区状态逐行相同。
- 已读当前界面 07-panel、模型 06-provider、扩展 04-extensions 架构，以及 11 月 12 日文本共享读取、11 月 9 日失败恢复、11 月 19 日原件响应媒体及 ACP（Agent Client Protocol，代理客户端协议）身份恢复记录。全仓搜索 `decodeUnicodeText`、`TextDecodingError`、`decodeTextBytes`、`decodeDataUrlText`，核对三处界面调用、MIME（Multipurpose Internet Mail Extensions，多用途互联网邮件扩展媒体类型）分类、工具结果物化、实际模型输入、ACP 回放、原件下载、文件编辑、webfetch、字节前缀和正向测试。触及路径未发现 ResourceTextPreview 等界面自动测试；不运行或新增界面自动测试。
- 权威依据：[WHATWG 编码标准](https://encoding.spec.whatwg.org/#decode)的标签与字节序标记合同、[TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder)的严格错误与流式前缀语义、[content-type 官方 API](https://github.com/jshttp/content-type/tree/v3.1.1)的成熟参数解析。采用浏览器和服务端标准 TextDecoder，不自己维护字符表或编码别名；直接声明纯 JavaScript 的 content-type 3.1.1 依赖，避免依赖间接安装或 Node.js 专属 MIMEType。
- 验收目标：明确声明的 Windows-1252、GB18030（中文编码）、无标记 UTF-16BE 文本得到准确原文；原 Unicode 标记、空文本与错误诊断保持；完整 MIME 参数到达草稿、历史和文本产物；ACP load/resume/fork（加载、恢复、派生）及重启回放准确，未知编码保留协议原生字节资源。工具结果的实时和持久原件投影按同一编码规则、200000 字节预算及完整字符边界运行。原字节和身份保持。真实桌面和官方协议/公开 SDK（Software Development Kit，软件开发工具包）验证，不把局部测试当端到端。
- 隔离本机 `acp-review/local` 只验证真实传输及数据流；先核 Provider（模型供应方）与精确模型投影，实际请求必须 `local` 和流式。没有外部凭据、GPT-6.1 Sol、子 agent 或 native Zed 验收。

## 可观察基线

独立开发服务 `40154`，真实 Chat 会话 `ses_hGSJScmZOPTGuerdctsb`。公开上传五份原件，公开原件 GET 都为 200、与各自输入逐字节相同，完整 charset 参数保留。真实网页展开 western-note.txt、chinese-note.txt：前者应为 `Café € 17`，后者应为 `中文 27`，页面却均报无法按 UTF-8 解码，原下载仍可用。

官方 ACP 客户端读取同一历史：Windows-1252 变成 `Caf� � 17`，GB18030 变成 `���� 27`；无标记 UTF-16BE 及带 UTF-16LE 标记的原件均产生空字符和乱码。未知 charset 的 ASCII 原件被直接当成 UTF-8。load、resume、fork 都沿用同一错误投影。完整工具输入输出与前后图放入[本批证据](../../artifacts/2026-11-19-attachment-declared-text-encoding/README.md)。

## 根因、深度和影响

1. 附件接收、已发布元数据与原件响应保存了真实 MIME 参数和字节。界面共享读取仅接收 url/authority（地址/授权），丢弃草稿引用、FilePart 和文本产物已有的完整 MIME；FilePart 还将用于分类的基础 MIME 直接传给文本区。通用解码器仅有 UTF-16 标记与 UTF-8，故声明无法参与解码。旧严格解码和失败恢复修复了损坏输入及重试，不涉及编码声明。
2. ACP 另有 `Buffer.toString("utf-8")` 和窄化文本分类；工具结果 `decodeTextBytes` 另调用 UTF-8 字节前缀函数，调用点丢弃已经验证的 attachment.mime。三处是在同一真实原件上的不同文本解释，不能只放宽一个页面。普通用户文本附件在模型请求中是具名文件引用，并不自动内联正文，故不能声称这一路模型已经接到乱码。工具结果才实际向模型投影文本正文；其基线根因有生产代码与既有预算测试，真实 MCP（Model Context Protocol，模型上下文协议）链路尚待验收。
3. 共享 text-mime 分类已覆盖 text/*、结构化 JSON/XML 等。ACP 应复用它并只按 MIME 分类，不以 `.txt` 将明确二进制改成文本。非文本图像、PDF 等传输不在本批改动范围。无法解码的文本原件有真实字节，但没有有效 Unicode 文本表示；ACP 使用原生 blob 字段表达同一资源，保留 mimeType 和全部字节，不猜字符集、不生成替代正文。界面仍显示具名本地化错误及原下载；工具未知编码使用明确 TextDecodingError，不能静默改成 UTF-8。
4. 成熟参数解析支持引号、参数名大小写及其他参数中的分号。Unicode 字节序标记优先，未声明时维持 UTF-8 默认；严格完整文档错误用 TextDecodingError，encoding 扩为真实标签字符串。工具既有宽松损坏字节替换、BOM 内容保留与预算通知属于当前合同，通过同一解码器的明确选项保留；预算边界以 TextDecoder 的 stream 状态而非错误截断字符实现。webfetch/Bash 的 UTF-8 前缀及网页 HTML/XML 编码嗅探保持各自公开语义，不作替换。
5. `decodeDataUrlText` 全仓只有定义、没有调用，是旧 UTF-8 文本便利入口；删除该死代码和注释，不保留平行字符解释。严格 Base64 原字节解析有实际调用，保持不变。通用 decodeUnicodeText 更名为 decodeText 并同步全部调用和测试，不留旧别名。
6. 本批是只读字节解释，不变更公共 HTTP/SDK/存储 schema（数据结构）、凭据、权限、流式请求、编辑器的 UTF-8 保存、原件缓存及下载地址，不需数据迁移或 SDK 结构生成。公共契约需更新三份当前架构：界面、Provider 文本投影与 ACP 原件回放。没有调度、队列、恢复所有权或终态异常证据，故不把既有任务执行机制纳入本批修复；重启验证针对持久原件回放。
7. 风险：宿主可能不支持某些编码标签，必须提供具名错误或原生 blob；不能猜编码或修改原件。200000 字节切到多字节/代理项中间必须保留完整前缀。旧历史已有替换字符无法凭猜测恢复；本批只从仍完整的原件重新投影。

## 实施和验证方案

1. 唯一 util 文本解码器接收完整 MIME 和可选预算、严格/宽松与 BOM 内容策略。所有三类消费者传递真实声明。前端三处保留原授权读取与焦点生命周期；文本产物使用 source.mime。
2. ACP 使用共同文本分类和严格解码；有效资源提供准确 text，解码错误提供原 blob。工具结果传入已验证 MIME，并保留当前预算、通知和宽松 EOF（End of File，文件结尾）合同；未知标签产生类型化错误。
3. 聚焦正向测试：原 Unicode 合同、声明编码、引号和大小写、标记优先、空输入、未知标签、坏输入、GB18030/UTF-16 字节预算和实际 EOF；实时/持久工具输出；真实 ACP 持久附件回放。不写 DOM、文案、快照或像素断言。
4. 构建、前后端及 util 类型、界面语言和样式检查、文档与架构检查；启动新候选服务 `40156`，真实桌面展开至少三种已声明编码、UTF-16 标记、未知编码错误，原下载实际事件逐字节核对；中文界面和草稿入口复核。官方 ACP load/resume/fork、正常退出再启动同一库，真实只读 MCP 返回嵌入资源并经流式模型请求核对文字，不能只跑夹具声称完成。
5. 记录所有未通过或未覆盖事项，清理本人服务和窗口，保留原工作区；范围提交，fetch 后 merge 上游，检查完整待推集合和必要验证，再正常 push，继续下一批。
