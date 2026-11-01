# 当前工作在侧边栏中的定位

## Recall

用户持续要求自主迭代UI/UX（User Interface/User Experience，用户界面/体验）和功能，真实体验验证后提交推送，仅单agent，不操作正在使用的窗口。858已推送02b44cc8c且远端回读0/0；真实修复Explorer方向浏览、单一呈现、滚轮及未测量行聚焦，23图含失败候选，原数据/Goal（持续目标）保全，全部自有发生轮次和18份配对副本结清。继续新范围，不重复旧Rendering/全屏。长期Goal旧Astra措辞被后续单agent要求覆盖，不委托。

859开始git status保存私有初始快照，HEAD=upstream02b44cc8c，176项无关状态保留。已读858 Recall与最终回执、WorkLedger分组/排序/当前选择/Projects及Recents、ProjectLedgerGroup展开与操作owner、LedgerList/ProgressiveList、当前07-panel侧边栏选择/项目折叠/置顶/渐进列表合同、777/项目置顶连续性历史。全仓搜索ProgressiveList/LedgerList的所有生产消费者、当前项目定位能力、选择/aria-current及全部项目分区。现渐进折叠分别覆盖项目组和项目内记录；项目Collapse只由原presentation owner控制。选中项不得自动改变项目展开，也不得为焦点合并Pinned/Projects或总是显示全部项目。

## 调查与验收方案

待真实确认：从命令搜索打开较旧项目/对话后，该当前工作不在侧栏首十项目/首五记录中，用户缺少快速定位上下文的显式操作。这个阶段尚未确认问题，不修改产品。源码支持直接触发线索为两个ProgressiveList的slice与独立项目collapse；旧原选择active投影仅影响已呈现行，不能穿透折叠。先体验较旧827 Work在当前布局的可发现性和既有菜单，核对当前完整projection与实际原名/目录，不用模型标题判断根因。

若确认，以现唯一集合/展开/选择事实为依据设计用户主动定位；保留选择本身不强制展开的现合同，定位不得新建或切换项目、消息、Task（任务）、Mission（协作工作）或Session（会话）。具体入口、公开UI契约、所有定义/调用/测试、焦点生命周期及按项目/单列表/置顶/嵌套Task影响分析补齐后才实施。当前无执行调度/队列/恢复异常证据；若发现则立即横审共享生产机制。

从已退休858-final5复制完整QA（Quality Assurance，质量保证）库，schema（数据库结构）9/92表234517行、140附件、62项目受保护业务文件/Git身份和原9Goal。原QA中的132个keyboard-review-858文本已是本批原文件；不改它们。文件快照排除.opencorvus运行元数据，.git以HEAD/ref/index/status核对，不扩大字节覆盖。新60分钟绝对期限，before/38518及after/38519沿同一期限，启动余10分钟、结清余5分钟；不延长。配对复制已授权OpenAI认证与完整models目录，核验Provider注册和精确gpt-6.1-sol投影；新增模型请求上限0/累计1180。

仅正式开发serve的/ui、自有后台页和原始截图人工视觉复核；不操作用户18571服务/窗口/数据库，不新增或运行UI自动化。非UI改动需聚焦正向合同测试，类型/语言/普通构建仅辅助。最终逐表全列/源库、附件/项目/Git/原Goal事实保全，关闭自有页、公开shutdown/原exec/native/launcher与物理/输出/请求/出生身份结清，退休配对副本。同步三索引/当前docs:check、独立范围commit、fresh fetch/普通merge/全待推审查、正常hook push及远端回读。

## 已确认根因与实施边界

before的38518真实打开原827 Work，正文已就绪而侧栏前十项目没有Anonymous34f684；整理菜单只有分组和排序。手动Show more后可滚动找到同一Work，截图01/02/03记录。根因是当前完整数据已加载，但两级ProgressiveList只呈现前缀；选择态只投影到已挂载行，既有项目collapse又独立保存。既有实现遵守了选择不自动展开合同，却缺少用户主动定位的公开能力。不是网络、数据库、模型或执行调度异常；这些机制无需修改。

在Projects工具栏添加本地化“定位当前工作”原生按钮，使用现有lucide-solid的LocateFixed。目标从当前groups和同一个selected谓词推导，嵌套Task使用Mission父行展开路径和实际子行身份；项目页面定位实际项目标题，单列表无行的普通空项目明确不可定位。保持置顶分区、排序、项目/记录身份、Recents和全部持久数据契约。只用户显式点击才展开必要路径，不改变选择、导航、固定状态或接口。

