# 多步任务卡片中的子任务直达（897）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，真实页面体验、截图人工复核后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的三Astra。上一轮896是progress：f7b6e3fddd7e8a529af97480f8e403c0def2bc20正常推送，fresh HEAD=origin/main/0/0，本人25普通文件/70本地化字段/三索引行干净，177项无关变化保留。源896-final严格259652行、schema9/92表、100项目文件及Git、229附件保全；原73967消费exit0、HTTP（Hypertext Transfer Protocol，超文本传输协议）关闭200、物理身份/输出/请求闭合、认证与完整模型目录配对副本退休；0模型请求/累计1260。原15条MissionRecord含两份本人896未执行草稿，后续全部保护。旧闪烁已修复，本轮不回溯。

已读896完整Recall/17图/资格/推送、当前根AGENTS；MissionBoard完整单一卡片树、preview排序/进度/受阻/草稿及唯一main绑定；MissionRecord子Task公开类型、TaskStatus/TaskBoard SDK（Software Development Kit，软件开发工具包）合同；现Button/Badge、mission-board CSS（Cascading Style Sheets，层叠样式表）；main的runUserNavigation/selectTaskWithUILifecycle/selectWorkLedgerTask及Ledger/Archive/Mailbox/App入口；task.selectTask完整归属/项目切换/加载/URL（Uniform Resource Locator，资源定位地址）/错误与SSE（Server-Sent Events，服务端事件流）生命周期，workspace请求选择归属；07-panel启动定位、Task精确读取、卡片/搜索合同和既有实际Task资源验收记录。全仓搜索onOpenTask/selectTaskWithUILifecycle/more_tasks定义及调用。未运行UI自动化，相关mission-lifecycle测试仅先前读过的传输正向合同，本轮不改。

## 修改前深度与影响分析

可观察线索：895/896真实图中子Task以状态徽标呈现，原完成/失败Task均有名字；当前源码证明整个子任务preview位于父Mission的Button内部，Badge本身是span，只有父onOpen，无Task导航回调。点击子任务文本只能进入父Mission，而用户无法从其显示名称直接查看对应执行记录。原搜索已覆盖全部子Task且优先呈现匹配项，但仍把可找到的子任务放在父按钮中，因此没有解决“找到后准确打开”。before须实际点击原741完成子任务文字、记录父Session定位和页面，确认此路径。

选择：将现三项Task preview从父打开按钮移到同一卡片的兄弟区域，使用现Button和Badge提供独立子Task入口。区域以本地化Child tasks/子任务说明，原始标题、生命周期状态与预览顺序继续来自原MissionRecord.tasks，不新增查询、排序、缓存、选中状态或业务投影。标题和状态/箭头分区，默认Board列中标题在上、状态/箭头在下；List中完整名称与状态/箭头同一宽行。移除旧Badge/span专用裁剪与List order样式，避免双套呈现。父卡片仍用原按钮打开父Mission；受阻Disclosure及草稿操作仍是独立兄弟，不嵌套按钮，不靠stopPropagation绕过错误点击归属。进度、失败数、剩余Task数和最多三项预览限制均不变。

Board新增onOpenTask(Task)唯一公开回调并从唯一卡片挂载传入；main直接用runUserNavigation包装现selectTaskWithUILifecycle(task.id, task.directory)。必须使用Task自己真实目录，禁止套用父Mission目录、标题/列表次序猜身份、构造旁路路由或绕过原未保存输入/选择epoch。共享导航继续拥有精确读取、项目切换、状态/模型投影、SSE、原Task URL、错误和现冷启动偏好；不新增流程、执行、配置或持久格式。返回现Tasks主导航时原Board/List、查询与项目仍由原页面owner（归属者）保留。

全部生产选择入口已核对：现App/onSelectTask、Mailbox、Ledger及Archive均经同一selectTaskWithUILifecycle，新增按钮只复用该入口，不改公共Task选择实现。未发现调度、队列、唤醒、恢复、并发或终态异常；如运行发生，必须立即按共享机制横向审计，不能把它归为本卡片特例。此改动仅补齐用户导航，没有启动/恢复Task或发模型请求。后台/API（Application Programming Interface，应用程序接口）/SDK/schema不变。

影响：MissionBoard/main的唯一props（属性）交接、卡片兄弟区与样式、两语言新增子任务区域/带原标题的打开名称、07-panel和三索引。原remainingTasks徽标仍表达未展示数量，不冒充全部列表或新操作。风险是按钮仍被父点击吞掉、目录错配、只打开了相似标题的其他Session、Task状态/父进度改变、搜索预览顺序丢失、看板窄列溢出和键盘不可达。必须用真实原TaskID/目录/根Session及URL/页面证据，禁止仅凭标题或DOM（Document Object Model，文档对象模型）文字判定打开成功。

## 实施与验收

首次before/after模型额度均0、75分钟共同绝对截止/5分钟闭合预留。本人CLI（Command Line Interface，命令行接口）38624/38625的`/ui/`，before复用896-final最终UI，after以Node.js构建本人私有目录，不单开Vite，不动用户18571或用户DB。源896-final单链继承，认证/完整模型目录配对验证/复制/退休，原15条Mission、全部旧数据库行、100项目文件及Git、229附件保全；只读原父子任务，不创建/编辑/删除/归档/恢复/开始或发送消息。

