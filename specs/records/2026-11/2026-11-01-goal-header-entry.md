# 持续目标入口与会话切换读取

## Recall

用户要求在预览普通弹窗修复后继续自主排查UI/UX（User Interface/User Experience，用户界面/体验）和功能，真实体验后提交推送，只用当前单agent，不操作正在使用的窗口。旧长期Goal中的三个Astra措辞已被最新单agent要求覆盖。855已推送bcc70f5c2，15张实页图、文件查找/原编辑历史/数据保全、正常hooks及远端0/0均已验证，本轮为进展后的下一批，不重新修Rendering或预览全屏。

开始HEAD=upstream bcc70f5c2，176项无关状态保留。已读855 Recall、853全局导航记录、当前07-panel持续目标/首页/全局命令合同、App唯一openGoalForm和两个ContinuousGoalControl装载点、GoalControl原HTTP（Hypertext Transfer Protocol，超文本传输协议）投影/表单生命周期/只读/预算/指南、Composer菜单与/goal入口、Conversation首页按钮与空白已有Work、Goal样式。全仓搜索Goal入口与调用；既有首页按钮和Ctrl+K命令都正常，不把它们说成失效。

## 修改前问题和影响分析

855实页的原空闲Work，头部只有对话/环境/工具入口，正文没有消息也没有持续目标入口。源码确认新建首页的可见Goal按钮依赖homeContentActive；选中已有会话后该块退出，GoalControl又只有已有goal时才显示状态条。因此尚未建立Goal的已有对话只能先知道+菜单、/goal或Ctrl+K命令才能发现能力。旧818/823首页入口及853全局检索解决对应路径，但没有给已有对话的常用头部提供可见入口。这是可发现性缺口，不是Goal投影、创建、模型或调度失败；本批仍须新隔离实页确认。

实施方向：在已有对话头部动作区增加一个文字+goals图标的当前语言Continuous goal按钮，直接调用唯一openGoalForm；复用当前owner-bound（归属于当前工作）的原表单。只有存在conversationItem的现有会话显示，首页保留既有按钮，不创建第二套入口状态或额外读取。按钮使用原连接可用性；已有Goal打开原详情，无Goal打开原创建；归档/只读仍由原Control决定，不额外增加策略。指南的现start.body同步说明已有对话头部入口。

影响面为App当前头部布局、两语言原指南、当前架构合同；不改服务接口、SDK（Software Development Kit，软件开发工具包）、schema（数据库结构）、配置、LLM（Large Language Model，大语言模型）消息/调用或调度。全仓唯一request调用链已经核对，新增按钮只发送现有递增openRequest。没有执行轮次、唤醒或队列异常线索，共享执行横审不适用。风险是窄桌面/打开Dock后的头部挤压、错误owner表单、草稿与预算丢失、已有Goal误开新建、只读归档误创建、首页出现重复按钮及文字漏接当前语言。

## 实施前真实方案与验收

从已退休855-after完整QA（Quality Assurance，质量保证）库建立goal-header-entry-856-before/38504，原schema9/92表234493行、140附件、62项目文件/Git和9Goal全部保护；不写项目文件、不发送消息/Goal。配对复制已授权OpenAI认证和完整models目录，核验Provider凭据与精确gpt-6.1-sol投影，新增请求上限0/累计1180。新60分钟绝对期限只属于856，候选沿用，启动余10分钟、物理结清余5分钟。服务通过正式开发serve的/ui，仅自有后台页，用户18571服务/窗口/数据库不触碰。

先观察原827空闲Work头部、+菜单已有Goal路径及同一表单，截图人工确认缺口，补充实证后再修改。候选新构建/38505真实验收：空闲Work可见文字入口→带入未发送草稿→指南→返回/关闭重开，原草稿、预算120000/2保持；清空本页草稿，不点击Start goal。选择原暂停Goal会话，头部入口打开原详情并核对paused/36322令牌/1轮；中文相同入口与指南，桌面Dock展开/关闭布局，New chat首页既有按钮与原表单，避免重复。若发现其他风险按真实结果修正后重新截图。归档/Task/Mission/SideChat未进入时不得声称已实页覆盖。

纯UI不新增/修改/运行UI自动化测试，类型、当前check:i18n及普通build辅助，最终必须有真实交互和截图人工复核。结束自有页与服务，公开shutdown及原exec/native/launcher、物理/输出/请求/出生身份结清后退休配对副本；全部原业务列/附件/文件/Git、源库及9公开Goal逐字段验证。同步三索引和当前docs:check，范围提交，fresh fetch/普通merge、全待推审核、正常hook push及远端回读，独立其他工作不等待，仅真实冲突处理。

## 本批实证与实施确认

38504/main-D3gqrsEQ.js自有73页，01真实原空闲Work页面无可见Goal动作，只有原头部三图标及底部+菜单。02从+菜单选择Continuous goal /goal可正常打开原创建表单，明确Applies to this conversation/Work且未开始。根因为已有会话缺少可见快捷入口，不修改正确的表单/投影。四个生产/架构路径修改前差异为空并保存。

核对原openRequest合同：未完成Goal打开详情，已完成Goal按现合同打开新目标创建；归档只读通过原open转换到详情/指南。新头部按钮完整沿用此行为，不另外读状态推断。候选实际核验暂停目标，已完成/归档分支未进入则不声称实页覆盖。

## 首候选真实失败：切换owner后的读取就绪

