# 应用菜单、搜索与快捷键衔接

## Recall

继续单agent（代理）自主深入体验全产品UI（User Interface，用户界面）、UX（User Experience，用户体验）及功能，修复真实问题、原页面/截图人工复核、范围提交并正常推送；旧Goal（目标）的Astra委托已被后续单agent要求覆盖。已解决的Rendering（渲染）闪烁不重开，不靠同一处小检查替代整体操作旅程。前轮是进展：55fc1840f8263787cdfa930e892e19893d72fb71补齐Chat/Work原会话JSON（数据交换格式）下载入口及无模型身份读取，三份真实文件逐项匹配原消息/工具，16项正向测试26断言、10原图、类型/构建/语言/文档及正常hooks（钩子）/push（推送）0。2026-10-27T08:18:40.098Z新fetch/merge（拉取/合并）后0/0，22项来源清洁、176项他人改动保持；703/704全部物理/输出/请求结清，目录副本退休，0认证/0模型，累计349，schema（结构）9与旧事实保持。

不操作用户18571、真实数据库、用户进程/窗口，不建交付分支/工作树、不委托/发同行消息、不发布/tag（标签）/PR（拉取请求）。本轮只用已关闭704真实历史，零认证/零模型，无提交消息、创建Task/Mission（任务/使命）或执行Goal的需求。仅自有隔离开发服务和标签。

## 已读资料与修改前分析

已读TitlebarMenubar全部搜索、FileShortcut（文件快捷键）匹配/菜单/原生事件调用、App搜索按钮和Settings主页面inert（不可交互）归属、CommandPalette唯一信号/Chrome事件/快捷键/焦点、useHotkey、native-menu服务与Rust AppKit菜单绑定；当前07-panel命令面板/响应归属合同、10-09菜单宿主和10-27全局搜索记录。全仓搜索旧搜索选择器、oc:open-command-palette、native-menu:search和Ctrl+G/Cmd+G定义/调用。

当前线索须分开：App仍挂载work-ledger-search-toggle并打开规范命令面板，所以不能仅因旧work-ledger-search输入框不存在就判整个菜单失效。Titlebar通过旧输入框查询或合成按钮点击转发；主菜单广告Ctrl+G、macOS为⌘G，Rust已有CmdOrCtrl+G，而当前renderer（界面进程）只有CommandPalette的Ctrl/Cmd+K，没有G键处理。Windows/Linux File快捷键由Titlebar拥有，macOS AppKit拥有原生绑定，不能增加双重处理。Ctrl/Cmd+K明确在共享Dialog（对话框）存在时交还键盘；Titlebar File处理未见相同归属检查。它们是否真实失效/穿透尚未知，先真实操作再定案。

只考虑产品菜单/输入事件与焦点，不改后端/公开API（应用接口）/SDK（开发工具包）/数据库格式/执行策略。若发现调度/恢复/队列/并发/终态异常，立即按共享机制横向全入口/轮次/串并行/多项目审计；当前未发现。更改任何公共声明前继续核对原菜单和快捷键契约，删除旧路径须有实际证据和影响说明。

## 实际验收方案

705/38210从完全关闭704整库只读备份并逐表核对、保护166原文件，复用main-CUI7eQ55.js，真实开发CLI（命令行界面）/ui，不另起Vite。实际原Chat中测试菜单声明Ctrl+G、既有Ctrl+K、Edit→Search；核对侧边栏收起/Settings时的入口。通过File→Settings及Ctrl+,查看一致性；用加号或/goal打开未提交Goal表单，核对G/K及New chat是否尊重当前Dialog焦点，Cancel/返回原对话，草稿只为操作员未提交输入，不生成模型消息或持久Goal。任何失效必须保留实际页面/焦点/原请求，不以源码猜测作结果。

基线关闭705后补根因、旧路径遗漏及所有定义/调用、公共合同/数据/测试/文档/交付/风险，落盘最终方案再改代码。若是纯UI事件/菜单修复，不新增或运行UI自动化；检索到当前修改范围内现存UI自动化须删除。新正式Node构建、类型/语言/文档检查后706重走真实菜单/快捷键、原查询选择、Dialog取消和中文/英文浅深页并截图人工查看，不能用DOM文本或静态断言替代视觉。

每个实例20分钟原生物理边界、十分钟关闭目标、至少五分钟结清余量，不重启重置；关闭自有标签、公开shutdown200、原exec/native/launcher（执行/宿主/启动器）0、物理/输出/请求结清，再退休目录副本。当前全表原行/关键事实/schema9/原文件保持。同步现合同和三索引，结束前范围提交、最新上游合并/完整待推集合复核、正常push，持续目标保留进行中。

## 705实证与实施定案

真实原Chat输入未发送草稿后Ctrl+G停在输入框、搜索未打开（01）；Ctrl+K正常打开同一命令面板（02）。Edit菜单实际显示Search Ctrl+G（03），点击Search能够打开；Ctrl+,进入Settings后同一菜单Search也能打开（04）。因此旧DOM转发确实仍工作，不把它误报为菜单完全失效；故障是Windows/Web的已声明快捷键缺实现。

/goal实际打开原Chat创建表单，输入“菜单705未提交目标草稿”。Ctrl+G与Ctrl+K均保持表单/Objective焦点（05），但Ctrl+N把页面强行切到launcher=chat&productPillar=work并关闭表单（06）。通过正常全局入口返回同一原Chat重新打开，Objective已空（07），确认未提交草稿随背景导航丢失。没有点击Start goal，没有生成模型消息或持久Goal；原业务数据保持。

