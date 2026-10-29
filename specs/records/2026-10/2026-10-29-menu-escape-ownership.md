# 菜单与说明提示层的 Escape 归属

## Recall

用户要求持续自主体验、修复、真实验证并提交推送，仅单agent；不重回已解决的Rendering。778是progress：e9b8a7600已正常push、fresh sync0/0，三实例全部103724原行精确保留，28图完成项目Pin/Unpin及空项目交接。但图26及native/locator键盘实证显示组织菜单checkbox聚焦时Escape仍保持菜单和解释Tooltip，点击原组织入口可关闭。不能再仅以工具操作解释，必须定位共享机制。保留176项并行工作，不操作用户18571窗口/服务、不开新分支/工作树、不发布。

已读778 Recall/最终证据、WorkLedger组织与排序Tooltip.Trigger as DropdownMenu.CheckboxItem、共享Tooltip/DropdownMenu wrapper、原Kobalte0.13.11唯一patch、实际安装库的TooltipContent/Trigger/Root、DismissableLayer/LayerStack/createEscapeKeyDown源码与实际dist、solid/hotkey、tooltip.css、07-panel-reactivity。全仓搜索onEscapeKeyDown发现UsagePanel有唯一自定义Tooltip Escape（preventDefault后hideTooltip），必须保留其原语义；检索95条Tooltip Root/Trigger/Explainer使用记录，涵盖导航、项目/行、Composer/任务、设置及菜单内条目。当前路径未发现UI自动化测试，不新增或运行。

## 修改前根因与影响分析

现象是组织checkbox焦点下Escape未能稳定关闭，已确认真实原菜单仍可通过trigger关闭，不能据此推断数据/业务失败。直接事件路径：库createEscapeKeyDown在document监听keydown、匹配EventKey.Escape；DismissableLayer仅对layerStack最上层ref调用onEscapeKeyDown，未取消时preventDefault并onDismiss。TooltipContent的onDismiss是hideTooltip(true)，默认focus-out明确preventDefault；菜单使用同一通用层。应用wrapper仅透传，WorkLedger未覆盖Escape。现唯一patch曾修指针层样式、Tooltip滚动关闭与dropdown关闭聚焦，未改Escape监听。

未知：真实事件key/传播与defaultPrevented，当前Tooltip data-expanded/data-closed、DOM ref/层级生命周期，是否关闭后再次打开，或ref与stack登记不一致。顶层/最后状态、Tooltip可见或过去Rendering症状都不是根因证据。源码目录个别旧指针补丁与dist不同，运行结论须以实际dist/真实回调为准。先只读实页节点状态；不足时在现组件增加被动诊断（实际事件和回调、ID/role/连接状态、defaultPrevented，不写DOM、不拦截、不加focus timer），最终普通build前精确移除。禁止猜测后直接关闭全部菜单、切nonmodal或绕过库生命周期。

影响横审为Tooltip与Dropdown/Checkbox/Radio/普通按钮的组合，嵌套说明、菜单正常打开/选择/关闭、Escape层级、点击外部、焦点归还、UsagePanel的自定义取消合同、无Tooltip普通项目/标题菜单。配置值仍由现persisted selection owner保存，错误/取消与现API authority保持；本批不改HTTP/SDK/schema9、Task/Mission/Session occurrence（执行轮次）、队列/唤醒/恢复/终态或LLM。当前无执行调度异常证据；UI层级问题不能据命名扩大或缩小为某工作流故障。慢请求/跨连接等未验证处保留未知。

## 实施与验收方案

从已退休778-after2逐行备份独立开发38330/ui，当前普通main-BCs5veQK.js，原103724行、完整历史模型catalog、无auth复制、0请求/累计767。先实际组织菜单→checkbox焦点→Escape，对比Tooltip/菜单节点及焦点、再次Escape/trigger关闭；截图全部呈现人工复核。必要时普通诊断build/38331，再沿证据选择唯一根因实现，先将决定补充到本记录再改生产逻辑。最终普通构建另一个独立scope，验证组织/排序五项、普通项目/标题菜单、常见非菜单Tooltip及可进入的Usage说明，自定义hook保持取消合同；双语控制与设置回到原状态。

