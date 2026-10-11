# 289 编辑器语言与当前可访问名称

## Recall

用户持续要求自主发现/修复UI与功能问题，重点Sources和Rendering；最新只用单agent，只有root，旧goal并行/Astra口径不生效。288已实际修复只读状态、查找控件深浅主题，b34e232ac已推送；本轮开始HEAD与该提交一致且工作区干净。不创建新成员、Task、分支/worktree，不操作用户窗口或进程。

288真实07中文浅色页面中，只读/主UI已经中文，而CodeMirror仍显示Find/next/previous/match case等英文，保留挂载的编辑器AX名称仍Editor。其09已恢复本独立origin的English/System，tab26及原前台13049/Native已实际收尾，本轮不复活该实例。新修复以此当前HEAD真实截图为前态，不造Source、HTML或组件夹具。

已读AGENTS、288 Recall/结果、CodeEditor、DiffArtifact、i18n localeSeq/t/配置入口、当前07-panel及263焦点/266来源决策。全仓new EditorView/new MergeView/overlayCodeEditorExtensions/contentAttributes/phrases检索确认仅两个创建入口；CodeEditor还服务文件、代码产物、预览和Notebook，Diff有两侧view。聚焦测试搜索没有发现该路径的UI自动化，不新增或运行UI测试。继续使用已应用benchmark-debug-template真实分析/复核流程，用户UI验收要求优先。

## 根因、官方契约与影响

应用locale通过现t读取appStore.localeSeq驱动响应式更新，但两个CodeMirror创建入口均未提供EditorState.phrases，库只能显示内置英文。CodeEditor的ariaLabel仅在onMount添加一次contentAttributes，现readOnly compartment后续更新不包含名称，故保留view的名称不随上游locale/ariaLabel变更。这是宿主UI与第三方编辑器配置连接遗漏，不是翻译文件加载、Source数据或权限故障；288主题token和Badge修复未涉及文案配置。

