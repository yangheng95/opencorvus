# 模态 Dialog 关闭后的焦点归还

## Recall

531单agent、无委托，后续人工单agent约束覆盖长期Goal旧Astra文字。530为progress：b161e40d0d96fc4b934327b8b7f6b1d32ab87908正常push/fresh HEAD=origin/main、0/0，24实图、12/16 Sol、438778ms原POST200及完整结算。当前Git该提交，仅原.bun/与packages/opencorvus/bun/未跟踪，保留。530实图24及原AX/DOM证实默认Goal模态Esc关闭后焦点BODY；本轮继续这一已发现问题，Sources/Rendering剩余要求不因本批默认focus修复而视作完成。

已读530 Recall/后半结果、Dialog/类型、已安装Kobalte Dialog focus scope源码、ContinuousGoalControl、CommandPalette、AppDialogHost、SessionDialogHost、GoalDialogHost、FileEditorPane与原Dock focus primitive，当前07-panel/reactivity。全src搜索Dialog imports、modal与open/close autofocus同语义路径：14类Dialog消费者；仅InteractionHost显式nonmodal，其余默认modal。CommandPalette/FileEditorPane有现有onCloseAutoFocus并preventDefault，CommandPalette/AppDialogHost/Mission/Task目录等有open hook；菜单/Popover的同名事件不混入Dialog。相关连续Goal测试为待分类非UI服务线索，不运行UI自动化；不新增DOM/组件/快照/源码文案或浏览器测试。

## 修改前深度与影响分析

可观察现象：实际Create goal打开并将焦点放Objective，Shift+Tab/Tab在默认modal内部循环，Esc后BODY，未提交或创建Goal。直接触发是关闭/DOM卸载；Kobalte Content的默认modal onCloseAutoFocus会preventDefault并focusWithoutScrolling(context.triggerRef())，当前通用Dialog没有配套Trigger，所以该目标为空。Goal无close autofocus hook；旧530修的是nonmodal focus离开被dismiss，529/526修的是Dock/成员/工作台的特定交接，不经过此默认模态归还链。

共享影响是所有使用默认关闭焦点的模态Dialog，不能只给Goal加另一路专用store。当前CommandPalette/FileEditor已有业务焦点所有者，必须先执行并尊重其preventDefault；open hook也必须保持。数据/控制流无LLM/调度/API/schema变化；仅UI焦点生命周期。原触发节点若断开、隐藏/inert/disabled，或关闭时别的控件已获得焦点，不得盲目迁移；来源菜单节点已消失时没有足够事实恢复其逻辑trigger，不加全局选择器/timeout/备用目标。不声称这种未观察菜单入口的逻辑focus已全修。

打开autoFocus之前activeElement是否就是opener、close hook发生时其可见性与当前焦点需实页诊断确认。拟在同一Dialog保存一次modal打开时真实HTMLElement：先捕获再调用原open hook；close先调用原hook，若其preventDefault或Dialog又打开则保持其所有权；只有当前BODY/原Dialog内且原节点connected/可见/非hidden/inert/disabled时focus原节点preventScroll。原节点不可用或焦点已交给其他控件则不迁移。不改nonmodal归还/外部pointer/Esc/focus-outside合同，不创建第二选择/业务事实来源，不新增全局监听、重试或延迟焦点调度。

未发现调度、队列、唤醒、恢复或终态异常；若真实运行发现，仍立即按AGENTS横审所有生产入口/Task/Mission/Session轮次、normal/terminal、重试重启、串并行和多项目，不能按UI标题定位。

## 实施前方案

