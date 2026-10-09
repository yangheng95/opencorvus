# 233 整个工具侧栏关闭焦点

## Recall

用户持续要求自主体验修复UI（User Interface，用户界面）/功能，重点Sources与Rendering；最新只允许单agent。232已推送d0c40a004，原三轮真实页面/Native与foreground0、focus关闭/取消修复完成，前轮是进展，本轮开始干净。232仍未覆盖整个Dock关闭、页面切换、焦点竞态或Tauri GUI（Graphical User Interface，图形用户界面）。用户IAB（In-App Browser，应用内浏览器）23/18107不操作，无branch/worktree/发布/新模型或子agent。

已读232 Recall/当前07-panel、RightDock关闭按钮/菜单、ChatHeaderRightDockToggle全部、store/right-dock唯一signal、main全部setRightDockVisible/toggle调用、App实际Header/Aside/Resizer及config页面inert。全仓定义/调用：store只改可见性；main唯一visibility effect设置data-open/inert/aria-hidden及resizer可用性；RightDock Close panel只调用parent；header toggle拥有真实再次打开入口。openMissionBoard已有明确missionBoardTitle focus，reset/导航/Settings亦有各自页面owner，不能关闭时无条件抢回Chat header。232只恢复实际tab删除与File Dialog取消，没有整个Dock关闭focus路径。

验收：原自然Sources File与Browser打开后，真实Close panel pointer/Enter关闭，操作者能通过可见控件继续重新打开，open tab/draft/阅读位置不重建；直接header toggle关闭保持该按钮focus；导航Mission Board或Settings保持目标页已有focus，不被错误回拉。英文/中文深色真实截图人工查看。UI不新增/运行自动化测试、DOM（Document Object Model，文档对象模型）/文案断言或假state/message；诊断只支撑真实图。未观测的race/Tauri/live child仍未知。

## 修改前分析边界

目前代码线索：main visibility effect将原dock设inert=true，而焦点可能仍在Close panel/内文/resizer；未见明确与header toggle接续。菜单Portals在dock外，关闭和focus owner可能不同，需实际证据，不根据contains猜全部路径。直接触发、focus实际去向、数据/控制根因仍未知，不准入生产改动。共享范围包括所有真实关闭入口和context导航，store保持唯一可见事实；不得另造DOM ID映射、关闭状态/selection/URL缓存、host旁路或通用global焦点策略。API/Provider/Task调度不改，如观察调度/并发/终态异常立即共性横审。

## 独立真实准入

继续原231完整runtime：Rsource=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/render-stream-231-live-01，Esource=B/render-stream-231/live-01，ses_-zUSSQjEPzzcHPHmHT48 / prj_hiXMQlf8gddMQG4rcDHg / 原Project目录。原host62996/target69788精确birth已closed，完整paired credentials已清理；新的完整只读Config/schema/两Project/global/runtime inventory/所有Task/Mission/Session请求/发布/交付/immutable ingress/current lease/capacity/permission/checkpoint/memory/14恢复前沿人工审查，不删或屏蔽前沿，然后全90表逐行copy，不替换原ID/路径，不移交auth/models。

fresh R=.../dock-dismiss-focus-233-before-01 / 18163 / B/dock-dismiss-focus-233/before-01，成熟history launcher正常开发serve `/ui`、current main-DNZgW3vs.js HTTP（Hypertext Transfer Protocol，超文本传输协议）200、固定900000ms。预备shutdown/archive/custody/精确自己birth5文件归档。Root own真实页面，原Source只读打开及Browser输入scoped URL，实际close/reopen/navigation/key动作截图。无需新Provider，不把原231五EOF当新增调用。

实证补完整影响/公共契约/数据/测试/文档/风险后才改，先关闭自己的全部页/sole shutdown/原foreground与Native actual0及physical/output/request/pair/独立birth/port/13表完整custody、Project属性逐项核对；所有observer终态才归档自己生成文件。若改则精确preimage、唯一当前owner实施、类型/build/必要i18n/docs、新after独立准入与真实截图。未覆盖明确保留，范围commit、fetch/merge upstream/全部待推送审查及正常push，持续goal单agentactive。

## 实施前实证与根因

before-01真实页面69实际Source File打开，Close panel Enter与pointer均关闭到BODY；header Open right dock仍可见。原header直接关闭自身保持focus，且重开保留File/Browser和scoped地址。visibility effect将仍持焦点的Dock设为inert而没有接续控件，这是直接控制流根因；232仅处理tab移除和File确认取消，未覆盖整个Dock。原始截图与诊断保留，不以DOM诊断替代实际画面。

