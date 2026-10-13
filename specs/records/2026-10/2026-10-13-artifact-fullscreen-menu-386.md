# 386 全屏产物菜单键盘循环修复

## Recall

用户要求持续按批次并行体验和调查 OpenCorvus 的界面、体验、功能与缺陷，先完成根因/影响分析并落盘，再实施有证据的修复、真实桌面交互与截图人工复核、聚焦正向功能检查、范围提交和正常上游同步推送。384主 agent 负责真实产物工具栏体验及生产修改；audit_ui 在本轮仅获准追加384调查记录并创建本386方案，禁止产品修改、服务/Provider启动、浏览器操作、UI自动化测试或再次委托。共享 README/索引、文档检查和最终范围提交由主 agent 负责；本子任务不改共享索引。

恢复上下文后先重读本 Recall、[384](2026-10-13-artifact-action-focus-384.md)最后三节及原实际回执，核对当前工作区。不要把本方案的“拟调查”当作已经执行，也不要重新创建模型产物或重复已经完成的384复制验收。旧真实 Chat 为 `ses_hVS7dJNLzINUMa8gSm91`，其中 Reading notes（file-preview@1）与 Desk note（document@1）来自真实用户请求和模型发布；具体复用数据与页面身份必须由原 owner 核实后交接，不从名称猜测当前目标。

已完成事实：后态自有tab10/tab12进入产物全屏、键盘聚焦Download并Enter打开菜单后出现CUA（Computer Use Agent，计算机操作代理）超时，后续同页CDP（Chrome DevTools Protocol，Chrome开发者工具协议）focus-emulation操作也超时；同浏览器fresh普通页可操作。主 agent 又用原377完整UI和同一真实产物在fresh tab13实际对照：进入全屏，Shift+Tab聚焦Download并截图，然后单独Return，约30秒后同样timeout及工具kernel reset。前态不含384改动，已经排除该异常由384首次引入；精确失效机制仍未知。所有相关服务scope正常shutdown/join exit0；stale tabs的closed状态未确认。

已读资料：当前07-panel的产物、异步动作、inactive页面及fullscreen合同；ArtifactActions/ArtifactFrame/FilePreviewArtifact、Button/DropdownMenu、artifact-export/file-download、McpAppArtifact、ImagePreview、Conversation焦点/尺寸观察和CodeEditor；安装版Kobalte MenuPortal/MenuContentBase/MenuItem/controllable signal、createFocusScope、ariaHideOutside、DismissableLayer/layerStack、Popper/Floating UI调用；Solid Portal和实际本地构建的mount getter。历史包括287复制反馈、359剪贴板宿主边界、inactive workspace paint isolation、root-artifact-editing qualification及final-download-observation-review。全仓检索覆盖fullscreenElement、requestFullscreen、Portal mount、focusin/out、MutationObserver和ArtifactActions全部调用；20个产物renderer共享唯一Frame/Actions，Inspector两个无payload Frame不创建该工具栏。

委托反馈：audit_ui只读确认Portal在打开时读取当前fullscreenElement，否定“初建固定挂body”的猜测；发现默认modal菜单同时有焦点、可访问性隐藏、指针和测量机制，以及portal加入全屏grid的布局边界，但没有证明其中任何一个发生无限循环。本轮没有修改或运行UI测试；现有artifact-export/file-download-authority纯数据测试不能证明浏览器可操作性或焦点。

## 问题深度、影响与未知

可观察现象是全屏Download的打开动作未通过操作通道返回，随后同tab的焦点模拟命令超时。直接触发已由键盘焦点截图和独立Return分开确认；没有证据表明已选中菜单项或调用下载，所以此时不能归因文件读取、导出内容、下载字节或run()异步归属。后端服务正常结束不证明前端线程健康；其他tab可用也不单独证明故障仅在产品JavaScript。

数据/控制流候选尚未收敛：真实fullscreen top-layer与modal交互；focus scope/sentinel与文档级焦点事件；ariaHideOutside或祖先观察器；Floating UI/ResizeObserver及全屏grid；CUA/CDP在该页面状态下的实现边界。缺少实际菜单物理父节点、失效瞬间焦点链、事件或任务调用栈、layout变化序列和浏览器进程状态，全部标记未知。不得把CDP错误标题、库中存在observer或一次错误截图命名直接认作根因。

