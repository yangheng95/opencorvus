# Main 文件来源往返阅读

## Recall

526继续单agent，不委托；后续人工单agent要求覆盖长期Goal旧三Astra文字。上一轮525为progress：349c4ef257f755a5ff26632dbc981ec73692b123修复Markdown代码复制重复实体解码，8实图/8次真实Sol流与两隔离scope完整结算，正常push/fresh HEAD=origin/main、0/0。开局仅原.bun/和packages/opencorvus/bun/未跟踪，保留。用户要求持续自主体验修复，优先Sources与成员Rendering，真实内置浏览器后提交推送；不操作用户18571/真实库/窗口，不新建开发或产品成员，不运行UI自动化。

已读525、517键盘Sources、481 Main文件来源、507虚拟窗口归因、523Goal字段、347连续目录密度与367单行精确列记录；当前AGENTS、07-panel/continuous-goal、SourceParts/CardParts/ConversationCard/SubagentConversationPanel/SideChatPanel、text-part-model/markdown-render、file-workbench及chat/identity。沿已应用computer-use/benchmark-debug-template。未委托，无反馈。

## 修改前分析

当前已证实Main/Side/成员共享SourceParts；首条直显、其余Disclosure/按真实source身份Key、同路径目录压缩和独立复制/摘录。Source文件操作交唯一file-workbench，普通引用相对项目打开，项目外绝对引用走只读source资源，编辑器拥有离开确认。文件startColumn合同仅允许单行；只读原数据没有多行+column案例，故不把UI只显示起列误判为范围缺陷。readableSourceUrlText保留URL结构；没有证据改写现有编码/Source身份。

只读完整523-after数据：90表/schema3，原171个assistant等会话；合法Main ses_-zURzTlJFzzacrP6FufN具有conversation.work/right-sidebar元数据及7个真实file Source，原412 project目录。上轮曾被拒绝的delegation成员没有这种身份，不能把它换sessionKind硬塞Main。原SideChat不是session.kind分类，生产读取metadata.sideChat；未凭误猜kind的0行宣称Side数据缺失。

本轮待查是Main实际来源与文件工作台往返的阅读/焦点/精确位置，以及同一合法会话的重新进入；已有481/517不证明当前525构建的这组组合，也不能用该组合证明活跃流/全部Rendering通过。尚无新可修复根因，先真实页面调查，再补现象、触发点、控制流、旧路径遗漏、定义调用/公共契约/数据/测试文档交付风险后才改生产。未观察调度/队列/恢复/并发/终态异常；若发现立即横审全部生产Host/Task/Mission/Session执行轮次、正常/终态、重试/重启、串并行及多项目。

## 启动前方案

1. before19013、条件after19015，实际/最大模型0，不复制auth/models、不预检Provider，不发消息或创建Task/Mission/Goal/Session。沿523成熟Source CLI开发/ui、413 owned-host/446 native supervisor、原20分钟资源边界与180秒启动无活动观察；观察超时只检查原句柄，不另启替代scope。当前525正式main-BTerbwsZ UI作为before。
2. 从已完整关闭的523-after只读serialize全部90表156566行/schema3/integrity及完整canonical五键到新runtime；原字段/身份/时间/source bytesmtime保持。私有准备器只换namespace/端口/已闭合source，保留完整原数据，不伪造Source/消息或修复历史。before/after数据校验逐原行/字段/时间/实际schema与canonical。
3. 内置浏览器2自有新页，以已合法持久身份打开Main；实际Sources展开、第一/另一文件列来源、键盘打开、原文件区定位及返回聊天，查看附近正文、Sources与焦点/阅读段。按实际AX定位，截图保存并人工查看，不写DOM/组件/源码文案/截图断言或fixture。若需要剪贴板测量先用自有composer原生建立已知基准，不把工具首次交接或再次同值当修复。
4. 确证问题后先补完整分析，再关闭before原链，修改唯一当前实现并正式Node构建after，以相同真实Source/操作复验；UI只真实人工截图，非UI能力补聚焦正向合同。禁止新fallback、双源、隐藏消息、虚假Source、模型路由或任意延时。
5. 原公开shutdown200/原exec join/native physical/output/request/launcher/精确出生链完整结算，关闭自有页；逐原数据事实核验、模型实际0/最大0及无凭据副本。三索引/docs/architecture/实际秘密值扫描、范围提交，fresh fetch/merge/完整pending审查、正常push/fresh一致。条件after未触发则如实说明。长期Goal active。

## before真实缺陷与实施前根因

