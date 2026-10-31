# 版本日志阅读与返回焦点

## Recall

用户要求持续单agent自主体验并改进当前产品，先完成根因/影响分析与spec（规格）落盘，真实UI（User Interface，用户界面）交互和截图人工复核、必要正向契约、范围提交及正常推送，不明确停止就继续。后续单agent要求覆盖旧Goal三Astra文案，不委托。上一轮831是progress：af054808ccafdd0e7e83c799c6f81db4e3745ad7已推送，2026-10-31T08:11:30Z fresh main/upstream0/0；25普通文件/三索引自有行结清、176项其他修改保持。修复实际设置项标签无法发现所属页面，18图双语/命令面板/草稿保留实页；两scope公共shutdown200、原exec/native/launcher0、物理/输出/请求/出生身份结清，四配对副本退休。最新831-after为schema9/92表216601行、75附件、十三Git项目28 tracked文件及原对话/Goal/Sources/文件/两paused定义保持，733账本/36428624Token保持、累计模型请求1118。用户18571实例、真实数据库/进程/窗口不操作，不建分支/工作树、不重复Dependabot重扫、不发布或升级版本。本轮模型请求预算0。

已读AGENTS、831 Recall及最终交付回执、07-panel的设置导航/搜索/焦点和Release notes现行合同、2026-10-13日志国际化及当前0.1.40发布记录边界。读ReleaseNotesPanel全组件、ConfigDialogHost关于/日志入口、DesktopUpdatePanel、版本常量、共用SettingsPanel/Row、SearchField、现有设置组件焦点处理、animation-frame。全仓生产/相关测试搜索ReleaseNotesPanel/select及release-notes样式，只有一个当前日志面板；尚未发现该目标路径UI自动化测试，不新增或运行。共享util/changelog及历史版本数据不修改。关于的Browser标签是否属于可改产品文案尚未知，不先改。

## 修改前分析与实页条件

代码线索：select(entry)只setSelected并将config-content滚动至顶部。Show在详情/历史列表间替换DOM（Document Object Model，文档对象模型），被激活的History按钮或版本行随之移除，没有后继焦点目标。可能导致浏览器焦点回body、下一Tab从应用导航重来，并让长历史返回顶部丢原阅读位置。直接触发是两次显式列表/详情切换，根因候选为该面板自身的替换生命周期；不是整个设置页或shared Tabs焦点异常。旧日志国际化工作覆盖正文/摘要/搜索/日期/链接和同选中版本翻译，没有处理替换时焦点，不能按其已通过说明本问题不存在。

先启动release-reading-832-before/38453，冻结main-C9RR4r9v.js，真实原生开发serve `/ui`和自有隐藏内置页，实际从关于查看当前版本/技术详情，再进入日志。键盘激活历史、搜索具体旧版本、进入详情、返回列表，截图并辅助只读观察document.activeElement，重点验证下一次Tab位置和原筛选是否保留。不用DOM断言或截图自动测试；若未复现就不改产品。中英文日志内容/日期/版本及返回也实际阅读，不下载/安装/更新桌面、不访问个人邮箱、不触发外部写入。

若复现，保留selected/query及当前单列实现，只在明确select动作后将焦点交给新渲染内容：打开详情指向该版本标题（tabIndex=-1），返回历史若前版本仍属于当前筛选则指向其实际重新渲染版本行；当前筛选不展示该版本时指向历史搜索输入。该分支以同一filteredHistory和前一selected事实判断，不增加历史选中副本、缓存、索引或隐藏页面。滚动行为随实际焦点目标：详情回顶部，返回列表通过真实行焦点恢复其阅读位置；渲染后微任务核对同一面板仍连接、同一选择仍有效和焦点仍属此次切换，避免离开页面/快速切换后的异步夺焦。复用现SettingsRow/SearchField/Button与浏览器焦点，不抽象新的全局恢复机制。修改前全仓补查相关定义/调用/同语义/历史与实际当前差异，保存源码原字节。

