# 项目选择中的查找（884）

## Recall

用户要求单agent（代理）持续自主体验并改进整体UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能，实际页面验证后提交推送，不操作用户正在使用的窗口。旧Goal中的三Astra已被后续单agent要求覆盖，本轮不委托。上一轮为实质进展：4ffd1f0a0428959ec7fb55e465202c9ca5030d12已推送；fresh HEAD=origin/main，0/0，本轮前工作区177项无关删除/共享索引/缓存保留。883-final完整资格schema9/92表、258687行、100旧项目、229附件、0模型请求/累计1260；原句柄23943 exit0、shutdown200和配对副本退休。

本轮针对大量项目时的查找与创建。当前MissionCreate有100个projectDirectories，使用只能滚动/按文字跳转的SelectControl，883虽修复同名目录身份与创建默认上下文，没有提供可见输入搜索。先用真实页面确认，再实施。验收目标：看板筛选及创建能按项目名、父目录、完整路径和匿名项目真实后缀筛选；名称/目录线索保持；键盘Enter选择、Esc取消、空匹配说明和恢复已选值正确；搜索本身不更改canonical directory（真实目录）或草稿，明确选择后才切换，创建默认跟随看板筛选。中英文真实交互、截图人工复核。

已读：根AGENTS.md、883 Recall/最终资格/实际23图及fresh同步回执；07-panel项目目录身份、共享Combobox键盘及翻译合同；MissionBoard/MissionCreate项目值/显示与open/changeProject调用；现SelectControl、SelectField、ComboboxControl全部实现、三个生产调用（CommandPalette、ConversationSearchDialog、ScheduledAutomationsPanel的时区）；MemoryContextPanel项目owner及定时任务多项目Listbox，后两者业务选择协议不同不在本轮替换；现TextField、Tooltip、top-layer、select-control.css、Popover、text-search。Kobalte安装包src/combobox公开实现用于核对API（Application Programming Interface，应用程序接口），没有执行或修改第三方包测试；库内上游测试不是本仓库产品UI自动化。本轮不新增、修改或运行产品UI自动化测试。