查阅安装的官方@codemirror/state/view/search/language/autocomplete/lint/commands类型与实现；[官方翻译示例](https://codemirror.net/examples/translate/)和[参考契约](https://codemirror.net/docs/ref/)提供phrases facet与Compartment.reconfigure。现view实现检测phrases变化后用新state重绘，searchState仍持有查询/选项并用于重建原SearchPanel，不需宿主复制搜索UI、手动改库DOM或关闭重开面板。查询/阅读是否实际保持需当前真实页面证明，不能由源码推断通过。

## 唯一实施方案

增加共享UI createCodeEditorLocale，用现t和单一两语言catalog构建库内置查找/替换、跳行、折叠、补全与诊断的phrase映射，通过每个组件自己的Compartment配置其真实view。两个重复入口共用映射和响应式配置动作；初始extension与后续memo同一身份，已配置时跳过无意义重绘。没有第二语言偏好、缓存副本、英文后备实现或私有DOM更新，也不改库搜索/选择/编辑行为。

CodeEditor在既有readOnly内容属性中同时提供当前ariaLabel，移除mount独立旧名称配置；名称与只读/focus属性由同一个当前compartment更新。现文档、查询、选择、语法和引用状态仍由CodeMirror state拥有。Diff同样接入共享locale；其真实产物视觉样本当前未取得，若本轮未观察不得冒充已验收。协议/模型/持久数据/文件写入/调度配置均不改；若发现并发/恢复/终态异常，须立即按共享机制横审。

纯UI改动，仅聚焦类型/构建/catalog结构与人工真实页面，没有DOM、源码文案、组件、快照、UI自动化或镜像单测。同步07-panel当前契约与root/月/本目录索引。

## 当前真实验收与收尾

原265自然Main Session/两条真实文件Source完整历史作为数据，引用仓库公开tool/read.ts，保留所有原身份、目录和生命周期。新editor-locale-289-history-01，正常dev/ui18237，先完整沿288修正后guard/readiness/admit/90表逐行相等copy；源Runtime精确出生死、原凭据对退休、schema/config/全部恢复入口/消息/权限/记忆/租约当前重新核对。构建和准备在启动前完成，不移交auth/models、不发Provider请求。

Root打开范围Source和查找，填写真实查询与选项；在自己页面Settings切中文，返回后当前编辑器和已打开搜索面板须中文、查询/选项保留，原文件/定位/阅读继续可用。实际previous/next、跳行等在有真实入口时检查；再切回English并确认当前名称与查询恢复语言但不丢值。原文件全文/metadata必须保持，不保存编辑。普通项目文件及Diff/替换/屏幕阅读器软件未采样则明确保留，不能用编译冒称视觉通过。

原生900000ms固定资源寿命，目标前10分钟完成UI并关闭，至少5分钟收尾余量；不延长或因观察超时重启。sole shutdown→原前台实际join→独立物理输出请求/出生/端口/pair→18核心表/12生命周期/源码全文保管，所有checker退出后才精确移动自产物。公开证据凭据扫描、当前docs/architecture检查、范围提交、fetch/merge上游/完整待推送审查和普通push。全部目标仍active，不宣称原ResearchStudio/新live/全帧Rendering/其他未验矩阵完成。

## 真实语言切换后的阅读位移与追加方案

289当前英文→中文：查找、选项、原query和aria-label均正确，原02阅读top1585.333至03top1740.667，但初次wheel仍可能未稳定，因此未直接定因。随后键盘导航后的两次观测top5813.333一致，05图片在约203–221行；切回English后06实际top6544.667，约248–259行，query/大小写选项仍保持。稳定样本确认语言配置有阅读位移，不能交付为阅读保持。

安装view源码在phrases facet变化时提前return setState(newState)，setState重建ViewState/DocView和高度信息；普通同transaction的滚动effect处理循环位于该提前返回之后。因此只用配置事务保留了文本/query，却没有明确保留旧阅读锚点。官方scrollSnapshot返回与同一文档绑定的滚动effect，适用于这种状态配置变更；不是宿主另存阅读状态。

共享locale更新先从全部当前view捕获官方scrollSnapshot，再逐view同步配置phrases，随后独立事务应用其快照（不能合在被提前跳过的配置事务里）。两侧Diff先全部捕获再改变任何一侧，仍用各自同一view/state，不创建新editor、平行滚动缓存、事件listener或自动Source重定位。文档在同步调用间保持同一个内容，库位置effect负责后续测量。该变更是共享UI配置路径，不涉及Task/Mission/Session调度、队列或持久终态；本轮这些事实均已当前完整核对闭合。

原01–06失败/成功混合证据全部保留；重新构建后仅刷新自己tab27，并在同一固定15分钟实例内重新验证稳定阅读位置、query/选项、中文名称与返回。若新结果仍不满足则不得以源码或类型检查代替，按既定实例寿命收尾保留未验。

## 第二次真实失败及语义身份分析

第二版仍位移：07真实约203–221行/top5852.667，08中文约249–262/top6592。09→10只进入设置再返回、不改语言，top638.667及约20–37行保持。11真实DOM只读观察显示设置页期间祖先visibility:hidden，但宽380/高度481保留，并非display:none或尺寸归零。因此不能把普通设置往返或尺寸归零当根因。

继续全仓查语言入口：Appearance、CommandPalette、两处Titlebar都走applyLocalePreference；它先写settingsStore.locale，main的现reactive setLocale同时观察，preference路径还会直接setLocale。init与bootstrap也会应用当前语言，worker有独立文档上下文。setLocaleState每次递增localeSeq。新locale helper把每次seq观察直接构造成新的facet provider，即使所有译文相同也重新setState；这与普通Solid文本基于字符串身份去重不同，会在前一次CodeMirror布局尚未完成时再次捕获重建中的滚动信息。当前新helper对“实际词典变化”的身份定义过宽，是本轮引入的重复配置源。

修正唯一helper：先以完整phrase键/值直接相等作为memo身份，再创建phrases extension；同译文事件不产生新的CodeMirror配置，实际不同词典仍经同一个Compartment更新。不是按locale名字跳过加载/错误，不改变全局语言偏好、队列或持久化，不增加第二词典；快照仍由官方同文档effect负责。全局语言入口已横向审查，此处消费同值事件不能等同于Task/Mission/Session调度异常；这些当前持久化前沿均闭合，未观察到模型/队列活动。全局语言偏好并发/回退宽矩阵不由本轮推断通过。

第一实例自身tab27关闭、sole shutdown及原86553 actual0，独立archive/18表/12生命周期/源码全文通过并已保管5自产物。Native寿命未延长，关闭仍早于15分钟deadline；本次未达到提前五分钟目标，精确差额以原收据记录，不能被下一阶段覆盖。

后续为新实现版本的独立验收editor-locale-289-after-02，正常dev/ui18238，fresh after-readiness/完整copy，构建和准备全部在启动前完成。不是因观察超时重启旧服务；原失败实例永久保留。只验证改动后的语言/阅读往返和实际功能，尽早关闭并保留5分钟余量。

## 第二实例当前结果与可编辑分支

after02英文→中文仍显示原约203–221行及同一匹配词，query和大小写选项保持，Editor名称转为编辑器。scrollTop从5852.667变5424是库重建后的高度估算差异；实际图片的同一内容锚点才是阅读资格，不强制像素值恒等。中文跳行对话框与实际跳到27通过，切回英文仍在约20–37行，query/选项保留。

当前通过Add tool→Files打开原Project的真实README.md（原46bytes一行标题）。计划在这同一实际可编辑文档用原生Replace将Isolated改Reviewed，只在编辑器draft中观察，再切中文核对替换控件、draft和query保留，最后用编辑器Undo恢复原全文、回English。全程不Save/不写文件、不制造新Source或模型消息；原项目文件metadata及原源码全文仍在结束后核对。如出现导航确认先保留草稿、按当前UI处理，不丢弃未知用户工作（本服务只有本轮自己的页面）。

## 本轮最终状态

最终main-Ct2CPS3b.js的真实只读语言往返、当前编辑器名称/查询/选项、同一可见阅读锚点及中文跳行通过；可编辑README实际替换草稿、切中文保留、Ctrl+Z恢复、切回English均通过。原文件未Save，18核心表/12生命周期、项目文件属性及引用read.ts全文均完整保管。两自己的页27/28关闭，原86553/2548实际join0；第一实例余279268ms未达到5分钟目标，第二余412062ms达到。两独立archive与所有checker实际完成后才归档各5自产物。

最终build65689 actual0（53.35秒）、types56120 actual0；catalog2语言2119键。没有UI自动化。当前docs/architecture、公开扫描、范围commit/上游merge/push为剩余交付步骤；Diff等未采样场景详见[README](editor-locale-289/README.md)，整体goal继续active。
