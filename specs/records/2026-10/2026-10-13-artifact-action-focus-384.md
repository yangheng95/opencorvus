# 384 产物工具栏的忙碌焦点

## Recall

用户的持续目标是按批次并行体验和调查 UI/UX（User Interface/User Experience，用户界面/体验）与功能，先完成根因和影响分析并落盘，再实现、真实桌面交互和截图人工复核、聚焦正向功能测试及必要的授权 GPT-6.1 Sol 流式端到端验收，范围提交、合并上游、正常推送后自主进入下一批。381 PDF 与382网页文本保真已分别以 bdf8d3aad、2fcaa85d6正常推送。本轮 main 开始于2fcaa85d6；permission/session恢复、文件路径身份、用量界面与Listbox及共享索引已有其他任务改动，全部保留。单层audit_functionality负责383的投影工具输出授权，audit_ui只读复核本批控件契约，禁止再次委托；主agent拥有本批UI实现和真实页面。

恢复进度补充：普通视图Copy修复、实际下载字节、英文/中文焦点与全屏Copy已有截图；全屏Download在改前377包和改后包均触发浏览器控制超时，根因未定，独立386继续调查。中文实页另暴露本工具栏File/Document类型徽标硬编码；下述追加分析完成后，本批同时接入现有语言目录。原凭据模型轮次和三个已停止的隔离复核服务均保留实际终态，不能将控制超时或原runner固定的PageClosed原因文案误当页面关闭成功。

已读完整ArtifactActions、ArtifactFrame、FilePreviewArtifact、Button、DropdownMenu、ToolPayload复制primitive、artifact-export、file-download、interactive-artifact schema/publisher/guidance、公开global/chat/start与附件准入，以及当前07-panel的产物、异步动作、剪贴板和阅读合同。全仓搜索发现ArtifactActions唯一调用者是ArtifactFrame，20个renderer共享；普通FileEditorPane和没有payload/exportFiles的两个Inspector Frame不走这套操作。历史287已修复ToolPayload/交付名称的忙碌焦点，359记录浏览器/操作工具首次复制观测未知边界；9b5871eda保留了本组件原生disabled，主要修复导出结果归属。触及范围现有artifact-export/file-download-authority是纯数据/服务合同，不能证明焦点；不新增或运行UI自动化。

本批采用benchmark-debug-template与已读取computer-use技能。UI只用Node支持的真实CUA（Computer Use Agent，计算机操作代理）浏览器交互和截图人工检查，不写DOM（Document Object Model，文档对象模型）、文案、渲染或像素断言。模型产物必须由真实可见用户请求、实际模型和发布工具自然产生，不插入或伪造任何Message/Part。原始附件为本批自行生成的公开样本，不读取或外传用户私有资料。

## 现象、根因候选与全影响面