1. before公共reader完整15条，并以原741失败/完成子Task、801完成子Task和793未完成Task真实ID/目录读取TaskStatus，保留根Session及状态。真实页面点击原完成子Task文字，截图显示实际打开父Session。正常关闭本人页面、原服务句柄exit0/HTTP200/物理资源/配对副本/严格旧数据资格后改产品。
2. 单一卡片兄弟区Task按钮与原导航回调、对应两语言/样式/架构；类型、本地化/CSS/文档/Node构建。纯UI不新增、修改或运行UI自动化、组件/源码文案/DOM断言、快照或截图测试。
3. after真实List中鼠标/键盘分别打开原完成/失败子Task，核对准确TaskID、目录、根Session和原执行内容；返回原筛选并验证父打开动作。Board模式同样可打开原Task；从741切到801跨项目，验证原目标目录和内容；按实际情况只读打开793未完成Task。本人Task页刷新验证同一原定位，不刷新用户窗口。中英文截图与人工复核；公共15条Mission和原四Task状态/根Session精确核对，不能用模型执行或自动化冒充验收。
4. 正常关闭本人页面和服务，原exec消费0/HTTP200/原生身份输出请求/配对副本闭合、严格全旧数据资格；补齐证据、三索引和文档检查；清晰提交、fresh fetch/普通merge/完整待推集合/正常hook与push/fresh0/0；Goal保持active。

## 实页验收与排除

before原741完成Task文字点击后URL是父ses_-zUQiNDP0zzyyPiL2nvx/mission，01/02保留实证。原服务52367消费0/HTTP200/配对副本和物理资源闭合，严格259652→259654仅两租约/全部旧数据资格通过后才改产品。after真实main-DAgb7BYD.js的03独立按钮；04完成Task及原四份交付文件；05只刷新本人Task页仍是tsk_g00VZHd0gV00QEPVDCEU；06 Enter打开失败tsk_g00VZHd47u00r0Pa5iWM；07父按钮仍开原Mission；08英文Board同样能准确打开；09从741进入原801完成tsk_g00VZT7V7400TdQ2J6Sj，原counter.py/test_counter.py交付可见；10打开原793未完成tsk_g00VZRQQAP00yaqEnUZF；11/12按完成子Task名搜索优先显示该Task，原1/2比例及失败数保留。13中文Enter进入同一完成Task，14中文Board，15原受阻事项完整展开；16明确741项目+原子Task查询/List在往返后保留。全部16图人工查看，12/08保存原图另行查看。

公共TaskStatus给出四个原根Session：失败741 ses_-zUQiMvTYzzSrPyJpYL1、完成741 ses_-zUQiMz5bzzMH5K9ooZ0、完成801 ses_-zUQWsUi1zz5W6N1lPDO、未完成793 ses_-zUQYZZZfzzZxyo2Fspx。after启动和全部交互后，原15条MissionRecord及四份完整TaskStatus都逐字段等于before，包括根Session/状态/目录/验收和Task顺序。完成Task页面的真实data-task-id原只读观察亦与Task定位一致，未使用DOM断言。

运行输入审计最初错误地假定导航会单独GET /task/id/board；实际hydrateTaskConversation经hydrateConversation/conversationHydratePath调用/task/id/conversation，一次返回board和transcript。原请求日志与源码确认后，修复本地审计器并重新核对原路径，四Task实际conversation请求1/4/1/1次，均精确携带各自原Task目录；相关selection/events/goal读取也保持原Task身份。没有为工具假设添加产品兼容路线或重启验收。

10图原793有Idle标题及停止控件，已核对公开合同而非据标题推断故障：其原lifecycleStatus=active、activity=inactive；main busy使用现isTaskInterruptable，后者按Task active生命周期提供域级取消，onStop调用原cancelTask；07-panel明确Task/Mission保留域停止规则，不同于独立Chat的生成状态。完整前后TaskStatus相等、Provider请求0，无开始/恢复/取消操作或新执行异常证据。本轮不改这套共享语义，也不根据历史pending工具文字宣称当前调度异常。

本人193/194页关闭，原after服务65054消费exit0、HTTP200、settle原native/launcher及原生身份/输出/请求清理闭合，认证/完整模型目录副本配对退休。严格259654→259656仅两租约，两阶段全部旧行/100项目文件及Git/229附件、源DB及认证/目录元信息保全，9版92表未变；0模型请求/累计1260，沿首次截止退休余3481513ms，无重启续期加额。overlay类型、本地化2764键/2语言、CSS9085引用/402TS或TSX、文档352操作26组和Node构建exit0；保留既有大chunk提示。

纯UI不新增/修改/运行UI自动化。未开始/停止/恢复任务、发送消息或执行模型；数据中最多2子任务，不声明3项以上、父子目录不同、断线/错误/连接轮换、未保存输入冲突像素或其他页面/尺寸已覆盖。三索引仅本人行、两键四本地化字段和本轮普通文件范围提交，正常Git上游同步/待推集合/推送/fresh结果以本轮Git回执为准；Goal继续active。
