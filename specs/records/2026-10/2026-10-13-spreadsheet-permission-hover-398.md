# 398 电子表格权限列表深色悬停可读性

## 状态与 Recall

当前为实施前根因和范围方案。Root已完成397真实桌面验收与自有scope收尾，正收敛提交；本批优先处理已观察的权限规则卡片浅底浅字。audit_ui只获准写本spec及自有scratch，不改生产、依赖、其它spec或共享文件，不启动服务/浏览器/模型，不接触凭据、不运行UI自动化、不提交、不再次委托。Root负责新spec索引、文档检查、真实前态、方案批准、实施、后态截图人工复核和最终范围交付。

用户持续目标：逐批并行体验UI/UX（User Interface/User Experience，用户界面与体验）、功能完成度与缺陷，先根因/影响分析并落盘spec，再实施有证据的修复或功能改进，真实桌面交互和截图人工复核，必要时授权模型验收，范围提交、上游同步和正常推送后继续。本批有自然可达的既有真实产物，不需要重新生成模型内容。默认桌面，不扩大为整库对比度审计或移动端交付。

验收指标：同一真实工作簿权限列表中，深色模式下规则卡片及其编辑/删除操作的实际悬停背景与文字/图标保持可读；当前主题切换、普通/全屏和中英文本继续使用同一工作簿/主题服务。规则身份、范围高亮、权限判断、编辑/删除动作和397原生按钮焦点不变。以真实:hover状态、computed styles（计算后样式）和截图核实，不以源码class存在、理论色值或构建通过代替页面结果。

恢复时先读本Recall及这些资料：

- [07-panel当前架构](../../current/architecture/07-panel.md)：唯一Spreadsheet适配器、当前产品主题/语言、同一已编辑实例、库弹层归属与显式编辑回焦。
- [389弹层合同](2026-10-13-spreadsheet-fullscreen-popups-389.md)、[392同实例语言](2026-10-13-spreadsheet-accessibility-locale-392.md)、[394权限标题/错误](2026-10-13-spreadsheet-permission-panel-locale-394.md)、[396焦点读位](2026-10-13-spreadsheet-focus-scroll-396.md)、[397按钮焦点](2026-10-13-spreadsheet-button-focus-397.md)。它们均不能替代本批主题验收，397明确保留hover、More Colors和Close名称边界。
- [396人工记录](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/observations/final-review.json)的permissionRuleHover及[中文规则截图](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/screenshots/after-created-rule-zh.jpg)、[英文规则截图](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/screenshots/after-created-rule-en.jpg)。audit_ui本轮人工查看中文原图，确认规则卡片浅背景与几乎不可读的白色标题/权限正文；没有新的浏览器操作，也没有从像素反推精确CSS颜色。
- [397完整证据入口](../../artifacts/2026-10-13-spreadsheet-button-focus-397/README.md)与[最终人工记录](../../artifacts/2026-10-13-spreadsheet-button-focus-397/observations/final-review.json)：真实原生按钮已可激活，后续主题问题仍存在；颜色Dialog取消回BODY后一次Escape关两个菜单被明确保留，不能写成逐层Escape成功。
- 全仓生产检索仅SpreadsheetArtifact→univer-spreadsheet-adapter导入Univer；产品src没有univer-gray、规则卡片class或ThemeService的第二配色实现。安装0.25.1的core ThemeService、ui DesktopWorkbenchContent/ThemeSwitcherService/Sidebar、sheets-ui SheetPermissionPanelList/各打开命令、Design颜色/弹窗及实际preset CSS均已读。四runtime、公开配置/type和当前patch登记也已核对。
- 历史：sheets-ui现有patch由`830972c0d`的392无障碍/Sidebar语言与`ea43153dc`的394标题/范围错误形成；适配器主题跟随不是本批新引入。389/392/394/396/397分别处理宿主、语言、checker、滚动、原生焦点，没有为规则卡片hover补深色背景。本批不归因于这些修复，也不重做其实现。

没有发现调度、队列、执行轮次或终态异常，不触发Task/Mission横审。读取范围未发现具体UI自动化测试文件；没有运行包内测试脚本、源码文案断言或浏览器自动化。所有检查/演示仍由Root真实页面完成。

## 可观察症状与根因链

旧真实截图中侧栏整体及工作簿处于深色，单张规则卡片变为接近白色；标题和“创建/可编辑/查看权限”等正文仍为白色，导致悬停时内容难读。原日志只记现象，未采集computed styles；本轮源码建立直接机制，Root398仍须重新保存实际:hover、颜色与截图作为实施前证据。

