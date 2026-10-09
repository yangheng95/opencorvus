# 232 工具标签键盘与关闭焦点

## Recall

用户要求持续自主修复UI（User Interface，用户界面）/功能/Sources与Rendering；最新仅单agent，不委托。231已推送9df5b4a1a，5个真实Sol stream EOF/Native及foreground0，起始干净；前轮为真实进展。231验证共同文本主会话，live子侧栏和Tauri仍未知。用户IAB（In-App Browser，应用内浏览器）23/18107不操作，无新branch/worktree、Release或模型调用。

本轮线索来自229未selected tab aria-controls=null及实际定位失败。已读229/231 Recall、07-panel工具owner合同、Tabs全部透传、RightDock的reserved/open/overflow/tabCollection和close事件、main增删/选中/reset/10个panel定义及Kobalte0.13.11安装源码。当前Kobalte Trigger明确仅selected时设置aria-controls；Content通过同一context登记id。不能把库行为或locator失败当作产品根因。公开资料：[WAI-ARIA（Web Accessibility Initiative Accessible Rich Internet Applications，网页可访问性角色规范）Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)与[Kobalte Tabs](https://kobalte.dev/docs/core/components/tabs)；文档当前0.13.14不冒充已装0.13.11。Root不修改库或新造ID映射；所有当前Tab/TabPanel调用亦包括ConfigDialogHost和ExpertSquadPanel。第三方包内附测试不属于本仓库UI检查路径，不读取或运行；本仓库相关UI自动化测试仍禁止。

指标：真实Browser/File标签Arrow移动焦点、Enter/Space激活、来源往返保持地址；键盘关闭当前、其他、最后标签后焦点仍有可见合理下一步，焦点不被异步取消/其他操作夺走；英文/中文可见focus人工截图。如需修复，保持原tabs事实/selection/close/reset及dirty-file确认，不通过prewarming/第二tab或URL缓存解决。完整范围包含固定File和动态Browser，异步关闭与取消也必须分析，不能只遮蔽一个控件。

## 修改前分析边界

已知数据流：Kobalte manual activation→RightDock onSelect→main canonical centerWorkbenchPanels/selected ID。remove选择邻近原record；动态Browser从For卸载，固定File仍在reserved集合变为隐藏。RightDock close按钮当前仅调用onClose，未见明确focus return。浏览器同步删除与File runUserNavigation/closeFileEditor异步不同；焦点实际去向未知。原229只保留Browser owner寿命，没有关闭焦点修复；inactive aria关系属于库当前定义，辅助技术影响未知，不擅自旁路primitive。

当前不准入生产修改；先实际页面。共享影响/公共接口/数据/测试/文档/风险待实际触发补全。UI禁止新增/运行自动化测试和源码文案/DOM（Document Object Model，文档对象模型）断言。没有新调度/并发/终态异常；若发现立即全Task/Mission/Session共性审计。非UI契约改动若发生须聚焦正向测试，类型/构建不是视觉验收。

## 当前独立准入与验收

原Source使用231完整自然runtime：Rsource=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/render-stream-231-live-01，Esource=B/render-stream-231/live-01，root Session ses_-zUSSQjEPzzcHPHmHT48 / Project prj_hiXMQlf8gddMQG4rcDHg / 原project目录。原host62996、target69788精确birth已关闭且paired auth/models清理；readers EOF、原Native0不替代新fresh准入。

先只读Config.snapshotForProject、schema、所有Task/Mission/Session/请求/发布/交付/immutable ingress/current lease/capacity/permission/checkpoint/memory/14恢复前沿、两个Project及完整runtime库存并人工审查，再全90表逐行相等copy，原ID/目录不替换、不移交凭据/模型、不删恢复前沿。fresh R=.../tool-tab-focus-232-before-01，18160，B/tool-tab-focus-232/before-01，成熟history普通开发serve `/ui`、当前main-DuXM4N1d.js HTTP（Hypertext Transfer Protocol，超文本传输协议）200和Native固定900000ms，不延长/rearm。

新own IAB打开真实231会话、自然File来源、通过现有菜单创建Browser；真实原地址输入/Tab键/Arrow/Enter/Space/关闭动作与实际截图人工查看。DOM focus/ARIA只读诊断辅助截图，不注入状态或造消息。仅此agent，不启动子agent；用户23不动。如观察失败先关闭全部own页/sole shutdown/原foreground与Native actual0、physical/output/request/pair/独立birth/port、13表canonical全行及Project属性差异，再补根因/精确preimage、源码与类型/build/docs、新的after独立同自然历史复核。

预备完整closure/custody/自己birth5文件精确单独归档，在所有observer/检查器终态后执行。错误真实保留；如未复现不改生产。spec/root/月/B索引、docs:check、范围commit、fetch/merge upstream、完整待推送集合及验证、正常push；持续单agentgoal active。

## before-01实证和实施前完整分析

原231完整Config/schema/63与44库存、3terminal assistant、两idle memory、当前245 lease/唯一永久runtime精确birthdead、全部14恢复前沿、请求/发布/交付终态均人工审查；全90表逐行copy和原Session/Project绑定。UI66自然File来源Enter打开，真实Add Browser输入原scoped地址；ArrowLeft+Enter/File与ArrowRight+Space/Browser均正常，地址保留。Tab来到Add tool，ShiftTab回New tab；关闭按钮虽实际tabIndex0，但Tabs集合的焦点导航回到roving tab。原两张close命名图实际分别是Add tool/New tab，记录更正，不依据文件名判结论。Delete真实无动作，两tab仍open，此项属于缺少可选键盘关闭能力，不伪称WAI强制要求。

真正缺陷：09:28:12.323Z Browser close后File仍selected，实际focus BODY；09:28:59.773Z最后clean File close后chooser visible、focus BODY。截图人工查看、只读diagnostic吻合。直接触发为删除当前动态Browser或异步关闭固定File；根因是只改变canonical tabs/selection，删/隐藏原focus DOM后缺少可见focus接续。RightDock现onClose void也不能观察File确认完成/取消，立刻聚焦无法根治异步路径。旧229修owner寿命与地址，不涉及关闭Focus；Kobalteselected-only aria-controls不是本次关闭根因。

已完成接口/调用/同语义搜索：RightDockProps.onClose唯一main closeRightDockTab caller；main removeCenterWorkbenchTabs已经决定邻近selection，不增加另一个选择策略。closeFileEditor真实Promise<boolean>经现有prepare/handle/isCurrent/commit/release，cancel/连接或file revision改变返回false或报告错误。main runMainAsync/runUserNavigation目前吞掉已处理Promise，42个调用仍由同一error reporter/AbortError/ApiAuthorityChangedError归属，不新增旁路handler。FileSource绝对文件是read-only；after需通过真实Files explorer打开同一own README常规writable路径以验证dirty取消/丢弃，仅改临时draft、不保存原文件。

实施方案：现有runMainAsync/runUserNavigation返回其真实已处理Promise<void>，保持同步启动、错误report/AbortError语义；其他调用可继续忽略已处理Promise。closeRightDockTab提供单一Promise<boolean>，Browser按既有remove并成功返回，File等待同一navigation和真实closeFileEditor结果，cancel/error返回false。RightDock按钮和focused Tab Delete共用close handler，等待该结果、核查实际record已关闭后才接续Focus。原canonical selection、URL、File确认/持久化不改。

Focus intent只保留本次真实origin DOM Element，不复制tabs或另造ID映射；利用现有reflow时机及成熟createAnimationFrameScheduler，一次frame先更新overflow，再从当前strip真实selected enabled tab聚焦；无open tab时聚焦现有Add tool按钮。执行前校验owner仍存活、dock仍open、原focus仍是origin或BODY，用户已移动焦点则结束intent。取消/错误/其他仍open tab不启动return；cleanup取消同一frame，禁止旧close抢新交互焦点。Delete只处理原open visible focused tab的无modifier/noncomposition按键，preventDefault/stopPropagation，共用既有关闭行为；aria-keyshortcuts与原Close按钮title显示本地化Delete提示，保持真实aria-label。

范围为main UI异步衔接、RightDock UI事件/frame、en/zh同一locale面与07-panel当前合同；不改API/SDK/Provider/文件backend/Task或调度策略，不改第三方库或genericTabs ID协议。main helper虽返回值增加，仍是UI操作完成观察，不新增后端能力/状态机；禁止UI自动化测试，聚焦真实after涵盖双Browser/文件、最后tab、dirty取消/丢弃、用户改变focus和英文/中文focus可见。类型/build/i18n/CSS/docs仅支撑源码，不能替代UI。

UI66关闭，sole shutdown/原foreground5853与Native actual0、物理-output-request-pair完整；独立closure及13表全行相同（2/5/12、1tool、3Provider/5usage、Task0）和Project属性差异保留，匿名44相等、primary63仅.git目录mtime变化；自己birth文件在全部observer终态精确归档。才准入源码改动，before原失败保留；新的after完整独立准入/当前bundle/固定截止不延长。

## after-01补充根因与调整方案

main-CaivO4XR.js、types/build/i18n2082均实际0；重新完整231准入/90表copy/current HTTP200，UI67实测Delete Browser→File可见focus、Delete最后clean File→Add tool可见focus，Enter确实打开原Add菜单。通过真正Files explorer打开同README常规writable路径，只输入temporary draft不保存；Delete进入原Unsaved对话框，Cancel保留draft/File但09:48:26.678Z focus仍BODY。Discard则真正关闭File，09:50:10.126Z和09:50:40.053Z focus均Files tab；无blue描边的pointer截图不能当focus丢失，诊断和真实后续控件区分。首次dialog截图在过渡期，稳定second截图保留，不归因为布局bug。

取消的共享根因位于FileEditorPane程序化打开Dialog：decideBeforeNavigate由close/switch/reload共用，Dialog没有Kobalte Trigger，也未向已有onCloseAutoFocus提供原initiating control。default触发器恢复不能保持实际File tab焦点。RightDock既有新成功分支正确，false结果不应冒充关闭或在那里复制另一个Dialog恢复路径。全仓确认ui/Dialog已公开且透传onCloseAutoFocus，FileEditorPane确认结果/关闭/重新加载/cleanup已读；不修改第三方库或通用Dialog，也不改变确认结果。

准入FileEditorPane唯一cancel focus intent：真正dirty decision打开前捕获当时HTMLElement、现有activeTargetIdentity和API（Application Programming Interface，应用编程接口）authority。accepted decision清除intent，由真实下一界面/RightDock成功关闭负责focus。现有Dialog.onCloseAutoFocus阻止默认无trigger恢复，只有cancel intent、同原resource/API、owner仍在且element connected/实际可见时恢复原控件，消费intent；context变化/cleanup清理，禁止旧dialog抢新资源焦点。共享leave/reload取消使用同一程序化Dialog owner，不另建focus cache、ID映射、selection策略或shadow file state。纯UI修复不新增/运行自动化测试，after-02必须再次实际取消/丢弃、两Browser/点击关闭/最后tab及中文深色焦点。

UI67关闭且own draft已Discard，sole shutdown/原foreground15170和Native0、完整physical/output/request/pair与独立closure、13表全行相同及Project属性事实均取得，自己birth5文件在所有observer终态归档后才修改。after-01取消失败完整保留，不改成通过。

## after-02实际交付验证

FileEditorPane共享取消恢复落地，当前types/build实际0、main-DNZgW3vs.js actual HTTP200，重新完整原231只读准入/90表逐行copy。UI68 Files explorer普通README临时draft→Delete→Cancel，10:00:47.563Z实际File tab focus、草稿仍在，截图蓝色焦点人工查看。dirty Reload→Cancel，10:01:34.676Z实际Reload from disk button focus，同一draft保留；再Delete→Discard，实际剩余Files tab focus。最后Files Delete→Add+Enter，原菜单可继续。

同scope真实两Browser输入不同scoped URL，点击关闭inactive first后，10:03:35.040Z实际focused/selected second同一tab、address=.../?tab=second。中文简体/深色设置往返保留地址，最后Browser Delete后实际添加工具focus，Enter打开原中文菜单、Escape关闭。实际截图均人工查看，native pointer/keyboard，不造state/messages或执行UI自动化测试。changed-focus success-frame竞态、pending API/resource变更guard、screen-reader inactive aria、Tauri GUI、live子侧栏Rendering仍未知，不据源码guard或CLI结果宣称覆盖。

自己68关闭后立即sole shutdown，原foreground99821/Native actual0、physical/output/request/pair与独立birth/port闭合，最终13表全行相等；原README完整46bytes/一行正文仍在，所有draft只Discard未Save。Project属性完整before/after保留：匿名44相等、primary63仅.git目录mtime变化。无新Provider/Task/agent，原231五EOF不是新增调用。全部observer/检查器终态后才归档自己birth5文件。当前i18n2082、类型/build、docs:check实际输出随证据归档，范围提交与正常fetch/merge/完整待推送审查/push随后执行，持续goal active。

最终docs:check actual0（345 ops/25 groups），精确5个after-02自己birth文件已在所有observer/checker终态后单文件归档；3轮所有Project差异逐项复核均仅primary.git目录mtime，完整原README字节及正文已落盘。没有本任务未归档的Bun文件，不动其他用户改动。
