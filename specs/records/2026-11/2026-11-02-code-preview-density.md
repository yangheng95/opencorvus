# 只读代码预览的自然高度（900）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，真实页面、截图人工复核后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的多agent文字；持续Goal保持active。899正常推送3c77fd2a538e29fb189438c28a7692b6f1c45301，2026-11-02T07:50:36.498Z fresh HEAD=origin/main、0/0，19本人普通文件/六本地化字段/三索引行干净，177项无关变化保留。已读899完整Recall、13图、数据资格与fresh回执；原45573/68964消费exit0、HTTP（Hypertext Transfer Protocol，超文本传输协议）200、物理/输出/请求闭合和四配对副本退休；源899-after严格259666行、schema（数据库结构）9/92表、100项目文件及Git/229附件保全，0请求/累计1260。认证已于874刷新并在875真实验收，本轮无重复刷新必要。

实际线索是899图13：原801的counter.py仅两行正文及结尾空行，Code（代码）预览保留大片空白。已读CodeArtifact、CodeEditor完整生命周期/只读配置及外层结构、ArtifactFrame完整原生popover（弹出层）与直接body（正文）结构、Inspector对代码的原调用、InteractiveArtifactPart注册入口、Notebook直接编辑器、ResourceTextPreview/FilePart文本附件、FileEditorPane入口、workspace/messages/composer样式和展开规则；当前07-panel只读焦点/查询/布局合同。CodeArtifact只有两生产入口：模型发布的交互产物和实际资源Inspector；Notebook/文件工作台/原文本附件均直接使用CodeEditor。全仓相关检索包含readonly、msg-artifact-code、cm-editor及Code布局，未运行UI自动化。

## 修改前深度与影响分析

直接触发：Inspector把真实text/x-python资源交给CodeArtifact，后者按原payload.editable派生readOnly，却没有将这个呈现事实用于布局。messages.css把Code和Diff（差异）共用220px最小高度、560px最大高度；workspace.css又让编辑器视图区flex（弹性布局）填充、cm-editor高度100%。短只读内容因此继承编辑用途的空间，和原字节、代码高亮或数据加载无关。

旧路径已经为msg-text-attachment提供自然高度：取消最小高度/填充，视图区按内容，cm-editor自动高度，cm-scroller限定现有min(50vh,560px缩放)并内部滚动；该规则只覆盖消息附件，未覆盖只读Code产物。不能把全局220px简单改小、按字符串行数猜高度或加另一个测量/ResizeObserver（尺寸观察器）状态源，否则会影响可编辑Code、Diff、Notebook与文件工作台，并与CodeMirror测量竞争。

方案：CodeArtifact把现readOnly同源事实投影为CodeEditor根元素的data-read-only="true"；不改CodeEditor接口/内容/只读配置。将现四组文本附件自然高度声明以逗号选择器共享给真正未展开的只读Code产物：最近Code Frame的直接msg-artifact__body子元素、直接msg-artifact-code根、真实只读标记，且该Frame不是:popover-open。直接父子关系避免外层未展开产物误匹配已展开的内层Code。保留原附件选择器及声明，不复制第二套尺寸实现；展开时自然高度选择器退出，由现工作区填充规则拥有尺寸。原可编辑Code、Diff和其他直接CodeEditor用户不匹配新选择器。没有新增JavaScript（JavaScript脚本语言）测量、行数阈值、配置、状态或依赖。