1. 产品`SpreadsheetArtifact.tsx`挂载时传`appliedColorScheme() === "dark"`，通过`observeAppliedTheme`调用同一个runtime.setDarkMode，onCleanup解除观察并dispose同实例。adapter把初值交给createUniver，再用既有ThemeService.setDarkMode更新，没有改色表或重建工作簿。
2. core ThemeService以同一个darkMode$广播布尔模式，currentTheme仍来自defaultTheme。ui DesktopWorkbenchContent约5132订阅currentTheme$注入`:root`变量，另订阅darkMode$给documentElement及workbench-layout设置univer-dark；订阅正常清理。浅色/深色选择依赖class，**不会把gray50自动重新定义为深色**。
3. ui ThemeSwitcherService约4016递归defaultTheme生成`--univer-*`变量。当前themes0.25.1默认值：white=#FFFFFF，gray50=#F9FAFB，gray200=#E3E5EA，gray300=#A8B0BD，gray400=#7D8698，gray600=#31363F，gray700=#272A2F，gray900=#1B1C1F。无产品自定义主题覆盖；实际浏览器值仍应记录，不把默认表等同实页观测。
4. ui Sidebar约5002用`univer-bg-white univer-text-gray-900 dark:!univer-bg-gray-900 dark:!univer-text-white`。卡片标题继承白色；权限各span又显式使用`univer-text-gray-900 dark:!univer-text-white`。
5. sheets-ui `SheetPermissionPanelList`约26708的卡片class只含`hover:univer-bg-gray-50`，缺少dark hover；当前实际preset CSS中该选择器始终为`background-color:var(--univer-gray-50)`。这与第4步组合，直接解释深色白字被放到浅色hover背景。
6. 同一卡片Edit/Delete两个图标容器约26748/26756只含`hover:univer-bg-gray-200`，同样缺dark覆盖。其图标随现有颜色渲染，父卡片修成深色后，指针直接落到这两个局部区域仍可能出现浅底。当前这是源码确定的同组件影响面；两图标的独立实际:hover/颜色尚待Root取证，不能声称已分别实页复现。
7. 规则description使用`univer-text-gray-400`，与白色正文不同。若采用既有dark hover gray700而不调整说明，其默认token理论对比约3.93:1；说明不是装饰内容，因此该新背景下的实际可读性必须一并验证。Root已接受将同卡片说明的`dark:!univer-text-gray-300`列入第4处class候选，先取前后态再明确实施批准。

这是同一库组件缺少dark变体的配色数据问题。无需改焦点、事件、hover状态或规则读取。396的隐藏输入preventScroll及397的原生按钮策略不控制CSS:hover，不能用继续改focus来修卡片颜色；本轮不存在它们影响主题token的代码路径。

## 定义、调用和共享影响面

实际preset入口是`packages/overlay/node_modules/@univerjs/preset-sheets-core/package.json`，解析到`.bun/@univerjs+preset-sheets-core@0.25.1+fb6a3c66a95eaf3d`。sheets-ui实际消费在`.bun/@univerjs+sheets-ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/sheets-ui`，不是仅检查root的Bun patch工作副本。当前exports.import为lib/es/index.js、require为lib/cjs/index.js；根lib/index.js和UMD也随同包发布。

| 定义/入口 | 当前合同与影响 |
| --- | --- |
| SheetPermissionPanelList，ESM/根lib约26531 | 单一列表实现；按isCurrentSheet筛选当前工作表或整个工作簿的规则，使用相同卡片渲染两种范围。没有第二个“深色卡片”实现。 |
| SheetPermissionPanel约26838 | showDetail=false时唯一调用列表。语言重绘及原key策略保持，不借本批重挂载修颜色。 |
| SheetPermissionRenderController组件登记约27349 | UNIVER_SHEET_PERMISSION_PANEL→SheetPermissionPanel；完整当前权限面板共享同一组件。 |
| ViewSheetPermissionFromContextMenuCommand约5975 | 调用SheetPermissionOpenPanelOperation，showDetail=false。其菜单factory用于单元格/行列上下文；真实已可通过工作表/单元格“查看所有保护范围”到达。 |
| ViewSheetPermissionFromSheetBarCommand约5993 | 同一operation/showDetail=false；工作表菜单入口与上述共享列表。 |
| Detail Footer合法Confirm约26215 | 真实创建权限后以同一key标题返回列表。394已覆盖当前语言，398只改列表绘制。 |
| Current sheet/All sheets | 同一ruleList.map，无论Range/Worksheet规则、创建者/协作者、当前表/其它表，卡片均走同一class。权限决定Edit/Delete是否出现，398不改变权限。实际多表、多用户均不为本批默认验收承诺。 |
| hover范围高亮 | onMouseMove按规则设置currentRuleRanges，onMouseLeave清空，useHighlightRange绘制原选区提示。保持这些事件及引用，不为颜色加第二状态。 |
| Edit/Delete | Edit深拷贝规则、必要时切到目标sheet并打开详情；Delete执行原DeleteWorksheetProtectionCommand/DeleteRangeProtectionCommand并更新列表/高亮。仅补现有视觉class，不改命令参数或删除权限。 |

