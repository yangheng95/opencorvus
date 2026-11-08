# 文件重命名后的键盘接续

## Recall

用户要求持续按批并行体验UI（User Interface，用户界面）/UX（User Experience，使用体验）、调查功能与缺陷，先根因/影响分析并落盘，真实桌面/ui交互、截图人工复核、聚焦正向功能测试及获授权时的GPT-6.1 Sol验收，范围提交、上游合并和正常推送后继续，直到明确停止。上批1474bfa1d已正常推送；本批开始HEAD/upstream 0/0、git status --short原177条逐项保持、暂存空。Sol凭据授权继续待答复，本批预算零模型/零消息，不使用凭据。

functional/ui子代理并行只读调查文本文件读/写/下载/移动、检索定位与工作台焦点，禁止再次委托。已有UTF-8（Unicode Transformation Format，统一码转换格式）/BOM（Byte Order Mark，字节序标记）/混合换行、保存revision（内容修订）、格式化回执、冲突比较/采用基准、原草稿下载和CodeMirror查找均已有近轮修复/正向验收；没有确认新后端缺陷，不据旧线索改保存合同。两代理共同指出显式rename后的行退休与键盘接续值得实页检查；Markdown章节fragment导航仅为另一未证候选，不混入本批。

主代理已读FileExplorerPanel目录/搜索资源、行键/虚拟化/focusRow/settleRowFocus、所有applyMoveResults调用（rename、move、剪切移动）、mutation owner/刷新回执；FileWorkbench真实移动结果与编辑文件映射；SearchField.inputRef、AppDialog服务/Host、Dialog关闭焦点与动态returnFocusTarget；当前07-panel键盘合同、10月31日文件/父目录改名草稿与取消焦点记录、11月3日树导航和11月6日模态关闭归还。全仓搜索focusedRowKey/pendingFocus/focusRow/renameItem、同语义操作和当前记录。触及测试仅纯服务/HTTP（Hypertext Transfer Protocol，超文本传输协议）合同，未发现UI自动化，不新增/运行UI自动化。

## 修改前根因与影响分析

候选现象是用户键盘打开文件行菜单、确认改名后，旧行按真实path-key退休，可能落到BODY或失去对新行的键盘接续。当前尚未真实确认；Virtualizer（虚拟列表）和Dialog（弹窗）的实际顺序必须现场核对，不能由setFocus代码缺失直接宣称复现。

直接流：renameItem先showAppDialog输入，确认后moveFileItem按真实File.move receipt（回执）更新文件/后代映射；applyMoveResults据previousPath/path/node更新展开、清缓存、选择和selectionAnchor，再refreshFileViews等真实目录/当前搜索回执。旧行键包含连接权限、目录、selection epoch（选择轮次）、行种类/物理类型/真实路径，改名按合同退休；focusedRowKey失去当前row后effect只清旧pendingFocus和key。

数据不缺：公开move回执已有新相对/绝对路径、类型和名称，不能为焦点新增后端ID（Identifier，标识符）或双源。当前focusRow/settleRowFocus已经唯一拥有key/origin/scope、真实列表可见性、虚拟滚动和节点测量交接，不能刷新前塞入尚不存在的新key（会立即退休），也不用定时器、DOM（Document Object Model，文档对象模型）轮询或新全局focus监听。

旧路径未覆盖原因：当前07-panel明确跨rename、过滤/虚拟窗口退休不承诺旧行身份存续；10月31日修复的是直接/串联取消及未保存决定的原调用焦点、草稿/路径归属，不能将其成功改名数据验收当成本批“成功后聚焦新行”已实现。此项若成立是显式操作后的UX补全，不误报为稳定行键合同已失效。

风险在两个既有生命周期交接：AppDialog结果Promise可能早于原关闭焦点回调；目录/搜索刷新可能先后完成。共享Dialog已有动态returnFocusTarget和当前焦点保护；不得仅在await后假定旧确认按钮已卸载，也不得无条件抢走用户已转移到搜索/编辑器/其他控件的焦点。具体顺序尚未知，前态后定稿复用方案。

影响以Explorer当前显式rename为边界，搜索仍命中和退出命中、目录/大小写改名、取消/失败必须区分。applyMoveResults还服务移动/剪切，保持它们的数据/选择/刷新语义；不把无需求焦点策略扩散到所有变更。搜索结果因新名退出当前query时没有新行，应该给当前搜索框这样的稳定入口，不改query或伪造结果。仅在当前scope/query/活动面和成功刷新仍有效时接续，失败读/退休操作保留原错误合同。