根因是Titlebar只对FileShortcut做全局keydown分发，遗漏声明的G；同一个入口不检查当前Dialog所有权，直接调用New chat，随后既有Goal owner退休正确关闭过期表单。应修全局快捷键/原生菜单入口的准入，不能保留跨owner Goal影子草稿来遮蔽它。原Goal草稿修复只保护表单内部导航，CommandPalette的K处理也只是自身局部保护，未覆盖Titlebar另一全局入口。全仓定义调用已经核对：应用内MenuItem/Range、Windows/Linux快捷键、macOS原生事件均经runTitlebarMenuAction；macOS onMount原生分支不再注册renderer Ctrl快捷键，必须保持这一互斥。AppKit原G绑定保持，不改Rust/native协议。

实施仅现TitlebarMenubar与CommandPalette及公开UI合同：搜索声明保留Ctrl+G/⌘G，在现Windows/Linux键盘分发补精确G/Control修饰并调用原Search动作。Search动作直接发已经存在的oc:open-command-palette意图，删除失效旧输入框查询/合成按钮点击；当前App搜索按钮及唯一Palette信号保持。全局菜单动作和Alt/key-up入口在普通共享Dialog存在时交还键盘，不穿透表单；唯一全局命令面板本身保持既有全局导航语义（对应现K的palette.open例外），不阻断菜单面板自身。使用现Dialog DOM身份判当前输入所有权，不增加持久配置、并行状态或另一个菜单状态机。CommandPalette的Chrome打开事件补与K相同的前台Dialog检查，避免原生意图另开覆盖层。旧特定Goal路径无需改、后端/SDK/schema/调度不改。

检索遇到native-menu-surface-contract.test.ts，已读内容仅Promise/超时的宿主就绪合同，无DOM/组件/源码文案/截图，因此不属UI自动化，不删除也不运行这个未改服务的测试。当前两组件没有发现需保留的UI自动化。纯UI修复用706真实普通构建验证G从输入框和Settings打开、菜单/原K/Escape及候选选择、收起侧栏、Goal未提交草稿面对Ctrl+N/Ctrl+,/Alt+E及G/K保持、Close后原菜单/新对话正常，中文/英文浅深与原会话/草稿。macOS原生窗口在本机不可实测，只审查相同动作所有权及原G绑定，不宣称原生视觉资格。

705已关闭200，原11013/native/launcher均0，物理/输出/请求结清，余量1038014ms。模型0/累计349，目录副本退休、源认证和模型目录字节/元数据保持；92表238840源行、7117原关键事实、166原文件、schema9/integrity ok全部保持。修改从已关闭状态开始。

首次草稿构建期间复核输入边界：阻挡已声明的应用命令时还必须preventDefault（阻止默认行为），否则Ctrl+N/W可能落给浏览器；只能消费精确File/Search/Alt访问键，不能吞掉Ctrl+A/C/V等表单编辑。最终onKeyDown先识别原命令，再在前台Dialog持有时消费该命令并返回；Alt释放同样保持前台所有权。首个构建只记草稿，补充后重新普通Node构建作为唯一706验收资源，不以旧构建冒充最终代码。

## 706实际结果与交付范围

最终普通Node构建main-Cn8FV1dF.js、overlay类型、两语言2570键、docs351操作/26组均0；原main-Cluc2lrs.js仅草稿不验收。706/38211从已关闭705全库只读备份，21旧Task均终态、唯一定时定义rev2 paused、零模型启动开发CLI /ui。

实际原Chat输入框Ctrl+G打开规范命令面板（08），输入归档阅读701得到两个真实Chat/Work候选，重复G不重置查询（09）；Ctrl+1选Work、再G/Ctrl+2回原Chat，同一Session/目录。快速读取时URL仍可能显示上一过渡，后续已核对稳定原ID，不能把过渡当另一会话。Ctrl+,到Settings后G打开搜索（10捕获Loading只证明打开；后续实际候选已读），关闭设置、收起侧栏后G同样可用（11）。getAttribute(value)返回null仅是textarea HTML属性检查，未据此判断草稿丢失；本轮不宣称跨项目Composer草稿另获资格。

原Chat /goal输入“菜单706未提交目标草稿”，Ctrl+N后同一Dialog、原Session和原Objective焦点保持（12）；再Ctrl+,、Alt+E、Ctrl+G/K保持同一表单。Ctrl+A/C实际复制回读等于自身原草稿（13），不是吞掉全部控制键。Close后Ctrl+N正常进入Home（14）。原K入口切中文/亮色，Home /goal未提交输入“菜单706首页未提交目标”，Ctrl+N仍保持原输入（15）；关闭后Alt+E正常打开中文编辑菜单、声明G，Enter选择搜索返回真实两候选（16–17）。所有Goal均只打开/取消，没有点击开始；没有生成模型消息或调度事实。17原图逐张人工复核，不以DOM文字代替视觉。

706关闭200，原74020/native/launcher均0，物理/输出/请求结清，余量852061ms，目录副本退休。源92表238840行保持；目标进一步对全部92表/全部行与706启动前逐项deep equality（结构完全一致）通过，7117旧关键事实、166原文件及两个专用README/Git HEAD保持，schema9/integrity ok。两次零认证/零模型、累计349。macOS原生窗口不可在本Windows机器验收，保留既有G绑定/互斥分发，只审查共用动作边界，不虚报原生视觉通过。

生产范围仅TitlebarMenubar、CommandPalette及07-panel合同；加本记录、17原图/摘要和三条索引。没有改Goal持久化、API/SDK、Rust原生绑定或数据库，也不新增/运行UI自动化。176项他人改动保持。最终提交、最新上游合并/完整待推集合和正常push以实际Git与私有交付回执为准，不预填未完成结果；持续Goal进行中。
