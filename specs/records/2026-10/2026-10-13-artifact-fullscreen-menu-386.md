# 386 全屏产物菜单操作超时调查

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