公开`IUniverSheetsUIConfig`只有menu、protectedRangeShadow、protectedRangeUserSelector等相关选项，没有权限卡片颜色/class参数；公开`SheetPermissionPanelList()`也无props注入点。protectedRangeShadow控制canvas覆盖层，不是卡片hover。用Host CSS选择库内部节点会形成另一配色来源，复制列表/注入私有组件也超出最小范围。

同包成熟先例是DefinedNameContainer约20708：浅色hover gray50搭配`dark:hover:!univer-bg-gray-700`；其操作区已有gray600变体。当前实际preset CSS已包含三条所需规则，ui/design/sheets-ui各自CSS也使用同一变量，而产品真正加载的是preset聚合CSS：

```css
.dark\:hover\:\!univer-bg-gray-700:hover:where(.univer-dark,.univer-dark *) {
  background-color: var(--univer-gray-700) !important;
}
.dark\:hover\:\!univer-bg-gray-600:hover:where(.univer-dark,.univer-dark *) {
  background-color: var(--univer-gray-600) !important;
}
.dark\:\!univer-text-gray-300:where(.univer-dark,.univer-dark *) {
  color: var(--univer-gray-300) !important;
}
```

这些完整选择器已有生产分发，不需要运行Tailwind生成新CSS、不改preset聚合文件或tokens。important与安装包原dark规则一致，保证深色变体覆盖原hover浅色背景；普通/全屏都在相同document主题class下，不能以全屏另造颜色源。

其它同义检索边界：权限用户选择Dialog行也有无dark的hover gray50，暂未有本批实际入口截图；其它灰色说明/empty state可能另有低对比，不能全仓字符串替换。卡片description浅色gray400在默认白色上的理论比值约3.66，也不是本批宣称已解决的全主题无障碍问题；本批优先根治已实证深色hover，若Root前态确认需扩大说明浅色合同，须补分析批准，不能悄改全库色阶。

## 权威原则与理论值的边界

[WCAG 2.2对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)将普通文本最低目标定为4.5:1，并明确包含hover显示的文本；计算应使用实际前景/背景而非抗锯齿像素。这里采用该原则指导同卡片文字可读性，不宣布整产品WCAG合规。[MDN的:hover定义](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:hover)说明它是指针状态；实际点击后可保持该状态，但不能把键盘焦点当作:hover或用脚本强制伪类冒充用户交互。

按安装默认token做静态颜色运算，白字/gray50约1.05:1，白字/gray200约1.26:1；拟用白字/gray700约14.40:1，白字/gray600约12.14:1，gray300说明/gray700约6.59:1。数值只是方案比较，不是UI测试、computed-style证据或截图验收；Root应读取目标元素及真实背景并重新确认。description gray400/gray700约3.93:1是第4处候选的具体理由，不能忽略正文以外的信息。

## 待Root前态审读批准的最小实施

仅扩展现有`patches/@univerjs%2Fsheets-ui@0.25.1.patch`，在每份SheetPermissionPanelList内按精确作用域补以下class：

1. 卡片`hover:univer-bg-gray-50`追加`dark:hover:!univer-bg-gray-700`。
2. Edit图标容器`hover:univer-bg-gray-200`追加`dark:hover:!univer-bg-gray-600`。
3. Delete图标容器同上。
4. description的`univer-text-gray-400`追加`dark:!univer-text-gray-300`作为相关候选；是否实施由Root真实前态确认后明确批准，不能只凭本理论值抢先修改。

