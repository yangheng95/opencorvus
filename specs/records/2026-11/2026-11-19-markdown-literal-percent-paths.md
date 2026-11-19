# Markdown 相对资源路径保留原样百分号

## Recall

- 用户要求继续独立按批体验，先根因与影响落盘，再实施、聚焦正向测试、真实 Windows 桌面验证与人工复核、范围提交、合并上游和正常推送。上一批 `cbbf87e2e`、`872500c77` 已推送，分支和上游 0/0，保留 177 项原状态。
- 已读当前 07-panel 的 Markdown 单次解码和文件工作台合同、同月 Markdown 图片错误恢复、下载与最近两批代理验收。全仓查 `markdownProjectFileReference`、`safeMarkdownHref`、`safeMarkdownImageSrc`、`decodeURIComponent` 相关调用、`MarkdownBlock`、`resolveDocumentFilePath`、`file.read`、`file.download`、文档点击委托和相关 `server-path.test.ts`。判定由一个链接分类和一个文档图片 reader（读取器）通向同一文件服务，两个入口目前各自解码。
- 指标为原样 `%` 图片和文件链接按真实文件名读取，正确编码的空格、Unicode、`#` 和 `%2523` 继续精确地只解码一次。保留项目边界、原文件、标题和现有预览错误；不增加界面自动化、模型或普通网页代理规则。
- CommonMark 区分 Markdown 目的地语法和渲染时的编码策略。URL（Uniform Resource Locator，统一资源定位符）标准的百分号解码算法会按字面保留后面没有两个十六进制数字的 `%`。本批把这条规则用于已分类的本地文件路径，并对真正的百分号编码字节继续用严格的单次字符解码。[CommonMark Links](https://spec.commonmark.org/0.31.2/#links) [URL Standard 的百分号解码](https://url.spec.whatwg.org/#percent-encoded-bytes)

## 基线、根因和完整影响

1. 隔离 `40234/team/ui/edge/ui/` 通过完整反向代理在线。文件树正常打开 `阶段 报告 #100%.md`，预览显示隔离标记。真实下载事件报原名，76 字节与原文件一致。独立二进制 `数据 快照 #100%.bin` 也保留全名，9 字节与原文件一致。已有读取、下载及前缀不是这些新故障的入口。
2. 同一项目 `章 节/索 引.md` 里，编码路径 `./图%20标%20%23100%25.png` 显示真实图片；`./chart-100%.png` 显示加载失败，Details 为 `URIError: URI malformed`，调用栈为文档 reader 在本地解码。编码的 `./保留%20%2523.md` 打开真实名 `保留 %23.md` 并显示原文。真正的 `/file/content` 用精确查询可读到两图及 `note-100%.md`，和已知文件正文或字节相同。
3. `章 节/未转义链接.md` 的 `./note-100%.md` 本身被解析成超链接。当 `markdownProjectFileReference` 对已过滤的本地路径调用 `decodeURIComponent`，原样 `%` 触发抛错并退出本地文件分类。普通 Markdown 链接仍有 href，因此真实点击让浏览器离开工作台并向 `/team/ui/edge/ui/note-100%.md` 请求。代理和实际服务都记录 403。文档图片在 `FileEditorPane.previewImages` 内直接调用同一严格解码，抛错后请求尚未开始。根因是把所有百分号都当作转义开头，数据不属于文件系统路径错误。
4. 旧路径正确处理全部转义的名称，也把真正无效编码留给原错误边界，先前只用这类有效编码或失踪图片验证。已有文件树、原件下载、URL 资源解析和服务请求承载真实文件名，正好表明无需改服务端 URI 安全校验或工作目录准入。
5. 影响所有由当前链接分类生成的本地文件链接，以及唯一带本地 reader 的文件工作台 Markdown 图片预览。通过原分类和文件解析保留已注明行号的路径、文档父目录、Windows 和 POSIX（Portable Operating System Interface，可移植操作系统接口）的文件名语义及绝对 Sources 的读取权限。网络和附件链接、Markdown 章节 fragment（片段）、通用 file URL、Markdown 以外的原始路径属于各自合同，继续由现有所有者处理。语言键和服务公开路由无变更。数据库和 Task/Mission/Session（任务、多步任务、会话）的执行数据不涉及，观察到的是读前的确定解码和导航问题。
6. 风险是把 `%23` 本应表示的 `#` 改成字面 `%23`，或错误地再解一遍。以有效的 `%HH` 为一个已知转义，先编码其余字面百分号，再用一次严格解码。字面 `%` 紧跟两位十六进制时仍需写 `%25`，如 `%2523`。真正无效的编码字节仍交给原语义报错。使用已有文件路径解析和当前权限验证，避免新判定表、回退文件地址或资源路径双源。

## 实施与验收

1. `server-path.ts` 提供唯一 Markdown 本地路径解码，链接分类和相对图片在现有解码点复用。链接仍先解析原写法的行号和 URL 分类，图片仍使用归属已经确认的文档父目录和现文件读取服务。更新 07-panel 的当前合同。
2. 在现非界面 `server-path.test.ts` 聚焦验证原样百分号、混合转义、编码字符和 `%2523`、无效 UTF-8（Unicode Transformation Format，通用字符转换格式）错误。运行直接相关文件引用、类型、双语、构建与文档检查。
3. 新建同质独立项目，通过 `40236/team/ui/edge/ui/` 实际打开同一文档。截图人工核对两幅本地图、点击原样百分号链接应在文件工作台打开实在的目标原文、核对父目录和 `%2523` 两个既有对照、原始下载名称和字节。代理记录精确路径请求，必要时查看当前目录命名与服务读取返回。专用 Chrome 和隔离服务正常退出，再完成范围提交、上游同步和正常推送。

[真实基线图与接口证据](../../artifacts/2026-11-19-markdown-literal-percent-paths/README.md)

## 验收结果

- 相对图片和本地 Markdown 链接均复用唯一的 `decodeMarkdownFilePath`。在同一文件名里可兼有编码空格和裸 `%`。有效 `%HH` 解码一次，非法 UTF-8 送回原错误处理。文件服务契约仍接收解码后的准确路径。
- Windows 隔离 Chrome 在 `40236/team/ui/edge/ui/` 实际通过文件树打开 `章 节/索 引.md`，现有编码图和原样百分号图都真实绘制。原样链接在同一文件面板打开 `章 节/note-100%.md`，标题、位置和唯一正文正确。父目录链接打开 `阶段 报告 #100%.md`，`%2523` 对照仍打开 `章 节/保留 %23.md`。转发实录的八个浏览器文件请求均为 200，具体路径随证据落盘。
- 候选实际下载 `阶段 报告 #100%.md` 和 `数据 快照 #100%.bin`，Chrome 回执保留全名，分别 76 字节、9 字节并与候选磁盘原件逐字节一致。前后两个项目的服务、代理和专用窗口均正常退出。
- `bun test ./test/server-path.test.ts ./test/file-reference.test.ts` 101 项通过、111 次断言。Overlay 类型、双语、正式构建及渲染器公开面检查通过，文档与架构索引通过。验收限本机真实文件与代理读取，未调用模型。[候选实页和回执](../../artifacts/2026-11-19-markdown-literal-percent-paths/README.md)