ProgressiveList增加可选revealItem及呈现完成回调，仍只有原expanded一个展开事实；LedgerList及WorkLedgerProjectGroupView转交同一请求。目标在前缀外才展开，组件呈现后通过微任务确认，禁止轮询或延时重试。ProjectLedgerGroup现collapse owner增加精确expand操作，全仓只有WorkLedger消费者；不调用兼具选择行为的项目header。请求捕获当前API（Application Programming Interface，应用接口）权限域、目录、选择、组织/排序及发起按钮；域变化、加载、错误、目标退休和组件退出即失效。焦点由当前真实DOM（Document Object Model，文档对象模型）行确认，限定Pinned/Projects主列表，避免Recents同身份副本；其他控件取得焦点时不抢回。使用原生focus的可见性滚动，依据[MDN focus合同](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)。

定义和消费者已全仓核对：ProgressiveList另供GoalGroup/RequirementsPanel，未传可选请求时保持原行为；LedgerList、ProjectLedgerGroupCollapseState只有当前路径需要修改；项目置顶自己的parent focus owner保持原777/778合同。定向搜索上述UI组件测试无命中，不新增或运行UI测试。风险为两级呈现先后、嵌套子行、单列表对象代理身份和请求失效；用每个当前列表的实际item对象转交，不缓存DOM或强制更改排序，真实页面逐项复核。类型、语言、普通构建辅助检查，实际截图为UI验收依据。

## 第一候选复核与收敛

after/38519实际脚本main-ByPqZRvr.js，04–15原图亲自呈现。鼠标、Enter、Space分别定位原Work；先折叠项目再搜索重选保留折叠，主动定位才展开；单列表八项前缀外记录、普通分区和Pinned分区的原801嵌套Task均聚焦精确task行。Pinned通过真实菜单置顶/取消置顶往返，源码Project.setPinned只改变time_pinned且保留time_updated，取消后原null恢复，最终逐列核对。中文入口正常，Mission看板上下文定位实际项目标题；单列表未呈现项目标题时正确禁用。

第一候选禁用提示却只说打开项目/对话，不能指导单列表项目上下文；此点不作为最终通过。收敛为明确提示打开对话或切换“按项目”，再次普通构建，用after2/38520新实例和原绝对期限复核中文禁用提示及定位。没有扩展模型调用或期限。当前数据每项目最多三条顶级记录，所以按项目组内超过五条未能实页覆盖；单列表记录级折叠和项目级折叠均有真实操作证据，不把源码推断写作此未发生组合的通过。

## 最终验收与数据保全

after2新实例真实主脚本仍是main-ByPqZRvr.js，最后提示来自独立i18n资源；实际中英文控件title已核对为“打开列表中的对话，或切换到‘按项目’定位项目”及对应英语，不能用相同主脚本名误判文案未更新。16–22最终截图亲自呈现；首次点击定位原嵌套Task、Space定位单列表、中文指引、依提示切回按项目后Enter定位项目和返回Task后的中文Enter均真实完成。21旁侧悬浮说明来自原鼠标位置，22通过点击空白头部移开后复核完整布局。看板下直接点击尚未展开的子项未完成，按既有键盘路径进入Mission抽屉再选择成功；保留实际过程，不将失败操作描述成通过。

三个发生轮次均经公开shutdown返回200，原exec/native/launcher退出0；进程出生身份、物理结束、输出排空和请求清理均结清，最小截止余量2223725ms，6份认证/完整模型目录副本退休。schema始终9/92表，原234517行逐列保全，最终234523行仅多三组正常lease/grant；140附件、62项目原业务文件/Git身份及源数据库保全，文件排除0。最终交互后通过公开接口重读9原Goal，状态/用量/轮次等事实与初始完全一致。新增模型请求0，累计1180；源认证元数据、完整目录字节及元数据保持。未操作用户18571服务、窗口或数据库。

最终类型检查、两语言2679键检查和普通前端build（构建）/renderer public surface检查通过。全程没有UI自动化测试；生命周期失效由源码复核，不声称竞态故障注入通过。新入口和共享呈现契约同步当前07-panel，原图及完整回执见[实页证据](../../artifacts/2026-11-01-sidebar-current-location/README.md)。三索引仅加入本任务条目，保留176项原无关工作区状态；交付仍执行文档检查、独立范围提交、fresh fetch/普通merge、全部待推提交复核与正常hook推送，不创建版本或Release。