禁止UI自动化、DOM/源码字符串断言、fixture或请求拦截。非UI服务契约不变则不新增镜像单测；只有真实页面/原图可证明视觉和键盘。首次启动固定60分钟截止不续期，每scope10分钟正常预定shutdown、至少5分钟收拢；原exec join、公有shutdown200、native/launcher0、physical/output/request与精确出生身份链退休后清退catalog。全部源库/旧行、原五文件及附件namespace校验，模型0。更新当前架构、Unreleased、三索引/产物，当前docs/类型/i18n/build/正常hooks，范围commit、fresh fetch/merge/审查完整待推集合/push/fresh sync。未满足要求明确列出，持续Goal保持active。

基线38330/214图01–03：新实例仅打开组织菜单、ArrowDown到By project，无布局变更或Pin。native与locator Escape后，原menu和tooltip均connected=true、data-expanded空属性存在、data-closed=null，active仍menuitemcheckbox；不是已关闭动画残留。baseline-observation.json保存只读结果。点击原trigger可关闭，214已关闭；公开200/原exec30828/native/launcher0/三项/出生链退休/catalog清退，模型0/累计767。诊断仅在共享Tooltip/Dropdown Content的现onEscapeKeyDown前记录并调用原hook一次，WorkLedger生命周期加window capture/bubble只读Esc日志，记录实际key/code/defaultPrevented和DOM层可见性，不触及内容或凭据。三源文件修改前已确认git diff为空并保存原字节。

## 已证实根因与实现决定

38331/main-CzfbfJMW.js实际23:29:35日志：window capture的key/code均Escape、prevented=false；当前Tooltip onEscape已prevented=true；window bubble=true，menu/tooltip仍expanded/visible。排除了按键名称错误、事件未到达、当前Tooltip未登记最上层，以及仅关闭动画的假设。23:32:37普通项目菜单对照：dropdown onEscape同样prevented=true，但库MenuContentBase强制context.close(true)后进入data-closed，解释为何普通菜单看似正常。图04/05与diagnostic-events.json保留原日志，不是mock。

真实根因是createSelectableCollection的Escape分支在检查disallowEmptySelection之前无条件preventDefault；菜单的listState为selectionMode:none/空集合，无选择可清仍抢占事件。Tooltip在顶层收到已取消事件，DismissableLayer依法不执行hideTooltip；下层菜单又因不是顶层不执行其强制关闭。旧MenuContentBase有明确注释，承认以强制close掩盖该选择缺陷，无法覆盖新增的嵌套说明层。不是模型、调度、业务保存或Rendering异常。