旧路径没有根治的原因：287只修工具复制反馈，359只记录首次剪贴板跨应用边界；384只处理已复现的busy原生disabled导致失焦。此前fullscreen layout和下载内容验收未建立本轮相同触发的完整成功证据。前后态已经复现，不需要通过恢复旧实现规避新问题。

影响面按共享机制审计，但不要无目标扩展：ArtifactFrame的20个renderer共同使用下载菜单；FilePreview的文本/PDF和Document是当前真实可复用样本。MCP App资源菜单、ImagePreview ContextMenu是不同稳定/响应式宿主的对照入口；原生Browser菜单具有不同宿主，未证明相关。序列化/持久化数据、Task/Mission/Session调度、重试恢复与Provider路由当前无异常证据，不能将前端失联扩大为执行故障；若后续出现调度或终态异常，立即按AGENTS转为全部生产入口/执行轮次的横向审计。

## 下一阶段调查顺序

1. **保全现有事实。** 主 agent 将三个失败tab对应的原页面/资源身份、键盘动作、截图及原工具超时输出，与各自服务shutdown/join回执分别绑定。仅保存工具实际返回的字段，不猜测缺失截图路径、PID或关闭结果。stale tab保留“关闭未确认”；只通过受支持的自有标签页关闭操作继续收拢，不重启/杀死用户浏览器或其它窗口，不将工具kernel reset当作关闭。
2. **重用真实数据，限定一次有区别的观察。** 只有原服务完全闭合、数据源/资产来源已核实后，才由主 agent 按现有正常开发模式和既有固定scope/成本边界准备下一轮；此页不需要新模型、凭据或伪造产物。前态/后态相同触发已完成，无需为了“再看看”无限重复失联。下一次交互必须解决明确未知，例如鼠标打开是否同样失联，或同一文档的嵌入/全屏Portal实际父节点有何区别。
3. **分清焦点与主线程。** 在工具支持的只读观测范围内记录失败前fullscreenElement、当前焦点元素、所属Frame/菜单的真实身份，以及最后成功的操作。若打开后仍能取得截图或可访问性树，核查菜单是否显示、焦点落在trigger/content/item何处；若所有受支持操作均超时，则保留这个边界，不通过未获准的另一个自动化框架、隐藏页面函数或任意CDP连接绕过工具限制。没有调用栈或事件证据时继续记“未知”，不编造freeze/infinite-loop结论。
4. **审计全屏与modal的共同机制。** 核对菜单真正挂在当前Frame内；列出当前Dialog/Popover/menu focus scopes与原生fullscreen是否有竞争的焦点所有者；追踪安装版sentinel插入、focusin/out重定向、ariaHideOutside、pointer-blocking的启用和清理条件。按调用点/现有日志/实际可见证据验证，不把全部modal设false作为试验修复，也不新增平行focus manager。
5. **审计布局与观察器。** 核对Portal container在全屏Frame内的位置、显式/隐式grid行及菜单positioner的containing block；对照嵌入正常页面。追查Floating UI尺寸写入→ResizeObserver/祖先测量→再次写入是否真正形成循环；Conversation焦点行保留与CodeEditor重测量只在有证据连接时扩大。现有父容器、菜单和renderer必须继续使用同一份数据与布局所有权，不能通过移走正文、卸载原renderer或body旁路隐藏问题。
6. **收敛后再实施。** 只有实际证据定位到产品或依赖集成根因，才追加准确修复方案、受影响接口/调用点和风险，完成全仓同义实现/历史搜索后修改。若证据定位操作工具/浏览器宿主，记录精确版本、前提和失败动作，保留产品未改的事实；不能用产品双实现、延时、重试或权限变更补偿未知外部问题。

## 验收与退出条件