源码确定的触发点：run()在首次await之前同步写operation；Copy和Download trigger都用Boolean(operation())构造原生disabled，结束只清operation。浏览器对禁用按钮不提供正常焦点入口。尚未在真实页面证明焦点最终落点，不能直接宣称用户故障。权威依据是[HTML焦点模型](https://html.spec.whatwg.org/multipage/interaction.html#focusable-area)；Kobalte官方文档访问失败，接口决策以安装版公开类型和实际实现为准。

安装版Kobalte MenuItemBase先调用onSelect，随后以setTimeout关闭菜单，不等待该回调的Promise；关闭时库尝试聚焦原trigger。URL文件仍在读取时，现有trigger已disabled，因此库的焦点返回目标不可用。内联文本可能在timer前完成，不能只用它排除问题。旧代码把暂时忙碌与真正没有可用操作合并为同一种禁用状态；既有异步归属修复没有改变这条焦点链路。

影响所有20个产物renderer及嵌入/全屏的同一个Frame。FilePreview/Media/Model3d导出真实附件URL，Code读取本地编辑源、Spreadsheet读取当前工作簿、Terminal可复制选区，Document/Tree可覆盖导出列表，MCP（Model Context Protocol，模型上下文协议）App没有结果时的props.disabled是真正不可用。现有AbortController、源文件身份、ApiAuthority、项目选择代次、错误报告、Clipboard writer及下载字节/文件名均需维持唯一事实源。任务/会话调度、队列、持久化格式、模型工具授权不属于本批修改；若实际遇到恢复或终态异常，立即按AGENTS做共享机制横审。

## 前态验收与环境

复用上一轮验证通过的live-sol-locale-377-after.ps1、live-sol-cli-owned.ts和live-sol-shutdown.ps1，在独立scope artifact-action-focus-384-before、端口18498执行普通生产CLI `/ui`。原生服务上限600000ms、Provider累计12请求（含预检），模型无活动180000ms；有意义流活动只更新无活动时间，不延长原生总边界。固定原生护栏与技能要求的真实无活动诊断同时保留。观察采用定时读取回执，不持续监听日志。前态UI复用完整377私有包；本批ArtifactActions最近提交9b5871eda早于该包，真实HTTP资源与截图须另核对。

按用户明确授权使用当前OpenAI authority，仅由既有runner复制授权记录与完整相邻models.json；启动业务前分别验证credential usable、catalog projected、actualModel gpt-6.1-sol、streaming true。凭据不输出、不进spec/日志/提交，最终正常物理退出与输出/请求清理后成对删除。预置公开文本附件经正常global/chat/start上传并建立可见用户消息，请真实模型发布一个原附件file-preview@1及一个短document@1；不直接调用发布器伪造工具消息。SQLite（Structured Query Language Lite，嵌入式关系数据库）和真实审计检查产物/工具/消息归属与实际模型EOF（End Of File，流正常结束）。

主agent进入真实桌面页，键盘聚焦Copy并Enter激活，观察完成后焦点及后续Tab/Space；下载原附件时观察菜单关闭返回目标，保存真实下载并核对原始正文。复制成功标记只证明writer承诺，不将359的剪贴板边界当本次根因。打开/关闭当前产物全屏、切换界面语言也使用实际控件。保存操作前后截图并人工查看。若候选无法复现，继续调查而不为静态推测改产品。

## 条件实施方案与后态验收

真实前态复现后，只改ArtifactActions：props.disabled继续原生disabled；operation以aria-disabled/aria-busy表达并保持焦点。run入口同时抑制operation或真正disabled的调用。Download菜单复用现有useDisclosure作为唯一open值，忙碌/disabled时拒绝打开但始终允许关闭；沿用库的关闭和焦点返回，不增加延时focus、重试、双写或第二复制器。不能用open与operation布尔相与导致完成后自动重开，也不能只preventDefault（安装版trigger仍会执行内部打开处理）。本批没有拟删除的死代码或无关清理。

最终私有build后使用明确独立的无凭据服务读取同一已完成真实产物数据（原始模型服务先正常shutdown/join、配对凭据已清理，保留原运行回执），加载新的冻结UI资源，不重造或改写聊天数据。验证Copy完成仍能连续键盘操作、URL下载关闭返回trigger、忙碌重复动作抑制、原始下载内容/文件名与本地化控件、全屏同一renderer。真实无结果MCP禁用若没有现成样本只能记录代码合同边界，不能冒称实页覆盖。最终typecheck/build/i18n、必要纯服务测试和docs:check分别记结果，均不能替代截图。更新当前架构、索引、未发布双语说明，范围提交与正常上游同步推送。当前状态：仅调查/方案，尚未启动模型、复现或修改生产代码。

## 前态第一次预检失败

2026-10-13 15:07首次scope artifact-action-focus-384-before-d1a3f862-f9df-4a6c-9d2c-1018b45b81cc在Provider预检返回AI_StreamProviderError（服务端overloaded），还没有业务Chat、附件或产物。该错误不证明凭据未配置或模型未投影，也不构成调度/恢复异常。原launcher98585已实际join exit1，native Host73836/Target50548 settled/exited0、outputDrainComplete/requestCleanupComplete真实回执齐全，原supervisor据不可变失败正常清理auth/models，未将本轮资格称为成功。保留failed.json与完整首轮证据；等待后以新scope重试同一预检与原预算，不延长或重用已终止轮次。

## 实际前态复现与实施准入

第二轮artifact-action-focus-384-before-02通过独立预检；真实Chat ses_hVS7dJNLzINUMa8gSm91经global/chat/start接受公开14687字节文本附件，实际模型自然发布Reading notes(file-preview@1)和Desk note(document@1)并正常完成。用户消息中的原始size/sha是对本批实际文件字节计算的协议身份，规范URL来自真实附件索引，未作为功能验收摘要或伪造工具输入。实际下载逐字节等于原文，不靠重算摘要替代正文验证。

主agent在localhost:18498/ui用Shift+Tab聚焦文件产物Copy text，Enter后真实Copied出现，但焦点成为页面根部且按钮焦点环消失（before-copy-focus / before-copy-completed截图）。同页原附件下载实际成功、菜单焦点返回Download，内联document复制也保留焦点；两项正向对照原样记录，不称每种动作都会失败。已证实是异步附件复制让operation跨事件循环持续时，native disabled撤掉焦点入口；同一忙碌规则应保持两个控件的一致准入及菜单库的焦点返回。

前态页已关闭，已执行原PageClosed shutdown；所有原始回执和模型结果保留。现在依照条件方案只改ArtifactActions，用现有disclosure控制菜单，保留所有资源/项目/归属守卫。不得把复制焦点修复宣称为359系统剪贴板读回问题修复。

## 全屏 Download 菜单的独立异常与前态对照

主 agent 的后态真实页面已通过嵌入菜单下载与全屏 Copy，但在两个独立自有标签页（tab10、tab12）进入 ArtifactFrame 全屏后，以 Shift+Tab 聚焦 Download、Enter 打开菜单时发生 CUA 超时；随后对同标签页的操作报告 CDP（Chrome DevTools Protocol，Chrome 开发者工具协议）focus-emulation 超时。同浏览器新建普通标签页仍可操作。这里的超时说明该操作通道未完成，不能单凭最后一个错误名证明页面主线程、浏览器进程或焦点陷阱已经死循环。

为区分本次改动与既有问题，主 agent 用原377完整 UI 资源及同一真实持久化产物，另开 fresh tab13。进入全屏后，Shift+Tab 聚焦 Download 的状态已有实际截图；随后单独发送 Return，约30秒后同样 timeout，并发生工具 kernel reset。原377前态没有384的 controlled open、aria-disabled/busy修改，因此该对照排除了“全屏菜单异常由384首次引入”的归因。它不证明前后版本的内部失效机制完全相同，也不恢复本轮全屏菜单的交付资格。

以上真实交互与截图由主 agent 操作和查看；audit_ui 只读源码、构建文本和历史，不操作这些标签页。主 agent 已确认相关服务 scope 全部正常 shutdown、原启动句柄 join exit0。后端进程/请求/输出正常收拢与浏览器标签页关闭是不同事实：这些 stale tabs 的 closed 状态尚未确认，不能因 kernel reset、服务退出或新页可操作而宣称旧页已关闭。本段不猜测未提供的回执文件名、进程身份或截图路径，归档引用由持有原始证据的主 agent 绑定。

### 只读链路核查与已排除的解释

1. `ArtifactActions` 的 `DropdownMenu.Portal mount={document.fullscreenElement ?? undefined}` 在前后源码中保持一致。已读本地 `dist-vite/assets/main-CAo85tzZ.js` 的编译文本，其属性是 `get mount(){return document.fullscreenElement??void 0}`，不是组件创建时固定的 body 值。这只证明该构建的编译语义，不冒充被调查页面的 HTTP 资源身份。
2. 安装版 Kobalte `dist/chunk/46NU5BYI.js` 的 `MenuPortal`（710起）以 `contentPresent()` 包住 Solid Portal。Solid `web/dist/web.js` 的 `Portal`（712起）在首次 effect 中才求 `props.mount || document.body`，然后把自己的 container 追加到所选宿主。因此“先进入全屏、再打开菜单”的代码路径会在打开时读取当前 fullscreenElement，未发现固定挂错 body 的源码依据。菜单已打开之后退出全屏属于另一条时序，本轮没有用它解释当前触发。
3. `MenuContentBase`（46NU5BYI.js:411起）默认 root modal 时启用 `createFocusScope`、外部焦点阻止及 DismissableLayer。`ISKHZMHS.js:121起` 注册文档级 focusin/focusout 限制；157起插入两端 sentinel；180起以 MutationObserver 保持 sentinel 边界。`455ZADO2.js` 的 `ariaHideOutside` 对外部可访问性节点及 DOM 变化另有 observer；`ZKYDDHM6.js` 统一管理外部指针阻止。已确认这些机制存在，但没有调用栈、实际事件序列或主线程证据定位本轮超时落在哪一层。
4. `LMWVDFW6.js` 的 Popper 以 Floating UI 计算 absolute 定位，autoUpdate 观察尺寸，并在可用宽高/定位变化后写样式。Solid Portal 追加的 container 是全屏 Frame 的直接子节点；当前 `.msg-artifact:fullscreen` 只有 `auto minmax(0,1fr)` 两条显式 grid 行，所以 portal 是必须核对的额外布局参与者。未观察到实际计算几何或 ResizeObserver 重复链，不能把它直接当根因。
5. 当前 controlled open 仍有既有的 `Object.is`/untrack 收敛合同；未发现自身重复 onOpenChange 的源码循环。它确实改变文件项准备顺序：旧非受控 Kobalte 先写内部 open，再调用 prepareDownloads/setFiles；当前先 setFiles，再提交 disclosure open。前态复现已排除“只有该新顺序才能触发异常”，但不证明两个顺序下的每个微观事件一致。
6. 同义生产路径已经检索：MCP App 资源菜单按响应式 displayMode 选择 shell 宿主；ImagePreview ContextMenu 挂稳定 bodyRef；普通 DropdownMenu 默认挂 body。ArtifactFrame、MCP App 的 fullscreen 生命周期、Conversation 的焦点行保留与测量回调、CodeEditor 的重测量也已读取。上述差异是后续调查线索，不是新增通用 Portal、替代菜单或关闭 modal 的依据。

历史 [inactive workspace paint isolation](2026-10-05-inactive-workspace-paint-isolation.md) 已区分普通子树、portal、浏览器 top layer 与原生窗口，未验收本轮全屏菜单触发。既有 [download observation review](../../artifacts/2026-10-05-connection-workspace-authority/artifact-editing-environment-implementation/final-download-observation-review.md) 中，下载事件观察超时后来由实际文件证明存在下载；那是不同现象，不能拿它解释本轮整个标签页操作通道失联。历史中可见的全屏、菜单或键盘成功也不等于本轮相同版本、同一触发、同一观测通道已经通过。

### 当前交付边界

384修复仍限定为已实证的异步复制忙碌焦点；本轮全屏 Download 打开、菜单选项键盘选择、全屏下载后焦点返回均未完成。不能以嵌入下载、全屏 Copy、类型/构建通过替代它们，也不能把旧页关闭状态写成成功。没有为了规避该异常改变 modal、Portal 宿主、菜单实现、打开时机或浏览器安全策略。独立后续调查见 [386 Recall 与方案](2026-10-13-artifact-fullscreen-menu-386.md)；全屏菜单根因、普通鼠标对照、工具与浏览器边界及 stale tab 最终关闭仍待取得证据。

## 中文类型徽标的追加分析与实施准入

真实中文页的复制/下载/已复制/打开及模型配置提示均本地化，但产物头仍显示File和Document（after-chinese-copy-focused-visible截图）。全仓搜索22处ArtifactFrame调用：20种payload renderer把固定英文kind同时用于类型徽标与data-artifact-renderer样式身份；两处ConversationArtifactInspector无payload框已用t提供binary/snapshot名称。直接翻译kind将改变全屏CSS选择器，是不可接受的影响面。

已读ArtifactFrame、22处调用、InteractiveArtifactPayload的SDK类型、i18n唯一目录与t实现、messages.css的所有data-artifact-renderer规则和历史386c280ca。根因是技术身份kind被复用于可见产品类型；历史创建统一Frame时未分离显示名称。保持kind和所有renderer/payload/标题/文件事实，用已有payload.renderer为本地化键，在单一Frame显示t(`artifact.kind.${renderer}`)，无payload检查框继续显示其已翻译kind。这不是按模型正文/标题猜类型；20个当前schema renderer各在两个目录写明确名称，不建额外映射或后备路径。仅修改Frame可见span和两个locale目录，不改样式、状态、复制、下载或模型协议；无调度/迁移影响，不引入测试。重建后真实中文页核对文件/文档徽标与复制焦点，英文保持原类型名；非当前两种renderer只主张共享显示合同，不冒称20种都已实页逐项验收。

## 最终实现、真实复核与检查

最终生产修改为ArtifactActions的忙碌焦点/单一菜单disclosure，以及ArtifactFrame按payload.renderer显示类型名称和现有两个语言目录20个名称。没有改Fullscreen Portal/modal/时序来掩盖386；没有修改底层复制器、下载器、权限、模型或调度。最后build为私有ui-final-build，typecheck-final、build-final、i18n-final均exit0；build2m53s有既有chunk大小警告，语言目录2178键。纯UI改动未新增/运行UI自动化，后台模型发布和完整下载checker分别证明其真实数据合同。

主agent用同一真实Chat的无凭据复核页确认：文件Copy在Enter后保持焦点，Space可再次复制，Tab可转到Download；原附件实际下载14687字节逐字节等于输入，菜单关闭焦点返回Download；全屏同renderer的Copy有截图。中文实页检查发现类型徽标后按追加分析修复并重新build，最终文件/文档、复制/下载/已复制和可访问名称均跟随中文，切回英文显示File/Document，原标题和正文保持。最终截图final-chinese-file-copy、final-chinese-document、final-english-types均已人工查看。

未满足项明确保留：386全屏菜单打开/下载/关闭焦点未通过且根因未知；慢动作重复触发与无结果MCP禁用没有独立实页样本；其余18个renderer未逐个渲染；Copied不等于操作系统剪贴板读回。没有把这些边界包装成整体完成。

原模型成功轮次launcher13797已join0，7个目标模型流全部HTTP200/EOF，两个真实产物/工具结果/消息归属checker通过。首次overloaded预检launcher98585已join1，其物理owner/output/request及配对副本清理完成。四个独立无凭据复核launcher49166、89413、45087、68201均join0；tab14/16已关闭，tab10/12/13全屏异常导致关闭未确认，tab15启动过早连接错误且其data页面受浏览器策略阻挡、未绕过。review-server固定terminal原因文字不作为页面关闭事实，以manual-review和stop-requested为准。

复核服务正常模型发现会重新写公开models.json；原已复制auth/models成对删除有真实回执且auth不存在。后续复核launcher据该回执和auth缺席检查无凭据状态，避免将公开目录误报残留凭据。规范checker首次使用Python不存在的utf8-sig别名，修正为utf-8-sig后原checker重跑exit0；这是本地验收工具修复，不修改产品。

证据已归档[384目录](../../artifacts/2026-10-13-artifact-action-focus-384/README.md)，76项总1430202字节，已知凭据内存去除/扫描通过，无auth/models/数据库/运行目录或二进制。架构、未发布双语说明、根/月/证据索引与386后续方案一并整理，随后执行docs:check、范围提交、拉取合并上游与正常push；实际提交/同步结果以Git回执为准。
