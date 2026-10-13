# 397 保留电子表格语义按钮的键盘焦点

## 状态与 Recall

当前状态：Root已完成397精确四runtime修改、正常安装、类型检查、私有构建，以及普通/全屏真实桌面键盘验收和物理收尾；独立复核与[明确范围的证据归档](../../artifacts/2026-10-13-spreadsheet-button-focus-397/README.md)已完成。共享文档更新、最终检查、范围提交与上游推送由Root继续负责。本文前部保留实施前调查时序，最终资格化结论见末尾；不能将历史“未实施”描述误读为当前状态。

root在396/394联合真实页面发现独立键盘缺陷后委托单层只读横审；audit_ui仅写本spec、获准证据目录和自有scratch，不操作页面、服务、模型、凭据，不运行UI自动化，不提交、不再次委托。root审读后批准精确范围并负责实现、真实交互与人工看图。

用户持续目标是逐批并行体验UI/UX（User Interface/User Experience，用户界面/体验）、分析根因/影响先落盘，再实施、聚焦验证、真实桌面交互和截图人工复核、范围提交、正常合并上游并推送，随后继续。默认桌面，不扩大移动端、所有库组件或其它artifact renderer。当前任务不是通过增加说明让用户避开键盘，也不允许按Add标签、Host路由或事件合成绕过。

已读[396焦点与滚动](2026-10-13-spreadsheet-focus-scroll-396.md)、[394权限语言](2026-10-13-spreadsheet-permission-panel-locale-394.md)、[392同实例语言](2026-10-13-spreadsheet-accessibility-locale-392.md)、[389弹层归属](2026-10-13-spreadsheet-fullscreen-popups-389.md)、[391编辑生命周期](2026-10-13-spreadsheet-local-edit-guidance-391.md)和[07-panel当前契约](../../current/architecture/07-panel.md)。重点保留：同一语言服务、工作簿和本地编辑状态；394错误唯一来源；396只抑制隐藏编辑输入的原生滚动；389成熟弹层/后代事件/关闭链。More Colors无href和Dialog取消后body焦点属于已知剩余，不应被397泛化为已修复。

已读/全仓搜索：overlay唯一Univer适配器；安装ui DesktopLayoutService、givingBackFocusElements、ShortcutService、ToolbarButton/ToolbarItem、Sidebar/ContextMenu/Slider；Design Button及其Dialog/Confirm/ColorPicker消费；当前core preset的sheets-ui/docs-ui/sheets-formula-ui/sheets-numfmt-ui全部直接Design Button入口；SheetBarButton全部调用；Sheets/Docs Enter快捷键及EditorService焦点响应；四分发、公共ILayoutService类型、相关Git历史。未发现新执行轮次、调度/队列或终态异常，不扩展Task/Mission审计。

没有运行或新增UI自动化测试。没有检索到需本批删除的实际UI测试文件；类型检查、语法或构建不能冒充真实键盘验收。新spec索引、docs检查、证据归档和提交由root统一处理。

## 已有真实事实及准确边界

root在396-after/tab37普通Desk budget上确认：滚入可见的Add经真实鼠标点击可进入Detail，Chat读位保留；范围弹窗A1:A2加A2:A3进入原checker，英语→中文→英语标题和错误同步，`LOCALE-394/396 temporary`和范围保留；合法范围permission Confirm实际创建本地临时规则返回列表，列表语言更新，随后经可见删除入口移除该临时规则并确认空态。这些是396/394已有成功，不能被397的键盘失败抹除，也不能拿鼠标成功代替键盘。

同一页面对实际Add按钮执行真实Enter，焦点却仍落到DOCS_NORMAL隐藏contenteditable，A1选区移动到A2，List未进入Detail；Chat scrollTop保持约706.66。读位不再跳转，说明396的preventScroll没有承诺也没有解决按钮被夺焦。root保存`.tmp-spreadsheet-focus-scroll-396/keyboard-add-observation-ax.txt`；audit_ui只读核对其中A2、Add仍可见和focused container字段，具体scrollTop/操作顺序由root实页报告。397尚未在独立新页面复现或验收。

同批新规则卡片hover出现白底白字是398线索，当前只保留root观察，不推断主题/CSS根因、不改样式、不纳入397焦点实现。root仍按当前396-after原20分钟期限收尾，397不要求延长或占用它；后续新无凭据scope由root正常启动。

## 直接触发与共同根因