调查阶段的成功是排除或定位一个具体机制并提供可核验事实，不等于全屏菜单已修复。修复交付必须在真实桌面`/ui`完成：打开与关闭全屏菜单、键盘选中实际文件、下载内容/文件名正确、Escape和菜单关闭后的焦点返回、保持同一renderer与阅读内容、嵌入菜单/Copy回归；中英文及当前UI规模按实际受影响区域复核截图。只有实际见到的状态才能标通过，类型/build/console clean和纯数据测试均不能替代这些行为。

禁止新增/运行任何UI自动化测试、DOM/源码文案断言、浏览器fixture、截图基线或像素比较。若修改纯数据/服务契约，新增聚焦正向合同并走正式隔离runner；纯UI修改以真实页面/截图为准。本批没有新增版本或发布授权，没有已认定需删除的死代码。

每个服务必须使用现有owner正常收尾并保留原始退出/输出/请求事实；标签页独立确认closed。无法完成时逐项列明：全屏菜单仍未验收、精确根因未知、哪条观测通道受阻、哪些tab关闭未确认，以及已有的前后态对照和服务退出事实。不得以384局部复制修复已通过、旧版本也失败或新普通tab可用宣称整体完成。

新增本spec及384追加记录的共享README/目录索引、当前package.json声明的文档检查、范围提交及正常上游同步推送，由主 agent统一完成。本次文档分工只创建本文件并追加384，不接管并行任务的产品源码、暂存或Git提交。

## 2026-10-13 16:26 继续调查：文档与输入方式对照

上一goal turn为实质进展：384、383、385生产修复/证据分别提交e782d749a、f1884ead9、3d4adff49并正常推送，main与upstream相同。本批开始git status仍为其他任务的file/permission/session恢复、Explorer和用量界面改动，保持不动。当前真实CUA inventory仅保留旧tab1（18481不可达页），先前10/12/13/15等自有tab已不在清单；这是本轮实际库存事实，补足上轮关闭未确认，不能倒填上轮成功关闭。

根因尚未知，先做一个有区别的实页观察：同一真实Chat中自然发布的Desk note文档没有CodeMirror与附件获取过程，进入相同ArtifactFrame全屏后先用鼠标打开Download，取得菜单实际父级/焦点和截图；如可用，再单独键盘打开与Escape返回，下载真实文档文本核对其声明内容。这样区分共享Frame/menu与File/CodeMirror、鼠标与键盘，而不是再重复同一失败。所有页面交互仍由主agent用受支持CUA完成，DOM只读信息不是自动化断言，不改隐藏状态或请求。audit_ui单层只读审机制与权威上游资料，audit_functionality负责独立383/385模型复验，无再次委托。

先核实原ui-final-localized owner已正常退出，复用其原真实规范数据库和已删除凭据的隔离home。调用现有launch-review.ps1新Stage ui-fullscreen-document-386，冻结UI使用已验收ui-final-build，仍生产listener/recovery、localhost:18499/ui、20分钟固定自有服务边界。新scope不用模型、不复制凭据、不制造消息/产物、不操作用户进程。新归档目录只保留本次原始实页与物理回执，具体根因收敛前不修改产品。

## Recall 进度：386 根因已经收敛，实施与后态验收尚待完成

本节追加于主 agent 完成 Document 鼠标、键盘及根元素样式对照之后，更新前文调查阶段的“根因未知”，不倒填此前证据。主 agent 授权 audit_ui 只向本386追加根因、影响、实际依赖路径、分发格式与补丁方案；本子任务未改产品、依赖、共享索引或其它规格，未运行 UI 自动化、服务或 Provider，未操作浏览器或再次委托。主 agent 持有实际交互回执并负责实现、重新构建、真实页面验收、归档、文档检查和范围提交。

目前已收敛为安装版 `@kobalte/utils@0.9.2` 的 `scrollIntoViewport` 在根元素 `overflow:hidden` 时不会前进的同步祖先遍历。已完成代码闭环证明、真实普通/全屏 computed style 条件核对，以及绕过该调用但仍执行菜单项 autofocus 的 ArrowUp 正向对照。未完成的是补丁安装与发布入口核对、重建后的 Enter/Space/ArrowDown 全屏打开、实际下载和关闭焦点，以及修复后局部滚动与原阅读位置的视觉复核。本次没有把“已定位”表述成“已修复”。

