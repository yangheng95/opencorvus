# 396 嵌入电子表格交还编辑焦点时保留外层读位

## 当前状态与 Recall

本记录已完成独立调查、root批准的四runtime修复及限定桌面真实后态，最终事实见末节。问题在394真实后态期间暴露，不把标题修复或静态复核误判为根因。用户持续目标仍是按批调查、先规格再实施、真实桌面与人工看图、聚焦检查、范围提交、正常合并上游和推送后继续。root负责生产/页面；audit_ui仅按授权写396/394规格、两批证据和自有scratch，不修改生产或共享文档，不操作页面/服务/模型/凭据，不提交、不再次委托。

已重读[394权限面板](2026-10-13-spreadsheet-permission-panel-locale-394.md)、[392语言与Sidebar投影](2026-10-13-spreadsheet-accessibility-locale-392.md)、[389弹层宿主](2026-10-13-spreadsheet-fullscreen-popups-389.md)、[391当前视图编辑说明](2026-10-13-spreadsheet-local-edit-guidance-391.md)、[07-panel当前架构](../../current/architecture/07-panel.md)。394五vendor文件已实现，private build/install/type均exit0，尚未完成真实后态；392已提交`830972c0d`。396须有自己明确范围，394和396可在新的无凭据自有scope联合真实验收，但分别提交，不混入其它Provider/MCP/compaction并行改动。

验收目标：普通Chat里表格侧栏按钮已经滚动到可见位置时，真实点击能完成其原动作，焦点交还不会把Chat拉回上方或将pointerup落点移到画布；既有编辑焦点、selection、文字/公式输入、真正光标导航的内部滚动、普通与全屏模式保持。采用成熟DOM（Document Object Model，文档对象模型）focus选项修唯一原生入口，不按标题/按钮文案绕路、不补全局scrollTop复位、不取消库焦点管理、不以全屏代替普通视图验收。

已读/横查：唯一Spreadsheet适配器、SpreadsheetArtifact/ArtifactFrame/InteractiveArtifactPart、Conversation焦点pin/测量/读位与main全局pointer监听；安装0.25.1 Design Button、UI DesktopLayoutService/Sidebar/DesktopSidebarService、Sheets与MobileSheets焦点handler、Docs SelectionRender/EditorService/Editor/SelectionController/光标与滚动控制器、公式与RangeSelector、Numfmt返回焦点入口和公开类型。全仓overlay生产Univer导入仍只有该Spreadsheet适配器；原DocumentArtifact是其它渲染实现，不伪称存在Univer独立文档产品页面。