1. Design `Button`（0.25.1 ESM约199）默认渲染原生button，并设置`data-u-comp="button"`后转发props；语义、disabled、onClick均由原生控件和既有组件负责。
2. `DesktopLayoutService._initUniverFocusListener`（ui约1093）监听window focusin。只要target位于自己的root且data-u-comp命中givingBackFocusElements，就queueMicrotask调用this.focus并提前return。当前列表是app-layout、button、sheet-bar-append-button、render-canvas、workbench-layout。
3. `ILayoutService.focus()`公开合同是重新聚焦当前Univer业务实例；它根据当前focused unit选择Sheets/Docs handler，最终聚焦隐藏编辑输入。给一个原生按钮焦点并不等于用户已执行其动作，更不表示用户要回编辑器。现规则把按钮与无业务交互的容器视为相同，提前收走即将接收Enter/Space的目标。
4. ShortcutService在全局keydown捕获阶段，根据当前上下文选择命令并preventDefault。Sheets `MoveSelectionEnterShortcutItem`（约23664）绑定Enter、priority100、preconditions=`whenSheetEditorFocused`；该条件要求FOCUSING_SHEET和FOCUSING_UNIVER_EDITOR。被夺焦后条件满足，Enter真实参与者是编辑器，原命令将选区移到下一行，吻合A1→A2和List未变。
5. 若按钮正常保有焦点，原focusin后半段会设置FOCUSING_UNIVER为true、FOCUSING_UNIVER_EDITOR为false（getFocusingUniverEditorStatus只认data-u-comp=editor）。同一Enter快捷键便不参与，原生button可按既有onClick激活。Docs BreakLine/Tab/Cursor快捷键也要求FOCUSING_UNIVER_EDITOR，不需要额外Host键盘拦截。

该缺陷早于397，相关公开focus路由未被389/392/394修改。396只改DocSelectionRenderService.focus的preventScroll，保留原焦点目的地；因此它正确地修了读位副作用，却保留“语义按钮一获焦就交还”的独立策略。不能把397归因于同标题缓存、权限checker或工具press行为异常。

## 官方语义与成熟接口

[HTML button定义](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element)将button列为交互控件；[WAI-ARIA Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)规定聚焦按钮后Enter/Space激活，激活后的焦点应由动作含义决定，例如进入对话框、返回触发者或留在当前按钮。自动在focusin时跳回编辑器发生在激活之前，破坏了这一语义。

[WAI-ARIA Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)也把控件键盘导航与动作后的焦点作为控件职责；本方案不实现新的toolbar roving tabindex，只保留库已经提供的原生按钮和显式命令回焦。`ILayoutService`公共类型的focus/registerFocusHandler/容器注册及Disposable清理均保持，不扩展参数或创造第二焦点服务。

## 共享影响面与必要回焦的区分

### 两个真正按钮类别

`sheet-bar-append-button`不是普通div：`SheetBarButton`（sheets-ui约21694）使用Design Button，并用props覆盖data-u-comp。所有当前调用均是原生按钮：新增工作表、SheetBarMenu工作表菜单触发、工作表标签条左右翻页。因此仅删除generic button规则仍会遗漏同类问题，最小共同范围应同时移除这两个按钮类别的自动交还。

剩余三个类别是编辑表面的焦点代理：Desktop `workbench-layout`与Mobile `app-layout`都是tabIndex=-1的div；engine-render真正canvas写`data-u-comp="render-canvas"`、tabIndex=1。它们获得焦点时应交给相应文字输入代理，保留原规则。不是改成按label/role猜测，也不扫描任意DOM子树。

### 当前preset全部Design Button消费族

| 包/实际源区域 | 行为与影响 |
| --- | --- |
| ui Slider | 缩小、放大、百分比菜单按钮；这些操作应可被重复键盘激活或打开菜单，不需在按钮刚获焦时回canvas。滑轨/handle自己的pointer逻辑保持。 |
| sheets-ui权限 | List Add、Detail Confirm/Cancel、权限提示Dialog和用户选择Dialog的确认/取消。按钮激活后原open/close/规则操作决定新上下文，本批不在取得焦点时提前执行任何操作。 |
| sheets-ui DefinedName | 输入确认/取消、容器新增；真实表格名称/公式与编辑state不改，未实页触发的消费只算静态影响。 |
| sheets-ui SheetBarButton | 新增、菜单、左右翻页。新增仍走InsertSheetCommand和既有setAddSheet，菜单由原DropdownMenu处理；不擅自为其中某标签新增return-focus分支。 |
| sheets-ui日期下拉 | DateDropdown中的确认动作，同一原生Button primitive，保持原值与回调。 |
| docs-ui HeaderFooterOptions | 页眉/页脚选项里的原生Button；当前preset登记Docs供表格编辑器，但没有独立Univer Docs产品页面的已实证可达性。静态影响记录，不能宣称文档端全面验收。 |
| sheets-formula-ui MoreFunctions | 下一步、上一步、插入/确认；按钮应先执行自己动作，原functionInfo/参数不改。 |
| sheets-formula-ui RangeSelector | 弹窗取消、确认、添加范围；保留编辑器blur/focus、参数和弹窗自己的焦点作用域。 |
| sheets-numfmt-ui | 面板确认/取消；原onChange callback和close流程不改，不顺便修类别/语言快照。 |

