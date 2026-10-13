# 389 电子表格全屏弹层归属调查

## Recall

用户要求持续按批次并行体验和调查 OpenCorvus 的 UI/UX（User Interface/User Experience，用户界面与体验）、功能与缺陷，先完成根因/影响分析并落盘，再实施有证据的修复、真实桌面页面与截图人工复核、聚焦正向检查及必要的授权 GPT-6.1 Sol 验收，范围提交、合并上游与正常推送后继续。主 agent拥有页面、服务、模型、实现、归档与Git交付；audit_ui本子任务只获准创建本389规格，不修改产品、387或共享索引，不操作浏览器、不启动服务/模型、不查找或运行UI自动化、不再次委托。主 agent统一更新索引、文档检查和提交。

恢复时先读本Recall、[387电子表格身份与语言方案](2026-10-13-spreadsheet-artifact-identity-387.md)的实际前态与后续收尾，以及本次原DOM观察/截图；不能把已有模型成果重新合成。真实Chat为 `ses_h0VKkCl7hbz3BKHVW2Xp`、artifact为 `art_g0VXv65e1004ErsrwSJs`，标题Desk budget、工作表清单。其授权GPT-6.1 Sol轮次有6个HTTP200/EOF（End Of File，流正常结束），首次value:null与formula输入被schema拒绝后模型自然纠正并发布成功；canonical checker、模型与前态复核scope的退出/配对清理记录属于387。不要把输入校验当作调度故障，不复用已退休凭据或猜测后态服务的关闭状态。

387已针对真实遗漏实施payload身份补齐和同一个UniverAPI.setLocale订阅；主 agent后态确认普通视图中文菜单可见，并取得本389全屏隐藏的真实DOM证据。本子任务此前只读复核这两个产品文件的diff，确认未重建工作簿、导出仍优先workbook.save()当前值。387不包含弹层宿主修复，也不能宣称整个库全部语言均完成。389当前已完成两包依赖实现、独立源码复核和第二轮真实桌面验收；最终状态与准确剩余边界见文末“最终实施、验收与交付边界”，以下初版调查及第一轮失败记录按历史顺序保留。audit_ui最后仅获准写本规格及389证据目录，主 agent负责共享索引、检查、提交和push。

已读资料与搜索覆盖：

