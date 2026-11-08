# Markdown 文档内章节导航调查

## Recall

用户要求持续按批并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能和缺陷，先根因/影响分析并落盘、真实桌面/ui交互和截图人工复核、聚焦正向功能测试及获得具体授权时的GPT-6.1 Sol验收，范围提交、上游合并和正常推送后继续，直到明确停止。上批4b1179793已正常推送，当前HEAD/upstream 0/0、暂存空、原177条工作区逐项保持。Sol凭据授权待答复，本批零模型/零消息，不读用凭据。

本批functional/ui两代理并行只读审计，禁止再次委托。主代理已读utils/markdown、markdown-preview、worker/render service、TextPart/MarkdownBlock、FileEditorPane、DocumentArtifact、main两组全局点击委派、07-panel的文件预览/相对路径/行范围/worker合同，以及10月30日文件预览/相对导航记录。全仓搜索StaticTextPart/TextPart/StreamingMarkdownPart所有调用、fragment/hash/scrollIntoView/heading id、lexMarkdown/renderMarkdownToken与成熟slug依赖。现github-slugger 2.0.0只被网站相关包间接使用，Overlay未直接声明；不直接依赖偶然可解析的传递包。

## 修改前根因与影响分析

待证现象：普通Markdown文件Preview呈现[Jump](#summary)，点击可能没有到同文档Summary，并改变整个/ui的URL（Uniform Resource Locator，统一资源定位符）hash。尚未实页复现，不能由没有heading覆盖直接宣称运行失败，也不把未知章节能力说成旧合同回归。

代码候选链：Marked默认heading输出hN但没有id；共享自定义renderer当前只覆盖表格、代码、行内代码、HTML（Hypertext Markup Language，超文本标记语言）、链接和图片。markdownProjectFileReference明确排除#前缀，safeMarkdownHref保留该href。main文件委派只处理真实file属性，另一委派只处理HTTP（Hypertext Transfer Protocol，超文本传输协议）外链，没有本地fragment分支，因此浏览器默认会解释为整个应用文档的fragment。

数据流为FileEditorPane当前draft→StaticTextPart→StreamingMarkdownPart→唯一module worker按文档lex→逐top-level token缓存/返回→多个MarkdownBlock兄弟节点。TOC（Table of Contents，目录）与目标标题通常不是同一冻结块，不能只在点击块查找目标；也不能使用全局同名DOM（Document Object Model，文档对象模型）id让浏览器跨文档命中。worker的块缓存键含上下文/token.raw但不含标题序号，单纯全局递增slug（章节短标识）会被缓存跳过，重复标题/跨请求编号错误；实施前必须明确文档owner与稳定生成/查找策略，不复制解析器或渲染器。

旧路径只承诺#L行范围与真实文件导航，未知fragment保留原文本。10月30日修复文档目录基准和草稿准入；11月6日指南通过源码查找，没有章节链接验收。若实页成立，本批属于已呈现链接的章节导航能力补全。保持原Markdown原文、文件身份/草稿、来源只读、相对文件/行范围、图片/外部URL与worker流式合同；不把fragment解析成文件路径或用搜索代替用户指定目标。

共享消费者包括普通消息、Goal（持续目标）的原目标/验收、提醒、子agent摘要、Question（问题请求）、Document、Notebook（每个Markdown单元格/输出）和Presentation（每页）。各自当前StaticTextPart是独立文本owner；跨cell/跨页章节不是本批自动获得的合同。是否采用共享文本owner内导航或只增强文件预览，需实页证据、权威资料与代理评审后定稿。不能让隐藏/其他文档成为章节目标。

当前没有Task/Mission/Session（任务/多步任务/会话）的调度、队列、唤醒、恢复或终态异常事实；worker代码仅被调查，不据源码命名推断后台异常。预计不触及API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、权限、配置、schema（数据库结构）或持久格式。若仅UI导航不增加UI自动化；若新增纯数据解析合同则另列聚焦正向输出测试，不能冒充实页验收。当前未搜索或发现UI自动化测试，不新增/运行。

## 隔离前态与后续决定

新私有临时根opencorvus-iteration-20261108-b11、全新OPENCORVUS_HOME、自有project，before38939，最终实例端口按实际记录。reading-guide.md包含顶部章节链接、足够真实段落让目标在屏外、重复Summary和中文标题；other.md含相同标题但不同正文。输入本身保存在同名artifact目录，不生成聊天/产物假消息，不修改用户文件，不单启Vite。

真实Home Browse files→打开.md默认Preview，截图顶部，点击Jump并观察真实滚动、标题/目标正文和URL；只读DOM/scroll位置辅助定位。先补前态结果，再决定成熟slug、文档作用域与未知/尚未挂载目标合同；不得先写全局id或简单正则补丁。若当前已可用则记录否证、不强改。

若修复：最终构建新实例通过实际鼠标/键盘链接、重复标题、中文编码、返回顶部/文档重开、当前草稿，以及原相对文件/行范围合同人工复核。多owner仅以可真实进入的页面证明，未做到的分支明确说明。类型、语言、build/renderer、docs/architecture仅辅助。本人页面/服务正常关闭，范围提交、上游合并和完整待推集合审查、正常推送后继续。

## 前态证据与实施定稿

38939/main-DocOXfvP.js真实默认Preview中，顶部Jump可见，Summary在top=2062.90625屏外；点击后URL为/ui/#summary，预览scrollTop仍0，目标矩形不变，所有标题id为空。01/02截图已人工查看，before-jump.json为只读观察。本人服务正常shutdown，原启动句柄12926 exit0，IAB 24关闭；不把源码推断代替该证据。

权威资料已核对：[Marked高级说明](https://marked.js.org/using_advanced)记录其默认headerIds已移除、扩展机制可提供标识；[github-slugger说明](https://github.com/Flet/github-slugger)明确处理同文档重复标题，但输入应为纯文本，它不是Markdown/HTML解析器；[scrollIntoView](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)负责把目标带入祖先滚动视口。选择仓库已锁定的github-slugger 2.0.0作为Overlay直接依赖，不新增自制slug正则或切换Markdown解析器。

两代理评审及主代理进一步排除TextRenderer→统一实体decode方案：Marked TextRenderer的em/strong/link等直接返回token.text，嵌套强调可能保留源标点；代码跨度中的字面`&amp;`在实际renderer中必须显示为原字符串，统一decode会误改。也不向worker引入标题计数或全局HTML id。

实施定稿：共享heading renderer只加data-markdown-heading标记和tabindex=-1，正文仍原parser.parseInline。StreamingMarkdownPart根标记唯一当前文本owner，并处理普通主键纯#非空链接；先挡嵌套owner/已处理事件及修改键，再preventDefault。当前owner的已渲染标题按真实DOM顺序枚举，过滤嵌套owner；只读遍历其子节点取可读文本，图片读取img.alt，本地图片slot读取原data-document-image-alt并停止遍历其加载/失败提示。这样不克隆有src的图片节点、不重复解析/实体decode，不让图片状态或本地化提示改变章节label。

纯数据markdownSectionIndex接收真实标题label数组和不带#的fragment组件，decodeURIComponent一次，以每次局部GithubSlugger顺序结果找精确索引；没有共享计数/缓存/新文档状态，重复标题与旧worker块缓存不冲突。找不到或非法编码返回undefined，点击保留原链接焦点且不改应用hash；未挂载标题同样不建立队列/轮询或延迟抢焦点。只导航已呈现的同owner章节，不支持跨文件/cell/页拼接。命中后原生scrollIntoView和heading.focus(preventScroll)，让键盘下一Tab从目标继续；外部URL、file链接的href=#、带#L文件导航保留原委派。

最终采用只读子节点遍历而非DOM副本，避免克隆img src引起额外资源生命周期。直接renderMarkdown→innerHTML消费者（更新日志、部分专家团/架构面板等）不属于TextPart owner，只有heading标记/可程序聚焦属性，不获得本批导航；不扩大为这些页面已覆盖。当前未知/未挂载目标需用户之后再次激活，没有保存等待请求，文档前部编辑后序号以当前实际呈现为准。

实施复核修正：首版数据helper多做了trim，代理根据Marked代码跨度和本地GithubSlugger源码指出，代码跨度两端有两个空格时实际可读label保留一个，库应产生`-a-`；自行trim会把它与A合并。删除这层未声明文本预处理，直接把真实可读label交成熟库，并加纯数据正向索引与真实空格代码标题输入。55.57秒首构建仅作编译辅助，最终重建后才开展本轮后态实页验收。

新增纯数据正向测试验证明确目标索引、重复标题与已有后缀冲突、Unicode/编码fragment、字面实体label；不是DOM/组件/UI文案测试。UI只真实交互。最终输入另存reading-guide-after.md，增加嵌套强调/代码字面实体/本地图片标题、未知/非法fragment和原#L3文件链接，原reading-guide.md保留前态准确输入。新独立after项目/进程38940检验原核心跳转、重复/中文/格式化标题、返回/Tab、相对文件/行号和数据保全；两个独立文件不冒称多owner并存验收。

## 最终实现与真实验收

产品变更仅TextPart当前owner点击/只读heading文本、原Markdown heading属性、纯数据section索引，以及Overlay直接依赖github-slugger 2.0.0；bun.lock只增加其workspace声明一行，没有传递版本变化。源原文、worker/protocol/缓存、文件reader/保存/下载、API/SDK和schema不变。未知目标没有待处理任务或第二条导航路径。

最终build main-DWOQ6czO.js（49.89秒）在新进程38941/ui、1280×720桌面人工交互，14张截图全部实际查看：

- 01/02为准确原前态。03为扩充后最终输入顶部；实际指针点击Jump，scrollTop=1985、焦点H2/Summary、第一总结正文可见（04），URL仍/ui/且主会话scrollTop=0。
- 不重新定位控件，原生Tab到Return to top，Return后H1/Navigation notes持焦点、scrollTop=24；从TOC键盘Enter到第二个Summary，显示B11_SECOND_A、当前H2持焦点（05）。标题靠近文档末尾时受真实最大滚动位置约束，不用额外空白制造顶端对齐。
- 编码中文fragment命中中文章节（06）；嵌套强调命中可读Nested emphasis；代码实体命中真实字面`Literal &amp;`（07）。图片alt定位到实际图片H2（08）；原代码空格标题focusText为` A `，普通A为`A`且是不同H2（09），都保持原URL。
- 原图片按钮仍打开Guide icon窗口（10）；Other file line沿原文件委派打开other.md源码第3行并实际选中原链接行（11）。切Preview后其同名Summary命中B11_TARGET_B（12），再经真实Explorer重开reading-guide.md，第二Summary仍正确。这里只证明分别打开两份文档，不冒称两个owner同时呈现的交互资格。
- Source实际末尾Enter/输入B11_UNSAVED，Preview后Jump仍命中第一Summary，Save可用、原未保存标识/说明保留（13）。实际Download draft导出6412字节，完整等于6358字节原输入加两次换行和实际追加文字；真实HTTP 200及磁盘分别核对reading-guide/other原6358/1780字节内容。下载件在本artifact目录，不留用户Downloads。
- 只在本隔离页设置中文，原当前草稿仍有追加正文，中文章节获得H2焦点、预览scrollTop=2429、主会话scrollTop=0、URL保持/ui/（14及final-chinese-observation.json）。产品导航/控件/未保存说明为中文，作者原标题和正文保留真实文本。
- Unknown/Malformed链接由真实Enter激活，当前链接持焦点、URL仍/ui/、预览停原阅读位置。首次对换行Unknown做指针定位落在链接包围框空白而聚焦Preview，已换原生键盘激活核对，不能把那次空白点击当产品结果。第一次导出观察误用旧Download名称（当前实际为Download draft）使工具等待超时；重新绑定同一IAB 26、读取当前控件并完成实际导出，未改产品规避工具失误。工具临时内存中的部分几何数组随恢复丢失，以已保存原截图、实际工具回执与最终中文观察为证，不伪造恢复后的原始JSON。

数据测试：最终markdown-section 6测试/14明确索引断言、原file-reference 21测试/29断言通过。没有UI自动化测试或静态源码字符串验收。Overlay typecheck、2语言2914键检查、最终build/renderer public surface、根docs:check（352操作26组）、architecture-index和package-topology通过；这些辅助检查不替代上面的实页截图。原始HTTP响应revision仅为记录，不用于摘要门槛。

未独立实页覆盖：嵌套/并存多个TextPart owner、真实模型流式期间尚未挂载目标、图片加载失败时的标题alt、外部URL及跨文件章节；按已声明文本owner和当次已呈现标题合同交付，不声称Notebook跨cell/Presentation跨页、同步HTML页面或跨文件章节获得能力。Sol授权仍待答复，本批零模型/零消息。

本人38939/38940/38941正常POST /shutdown，原句柄12926/62196/8907均exit0；IAB 24/25/26关闭。只保存本人输入/下载/截图，保留用户原177条工作区状态；三共享README只提交本批新增入口。结束前范围提交、fresh upstream merge、完整待推集合审查和正常hooks push，再进入下一批。