目前无Task/Mission/Session（任务/多步任务/会话）调度、队列、唤醒、执行恢复或终态异常事实；这是待核的单次显式UI操作焦点，不据其推断后台执行异常。无API（Application Programming Interface，应用程序接口）/SDK（Software Development Kit，软件开发工具包）、权限、配置、schema（数据库结构）或持久格式变化。纯UI若修复不写自动测试；原功能/数据必须用实际文件/回执验证。

## 前态与实施方案（实页后定稿）

新私有临时根opencorvus-iteration-20261108-b10、全新OPENCORVUS_HOME和自有项目，before38936/after38937，开发serve /ui。自有a.txt/b.txt有不同短正文，另外目录nested/note.txt作父目录对照；不使用用户文件或消息。

实际从Home Browse files进入，使用行键盘菜单Shift+F10→Rename→输入→确认；先a.txt→aa.txt，观察稳定后焦点和新选择，再ArrowDown/Enter核对b.txt正文。取消、大小写改名、搜索仍匹配/退出匹配及父目录分支按实际目标取证；实际HTTP/磁盘核对新路径、正文和原字节。若当前已正确接续，应记录否证而不强改产品。

若前态成立，复用真实移动回执和刷新后的rows/原focusRow，以及共享Dialog动态returnFocusTarget处理关闭交接；SearchField已有inputRef可提供过滤后稳定入口。只补当前rename的操作焦点，保留其他控件新焦点和所有失败/取消语义。具体实现必须在补齐关闭顺序证据后先更新本方案，再改产品；禁止先写setTimeout补丁。

after需新普通构建/新实例，真实重命名和箭头/Enter继续、中文/英文、取消/大小写/搜索退出及必要目录/虚拟滚动，截图人工复核。类型/语言/build/renderer和docs/architecture仅辅助，不代替视觉。本人服务正常shutdown、原启动句柄exit0，文件全为私有项目；范围提交、上游合并、完整待推审查和正常推送后继续。

## 前态与最终决定

已真实复现：Shift+F10→Rename→a.txt改aa.txt，稳定后成功提示、新行和原正文均正确，但document.activeElement为BODY；继续真实Down/Return仍停BODY，文件编辑器没有打开。截图03与before-renamed-file.json分别记录界面和HTTP 200/真实磁盘正文。最初取证误用了目录/file入口，已改用现有/file/content重新取证，不能把前一份status=0当成功响应。

两代理只读复核确认：不把移动塞进onConfirm（未保存决定可能再次打开AppDialog）；不改共享Dialog。functional代理进一步核对本地Kobalte实现：hide-outside/trapFocus按isOpen立即解除，而关闭autoFocus自身延迟到清理后的回调，因此showAppDialog结果已确认open=false时，旧弹窗节点仍在不代表背景仍不可聚焦。使用现有dialogOpeningFocusTarget仅能解析已关闭Dialog的真实返回owner，拒绝尚打开的新弹窗。

实施定稿：rename开始捕获规范真实打开者及原query；returnFocusTarget初始保持原打开者，成功后仅替换为当前真实刷新得到的row元素或原搜索输入。作用域、活动面和query变化使该getter返回null。refresh完成后，先确认当前焦点为原打开者/BODY，或经共享helper解析仍归原打开者的关闭弹窗；再更新动态目标，并以实际activeElement为origin调用原focusRow。只把其origin参数扩大为Element，虚拟滚动/keepMounted/测量/用户焦点保护继续由现有pendingFocus持有，不增加计时器、监听器、平行行表或新的共享弹窗API。

当前目录模式必须拿到新父目录loaded回执；搜索模式必须拿到原query的loaded回执且即时query/deferredQuery一致，再从当前rows按真实move.path找行，避免复用旧路径或猜key。原query下新行退出匹配/当前80条窗口时动态返回同一SearchField.inputRef，保留query。取消、失败、同名维持原返回者；移动/剪切等调用不变。风险重点是快响应时旧关闭节点仍在、排序跨虚拟窗口、搜索退出及新用户焦点；在新隔离实例逐项真实交互核对。

首轮after实页发现仍为BODY（截图04保留为失败迭代，不命名为通过证据）。新行aa.txt已注册、visible、矩形402.5–434.5完全处于列表242.5–689.5内，scrollTop=0。代码进一步确认applyMoveResults清根缓存会先卸载Virtualizer，再以新rows重建；focusRow在新handle初始viewportSize尚为0时将请求标成waitingForScroll，而现settle只等onScroll。完全容纳七行的小目录没有真实滚动，实际测量发布也因waiting标志提前返回，形成UI虚拟焦点未结清。不是文件移动/后台Task调度故障。