Design内部还复用同一Button于通用Dialog footer、Confirm footer、ColorPicker自定义颜色Confirm/Cancel及GradientColorPicker。当前真正能从表格到达的ColorPicker/Dialog路径已在389/394/396使用，其余仅静态覆盖。Design的asChild公开能力仍原样转发；不删除data-u-comp属性，也不修改每个业务按钮。

自动交还条件还有root.contains(target)限制。389将弹层挂在独立portalContainer，正常在body、全屏在对应Frame；它通常是workbench root之外的物理节点，不能据“使用Button”就断言所有弹窗按钮此前均被该规则夺焦。弹窗/菜单的focus scope、原onCloseAutoFocus和触发者返回仍归成熟库所有，本改动只使root内语义按钮不被当作容器。必要后态仍要检验普通/全屏弹层，避免用静态范围替代实际结果。

### 当前已经存在的动作时回焦

- `ToolbarButton`本身是原生button，已有实现没有data-u-comp=button。`ToolbarItem.executeCommand`（ui约3672）明确先layoutService.focus再commandService.executeCommand；Button型、selector型、字体/颜色等命令仍走该成熟动作路径。移除focusin中的两个类别不会删它或改变命令参数。
- DesktopContextMenu onOptionSelect先执行原command，再调用layoutService.focus并close；字体选择FontFamilyItem、Numfmt菜单等同样有明确回焦。它们只在用户实际选中动作时执行，保留。
- 真实编辑器入口、canvas/workbench代理、Sheets/Docs注册focus handler仍工作，396的preventScroll保持。原EditorService窗口focus响应对非sheet editor执行blur，但不强制清空选区（只有force才清空），输入数据/当前工作簿不由此次列表改动重置。
- Sidebar close是库内另一个原生button，未带generic data-u-comp标记，打开侧栏聚焦关闭按钮的effect原样保留。通用Dialog/Radix菜单以原生焦点管理完成打开/关闭，397不替换它们。

此前More Colors是无href的`a`，没有原生button键盘语义；取消后body焦点也已记录。移除按钮自动交还不会赋予该链接Tab/Enter/Space行为，也不创建Dialog trigger，必须继续明确未修边界。菜单中的其它div点击控件、图标按钮缺名称等也不能因397而宣称全库无障碍完整。

## 待root批准的最小方案

仅在ui现有`givingBackFocusElements`列表中移除`"button"`和`"sheet-bar-append-button"`，保留app-layout/render-canvas/workbench-layout。不改window focusin监听与销毁、不添加event.preventDefault/stopPropagation、全局键盘handle、人工click、Host判断、focus延时或按钮label特判。按钮走原上下文更新分支，显式ILayoutService.focus仍按业务动作返回编辑器；原生disabled/onClick、各弹层焦点作用域均保留。

生产范围只扩展现有`patches/@univerjs%2Fui@0.25.1.patch`的四runtime：lib/index.js、lib/es/index.js、lib/cjs/index.js、lib/umd/index.js。当前已有13个patch文件段，397没有新类型/语言/CSS文件，因此总文件段仍应13。ESM/CJS列表名givingBackFocusElements，UMD列表`Ri`、消费类`zi`；准确目标为`Ri=[app-layout,button,sheet-bar-append-button,render-canvas,workbench-layout]`，只移两项，不字符串替换全部Button或其它菜单语义。

公共ILayoutService和Design Button签名不变，392名称/Sidebar locale memo、389宿主及菜单归属、394错误和396no-scroll继续保留。正常Bun patch-commit/frozen install后核对preset实际`.bun/@univerjs+ui@0.25.1+fb6a3c66a95eaf3d`消费；不把root patch编辑副本当应用入口。package.json已有ui登记无需新项，bun.lock若正常工具产生变化仅保留真实必要结果，无源映射文件可同步。未批准前不实施。