[Kobalte当前变更记录](https://kobalte.dev/docs/changelog/0-13-x/)列出0.13.13对选择Escape的修正；[当前选择实现](https://raw.githubusercontent.com/kobaltedev/kobalte/main/packages/core/src/selection/create-selectable-collection.ts)把取消放入允许清空的分支。但当前上游Menu仍未把无选择集合与可清选择区分，单移preventDefault不足以覆盖本仓库已证菜单场景。[Tooltip公开合同](https://kobalte.dev/docs/core/components/tooltip/)及[W3C提示层模式](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)均要求Escape可关闭说明并保留触发点焦点。保留现版本及唯一补丁，在该真实根因处同步source和两份dist：仅事件未取消、调用方允许清空、manager本身允许清空且选择非空时preventDefault/clearSelection，严格对应manager.clearSelection的实际写入条件。其它键盘/选择导航保持原实现。

MenuContentBase将原无条件强关补丁替换为明确的Escape所有权：先调用公开hook，已取消即返回；否则preventDefault并按原递归close(true)关闭菜单链和原menubar autofocus，避免同一次键再由onDismiss重复关闭，保留既有嵌套菜单语义且尊重调用方取消。不是应用timer或强关旁路。全生产搜索未发现自定义Menu onEscape，未知自定义取消矩阵仅代码复核。

UsagePanel的唯一Tooltip特例原先对已取消事件手动hideTooltip；通用修复后与默认DismissableLayer的preventDefault+hideTooltip完全重复。删除该局部hook及仅为它存在的useTooltipContext，保留Listbox真实disallowEmptySelection与选择状态、当前时区/数字/说明内容；通过真实设置Usage活动桶验证统一默认关闭。全部临时诊断在普通最终build前恢复原字节，避免留下第二个事件路径。根patch既有字节全部保留，仅追加官方Bun patch生成的六个新diff节，package/lock不改；若生成有重叠节先复核，禁止手改共享依赖缓存。模型0、原两scope均已正常退休，不续最初截止。

工具链实证：最初两个prepare分别在默认/显式hoisted设置下ENOENT，单改linker不足。隔离runner为每个label使用不同HOME，因此install与patch准备的包缓存不连续；显式固定到本批自有cache后install/prepare均退出0，真实准备目录为本批hoisted/copyfile包且nlink=1。第一次六文件生成漏掉JSX分发的access3别名，局部脚本终止后外层命令仍执行了mini commit（退出0），仅形成工具目录内的两文件中间补丁，未应用到仓库；补齐其它四文件并再次官方prepare/commit0后核对六节完整，过滤两个.bun-tag节，才追加至根补丁。原25083字节完全保留，root frozen-lockfile/ignore-scripts install0应用六节。WorkLedger/Tooltip/Dropdown wrapper诊断已精确移除，三个文件git diff为空；只有UsagePanel六行特例删除与canonical patch进入产品差异。失败回执保留，不包装为首次全部通过。

## 用量图表实际复核发现的第二处所有权问题

最终普通38332图19真实选中Oct28活动桶，焦点和aria-selected均指向同一item，提示显示18,234,654 Token。Escape后图20却回到聊天页、设置导航Tooltip显示；usage-observation.json所记录selected空不是选择成功保留，不能算通过。源码全仓搜索证实ConfigDialogHost的section onKeyDown在DOM冒泡阶段先preventDefault/stopPropagation并closeSettings，阻止document上的Kobalte当前层处理。它原本就依赖子控件更早取消，旧Usage特例恰好掩盖；删除特例暴露通用父页面抢占问题。不是自动shutdown（随后公开shutdown200、原51176正常join0）或后台刷新。

追加实施决定：使用已有useHotkey primitive，在window冒泡阶段、仅设置打开且事件target属于当前设置page时处理未取消的Escape。document提示/菜单/Select先处理并取消，设置仅收取未被子层消费的事件；保留页面范围、一次关闭与closeSettings原保存事务，不添加DOM层扫描、timer或另一实现。全局useHotkey本身不改。ConfigDialogHost修改前diff为空；调用点/真实关闭函数和当前架构已核对。只涉及键盘页面退出，不改后端、数据合同或调度。重新普通build，另开38333独立scope沿同一原始deadline复核Usage第一Escape保留图表焦点与选择、下一Escape退出设置，以及设置Select/双语菜单；四scope旧行与源库全量比较。未复核前不得称交付通过。

## 最终真实验收与边界

38333普通main-I1f_al31.js（无临时诊断）图21/22与usage-final-observation.json：真实Oct28活动桶18,234,654 Token，第一次Escape后settings=true，selected与active仍listbox-cl-492-item-cl-1238，说明已关闭；图23第二次退出设置，实际焦点Settings。图24主题Select Escape后Appearance仍打开、Theme System焦点归还；未修改主题。图25–27中文By project说明依次关闭与入口归还，图28/29恢复English与By project/Last updated，外部点击正常关闭。图24右侧控件超出内置截图截取宽度，键盘返回有原生AX事实但未宣称该图完整呈现控件；其它改动区域已实际呈现。29图均人工查看；19/20首次失败保留。没有UI自动化断言、浏览器fixture或单独Vite。

原exec30828/57624/51176/87596均join终态0；四scope公开shutdown200、native/launcher0、physicalCompletion/outputDrainComplete/requestCleanupComplete=true，精确出生身份链均dead_or_reused，catalog已清退，未复制auth。最后scope物理完成距原固定截止1322248ms，未续期。模型0/累计767。四实例各92表/schema9/integrity ok、103724原行精确不变，全部源库与pre-copy相同；原五输入字节/mtime、四namespace各13附件字节一致。根package/lock原字节未改，旧canonical patch25083字节完整保留，新增六节。普通构建/类型/国际化通过；最终文档与正常Git hooks由实际回执记录。

当前范围不涉及schema、API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）或调度合同变化，不新增非UI业务测试。未穷举95处Tooltip、原生桌面所有窗口、输入法组合键、跨连接迟到操作或自定义Menu取消hook完整矩阵；取消hook代码已复核且生产调用方无自定义覆盖。不把标题、最后错误或模型自述作为根因。完成本轮只计progress；持续Goal保持active，后续继续更广产品体验。