同页三个实际Mission Board动作（语义Enter、语义pointer、截图定位原生pointer）均回到conversation/Dock true/File选中，Settings却正常打开。main的File effect读取fileWorkbenchOpen/revealRevision后调用openRightDockPanel，后者通过showRightDockForExplicitAction读取primaryWorkspaceSurface；这个隐式依赖把主页面切换当成新的File打开意图，再切回conversation。File service在新target及同target显式请求均增加revealRevision，close设置open=false，现有两个输入已完整表达打开/显示请求。没有Task/Mission执行队列异常证据；本轮原90表逐行复制一致、Task/dispatch前沿为空，结束13表完整事实一致，Settings实际成功，不能根据页面命名推断调度故障。

横向审查了全部setRightDockVisible/toggle入口、resetCenterWorkbenchToPrimaryPanel、openMissionBoard的batch及title焦点、两个work-ledger/conversation入口、config-dialog-control与native-surface-occlusion、全部explicit/present opener与File service commit/same-target reveal。当前异常来自这个tracked File观察者；真实Browser ready与Review presenter尊重当前primary surface，Source/Browser/add/side-chat/subagent显式动作仍有权打开conversation。保持这些公共行为，不改host/Provider/Task、完整历史数据、store或tab记录。相关file-workbench测试是服务契约，未运行UI自动化，也不新增；检索到connection/workspace服务测试不属UI渲染。

before-01页面69已关闭，sole shutdown、原foreground99197与Native均actual0；独立physical/birth/port/pair闭合，13表全行相等，两个Project inventory仅primary .git目录mtime变化，README原46bytes。所有observer结束后，精确自己birth的5个pile已归档。原manual-observations中未知根因保留为当时观察，这一分析补足代码证据，不改写为成功验收。

## 当前唯一实施方案

1. main唯一Dock可见effect在设置inert前检查activeElement是否属于Dock或resizer。仅conversation、Settings未打开且真实header toggle连接、可见、可用、非inert时同步focus该控件。直接header关闭及已在其他区域的focus不变；Mission Board保持其title，Settings保持其页面owner。只保留局部即时DOM引用，不新增focus store、ID映射或navigation状态。
2. File观察者使用现有Solid on([fileWorkbenchOpen, fileEditorRevealRevision], callback)，保持首次执行；callback读取不形成额外依赖，真实新/同target显示和close继续走当前opener/remove函数。官方[on文档](https://docs.solidjs.com/reference/reactive-utilities/on-util)与安装的solid-js/dist/solid.js实现一致：callback通过untrack执行。不得简单删除显式动作返回conversation的行为。
3. 更新当前07-panel契约，类型与build及当前文档检查；fresh after01/18164复制完整原231并人工复核原Source键盘关闭/原生Enter重开、Browser pointer关闭/地址保留、header关闭、Mission Board页面与title焦点/回原聊天/同Source再次显示、Settings和中文深色截图。严格UI人工交互，不加入自动化断言。

风险/排除：菜单Portal在Dock外、resizer竞态、连接/resource改变、Tauri GUI及活子agent流未获此轮实际覆盖，不承诺。若after发现问题保留失败事实，先闭合scope再继续改；不会延长同一固定deadline或修改原事实。

## 完成本轮状态

当前main/07-panel按上述唯一方案实施。after-01实际Source Enter、whole Dock Enter/pointer、原生Return重开、File/Browser保留、Mission Enter/title与Chats返回、同Source再次显示、header自身关闭、Settings/Search/返回、中文深色、File Delete后Browser接续及中文Mission pointer均人工查看实际截图。新asset main-DzTLjY3N.js实际HTTP200。initial missing dialogStore类型错误及helper源路径guard拒绝已本地修复，最终types52116/build78322实际0，docs:check/architecture-index实际0。

own69/70已closed，用户23保留；before99197/after46195原foreground和各Native实际0，独立exactbirth/port/pair、physical/output/request完成。完整13表事实一致，原两Project仅primary .git目录mtime变化，README46bytes未保存；全部observer终态后5个exactbirth文件归档。详情与已知限制见[实际证据](dock-dismiss-focus-233/README.md)。持续仅单agent，goal active；正在范围提交与正常推送。
