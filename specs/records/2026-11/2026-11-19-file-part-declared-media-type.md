# 附件预览使用明确的媒体声明

## Recall

- 用户要求本人持续分批迭代，先完整分析根因及影响并落盘，再修改、真实 Windows 桌面交互及截图人工复核、聚焦正向功能验收、范围提交、上游合并和普通推送；明确不用子 agent。本批第 322 批，第 321 批 `71877ae9e`、`f1d80520a` 已推送，上游同步；本批开始的 177 项原有工作区状态保持完整。
- 已读当前界面与数据架构、`FilePart` 完整分类和调用、`ChatBubble` 图片分组、附件原件上传/读取及存储扩展名选择、公开提示合同、真实 Provider（模型服务）输入转换、文本读取和下载 primitive（基础组件）、前批媒体声明记录。全仓搜索 `kindOf`、`isImageFilePart`、`mimeOf`、同语义分类、`attachmentImagePreviewUrl` 以及相关现存测试。两处分类消费者均使用 `FilePart` 同一实现；不另建分类器。
- 已核对 [WHATWG（Web Hypertext Application Technology Working Group，网页标准工作组）媒体类型标准](https://mimesniff.spec.whatwg.org/#mime-type-essence)：类型的 essence（基本类型）由类型/子类型组成，参数独立存在，大小写及外围空白在解析时规范化。仓库 `isDecodableText` 已按分号前基本类型比较。本批让同一界面分类使用明确媒体声明，保持现有真正缺失声明时的窄范围资源身份识别合同，不做浏览器内容嗅探。
- 验收要求：声明为文本的原件即使原名为 `.png`、`.mp3`、`.pdf` 也能展开并显示其真实中英文文本；声明为通用二进制的 `.jpg` 使用原件下载；明确 PNG（Portable Network Graphics，便携式网络图形）正常呈现与查看。实际下载保留原名且字节一致，既有图片分组与普通文件呈现使用同一判断。所有 UI（User Interface，用户界面）验收仅手动坐标/键盘、真实页面与人工截图，不新增或运行 UI 自动化。

## 可观察现象、触发与根因

真实基线 `40124/ui/` 中，用户 `msg_ba6ae20a0c0d47c7a222f9cd2a9e7ce9` 经公开原始上传提交五份规范附件。三个文本均明确声明 `text/plain;charset=utf-8`、70 字节；`binary-packet.jpg` 为 `application/octet-stream`、5 字节；真实 `source.png` 为 `image/png`、100 字节。五份公开原件均 200 且逐字节相同，助手 `msg_g0VbMNCWH00RfT61cmlA` 正常 `stop`。

本人实际看到 `.png` 文本和 `.jpg` 二进制的图片读取错误，`.mp3` 文本显示零时长音频播放器；展开 `.pdf` 文本后得到 PDF（Portable Document Format，便携式文档格式）读取错误。PNG 对照正常显示蓝色图像。[真实输入、原件与截图](../../artifacts/2026-11-19-file-part-declared-media-type/README.md)

直接触发点是 `kindOf` 只对图像、视频、音频、PDF 的明确 MIME（Multipurpose Internet Mail Extensions，互联网媒体类型）提前返回，随后对所有其他 MIME 无条件检查 URL（Uniform Resource Locator，统一资源定位符）后缀。注释称该分支用于缺失媒体声明，代码却没有表达这个条件。因此真实文本/二进制声明被原名后缀覆盖；图片分组进一步把这些文本移到图片区域。`mimeOf` 也只转小写，没有取基本类型，带参数的精确 PDF 比较会错误依赖后缀。

附件存储的当前 `extensionFor` 优先保留调用者原名扩展名，MIME 是 metadata sidecar（原件元数据旁文件）中的独立真实事实；名称后缀不是类型证明。只改加载错误提示、隐藏出错图片或给文本增加单独分支都无法修复共享分类；过去媒体和名称一致的样本没有覆盖此场景。

## 影响与边界

- 定义和调用：只修改 `FilePart` 内既有唯一 MIME 规范化与媒体分类。`FilePart` 渲染和 `ChatBubble` 用户图片分组都自然取得同一结果，覆盖历史附件及使用同一组件的当前媒体呈现。明确文本交给现有 `isDecodableText`、`TextAttachment` 和 `ResourceTextPreview`；通用二进制继续使用原件下载。没有新增分类缓存或影子状态。
- 公共合同和数据：不改 API（Application Programming Interface，应用程序接口）、原件 URL、文件名、媒体 metadata、字节、数据库或 Provider 输入。无迁移、版本更新、发布，也没有观察到调度、队列、唤醒、恢复、并发或终态异常。模型层已正确处理本批规范原件，图像请求只应携带真实 PNG；不以参与者回复证明文件理解。
- 已存在的缺失声明合同：当前界面架构允许 optional message MIME 的规范图像身份识别，真正没有声明时仍使用原实现中的窄范围 URL 信息。明确声明为非媒体时直接按该事实选择普通文件，不能通过后缀再次改判。未知类型保持下载；没有新增备用路径。真实资源类型与原名无需被强行改写为一致。
- 文档和测试：更新当前面板架构的声明优先合同。检索当前附件呈现依赖时发现 `packages/overlay/test/attachment-resource.test.ts` 自动断言图片显示 URL 的选择，属于本次检索到的界面行为测试；按用户禁止保留 UI 自动化的要求删除，未运行。该文件没有专用 fixture（夹具）、baseline（基线）或独立脚本；不扩大扫描无关测试。
- 风险：如果生产者给了错误媒体声明，界面应按真实输入及现有错误诊断呈现，而不能以名称偷偷覆盖。正确图像、PDF、音视频和目录基本类型继续先匹配；参数和外围空白只影响比较，不改真实 MIME 及原件。明确通用二进制名为图片时改为下载，是本次应交付行为。界面使用既有本地化控件，无新增固定语言文案；原名与中英文文件正文保持原样。

## 隔离验收工具修正

首次搭建脚本使用 Windows Python 默认编码写中文，产生编码异常，已改为明确 UTF-8（Unicode Transformation Format，统一字符编码）写入并验证实际监听。随后脚本给了公开提示不支持的 `noReply` 选项和非规范 HTTP 资源；SDK 忽略未声明字段，实际提示正常接受后，在模型转换处因非规范附件得到真实错误。该会话为 `ses_hVPlCez9WWkcFu9gfcph`，不能作为本预览缺陷的成功或失败证据；没有直写数据库、补写消息或清掉事实。修正为正式 SDK 上传及普通真实提示后，在新建的真实网页对话 `ses_hF5DAVKqBqQ7qp0X6yTC` 完成上述基线复现。现有公共协议及规范原件要求不在本批改变。

## 实施和验收计划

先提交此规格和基线。`mimeOf` 采用当前共享文字类型判断一致的基本类型规范化；`kindOf` 只在没有明确基本类型时读取 URL 媒体信息。删除本次发现的 UI 行为自动测试，保留现有唯一图片资源 URL 实现。运行前端类型、语言、样式和正式构建，检查真实 renderer（渲染器）表面；不独立启动 Vite。

候选开发服务 `40126/ui/` 使用同一组公开原件及真实流式 `acp-review/local`。本人展开三份文本并逐张查看原始中英文正文，实际下载并比较字节，核对通用二进制入口及真实 PNG 图像预览；检查页面重开后仍正常。完成文档与架构检查、范围提交、fetch/merge 上游和普通推送。候选尚未实施，无外部凭据或 GPT-6.1 Sol 调用。
