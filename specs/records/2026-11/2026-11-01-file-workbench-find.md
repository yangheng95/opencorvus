# 文件工作台查找与焦点归属

## Recall

用户要求预览普通弹窗修好后继续迭代，只用一个agent，自主排查UI/UX（User Interface/User Experience，用户界面/体验）和功能，真实体验后提交推送，不能操作正在使用的窗口。852普通预览与854元数据查找均已提交推送；本批从9086a6146继续，不委托、不接触18571服务/窗口，不改变用户数据库。开始git status有177项其他工作区状态，全部保留。

已读854 Recall、828文件重命名/草稿验收、当前07-panel文件工作台/键盘合同、FileEditorPane加载/保存/Source-Preview、CodeEditor创建/销毁/语言与定位、App的ChatViewTitle全局Ctrl+F及唯一调用点、main Dock文件装载、file-workbench导航所有权。全仓搜索查找命令与键盘消费者：主对话只有App窗口级Ctrl+F；CodeMirror basicSetup自带文件搜索；文件区目前仅接管保存。现有@codemirror/search已直接声明，不新增依赖。官方文档站403，核对[官方search源码](https://github.com/codemirror/search/blob/main/src/search.ts)的openSearchPanel命令及原键盘映射，确认应直接调用现有编辑器命令。

## 修改前分析与未知

可观察问题尚待本批真实页面确认：Markdown预览区的Ctrl+F会冒泡给窗口级对话查找。源码触发点是FileEditorPane只有Ctrl+S处理，CodeMirror虽保留但hidden；App只检查当前item和dialog，没有当前主区域/设置可见性约束。直接键盘事件与编辑器作用域断开，而不是文件内容或索引缺失。旧Source编辑器可用的查找并不能覆盖预览/文件工具栏焦点，因此旧路径没有根治该体验缺口。

影响面为文件工作台文本/Markdown预览、主对话搜索在其他主区域/设置打开时的键盘归属、CodeEditor装载与清理、两语言控件和当前架构文档。查看全部CodeEditor消费者后，仅文件工作台发布查找入口；其他消费者保留本身现有搜索。没有服务接口、SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、持久格式、模型目录、LLM（Large Language Model，大语言模型）请求/消息或调度改变，执行队列/恢复横向审计不适用；当前未发现此类异常。风险为切换Source丢失草稿/撤销、引用销毁后EditorView、加载或换文件后异步聚焦错误、只读文本误开放写入，以及窗口级监听抢夺其他区域焦点。

## 实施前方案与真实验收

先从已退休854-after完整QA（Quality Assurance，质量保证）库备份启动38502开发serve的/ui，使用原827空闲Work（ses_-zUQOZSwyzz3zVNCFWmY）和独立后台页，通过真实新建入口创建notes-855-before.md，不修改旧验收文件；编辑、保存、追加草稿、预览、Ctrl+F并截图。另对Source查找和设置/其他主区域键盘作实际对照。若未复现则不按假定修补。

确认后采用一个现有CodeMirror搜索面板：CodeEditor在实际EditorView存活时发布可调用命令并在清理时退休；FileEditorPane新增双语查找按钮，Ctrl+F在文件作用域调用同一个动作。预览主动切换回同一Source编辑器，再打开原搜索面板；不重建文档，不另存查询/草稿，不合成键盘事件。实际可见主对话才允许窗口级搜索；只有实证支持时实施该可见性修复。所有权/资源/导航边界复用现有target、generation和API（Application Programming Interface，应用程序编程接口）authority。

每批60分钟绝对期限，候选不延长；启动余10分钟、结清余5分钟。配对复制已授权OpenAI认证和完整models目录，分别验证Provider/精确gpt-6.1-sol投影，新增模型请求上限0、累计1180。保护原schema9/92表、234309行、140附件、62项目旧文件/Git和9Goal。仅允许当前真实新建的notes-855-before.md/notes-855-after.md带来明确新文件状态，不忽略整个项目或前缀。每轮对新文件期望字节、公用读取接口和原业务数据逐项核对。

候选普通构建/类型/两语言检查后，38503新独立发生轮次创建notes-855-after.md。真实中文/英文查找按钮及快捷键、预览→Source、重复词前后定位、Escape关闭、撤销/重做、草稿保存/重新打开，截图人工复核；未发送消息/启动Goal。禁止新增或运行UI自动化测试；聚焦数据检查不能替代实页。

关闭自有页面与服务，原exec/native/launcher、公开shutdown、物理/输出/请求/出生身份完整结清后退休auth/models副本。同步三索引和当前docs:check。范围提交，fresh fetch及普通merge，审核完整待推集合，正常hooks push和远端回读；独立并行变更不等待，不混入提交。Goal继续active，后续自主迭代。

## 本批修改前实证与范围确认

38502/main-B5pEdU0R.js自有71页，真实Ctrl+K定位原827 Work，Explorer新建notes-855-before.md，保存初稿再追加Draft855。01预览区Ctrl+F实际打开对话查找/0消息；02同一Source编辑器的原查找面板正常；03设置General页Ctrl+F同样被隐藏对话抢占。物理文件与公开file/content返回完全相同149字节最终稿。确认修复两处键盘归属和文件查找发现性，使用现有CodeMirror命令而非第二套查询。全部六个生产/架构路径修改前差异为空并已保存。原文档/附件/会话不改写。

基线shutdown第一次误用Windows PowerShell 5运行只读进程观察器，因其ProcessStartInfo.ArgumentList不可用而失败；未发出关闭请求。改用仓库当前pwsh重跑同一真实checker后公开shutdown200、原句柄54643及native/launcher均0，物理/输出/请求完整结清，无产品脚本兼容层或期限延长。

## 实现与真实验收

三个UI（用户界面）组件改动共用原编辑器：CodeEditor发布/退休当前存活view的openSearchPanel动作；FileEditorPane的双语头部按钮和本区域Ctrl+F共用searchFile，预览先回Source，微任务校验原文件、加载轮次、API authority及同一动作后再聚焦。没有平行查询或第二个编辑器。App唯一ChatViewTitle调用提供当前区域active，隐藏主对话不注册有效查找入口，已有搜索也随区域退休。英文/中文共增加一个键。没有数据/Provider/后端/调度接口或依赖变更。

38503/main-D3gqrsEQ.js自有72页，真实Explorer新建独立notes-855-after.md，保存初稿再追加未保存草稿。04预览完整显示Draft855；05—06预览Ctrl+F回到同一Source并聚焦Find，Alpha855前后命中第3/5行。Previous/Escape后07 Ctrl+Z恢复保存基线，08 Ctrl+Y恢复完整草稿，证明原编辑历史保留。09头部查找按钮恢复同一查询与输入焦点；Ctrl+S保存后真实关闭并从Explorer重开，10内容完整。公开file/content和磁盘逐字节匹配149字节，两文件均独立保留。

11设置General页Ctrl+F保持设置搜索焦点；切换中文后12文件按钮/搜索面板中文且Draft855定位第7行。13 Mission看板Ctrl+F保持当前区域；14回原Work后中文对话查找正常。15重新打开保留的文件区域，从中文预览按Ctrl+F仍恢复同一文件查询及焦点。全部15张实图已实际呈现、亲自查看。未对只读绝对来源、其他文本和二进制作本批实页重放，不扩大验收结论。

类型、当前package的check:i18n（两语言2676键）、普通build及renderer公共面检查通过。首次错误调用不存在的i18n:check，原失败结果保留，按真实声明重跑通过。纯UI改动没有新增/运行UI自动化或以源码/DOM文案代替行为验收。候选保全检查首次只因预期新增文件追加位置与Git排序不同失败，修正为精确旧状态加唯一新增路径后按Git顺序比较；原文件字节/HEAD/ref/index和其他项目状态检查没有放宽，原checker重跑通过。

基线234309→234401，候选234401→234493，schema9/92表不变，每轮三条新event经bus_outbox_id关联唯一outbox，确认为file.edited；增量为这些真实写入发布、收据及租约。原始行所有业务列、源库、140附件、62项目旧文件/Git完整保留，无项目排除；仅本批新建的两个notes文件形成明确新文件状态，均149字节。九个原Goal公开事实逐字段一致。新增模型请求0/累计1180，配对四份auth/models副本退休，源认证元数据、目录字节和元数据保持。

两个服务原exec 54643/38146、native/launcher均0，公开shutdown200，物理/输出/请求及出生身份结清；余3448212/3028093ms，原855绝对期限未改。自有71/72页关闭、受控库存为空。没有操作用户窗口、18571服务/页面或用户数据库。完整图像与机器可读数据见验收目录；按授权继续收敛提交/正常推送及下一轮迭代，Goal保持active。