## 真实桌面验收与风险

root新建自己的无凭据正常`/ui` scope，不使用模型或合成产物。以前述tab37真实键盘失败为已知前态；若环境/输入方式变化，应先确认旧行为，不能只用定位器强制click替代键盘。全部截图人工查看，不新增/运行任何UI自动化。

1. 普通Desk budget权限List，使用真实Tab/Shift+Tab到Add，先截图/AX确认按钮实际焦点仍在，再Enter一次应进入Detail；另一次重新到List，Space按下/释放后应激活。按键前后记录Chat读位和单元格选区，不能把A1→A2的编辑器Enter当按钮成功。
2. 在同一详情使用实际RangeSelector完成范围编辑，键盘到Add range/Confirm/Cancel核对各自动作；394英/中错误和标题仍正确，临时说明与范围保持。真正合法permission Confirm返回列表及自有临时规则清理只按实际完成记录，不宣称原delete div已经具备键盘语义。
3. 用百分比按钮键盘打开菜单、选择原值或可逆缩放再恢复；再以鼠标验证正常Add/菜单点击和396外层读位仍保持。全屏独立复核同一语义；移动端未做明确保留。
4. SheetBarButton至少通过真实焦点确认工作表菜单触发可键盘激活；新增临时sheet与左右滚动若可在自有实例明确清理则按实际做，未出现多sheet溢出状态就不宣称左右翻页视觉通过。新增/菜单后需要编辑时用原canvas/输入入口，不加测试专用回焦。
5. 明确保留动作时编辑回焦：当前adapter toolbar:false，不能虚构toolbar截图。可通过当前可见字体/上下文菜单或Numfmt原入口，实际执行可逆编辑动作，确认原command生效且编辑器后续输入/导航可用；工具条/独立Docs全功能仅静态审查，不扩大页面配置为验收便利。
6. 独立ColorPicker/More Colors Dialog继续核对内部原生Confirm/Cancel可聚焦激活与Esc层次，但More Colors无href及取消回body不算本批已修。若root内或跨portal再出现焦点争抢，留证据先分析，不能继续添加遍历/延时补丁。

风险：保留按钮焦点后，直接敲字不会自动输入canvas，这符合焦点真实归属，用户可通过原编辑入口返回；原显式命令回焦不可误删。docs-ui EditorService已有blur响应可能使正在编辑的非sheet输入提交/结束，需真实RangeSelector/公式输入复核，不更换其旧数据契约。异步动作、删除按钮后焦点位置由原组件生命周期决定，397只修激活前被夺焦，不承诺所有动作后焦点都已理想。多实例、完整输入法、移动及独立Univer Docs尚未实页。

安装/typecheck/build/docs检查只用于整合，不能替代真实Tab/Enter/Space、截图和动作结果。所有新scope在固定原期限内正常关闭自有tab与owner/launcher，记录实际join；不为397延长396-after期限。最终只报告实际通过范围和剩余边界，分别提交397焦点策略与其它批次。

## 交接

完整方案已落盘，生产尚未批准或修改。root审读后决定实施；audit_ui不改共享索引或其它spec，394/396本次新增真实成功由root归档。398规则卡片hover颜色仅为后续线索；More Colors等旧边界不被397抹除。root负责文档检查、实页、证据、范围commit/upstream合并与push，没有tag/Release授权或动作。

## Root方案审读

Root已完整重读Recall、全部Design/SheetBar/Shortcut/Editor入口、公共focus与显式命令回焦、原More Colors和398边界，并核查官方HTML/WAI-ARIA按钮语义。接受本方案最小范围：仅移除现有给回焦列表中两种原生按钮类别，保留三个容器/canvas代理、整个focusin/context/lifecycle和业务显式回焦。当前仍在394/396归档交付阶段，本批先索引方案，不开始397生产；待394/396范围提交和正常同步完成再实施、真实Tab/Enter/Space及其它可达入口复核，不把397先行源码当上一批验收事实。

## 最后实施前独立调用链复核

audit_ui再次读取当前实际安装四runtime，确认给回焦列表仍为五项，397尚未实施；没有发现需要扩大批准范围的新调用链问题。原生Design Button与覆盖marker的SheetBarButton均需保留真实按钮焦点；剩余两个layout div/canvas代理、Shortcut上下文更新和业务显式layoutService.focus保持。Sheets Enter及Docs Enter/Tab/光标的FOCUSING_UNIVER_EDITOR前置条件已复核，不能另加Host键盘规则。

