# 394 电子表格权限面板标题与校验文本的当前语言

## 状态与 Recall

本记录已完成方案、真实前态、五vendor实施和与396联合的限定桌面后态；最终状态见末节。首次394-after的普通Add焦点阻塞真实保留，最终后态在396目录统一归档。root负责生产与页面；audit_ui仅按授权写本spec、自有scratch及本批证据，不改共享索引或后台，不启动页面/服务/模型，不提交、不再次委托。当前工作区其它已授权任务改动全部保留。

用户原始持续目标是逐批并行体验UI/UX（User Interface/User Experience，用户界面/体验）、调查完成度与缺陷，先根因/影响分析落盘，再实现、有真实交互和截图人工复核、聚焦检查、清晰提交、正常同步上游和推送，完成后继续。394承接392明确留下的“预翻译标题”和权限详情错误快照，不把源码候选包装成已实页发现。默认桌面范围，无移动端、多实例或全部Univer面板验收承诺。

已重读[392最终记录及Recall](2026-10-13-spreadsheet-accessibility-locale-392.md)、[07-panel当前架构](../../current/architecture/07-panel.md)、[387同实例语言](2026-10-13-spreadsheet-artifact-identity-387.md)、[389弹层](2026-10-13-spreadsheet-fullscreen-popups-389.md)与[391编辑生命周期](2026-10-13-spreadsheet-local-edit-guidance-391.md)。392由`830972c0d`交付：五类名称、两个实际Sonner区域与View All列表正文已在同一实例英语→中文→英语更新；All sheets选项、350宽度、B3选区和已编辑9/5/14保留，真实CSV（Comma-Separated Values，逗号分隔值）61字节核对完成。当前root已完成范围提交并正常push流程，394不重复其已通过范围。

当前架构仍要求唯一真实payload身份、现有挂载实例导出、locale更新同一Univer，不重建工作簿；编辑只在当前视图。392的Sidebar投影依赖`[sidebarOptions, currentLocale]`，保留原类型/key/state/宽度，明确没有解决已经保存的翻译文本。不得用语言key重新挂载、关闭重开面板、host层路由/文案覆盖、万能文本回译或复制语言字典来修394。

已读资料和搜索范围：