- [07-panel当前架构](../../current/architecture/07-panel.md) 的单一ArtifactFrame、同一挂载renderer、MCP独立模式、编辑Spreadsheet导出和当前语言合同；[386全屏菜单键盘循环](2026-10-13-artifact-fullscreen-menu-386.md)与[保留工作区绘制隔离](2026-10-05-inactive-workspace-paint-isolation.md)区分普通DOM、Portal和top layer。
- 当前SpreadsheetArtifact、univer-spreadsheet-adapter、ArtifactFrame；安装 `@univerjs/core`、`@univerjs/ui`、`@univerjs/design`、`@univerjs/sheets-ui`、`@univerjs/preset-sheets-core` 0.25.1的公开类型及生产分发。检索SheetBarTabsContextMenu、AnchoredContextMenu、Popup、ConfigProvider、mountContainer、popupRootId、createPortal、document.body及submenuPortalContainer。没有运行依赖中的示例或UI测试。
- [Univer UI插件官方配置](https://docs.univer.ai/reference/packages/plugins/univerjs/ui)、[Design官方ConfigProvider接口](https://docs.univer.ai/reference/packages/plugins/univerjs/design)与[Fullscreen API标准](https://fullscreen.spec.whatwg.org/)。文档为辅助，安装版源码与实页节点是当前行为证据，不把新版可选API推定为安装版已有能力。

工作区仍有并行恢复、文件、语言及文档变更；只有本新规格属于本子任务，禁止夹带或撤回他人改动。

## 实际现象与证据

原始观察位于自有 `.tmp-spreadsheet-artifact-identity-387/`，正式归档由主 agent完成。audit_ui已读取 `fullscreen-popup-observation.json`、`fullscreen-owner-observation.json` 并人工查看 `screenshots/after-fullscreen-popup-hidden.png` 与 `screenshots/after-menu-zh.png`；交互与观察采集由主 agent执行，本子任务没有操作页面。

| 对象 | 真实记录 |
| --- | --- |
| 全屏右键后的目标菜单 | 第一个 `section.univer-popup` 的class为 `univer-popup univer-popup-enter univer-popup-enter-active`，computed display=block、visibility=visible、opacity=1、position=fixed；文本为删除/复制/重命名/更改颜色/隐藏等完整中文工作表菜单。 |
| 菜单物理父链 | SECTION → 无class的DIV → BODY → HTML；各节点fullscreen均为false。 |
| 菜单矩形 | x=98.66667175292967、y=1031、width=208、height=373.3333435058594；按原JSON保留，不从截图像素比例猜测CSS视口或缩放。 |
| 实际全屏所有者 | 唯一 `:fullscreen` 为 `SECTION.msg-artifact`，label为Desk budget；其内部包含0个univer-popup。 |
| 另一个保留Popup | 第二个section无菜单文本，零宽高、坐标−9997；这是关闭/未使用节点，不能与上述已展开目标混淆。 |
| 像素与普通视图对照 | 全屏截图中有电子表格类型徽标和真实工作簿，工作表右键菜单不可见；普通视图 `after-menu-zh.png` 显示同一类工作表中文菜单。 |

全屏截图还显示编辑后的Notebook数量9及Total14，说明当时工作簿仍是当前编辑实例；这张图片不能代替387实际CSV字节验收。此前387前态也曾发生全屏右键不可见、退出后普通右键可见，本次后态进一步提供物理节点、打开样式和真实文本。因此不能把不显示解释为locale未更新、菜单未收到打开动作或只找到一个离屏隐藏节点。

## 已建立的真实根因与待确认部分

当前全屏对象只包含ArtifactFrame子树，Univer已展开的工作表菜单被渲染到body的旁系容器，实际不在该全屏子树或另一个已证明可见的top layer中。Fullscreen标准把全屏元素提升到浏览器top layer；普通body旁系内容不会因自身固定定位或较高z-index进入该层。结合“已展开中文菜单+body父链+全屏所有者内0个popup+像素不可见”，本次失效的层级归属已经成立，不再仅是“某配置存在”的静态猜测。

直接生产链如下（行号属于当前安装0.25.1的ESM分发）：

1. `@univerjs/sheets-ui/lib/es/index.js:21849` 的SheetBarTabsContextMenu调用AnchoredContextMenu，menuType是FOOTER_TABS，锚点在工作表标签上方；实际点击路径不是OpenCorvus的Kobalte Download菜单。
2. `@univerjs/ui/lib/es/index.js:4821` 的AnchoredContextMenu将状态与锚点交给Design Popup；标签菜单和通用DesktopContextMenu共享这一成熟UI实现。
3. `@univerjs/design/lib/es/index.js:3559` 的Popup从ConfigContext读mountContainer，以React createPortal创建 `section.univer-popup`；其打开/关闭状态、位置计算和动画仍由库维护。CSS为固定定位、z-index1070，初始隐藏坐标−9999（渲染偏移后−9997），关闭完成class可设置display:none。
4. `@univerjs/ui/lib/es/index.js:5168` 的DesktopWorkbenchContent创建唯一portalContainer；`:5170`将其追加到document.body，`:5191`通过ConfigProvider.mountContainer提供给后代，cleanup也按body移除。现有Preset的 `container:host` 只决定工作簿挂载容器，没有改变这条弹层挂载路径。这与实页SECTION→DIV→BODY链一致。

已排除本次由386的滚动祖先死循环引起：此次页面持续可读，库菜单已经展开，目标是Univer而非Kobalte Trigger；locale文本也已实际更新。387只补身份与运行时语言，未改这条body Portal链。过去全屏表格显示、编辑和共享工具栏下载通过，并不覆盖Univer自身工作表菜单、子菜单或对话框的层级。

仍待研究的部分：原矩形与真实视口/缩放是否另有定位问题、所有其它弹层是否同样受影响、合适的公开宿主配置入口、切换宿主时库组件/焦点状态如何保留，以及关闭全屏/实例销毁的清理。层级根因成立不意味着这些部分已解决；不能只把菜单移进Frame后就宣称完整修复。

## 共享弹层影响面

本批按共享机制审查，不能只给工作表标签菜单加特殊宿主：

- **同一ConfigProvider的Popup消费者。** 工作表标签菜单及DesktopContextMenu均使用AnchoredContextMenu→Popup，普通视图与全屏共享状态。其它Design Popup消费者应在实施前按实际调用核对。当前实页仅证明工作表标签菜单故障，不能外推每个消费者均已复现。
- **一级菜单与子菜单两条路径。** `ui/lib/es/index.js:4316` 的ContextMenuPanel把submenuPortalContainer直接选为layout根所属document.body；`:4618`再createPortal挂带 `data-u-context-menu-submenu="true"` 的子菜单。即使主菜单使用正确宿主，子菜单仍可能留在body，必须一并调查，不能形成主菜单/子菜单两个归属来源。
- **FloatingContainer。** `ui/lib/es/index.js:5264`通过ConfigContext.mountContainer渲染floating组件，同一宿主决定其归属，需核对会随修改影响的具体注册组件、交互及清理。
- **RectPopup是另一合同。** `ui/lib/es/index.js:2955`通过配置popupRootId查询节点并portal；Workbench在其布局内创建该id节点。此合同不同于Design Popup和body子菜单，不能把popupRootId当成全部弹层的通用容器配置。安装版SheetsCorePreset公开Pick及实际传参也没有转发这个字段。
- **库中其它Portal。** Design的Radix Dropdown/Popover/Dialog等包装有各自Portal，当前已读入口不能证明都服从同一ConfigContext。实施前必须按实际生产消费和公开参数逐项核对；不因库导出这些组件就认定它们全部在本表格启用。
- **同页多实例与保留工作区。** 每个Spreadsheet运行时有自己的工作簿和弹层生命周期。不能通过全局class查询移动所有 `.univer-popup`、共享单一固定id或修改用户页面全部body弹层来修一个实例；需要防止隐藏工作区、其它产物及后续销毁互相干扰。

OpenCorvus自身ArtifactActions已正确把共享Download菜单挂入当前fullscreenElement，与Univer内部工作表菜单属于不同库和不同生命周期。其它19个产物renderer、MCP App协议模式和ImagePreview不应随本项无差别改写。真实数据、当前编辑、undo/selection、导出工作簿身份及locale订阅必须保留；后端schema、权限、模型发布、任务调度与持久化均不是本次修改对象。

## 待研究的最小成熟集成方向

以下是调查顺序，不是已获证明可直接实施的代码方案。具体改动必须在补齐接口与影响证据后再追加规格，由主 agent负责实现。

1. **优先确认现行成熟接口。** 核对安装0.25.1的公开UI配置、Design ConfigProvider.mountContainer及相关Portal容器参数，查官方上游对原生Fullscreen的集成建议/问题与适用版本。`container`是工作簿宿主；`popupRootId`只属于RectPopup；当前未找到可直接通过现有SheetsCorePreset或FUniver统一修改上述所有弹层宿主的公开方法，不能虚构一个配置键。
2. **保持单实例与单弹层所有者。** 可行方案应让当前Spreadsheet的弹层归属于其真实全屏Frame（全屏时）或正常受支持的宿主（普通时），由成熟库同一容器/生命周期管理主菜单、子菜单和受影响floating内容。通过现有Frame/适配器身份传递或库已支持的宿主入口接入，不重建工作簿、不复制菜单、不修改用户/模型内容。只有公开接口确实不能表达所需归属且上游实现已读清楚时，才研究范围最小的依赖整合补丁；不能为了追求一行修复直接全局搬DOM。
3. **核实完整生命周期。** 当前库cleanup使用body.removeChild(portalContainer)，任意外部appendChild搬迁会改变它的假设；必须保证创建、宿主切换、关闭全屏、组件dispose均由同一所有者成对处理。动态换React Portal container也可能重建弹层子树，需核查菜单打开状态和焦点实际行为。不能只更新创建路径而遗漏销毁，不能引入重试、定时移动或MutationObserver搬迁作为未知根因的补偿。
4. **定位与裁剪一起验收。** Popup使用固定定位及viewport锚点；迁入全屏Frame后需核查CSS transform/contain/overflow及定位参照，真实视口内完整显示菜单与子菜单。记录节点矩形、父链、当前 `:fullscreen` 归属及截图；不要通过无边界z-index、关闭裁剪或移动整个renderer规避正确归属。
5. **收敛后再确定文件范围。** 公共接口或依赖补丁若改变配置面、函数签名、生命周期，重新检索全部定义/调用、同义Portal与历史，补充精确方案和包分发/安装合同。当前389没有授权或实施任何生产变更，也没有指定依赖升级、浏览器设置修改或新渲染器。

## 本区域剩余语言边界

主 agent真实AX（Accessibility Tree，可访问性树）在中文状态仍观察到 `Sheet tabs`、`Close sidebar`、`Notifications alt+T`。这是库内部可访问名称尚未完整本地化的实际线索，应保留在本区域后续调查中。已读安装版sheets-ui的ESM第23125/25419行含字面 `aria-label="Sheet tabs"`，ui的ESM第5045行含字面 `aria-label="Close sidebar"`；Notifications名称的具体所属实现，以及这些名称的公开可覆盖参数和翻译来源仍须进一步核对，不将默认品牌、用户内容或快捷键本身翻译改写。

387目前证明类型徽标和已操作可见工作表菜单跟随产品语言，并保留当前工作簿；不得将其描述为整个Univer所有可见内容、错误和无障碍名称都已完成语言覆盖。389的弹层修复也不能自动算作这些名称的修复。若同一受影响控件需要变更名称，先完成对应定义/调用/locale合同分析并追加范围；CSV超预算英文Error仍保留387的未触发事实，不顺带改所有库文案。

## 验收计划与当前未完成项

后续真实验收优先复用387已自然发布的Desk budget及原owner确认的规范数据，无需重新使用凭据或新模型。按正常开发模式访问独立 `/ui`，先确认实际构建资源和数据库/服务归属，不伪造消息、产物或页面状态。

修复后的直接正向要求：普通与全屏的工作表右键菜单均实际可见且可点击；至少验证一个有子菜单的入口和一个有意义但可控的工作表操作，Escape/外部关闭及返回焦点；在真实视口内查看完整菜单，退出/再进全屏后仍可用。保持同一个工作簿，确认编辑值、公式结果、当前工作表与CSV导出；中英文切换继续有效，当前未处理的AX名称明确列出。若有其它共享Popup/floating消费者进入修改影响面，选真实可达入口补充对应样本，不把主菜单一次通过冒充整个库验收。

记录全过程的菜单节点身份、物理父链、几何和截图，人工查看像素；DOM读值、typecheck、build或console clean均不能替代视觉。禁止新增、修改或运行UI自动化、DOM/源码文案断言、浏览器fixture、截图基线或像素比较。没有因本调查而运行依赖示例、浏览器脚本测试或查找测试树。

当前未完成：成熟宿主集成方案尚未确定；其它共享弹层的逐项影响尚待核对；没有产品实现、后态可用性验收、AX名称修复或389服务/页面执行。根因证据仅针对已展开工作表菜单的全屏层级归属。387后态服务/页面最终退出由其原owner记录，389不虚构自己的运行回执。主 agent负责安全证据归档、共享索引、当前文档检查和范围提交，提交后按用户规则拉取合并upstream、检查待推送集合并正常push；无release/tag或发布动作。

## 389 第二轮 Recall 与可实施方案

本节更新上一节的初版调查状态：已经完成安装版公共接口、当前生产消费者、发布格式和单宿主生命周期调查，主 agent可据此实施宿主修复；仍没有修复后实页结论。audit_ui本轮仍只编辑本389规格，没有修改产品、安装依赖、启动服务、使用凭据/模型、操作浏览器、运行UI自动化或再次委托。388及并行390由其原owner负责，不能混入本次依赖补丁。工作区开始/结束检查用于保护并行改动。

主 agent的389前态计划及已反馈事实：复用 `.tmp-spreadsheet-artifact-identity-387/launch-review.ps1 -Stage 389-before -UiDirectory .tmp-spreadsheet-artifact-identity-387/ui-after`，端口18505，沿用原387已正常关闭且完成配对清理的规范runtime；运行器先验证原owner物理退出及凭据文件不存在，不启动模型、不绑定新凭据。原owner负责stop-requested和20分钟固定截止。前态已结束：tab25关闭；原owner PID84800、occurrence `d4ccbdf9-86bb-4977-8ada-cf0dd845c664` 经stop-requested正常退出，launcher16197 exit0。日志、owner.json和terminal.json在 `.tmp-spreadsheet-artifact-identity-387/389-before/`；页面与观察归档放 `.tmp-spreadsheet-fullscreen-popups-389/`。该回执由主 agent反馈，不替代后续新scope自己的物理收尾。

### 新前态：两种弹层已实证共享层级问题

- tab25全屏工作表菜单的截图和 `fullscreen-sheet-menu.json` 再次证明菜单已打开、位于body旁系。本轮视口为2560×1440，菜单矩形在视口内，因此本次样本已排除“仅因超出视口看不到”；退出全屏后同类右键菜单可见。
- 全屏点击底部100%后，AX报告expanded，`fullscreen-zoom.json` 显示 `[data-radix-popper-content-wrapper]` 的直接父节点是BODY、insideFullscreen=false，role=menu的内容为50%/75%/100%/125%/150%/175%/200%/400%。矩形x2448、y1136.666748046875、width91.9375、height269.3333435058594，落在2560×1440内；`screenshots/before-fullscreen-zoom.png` 仍看不到菜单。这是Radix Dropdown Portal的独立真实入口，证明只修Design Popup不完整。audit_ui已经读取这份JSON；截图操作及实页结论来自主 agent。
- 普通视图Rename实际是工作表标签内联编辑，主 agent已Escape取消且没有改名；它不能用来验收Dialog Portal。

### 安装版、公开接口与官方历史

本仓库真实消费链是 `SpreadsheetArtifact → univer-spreadsheet-adapter → @univerjs/preset-sheets-core@0.25.1 → @univerjs/ui/@univerjs/design/@univerjs/sheets-ui`。通过preset实际package.json创建Node createRequire并解析生产入口，三个安装目录分别为：

| 包 | 当前解析的真实目录（相对根目录） |
| --- | --- |
| ui | `node_modules/.bun/@univerjs+ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/ui` |
| design | `node_modules/.bun/@univerjs+design@0.25.1+7492c01c6988791b/node_modules/@univerjs/design` |
| sheets-ui | `node_modules/.bun/@univerjs+sheets-ui@0.25.1+fb6a3c66a95eaf3d/node_modules/@univerjs/sheets-ui` |

本次目录检查各包仅有这一份0.25.1实例。不能根据根目录是否有同名符号链接判断实际导入。`@univerjs/presets`公开createUniver支持plugins/presets/DependencyOverride，但没有统一弹层宿主setter。UI的IUniverUIConfig公开popupRootId、container等；SheetsCorePreset实际Pick和参数转发没有popupRootId，container只传给Workbench布局。ILayoutService.registerContainerElement用于布局/焦点登记，不能当Portal宿主API。直接替换整套DesktopUIController会扩大范围并复制成熟实现，排除。

Design的 `IConfigProviderProps.mountContainer: HTMLElement | null` 是现成单一宿主合同，Popup/FloatingContainer已经消费；Radix各Portal则公开 `container` 参数，现有Design包装没有一致传入。安装类型可核对 `lib/types/components/config-provider/ConfigProvider.d.ts`、`dropdown-menu/DropdownMenuPrimitive.d.ts`、`dialog/DialogPrimitive.d.ts`；无需虚构新配置或替换Radix。DialogPortal和DropdownMenuPortal已公开继承原Portal props，整合时保留显式container参数语义，默认从当前ConfigContext取得宿主；当前OpenCorvus消费者均没有传自定义container。

[Univer官方issue 5237](https://github.com/dream-num/univer/issues/5237)中，维护方2025-05-22针对0.7.0的回复只支持对documentElement调用requestFullscreen。该记录说明body挂载假设的历史，不是0.25.1新增统一接口的证明，也不能据此把OpenCorvus的单产物ArtifactFrame全屏改成整个页面全屏。[React createPortal文档](https://react.dev/reference/react-dom/createPortal)明确更换目标DOM节点会重建Portal内容；因此本方案保持同一个DOM容器身份，只由它自己的创建者改变物理父节点。[Radix Dialog公开Portal合同](https://www.radix-ui.com/primitives/docs/components/dialog#portal)提供container；定位、焦点约束、关闭和返回仍交给原库。

### 当前消费者横审结果

以下是已读的生产入口，不等同于每项都获得视觉验收。行号对应未修改0.25.1 ESM（ECMAScript Module，ECMAScript模块）分发。当前preset实际注册network、docs、engine-render、ui、docs-ui、engine-formula、sheets、sheets-ui、sheets-numfmt(-ui)、sheets-formula(-ui)；适配器配置header=true、toolbar=false、formulaBar=true、sheetBar/statisticBar/zoomSlider=true。不能为了测试而启用原本关闭的Ribbon或其它插件。

| 成熟路径 | 当前实际生产消费者和归属 | 本轮处理边界 |
| --- | --- | --- |
| Design Popup → ConfigContext.mountContainer | UI AnchoredContextMenu:4819；DesktopContextMenu；sheets-ui SheetBarTabsContextMenu:21849。移动端MobileContextMenu也读同context，但当前使用桌面控制器。 | 保留Popup定位和动画，只修其唯一宿主的物理归属。桌面工作表菜单已有真实失效。 |
| ContextMenuMenuItem子菜单 → body | UI ContextMenuPanel:4316直接取layout root所属document.body，:4618 portal带`data-u-context-menu-submenu`节点；所有当前菜单选择器/嵌套菜单共享。 | 改为同ConfigContext.mountContainer，避免一级/子菜单分属两个宿主；另有重复激活重置定位就绪的已实证缺陷见下节，不能混为全屏原因。 |
| Radix DropdownMenu主/子Portal | Design DropdownMenuContent:2140直接Portal$2；DropdownMenuPortal:2106由嵌套菜单:2254消费。UI Slider:733；sheets-ui SheetBarMenu:21785、ClipboardPopupMenu:9157、AutoFillPopupMenu:20903；Select/MultipleSelect也复用此路径。 | 主菜单必须改用同一个已接入context的DropdownMenuPortal，不能只改导出的子菜单包装。缩放入口已真实失效。 |
| Radix Popover → Design Dropdown | Design PopoverContent:1781；sheets-ui DefinedName:21420（名称区域可达）；BorderPanel:16250/16266及UI Ribbon路径也消费，但当前toolbar=false。 | PopoverContent接入相同宿主；名称区域列入真实可达抽样。关闭的Ribbon不宣称已验收。 |
| Radix Dialog → Dialog/Confirm | UI DialogPart:6822、ConfirmPart:6687；sheets-ui工作表删除确认:6190、名称重复/空值确认:22781/22816、权限对话框:8304；Design ColorPicker的More Colors:1672；sheets-formula-ui GlobalRangeSelector:4617。 | DialogPortal接入同context，沿用模态、遮罩和焦点合同。只打开并取消可控Dialog；不把真实删除作为验收前提。 |
| Tooltip → body | Design Tooltip:3000/3040；sheets-ui状态栏CopyableStatisticItem:23393、DefinedNameContainer:20727/20738、权限列表；docs-ui段落设置、formula-ui范围选择也消费。 | 接入同宿主；必须同步保持坐标语义。当前计算用viewport矩形再加window.scrollX/Y，节点为absolute，不能无分析搬迁后沿用不同参照。 |
| FloatingContainer → ConfigContext | UI:5265；当前桌面UI控制器:5375仅注册CanvasPopup为floating。FloatDom注册在content，不是另一个body Portal。 | 自动跟随同一宿主。CanvasPopup内的RectPopup另有以下合同，不复制渲染器。 |
| RectPopup → popupRootId或inline | UI:2955；CanvasPopup、sheets-ui canvas/cell popup manager、formula-ui HelpFunction:2787/2792与SearchFunction:4101、docs-ui段落菜单:14110。portal=false时本地渲染；portal=true时查Workbench自己的id节点。 | 现存目标节点已经在Workbench/Frame子树，不属于本次已证实body逃逸；保留这条本地定位合同及popupRootId公共语义，不把它改成统一宿主或制造新全局id。多实例重复默认id是另一个待核对边界，本轮不凭静态代码宣布修复。 |
| HoverCard/Gallery/DraggableList等 | DefaultMenu:3275消费HoverCard，但当前Ribbon被toolbar=false关闭；GalleryPart全局组件已登记，当前preset图未找到打开IGalleryService的实际入口；没有当前图中的DraggableList消费。 | 已记录body Portal位置及公开参数，但不扩大为不可达组件改造；不声称整个Design所有导出都被修好。 |
| Message/Notification | UI全局注册MessageContainer:7052、Notification:7109，Sonner输出仍在Workbench内；当前名称来自Sonner默认值。 | 不是本次body Portal根因；名称合同见后节，不搬这些已经在Frame内的全局内容。 |

原来的“单宿主”指这次所有需要逃离Workbench布局的**外部浮层**使用唯一ConfigContext.mountContainer；不删除RectPopup已有本地宿主合同，不把CanvasPopup或工作簿再渲染一份。上表已把当前关闭或尚无可达操作的消费单独列明，不能把静态同合同覆盖写成全库视觉通过。

### 可直接实施的最小宿主补丁

1. **所有者与身份。** 修改UI的DesktopWorkbenchContent已有portalContainer创建/挂载effect。仍每实例只创建一个div，使用mountContainer.ownerDocument创建，ConfigProvider.mountContainer始终引用这个div。监听同一个ownerDocument的fullscreenchange，并在effect初次执行时立即同步：当其fullscreenElement包含当前Workbench的mountContainer时，把自有portalContainer挂到该fullscreenElement；否则挂回同一个ownerDocument.body。比较parentNode后再appendChild，不移动其它实例、全局class匹配节点或整个renderer。不要增加poll、重试、MutationObserver搬迁、影子全屏状态或新配置面。
2. **对称生命周期。** effect持有唯一监听回调；卸载先取消监听，再取消原locale/direction订阅并`portalContainer.remove()`，替换仅对body成立的removeChild。全屏退出、其它产物进入全屏、实例在全屏时销毁均由这一所有者处理。当前Spreadsheet本体、UniverAPI、workbook.save、locale effect及导出优先级不变。保持Portal DOM身份只能避免React重建，不能代替真实焦点验收；退出全屏时已有焦点的弹层是否被浏览器reparent影响必须实际检查，不提前增加猜测性的focus恢复机制。
3. **避免改变Frame两行grid。** 这个div只作为无语义Portal目标，建议在创建处设`style.display = "contents"`；不加role/tabIndex，不使用覆盖全屏的透明fixed大盒子，也不设置会继承到子层的pointer-events:none。[CSS Display规范](https://drafts.csswg.org/css-display/#valdef-display-contents)定义contents不生成该元素自己的盒子，DOM父链仍保留。因此它不会作为第三个正常grid item，也不会新建一个定位/层叠盒；实际Popup、Radix wrapper、Dialog遮罩/内容仍按各自fixed定位与现有z-index绘制。该选择是结构依据，仍须用当前桌面浏览器截图、菜单命中和Frame/body矩形确认，不能把规范当作已完成兼容性验收。
4. **统一真实外部Portal消费。** UI ContextMenuPanel的submenuPortalContainer改读ConfigContext.mountContainer，保留其已有布局服务用于滚动约束。Design：DropdownMenuPortal以context宿主作为默认container，DropdownMenuContent改用这个同一包装；DialogPortal按同样方式包装原Radix Portal（原DialogContent已使用它）；PopoverContent使用原Radix Portal的container参数。Popup、FloatingContainer已用context，不另造包装或旁路。保留原库children、ref、open、onOpenChange、键盘、modal、collision、动画与dismiss语义。
5. **Tooltip坐标完整性。** Tooltip同样使用ConfigContext.mountContainer。其两处计算从getBoundingClientRect得到viewport坐标；与其给迁移后的absolute定位增加全屏分支，最小一致实现是保留现有位置选择/夹取算法，把节点从absolute改为fixed，并在首次测量与scroll/resize更新两处都直接使用top/left，不再加window.scrollX/Y。这使普通和全屏都使用同一viewport合同，与当前Popup/Dropdown一致；不修改箭头相对Tooltip的absolute布局。真实验收必须包含普通页面滚动后的tooltip位置与全屏位置。
6. **重复激活仍可用。** 同一UI补丁修ContextMenuMenuItem：onMouseEnter及打开子菜单的onClick只请求submenuVisible=true，不再无条件清除已完成的submenuPositionReady；ready=false由既有关闭effect统一设置，首次false→true后仍由原测量effect置true。保留关闭延迟、resize/scroll重测与已有命令执行，不另加版本计数器或定时补测。普通和全屏均验收第一次Enter、同按钮再次Enter后的色盘可见与可用；不增加未实现的ArrowRight功能或UI自动化。
7. **范围与排除。** 核心交付只需要根`package.json`的现有patchedDependencies、`bun.lock`、两个0.25.1依赖patch（ui/design）及本规格/归档。不需要改ArtifactFrame、SpreadsheetArtifact或适配器的API，不依赖Provider、后端/schema或模型。关闭的HoverCard、无实际当前入口的Gallery/DraggableList不进入这次生产补丁；若后续实页确实遇到这些组件，先追加对应影响及验收范围。不得只在应用层查询body弹层再搬动以绕过库自身所有权。

使用成熟组件保留了当前焦点/模态行为，但依赖包原本未对局部Fullscreen给出保证，所以“完整”必须由后续真实菜单、对话框、键盘及清理验收完成。上述实现不得通过关闭modal、删掉焦点约束、改为全页面fullscreen或抬无限z-index来让截图暂时出现。

### 依赖发布格式与安装验证

三个包的公开exports均包括`.`的import→`lib/es/index.js`、require→`lib/cjs/index.js`，同时开放`./lib/*`；还提供`lib/index.js`和`lib/umd/index.js`。本次只读比较发现各包lib/index.js与ESM内容相同；UMD（Universal Module Definition，通用模块定义）是单独压缩分发，不能仅patch ESM后假称其它入口相同。当前包发布files只有lib；没有TS源码目录，本次逐个遍历这些lib确认没有`.map`，所以不套用386的src/两source map范围。

每个被改运行时代码的包应在同一patch内覆盖 `lib/index.js`、`lib/es/index.js`、`lib/cjs/index.js`、`lib/umd/index.js` 四份对应实现，按各分发实际绑定名修改；公开函数props不变时不需要改d.ts。保留许可证，不修改整个vendor格式或重新构建无关字节。`ui`的Workbench、ContextMenuPanel与`design`的上述Portal/Tooltip变更分别落各自patch。若AX工作另行纳入，sheets-ui新增第三个patch的范围见下节，不能先声明只改两包再悄悄混入。

主 agent实施时沿仓库既有Bun patch/patch-commit/install流程更新已配置patchedDependencies，保留并行venice等patch。完成安装后重新从overlay preset真实require/import入口读取对应代码，核对私有构建依赖也应用同一patch；这属于安装取证，不新增源码字符串断言或UI自动化测试。聚焦typecheck/build只证明构建有效，菜单与布局必须靠真正运行的`/ui`及截图。无需升级整个Univer、运行依赖UI测试或增加版本兼容分支。

### 与全屏分开的子菜单重复激活缺陷

主 agent在普通视图点击Change color、使用ArrowRight、可见坐标点击后，观察到带`data-u-context-menu-submenu`的节点已经创建，其矩形约297×185、left745.9/top118.7（1280×720内），文本含More Colors，但style为visibility:hidden、pointer-events:none。当前CUA公开能力没有hover/mouse.move；从菜单外drag到目标首先触发外部关闭，该操作与图片已被明确排除，不能写成“悬停可见→点击隐藏”的对照证据。

随后主 agent取得不依赖hover的独立实证：关闭后重新打开主菜单，第一次对Change color按Enter，色盘完整可见；同按钮第二次Enter，色盘消失。`color-first-enter.json`与`color-second-enter.json`显示父节点均为BODY、矩形完全相同（left745.9166870117188、top118.66667175292967、width297.3333435058594、height185.33334350585935），但visibility/pointer-events从visible/auto变为hidden/none。audit_ui已读取两份JSON，人工查看 `screenshots/before-color-first-enter-visible.png` 与 `before-color-second-enter-hidden.png`，确认第一次有完整色盘、第二次保留主菜单焦点而色盘不可见。被排除的drag样本不归档为正向证据。

安装UI的ContextMenuMenuItem有与该事件序列相符的直接控制流（约4440–4633）：测量effect只依赖submenuVisible/hasSelectionSubmenu/hasSubItemSubmenu；onMouseEnter与不可直接执行子项的onClick均无条件setSubmenuPositionReady(false)，随后setSubmenuVisible(true)。submenuVisible已经为true且三项依赖不变时，再次Enter产生click只重置ready，测量effect不会再次运行，已测出的非零left/top仍保留。这已经由普通视图连续前态和源码共同确认，独立于Fullscreen宿主，纳入同一个UI依赖补丁。

该按钮没有onKeyDown/ArrowRight展开合同；Enter/Space依靠普通button的click激活，不能把ArrowRight无效当作测量重跑证据。最小修复是在已有submenuVisible状态变化/测量effect内统一拥有ready，去掉重复打开动作的无条件reset，而非依赖resize/scroll补测；普通和全屏后态分别确认首次及重复激活仍可用，并实际选择一个可撤销颜色或打开/取消More Colors。此项必须独立落实，不能由宿主迁移自动算通过。

### 三个中文AX名称的公开覆盖合同

| 名称与当前定义 | 成熟接口调查结论 | 最小可实施方向，尚未实施 |
| --- | --- | --- |
| Sheet tabs | sheets-ui Desktop SheetBarTabs:23125硬编码；MobileSheetBarImpl:25419有同名独立代码。SheetBarTabs已注入LocaleService但没有对此名称做翻译；公开footer.sheetBar开关没有ariaLabel参数。当前使用桌面组件。 | desktop名称改用LocaleService.t的新键，例如`sheets-ui.accessibility.sheetTabs`，并用已有useObservable(localeService.currentLocale$)订阅当前语言；不把工作表真实名称翻译。新增键进入sheets-ui en-US/zh-CN资源。移动端不虚构验收，是否同步同键须明确列入范围。 |
| Close sidebar | UI Sidebar:5045为字面量；ISidebarMethodOptions只支持header/children/footer/width/onOpen/onClose等，不能覆盖该按钮aria-label。相邻Sidebar panel、Resize sidebar也为硬编码，当前仅Close sidebar有主 agent原始AX记录。 | Sidebar注入LocaleService、订阅currentLocale$，使用例如`ui.accessibility.closeSidebar`。若改同控件的panel/resize名称，应将精确键与对应可见/AX样本一并记录；不把自定义header当成按钮名称覆盖。 |
| Notifications alt+T | 当前Sonner2.0.7 `dist/index.js:927`默认containerAriaLabel="Notifications"，:1089拼接原hotkeyLabel；`dist/index.d.ts:117`公开containerAriaLabel。Design Toaster和Messager的类型/实现均转发原Sonner props。UI MessageContainer:7030、Notification:7076已注入LocaleService，但只传theme/dir，没有传这个名称。 | 在这两个UI调用点订阅currentLocale$并传`containerAriaLabel: localeService.t("ui.accessibility.notifications")`，保留alt+T快捷键事实；不patch Sonner，不全局查DOM改aria-label。中文可为“通知”，英文仍为“Notifications”。 |

locale资源是现有单一来源：preset的 `lib/es/locales/en-US.js` / zh-CN.js从各插件的`/locale/...`导入并mergeLocales，所以修改ui/sheets-ui本身的语言资源即可自然进入适配器已注册的两种locale；不要在OpenCorvus json再复制一份库文案或维护DOM翻译表。当前每个插件的语言分发是 `lib/locale/{en-US,zh-CN}.js`、`lib/es/locale/...`、`lib/cjs/locale/...`、`lib/umd/locale/...` 四套；如添加名称键，在同一包patch内维护这八个资源文件和已发生调用变更的四份runtime。语言对象的d.ts若声明新键则同步公开形状。先核对安装版真实类型，不添加字符串伪测试。

这三个名称有明确成熟实现方向，但不是宿主修复的必要前置。当前389可先实现两包弹层所有权，AX名称按明确单独范围处理；在完成相应中英真实AX和截图前继续列为剩余语言问题。387只完成其已经证明的类型与可见菜单语言，不扩写为整个库本地化完成。

### 修复后真实验收细化与剩余未知

优先复用Desk budget，取普通/全屏工作表菜单、100%菜单切125%再返回、名称区域Dropdown、一个可取消的Dialog、状态栏或名称区域Tooltip的真实样本；取消/关闭后的焦点、菜单外部点击、Escape、同一Frame退出/再次进入全屏均须实际可用。检查所有已操作浮层的物理父链：普通视图进入本实例portalContainer→body；全屏进入同一个portalContainer→当前:fullscreen；不能只查看AX expanded。子菜单分别确认第一次和重复Enter后的色盘可见与真实操作，不把已证实的ready缺陷忽略。对当前未能实际打开的库消费者，只写静态同合同覆盖。

检查迁移后的Frame仍是两行布局、表格底栏/工作表标签完整、无透明层吞鼠标；记录触发控件与弹层矩形、视口和window.scrollX/Y，确认Tooltip viewport坐标。切换工作区/产物、实例销毁后再打开，并记录原owner关闭页面和服务的真实回执，证明事件监听与宿主生命周期完整。使用原工作簿继续编辑/撤销、检查公式与CSV实际内容，不能以一次菜单打开代替数据保留。

尚未完成/未知：此时没有任何389生产补丁或修复后图片；display:contents及各类库弹层在当前真实桌面布局中的命中/焦点尚未验收；DOM reparent时已有焦点是否需要额外处理、其它页面/多实例的准确行为待实页确认；RectPopup默认全局id多实例和不可达Gallery/HoverCard/DraggableList不属于已验证范围；已证实子菜单ready缺陷与中文AX三项尚未修复。本方案不能掩盖这些边界，也不将后续390调查纳入389已完成内容。

### 主 agent 实施记录

完成上述分析与前态后，主 agent 按已落盘方案实施两个0.25.1依赖补丁，覆盖各自四份运行时分发。UI仅修改DesktopWorkbenchContent的稳定容器创建/全屏归属/对称销毁、ContextMenuPanel宿主及ContextMenuMenuItem两个重复打开动作；定位effect继续独占ready状态。Design仅修改Dialog、DropdownMenu、Popover和Tooltip的已列调用点；Tooltip两处计算统一viewport坐标。没有改变工作簿、Frame、适配器、原始数据或模型路径，也未扩大至移动控制器、未使用组件和三个AX名称。

原八个安装文件、根package/lock及其既有差异先保存在`.tmp-spreadsheet-fullscreen-popups-389/vendor-before`与`before-patch`；编辑脚本只负责对已审查定义做精确替换并验证JavaScript语法，不是UI自动化或行为验收。UMD按实际Jo/Ro/Bo及ga/pl/yf/Tf/Vf绑定修改，不重排其它vendor代码。当前副本已交audit_ui单层独立只读复核；主agent负责真实页面。

正常Bun1.4 patch-commit先完成UI。Design首次已生成patch，但替换lock时返回EBUSY；保留生成文件，未关闭任何用户进程，随后同一正常命令重试成功。`bun install --frozen-lockfile`通过，两项patch登记到现有唯一patchedDependencies并保留并行Venice配置。后续私有UI构建和overlay类型检查已经启动，尚不能据此宣称菜单或焦点验收完成。

## 第一轮后态发现：菜单关闭与其后代Portal生命周期不一致

### Recall更新与已经获得的结果

本节是同一389共享机制范围内的补充根因分析，实施前由主 agent明确批准追加。audit_ui只读调查AnchoredContextMenu、ContextMenuPanel、ContextMenuMenuItem、Design Popup/ColorPicker/Dialog、当前所有Panel入口及安装版Radix事件分层；本次只追加本规格，不修改产品、patch、共享文件，不操作页面/服务，不运行UI自动化或再次委托。本节完成后冻结分析交主 agent实施。

前一轮独立源码复核发现Design UMD的PopoverContent压缩函数pl参数`align:t`遮蔽外层React绑定t，使新增t.useContext无效。主 agent仅将参数和子Content的align绑定改为alignment，同步编辑脚本并正常重新patch-commit；audit_ui复读patch、根安装目录及preset实际解析文件，确认修正。其它Jo/Ro/Bo、ga/yf/Tf/Vf绑定与ESM/CJS的宿主、坐标和ready语义一致。没有将仅语法解析当成功能验收。

主 agent完成overlay typecheck及私有构建（约1分16秒、exit0），进入tab26真实后态：全屏工作表主菜单、连续Enter色盘、zoom125%↔100%、名称Popover、More Colors Dialog打开/取消及全屏Tooltip均已可见。`after-fullscreen-menus.json`、`after-fullscreen-dialog.json`等确认已操作弹层进入当前fullscreen，父容器style为display:contents；Dialog示例矩形x1141.3333740234375、y587.9114990234375、width277.3333435058594、height264.1770935058594。audit_ui已读这两份JSON；交互及像素结论由主 agent取得。

但在“全屏主菜单→Change color→More Colors→cancel→Escape关闭主菜单”之后，主菜单已退出，色盘子菜单仍可见；随后打开zoom的截图中两者同时存在。此前DOM已证明色盘独立Portal与父Popup同属外部容器，但物理上不是父Popup后代。**第一轮整体验收未通过**，不能用多个入口已经可见掩盖关闭后残留。

tab26已关闭；主 agent报告owner PID84648、occurrence `0b8724c1-01a6-4299-9220-391fe776c017` 正常结束，launcher78924 exit0，terminal elapsed596202ms。新一轮验收必须使用新scope并独立收尾，不复用已关闭页面或猜测旧进程状态。

### 直接根因、全部当前入口及旧实现遗漏

1. 安装UI的AnchoredContextMenu（当前ESM约4735–4830）将 `visible && !!anchorRect` 传给Popup，但内部只以 `menuType && <ContextMenuPanel>` 决定Panel是否挂载。DesktopContextMenu关闭只setVisible(false)；SheetBarTabsContextMenu的onRequestClose也只回调visible=false，FOOTER_TABS的menuType仍恒定存在。
2. Design Popup没有unmountOnExit；其visible=false时layout effect立即把自身realOffset改为[-9999,-9999]，CSSTransition之后给自身退出class。Panel、其ContextMenuMenuItem以及ColorPicker并没有因此卸载。子项submenuVisible仍可为true，独立createPortal仍渲染到ConfigContext宿主，父Popup的离屏位置/隐藏CSS不会作用到这个兄弟节点。因此普通/全屏、外部关闭、Escape或另一个菜单激活均可能保留旧子菜单，真正原因是可见生命周期与逻辑子树生命周期分离。
3. menuSessionVersion只在重新显示或menuType变化时刷新菜单schema，未拥有submenuVisible，也没有销毁子树；不能用该版本计数或resize/scroll补测解决关闭归属。刚实施的ready修复只消除重复激活造成隐藏，宿主修复只改变物理父节点，二者都不负责父菜单结束时的后代释放。
4. 已检索当前overlay源码和preset生产依赖图：AnchoredContextMenu当前只有UI DesktopContextMenu与sheets-ui SheetBarTabsContextMenu两个生产调用；ContextMenuPanel另有docs-ui段落菜单直接调用（ESM约14110/14126），后者已经置于`visible && <RectPopup>`之内，关闭会卸载整棵Panel。递归ContextMenuMenu/ContextMenuMenuItem只在该树内传递子菜单数据。MobileContextMenu使用独立移动菜单结构，并已在`!visible`时return null，不走这个桌面Panel保留路径。无需增加Panel.visible公共参数或修改其它renderer。
5. ContextMenuHostService只登记、激活、调用前一menu的hide回调和清除activeMenuId；它没有管理React子树的职责。修复应回到AnchoredContextMenu自身，不向全局host服务增加遍历/隐藏DOM的补丁。

### 为什么不能仅添加visible卸载条件

ColorPicker把More Colors Dialog作为自己的React后代，Dialog Portal物理上却是当前外部宿主下另一个节点。AnchoredContextMenu目前document pointerdown判断只接受 `contentRef.current.contains(target)` 或全局 `closest('[data-u-context-menu-submenu]')`；点击Dialog输入、滑条或按钮不保证属于这两个物理子树。因此单加visible条件可能在第一次点击Dialog内容时把父菜单、ColorPicker及Dialog一起卸载。

现有document wheel监听还处于capture阶段：它在React逻辑后代有机会表达事件归属前，按同样DOM启发式决定stopPropagation/preventDefault。现有document keydown则不检查defaultPrevented，只要Escape就关闭父菜单。它们是同一“只认识物理父链，不认识自己的Portal后代”的事件所有权问题，必须与关闭生命周期一起收敛。

当前安装 `@radix-ui/react-dismissable-layer@1.1.19` 的 `dist/index.js` 已读：内部通过React onPointerDownCapture记录逻辑树内事件，再由document监听判断外部；Escape仅由最高层监听，在document capture阶段调用onEscapeKeyDown并尊重defaultPrevented。Design Dialog的onEscapeKeyDown调用自身关闭后preventDefault。该成熟事件语义要求下层菜单尊重已被上层消费的Escape，不能无条件再关闭父菜单。React Portal保持逻辑树事件传播，前述React官方createPortal文档是公开合同依据。

菜单内再套动态ConfigProvider并把所有Portal挂入contentRef并非最小方案：既有Popup入场具有transform动画，新增固定定位后代可能改变参照；等待ref后换container还可能重建Portal并影响Popup第一次量尺寸。此次继续使用已验证的同一外部宿主，以逻辑树事件归属和真实关闭者拥有子树来解决，不产生第二个容器来源。

### 冻结的最小完整实施方案

仅扩展既有ui patch的AnchoredContextMenu，对应四份runtime；UMD该函数是Ho，内部原`p`为contentRef，`n`为visible、`s`为anchorRect、`c`为menuType，新增绑定须避开既有压缩作用域。Design patch维持已复核结果，除非真实复测发现其自身新问题。

- 使用一个派生的真实打开值 `isOpen = visible && !!anchorRect`，Popup.visible与Panel挂载使用同一值；Panel渲染为`isOpen && menuType && ...`。菜单注册本身仍按host生命周期，激活、当前打开轮次和文档事件监听以同一isOpen同步，避免显示已经关闭但监听仍把它当活动菜单。没有另存一份open状态。关闭立即卸载Panel及其所有递归子菜单/ColorPicker/Dialog/订阅/计时器；Popup自身保留原动画外壳。
- 在AnchoredContextMenu自己的section上，用React `onPointerDownCapture`、`onWheelCapture`将 `event.nativeEvent` 加入本实例稳定的 `WeakSet<Event>`。这只记录事件身份，不记录开关状态，不保存全局DOM名单；弱引用也不会因停止传播而长期保留目标节点。记录逻辑后代事件，包括通过Portal渲染的Dialog、子菜单和内部控件。
- 文档pointerdown监听保持bubble阶段，按同一个原生event是否在本实例WeakSet中判断来源：来自逻辑后代则保持菜单，外部则请求关闭。删除当前基于contentRef.contains和任意全局submenu属性的归属启发式；不增加role、class、z-index或全局Dialog存在性判断。真实另一个实例/zoom菜单的事件不在本实例集合中，因此会自然关闭旧菜单。
- wheel文档监听改为bubble阶段且`passive:false`，对应removeEventListener也按bubble配对。内部原生wheel由同一个WeakSet确认，保留后代已有滚动/阻止默认行为；外部wheel继续按当前合同preventDefault并stopPropagation。必须改变监听阶段，因为document capture发生在React section捕获之前，不能读取尚未登记的事件。若后代本身stopPropagation导致document未收到事件，WeakSet不需要定时清理或下一次补偿点击。
- Escape文档处理先检查`event.defaultPrevented`，再按key请求关闭。上层Radix Dialog在capture阶段消费的Escape只结束该层；下一次未消费的Escape才结束父菜单及整棵Panel。保留原Radix焦点约束与dismiss机制，不关闭modal、不添加全局Escape路由。
- 若contentRef在移除DOM启发式后已无读取，连同其ref绑定一起删除；不保留死状态。WeakSet及事件监听属于同一个AnchoredContextMenu实例，effect解绑和已有HostService注销继续成对，关闭后不新增timeout、轮询或全局hide。

Popup原visible=false已经立即移至离屏，所以保留外壳、卸载Panel不会撤销原本仍在原位置完成的可见退出动画；其原CSSTransition和class照常结束。新打开时Panel是新的正确状态，原主菜单尺寸仍在同一React提交中建立，Popup自身layout measurement机制不变。实际焦点、滚动、动画及几何仍须下一轮实页确认，源码不能代替这些验证。

### 最小焦点预期与精确真实交互顺序

第一轮Dialog cancel后AX焦点是body。当前More Colors源自ColorPicker里的无href的a，不是原生可聚焦button，原源码已有这一标记；没有独立前态焦点对照，不能把此观察定性为本轮新增回归，也不能写成“焦点正确返回”。本补充不引入任意全局focus恢复。至少要求对话框打开后焦点在其真实可操作后代、鼠标输入不会导致父层提前关闭、上层Escape先交给Radix、主菜单关闭后键盘仍可到达真实表格或工具栏；取消后的实际焦点节点继续如实记录。若决定修复More Colors的键盘语义，必须另追加精确范围和真实前后证据。

主 agent的下一轮应按以下顺序取得普通及全屏的截图、原生事件对应操作结果与必要的只读DOM，不能合成为UI测试：

1. 新页面确认同一Desk budget数据，进入全屏。打开工作表主菜单，对Change color第一次Enter和第二次Enter各截图；两次色盘都可见，按钮焦点及位置正确。
2. 点击More Colors，记录Dialog焦点和物理父链；真实点击颜色输入并输入可恢复的合成颜色，点击/拖动库颜色滑条中的一个真实控件，确认Dialog与所属菜单仍保持可操作。对内部滚动事件确认没有把父菜单关闭或让背景意外滚动。
3. 点击Cancel，仅结束Dialog；记录实际焦点，并确认原主菜单/色盘仍属于当前打开菜单。再单独Escape结束主菜单，随即打开zoom；截图应显示干净可用的zoom菜单，之前菜单的整棵后代已按生命周期结束。这里以新菜单正常操作和清楚的页面状态为正向验收，不新增“节点不存在”自动化断言。
4. 重新打开色盘与Dialog，按一次Escape确认仅顶层Dialog关闭；第二次Escape结束主菜单。再使用表格或工具栏的真实键盘入口，确认交互可继续。外部点击zoom关闭旧主菜单后，125%→100%实际缩放仍正常。
5. 对More Colors执行一次可撤销的确认操作，确认当前工作表颜色/选择输出正确，之后恢复；重新打开同一菜单验证没有继承旧submenuVisible/ready。退出全屏后重复主菜单→色盘→Dialog输入/取消→外部菜单这条关键链，并核对名称Popover和Tooltip定位没有受到事件阶段变更影响。
6. 记录此次scope页面/服务正常关闭与原owner退出；按照已落盘规则完成构建、类型检查、依赖安装取证和实际截图复核，才能把389从“第一轮未通过”更新为交付。

中文AX三项、More Colors既有键盘语义/取消焦点、未实际可达的其它库组件仍是明确边界。本节只完成根因和冻结方案，尚未实施新增AnchoredContextMenu修复或取得其后态，不能追认第一轮已经通过。

### 第二轮实现

主agent读完本节后，按冻结方案修改四份AnchoredContextMenu运行时分发：isOpen贯穿打开轮次、激活、文档监听、Popup及Panel；单一WeakSet承接React逻辑后代的原生pointer/wheel事件；文档冒泡阶段判断归属，Escape尊重defaultPrevented。删除contentRef及物理class/contains猜测，文档监听按相同阶段对称取消。没有改变Design补丁、添加新容器或改动其它Panel入口。

`fix-menu-ownership.mjs`只编辑已审查函数；前一轮四份UI安装文件保存到自有`vendor-attempt1`。正常Bun1.4 patch-commit及`install --frozen-lockfile`均exit0（执行回执6d7150），随后独立构建`ui-after2`，不覆盖第一轮产物。补充代码已交audit_ui只读复核；新的真实完整交互尚未开始，本记录仍不宣称389通过。

## 最终实施、验收与交付边界

### 实施及独立复核收敛

主 agent按追加方案修复四份AnchoredContextMenu/UMD Ho：同一isOpen贯穿可见轮次、服务激活、文档监听、Popup和Panel；稳定WeakSet记录section捕获的原生Pointer/Wheel事件，document冒泡按身份识别真正的React后代，wheel保持passive:false且对称解绑；Escape尊重defaultPrevented；删除无用途的contentRef/p。没有新增全局class/role判断、另一个宿主、定时隐藏、UI自动化或模型消息。

正常Bun patch-commit及frozen-install完成。audit_ui独立复读四种分发及overlay preset真正解析的安装文件，确认事件归属、生命周期、Tooltip两处viewport坐标和UMD绑定符合方案。再次patch带入的两个空.bun-tag缓存diff已精确剔除并重新正常frozen-install；最终ui/design各仅四份runtime，既有并行patch保持。最终构建50.95秒exit0；overlay typecheck通过。构建日志有既有大chunk提示，未将提示或类型检查当作视觉验收。

### 第二轮真实桌面结果

完整证据与明确选取清单见[389证据目录](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/README.md)。主 agent在独立tab28实际交互并人工查看全部final截图；audit_ui归档时又人工查看关键残留失败、Dialog输入和hue操作、干净zoom、Escape返回菜单、B2/公式结果、中文菜单/Tooltip和重新挂载样本，没有运行自动化页面测试。

| 已完成范围 | 真实输出与对应证据 |
| --- | --- |
| 全屏主菜单与重复激活 | 第一次及第二次Enter都保留完整可见色盘；[两次操作](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-fullscreen-repeat-enter.png)。 |
| 后代Dialog输入、Pointer/Wheel归属 | 输入336699得到RGB51/102/153，拖hue得到8d3399并实际内部wheel，Dialog保持可操作；[输入](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-fullscreen-dialog-input.png)、[拖动后](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-fullscreen-dialog-pointer-wheel.png)。 |
| 关闭与层次 | Cancel只结束Dialog；接着Escape结束主菜单并打开干净zoom。第二次Dialog一次Escape回菜单、第二次关闭父层；[返回菜单](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-dialog-escape-to-menu.png)、[干净zoom](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-fullscreen-zoom-after-menu-close.png)。第一轮残留图片继续保留为根因证据。 |
| 真实命令与撤销 | zoom125%→100%正常；颜色#336699实际应用，canvas获得焦点后Ctrl+Z恢复原tab style。[命令原始读值](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/observations/final-color-command.json)同时记录tab获得焦点时Ctrl+Z未生效，不能省略为无条件撤销成功。 |
| 同一实例数据与真实导出 | B2改为9后Total为14；菜单、语言、全屏切换期间保持这一编辑实例，并通过真实Download下载61字节CSV。[编辑截图](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-edited-workbook.png)、[导出检查](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/observations/final-export-check.json)、[原始CSV gzip](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/downloads/final-edited-workbook.csv.gz)。 |
| 普通/全屏及当前语言 | 普通中文主菜单、重复Enter、996633输入/取消、外部zoom关闭正常；普通滚动后与全屏Tooltip均显示中文，中文Popover可见。全屏Frame仍是64px/1376px两行；[几何](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/observations/final-fullscreen-geometry.json)、[普通滚动Tooltip](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/observations/final-normal-tooltip.json)。语言en→zh→en已恢复。 |

实际CSV为带UTF-8字节序标记的以下四行，行间CRLF，末行没有结尾换行，总计61字节。gzip解压后与实际下载原文件逐字节相同，防止Git换行规范化改变证据；这里检查的是实际下载产物完整性，没有使用源码哈希作为功能验收。

```csv
"Item","Quantity"
"Notebook","9"
"Pen","5"
"Total","14"
```

### 物理收尾与归档安全

最终tab28在2026-10-13T11:10:24.388Z关闭；owner84148、occurrence `c67b73cf-06e3-4ded-8a98-86955ef81782` 经原owner stop-requested正常结束，launcher92626 join exit0，terminal elapsed800601ms。[最终owner](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/logs/final/owner.json)、[ready](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/logs/final/ready.json)、[terminal](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/logs/final/terminal.json)与压缩stdout/stderr一并保留。前态owner84800/launcher16197及第一轮owner84648/launcher78924也有各自正常退出记录；没有把一次退出套用到另一次scope。

389复用387规范数据，无新增凭据或模型执行。归档仅选择21张关键截图、必要JSON、原始CSV gzip及构建/类型/三轮服务日志gzip；没有泛拷贝数据库、auth/models、vendor或构建资源。拖移未达目的的before-normal-color-hover、加载中的final-other-chat、第一轮缺少目标的普通Tooltip图片明确排除。有限凭据模式扫描、全部gzip字节恢复和本规格/证据README相对链接检查结果保留在[archive-check.json](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/archive-check.json)；它们只是归档安全与完整性证据，不代替真实交互。

### 准确剩余边界与后续调查

1. **跨Chat未导出编辑。** 最后切到另一Chat再回来，表格重新挂载，回到发布值Notebook7/Total12和A1选区；[final-remounted-menu](../../artifacts/2026-10-13-spreadsheet-fullscreen-popups-389/screenshots/final-remounted-menu.png)证明新实例菜单可用。此事实不能被改写成未导出编辑已经跨会话持久化，也不能在没有当前持久化/未保存提示合同分析时宣告为期望行为。下一批应独立分析是否需要保存/导出提醒或编辑生命周期改进。本轮已证明的是此前同一已编辑实例保留9/14，并实际导出；不将两种状态混写。
2. **语言和焦点。** `Sheet tabs`、`Close sidebar`、`Notifications alt+T`三个可访问名称仍为英文；More Colors仍为无href的a，Cancel后的body焦点仍记录为后续问题，未声称本次修复或有证据定性为新增回归。不能宣传整个Univer已完成全部语言和无障碍支持。
3. **视觉覆盖范围。** 本轮真实样本覆盖已操作的工作表菜单/色盘、Dialog、zoom、名称Popover及Tooltip。其它静态共用消费者未逐一视觉验收；移动端、同时多实例、RectPopup默认id及不可达Gallery/HoverCard/DraggableList不在完成范围。

在上述准确边界内，389的三个已证实根因（全屏外部弹层归属、重复激活ready、父菜单关闭与后代事件/生命周期）已实施并通过第二轮真实页面验收。第一轮失败记录保留，不追认其通过。audit_ui已完成授权的389规格/证据归档并冻结；共享README、当前文档检查、范围提交、合并上游及正常push仍由主 agent负责，未由本子任务执行，也没有Release/tag动作。
