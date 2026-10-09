# 229 浏览器标签生命周期

## Recall

用户要求持续单agent自主体验并修复UI（User Interface，用户界面）、功能和Sources，不再委托。228真实File→Browser切换后地址为空，证据是after-02的sources-return-and-menu.txt、browser-menu-chinese-dark.jpg及manual-observations.json；external动作后立即保留地址已验证，不将这两条触发链混为一因。上一批9780cf8c已正常推送，本轮开始工作区干净。此前目标回合改变源码、提交与真实证据，属于进展；持续goal保持active。

已读main两个BrowserPreviewPanel调用、CenterWorkbenchTab全部增删/切换/reset/controller路径，RightDock完整mount与selected归属，ui/Tabs透传，当前安装Kobalte TabsContent源码，workspace inactive CSS，BrowserPreviewPanel全部draft/native/evidence/cleanup及queue相关effect，07-panel公开合同、10月4日File保留owner历史、206子侧栏保留owner历史与228失败事实。相关测试检索仅发现browser-preview-service/native/open-url-transport：内容是HTTP（Hypertext Transfer Protocol，超文本传输协议）/host命令与纯错误合同、window.open stub，不是DOM（Document Object Model，文档对象模型）或组件/文案/截图测试；不修改或运行。未检索到本次mount路径的UI自动化测试。