权威资料：[CodeMirror官方布局说明](https://codemirror.net/examples/styling/)说明默认依内容增长，并可用高度上限和滚动容器约束长内容。直接打开返回403，官方域名搜索返回该完整当前说明；没有采用旧版2/3手册或论坛建议。仓库当前固定@codemirror/view 6.43.14；实际实现优先复用已在本仓使用的附件布局，仍须真实长短代码与展开验收，资料不能替代视觉。

影响面：CodeArtifact一个同源数据标记、messages.css四组共享选择器、07-panel/记录/三索引/实际截图。用户/模型原始代码、文件名、语言/只读/焦点/查询/复制导出、原请求/连接/项目/Task/Session（会话）归属不改；没有后端/API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）/数据库/持久格式/版本发布变化。当前无调度、队列、唤醒、恢复、并发或终态异常；如发现，立即横审全部生产入口、Task/Mission（多步任务）/Session轮次及终态、重试重启、串并行和多项目隔离。

风险是短内容裁剪、高亮/查找面板变化、长内容滚动落到外层对话、展开后继续受行内上限限制、收起后高度未恢复或原编辑器被重建。须实际验证，不用“构建通过”代替。Notebook的硬编码code cell无障碍后缀是另一个尚未实页确认的语言线索，保留后续调查，不在本轮凭源码扩大到Notebook修改；不宣称全产品问题已完成。

## 实施与验收

首次before/after均声明0模型请求、同一75分钟绝对截止和5分钟闭合预留，累计1260不加额。独立CLI（Command Line Interface，命令行接口）38631/38632的/ui/，源899-after单链继承、before复用最终UI、after由Node.js构建私有静态产物；不单开Vite、不动用户18571/窗口/真实数据库。认证及完整模型目录配对验证/复制/退休。

1. before真实原801 counter.py短预览和原发票Task test_invoice.py长预览，保存目标区域截图及实际尺寸/内容事实。公共原15Mission、四份完整TaskStatus、两Task原turnArtifacts/transcript和原项目文件保护；正常关闭本人页面/原服务句柄消费0/HTTP200/物理和配对副本闭合/严格资格后才改产品。
2. 按上述共享布局实施，两语言无新增产品文案；类型、本地化、CSS（Cascading Style Sheets，层叠样式表）token（设计标记）、文档与Node构建作辅助。纯UI不新增、修改或运行UI自动化、DOM（Document Object Model，文档对象模型）断言、组件/源码文案/截图测试。
3. after同一短文件自然高度、正文/语言状态可见，长文件达到现上限后内部滚动并查看原尾部；在真实只读代码中进入查找、核对面板/焦点与阅读。通过现展开入口进入普通应用内窗口，截图确认边界、原内容与滚动；Escape收起后回到自然高度与同一已打开文件。中英文截图人工复核；按实际数据覆盖，不伪造可编辑/Notebook场景。原API目录、消息、Task状态和资源字节保持。
4. 正常关闭本人页及原服务、配对副本退休、严格全部旧业务行/100项目文件及Git/229附件/源数据库保全；补齐限制与证据，清晰提交、fresh fetch（重新读取远端）、普通merge（合并）、完整待推集合/必要验证、正常hook（钩子）/push（推送）和fresh0/0。持续Goal保持active。

## 修改前真实证据与方案确认

01原counter.py，45字节/3行；02原test_invoice.py，1520字节/49行。实际两个代码区均220px，Frame均308px；短文件scroller（滚动区）195/195px，长文件195/906px。长文件原图标题被滚出画面，另存私有原图后在202独立页补齐完整标题/正文正式02，不把被截断图当作完整区域验收。原201/202页已关闭，原48808消费exit0、HTTP200/settle物理和配对副本闭合，严格259666→259668仅两本人控制租约、旧数据/100项目文件及Git/229附件/源数据库均保全，0请求/累计1260、退休余3668019ms。实施前产品未改。

已补查全部msg-artifact__body定义，普通正文没有另一个最小高度；展开Code正文由现grid（网格布局）和minmax填充拥有，直接父子与:popover-open边界可准确退出自然高度模式。全仓data-read-only现有使用仅ComposerReferenceSelector的引用行及其专属class，和新Code选择器无交集；不改其合同。

## 实施与实页结果

产品仅CodeArtifact同源只读标记和messages.css四组共享选择器；原文本附件声明保持，未新增测量/编辑器接口/状态/配置/依赖/本地化文案。普通Frame的直接Code根在未展开且真实只读时使用自然高度；展开后现填充规则直接接管，不重建编辑器或切换数据读法。

03同一counter.py代码区从220px到103.5px，Frame从308px到191.5px，原三行和Python状态完整；04通过原入口展开，真实窗口1120×624、x80/y48，代码区536px，document.fullscreenElement为null；05 Escape收起后恢复103.5/191.5，同一原文件仍打开。06原49行test_invoice.py滚动区从195px到360px、内容906px，代码区385.5px/Frame473.5px；07真实滚到尾部，第49行及unittest.main可见，内滚动546、外层chatTop1484，再向下滚外层仍1484。

Ctrl+F在真实只读代码内打开原CodeMirror查找面板，输入真实test_fraction_alignment_and_carry，明确点击可见Next后第43行匹配高亮；08含代码标题、查询和匹配。未把初次Enter后尚未显示目标的图片当成匹配成功证据，该图保留私有调查，不据此推断键盘根因。09切中文后当前查询、匹配和scrollTop430保持，查找/按钮/复选框使用现语言，面板随内容尺寸调整；10中文长代码展开后代码区536px、滚动区475px、Frame624px，查询保留且fullscreenElement仍null，未继续受行内360px上限限制；11 Escape关闭作品视图，再从查找输入框关闭面板，回到代码区385.5/滚动区360和原阅读位置。全部11张正式图片人工查看，02/06/08/09曾需滚动补齐目标区域，私有原图保留后才保存正式截图，不用DOM事实代替视觉。

真实after artifact-read两资源均200：counter.py 45字节/3行、test_invoice.py 1520字节/49行，响应体逐字节等于before原项目文件，类型及既有不可变引用身份一致；未使用源码摘要检查。after初始/最终15条原MissionRecord、四份完整TaskStatus与根Session/目录/生命周期均等于before，801和发票Task原turnArtifacts及完整transcript逐字段一致。没有编辑原代码、发送消息或开始/取消/恢复执行。

原201/202/203独立页面均关闭，before原48808、after原28565消费exit0，各HTTP200/原生和launcher退出0、物理身份/输出/请求闭合，四份认证/完整模型目录副本退休。严格259666→259668→259670仅四本人控制租约行，全部旧业务行/源数据库/100项目文件及Git/229附件保全，schema9/92表未变，0模型请求/累计1260，最终沿首次绝对截止退休余752346ms，无续期、重启或加额。

overlay类型、双语2770键、CSS9086引用/402TS或TSX、文档352操作26组与Node构建均exit0，实页main-BmRr-eSd.js，保留既有大chunk（构建分块）提示。纯UI不新增、修改或运行UI自动化。没有可编辑Code、Diff、Notebook、其他文件工作台/附件入口、其他尺寸或错误/断线/连接轮换的本轮视觉覆盖；选择器边界已做源码核对，不能替代这些场景的真实验收。Notebook语言线索继续留在整体Goal。Git范围审查、正常上游同步/推送及fresh结果以本轮delivery回执为准；Goal保持active。