before19013/原93310/IAB122，正式main-BTerbwsZ。合法Main直接恢复，无猜测成员身份或请求模型。两条原search_code Source展开后分别L2:11/L3:15，长文件名省略但目录/范围可辨。原生Enter打开第二条，实图03与可见DOM选择事实证明原第3行offset14；再从第一条进入，同一文件第2行offset10（04）。该只读观测不是DOM断言或自动化测试，未读取编辑器隐藏状态。

从编辑器实际Close workspace按钮Enter关闭后，原fileWorkbenchOpen=false→main removeCenterWorkbenchTabs，最后File标签退场但Dock仍open=true并显示空工具选择。05实图及实际document.activeElement=BODY，键盘焦点丢失；后续Tab未在本次观测中进入可见产品控件，不推断浏览器chrome具体落点。打开原Files工具再打开同一Source，关闭File时实际剩余Files被选中，但焦点仍BODY（06）。对照原标签栏Close tab关闭Files，原RightDock.closeTab恢复到Add tool且有可见焦点环（07）。这不是仅从源码猜测；两个直接入口失败与已有标签入口成功同页成立。

直接触发/根因：FileEditorPane.closeCurrentFile直接await closeFileEditor，成功后自身按钮/编辑器所有者被卸载；它未经过RightDock.closeTab的origin捕获和reflow后焦点恢复。main的fileWorkbenchOpen监听仅移除标签和选择相邻项，整栏关闭effect仅在rightDockOpen=false时转交header；本次栏保持打开，故两者都不能保留焦点。全仓closeFileEditor调用包括服务定义、main workspace.close-file两入口、FileEditorPane直接按钮，以及workspace.admitWorkspaceSelection的带commit边界导航关闭。后者是切换目标的准入而不是原工作台内关闭，不应被新增全局服务焦点恢复抢占目的地；本方案仅共享呈现关闭的焦点选择，不修改服务或导航。当前RightDock.closeTab是唯一已有标签关闭焦点实现。旧233/517覆盖整栏关闭，未覆盖内容内直接关闭；其他Markdown/Source身份和Rendering修复不涉及该分流。

影响是所有打开于该文件工作台的普通/Source/只读文件，不仅当前Main或某个成员；源引用、File标签X/Delete、Close workspace及取消/保留其他工具的交互必须保持共同焦点合同。没有业务调度/恢复/队列异常：只有真实同步UI资源退场，没有Task/Mission/Session occurrence变化；不改后端、持久schema、权限、协议或消息。

具体唯一方案：将现有RightDock reflow后的焦点目标选择/不抢占已移走焦点的规则提取为共享UI辅助函数，调用点仍由各自真实成功关闭拥有。标签入口沿原reflow再调用；FileEditorPane在明确closed=true后沿下一动画帧调用同一函数，捕获真实origin与原Dock容器，已隐藏/断开/另一焦点所有者时退休。空栏回原Add tool，仍有标签回真实选中可见标签，不创建第二标签状态、全局焦点跟踪器、后台修复循环或任意时间延迟。取消/失败保持原输入焦点和草稿，文件内容不编辑、不保存。只有两个已证明重复的焦点选择实现被收敛到同一原语。

先正常关闭before原链再实施；after19015正式Node构建同数据复验两列/最后标签关闭/有相邻Files关闭/标签Delete、整栏关闭与返回，截图人工确认焦点环、实际activeElement和Source阅读段；UI不加自动化。若发现其他工具空页打开焦点语义，单独记录，不据本次窄关闭改动冒称全工具进入行为已修复。

实施后追加的有限验收：为直接证明closed=false的取消分支，允许仅在这份自有412测试材料的编辑器草稿末尾键入QA526_DRAFT_ONLY，不提交消息、不保存磁盘。先只读保存真实原文件全部bytes/mtime；第一次关闭选Cancel，复核草稿/编辑器焦点；第二次关闭选Discard只退休本次自有草稿，复核剩余标签焦点。结束以真实文件bytes/mtime核对原件保持。此前“文件内容不编辑、不保存”约束的磁盘边界保留，本补充明确允许此内存草稿交互；不对用户文件、其他草稿或服务权限作任何更改。

## 实施与真实复验

新增单一UI原语utils/right-dock-focus，把RightDock原有成功关闭后选择目标/尊重已移走焦点的实现收拢；原标签关闭仍先reflow再调用，FileEditorPane只有closed=true才在正常下一布局帧调用相同原语。捕获原origin与Dock，当前authority、容器连接/可见/非inert和当前真实焦点共同保护；空集合回Add tool，仍有标签回当前aria-selected的可见enabled Tab。删除原仅为本地选择服务的addBtnEl引用，不保留另一套选择实现。文件准入、主工作区导航、草稿确认和Source原字段保持。

