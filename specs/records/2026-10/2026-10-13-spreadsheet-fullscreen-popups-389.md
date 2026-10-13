# 389 电子表格全屏弹层归属调查

## Recall

用户要求持续按批次并行体验和调查 OpenCorvus 的 UI/UX（User Interface/User Experience，用户界面与体验）、功能与缺陷，先完成根因/影响分析并落盘，再实施有证据的修复、真实桌面页面与截图人工复核、聚焦正向检查及必要的授权 GPT-6.1 Sol 验收，范围提交、合并上游与正常推送后继续。主 agent拥有页面、服务、模型、实现、归档与Git交付；audit_ui本子任务只获准创建本389规格，不修改产品、387或共享索引，不操作浏览器、不启动服务/模型、不查找或运行UI自动化、不再次委托。主 agent统一更新索引、文档检查和提交。

恢复时先读本Recall、[387电子表格身份与语言方案](2026-10-13-spreadsheet-artifact-identity-387.md)的实际前态与后续收尾，以及本次原DOM观察/截图；不能把已有模型成果重新合成。真实Chat为 `ses_h0VKkCl7hbz3BKHVW2Xp`、artifact为 `art_g0VXv65e1004ErsrwSJs`，标题Desk budget、工作表清单。其授权GPT-6.1 Sol轮次有6个HTTP200/EOF（End Of File，流正常结束），首次value:null与formula输入被schema拒绝后模型自然纠正并发布成功；canonical checker、模型与前态复核scope的退出/配对清理记录属于387。不要把输入校验当作调度故障，不复用已退休凭据或猜测后态服务的关闭状态。

387已针对真实遗漏实施payload身份补齐和同一个UniverAPI.setLocale订阅；主 agent后态确认普通视图中文菜单可见，并取得本389全屏隐藏的真实DOM证据。本子任务此前只读复核这两个产品文件的diff，确认未重建工作簿、导出仍优先workbook.save()当前值。387不包含弹层宿主修复，也不能宣称整个库全部语言均完成。本389当前状态为根因证据与共享影响分析、后续集成计划；没有生产实现或修复后验收。

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
