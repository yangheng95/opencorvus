# 282 来源提示的焦点与真实可见性

## Recall

用户要求持续单 agent 迭代 UI（User Interface，用户界面）/功能，重点 Sources 和原子侧栏 Rendering；最新明确禁用多 agent，覆盖旧 goal 的并行措辞。上一轮是实际进展：ea3971aa3 / 32e6412e3 已推送，分别修复章节导航事实和章节位置次行。开始时 git 干净；281真实长来源两行、章节点击与焦点边框通过，但04/05没有Tooltip（提示）截图，不能把完整ARIA（Accessible Rich Internet Applications，可访问富互联网应用）名称当提示可见。

已重读AGENTS、281 Recall/结果、SourceParts/唯一Tooltip primitive（基础组件）、当前07-panel、消息与提示CSS、CardParts共用路径；overlay/test没有检索到对应UI测试。沿用已应用的benchmark-debug-template（基准调试模板）技能，用户禁止UI自动化优先于该技能的自动评分建议；仅真实操作/截图人工复核。Native固定服务收尾上限与真实无活动失败是两个不同边界，不能因观察超时重启或扩期。

当前源码使用Kobalte0.13.11，SourceTooltip内容保留完整URL，Root未绑定受控open/disabled。Kobalte Trigger onFocus在未disabled/defaultPrevented/pointerDown时立即open；onClick明确关闭；onBlur关闭，onPointerLeave清除hover/focus状态。当前[官方Tooltip文档](https://kobalte.dev/docs/core/components/tooltip/)同样规定聚焦/悬停打开、激活/Escape关闭（网站显示0.13.14，与安装版本不同，实际实现以本地0.13.11为准）。因此281点击后未显示符合激活关闭语义；其直接键盘焦点截图仍未知，不能归咎Sources长度、模型或Renderer重挂载。

## 调查与影响边界

先证明实际DOM（Document Object Model，文档对象模型）焦点和可见提示，而非先修产品。保持同一当前构建main-ChaeRRWd.js，在全新独立服务中用真实Provider生成三个原始来源；在任何外页导航前，键盘从工具进入短/长来源并截图。记录document.hasFocus/visibilityState、activeElement可访问名称/aria-describedby、实际role=tooltip文本/几何与Source身份，仅作原始观察，不写UI断言或测试脚本。分别记录浏览器截图和AX（Accessibility Tree，可访问性树）观察前后焦点，核对281两个截图表面/视口差异是否影响事件；不修改页面状态或注入事件监听器。

用原生Tab/Shift+Tab、Escape离开和重新进入验证库既有路径；明确区分点击关闭与focus打开。必要时与同页共用Tooltip的控制项对比，范围涵盖共享Tooltip/SourceChip的调用与样式，不建立Source私有open状态、备用浮层或更换库。若确认问题，再完成根因/全部调用契约/旧路径原因/风险分析并更新本方案后修改；根因未明时不改代码。当前不涉及后端数据、接口、调度、队列、恢复、并发或终态改动；发现对应异常则按AGENTS横向审计。

## 实际验收与交付

R `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/source-tooltip-282-live-01`，E `source-tooltip-282/live-01`，正常dev/ui18226。NativeService固定600000ms/12累计请求，目标提前4分钟闭合。用户已授权现有OpenAI auth及完整models配对；分别验证凭据usable、模型projected、实际gpt-6.1-sol/streaming=true后，UI提交281同一真实请求，不创建Task/成员或委托。原始请求和真实来源来自当前工具，无合成消息或fixture。

验收：短与长地址Tooltip均有Root查看的真实截图，完整长地址可读；Escape关闭、重新聚焦可重新显示；来源身份/导航数据仍为实际记录。不宣称未采样Side/child、全部帧Rendering或原Research Studio旧schema通过。缺失项明确保留。

关闭自己的页面后唯一shutdown，原前台actual join；独立出生/物理输出请求/端口/pair退休，所有checker/observer实际结束后才归档自己的五个Native产物。更新根/目录/月索引及记录，执行docs/architecture与公开凭据扫描。任何改动范围提交，fetch/merge upstream/完整待推送审查/普通push。上一轮错误页1不操作、不绕过URL策略；不触碰用户页面或进程。goal保持active。

## 第一轮结果与第二轮诊断准入

01已真实完成：短/长focus提示、Escape关闭、原生重新聚焦均有截图；外页返回第一次focus明确复现activeElement为同一来源但data-closed，第二次Shift+Tab/Tab恢复提示。返回时视口1280×720变1093×1244；内容ID保持tooltip-cl-331，未证明重挂载。Root已关闭11/12，原22270 actual0、7EOF/0取消，独立物理/输出/请求/端口/pair退休完成，剩264941ms；所有观察者结束后五自产物已保管。只读DOM接口不支持document.hasFocus，改用实际activeElement/aria-describedby/可见提示观察，不绕过接口。

本地库还有祖先scroll立即hideTooltip，以及pointermove离开安全区hideTooltip；上游当前主分支仍保留这两路径。现有截图不能判断具体关闭调用，不能先改库。第二轮在SourceParts现有Tooltip.Root增加临时onOpenChange观察回调，使用已经导入的AppLog.debug记录open/sourceId/activeElement描述及Error调用栈；不控制open、不创建影子状态、不注入页面事件监听器、不改数据/Source身份。这是诊断改动，非根因修复，最终移除。仅在自有新服务加载，日志不采集凭据或任意输入。既有Root全仓调用已查，当前消费者未传onOpenChange，不覆盖其他回调。

诊断构建使用现有Node/Vite build:vite命令的--minify false和--sourcemap，使真实调用栈可关联当前库函数；生产构建配置文件不变。真实dev/ui18227，R/E名称仅live-01→live-02，同固定600000/12及配对/关闭契约。重现同一外页返回第一次聚焦，读实际关闭栈再决策；复测与移除诊断后恢复正常构建，不以诊断产物宣称生产交付。

## 已确认根因与修复方案

02真实重现并取得`live-02/tooltip-transitions.json`：同一长来源focus打开后，activeLabel仍为该来源，立即经过Kobalte TooltipRoot的handleScroll→hideTooltip→disclosureState.close关闭。源函数把任何祖先滚动都当作悬停离开；外页返回伴随视口/滚动调整，键盘焦点仍存在却丢掉提示。旧Source title/章节/元数据布局修复没有处理这条共享库关闭路径。01二次移入恢复说明内容完整；02调用栈排除了本次close为数据缺失、点击关闭、模态外点或模型输出。其他潜在pointermove关闭情况未据此宣称通过。

当前[WCAG 2.2的1.4.13解释](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)要求附加内容在焦点触发仍存在时持续，或由用户明确关闭。选择在当前唯一Kobalte依赖补丁中修正TooltipRoot祖先滚动分支：原生trigger仍匹配:focus-visible时保持现有提示，未获键盘焦点的悬停提示仍走原滚动关闭；Escape、blur、click、disabled及卸载继续由原库处理。没有新owner/计时器/重开补丁或Source私有状态。浏览器原生:focus-visible也是现有focus边框的事实来源，不另记键盘模式。

完整影响面：共用Tooltip40处引用，含Source URL/file/document、Agent Rail、工具和设置控件；补丁同步源码tooltip-root.tsx及JS/JSX两个实际分发入口，既有package/lock单一patchedDependencies保留，无升级/第二库/接口字段变更。底层数据、Provider、调度/队列/恢复/终态不变；CSS selector匹配发生在真实DOM回调中，SSR（Server-Side Rendering，服务端渲染）原分支仍先排除。潜在用户影响是键盘聚焦的提示在祖先滚动中持续，显式Esc/失焦/激活仍关闭。不能用Sources一例声称全部控件已视觉验收，至少复测一次共用的非来源Tooltip关闭交互。

使用成熟bun patch准备、精确修改三个分发/源码文件、commit补丁，保留原patch内容，审查manifest/lock变化。移除SourceParts临时诊断，正常typecheck/build后，独立live-03/dev/ui18228复现同一首次外页返回焦点，并检查Escape关闭/再次聚焦/移出焦点。纯UI库行为不新增UI自动化或后端镜像测试；实际Provider事实checker仍仅核对真实后端。所有服务各自完整收尾后才进入下一轮。

## 第三轮结果与定位容器修复

03 main-CenCFXxZ正常构建，首次外页返回Tab到长Source的Tooltip实际持续，Escape关闭正常；共用项目Tooltip的键盘打开/Escape也正常。鼠标从长提示覆盖区域点击第二Source时未导航、focus落BODY，键盘激活则正常。`live-03/05-pointer-hit.json`实际elementFromPoint命中`data-popper-positioner` DIV，pointer-events:auto，而Sources锚点位于其下；因此确认是非交互提示外层拦截，不能把键盘导航成功冒充鼠标通过。

全仓同语义搜索发现work-ledger.css已经为两种项目/任务提示的positioner设置pointer-events:none，公共tooltip.css只设置Content。旧局部处理未覆盖Sources；此前滚动关闭让遮挡更难观察。本次将这条成熟现有CSS规则提升至公共tooltip primitive：`[data-popper-positioner]:has(> .oc-tooltip)`统一穿透，删掉被完全覆盖的两类局部规则，保持唯一事实来源。只命中共享非交互Tooltip，菜单/Popover/Dialog的positioner不匹配；不更改定位或关闭owner。当前项目已有:has选择器及同一positioner规则，不新增平台要求。实际影响涵盖同一40处Tooltip，原Content穿透契约扩展到其包裹层。

03原29068 actual0、7EOF/0取消，完整闭合后剩130847ms，提前四分钟目标未达到，差109153ms，保留不足。所有观察者实际结束后五自产物保管完成，再启动04。04正常build/dev/ui18229、live-04，同600000/12。用真实命中观察加实际鼠标一次点击验证穿透，继续外页返回首次focus、Escape/blur和普通共享提示；原日志/Source事实保留。不会只用CSS检查作为交付。

依赖工具链实况：bun patch --commit在Windows报EPERM并移除了原patch文件，已用实施前精确备份恢复；参照仓库215已记录流程，从三个实际包文件的Git差异追加到同一patch。首次包含额外空行被Bun hunk parser拒绝，修正统一补丁边界后normal install和frozen install均actual0，manifest/lock语义未改变，原旧patch各hunk保留。原失败日志与实际后续安装记录保留，不跳过hook或完整性验证。

## 最终状态

04 main-Cri4lTiA.js已Root实际呈现：提示覆盖区域的命中落在原Source链接，单次普通鼠标点击导航正确；外页返回首次Tab到长Source即完整显示，Escape与失焦关闭、再次聚焦及非Source项目提示通过。原44922 actual0，7EOF/0取消，独立闭合剩413257ms；全部自有页面清空、所有checker结束后五自产物已保管。完整逐轮结果见[source-tooltip-282/README.md](source-tooltip-282/README.md)。最终类型49309、正常构建43429/86761、normal/frozen install、docs/architecture/package topology均actual0；03自设提前目标不足保留，原侧栏全帧Rendering仍未由本轮替代。待本轮范围提交和正常push后持续单agent迭代。