实施后四分发/UMD独立审查清单保存于`.tmp-spreadsheet-button-focus-397/independent-review-checklist.md`：精确两数组项、UMD Ri/zi绑定、源作用域、13个既有patch文件段、实际preset消费、类型/lifecycle和389/392/394/396保持，以及真正Tab/Enter/Space交接。它是人工静态review清单，不是新增UI测试。

398卡片hover和More Colors有限调查另存自有scratch `follow-up-398-notes.md`，未新建398规格或动共享索引：卡片/操作hover缺dark背景与白色文字组合已有源码支持，精确颜色仍待实页；More Colors除无href语义外，还存在Design包装没有Radix Trigger返回焦点归属的独立线索，不能混入397或宣称移除两列表项会一并修复。

## Root实施批准

394提交`ea43153dc8d2c95b328d266463fb9ddbf853a5dc`与396提交`5d0df5d1a8619bbdc4a496760f55c0345b1679bf`已完成范围提交，fresh fetch与普通upstream merge确认一致；正常push检查八包类型、路由、文档、控制owner、架构、包拓扑和凭据模式均通过，结果Everything up-to-date。没有混入配置或其它并行修改。Root据已落盘方案开始精确四runtime数组修改，独立审查、私有构建与新的无凭据真实桌面scope；397未有后态前不宣称键盘问题已修复。

## 实施后独立静态复核

audit_ui只读复核Root的`apply-vendor.mjs`、四份`vendor-before`、最终UI patch和重新安装后的真实消费包，结果保存于`.tmp-spreadsheet-button-focus-397/independent-review.json`。这是源码/分发/构建产物审查，不是UI自动化或页面验收。

- 从`packages/overlay/node_modules/@univerjs/preset-sheets-core/package.json`的真实路径解析UI，落到`.bun/@univerjs+ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/ui`。该包四runtime与Root patch工作副本逐份相同，不能仅以工作副本推断实际安装成功。
- 每份runtime均只有一个目标数组：普通/ESM/CJS是`givingBackFocusElements`，UMD是`Ri`。五项准确变为`app-layout`、`render-canvas`、`workbench-layout`三项，顺序不变；四份解析诊断均为0。排除该唯一数组范围后，完整文件与各自保存前态完全相同，因此没有额外绑定、import、焦点监听、命令、订阅、销毁或公共签名变更。
- UMD `zi._initUniverFocusListener`仍消费`Ri.some`；root.contains条件、命中后的queueMicrotask、未命中的现有FOCUSING_UNIVER/FOCUSING_UNIVER_EDITOR上下文更新和disposeWithMe均原样保留。三个编辑容器/canvas代理与业务显式layoutService.focus仍归原入口。389弹层宿主及菜单事件归属、392语言订阅及Sidebar memo没有在本次被覆盖。
- 初次独立审查发现补丁首3行意外登记空`.bun-tag-4961aa997135c875`缓存文件，已向Root报告。Root保存原patch为`ui.patch-with-empty-cache`，只剔除该精确空段并完成`install-final.log`所记正常frozen install。最终patch准确13个文件段；除四runtime之外的9个既有locale/type段与`ui.patch-before`逐段完全相同，没有缓存段、额外类型或语言改动。
- 对Root已构建`ui-after/assets/SpreadsheetArtifact-CwAEJkjF.js`再次只读审查，实际输出唯一对应数组为`Bst=["app-layout","render-canvas","workbench-layout"]`，Desktop focus listener消费同一`Bst`并保留原context/生命周期分支。清理空缓存段后重新安装的runtime与这份已构建焦点语义一致。构建日志记55.18s完成；类型日志是`tsc --noEmit`，进程成功状态由Root持有，不把空输出自称为完整验收。

独立复核没有发现剩余具体实现错误；此前缓存段已解决。真实Tab/Enter/Space、权限动作、SheetBar、普通/全屏读位、输入及弹层焦点仍由Root亲自验收并另记精确结果。此段不宣称移动端、独立Docs、全部输入法或More Colors/398边界已完成，也不把静态一致性替代截图人工复核。

## 最终真实验收与准确边界

Root在397-after/tab38复用真实Desk budget完成直接交互并人工查看全部17张JPEG；原始40个观察记录、真实CSV、构建/安装和原owner记录已按明确清单归档。[最终人工摘要](../../artifacts/2026-10-13-spreadsheet-button-focus-397/observations/final-review.json)保留原review时间；归档未重跑其历史脚本或改写旧观察。