38505/main-BnVi7xDm.js首候选74页，03—10头部可见、原Work草稿/指南/120000与2预算保留及双语布局通过。通过真实Ctrl+K选中原暂停Goal会话后立即点击头部入口，11实际打开创建表单；原Goal稍后显示已暂停/36322令牌/1轮，创建表单仍未纠正。没有延迟注入、网络模拟、fixture或启动目标。此为本批真实失败，不能用入口可点击声称验收通过。

进一步根因：共享ContinuousGoalControl的resource在已有投影后换source进入refreshing而非pending；goal()已按source.key屏蔽旧值，但initialLoading仅检测pending，因此未读到新owner当前值时openRequest被提前消费，误按无Goal打开create。旧路径的key屏蔽保护了数据展示，却没有覆盖操作就绪。App新按钮只是复用入口暴露原共享缺口，+菜单、/goal及命令面板同受影响，不能只禁用头部按钮。

追加修改前全仓核查：同一控件覆盖主Chat/Task/Mission与SideChat、独立Home装载；source.key含API authority revision、selectionEpoch、kind/id/directory。disabled、openRequest延后消费、详情/状态按钮和失败重试均共用initialLoading；状态条直接读取过滤后的goal。createRequest是原新会话启动失败回填合同，明确请求create，不改变它；普通同owner后台refetch已有当前投影时保留原操作可用性。原source变更效果退休旧表单/编辑/失败与轮询，mutation仍校验原authority/owner/expectedRevision。没有执行器调度、队列、Goal状态或Task/Mission/Session执行轮次异常，问题为UI异步投影的作用域就绪判定。

修复方案是让现initialLoading同时覆盖当前source存在、没有当前读取错误、projection.key尚不匹配的状态；保留首次pending与错误反馈。共享请求将等待当前key投影再决定详情/创建，同owner已有当前投影的刷新继续可操作。只改一个就绪定义，不加计时器、第二状态、后台读取、快捷按钮旁路或额外Goal查询。新一轮候选必须重新普通构建并用38506/after2发生轮次，保留首候选数据/原图/日志并结清，沿用原856绝对期限不延长。首候选after的定义不改写为通过。

## 最终实现与实际验收

App已有对话标题栏显示原goals图标和本地化持续目标文字，直接调用唯一openGoalForm；首页显式不显示该头部动作，继续原介绍按钮。中英文原指南说明相同入口。共享initialLoading保留原首次pending，同时将当前source存在、没有读取错误且projection.key不同的状态判为尚未就绪；既有openRequest效果自然等待当前投影，再按真实Goal决定详情/创建。同owner当前key的后台刷新保留操作可用性。没有增加Goal读取、定时等待、第二状态、模型控制gate或修改API/后端/持久格式。

最终普通构建main-mPTc0h-C.js/38506，自有75页。12原Work按钮可见；13实际按与失败11完全相同的选择原暂停对话后立即点击，正确打开Continuous goal settings，原paused/36322令牌/1自动轮次；14反向立即切回原无Goal Work，正确打开该对话的新建表单。15最终源码的GOAL856_FINAL_KEEP由原composer带入，指南返回/关闭重开保留120000/2预算；16切中文后同一草稿和预算仍在，17中文指南显示当前标题栏入口。18中文再次即时切换原暂停对话，同样打开原目标详情，未保存、恢复或完成目标。

19 New chat进入原首页，保留单一介绍旁入口和原布局；20打开原Home新建会话表单，未启动。21从真实设置归档列表只读打开原生对话读取错误803，22头部入口按原只读规则打开指南，历史/归档状态保留；没有恢复或删除。23回原空闲Work并展开Dock，中文文字入口与其他控件完整可见，主输入已清空。全部23张原图已真实呈现、亲自查看，11明确保留首候选失败，12—23为最终构建验收，不将03—10冒充根因修复后的画面。

主Chat/Task/Mission、SideChat和Home的共享调用点已审计；本批实际视觉覆盖Work、Home和原归档Chat，未逐一重放Task/Mission/SideChat，也未注入任意网络延迟或读取错误。快速切换失败与修复均为真实UI操作，无网络桩、fixture、DOM/组件/快照/UI自动化测试；没有把原Goal消息中的指令当作本轮执行要求。两轮普通类型、2676键/两语言、普通build/renderer公共面均通过；最终docs:check通过352操作/26组。

三轮before/after/after2分别234493→234495、234495→234497、234497→234499，只新增每轮一对engine_control_activation_lease/grant；schema9/92表和全部原行所有列保持。九个原公开Goal逐字段一致，140附件、62项目受保护原业务文件与Git身份/状态、源库保持，没有项目排除。本轮未编辑项目文件。文件快照逐字节范围不包含原.opencorvus运行元数据目录；.git通过HEAD/ref/index/status核对，不把它们表述为逐字节目录覆盖。没有读取或修改用户数据库。

三轮原exec 95765/67224/8892，native/launcher均0，公开shutdown200、物理/输出/请求及出生身份完整结清；余3498324/2914708/2258725ms，原856绝对期限未延长。新增模型请求0/累计1180，六份配对副本退休，源认证元数据及模型目录字节/元数据保持。自有73—75页关闭、受控库存为空；用户18571服务及窗口未操作。按授权范围提交、fresh fetch/普通merge、完整待推审核、正常hook推送与远端回读后继续下一轮，长期Goal保持active。