范围仅日志阅读UI生命周期及必要当前架构；不改CHANGELOG、已发布正文、解析器、API（Application Programming Interface，应用接口）、SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、持久格式或Provider执行。没有调度异常证据；若出现队列/唤醒/恢复/并发/终态异常立即按共享机制横审全部生产入口、Task/Mission/Session执行轮次、正常终态/重试重启/串并行/多项目后再归因。

## 验收和交付

复制既授权auth和完整models配对目录，仅本地确认凭据类型及gpt-6.1-sol模型投影，预算0；三个官方管理凭据初始化前确认未配置，秘密不进prompt、日志、spec或提交。首启固定60分钟deadline，候选共享且不重置，至少五分钟物理结清余量。基线实页后正常关闭/退休/数据资格，再必要修改、overlay类型/普通Node构建/文档检查，首次after/38454真实页面复验。不单开Vite，不刷新用户应用。

至少验证中英文键盘History/Enter打开旧版本、返回同版本行/原筛选；从窄筛选打开已安装版本后返回保留查询并将焦点交搜索输入；无匹配/清除与当前安装入口；关于至日志和返回应用。原图逐张人工查看，类型/构建/DOM诊断不替代视觉。纯UI不写或运行文案/组件/快照/浏览器fixture自动化测试，不跑无目标全量测试。

原92表所有列/733账本、75附件、十三Git项目28 tracked、十三+三十九+二十二+三文件、既有Task/Mission/Chat/Work与Goal/Sources、两个paused远期定义完整保护。公共shutdown200、原exec/native/launcher0、物理/输出/请求/OS（Operating System，操作系统）出生身份结清才退休配对副本，源认证元数据/模型目录字节与元数据保持。同步记录/证据/当前架构/三索引，文档检查，范围提交，每次push前fresh fetch/普通merge/完整待推提交复核及正常hooks推送；不创建Release、tag、PR，不扩大为整个Goal完成。

## 当前实测与根因收敛

38453/main-C9RR4r9v.js已用原生/ui实测：关于显示当前Overlay0.1.40、连接/Browser技术类型，技术详情展开及关于阅读日志入口正常呈现当前离线英文正文。该入口触发switchConfigTab后activeElement确为BODY。版本详情的All versions通过真实键盘Enter返回列表后也是BODY；下一Tab实际进入新历史搜索，未跳回应用导航，因此原方案的“可能从应用导航重来”未复现，不作结论，03图据实命名history-tab。真正问题是活动焦点丢失，和更明显的阅读位置重置。

实际键盘聚焦长列表中的v0.1.25（04图）并Enter进入详情（05），焦点BODY/阅读容器scrollTop0；返回历史（06）又BODY/scrollTop0，原版本不在当前视口。窄筛选0.1.25只有一项，点击Current version0.1.40再返回（07），筛选保持正确，但焦点BODY；此时当前安装版本确不在筛选结果，返回目标应为搜索。01–07实图均人工查看，选中版本/日期/内容正常，不改日志数据或筛选语义。

全仓switchConfigTab调用只有定义、focusConfigSection内部和ConfigDialogHost关于的阅读按钮；其他设置入口由openConfigDialog已有搜索焦点管理，普通Tabs激活保留自身触发器。关于的内部动作和ReleaseNotesPanel.select是本次实际移除活动按钮的两个生产入口。旧select每次强制顶部，既缺后继焦点，也抹掉返回原行的位置。修正只覆盖这两个显式动作，不更改openConfigDialog初始搜索焦点或shared Tabs。