分发范围严格是lib/index.js、lib/es/index.js、lib/cjs/index.js、lib/umd/index.js。前三函数名SheetPermissionPanelList；UMD是Yd，准确命中一个card、两个operation、一个description。只编辑该函数目标class字面量，不重排代码，不碰同文件其它gray50/gray200消费者；保存前态后独立比较该范围之外的完整源码。当前已安装四分发均确认同构的1+2目标，description为同一条件子节点。无新变量或UMD绑定、公开type、language、CSS、source map更改；本包发布目录没有需同步的map文件。

当前sheets-ui patch总14文件段（392语言/type、394额外MainPart type等），修改四个已有runtime后总段数仍应14。保留392/394全部原改动、ui/design的389/397、docs-ui396，package已有sheets-ui登记，无需新增patch来源。正常Bun patch prepare→commit→frozen install后核对实际preset解析；若生成空.bun-tag段，保存后仅剔除准确无业务缓存段再正常安装，不能混入提交或将其当产品改动。

方案没有增加订阅、状态、事件、焦点调用或工作簿owner；主题变更沿当前ThemeService，规则/编辑/导出/语言沿当前服务。全屏由389已有宿主处理，此处不动Portal。真实体验发现其它机制故障时先另记证据，不用扩大这四处class来掩盖。

## 真实桌面前后态步骤

Root在自有无凭据标准开发模式`http://localhost:<port>/ui`启动固定期限scope，复用既有真实Desk budget（Chat ses_h0VKkCl7hbz3BKHVW2Xp、artifact art_g0VXv65e1004ErsrwSJs）。所有操作由真实页面完成，不借内部command造规则、不新增模型请求；只创建可辨认的临时规则，随后只删除本scope所建规则。

1. 记录初始语言、主题、zoom及原单元格值。由工作表右键“查看所有保护范围”进入List，再以397已可用的真实Add/范围入口创建一个合法范围的临时规则并写`HOVER-398 temporary`说明。确认实际卡片和编辑/删除操作出现，不能用静态HTML或mock替代。
2. 前态深色普通视图：真实指针落到卡片无动作的正文/description区域，确认匹配:hover，保存卡片、标题、权限span、description、图标及其局部背景computed styles、父链univer-dark与当前`--univer-*`实际变量；截图人工查看。当前工具若没有直接hover/mouse.move，可采用真实正文click让指针留在卡片，但应记录实际输入；不dispatch事件、不强制CSS伪类。Edit/Delete只在实际观察到各自:hover时记录其悬停资格，不能伪称两个图标已逐一覆盖。
3. 同一实例切浅色，保留规则并观察原非悬停/悬停表现；回深色再核对。普通/全屏各至少保存目标卡片的前景/背景与截图，确认主题源、Tooltip及范围高亮仍有效。主题切换后已有语言/选区保持，不以刷新或重建工作簿恢复状态。
4. Root审读前态和第4处说明候选后批准，再实施四分发补丁、实际安装、定向typecheck和私有build。没有UI自动化测试；静态范围及语法仅证明补丁整合。
5. 后态用相同自然入口和临时规则重复深色普通/全屏的正文与操作hover、浅色对照；确认真实颜色来自已存在token且说明可读。中英切换确认真实名称/规则描述仍按原事实展示，界面文本按当前语言，不因配色改写用户说明。编辑进入原详情后取消；最后通过真实Delete清理本scope临时规则并确认空态。
6. 正向功能守卫保持聚焦范围：实际Edit打开所选规则、取消返回；原范围highlight随指针动作变化，鼠标移开后读取区继续正常；一次正常Add的Tab/Enter与既有可见菜单回焦仍可用。没有必要为CSS-only改动跑全部工具条、模型或全量测试。
7. 恢复原主题、语言、zoom，正常关闭自有tab及原owner/launcher，保存实际terminal/join。归档明确允许截图、计算样式、原观察和必要日志；gzip保原CSV/日志字节（若本轮实际下载），不复制auth/models/runtime。Root更新索引/架构与必要changelog、运行当前文档检查、范围提交、合并上游并正常推送，不创建tag/Release。

风险/未知：currentTheme及documentElement.univer-dark是库原共享机制，多实例相互主题影响未在本批证实，不擅改全局主题服务。description浅色低对比、其它卡片/用户Dialog、移动端、独立Docs、完整输入法与所有权限角色静态共享但未实页；不能声称全库对比度或所有主题资格化。工具不能取得的真实hover状态必须明确记录未覆盖，不用强制伪类截图填补。

## 分开的后续候选，不计入398实现

建议编号仅供Root排程，尚未创建这些spec或占用索引：