- 普通视图真实Tab从Sidebar close到原生Add，Enter进入Detail，Chat scrollTop前后均724.6666870117188；中文同入口Tab/Space也真正打开详情。范围Dialog经Tab/Enter添加第二范围，Tab/Space Confirm将A1:A2/A2:A3送入原checker，英文重叠错误随同实例中文切换；临时详情与范围保留，主Cancel可Tab/Space取消。
- 合法A1、FOCUS-397 temporary经Shift+Tab到Confirm、Enter真正创建本地规则返回List。只删除该临时规则后，真实空态确认清理；这不是把未保存Cancel算作规则创建。全屏同类Add的Tab/Space、范围Dialog Cancel的Tab/Enter与主Detail Cancel的Tab/Space均完成，B3及同实例9/5/14保持，没有保存全屏规则。
- 百分比控件从鼠标100→90后，真实Tab到90%并Enter展开菜单。两次Down/Return中途实际选到75，随后真实100菜单项恢复原缩放；不得将中途75追认为100。
- SheetBarMenu真正成功路径为先通过定位器press聚焦append，再真实Tab到菜单按钮、Enter展开。最初从BODY按Escape后Shift+Tab/Tab未聚焦目标，原`sheet-menu-tab-focused.jpg`保留为失败；成功是另一次`sheet-menu-real-tab-focused.jpg`。真实Shift+Tab回append、Space创建工作表1；仅该新空表通过可见删除确认Tab/Enter清理，原清单仍选中。多表溢出左右分页未体验。
- 实际A2 context Copy后焦点返回DOCS_NORMAL，Down移至A3；双击B2、Ctrl+A、paste9、Return得到9/5/14。真实Download取得[61字节CSV](../../artifacts/2026-10-13-spreadsheet-button-focus-397/downloads/edited-normal.csv.gz)，[原字节检查](../../artifacts/2026-10-13-spreadsheet-button-focus-397/observations/csv-byte-review.json)确认UTF-8字节序标记、三CRLF、末行无换行。这只覆盖本实例编辑及可见命令回焦，不宣称卸载后持久化或全部toolbar命令。

颜色Dialog通过真实More colors点击、四次Tab到Cancel、Space取消已完成，但焦点回BODY；随后一次Escape同时关闭可见context和颜色菜单。因此本批不认证逐层Escape，也不宣称More Colors无href及返回焦点已修。中文范围/删除Dialog仍观察到英文Close无障碍名称，和规则卡片hover浅底浅字均列后续独立候选。完整输入法、独立Docs、移动端、多实例和全部溢出/工具条路径未实页，不包装为全部验收。

## 最终整合、关闭与归档冻结

正常patch prepare/commit和首次install exit0后，独立review发现空缓存段；Root保存被拒绝的中间patch并精确剔除3行，再frozen install exit0。最终13文件段、四runtime唯一数组改动及原389/392保留均已复核；中间patch不作为最终实施。类型检查session68786 exit0、私有build session11707 exit0（55.18s）由Root真实回执确认。

tab38关闭确认记录为2026-10-13T15:18:16.300Z，英语偏好已恢复，临时规则与空表已真实清理。自有owner PID19968、occurrence `bb4a7ac4-8027-4169-9fd5-4eaaed037d12`正常终态；launcher92591实际join exit0，elapsed1000903ms在原20分钟期限内。没有服务延长、凭据使用、新模型执行或用户窗口操作。原物理事实见[关闭记录](../../artifacts/2026-10-13-spreadsheet-button-focus-397/observations/page-closed.json)与[完整证据入口](../../artifacts/2026-10-13-spreadsheet-button-focus-397/README.md)。

归档仅包含76个显式源文件及README/manifest/archive-check共79文件：17张原JPEG、40个观察、4个实施/复核记录、7个整合日志、最终与被拒绝中间patch各1份、实际CSV1份和自有scope文件5份。15个gzip保留原字节，无whole vendor/ui-build、数据库、环境或auth/models。精确源/目标及字节数见[manifest](../../artifacts/2026-10-13-spreadsheet-button-focus-397/archive-manifest.json)，[归档检查](../../artifacts/2026-10-13-spreadsheet-button-focus-397/archive-check.json)只证明允许清单字节恢复、有限凭据模式与局部链接完整性，不充当UI测试。共享文档精确ops已由Root自行准备并应用；audit_ui遵照后续指令未重复生成或插入同内容。Root继续负责最终文档检查、范围提交与正常同步；audit_ui未修改共享文档、生产或提交。