实施细节：日志select捕获前selected和document.activeElement，增加本组件焦点请求代次，setSelected后只在打开详情时先顶部；微任务核对同一代/选择、面板连接且焦点仍为原触发器或BODY，随后详情聚焦tabIndex=-1的真实版本标题。返回按同一filteredHistory判断前版本可见性，可见则聚焦带真实data-release-version的当前行，让浏览器滚至该行；否则聚焦原SearchField.inputRef。通过CSS.escape构造当前行身份选择器，不保存第二份选择/位置。关于内部动作捕获原触发器，切changelog后核对配置页仍开且仍该tab/标题连接及焦点归属，聚焦原config-page-title（tabIndex=-1）；其他入口不变。两个短动作都使用原浏览器微任务/原控件，不抽象新的全局调度或焦点层。

已查阅[W3C ARIA键盘指导](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#discernible-and-predictable-keyboard-focus)：移除活动元素后需把焦点交给合理后继，不能留在body。此为实测问题的设计依据，不替代实际页面复验。关于Browser是已显示技术类型，本轮不改该标识或未验证的任务计数含义。

## 实施与最终实页复核

基线自有页18关闭后公共shutdown200、原exec58126/native/launcher0、物理/输出/请求/出生身份结清，配对副本退休；schema9/92表216601原行全列保持，现216603，仅启动lease/grant各1；余3300680ms、模型0。修改前ReleaseNotesPanel/ConfigDialogHost/07-panel均无他人差异，原字节和差异已私存。按上述决定只改两UI组件与当前架构，最终types-reviewed及ui-build-reviewed均0，renderer检查通过，main-BeU9pWqt.js。无新翻译正文、API/SDK/schema/持久格式或发布变更。

候选38454/main-BeU9pWqt.js的08–19图均已人工查看，与基线01–07合计19图。关于入口后H1，Tab到All versions再Enter后当前版本行；长列表v0.1.25 Enter后H2/scrollTop0；鼠标返回为该版本真实BUTTON/scrollTop1615，再完整Enter→Shift+Tab网站→Shift+Tab历史→Enter返回原行且蓝焦点框可见。窄筛选0.1.25不含当前0.1.40时，Tab清除/当前版本入口/Enter打开后，从历史返回原INPUT/value0.1.25/scrollTop0；零匹配zz-release-832亦如此，Escape清空查询恢复76版本并仍聚焦历史搜索。

在同一v0.1.25详情通过既有命令切简体中文，选中版本保持，正文和2026年10月12日更新；Shift+Tab真实链接为/zh-cn/changelog/0.1.25，再键盘返回同版本行/BUTTON/scrollTop1342。中文窄筛选当前版本往返仍回原查询搜索。中文关于的查看更新日志通过键盘Enter将焦点交给“更新日志”H1，原生白色键盘焦点框可见；Escape最终回原关于按钮。普通Settings仍打开通用并聚焦搜索，最终关闭回Settings；没有改原嵌套Tooltip先消费Escape的机制。没有实测屏幕阅读器发声、每个历史版本、原生Tauri/移动端和全部竞争时序，不扩大结论。

两scope原histories/extra/sources/readme/824/825/report/empty/protection公共读回全0：Task68/Mission80/Chat3/complete Work8、报告12/380471/1、预检2及Goal9/242063/1、824六消息及94/90字节来源、825两/四消息、网页4/2来源、文件3/8来源、README四消息176字节、空Work22文件、两paused定义及828三文件保持。候选自有页19关闭后public shutdown200，原exec29048/native/launcher0、物理/输出/请求和出生身份结清，配对副本退休。schema9/92表216603全列保持，最终216605，仅新增启动lease/grant各1；75附件、十三Git项目28 tracked及十三+三十九旧文件保持，733账本/36428624Token和两独立配置字节保持；源认证元数据/模型目录字节与元数据保持，余2871300ms。本批0模型，累计1118；用户18571未操作。

[19图及脱敏回执](../../artifacts/2026-10-31-release-reading-focus/README.md)是当前证据。UI只真实交互/截图人工复核，无UI自动化。docs-final退出0（352操作/26组）；正常提交/push hooks结论记录最终交付回执，长期Goal保持active。