### 实际证据与触发顺序

主 agent 在同一真实 Chat 的 Desk note（`document@1`，无 CodeMirror）上完成以下观察。原始证据当前位于自有临时目录 `.tmp-artifact-fullscreen-menu-386`；归档到 `specs/artifacts/**` 与原服务回执绑定由主 agent 完成，本节不虚构尚未生成的归档路径。

| 观察 | 实际结果与证据 |
| --- | --- |
| Document 全屏后鼠标打开 Download | tab18 的单独 click 约0.76秒完成；随后可访问性树、截图和 `document-mouse-menu.json` 均可读。菜单物理父链为 DIV → DIV → SECTION，SECTION 是 `data-artifact-renderer=Document` 且匹配 `:fullscreen`；焦点在 `role=menu` 内容上。 |
| 关闭后键盘 Enter | Escape 关闭鼠标菜单且焦点回 Download；随后单独 Return（未串接读取可访问性树）约30秒超时并 kernel reset，与 File 键盘现象一致。 |
| 普通根样式 | `normal-overflow-chain.json` 中 root 为 HTML，computed `overflow=clip`；从 Download 到根的首个且唯一 `auto/scroll` 祖先为 `DIV#chatScroll.chat-scroll.session-content`，`overflow="auto scroll"`、X=`auto`、Y=`scroll`。 |
| 全屏根样式 | `fullscreen-overflow-chain.json` 中 root 为 HTML，computed `overflow=hidden`；上述滚动祖先身份和值相同，产物 SECTION 的 `fullscreen=true`。这是页面实际 computed 值，不能用普通源码声明的 `clip` 覆盖它。 |
| 同一真实 Document 全屏 ArrowUp | Shift+Tab 聚焦 Download 后，Up 成功打开菜单并直接聚焦唯一的 `Desk note.md` 菜单项，见 `screenshots/fullscreen-arrowup-menu.png`。这条库分支仍会执行菜单项焦点、modal 和定位机制，但跳过有缺陷的打开前滚动。 |

audit_ui 已读取三份 JSON，并人工查看 `screenshots/document-mouse-menu.png` 与 `screenshots/fullscreen-arrowup-menu.png`：两张均显示全屏 Desk note 的正文、顶部工具栏及右上方真实文件菜单；ArrowUp 图的文件项具有焦点/高亮状态。实际操作、键盘输入与动作耗时仍归属于主 agent 的原工具回执，不冒称由子 agent 操作。CUA 只读 document 代理未暴露 `fullscreenElement`，不得将该代理属性缺席当作真实浏览器属性为空；本次使用已读的元素 `:fullscreen` 状态和物理父链核对。

主 agent 已说明将正常关闭本次仍可操作的页面；该说明是计划，最终关闭结果与新服务退出状态仍以其后续回执为准。本轮开始 inventory 中旧失败页已不在清单的事实见上一节，不改写旧轮的关闭未确认记录。

### 数据与控制流根因

生产 `ArtifactActions.tsx:162` 使用唯一 `DropdownMenu.Trigger`，`components/ui/DropdownMenu.tsx:46` 直接导出 Kobalte Trigger。安装版 Core `src/menu/menu-trigger.tsx:198`（默认 JS 分发 `dist/chunk/46NU5BYI.js:336`，Solid JSX 分发 `dist/chunk/LEK3K6R3.jsx:454`）在 Enter、Space 及当前横向 root 的 ArrowDown 中执行以下顺序：阻止原生键盘默认动作 → `scrollIntoViewport(e.currentTarget)` → `context.open("first")`。ArrowUp 分支直接 `context.open("last")`；鼠标分支 `context.toggle(true)`。因此 Enter 的挂死发生于菜单 open 之前，无需菜单已经挂载，也无需下载动作、异步资源读取或 `ArtifactActions.run()` 已开始。