| 建议批次 | 已有事实、代码依据与待调查边界 |
| --- | --- |
| 399 More Colors语义与Dialog返回焦点 | 397确认More Colors仍为无href的a，Cancel后BODY。Design ColorPicker约1668只给a onClick=setVisible(true)，无原生Tab/Enter/Space语义。其Dialog拥有Radix Root与Content，没有Trigger；IDialogProps也无trigger/onCloseAutoFocus透传。实际Radix1.1.23关闭默认尝试triggerRef.focus，缺少已登记触发者与BODY观察吻合。优先进一步审全部Design Dialog消费者，选择同一Root下成熟Trigger桥接或窄转发公开close-auto-focus契约；仅a改button不足以证明返回焦点。不得加定时focus、全局activeElement影子或Host标签特判。 |
| 400 菜单Escape层级合同调查 | 397真实Cancel回BODY后一次Escape关闭主context和颜色子菜单。ui AnchoredContextMenu约4773对未defaultPrevented的Escape关闭父，父按isOpen卸载Panel及子Portal；ContextMenuMenuItem子层是普通Portal，没有独立Escape消费。该控制流能解释观察，但“每次只关一层”的预期尚须Root明确并基于真实焦点确定，不能单凭一次关两层宣告新回归。先完成399再重现，区分BODY焦点与子层焦点；不以全局role/class推断归属，不撤回389清理和defaultPrevented合同。 |
| 401 Design Dialog Close当前语言 | 397中文范围/删除Dialog仍有英文Close。Design DialogPrimitive约670–679在Radix Close中硬编码sr-only span="Close"；Dialog已读ConfigContext.locale但该primitive不读它，Design en/zh资源也没有Dialog.close键。RangeSelector和DeleteSheet确认都经公共Design Dialog/Confirm，而正文可中文，表明当前locale已经传入，缺的是同一关闭控件文本消费。应单独横查真实Dialog/Confirm调用与四runtime、locale/type/preset合并范围，用现有ConfigContext语言源补正式键及运行时重绘，不DOM改aria-label、不换工作簿。其它Close badge为另语义，不顺手同义字符串全替换。 |

[Radix Dialog官方合同](https://www.radix-ui.com/primitives/docs/components/dialog)提供Trigger及Content的onCloseAutoFocus接口；在线文档版本只作成熟方案原则，安装版1.1.23源码/type才是可用能力证据。这些候选不是397自动回焦数组或398主题class的同一个根因；各自需要完整影响分析、真实前后态与独立scope，不把候选研究冒充实现完成。

## 交接与索引责任

本方案仅398主题范围可进入Root前态和批准流程。精确新增索引建议保存于`.tmp-spreadsheet-permission-hover-398/index-ops.json`，分别指向本spec；audit_ui不直接修改共享README/07-panel/changelog。后续如真正实施，再按最终实际结果由Root补归档入口、当前架构和交付状态，不提前写已修复声明。

## Root前态采集准入（2026-10-14）

Root已读Recall及完整根因/影响方案，批准使用既有credentialless review-server/launch-review，以自有398-before阶段和已安装397 private UI采集真实前态。原1200000ms期限不延长，目标deadline前至少60秒关闭自有页并触发原正常stop/join；不触达用户窗口、服务或模型。当前只批准前态调查，四处分发class实施仍待真实样式/截图审查。

## Root真实前态与实施批准

自有398-before PID81704原1200000ms，实际305157ms正常stop/join0；tab40已关闭，只有HOVER-398 temporary规则由真实Delete清理。原主题System/应用深色、English、100%及7/5/12均保持。真实Tab/Enter Add创建A1规则。普通及全屏实际正文click悬停：card背景rgb(249,250,251)、正文白色、description rgb(125,134,152)；Edit/Delete真实右键仅使指针落在图标（未左激活），各自:hover=true、背景rgb(227,229,234)、白色图标。实际主题变量与方案defaultToken一致。切Light后同规则保留、背景同249/250/251、正文27/28/31，description仍125/134/152；恢复System后正常清理。截图和选定computed styles在自有observations，Root全部人工查看。首次不限定Sidebar的description locator因tooltip同名产生strict错误，随后按实际Sidebar正确采集；不删除失败事实。

Root据此批准四runtime中精确1+2+1 class追加，保持其它完整源码/旧392394patch段；不改CSS、theme来源、宿主、焦点、语言或公开type。description灰400在拟深色gray700上理论3.93:1，因此一并使用既有gray300，真实后态再验证，不扩大浅色/整库对比度承诺。
