# 263 同一文件引用反复定位

## Recall

用户要求持续自主体验和修复Sources/子侧栏闪烁，最新单agent要求优先，只有root，不委托/新建成员或Task。262当前真实gpt-6.1-sol流式read两段27/11及206/19，来源分别27–37和206–224。首次与同文件切换已截图，反复同范围/Ctrl+Home后重定位/面板重开未验。本轮只补该真实阅读路径，不伪造新Source或发送Provider。262提交bc699265af6fc81e745efc2fe21ea67739118202，原Native与前台91100实际0；当前push等待真实join，不跳过。

已读262 Recall/完整事实、当前SourceParts/Message SourceFile/schema、file-workbench定义和公共动作、FileEditorPane→CodeEditor、range resolve/reveal与07-panel公开合同；全仓搜索同义行定位/Source打开、reveal revision和调用点。CodeEditor现NUL分隔是原身份实现，检索使用rg -a，不扩大清理。没有检索/运行UI自动化。

原事实源R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/source-range-262-live-01，真实主Session ses_-zUSO4QEmzzdS64uos4J，project prj_hyJjSXRsFzUxk3VE2GsW，原project路径/source path完整保留。两个Source.path都指向当前仓库公开read.ts，该文件不在隔离Project内，原只读Source editor负责读取。264行等猜测不作依据，原实际输出totalLines262；当前源码身份/行内容与未编辑状态需本轮核对。

## 深度和影响分析

观察候选是手动离开引用位置后点同一来源可能不重新定位；目前未知是否发生，262没有这条视觉证据。Source.open捕获API（Application Programming Interface，应用接口）authority/选择epoch与目录，目录外绝对路径经单一openSourceFileEditor/导航所有者；每个accepted open推进现reveal revision。资源身份不包含range，而位置身份包含range和revision，因此同一文件内容与只读owner保持，明确重复激活应发送新reveal。

CodeEditor先加载真实value，再按path/start/end/revision定位，未实际到达引用行不settle。焦点cursor位于起始行、band标记范围、scrollIntoView center；不是全范围文字selection。视口小可能只能显示部分范围，需人工滚动查看末尾，不把DOM（Document Object Model，文档对象模型）计数或源文件文案当视觉通过。FilePane forced mount保留单一owner，关闭整个Dock应由新的显式Source激活重新显示，不能靠刷新绕过当前状态。

本轮无已知产品根因或代码改动，不为制造提交写补丁。若异常，先记录真实触发/数据与控制流根因/旧路径、公共定义调用/测试/文档/交付/风险后修改；共享调度/恢复/终态异常必须横审全部Task/Mission/Session轮次、正常终态、重试重启、串并与多项目。非UI新增契约需聚焦正向测试；UI只能实际交互/截图人工复核，禁止UI自动化。

## 具体方案与验收

用成熟完整历史复制与原生服务工具；启动前新鲜读取原当前schema/config/全部持久恢复frontier、tool/provider/bus、permission/checkpoint、memory组织者/租约/容量、原精确出生dead/端口与完整auth/models已退休。明确selectedSubject为原真实Session，复制全部90表存储内容比较相等，不用部分fixture或把名字当Task。新副本无凭据，不重新武装执行。

新R=source-range-263-history-01、E=source-range-263/history-01，/ui18201/自己新IAB（In-App Browser，应用内浏览器）页；固定原生900000毫秒，启动前唯一关闭/原前台join/独立物理输出请求与出生端口pair/完整保管/自身5产物退休都准备。用户23/18107不操作，原Provider请求不重发，观测超时不延长或重启。

真实页面打开原主会话→点206–224→只读编辑器Ctrl+Home移动到顶部→再点相同206–224→截图确认定位206和band；再人工PageDown查看224末尾边界。切换27–37/206–224只沿真实来源。整个Dock关闭后再次点击当前Source，确认显示同一资源并按引用定位。源码不输入/编辑/保存。每次以最新AX（Accessibility Tree，可访问性树）定位控件；真实截图本人看，只读几何辅助不做断言。

自己页关闭→sole shutdown→原前台实际join→独立闭合→12核心表/完整生命周期/原项目文件属性保管；完整脱敏实际日志和人工截图归档。所有观察器terminal后精确自己单文件产物保留。root/月/相关README与当前docs/architecture检查、范围提交、fetch/merge上游、完整待推送集合审查和普通push。源外部网页/大文件/目录内range/实时子Dock/Task/Mission/Tauri宽矩阵未验则保留，持续goal active。

## 当前只读焦点缺陷与修改前完整分析

原真实206来源打开并定位成功，但焦点仍在Source按钮。03辅助实际节点是role=textbox、contenteditable=false、aria-readonly=true、tabindex=null；按AX editor发送Ctrl+Home工具准备失败且未发送键，原失败保留。04随后实际鼠标点正文并全局Ctrl+Home使浏览器视图到顶部，但activeElement为BODY，不能据此称CodeMirror焦点已工作。候选根因已落实：readOnlyExtensions关editable时只提供aria-readonly，没有让普通div可聚焦；原revealLineRange的editor.focus()失效。这是共享UI primitive问题，不是range数据或调度故障。

全仓调用包括FileEditorPane（Source绝对路径和导航保留阶段只读）、CodeArtifact非editable代码、FilePreview文本、Notebook代码单元，均用唯一CodeEditor。现有CodeEditor路径没有UI测试；未扩大扫描其他组件。CodeMirror[官方只读示例](https://codemirror.net/examples/readonly/)明确关闭editable会失去焦点入口，应在contentAttributes提供tabindex来保留键盘交互；第一次open网页403，随后官方域搜索得到当前示例全文，依据为官方文档而非讨论推断。

只在原readOnly compartment增加tabindex=0；原EditorState.readOnly、EditorView.editable(false)、aria-readonly与文件权限继续控制编辑。writable时不设置tabindex，沿CodeMirror原可编辑焦点入口；动态reconfigure使用同一当前扩展，不加window监听、影子focus/另一个renderer或新host gate。没有改变接口、错误、路由、Source事实、资源/位置身份或LLM请求。风险是只读控件加入正常Tab次序、临时reserved状态仍可阅读但不可改；实际本轮Source跳转/键盘移动/搜索/返回需重建后确认，其他artifact视觉矩阵不能冒称通过。

CodeEditor现身份分隔中有一个实际NUL字符，使Git将源文件当二进制，妨碍本次文本review。只将该字符的源码表示替换为JavaScript的\\0转义，运行时仍同一个NUL分隔，不变身份/公共契约；修改前保存原文件、审查既有差异为空，技术表示修复限定在本任务同文件。UI修复无自动化测试，只types/build和当前自己页面刷新/人工截图；原固定15分钟预算不延长。

## 本轮结果和未满足要求

焦点入口修复后的真实Home/同一引用重定位/224高亮末尾/编辑器搜索/Tab入口/27范围通过，main-DpnD4XG1.js，types0/build53.27s/0。整个Dock关闭重开在首次16和同一服务第二页面17/18均停225附近且焦点Source，18布局已可见非inert，明确失败；不以build/native0冒充通过。下一轮对同一CodeEditor隐藏measure/latch/visibility与所有共享消费者完整分析后修复，不延长本轮预算。

自己109/110关闭、sole shutdown、原前台69420 actual0；Native03:09:22.198/0早于固定03:12:35.068。12核心表/12生命周期与原项目文件属性完全相等；原目录外代码全文/元数据相等。原全部历史、Source范围和失败图片保留，持续目标active。