权威依据：[HTML Standard focus算法](https://html.spec.whatwg.org/multipage/interaction.html#dom-focus-dev)与[MDN HTMLElement.focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)明确默认preventScroll为false，会将被聚焦元素滚入视图；preventScroll:true保留聚焦本身，抑制这一浏览器自动滚动。以下源码引用以实际安装包为准，不假定线上新版Univer API。

禁止任何UI（User Interface，用户界面）自动化测试、DOM/组件渲染测试、文案断言、Playwright test或截图基线。所有实际交互和截图由root完成，本调查不运行测试或浏览器。没有Task/Mission/Session执行轮次、调度/队列/终态异常证据，不扩展到运行器横审；此处需横审的是所有共享焦点生产入口。

## 实页事实与尚未证明的时序

root的394后态自有PID83648/tab36中：全屏workspace的权限List Add可以进入Detail；普通视图将Add滚入可见后，实际click、另一种真实click及Enter尝试都回到Chat上方，焦点/选区回画布，List仍原样。AX（Accessibility Tree，可访问性树）和只读DOM观察聚焦目标为hidden `DOCS_NORMAL` contenteditable，选区变A2。runtime只见applyDir，没有对应错误。原392构建的394-before普通Add、真实范围弹窗和同实例语言切换曾成功，故不能直接宣告394引入，也不能根据没有error称交互成功。

当前可确认“按钮交还焦点→隐藏编辑器成为activeElement→外层读位跳动/原动作未完成”与源码一致。`pointerdown`默认聚焦按钮之后、微任务交还焦点导致外层滚动、再使`pointerup/click`目标改变是有明确机制支持的解释；本阶段没有逐事件时间戳轨迹，不伪称已捕获这条微观时序。具体滚动祖先、普通/全屏几何和输入代理位置应在下次真实前后态留只读DOM数据；不能凭工具超时或工具名推断自动化平台坏了。

该owner原20分钟期限为root记录的13:50:57→14:10:57，root按原期限关闭自有页面/owner，不延期。未收到物理close/join前不提前宣称已关。新396/394联合后态使用新的无凭据正常scope，不复用过期owner或修改运行器上限。

## 可以排除的标题比较路径

`DesktopSidebarService.open`（ui ESM约7155）每次创建新的`{...params,id,visible:true}`并向Subject发射，没有header.title比较或distinctUntilChanged。Sidebar使用sidebarOptions对象与currentLocale作memo依赖，复制header/children/footer为原key的CustomLabel；其useObservable观察的是Subject原对象，没有标题相等规则。

List Add的onClick同步调用open，children.showDetail=true；`SheetPermissionPanel`据此返回Detail而不是List，React类型不同，非同key使内容永远不更新。394把两标题改成同一个语言键不影响这个控制流。若事件真正到达List Add handler，应该进入Detail；全屏成功也提供了实际对照。没有依据添加标题nonce、随机key、第二open、timeout或直接调用内部operation来绕过普通点击。

## 已定位的共同焦点链

| 层级 | 真实定义和行为 |
| --- | --- |
| Design Button | `@univerjs/design/lib/es/index.js:199`默认渲染原生button并设`data-u-comp="button"`；权限Add/Confirm/Cancel都复用它。它没有为了本批新增preventDefault或pointer截获。 |
| UI焦点路由 | `DesktopLayoutService`的givingBackFocusElements包含button、app-layout、sheet-bar-append-button、render-canvas、workbench-layout。window focusin（ui约1093）发现目标在自己的root内且data-u-comp匹配后，queueMicrotask调用this.focus。 |
| 当前文档/表格路由 | DesktopLayoutService.focus根据当前focused unit类型调用已登记handler；SheetUIController（sheets-ui约24129）取当前DOC renderer的DocSelectionRenderService再focus。它没有硬编码DOCS_NORMAL；该ID是root当前实页的具体目标。DocUIController同样为真正DOC unit登记该服务。 |
| 唯一原生输入焦点 | `DocSelectionRenderService.focus`（docs-ui约7594）只有`this._input.focus()`，没有preventScroll。ESM/CJS/lib/UMD四份同语义，当前每份恰一处该类方法。 |
| 输入代理的实际布局 | `_initDOM`把fixed、初始left/top=0的容器放到本Univer root；`_inputParent`是1×1 overflow:hidden，内部contenteditable的data-u-comp=editor、id为`__editor_${unitId}`，文字/光标透明。它是键盘/输入法/剪贴板代理，不是应被浏览器滚到中心的可见正文。 |

`disableAutoFocus:true`在当前adapter配置中仅代表启动自动聚焦策略，不能关闭这条用户交互后的window focusin路由；因此旧配置没有根治。Fullscreen宿主改变布局/滚动祖先，能使同一焦点路径不移动按钮，解释“全屏成功”为什么不能替代普通状态；具体祖先几何仍以实页为准。

SpreadsheetArtifact只在onMount创建runtime，语言effect更新同一个实例，onCleanup释放；ArtifactFrame只有fullscreen状态和请求，没有button聚焦或外层scroll处理。InteractiveArtifactPart的resource依据session/directory/artifact身份，没有按侧栏标题更新或点击重建分支。Conversation focusin/out只维护focusedItemID以pin虚拟卡片；显式scrollIntoView只由独立卡片滚动请求触发。click/ResizeObserver可调度测量，measuredContentChanged主要通知已有scrollController及在宽度变化时恢复读位，没有给Univer按钮直接“滚到顶”的处理。不能完全排除滚动后的虚拟测量作为次生影响，但已有原生focus路径先解释了activeElement与外层读位变化，暂无证据改Chat读位算法。

## 所有当前生产焦点调用与必要的内部滚动

对当前preset注册插件按直接/转发层完整分类；不是把每个`.focus()`都改成同一策略。

| 调用族 | 如何到唯一输入入口 | 仍保留的职责 |
| --- | --- | --- |
| DocSelectionRenderService自身 | activate在可聚焦/force时调用focus；addDocRanges/sync→_updateInputPosition，存在可见anchor则定位代理再activate，无anchor/不可见anchor时直接focus。 | 原输入位置、canFocusing/forceFocus、selection数据和事件不改。 |
| 普通/全屏Sheets UI | SheetUIController.registerFocusHandler→当前DOC renderer；NamedRange编辑返回也直接调用DocSelectionRenderService.focus；单元格编辑/公式栏入口可经IEditorService。 | 当前focused unit和选区不改；同一primitive覆盖普通和全屏，不增加模式分支。 |
| Editor与IEditorService | Editor.focus先设当前DOC unit再转DocSelectionRenderService；IEditorService.focus保留原blur、EDITOR_ACTIVATED/context、focus ID及focus$发射后经Editor。 | 现有输入激活、焦点归属和销毁合同原样保留。 |
| Sheets公式/范围控件 | sheets-formula-ui约2855/3865/4119/4702的editorService.focus/editor.focus，包含公式输入、建议/编辑器返回和RangeSelector公开selectorRef.focus。 | 保留原编辑内容、popup显隐、请求顺序和ranges；不为权限入口造专用focus。 |
| Numfmt/菜单/工具条 | sheets-numfmt-ui约1464/1473、ui各选择菜单/上下文菜单回调调用layoutService.focus，再按当前unit路由。 | 所有旧业务动作与返回编辑语义保留，不逐控件覆盖onClick。 |
| Docs unit与render controller | DocUIController handler→服务；DocSelectionRenderController的交互/非内部文档skeleton初始化也转IEditorService或服务focus。 | Docs共用服务静态受影响；本应用尚无独立Univer文档产物真实验收，不能宣称已覆盖完整文档编辑器。 |
| 移动插件 | MobileSheetUIController登记同样的当前DOC focus handler。 | 静态共用效果明确，默认桌面不新增移动验收或移动特判。 |

ui的真实可见DOM控件focus（Sidebar关闭按钮、sheet tab/rename input、dialog返回目标、字体/数值输入）不是DocSelectionRenderService代理，保持原生默认滚动；它们需要让键盘用户看到真实控件，不做全库`.focus()`替换。App composer、dock等焦点也不属于本方案。

“焦点应回编辑器”和“光标应滚到可见”已有分工：

- Docs的`DocBackScrollRenderController`（约15344）订阅当前unit的编辑selection，排除DOCS_NORMAL，读取真实glyph/anchor与viewport边界，调用`viewport.scrollByBarDeltaValue`；DocMoveCursorController（约16243）移动光标后显式scrollToRange。真实文档navigation/文字编辑需要的内部滚动来自这里，不由1px代理的浏览器滚动承担。
- Sheets的`SheetsScrollRenderController`（约7232起）处理SetSelectionsOperation的reveal、ScrollToCellOperation、ExpandSelection和scrollToRange/cell，以实际行列/冻结区/viewport边界发送ScrollCommand；Name Box跳转同样明确ScrollToCellCommand。单元格光标揭示不能替换成浏览器滚Chat。
- Docs拖选使用ScrollTimer，指针越界时滚动scene；输入代理_updateInputPosition根据实际anchor更新位置。更改focus选项不会删除这些显示/定位/滚动调用。

当前已读生产调用没有“必须把这个透明输入代理滚入Chat”的独立需求。真正独立Docs产品、多实例或所有输入法没有实页证据，因此结论限于上述源码分工和当前桌面目标；后态须验证可见canvas内的导航/文本滚动仍成立，不能用理论推断替代。

## 最小单源实现，待root批准

仅将docs-ui `DocSelectionRenderService.focus()`中唯一原生调用改为`this._input.focus({ preventScroll: true })`。这是标准FocusOptions，focus事件、activeElement、键盘接收和原选择逻辑仍发生；只去掉浏览器为隐藏代理自动滚动祖先的副作用。不添加新wrapper、optional flag、host配置、延时、scrollTop保存恢复、全局事件阻断或失焦后重试。

保留`focus(): void`公开声明，不改类型签名，不增加第二API。保留`_ensureHostContainer`、root注册/销毁、固定容器与输入法位置、fullscreen所有权、对外事件流、DocBackScroll/SheetsScroll逻辑及所有原focus调用。也不修改DesktopLayoutService的givingBackFocusElements：当前方案修“交还焦点引发滚动”，没有承诺改变整库按钮键盘焦点政策。

重要边界：preventScroll不会阻止DesktopLayoutService把button焦点交回editor。鼠标点击有望因按钮不再位移而完成，但单独Tab聚焦按钮后Enter/Space是否仍能激活需要真实验证；若按钮仍被立即夺焦而无法键盘激活，必须作为另一条已证实交互合同继续分析，不能宣称396完成全部键盘可达性，亦不能静默扩成全局focus路由重写。

新增`patches/@univerjs%2Fdocs-ui@0.25.1.patch`并按现有root package.json/bun.lock登记，精确四runtime：`lib/index.js`、`lib/es/index.js`、`lib/cjs/index.js`、`lib/umd/index.js`。当前未有docs-ui补丁；此包四分发/公开lib入口均需一致，无source map或src树。ESM/CJS类名DocSelectionRenderService，UMD类变量`Y`中的`focus(){this._input.focus()}`是实际目标，必须按类方法作用域处理，不能替换其它可见输入的focus。无新语言资源、无DOM结构/CSS或Adapter/Chat修改。保持所有389/392/394补丁，不夹带本地其它包修改。

实际生产路径从overlay preset的真实package.json解析：`node_modules/.bun/@univerjs+docs-ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/docs-ui`；root `node_modules/@univerjs/docs-ui`在patch流程中只是编辑副本。正常patch-commit/frozen install之后再次核对真实preset消费和四分发，保留工具失败真实结果，禁止跳hook。

## 真实前后态与验收边界

root在独立、无凭据、无模型的新正常`/ui` scope复用真实Desk budget；396前态已有394失败事实，若新scope环境不同，应先对当前原docs-ui重现并记录。不要仅用全屏、强制JS click或直接sidebarService.open代替普通真实入口。

1. 普通视图滚动Chat使权限List Add完全可见，记录Chat及侧栏scrollTop、button rect、input代理rect/祖先、activeElement与当前选区；用真实鼠标点击，后态应进入Detail并保持外层读位。记录点击前后截图，区分侧栏自身必要滚动与Chat跳到User顶。
2. 正常进入394真实Select data range弹窗，Add range产生重叠，弹窗Confirm回详情；英/中往返标题与错误跟随，ranges/说明保留。合法范围Confirm成功返回列表及删除临时规则仍需真正完成，不能因396允许Add就宣称394全部通过。
3. 复核键盘Tab/Enter/Space现有按钮路径，准确记录焦点是否被交还。若仍不能激活，保留未完成边界和具体控制流，不把鼠标成功冒充键盘通过。
4. 同一普通工作簿实际输入/编辑单元格、公式栏，移动到当前viewport之外的单元格并返回，确认canvas内部导航仍reveal目标且外层Chat读位不被代理focus改动；范围编辑器文字输入、回焦、中文输入只按实际完成项记。完整输入法、多实例、独立Docs、移动端若未做均明确未验收。
5. 全屏单独实例执行对应按钮、输入与范围流程，记录该实例当前值；不能将普通/全屏之间可能发生的卸载重建当作编辑持久化。保留391当前视图提示/真实CSV导出合同。恢复英语并正常关闭自有tab、原owner与launcher，记录实际exit/join；每scope遵守原固定期限。

正常安装、typecheck/build和docs检查不能替代上述页面。396是UI焦点行为变更，不新增或运行UI自动化；真实正向动作、截图和原checker结果就是必要行为证据。若最小preventScroll修复后普通Add仍失败，必须据真实焦点/几何再审，不能继续叠加未知补丁或把工具归咎为根因。

## 交接

本阶段只完成读码、权威语义核对和396方案，尚未批准或实现。root审读后决定精确生产变更并负责真实页面、索引、文档检查和独立提交。394当前是UI交互阻塞而非标题比较故障；联合验收若通过，也应分别描述394语言状态修复与396隐藏输入焦点滚动修复，不混淆前态事实或扩大交付声明。

## Root实施批准与原owner关闭事实

Root已完整重读Recall、全focus定义/转发、公开签名与内部导航滚动分工、实际396候选和394阻塞。394-after已于原deadline前正常停止，launcher8713退出0、terminal PID83648 elapsed784528ms，18505/18506/18507无listener；没有延长owner或模型凭据。

批准精确单源最小改动：四runtime的DocSelectionRenderService.focus唯一隐藏输入调用使用标准preventScroll:true，保持公开focus():void和所有内部显示导航不变。按正式Bun patch新增docs-ui登记和frozen安装，并用真实当前桌面新scope联合394复核；Root负责生产实施与页面，不预承诺button交还政策或Tab可达性。若普通Add仍失败先保留真实差异重新分析，不继续叠未知代码。四scope393成功/失败闭环与f6c93a756范围提交独立，不混入本批。

## 独立静态复核

audit_ui已只读复核root的apply-vendor.mjs、vendor-files清单、新docs-ui patch与从overlay preset真实解析的`.bun`消费文件。四runtime每份只改DocSelectionRenderService的原生focus方法；UMD正确定位类`Y`，调用精确为`this._input.focus({ preventScroll: true })`，没有下划线选项名或作用域变量污染。每份文件在该方法之外与保存前态相同，四runtime语法解析零诊断；patch只有4个runtime文件段，没有空缓存、类型或其它包内容。

公开`focus(): void`声明不变，editor宿主/销毁、内部导航/DocBackScroll、可见控件focus均保留。实际sheets-ui仍包含394的当前ranges派生错误和ranges-only回调，ui/design没有本批差异。package.json只新增docs-ui登记；Bun lock同一区域有既有条目重排，语义新增只有docs-ui，旧patch条目保留。正常patch-commit与frozen install日志已读取，未发现具体实现问题。

完整静态反馈暂存`.tmp-spreadsheet-focus-scroll-396/independent-review.json`。本复核没有运行UI自动化、页面、服务或模型，不能替代普通Add/Chat读位、394合法Confirm和清理、内部导航输入与全屏的真实后态；button交还策略的键盘边界仍需root按实际交互说明。root的构建/类型检查与新scope物理退出结果另行归档。

## 最终真实后态、未通过边界与收尾

root在新396-after正常18505/ui、tab37完成联合394实页：普通Add滚入可见后真实鼠标一次点击进入详情，Chat scrollTop 724.6666870117188→724.6666870117188，hidden DOCS_NORMAL仍是activeElement。它证明保留实际focus同时抑制祖先滚动；没有取消编辑器focus或在Host回滚scrollTop。394真实重叠范围、标题/错误中英往返、合法范围permission Confirm创建本地临时规则返回列表、列表EN→ZH及只删该临时规则后的空态都已成功。

输入验证的实际成功方法是双击B2、Ctrl+A选择编辑文本、paste9、Return，得到9/5/14并自然重算；更早直接按键/typeText9仍为7/5/12，不追认为成功。Name Box B20触发canvas内部reveal，Chat前后285.3333435058594；composer裁住canvas底部后root另手动滚Chat查看，未把这一步说成自动滚动，随后回B3。实际Download得到61字节CSV，精确9/5/14、UTF-8 BOM和三处CRLF；首次内联Node引号错误未完成校验，保存脚本对同一文件重跑通过。

全屏观察到9/5/14，实际菜单/Add可用；直接范围粘贴未替换原B3而连接文本，原两张图保留且该实验取消。正式重叠证明来自新干净Select data range Dialog，中文错误可见，最后取消未保存详情。键盘Add Enter仍把A1移到A2并保持List、Chat约706.66，此为已实证397边界，不宣称396修复按钮键盘激活。规则hover浅底浅字另列398；独立Docs、移动、多实例、完整IME和所有导航类型均未资格化。

[396唯一联合归档](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/README.md)、[人工摘要](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/observations/final-review.json)、[字节检查](../../artifacts/2026-10-13-spreadsheet-focus-scroll-396/observations/csv-byte-review.json)集中保存最终14张截图、AX/geometry和明确失败；394前态/首次失败见[独立目录](../../artifacts/2026-10-13-spreadsheet-permission-panel-locale-394/README.md)。截图实际JPEG，归档.jpg不改字节，manifest记录scratch.png源名；日志/CSV/patch使用gzip保留字节。没有复制运行环境、构建产物、全vendor、CanonicalDB、auth/models。

正常Bun patch/frozeninstall、build81426/type86767均exit0，构建1m1s。最终owner PID38364、occurrence `8706e3cf-1df4-415e-99d9-25d4a34c6cc9`、launcher53861实际join exit0，terminal elapsed1028915ms，在原20分钟期限内正常停止，tab37关闭、英语恢复。页面关闭记录区分14:30:39.819Z请求和14:32:39.348Z事后确认，不把它们当同一物理时刻。整个scope无凭据/模型执行。当前396鼠标与读位授权范围完成；root负责最终文档检查、范围提交和正常upstream合并/push，397/398独立继续。
