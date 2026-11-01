# 全局导航与查找体验复核

## Recall

用户最新要求：“预览修好了就继续其他迭代，只用你一个 agent，自主排查 UI/UX 和功能问题，实际体验验证后提交推送，不要动我正在使用的窗口。”旧长期Goal中的三个Astra措辞已被后续单agent要求覆盖，本批不委托、不操作用户18571服务、窗口或用户数据库。上一批f13248cc0/ecf1a179f已真实验证普通预览及菜单、演示布局，提交已在origin/main；不重复修复已解决的Rendering或Sources问题。

本批开始HEAD=ecf1a179f，现176项其他工作区状态保留，公共索引其他正文不得混入交付。调查范围先放在全局导航、命令搜索、对话查找与目标管理入口的真实日常流程；不会因为读到可疑代码就直接修改。已读AGENTS、07-panel的导航/初始恢复/查找合同、workspace-location、CommandPalette、ConversationSearchDialog和其纯检索器、ComboboxControl、Dialog、ContinuousGoalControl、ArchivePanel，以及840匿名项目搜索和821来源查找、831目标长度的历史决策。检索定位、Unicode、匿名标签等已经有独立修复与验收，不把它们重新当未知故障。

## 调查方案与验收边界

从已完成并退休的852-media2真实QA（Quality Assurance，质量保证）数据建立workspace-navigation-853-before，92表schema9及全部原业务字段、140附件、62个原项目文件/Git均保存；不读取用户数据库。冻结当前普通前端构建，通过开发serve的/ui和后台自有页人工操作；使用既有计算机使用能力，不新增或运行UI自动化测试。配对投影既有授权的认证和完整模型目录，并分别核验Provider及gpt-6.1-sol；最大新增模型请求0，累计1180保持。新60分钟绝对期限仅属于853批，候选沿用，不延长，启动余10分钟、物理结清余5分钟。

先体验首页与已有对话间切换、Ctrl+K命令查询/选中/返回、当前会话查找/刷新/定位及普通设置导航；截图人工检查聚焦当前目标区域、原消息、真实路径和返回位置。探索最多围绕本批这些入口，发现可复现缺陷后补充可观察现象、直接触发、根因、旧路径遗漏、全仓定义与调用/同义实现、公共契约/数据/测试/文档/交付风险的完整分析，再修改产品。当前根因与是否需要产品修改未知；未检测到调度异常，若出现立即按共享机制横审全部生产入口与Task/Mission/Session执行轮次。

实际修改后以新发生轮次冻结新普通构建，重复同一真实流程并重新截图；纯UI仅人工视觉，非UI能力用聚焦正向契约测试及真实checker。结束自有页、公开shutdown、原进程句柄/native/launcher结清与出生身份核对后退休配对副本；逐表全列、原附件字节、文件/Git及公开原自然消息保全。同步三索引、当前docs检查，使用私有index只提交本批正文与索引行；fresh fetch/普通merge、完整待推集合审核、正常hook push后回读远端。未达到的验收如实说明，不将长期Goal标为完成。

## 当前实页发现与修改前分析

38498/main-B454iFzK.js自有66页，01为全局空查询，02输入goal后只有历史项目/对话结果与Load more，不能直接打开当前持续目标。03通过已有首页按钮确实打开原Goal表单，Objective带入原未发送NAV853_DRAFT_KEEP。当前不是Goal创建或Provider故障，是全局能力发现缺口；不把未执行的创建流程说成失败。

直接触发是用户在已声明可搜commands的入口搜索goal。数据/控制流根因为CommandPalette本地命令集合包含新对话、目录、设置、外观、语言和日志，却未连接App已有openGoalForm。后端正确返回目录/标题含goal的真实工作，不能删除这些匹配或用关键字改写检索。818/823等补了首页和composer入口及指南，但全局命令集合仍维持原功能清单。全仓唯一CommandPalette消费者为App，App已有同一goalOpenRequest同时服务首页和当前owner的ContinuousGoalControl；该组件负责当前Goal详情/新建、只读、草稿、预算、错误和焦点。不能新建另一Goal表单或让命令直接创建目标。

范围只涉及App的一个可选回调、CommandPalette新增一个本地命令、原Goal指南和两语言文案，以及07-panel现合同。App仅在会话主界面且已有首页或有效conversationItem时提供现openGoalForm；Mission Board无可见目标控件时不展示此当前页面操作。归档owner仍由原Control决定只读，不另加权限或状态策略。命令使用已有localized Open goal标签与goals图标，沿现匹配器搜索本地化标签/说明及英文技术检索词。它放在现本地命令集合的前部，仅非空查询时显示；保持空查询的九条最近工作与原Suggested结构，原work结果、cursor及Ctrl+1…9选择仍按原顺序，不改公共搜索合同。