W3C [Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)已实际读取，关闭后将焦点留给存续标签、最后标签后进入合理工作流的原则与原产品合同一致。本轮不改变产品原先的前邻优先选择策略、手动激活语义或Kobalte集合；选择目标读取真实DOM呈现，不维护第二标签集合。

原14819 Overlay typecheck exit0；正式Node构建原65456 exit0，7314模块/1m2s，main-7Ue7jCbp.js及原main-CVd9TkT1.css，既有use-client/共同静动态引用/大chunk提示保留。本次原构建stdout未另存完整文件，原工具exit/模块/时间回执与实际服务资源记录作为证据，不伪造完整构建日志。不新增或运行UI自动化，相关file-workbench-revision是纯资源状态合同，未冒充UI资格或为纯UI改动重复运行。

after19015/原3656/IAB123。08为相同Source实际第3行offset14；另一Source仍第2行offset10。09最后File的Close workspace后Add tool有可见焦点环，真实activeElement BUTTON/Add tool；下一原生Tab进入Close panel。10有Files邻项时关闭File后真实activeRole=tab/label=Files且有焦点环，正文仍在原来源段。源范围、文件正文及两个来源的独立身份保持，没有靠隐藏Rendering或伪造消息完成。

11自有草稿真实Unsaved changes确认，初焦点Cancel；12 Cancel后同一File保持QA526_DRAFT_ONLY、焦点还给Close workspace，未被共享恢复抢走；13再次关闭并仅Discard这份草稿后Files标签有焦点环。14在Files Tab用Delete关闭最后标签回Add tool，15整栏Close panel后焦点回Main header的Open right dock，Sources展开和原阅读段可见。所有15张图实际呈现并人工复核。Cancel后的即时AX仍短暂报告原Dialog，随后的实际截图与DOM焦点为已还原Close workspace；不以过早AX冒充最终状态。

## 边界、资源与数据

初次Playwright button精确定位Show 1 more source未匹配原生Disclosure；读取新完整AX后真实284展开，没有伪称首次动作成功。两轮Main合法身份均正确，未走525无conversation元数据的成员404路径。来源展开引起虚拟窗口变化不等于重复Rendering，当前没有新流/连续帧/Side/Native WebView2资格。零模型scope出现预期模型配置不可用提示，错误摘要按原日志描述，不宣称console clean。

另观察从空工具选择页点击Files时焦点落BODY；这是打开入口的退场语义，当前关闭修复未覆盖。已保存同页实际观测，后续沿共享RightDock显式打开入口调查，不扩大当前结论或用关闭通过声称打开已修复。

before93310/after3656原exec均join exit0，两次公开shutdown200、native physicalCompletion/outputDrainComplete/requestCleanupComplete、launcher及精确host/target dead_or_reused全部结算；IAB122/123关闭。两轮实际模型0/最大0/exhausted false，无auth/models副本，无新Session/消息/Task/Mission/Goal。成熟preserve checker逐90表156566原行全部字段/身份/时间核对差异0、表计数保持，schema3实际对象/integrity、源bytesmtime及完整canonical保持；Provider activity391→391。原129字节测试文件全部实际bytes与mtime保持，草稿只在界面内取消/丢弃，无Save。未访问用户18571或真实库，没有schema/版本演进。

最终检查、最小证据归档和三索引、真实秘密值扫描、范围commit/fresh merge/完整pending审查/正常push/fresh一致按实际回执交付。长期Goal active，既有全量配置10/5秒和公开原生增量原型未达合同保持。

交付复核：docs:check345操作/26组、architecture-index20当前文档及git diff --check均exit0。最小归档含15实图、7个实际持久Source完整字段、手动焦点/选择观测、原生结算与全部原数据正向检查；秘密扫描覆盖当前三个UI源码、契约、记录/三索引及全部归档/解压内容，实际凭据值0匹配，原凭据bytesmtime保持。

归档器初版按大写ERROR过滤实际小写日志而派生出0错误；读取当前真实level分布后修复原工具并重跑同一原命令，没有改写原runtime日志。before/after各11条error均保留：4条project.open/config.validate的ProviderModelNotFoundError、4条server/400、2条project-load和1条对应UI提示。是本轮明确零catalog/零凭据初始化的边界，不是凭据资格、数据库或新调度故障，不报告全error clean。归档重跑只更新自身脚本和当前派生元数据，已存在实图/原输入/结算压缩件逐实际bytes核对保持。