1. namespace dialog-opener-focus-531，before19033/after19035。模型实际/最大0，不复制auth/models、无Provider预检/凭据资格。before只读serialize完整闭合530-after的90表/schema3/实际对象/integrity及全部原行、完整canonical；先验证原Sol scope native physical/output/request/launcher/源EOF及runtime/private成对退休证据。after源为完整闭合本轮before零模型副本。旧用户18571/真实库/窗口不操作；不创建Session/消息/Task/Mission/Goal，不编辑业务文件。
2. 沿528成熟零模型Source CLI开发/ui、413/446原生owned监督链与20分钟资源边界/180秒启动无活动观察，不另起Vite。before用当前b161的私有正式Node/Vite诊断构建，仅包裹原open/close autofocus记录真实prior/current tag/button label、原节点connected/几何、event prevented；原callback只调用一次，不变DOM/分支/焦点/消息。内置浏览器2自有页，日志先开启。
3. 实际合法parent conversation ses_-zUS0X33CzzWEKMgCk98打开Goal空表单，鼠标与真实键盘Enter分别打开，Esc及原Close按钮/允许的外部点击关闭，保存并人工查看截图及焦点事实。不提交Goal。命令面板从原搜索按钮与热键打开/Esc关闭作为专用close owner对照，不执行命令/路由或修改其数据。不以单入口通过声明所有Modal或菜单焦点合格。
4. before确认后补根因/影响再修改唯一Dialog：捕获modal真实opener、包装并尊重现有hooks、按可用性/当前焦点归属归还，清理旧一次引用；Dialog.types与当前reactivity同步。保持530 focus-outside及现有close owner，不为Goal新建专用实现。纯UI无自动化测试；聚焦Overlay typecheck与正式Node build。
5. after真实同组合复验Goal鼠标/键盘打开、Esc/Close/pointer归还原Create goal，Tab在同一默认modal内循环；命令面板自己的priorFocus处理继续生效，source不变，不创建Goal。FileEditor dirty callback本轮先代码审查，不制造未保存业务草稿，不声称其独立新实页资格。若进一步发现问题，以证据继续，不扩张成无关清理。
6. 原服务exec join/public shutdown200/native physical/output/request/launcher/精确出生链结算，自有页关闭；逐全部表原行/字段/身份/时间、schema/canonical/source bytesmtime保持，0/0实际模型及无凭据副本。运行原docs/architecture、diff及实际秘密值扫描，最小必要归档/三索引、范围commit、fresh fetch-merge/完整待推集合审查、正常push/fresh一致，Goal active，无分支/worktree/发布。

## before证据与实施前确证

原51834 Node诊断构建7314模块/1m3s，main-CL6mQ9jH；before19033/原service53032/IAB132。完整源实际90表158027行（166 project/229 Session），含530已完成的真实权限/模型数据，不能继续写成旧156566行。两个Goal相关测试已读imports，均为纯transport/event服务测试，未改服务所以不运行；没有发现本路径UI自动化。

10实图全部人工查看：01鼠标Create goal，03真实Enter打开；02 Esc、04原Close按钮、05/06允许的外部空白点击关闭后均BODY。DF531在打开前实际记录originTag BUTTON/originButton Create goal、connected true/rects1；关闭前后同一origin仍connected/rects1，activeTag BODY、prevented=false，无调用方hook。这排除了opener未捕获/已销毁/不可见的猜测，支持Kobalte无Trigger默认焦点被空目标吞掉的根因。

07/08现有CommandPalette从原搜索按钮打开并Esc后回搜索按钮；09/10从chatTextarea Ctrl+K打开，Esc后回同一编辑框。close-before-caller BODY，close-after-caller TEXTAREA/chatTextarea/prevented=true，明确是原专用hook正确拥有焦点，不应被新默认行为覆盖。未执行命令、创建Session/Goal或编辑/发送内容。未复制catalog/auth，因此原页面Model configuration unavailable/Choose model是明确的只读无模型上下文，不包装成Provider实测或凭据缺失。

before原53032 join exit0/public shutdown200/native physical/output/request/launcher/exact birth闭合，132关闭，最大/实际0。逐90表158027原行/全部字段/身份/时间差异0，Provider activity395→395、schema3实际对象/integrity/完整canonical/source bytesmtime保持。沿成熟零模型helper的自有launch-project-removed启动目录，目标验收来自真实既有合法parent URI，不声称启动目录或模型配置资格。

实施细化：在同一Dialog的modal open autofocus之前保存真实外部HTMLElement（排除BODY/自身内容），再执行原open hook；close先取出并清空一次引用、执行原close hook；被preventDefault、重新open、nonmodal、原节点无效/隐藏/inert/disabled/无几何、或当前焦点已在其他控件则尊重现状。只有BODY/原Dialog内时把焦点还给原可用节点并preventDefault。无timer/rAF重试/全局选择器/备用目标；原CommandPalette/FileEditor业务hook继续最优先。类型注释和当前架构同步，after正式构建同组合复验。