- 全仓overlay生产`@univerjs/*`导入仅在univer-spreadsheet-adapter；读取其preset配置、语言注册和导出路径。读取当前安装0.25.1及392两份patch、Git历史、真实preset依赖路径。
- 对当前core preset注册的ui、sheets-ui、sheets-formula-ui、sheets-numfmt-ui、docs-ui逐一核对ISidebarService生产入口、标题producer、正文t()与语言状态缓存；同一个ui facade公开桥接也纳入。
- 读取CustomLabel、Sidebar、DesktopSidebarService公共类型和实现，权限OpenPanelOperation、六类Add/View/Set入口、List编辑/新增、Detail Main/Footer/Panel、checkRangeValid全部定义/调用和声明，以及实际RangeSelector输入/弹窗路径。
- 读取默认AuthzIoLocalService注册、内存权限资源和适配器配置，区分Univer本地工作簿权限操作与OpenCorvus后台权限/外部授权。
- [Univer官方国际化说明](https://docs.univer.ai/guides/sheets/getting-started/i18n)仅作为成熟语言服务原则；实际API（Application Programming Interface，应用程序接口）以安装0.25.1为准。[React状态保留](https://react.dev/learn/preserving-and-resetting-state)与[useMemo语义](https://react.dev/reference/react/useMemo)支持同类型/同位置保留状态、派生显示依赖真实当前数据，不视作产品验收。

没有检索或运行UI自动化测试。看到依赖package.json的上游vitest脚本不意味着本仓库应运行它；本批禁止源码文案断言、DOM（Document Object Model，文档对象模型）/组件渲染/快照/Playwright test/像素对比。没有发现需要本批删除的实际UI测试文件。root负责新spec索引、docs检查、真实页面、证据归档和最终提交。

## 现象资格、直接触发与根因

394有两条源码明确但尚待实页确认的候选，不能沿用392的截图宣称它们已复现。

| 候选 | 自然触发及可观察预期 | 源码数据流 |
| --- | --- | --- |
| 权限子入口标题快照 | 英文View All Protection Ranges→Add new permission打开详情，保持该面板切中文；正文按392更新，标题预计仍英文。详情Confirm成功返回列表后再切语言也有同样标题来源。 | List新增与Footer成功返回把`t("sheets-ui.permission.panel.title")`的结果写入header.title，而不是现有语言键。 |
| 范围错误快照 | 在详情输入两个有效但互相重叠的范围，例如`A1:A2,A2:A3`，先看到Range cannot overlap，再切中文；错误预计仍英文，而周围标签更新。 | checkRangeValid立即翻译为string，MainPart回传该string，Detail用rangesErrMsg state保存；语言重绘不会重新运行其useState初始化。 |

范围为空的UI可达性尚未证明：MainPart先把字符串按逗号解析，再对无效或倒序范围直接return，不能假定清空输入一定进入emptyRangeError。优先使用两个语法有效的重叠范围；真正输入能否到达checker以及编辑器提交时机仍由前态页面决定。RangeSelector的verifyRange允许REFERENCE与逗号，parseRanges按逗号拆分；其正常RichTextEditor onChange及真实范围选择弹窗Confirm都可向MainPart回传，不需要内部API注入。

### 共同标题合同和权限生产入口

ui `CustomLabel`当前实现（ESM约454）对字符串title调用`localeService.t(title)`，对ReactNode保持原节点；LocaleService.t遇到未找到键时返回原字符串。这是同时支持正式语言键和真实调用者文本的公共合同。ICustomLabelProps.title为ReactNode，ISidebarMethodOptions的header/children/footer使用该描述。不能把任意英文字符串猜成键，也不能修改CustomLabel使用户/模型文本被当成待翻译词典。

权限面板当前全部标题写入点只有四处，每一种分发各同样四处：

1. `SheetPermissionOpenPanelOperation`（sheets-ui ESM约5926）保存键`sheets-ui.permission.panel.title`。Toolbar Add、ContextMenu Add/View/SetRangeProtection、SheetBar Add/View走同一operation；其中View参数showDetail:false，Add/Set参数showDetail:true。已是当前正确语义。
2. `SheetPermissionPanelList.handleEdit`（约26658）保存同一个键，传clone后的rule/oldRule，已正确。
3. `SheetPermissionPanelList`的Add new permission回调（约26828）先t()再保存字符串；这就是可直接从392现有空列表到达的最小前态入口。
4. `PermissionDetailFooterPart` Confirm成功后（约26213）先t()再打开showDetail:false列表。此处不是Cancel/Back；Cancel只reset两个面板模型并close，不回列表。规格和验收必须按真实动作名称描述。

392解决的是“同一options里的键/即时渲染文本不重新绘制”，其memo现在已随当前locale刷新。上述两处已把键丢失成英文/中文字符串，即使CustomLabel重新执行，`t("Protect Rows and Columns")`也只返回这段原文。现象是producer过早投影，不是语言服务传播、Sidebar订阅、工作簿数据或模型发布故障。

### 范围校验的完整合同

`checkRangeValid(injector, permissionRanges, permissionId, unitId, subUnitId)`在sheets-ui ESM约25983定义，只有两个运行时直接调用：Detail首次rangesErrMsg state初始化和MainPart.handleRangeChange。`lib/types/views/permission/util.d.ts`声明返回`string | undefined`；当前实现返回已翻译错误消息，不能悄悄改成错误键并让现有消费者把key当文案。

现有算法顺序：零范围→emptyRangeError；多个范围两两Rectangle.intersects→rangeOverlapError；否则检查工作表已有保护且当前没有permissionId，再检查排除自身permissionId的其它范围规则→rangeOverlapOverPermissionError；通过返回undefined。对应现有中英资源已经齐全：Range cannot be empty/范围不能为空、Range cannot overlap/范围不能重叠、Range cannot overlap with the range that has the same permission/范围不能重叠已有权限范围。本批无需新翻译字段，不改变顺序、几何相交、自身排除或权限判定。

MainPart解析并限制范围后调用onRangesChange(ranges, translatedError)。Detail同时保存ranges与rangesErrMsg；错误传给MainPart的FormLayout.error，也传给Footer。Footer点击Confirm先检查`if (rangesErrMsg) return`，所以它同时承担显示与提交约束，不能只替换可见文字而让提交判断读旧来源。Detail的desc/editState/viewState、rule/oldRule以及子编辑器状态是实际编辑状态，需要保留。

## 最佳最小实施范围，待root前态与批准

正式最小标题方案限定同一个权限面板的两个错误producer：List Add与Footer Confirm成功返回都直接保存现有键`"sheets-ui.permission.panel.title"`。另外两处正确键保持原状；不新增factory、不改open调用时序、不改参数/模型reset、没有异步操作重排。这两处重复仅是同一语言身份，不值得抽象出新通用侧栏工厂。其它插件没有共用的业务producer，强行统一会扩大到无实页证据的区域。

若前态真实触发并批准范围错误修复，建议**保留现有checkRangeValid的算法和返回契约，只取消翻译文本的重复state**：

1. Detail只保留已有ranges state，render时以当前ranges和当前rule的permissionId/unitId/subUnitId调用现有checkRangeValid，得到当次`rangesErrMsg`，同一个结果供MainPart显示和Footer guard。已有392宿主在语言变化时重新渲染Detail，因此不增加locale effect、binder、错误键协议或第二语言源。
2. MainPart保持解析、无效/倒序拦截、范围上界归一化和onRangesChange时机，只回传归一化后的ranges；移除其重复checkRangeValid调用及仅为该调用存在的injector、permissionId和局部unitId/subUnitId读取。外层unitId/subUnitId仍供真实RangeSelector，不能误删。
3. Detail的onRangesChange直接更新ranges，移除setRangesErrMsg和旧错误初始化state。移除传给MainPart的无用permissionId；UserPart和Footer的permissionId继续保留。
4. 同步MainPart声明：去掉已无消费者的permissionId属性，onRangesChange改为只接收ranges。`PermissionDetailMainPart`运行时只有Detail一个调用点；声明文件虽随包发布，根index没有将此内部组件作为公开入口重导出，仍必须同步准确类型，不能为旧内部接口保留影子参数。util.d.ts的checkRangeValid返回合同、Footer props和Detail业务props不变。

这使错误成为当前ranges/规则模型/当前语言的即时投影，不再存在一个可与ranges或locale脱离的错误文本副本。所有非法范围仍由同一个checker给出明确错误；修改合法范围后同一render得到undefined并允许原Confirm流程，不添加特例。checker仅同步读取内存规则，不创建权限、网络请求或模型调用。代价是每次Detail render重算现有相交校验；范围正常很少，保留原算法，不提前引入缓存/新版本计数。若前态未能触发错误或揭示其它数据流，root应记录真实阻塞并重新审查，而不是把此候选宣称通过。

仅标题修改：扩展现有sheets-ui patch的四runtime（`lib/index.js`、`lib/es/index.js`、`lib/cjs/index.js`、`lib/umd/index.js`）。若范围错误方案批准，再加`lib/types/views/permission/panel-detail/PermissionDetailMainPart.d.ts`，共5个本批vendor文件；392已有13文件patch应保留，新类型会使该patch总头数为14。已有中英资源、en-US语言类型、ui/design patch、adapter、产品i18n和后台均不变。正常Bun patch-commit/frozen install是否更新lock按真实工具结果处理，不造无意义差异。

安装实际消费仍须从overlay的preset解析`.bun`目录，不把root patch工作副本当生产树。当前sheets-ui路径为`node_modules/.bun/@univerjs+sheets-ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/sheets-ui`，版本0.25.1。其导出提供ESM（ECMAScript Module）、CJS（CommonJS）、`./lib/*`及UMD（Universal Module Definition）分发，四份必须等价；本包无source map/src源文件可追加。保持392 SheetBarTabs订阅和语言资源，不重格式化巨大UMD。

UMD当前对应：`Vd`为checkRangeValid（算法不改）；`Gd`为PermissionDetailFooterPart（localeService=`v`，sidebarService=`g`）；`Yd`为SheetPermissionPanelList（localeService=`g`，sidebarService=`x`，函数内嵌大图片使正文约95KB）；`Kd`为MainPart；`Jd`为Detail。若改范围状态，Jd当前ranges=`m`/setter=`h`，错误state=`g`/setter=`_`，injector=`u`、activeRule=`p`；Kd当前permissionId=`p`、injector=`v`。这些是当前绑定，不是通用替换关键词，root须按函数/作用域审查，避免删除其它嵌套局部变量或图片。CJS必须保留真实命名空间调用。

## 其它当前preset消费者与明确保留边界

| 入口 | 标题和正文状态审查结论 |
| --- | --- |
| ui ShortcutPanel | 标题传语言键，正文已有currentLocale更新列表，392已给共享宿主刷新；不进入394。 |
| sheets-ui DefinedName | 标题在SidebarDefinedNameOperation预翻译；编辑/删除确认等状态另有生命周期。与权限不是同一个producer，自然可达性尚未实页，后续独立调查。 |
| sheets-formula-ui MoreFunctions | 标题传键；选中的functionInfo/参数描述为另一类状态，不能因标题正确宣称所有描述随语言更新。 |
| sheets-numfmt-ui SheetNumfmtPanel | 标题预翻译；typeOptions空依赖memo保存译文，type还用译文作身份。直接补语言依赖会有当前类型失配风险，明显大于权限两标题范围，留后续。 |
| docs-ui HeaderFooterPanel | 标题预翻译，当前Spreadsheet虽注册docs-ui供编辑器使用，尚未证明独立文档侧栏自然可达；不混入当前验收。 |
| docs-ui ParagraphSetting | 标题为键，内部已有locale变化重新生成key的路径；不是本批应复制的方案。 |
| ui facade openSidebar | 透传调用者真实params；本应用未直接调用，不做文本猜测或逆向翻译。 |

安装库存中的drawing/comments/table/conditional-formatting/data-validation等额外preset未在当前适配器注册，不能把包存在作为生产可达证明。共享权限组件可能由移动插件复用，但394默认仅当前桌面；不扩大到MobileSheetBar、其它19个artifact renderer、Provider/Usage/FileExplorer或权限后台。更多颜色焦点、跨Chat编辑持久化、Numfmt类别身份等继续保留原边界。

## 真实桌面前后态、检查和风险

root使用自己的当前开发`/ui`页面和规范隔离runtime，复用真实Desk budget（原Chat `ses_h0VKkCl7hbz3BKHVW2Xp`、artifact `art_g0VXv65e1004ErsrwSJs`），无需模型或新凭据。当前adapter没有覆盖IAuthzIoService，core默认注册AuthzIoLocalService，权限create/list读写本实例Map并随工作簿资源管理；它不是OpenCorvus服务器权限。Confirm分支需要真实执行本地权限创建/修改，必须在自有隔离实例上做并记录清理，不把取消按钮当作返回列表的验收替代。

1. 英文打开View All→Add new permission；记录标题、受保护范围/说明/单选项和输入状态；填写独特的临时说明。保持详情打开切中文，前态核对标题快照，后态标题/正文应同语言而说明、范围、选项和工作簿编辑保持。再切英文作反向确认，至少一轮全屏截图人工看。
2. 输入`A1:A2,A2:A3`或通过真实范围弹窗添加重叠区域，实际看到原checker错误；保存截图和语言切换结果。不通过内部React/Univer API伪造state。后态同一错误应英/中往返、输入与说明保留；把范围改为合法`A1:A2`，真实错误状态应清除，原确认流程可继续。空范围/已有保护冲突若未真实触发，单列静态合同，不声称全部错误类型验收。
3. 对合法隔离范围实际Confirm，确认返回showDetail:false列表并显示新规则；保持此列表切另一语言，验证第二标题producer。通过可见删除入口移除刚建临时规则，记录实际终态；若该数据/当前权限阻止Confirm或删除，保留准确未完成，不使用直接内部调用绕过。取消另一份未保存详情应正常关闭且不冒充Confirm路径。
4. 在同一个已编辑工作簿内复核392的AX（Accessibility Tree，可访问性树）名称、侧栏宽度、工作表选区、原值9/5/14、普通/全屏菜单和CSV当前值导出。只验当前触及行为，不无目标重跑全量功能。恢复英语偏好，关闭自有tab、按原owner协议停止服务并join，记录物理退出。

标题和错误投影均为UI变更，禁止新增/运行UI自动化；helper验证算法不改，不拿字符串检查当功能测试。类型检查、正常私有构建和docs检查只验证整合；真实checker必须由上述页面输入进入，截图须由root人工查看。不得把代码推断、静态语法通过、旧392图或模型自述当394通过。

主要风险与未知：尚未真实触发394两个现象；当前RangeSelector接受多区域输入的具体提交时机未知；Confirm异步失败/数据状态可能使返回列表未到达，必须保留真实错误；派生错误方案会在当前规则模型变化后的下一次已有重绘重新校验，未新增模型订阅，不承诺并发外部权限实时刷新。没有任何调度/队列/occurrence异常证据，故本批不扩大到运行器共性审计。语言修复不得改变权限结果、覆盖用户输入或造成工作簿重挂载。

## 交接

调查和最小方案到此冻结。root先取得394真实前态并批准标题/错误最终范围，再实施；若只批准两标题，本spec中的范围错误方案维持未完成候选，最终说明必须明确。audit_ui没有修改生产或依赖、启动任何服务/浏览器/模型或运行UI测试。root负责索引与文档检查、实际安装/构建/截图、证据归档、范围提交与正常upstream合并/push；没有版本发布、tag或Release动作。

## Root前态执行批准

root已读完整Recall/范围/调用点/当前架构与继承392证据，批准仅启动独立credentialless 394-before开发/ui来确认两标题与范围错误的自然入口；此阶段不改生产、不创建真实模型或凭据，不进行权限Confirm写入。复用正常387review owner和已验收392私有UI，绑定真实Desk budget；按真实界面/截图决定最终实施范围。

## Root 实页前态与最终实施批准

394-before自有服务PID85496，tab34，当前392私有构建。全屏英语直接输入真实重叠范围得到Range cannot overlap，但关闭全屏回普通视图会使用不同的挂载实例，该首次全屏截图只证明该检查器可达，不作为同实例语言切换证据。普通视图保留的真实Desk budget数据为7/5/12；不冒称392其它实例编辑的9/5/14已持久化。

根Root通过普通视图View All Protection Ranges→Add new permission，填入LOCALE-394 normal，再使用可见Select data range弹窗：第一范围A1:A2，Add range追加A2:A3，弹窗Confirm进入同一个真实checkRangeValid，得到Range cannot overlap。此Confirm仅应用选择范围，没有创建权限。保持该详情，Settings→Appearance→Chinese Simplified→Back，正文、五名称更新中文，标题仍Protect Rows and Columns、错误仍Range cannot overlap；A1:A2,A2:A3及LOCALE-394 normal保持。英文/中文实际AX与截图保存自有scratch/before和screenshots，root已人工查看。部分早先直接画布输入受焦点/滚动影响未触发检查器，保留原截图，不把它们列为通过；自然范围弹窗是本次正式复现路径。

上述两条已实证并按现有全入口/公共契约分析批准完整最小实施：两处header producer保留现有语言键，Detail取消独立错误state并由原checkRangeValid派生同一显示/提交错误，MainPart只回传规范化ranges并同步内部类型。检查算法及util公开返回string|undefined合同不变、已有其它权限入口保持、无语言重挂载或影子状态，五份vendor分发同步。原394方案所有未验收边界继续保留。后态由新的独立credentialless页面进入真实检查器、中英往返、合法范围Confirm返回列表、临时本地规则清理和独立全屏复核；禁止UI自动化。

## 独立只读实现复核

audit_ui在root正常patch-commit后，读取`apply-vendor.mjs`、两标题producer、Main/Detail完整函数、类型差异及真实preset解析到的`.bun/@univerjs+sheets-ui@0.25.1+fb6a3c66a95eaf3d`安装文件，未发现具体实现问题。记录暂存`.tmp-spreadsheet-permission-panel-locale-394/independent-review.json`，不是后态页面证据。

四runtime新增差异仅在Footer/List/Main/Detail四个既定函数中，其余保存前态源码保持；checkRangeValid算法及string|undefined返回、392 SheetBarTabs语言订阅、其它正确标题入口均保留。UI/Design patch没有本批差异，389宿主/菜单及392 Sidebar memo仍沿原实现。当前sheets-ui patch恰有14个预期文件段，新增MainPart声明而保留已有13段，无Bun空缓存段。

UMD `Gd/Yd`两标题改现有键，`Kd`保留外层RangeSelector单位/工作表ID和输入归一化，`Jd`用当前ranges=`m`派生错误=`g`并同时交显示/提交；已删除的错误setter与旧MainPart injector/permissionId无遗留引用。CJS命名空间、四分发语义及MainPart声明一致，四runtime静态语法解析均零诊断。没有执行UI测试、服务、页面或模型；合法范围Confirm/临时规则清理、同实例语言和截图、构建及正常物理收尾仍由root完成，不能将本静态复核标成真实后态通过。

## 后态普通入口阻塞与独立396调查

root的394后态安装/type/private build均exit0，PID83648/tab36实际全屏List Add可进入Detail；普通视图将Add滚入可见后多种真实点击/Enter尝试却跳回Chat上方，焦点落到DOCS_NORMAL隐藏contenteditable，选区变A2，List保持。日志没有对应error也不能算通过。此前394-before在392构建普通Add与范围弹窗成功，当前未凭此差异认定394引入回归。

只读横审排除“标题相同所以options被忽略”：DesktopSidebarService.open无标题比较，每次发射新对象，List→Detail分支由showDetail和组件类型决定。Design Button的data-u-comp=button经DesktopLayoutService window focusin微任务交还到DocSelectionRenderService，其唯一原生_input.focus()默认允许浏览器滚动；代码与实际焦点/读位现象吻合。pointerup因先滚动而错失button是机制支持的解释，尚无逐事件轨迹，不包装成已精确录制的事实。

root要求拆为[396焦点与外层读位](2026-10-13-spreadsheet-focus-scroll-396.md)独立方案，先横审全部当前Sheets/Docs调用与内部光标reveal职责，再由root审读批准；不向394叠未知修补。当前394仍未完成普通后态、合法permission Confirm返回及临时规则清理，不能用全屏成功或静态检查替代。原owner期限13:50:57→14:10:57不延长，root负责按时正常关闭；新的无凭据scope可联合验收394/396，但提交各自分离。没有调度/队列异常，不扩大Task/Mission调查。

## 最终限定后态与归档交接

上述阻塞是当时事实；396后续只给隐藏输入focus加preventScroll:true后，root在新的无凭据396-after/tab37以普通真实鼠标一次点击Add进入Detail，Chat读位前后724.6666870117188保持。随后通过可见Select data range弹窗得到精确A1:A2/A2:A3，英语→中文→英语的标题与Range cannot overlap/范围不能重叠同步，范围、LOCALE-394/396 temporary和选项保留。合法A1:A2真正permission Confirm创建本地临时规则并返回列表，列表EN→ZH标题/正文更新；可见删除入口只移除本次规则，正向空态确认完成。

全屏正式证据来自新的干净范围Dialog，中文错误可见，未保存详情取消。直接范围粘贴产生连接文本的两张失败图保留，不作精确两范围证明。Enter激活Add仍失败并移到A2，属397独立焦点策略；396/394没有宣称键盘、完整IME、独立Docs或移动全部通过。其它错误类型及其它插件语言快照继续保留边界。规则hover低对比另列398，不纳入本批实现。

[394归档](../../artifacts/2026-10-13-spreadsheet-permission-panel-locale-394/README.md)仅含前态/首次后态失败、五vendor清单/补丁/独立复核和必要日志。最终后态只链接[396统一归档](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/README.md)及其[人工摘要](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/observations/final-review.json)，不复制第二份事实。root已人工查看截图；原图实际JPEG以.jpg原字节归档，源.png名字在manifest保留。

394-before PID85496/launcher77488 exit0、首次394-after PID83648/launcher8713 exit0均正常终态，elapsed分别520111/784528ms。396最终owner38364/launcher53861 exit0也正常结束，具体退出与61字节9/5/14下载证据只在396归档。所有scope无模型/凭据。安装/类型/私有build成功（394 build1m6s），当前授权语言修复范围已达成，范围提交与正常同步上游由root处理；不把独立397/398边界隐藏成全功能通过。

## 394 第一后态轮次：未完成视觉验收与独立焦点阻塞（历史状态）

五vendor作用域和真实preset消费者由audit_ui独立审查正确，Bun1.4正常patch commit/frozen install、overlay typecheck与private build（1m6s）退出0，docs348/26通过；这些不能替代视觉验收。新credentialless ownerPID83648从13:50:57 UTC开始，tab36。Full workspace真实View All→Add可进入Detail；普通视图List Add滚入可见后鼠标/键盘操作却使焦点回DOCS_NORMAL隐藏contenteditable、会话滚回顶部、列表仍原，未看到错误日志（仅applyDir）。未进行permission Confirm创建。Root保留原AX/截图与所有失败动作，不把新增标题/错误切换或Confirm/清理宣称通过。

audit_ui读取DesktopSidebarService.open排除title相同的更新去重：每次新options+Subject发射，children showDetail:true且List→Detail类型改变。另找到Design Button data-u-comp='button'→DesktopLayoutService focusin givingBackFocusElements→microtask focus handler→SheetUIController当前DOC renderer（实页为DOCS_NORMAL）→DocSelectionRenderService._input.focus()未preventScroll的共享焦点链，吻合实际焦点/滚动。当时仍需独立396规格、真实几何与后态区分，未仅凭链条宣告唯一实页根因。

Root关闭tab36并按原owner协议正常停止，不延长20min预算，不开启模型或凭据。该轮当时未完成同实例后态中英错误/标题、合法Confirm返回列表、临时规则清理及编辑CSV复核；后续在396新scope完成，详见上文最终限定后态与下方冻结状态，不将历史失败改写成当时通过。

## 归档冻结状态

394当前授权语言范围已由396新scope的真实联合后态完成，前态与首轮失败仍保留；键盘397、hover398和未做的IME/独立Docs/移动不包含在完成声明。最终实际结果只在[396联合归档](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/README.md)保存；[394目录](../../artifacts/2026-10-13-spreadsheet-permission-panel-locale-394/README.md)保存前态、失败和实施检查。audit_ui完成安全归档后冻结，root负责共享索引、最终检查与分批正常提交/推送。