权威资料：[Kobalte组合框](https://kobalte.dev/docs/core/components/combobox/)、[W3C组合框模式](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)。可编辑组合框使用原生文本输入与候选集合，保留既有值直到明确选择；键盘和关闭由成熟组件拥有。现安装版代码与当前文档API差异以本地实际类型为准。

## 修改前深度与影响分析

- 现象线索：创建项目Select菜单实际100目录；选项textValue仍只basename，父目录虽可见但无法直接搜索，窄弹出区约显示9项。884实页观察尚未知，883图片作为调查线索，不作为本轮新验收。
- 触发/根因：数据来源已完整，阻碍是选择器只提供非编辑Select行为；不是缺少项目或注册异常。增加后端搜索/缓存/平行目录列表会引入双源，不采用。当前CommandPalette用共享ComboboxControl能查找，但它属于全局导航，不代替创建字段的精确选值。
- 旧修复未覆盖：883解决身份/默认目标，仍把100项交给无输入控件。不能以键盘按字母跳到project等同名项冒充可搜索。
- 方案：扩展现ComboboxControl提供成熟Kobalte Portal/Content/Trigger的popup呈现；原inline呈现继续服务现三个调用，不创建另一个组合框实现。候选/已选/输入过滤/键盘由原Kobalte root单一拥有；不另建query或project持久状态。native上下文isOpen替代仅看可选props.open的内部空状态/聚焦读取，支持原控制模式和原生非受控popup。沿用现TextField说明关联、共享Tooltip/top-layer、select控件外观primitive。搜索过滤直接复用matchesSearchTerms，字段来自原label/parent/value及现路径字符串的正斜线显示，支持实际Windows/正斜线输入，不修改目录身份或算法。
- 具体范围：ComboboxControl新增popup、disabled、目录title/data-ui、ARIA（Accessible Rich Internet Applications，富互联网应用无障碍语义）说明和选项Tooltip的可选参数；Popup输入配搜索图标/展开箭头，沿原label显示选中值，父目录留在选项名称中。Select样式表复用现chrome并补输入/焦点/有界弹层规则。MissionBoard项目筛选和MissionCreate项目字段改用这一primitive；旧Select使用在这两个调用移除。两语言增加搜索提示及无匹配说明，07-panel同步。
- 公共影响：ComboboxControl现CommandPalette/ConversationSearchDialog/定时任务时区仍inline，必须实页回归命令面板查找/取消、会话查找、时区打开/取消；不得以typecheck替代。普通Select及MemoryContext/定时任务多项目列表保持现owner，本轮未把不同业务协议统一。原anonymous真实后缀、全路径说明、筛选/创建默认、changeProject草稿保全、上下文加载/过期请求归属保持。
- 风险：输入查询清空已选值；Esc将草稿或目标改错；无匹配关闭弹层导致无提示；Dialog内portal越层/焦点丢失；父目录再次退出可访问名称；长路径/100选项挤压底部动作；新增popup默认改变三个inline消费者。通过真实数据逐项验证并保留失败截图。
- 不适用：数据库schema（结构）、持久数据/迁移、模型/Provider/LLM（Large Language Model，大语言模型）/工具契约、Task/Mission/Session调度/轮次/终态/队列/恢复/重试/多项目执行不改，无运行异常证据；若出现共享调度异常立即横向审计，不能归因模型。不发布版本、Release、tag或PR。

## 首次资源与顺序

before/after首次各0模型请求。首次prepare之前声明75分钟共同绝对截止，预留5分钟正常闭合，不提高额度、不延长截止、不重启旧阶段。源为883-final完整合格258687行数据库，复制并保护全部100旧项目业务文件/Git及229附件。原认证与完整模型目录成对复制/验证/退休，不输出凭据。before复用883最终main-9mBp8NKe.js及原成功receipt；after用Node.js构建。本人后台项目CLI（Command Line Interface，命令行接口）开发/ui/，独立38586/38587，不触用户18571及其他窗口/进程。

1. before实际查看100项目创建菜单、同名目录/非首屏项目查找、原请求草稿与键盘/取消；记录现查找方式，未知不猜测。正常退出/public shutdown200/原句柄exit0/物理输出请求及出生身份结清/配对副本退休/完整旧数据资格后才改产品。
2. 按本方案实施现primitive和两个字段，不改后端和非UI算法。UI验收只用真实页面交互、截图和人工复核；辅助build/typecheck/i18n/CSS（Cascading Style Sheets，层叠样式表）/文档检查不冒充实页。
3. after真实100项目中查询737/801、非首屏Goal项目、完整目录（两种斜线）、匿名后缀、无匹配、Esc恢复/明确选择/草稿保全、中文和英文；回归三个inline消费者。只编辑未提交表单，不有效创建/执行任务、日程或调用模型。
4. 正常收拢并验证全部旧行/项目业务文件与Git/附件/来源DB/原认证模型目录。同步三索引，范围提交；fresh fetch与普通merge、完整待推集合审查、正常hook/push、fresh同步。持续Goal保持active。

## 实际实施与证据

before待实页确认。

### before确认

01真实看板七个项目菜单保持883目录线索，但没有输入区；02真实创建菜单在原生7/3/7键后仍展示原全部候选，选中801不变，没有输入查询反馈。原始请求完整保留，正常取消。两图均已实际呈现人工查看，不把键盘输入当成创建执行。native-before原句柄89866 exit0、shutdown200、物理/输出/请求与出生身份结清、配对副本退休。

### after真实发现与共享键盘审计

03–12已实际验证737查询/Enter筛选与创建默认、无匹配提示/Esc恢复原目录、100项中的非首屏870-after、Windows与正斜线完整路径、匿名d3b428、手动标题/说明保全；13全部项目选值成立，但截图位于关闭动画中，稳定视觉仍需final复核。14命令面板真实737查询返回原六条记录并可关闭；15原Mission801实际29消息中批准查询返回13项，会话搜索可关闭。

16原定时任务时区输入London出现Europe/London；17按一次Esc后整个设置页已关闭回原Mission，而不是仅关闭时区候选；取消按钮因此不再存在。保留失败图，未保存或执行日程。不能把此次作为Esc验收通过。另有两次在关闭搜索窗口的同次工具调用内紧接导航未生效；重新观察稳定页面再普通点击成功，未证明根因，不以其宣称导航修复或判定模型问题。

根因代码链路：Kobalte已安装Combobox.Input先调用调用方onKeyDown，再执行自己的Esc关闭/恢复，但未消费事件；内联时区没有Content/DismissableLayer。ConfigDialogHost的window Escape热键只尊重defaultPrevented并检查目标位于设置页，因此同一次Esc又关闭设置。审计全部生产Combobox入口：CommandPalette通过onOpenChange关闭自身；ConversationSearchDialog已有自定义onInputKeyDown消费Esc并关闭自身；Scheduled时区只关闭候选状态，外层设置仍收到事件；新增两个popup有成熟Content层但也应遵守同一键盘owner。没有Task/Mission/Session执行、调度、队列、唤醒、恢复或终态异常证据，排除本轮键盘输入改变运行协议。

修复放在共享ComboboxControl输入事件链：先保留并调用原有onInputKeyDown（含其函数/绑定元组类型合同）；输入法非组合状态、原候选打开、Esc且调用方未消费时，消费该事件，仍由原Kobalte输入处理关闭/恢复。关闭后的后续Esc继续交给外层owner。原三个入口不再各加分支，ConversationSearch现行为优先保留。无host工具路由gate、旧实现或平行状态。final需实际验时区第一次Esc保留设置/草稿并恢复Asia/Shanghai，再正常取消；命令面板和会话搜索Esc仍关闭自身，两个项目popup Esc保留模态/目录/草稿。

after证据/失败17及原句柄16975 exit0保留。final首次0请求，沿原75分钟共同截止，不提高额度、续期或重启；源为本轮after完整合格数据库，独立38588/本人后台页，Node.js新构建及完整保全资格。中文和英文验收在最终页面完成。

### 最终实施与资格

最终main-B6mbMiSX.js，29原始截图已逐张实际呈现人工查看，失败17与过渡13/21/22保留，稳定视觉以18/20/23/24/25/27/28/29为准。项目完整路径两种斜线、父目录/名称、匿名后缀、非首屏项目、无匹配/Esc/未选择移焦/明确Enter、AI及手动草稿保全均真实操作；原内联三个调用均回归。最终时区第一次Esc保留英文/中文设置、Asia/Shanghai及标题/提示词，第二次才关闭外层；中文正常取消表单。命令面板和会话搜索自有Esc仍关闭各自窗口；后者原29消息/批准13匹配保留。没有有效创建/执行/保存或模型请求。

共享ComboboxControl一个Kobalte root和事实来源，新popup呈现复用现选择控件chrome与页面portal；旧项目Select调用已移除，原inline调用保持自己的布局与关闭owner。键盘消费只在候选原来打开且调用方未消费的非输入法组合Esc，保留原回调函数/绑定元组合同；现ConversationSearch自定义关闭优先。没有新增后端、数据库、工具流程gate或非UI算法。两语言各新增两个字段；原目录与语义搜索owner复用。

before/after/final原句柄89866/16975/92375均exit0、shutdown200、物理/输出/请求和出生身份结清，六份认证/完整模型目录配对副本退休。三阶段首次额度均0，实际0/累计1260，共同75分钟截止未改变。完整旧行258687→258689→258691→258693，只新增进程租约；schema9/92表、全部旧业务行、100项目业务文件/Git、229附件、来源DB及原认证/模型目录保全，无文件系统豁免。最终普通Node.js构建、typecheck、两语言2748键、CSS9052引用402源码、docs352操作26组均通过；正常推送hook仍需跑完整交付检查。

[全部实页证据和明确限制](../../artifacts/2026-11-02-project-discovery/README.md)。未运行UI自动化、屏幕阅读器软件、真实输入法组合、所有主题/缩放、全部项目组合或模型执行。中文原生日期/时间格式仍需后续调查；两次关闭窗口后紧接导航的未生效原因未知，不把稳定后重试成功当成根治。只收本轮文件、四个语言字段和三条索引，保留177项无关工作；持续Goal保持active。