## 实施、真实复验与边界

唯一实现位于通用Dialog：本地拆分两个autofocus hook，modal打开前记录一次真实外部HTMLElement，调用方open hook继续执行；关闭先清空旧引用并执行调用方close hook，其preventDefault保留最高所有权。仅在原节点仍connected/可见/非hidden、inert或disabled，且当前焦点仍为BODY/原Dialog内容时，preventDefault后以preventScroll归还原节点。没有Goal专用焦点store、全局selector、重试或计时。530的focus-outside修复和所有专用open/close hook保持原契约。

Overlay typecheck原7831 exit0；正式Node构建原38206 exit0，7314模块/55.46s，实页服务器200交付main-DwFFu1Lg.js。before为原51834的被动诊断main-CL6mQ9jH.js；build-diagnostic.mjs只适用父b161e40d0的旧props分拆，不用于after，不宣称源码修改后还原构建。诊断累计归档24条DF531记录，包括CommandPalette自己的preventDefault生命周期观测；它们不是24次用户关闭，也不把关闭过程仍INPUT的中间记录当成最终焦点。最终状态以实际交互后的截图和manual-observations为准。

11—20共10张after图已逐张呈现并人工查看，与01—10共20张实图形成对照。Goal鼠标打开后Esc回Create goal；不重新定位/强制focus，直接从该真实焦点按原生Enter再次打开，再点原Close回同一Create goal；外部空白点击也回同一按钮。三条关闭最终DOM观察均BUTTON/Create goal，图12/14/16可见焦点轮廓。CommandPalette从搜索按钮打开/Esc返回原搜索按钮；编辑框Ctrl+K打开/Esc返回chatTextarea。未执行命令、发送消息或提交/运行Goal。

本轮未单独新增Tab循环资格（530已验证Goal modal内循环），未实页操作FileEditor脏文件专用owner；后者只做代码复核。原opener断开/不可见/禁用、新目标主动获得焦点、菜单trigger已销毁及创建Goal后导航等分支仅检查守卫，未制造DOM/业务fixture，不声称这些场景均有新实测。没有UI自动化、文案断言、DOM断言测试、截图基线或模型验收。

## 数据、资源与交付核对

before19033/原53032、after19035/原66127均原exec join exit0，public shutdown200；原生physicalCompletion/outputDrainComplete/requestCleanupComplete为true，launcher子exit0，带精确出生身份的监督链均dead_or_reused。IAB132/133均关闭。最大/实际模型0/0，没有auth/catalog副本或Provider预检；未动用户18571页面/进程/数据库。

两份副本逐90表158027条源原行的rowid/主键/所有字段/身份/时间保持，originalRowDifferences为空，Provider activity395→395；源文件bytes/mtime、schema3实际应用对象、integrity ok、完整canonical均保持。归档只保留计数/差异描述，不含完整数据库、全行快照或凭据。before源530-after已完成成对退休和原POST/服务物理闭合，after源本轮before也完整闭合，不从正在使用的用户数据库复制。

两个服务均有11条error级记录，均来自明确未投影模型的零模型上下文（ProviderModelNotFoundError及对应project.open/config/UI传播）；浏览器error收集为空。无凭据运行并不构成Provider可用性资格，也不宣称console clean。实际字段经过检查，未把ModelNotFound误报为auth配置缺失或调度终态异常。

最小归档含20实图、真实manual/被动诊断、Node构建日志、完整逐表保存结果、原物理/公开shutdown与资源摘要、可审查helper；gzip采用实际归档字节解压一致校验，不使用可变源码摘要作为验收。三索引/架构同步，运行当前docs及architecture检查、实际凭据值扫描和diff检查后创建范围提交，按当前分支fresh fetch/merge/完整待推集合审查/正常push/fresh一致核对收敛。Sources/Rendering主问题仍需新的真实运行定位，本批不以弹窗焦点修复替代其验收。

最终聚焦检查：docs:check 345 ops/26 groups、architecture-index 20 current documents、diff检查通过；实际秘密值扫描覆盖本批源文件、文档、全部归档及8份gzip解码内容，匹配0（精确文件数见credential-scan.json）。Overlay类型与正式构建原句柄均已join exit0；正常push仍执行仓库原hook，不绕过其schema/OpenAPI/文档/拓扑/秘密检查。
