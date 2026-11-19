# Markdown 跨文档标题链接

## Recall

- 用户要求本人独立持续迭代，先分析和落盘规格，再实施、聚焦正向测试和真实 Windows 桌面交互与截图人工复核、范围提交、合并上游、正常推送；无子 agent。上一批 `97f1b626a`、`f64cfb47c` 已正常推送，上游 0/0，原来 177 项工作区状态保持。
- 已读本月同文档标题导航、原样百分号、Markdown 文件与图片的历史规格、07-panel、`markdown.ts`、`file-reference.ts`、`TextPart` 与 worker（后台渲染线程）模型、工作台 `FileEditorPane`、`file-workbench`、`main.tsx` 文件委派、`workspace.openProjectFile`。全仓查 `markdownSectionIndex`、`fileReferenceRange`、`openFileReference`、`selectedFileTarget`、`fileEditorRevealRevision`、`extToLang` 和涉及的正向调用及测试。同文档章节已有成熟 GitHub slugger（标题短标识生成器），旧方案明确未交付跨文档标题。
- 验收为项目本地 Markdown 链接 `./notes/target.md#implementation-details` 打开正确文档并定位、聚焦其实际给定标题，地址栏保留应用。保留现 `#L3` 源码选择、同页 fragment（片段）和相对文件路径。重复、编码标题、缺失标题、未保存源文件和用户移焦要保留各自现有选择与工作归属，不触发模型、凭据或界面自动化。

## 真实现象、根因和完整影响

1. `40238/ui/` 独立 Windows Chrome 在项目 `section-link-review` 用 Browse files 打开 `guide.md`。同页 `#implementation-details` 点击保持同一预览和应用地址。点击 `./notes/target.md#implementation-details` 则使浏览器变成 `/ui/notes/target.md#implementation-details`，重新显示项目主页，文件面板关闭；没有看到标题或文件正文。随后回到真实根页面，从同一指南点 `./notes/target.md#L3`，文件面板准确打开 `notes/target.md` 的源码第 3 行。真实 `/file/content` 200，1305 字符与原件一致，目标标题确实存在。[实际基线](../../artifacts/2026-11-19-markdown-cross-file-headings/README.md)
2. 链接 renderer（渲染器）先从 authored destination（作者填写的目的地）提取已有源码行，`markdownProjectFileReference` 拒绝剩余 `#`，于是产生普通相对浏览器地址。服务器的 `/ui/*` 为实际应用文档路由，所以浏览器完成文档导航而非项目文件读取。同文档标题仅由 `TextPart` 内已渲染标题处理 `#` 开头的链接。两者都执行了既有局部合同，旧同页导航规格没有将 `file#heading` 交到文件工作台，增加每标题全局浏览器标识也不能解决资源归属。
3. 有效源码行语法由原 `parseFileReference` 优先接纳。Markdown 文件名用原唯一 `decodeMarkdownFilePath` 解析一次，标题部分使用现有 `markdownSectionIndex` 的编码和标题顺序。只有已经识别为本地 Markdown 文件的有效非空片段走章节请求。保持现查询、外部 URL（Uniform Resource Locator，统一资源定位符）、附件地址、正文同页链接和非 Markdown 类型策略。目标路径仍对所属文档父目录或当前项目解释，并走原文件工作台权限、未保存确认、只读外部文件和连接令牌。
4. 效果到达时不能取仍挂载的旧文档标题。`FileEditorPane` 已用当前内容归属、API（Application Programming Interface，应用程序接口）轮次及 `fileEditorRevealRevision` 协调打开和一次焦点。worker 分阶段挂载实际标题。应让当前目标的同一预览 owner（归属组件）在真实渲染结束时提供同一标题定位，而非在首次读到文件正文时猜测或轮询。当前打开轮次仅消费一次，文件、预览选择、连接变化和用户主动移焦都必须保留当期事实。缺失标题或无法渲染仍进入原预览焦点/错误合同，走一次允许的揭示。
5. 影响文件面板及现有可点击项目文件委派，原生外部编辑器也必须把带章节的位置交给能定位它的现文件面板。聊天和文档可用同一链接解析和选中文件入口，文件资源打开仍受当前工作上下文。不会把各个 Notebook 单元或 Presentation 页面合并为同一文档，也不增加全局 HTML（HyperText Markup Language，超文本标记语言）ID。Task/Mission/Session（任务、多步任务、会话）执行轮次、队列、恢复、持久迁移、发布和模型范围不涉及，当前观察是只读文件定位。风险集中于陈旧或错误焦点、重复标题编号、破坏源码行或全球 URL、绕过离开确认及多种 Markdown 渲染状态。

## 实施与验收

1. 链接分类携带被交付的原始 Markdown 章节片段，文件引用属性、当前委派和工作台位置映射沿同一语义传递。目标文件使用一个已有或新建的揭示轮次接受 `range` 或章节位置，资源身份不含呈现焦点。跨文件与普通文件引用使用同一打开服务。默认源码行走 Source，明确章节显示 Preview。
2. 从当前 `TextPart` 提取一个共用的标题导航，点击同页链接沿即时语义。对于明确的工作台章节揭示，以当前 worker 完成当前文档的渲染和挂载为回执。文件面板在现有一次焦点守卫内执行滚动、聚焦或预览容器的既有焦点。按当前视图、内容身份、轮次、API 归属及原焦点核对；挂载时机以真实现有组件消费，避免定时轮询、全局节点查找或在视图重开时重新跳转旧章节。
3. 聚焦数据测试覆盖文件链接拆分、行号优先、编码文件名与章节，以及工作台同一文件资源的实际位置结果。重跑已有章节索引及文件引用/揭示契约。真实候选 `40240/ui/` 打开指南，人工验证鼠标和键盘跨文件跳转、目标正文、编码/重复标题、无标题时文件仍打开、同页和原源码行；在实际打开前存在草稿时用原对话框核对取消。实际类型、双语、构建、文档/架构，服务正常退出，精确提交并合并上游后正常推送，再继续体验下一批。