横向搜索全部waitingForScroll/pendingFocus/scrollToIndex生产调用：该等待标志仅FileExplorerPanel拥有，普通方向键与本批改名共用；原式针对已测量列表导航，未覆盖刷新后重建。修订仍落在同一settleRowFocus：测量回调拿到当前连接、visible的新行后，如其真实矩形已完整进入同一列表视口即可结清waiting；真实屏外目标继续等原scroll事件，不用假scroll事件、时间阈值或独立焦点状态。补齐新实例小目录及100项排序跨屏真实验收。

## 最终实现与真实验收

最终仅修改FileExplorerPanel和当前07-panel合同。沿用本次真实移动、required refresh、当前rows/rowElements、pendingFocus与共享Dialog helper；当前行身份仍因真实改名退休。没有新增UI自动化、后端API、配置、消息、模型调用或持久格式。

最终普通构建main-DocOXfvP.js（52.03秒）在新进程38938的/ui、桌面1280×720人工交互：

- aa.txt→aaa.txt后焦点BUTTON/aaa.txt（05），不再手动定位新行，直接Down/Return打开b.txt，界面显示独立Beta note正文（06）。取消后归还aaa.txt。
- 原查询aaa下改aaa-renamed.txt，新结果行焦点正确（07）；再改alpha.txt退出匹配，聚焦同一个Search files输入，值aaa保留，空结果正文正常（08）。Escape清查询后真实目录重新显示。
- many真实100个文件，第一项entry-001.txt改zed-entry.txt，实际scrollTop=2817，新行657.5–689.5完整进入列表242.5–689.5，焦点many/zed-entry.txt（10）；直接Enter打开Entry 1。原件HTTP 200/磁盘正文同样为Entry 1。
- alpha.txt改已有b.txt，实际PATCH 409 FileConflictError，真实请求ID和完整Details可见（11），原行alpha.txt持焦点；无成功交接。alpha与b原正文分别保持。
- 展开nested后改renamed-folder，新目录行持焦点且note.txt后代仍展开（12），直接Down/Return打开Nested note，HTTP/磁盘后代路径一致。
- note.txt真实编辑为Nested draft / Authored before rename.；父目录改名触发原Unsaved changes，Keep editing后归还原目录行，File页草稿与可用Save保留（13）。再次改Renamed-Folder并Save and continue，实际保存草稿，Windows物理目录精确名Renamed-Folder，HTTP/磁盘均为草稿正文；既有编辑器成为活动面并持有DIV焦点（14），本次保护条件不强行抢回Explorer。
- 只在本隔离页面设置中文，再alpha.txt→笔记.txt，成功反馈、导航、搜索、控件和键盘提示均中文，文件身份保留真实中文名，新行持焦点（15），HTTP 200和磁盘仍为原Alpha正文。

共14张截图均已人工查看。01–03为前态；04明确保留首轮未通过；05–08、10–15为最终构建。09抓到菜单/弹窗过渡动画，无独立证明价值，已删除本人产物，不作为验收。observed-focus.json保存各实际焦点/矩形读数，仅观察记录，不是UI测试。

聚焦纯服务正向合同：test:unit file-workbench-refresh 6测试/20断言、file-workbench-mutation 27测试/87断言通过。它们隔离transport/decision，仅证明原数据合同；不冒充本次真实页面验收。最终overlay typecheck、check:i18n（2语言2914键）、build/renderer surface、根docs:check（352操作26组）、architecture-index通过。构建既有上游注释/use-client/大chunk提示未阻断本次产物。

未人工覆盖：等待期间真实用户另移焦点、API authority轮换/跨项目退休、搜索超过80条后新名掉出窗口、真实刷新失败；相应scope/query/可见性/当前activeElement保护已按代码复核，两代理均未发现必须修正项。不将这些分支包装成端到端通过。Sol凭据待授权，零模型、零消息，不以纯服务测试替代Sol验收。

自有38936/38937/38938均正常POST /shutdown，原启动句柄73827/11565/46381分别exit0；自有IAB 21/22/23全部关闭，未操作用户窗口/进程。提交与推送前按原177条工作区逐项核对，索引只取本批路径及三个README自身新增入口，保留用户既有修改。