安装版 Utils `src/scroll-into-view.ts:81` 读取 `document.scrollingElement || document.documentElement`，只有根的 computed `overflow` 严格等于 `hidden` 才进入手工滚动祖先分支。正常页实际为 `clip`，走原生 `scrollIntoView` 分支；全屏实际为 `hidden`，走本次有缺陷分支。`src/get-scroll-parent.ts:9` 的既有公开语义是从传入节点本身开始查找第一个 computed overflow 含 `auto` 或 `scroll` 的节点；它允许返回传入节点自身，并不保证严格祖先。

缺陷位于调用方循环末尾 `src/scroll-into-view.ts:125`：它先令 `targetElement = scrollParent`，再调用 `getScrollParent(targetElement)`，未向父节点推进。以真实的 S=`DIV#chatScroll`、R=`HTML` 代入：初次 `getScrollParent(trigger)` 返回 S；第一轮末 `(targetElement, scrollParent)=(S,S)`；后续 `getScrollParent(S)` 仍返回 S，且 S 始终不等于 R，四项 while 条件继续为真。重复写同一元素的滚动坐标不会改变其 computed overflow 或父子身份，控制流无法返回。库代码加真实 DOM 条件已形成充分的同步无限循环证据；未取得 CPU profile 或浏览器执行栈，不声称已经捕获这些额外诊断。

原377完整UI和384后态均保留此依赖逻辑，解释了前后态同样复现。384调整的受控 disclosure、文件准备先后和忙碌 ARIA 属性均在循环后的打开或下载路径，不是此问题的首次引入。287复制反馈、359剪贴板宿主记录、此前全屏布局与鼠标下载验收没有覆盖根元素变为 `hidden` 后的键盘打开链，所以没有根治本项缺陷。当前仓库已有的 Core patch 修改类型声明、指针层、定位选项与 tooltip 焦点，并未修补 Utils 的该遍历。

### 全部消费者、公共契约与影响范围

全仓产品源码、`script/`、`patches/` 以及安装版 Core/Utils 的源码与可执行分发检索了 `scrollIntoViewport`、`getScrollParent` 和 `MenuTrigger`。产品源码没有直接调用这两个 Utils 函数。安装 Core 内唯一直接 `scrollIntoViewport` 调用是 `MenuTrigger`，其 `.js` 与 `.jsx` 是同一源实现的分发，不是两个产品能力。Utils 的 `getScrollParent` 在该包内由同一个滚动函数调用；不应为修调用方进度而改变这个独立导出的包含自身语义。

Core 公开入口的传递关系为：`dropdown-menu/index.tsx` 直接导出 `MenuTrigger as Trigger`；`menubar/menubar-trigger.tsx` 调用同一 `MenuTrigger`；`navigation-menu/navigation-menu-trigger.tsx` 包装 `MenubarTrigger`。Core `Menu` 自身也导出该 Trigger。ContextMenu 使用独立 `ContextMenuTrigger`，子菜单使用独立 `MenuSubTrigger`，Select 使用独立 `SelectTrigger`；这些触发器并无本函数调用，不因也有 modal/定位机制就算作同一故障入口。当前产品没有 NavigationMenu 或原始 Menu 的直接消费。

当前生产 DropdownMenu Trigger 消费文件共15个、调用点19处：`App.tsx:127`、`CardOverflowMenu.tsx:43`、`ChatComposer.tsx:378`、`ComposerPermissionControl.tsx:69`、`Conversation.tsx:1020`、`ProjectLedgerGroup.tsx:202`、`RightDock.tsx:381/430`、`SidebarVersionLabel.tsx:35`、`TaskDirBar.tsx:1273`、`WorkLedger.tsx:623/1213/1329/1473`、`WorkspaceSplitLauncher.tsx:188`、`interactive-artifact/ArtifactActions.tsx:162`、`interactive-artifact/McpAppArtifact.tsx:655`、`settings/ExpertSquadPanel.tsx:1578`、`settings/ProvidersPanel.tsx:992`。以上路径相对 `packages/overlay/src/components/`；`WorkLedger` 四处和 `RightDock` 两处属于各自重复入口。另有 `titlebar/TitlebarMenubar.tsx:533` 经唯一 `ui/Menubar.tsx` 使用同一底层 Trigger。数量为本次源码快照，后续并行编辑可能移动行号。