全仓定义/调用/同语义检索：BrowserPreviewPanel只在main固定Task preview与动态operator tab两处；forceMount仅ui/Tabs声明和main File/subagent调用；独立地址signal只在该组件，无既有持久化draft owner可迁移。RightDock的children已在Show外，隐藏选择保留reserved tab值；TabsContent以forceMount||isSelected决定presence，未selected组件被Show释放。现有data-selected CSS隐藏非selected面板。权威资料：[Kobalte Tabs.Content官方合同](https://kobalte.dev/docs/core/components/tabs#tabscontent)，forceMount为当前公开mount控制primitive，与安装源码一致；推断到本产品草稿寿命需以真实页面证据复核，文档不代替验收。

验收：真实英文/中文页面，在第一Browser输入规范URL→Sources打开原文件→切回保留输入；多个Browser各自输入不同URL后相互切换，关闭其中一个保留另一个、创建新标签从独立空状态开始；隐藏/重开Dock保持输入；设置/原会话导航按真实标签寿命和项目reset收敛。原Source展开与文件正文、外部实际目标页/立即地址保留、Enter反馈、菜单Escape复核。截图必须实际呈现并人工查看。实际Tauri（桌面宿主）Native窗口未验收时明确限制。

## 修改前深度分析

现象与直接触发：228实际输入http://localhost:18155/ui/外部打开成功，返回中文设置仍保留；选择File后再Browser则为空。代码在选工具时只改变selectedCenterWorkbenchTabID，open tab record仍在。浏览器两个TabPanel均未forceMount，TabsContent/Show因isSelected=false释放子组件；组件local addressDraft/addressDirty/manualNavigationRequest/nativeCurrentPage等信号都属于该owner。重建初始draft为空，投影currentTarget为空，本次不能从原状态恢复。旧228修复external handler的dirty=false仅消除立即投影清空，未改变父组件生命周期；File历史早已使用按open lifetime保留实例，206子侧栏亦保留单owner。

当前方案：固定Task Browser使用exact tab ID=browser在centerWorkbenchPanels中是否仍打开作为forceMount；动态operator Browser由For中的原tab record寿命限定，TabPanel forceMount。CSS和active谓词继续定义是否显示与真实Native操作时机；显式close/reset删除记录后卸载原owner、注销controller、释放命令/资源并调用既有Native destroy。两个入口一起修复，不改通用Tabs默认，不扩大至其余无保留合同的面板。RightDock children注释更新为当前实际保留规则。单组件实例是唯一地址编辑事实源，不复制URL/draft到主store、localStorage、tab metadata或兼容层。

数据/控制/共享影响：普通Sources文件与子侧栏既有owner不变；primary exact ID不能用“存在任意Browser”判定，否则关闭primary时会被无关dynamic tab延长。main remove/reset保留其他同record对象，For identity不会替换未关闭tab。Task/项目/会话导航当前reset移除全部工具记录，保留跨项目隔离。Task target/evidence仍是canonical（规范）输入；固定组件可在open/inactive时读取Task target，已有首次ready呈现去重和onReady新target逻辑保留。latestEvidence/capture/nativeScope/hotkeys均检查panelActive，inactive中abort/revoke/detach+command/transition tail后release；onCleanup才destroy与注销globalocclusion/controller。Web实际没有Native能力，仅地址/availability UI。保留实例不授权隐藏模型/Task/消息或重启执行轮次。

队列/终态边界：当前是Tabs presence寿命错误，尚无Task/Mission/Session调度、唤醒、恢复或并发异常证据。Browser命令的per-lease commandTail、nativeLeaseTransitionTail、请求identity、deactivate close及occlusion/cleanup已横向读取两个生产入口，改动不改变这些函数或协议。真实Source222准入须再次检查所有execution/request/recovery/current lease/容量/原birth/port/pair以及多个Project，而不能只看当前UI结论；真正Native窗口的多tab隔离/leaseclose视觉和运行尚未知，不用CLI Native后端退出0宣称此项通过。

公共合同/测试/文档/交付/风险：只修改main两处mount、RightDock注释和当前07-panel生命周期说明，无数据库/SDK（Software Development Kit，软件开发工具包）/API（Application Programming Interface，应用程序接口）/Provider/模型/版本发布改动。纯UI不新增/运行UI自动化测试；类型/build/docs只是工具链。保留仍open的浏览器实例可能延长已read target/主题observer寿命，界限由真实open record限定，显式close必须释放；inactive UI始终CSS隐藏，菜单/Native仍由现有active控制。未知项明确保留。

## 实施与验证

先完成以上分析与落盘再改源码。类型/build、现行docs:check；fresh原222全部Source/config/两个Project/execution/请求/恢复准入，90表全行相等复制，原Session/Project/directory保留，新229after-01/18156固定900000ms，无auth/models、新Task或新Provider。真实正常开发serve /ui与新asset200，只使用自己的页面；用户23/18107不动。

结束关闭own页与实际外部页、sole shutdown并join原foreground/Native actual0、physical/output/request/pair，最终13表全行custody与两个Project属性核对；所有observer/checker完成后精确自己birth的5个Bun pile单文件归档。spec/root/月/目录README与docs，范围commit、fetch/merge上游、完整待推送集合审查、正常push。失败事实保留，持续单agent继续下一批。

## 真实结果与剩余范围

main-CIkel-bL.js与实际HTTP200，自己的UI55真实英文Sources展开→原README正文加载→Browser返回保留http://localhost:18156/ui/。通过真实Add菜单创建第二tab，输入不同?view=second，溢出菜单返回first与直接点击second各自恢复，hide/reopen保留second，关闭second后first仍保留；再建第三tab从空地址开始。实际Enter原unavailable反馈仍可见，external按钮真正创建56首页并立即保留地址；56关闭。真实设置改中文/深色后File→Browser仍保留；真实菜单Shell Escape关闭并恢复焦点。另原匿名项目会话真实选择、打开新Browser得到新空地址，不延续前项目draft。截图已呈现并人工查看，全部自己页55/56关闭，用户23/18107保留。

一处工具定位失败：未selected tab的aria-controls实际为null，之前按该属性定位无匹配；重新读取当前真实trigger ID后完成同一操作，不把工具超时包装为失败/成功截图。此Accessibility（可访问性）关系需要后续独立调查，当前根因未知，不修改通用Tabs或创建第二ID映射。Task固定primary Browser真实UI和Tauri Native多tab生命周期未验证；本轮仅实际operator Web标签与原Sources文件链，不能外推这些未知项或长URL Sources矩阵。

fresh source原完整前沿依旧245 lease winner、唯一未过期runtime精确birthdead、2过期容量、3completed assistant、memory idle；90表原行复制保留。唯一shutdown之后原foreground/Native实际0、physical/output/request/pair全完成，最终13表全行相等。两个原Project目录的唯一属性差异各为.git目录mtime，完整before/after属性已保存，不宣称目录全相等或内容身份。types/build实际0，docs按当前package命令复核；纯UI未新增或运行任何UI自动化测试。持续goal保持单agentactive。