实施前决定：把现openGoalForm作为可选onOpenGoal传入CommandPalette，memo读取当页能力后新增run直达同一函数的命令；不增加目标状态、查询或协议。原GoalGuideSteps增加Open goal本地化参数，原start.body说明Ctrl/Cmd+K及搜索目标/goal的入口。没有API（Application Programming Interface，应用程序编程接口）、SDK（Software Development Kit，软件开发工具包）、数据库schema、存储、LLM（Large Language Model，大语言模型）或调度变化；内部组件回调唯一调用点已搜。风险是命令在错误页面出现、palette到form焦点交接、首页草稿丢失、已有Goal误开新建，以及指南/搜索中文漏接。候选实际覆盖英文home草稿→命令→同表单、指南返回、关闭重开、中文查询与表单、原已有Goal或会话归属、原最近列表/设置命令；不提交Goal、不改变已完成/暂停状态。纯UI不写或运行自动化测试，类型/双语/普通build辅助，最终以截图人工复核与原数据保全验收。

## 实现与真实验收

实现沿上述唯一回调和表单，无额外Goal请求或数据源。新命令位于非空查询的前部，与原工作结果分组，空查询仍是九个最近工作加原三个推荐。类型、2675键/两语言及普通Overlay build/renderer公共面通过，最终main-BTGhDWow.js。

38499自有67/68页，04实际搜索goal显示Open goal及原工作结果，Enter打开05同一首页表单，NAV853_DRAFT_KEEP和Objective焦点正确。06查看指南并返回后，把Objective改为NAV853_FORM_DRAFT_KEEP、预算设120000/2，关闭再通过Ctrl+K→goal→Enter重开；07显示原表单草稿、展开状态和两个预算保持。没有点击Start goal，未发送草稿，最后清空主输入。

读取原事件存储及公开Goal接口选出真实暂停目标ses_-zUQhUDWdzzX0g71aRx5，按原selection的experience=work进入。08命令打开已有目标设置，原状态paused、36322令牌和1自动轮次保持，不是另开创建表单。通过隔离页自己的语言命令切换中文，09搜索目标显示“打开持续目标”，10打开同一原目标，11指南引用正确中文入口。12—13实际Ctrl+F检索“阶段二”并选择原work消息，原正文被展开定位；14—16切换Mission看板、搜索原工作，并用Ctrl+1返回原暂停目标对话。看板截图只验导航与查询，不用历史状态标题证明执行机制正确或异常。本轮未启动Task/Mission或恢复原目标。

17由现字面查询general选择“通用”，打开原设置并返回。首次尝试settings general未命中，符合当前连续子串匹配而非分词AND合同，不声称任意自然短语可搜；本批保留原检索器。一次过快在Goal关闭过渡中发送Ctrl+K，原前景Dialog边界忽略该键；重新观察已返回后正常打开，没有绕过前景表单保护。一处异步结果加载后旧AX索引点击失效，按最新真实状态选择正确选项后完成17，未将探针失败当产品缺陷。

初始私有SQL探针误猜continuous_goal独立表，随后读取唯一continuous-goal/store确认原Protocol事件存储，再由原公开接口取得九目标完整事实。最终所有九个原Goal逐字段一致；选中的原Work完整两消息/selection/Goal逐字段一致。before原92表234307行保持，after到234309仅多一对runtime activation lease/grant，全部原业务列保持；schema9、数据库完整性、140原附件、62原项目文件/Git及源库保持，无项目排除。Provider新增0、累计1180，配对认证和完整模型目录的四份副本已退休，源认证元数据/模型字节及元数据保持。

两个原句柄79675/42464与native/launcher均0，公开shutdown200、物理/输出/请求及出生身份结清，余量3270768/2903138ms；原853期限未延长。自有66—68页关闭，库存为空，未操作用户18571服务、用户数据库或窗口。17张真实截图均亲自查看，没有UI自动化测试；Task、Mission会话、归档owner及SideChat未逐一通过新命令实页打开，不把共享代码接入说成这些分支的视觉覆盖。主目标继续active，仅用户最新单agent授权适用。

原图和数据汇总见[验收目录](../../artifacts/2026-11-01-workspace-navigation-review/README.md)，交付以范围提交、完整待推审查、正常hook及远端回读为准。

交付准备期间另一个会话提交了独立benchmark文档及共享索引的另一条说明，初次严格字节保护因此停止在写入前。实际审查除换行投影外，仅数小时长程任务索引增加原型链接，与本批行/产品文件不冲突；保留其当前正文，以私有index只提交本批新增索引行继续，不等待、不覆盖并行内容。原失败准备目录为空，修正工具按已审查当前索引重新建立交付事实。