共享函数修复覆盖这些入口在“根 hidden 且存在非根滚动祖先”时的进度保证，不宣称它们都已实页复现。ArtifactActions 仍由唯一 Frame 提供给20个产物 renderer，File 与 Document 为本次实际样本；MCP App 还有自己的资源菜单。纯 ContextMenu 的 FileExplorer、ImagePreview 等不是本次直接消费。下载内容、文件名、权限、异步动作归属、复制器、语言目录、持久化数据及网络接口均不需要修改。没有 Task/Mission/Session 调度、终态、并发或重启恢复异常证据，本次循环属于浏览器主线程同步调用，不把它扩展为服务执行恢复问题。

### modal、焦点和观察器横审结论

- Core `455ZADO2.js` 的 ariaHideOutside 只观察 `childList/subtree`；其自身 `aria-hidden` 属性写入不会触发同一 observer。可见菜单及其祖先在遍历中被保留。本次鼠标成功还实际覆盖了该机制的启用和关闭。
- `ISKHZMHS.js` 的焦点范围由统一栈暂停旧范围；sentinel observer 只检查内容直接子节点，未见本次发生重复边界移动的证据。`H6DSIDEC.js:417` 的延迟 `tryAutoFocus` 设置 focused key，`:580` 聚焦条目，`:460` 调整菜单内滚动；ArrowUp 的唯一文件项成功对照覆盖这条后续链，证明它不是本次 Enter 挂死所必需。
- `solid-prevent-scroll@0.1.10` 在启用时给 body 设置 overflow 及可能的滚动条补偿，事件监听处理 wheel/touch；当前根样式证据在菜单打开前取得。上游 [Kobalte #698](https://github.com/kobaltedev/kobalte/issues/698) / [Corvu #107](https://github.com/corvudev/corvu/pull/107) 的已知问题是 body 锁改变 sticky 布局，维护者说明由0.1.11修复；不能将这个不同症状当作386修复或顺带升级依赖。
- Kobalte 本次实际引用 Floating UI DOM 1.7.6（仓库另有1.8.0但不是此依赖解析）。其 autoUpdate 含对 `size` + ResizeObserver 的取消/下一帧重观察保护；`observeMove` 对完全裁剪情况有节流。Popper 的变换与尺寸写入、全屏 Frame 的隐式第三条 grid 行、Conversation 的 requestAnimationFrame 合并测量原本都是候选，但发生在菜单创建之后，鼠标与 ArrowUp 已成功，不是此次打开前同步循环所必需。
- Conversation 的 focusin/out 仅据真实祖先更新被保留的卡片 ID，尺寸 observer 通过现有逐帧合并调度调用内容测量；本次没有证明该处另有闭环。上游 [Floating UI #1740](https://github.com/floating-ui/floating-ui/issues/1740) 为尺寸反馈问题，当前版本已有相关保护；[#3512](https://github.com/floating-ui/floating-ui/issues/3512) 是 React useFloating 随 placement 重建 observer，产品这条 Solid 路径不适用。历史 [Kobalte #167](https://github.com/kobaltedev/kobalte/issues/167) 是两个 Select 展开切换，未提供与此调用相同的证据。

本次未证明这些机制在所有场景均无缺陷，只用具体读取与正向对照排除了它们作为已定位同步循环的必要条件。无需关闭 modal、移 Portal、改 grid、延迟打开、拦截按键或引入第二套焦点管理。

### 实际依赖解析与完整发布格式

Node.js 的 `createRequire`/`require.resolve` 与文件真实路径只用于读取模块解析，没有加载 DOM 或运行 UI 测试。实际结果是：仓库根 `node_modules/@kobalte/utils` 和 `packages/overlay/node_modules/@kobalte/utils` 均不存在，从 root/overlay 的 `package.json` 直接解析 Utils 都得到 `MODULE_NOT_FOUND`。不能据此宣称依赖缺失，也不能在上述想当然路径写补丁。

`packages/overlay/node_modules/@kobalte/core` 实际指向 `D:\myhexin-local\opencorvus\node_modules\.bun\@kobalte+core@0.13.11+ee58d66d663bac7b\node_modules\@kobalte\core`。从该 Core 的真实 `package.json` 建立 require 后，Utils 解析到 `D:\myhexin-local\opencorvus\node_modules\.bun\@kobalte+utils@0.9.2+ee58d66d663bac7b\node_modules\@kobalte\utils\dist\index.cjs`；Core 私有 `node_modules/@kobalte/utils` 链接也指向这个 Utils 包。全仓 Bun 包文件清单中只有此版本的 Utils。Bun 存储后缀是当前安装事实，不写入产品导入或未来可移植脚本；实施时按锁文件的包身份重新解析。

| 包内路径/入口 | 读取结果与补丁处理 |
| --- | --- |
| `src/scroll-into-view.ts` | 循环末尾第125行；package `exports["./src/*"]` 暴露源码路径。同步修源实现。 |
| `src/get-scroll-parent.ts` | 第9行从自身开始搜索；保持语义和代码。 |
| `dist/index.js` | ECMAScript Modules（ESM，模块分发），循环末尾第770行；`exports.solid`、`exports.import.default` 和 `module` 都指向这里，是 Solid/Vite 构建所需实现。 |
| `dist/index.cjs` | CommonJS（CJS，CommonJS模块分发），循环末尾第772行；`exports.require` 与 `main` 指向这里。即使当前页面走ESM也同步修此正式入口。 |
| `dist/index.js.map` / `dist/index.cjs.map` | 两份 source map 都有21个sources及sourcesContent，含 `../src/scroll-into-view.ts` 的旧实现；属于调试元数据，不执行，补丁同步该sourcesContent源段，避免调试器显示旧循环。 |
| `dist/index.d.ts` / `dist/index.d.cts` | 都声明 `scrollIntoViewport(...):void` 和 `getScrollParent(Element|null):Element`；修复不改签名，无需改声明。 |
| 其它入口 | 实际包清单无 Utils JSX、UMD、单独 browser bundle 或第二个 chunk 实现；`src/index.ts` 和分发出口只重导出，无需新增别名或产品侧替代实现。 |

安装包源码和现行上游 [scroll-into-view.ts](https://github.com/kobaltedev/kobalte/blob/main/packages/utils/src/scroll-into-view.ts) / [get-scroll-parent.ts](https://github.com/kobaltedev/kobalte/blob/main/packages/utils/src/get-scroll-parent.ts) 都保留相同逻辑；本次只读 GitHub issue 检索没有找到明确描述该函数闭环的现有 issue，不能把“未检到”写成上游从未报告。读取到的路径历史最近提交为 `f191fe728cf17df414d0fb2bd433a34c5b3a659c`（2024-05-03，构建许可证注释调整），没有本次遍历修复；引用历史事实不重建仓库禁止的旧日期规格。

### 最小 patchedDependencies 实施方案与验收

保持现有 API（Application Programming Interface，应用程序接口）、初次 `getScrollParent(targetElement)` 查找、普通根的原生滚动分支、根截止条件以及实际滚动计算。仅将 while 末尾的下一次查找改为 `getScrollParent(targetElement.parentElement)`：处理当前滚动节点之后，从其父节点继续查找，循环的每次继续都严格向上移动；父节点为空时沿库既有根返回语义结束。不是在相同节点上加次数上限、超时或跳过功能，也不改变独立 `getScrollParent` 的包含自身语义。

根 `package.json:182` 与 `bun.lock:367` 已有 `patchedDependencies`，Core 现有补丁必须保留。主 agent 已确定实施范围为根 `package.json`、`bun.lock` 和新增单一 `patches/@kobalte%2Futils@0.9.2.patch`，包内只包含上述源码、ESM、CJS及两份 map 的sourcesContent一致改动；通过既有 Bun patch/install 流程更新包注册和锁文件，不把 Bun 缓存本身当可提交事实，也不把 Utils 代码复制到产品工具函数。source map 是调试元数据，本次不以映射列位置或其内容作为运行正确性的验收；补丁后的入口检查属于依赖交付完整性检查，不冒充 UI 验收。

本改动直接修 UI DOM 滚动行为，按 AGENTS 禁止新增或运行 DOM、组件、浏览器fixture及源码文案断言测试；不为绕过规定包装伪 DOM 纯数据测试。本次触及的 Utils 发布包清单、Core 指定源码及产品直接控件路径未发现需运行的现存 UI 测试；没有无目标扩展扫描其它测试树。主 agent 需走现有真实开发 `/ui`，用同一真实产物完成补丁后的 Enter、Space、ArrowDown、ArrowUp和鼠标打开，确认实际菜单项、Escape返回、文件选择下载及文件内容，并截图人工复核；检查关闭/退出全屏后原页面仍可操作，正文和阅读位置没有被错误滚动。另以嵌入菜单及一个已有普通菜单进行共享路径回归，不宣称19处均已逐一实页验收。

风险在于修正后的遍历会继续处理此前到达不了的更外层滚动祖先；因此实际阅读位置与嵌套滚动行为是需要视觉确认的正向输出。保持所有现有权限、disabled/busy准入、文件身份与下载归属合同。纯类型检查、构建、补丁格式核对可以证明分发可构建，不能替代上述真实行为。没有版本更新、发布、凭据使用或上游发issue授权；本批只做仓库修复和正常Git交付。完成前继续列明未验收项，主 agent 负责共享索引、`docs:check`、真实证据归档、范围提交、拉取合并上游与正常推送。

## 实施与真实桌面后态（本轮完成）

主 agent 按以上方案使用 Bun 1.4.0 的 patch 流程，新增唯一 Utils 补丁及根 manifest/lock 注册。prepare 会建立其提示的 root editable package；这不改写此前从 Core 私有路径解析依赖的事实。实际 Core 私有安装中源码、ESM、CJS 与两份 map 均已应用；公开类型及 getScrollParent 本身保持。audit_ui 随后独立只读复核这五处及四张后态截图，通过且未另改代码。

完整[本轮证据](../../artifacts/2026-10-13-artifact-fullscreen-menu-386/README.md)保留前态根样式、鼠标/Up对照，以及后态中英文文档/文件。主 agent 实际 Enter、Space、Down、Up 与鼠标均成功打开全屏文档菜单，聚焦真实文件项；Escape 与键盘完成下载均回到下载按钮。长文件 Enter/Down 成功，滚动到行74/Note72后打开菜单、退出全屏、语言切换与重新全屏均保持所见阅读位置。普通 More 及嵌入下载菜单也通过；不外推全部19处消费者均已实际验收。没有UI自动化、DOM断言或截图比对。

真实浏览器下载文档101字节与发布正文相等，文件14687字节与规范原附件逐字节相等；重复文件名由浏览器加(2)，产物菜单保留原名。复制动作显示Copied并保持焦点；本轮CUA clipboard readText为空，未据此声称系统剪贴板内容再次通过，384既有实际复制证据继续独立保留。产品仅改菜单键盘滚动，没有修改复制合同。

私有构建exit0（7300 modules，63秒），冻结锁文件安装exit0（无依赖版本升级）。前后scope采用生产listener/recovery与私有构建、localhost:18499/ui，无独立Vite服务与模型调用。后态原生26324、launcher87250正常exit0，服务397226ms收尾；语言恢复English，tab21关闭，前态tab20已关闭。前态卡死tab18仍在清单，关闭未确认；固定terminal.reason不代表该tab关闭。初次误用Windows PowerShell5的ArgumentList调用在启动子进程前失败，改用当前PowerShell7正常执行原launcher；工具调用失误未冒充产品失败。

383/385 attempt04同期由audit_functionality独立验收并只读复核：真实GPT-6.1 Sol的11次流式请求全部HTTP200/EOF，Task completed，大结果全文及首尾补读正确，页面四图人工查看，原owner/输出/请求闭合且授权副本成对清理。它的模型验收只覆盖package Task链，不外推MCP模型/worker/Mission；前三轮失败原文继续保留。

`bun run --cwd packages/overlay typecheck` exit0；`bun run docs:check` exit0（348 ops/26 groups），范围diff检查通过，18499 listener已释放。类型与文档原始日志归入本轮证据。提交和上游推送在交付时另行核实，不预先标记成功。
