# 默认页、保存任务与启动项目

## Recall

用户要求持续自主排查完整UI（User Interface，用户界面）和功能、真实体验后提交推送；明确不只修Sources或旧闪烁问题。后续反复要求只用本人一个agent、不操作正在使用的窗口，覆盖旧Goal的三个Astra文字。原OpenAI热认证和配对完整模型目录使用已授权，874按现有Owner刷新成功。本轮继续默认页与工作切换，不操作18571或其他用户进程。

上一轮属于progress：26f478149正常推送，fresh fetch/merge后HEAD=origin/main、0/0；原生表格阅读和列对齐、21张真实页面原图、三阶段完整旧数据资格完成。全局持续Goal仍active。本轮开始177条无关删除/索引及未跟踪目录保留，产品文件无未提交改动。

已读876 Recall/结果，当前07-panel启动/网址/Task身份合同、05-config工作区指针，init/main、board全局任务分页、Task选择与保存、Conversation选择/applyDirectory、host settings/browser storage入口。定义/调用搜索覆盖initialRestoreTaskID、workspaceTaskID/workspaceDirectory、workspaceRestoreDirectory、restoreInitialWorkspace/Location、createInitialDirectoryResolver与同语义初始任务选择；packages/script/current/records中picker仅init内部调用，没有找到其自动化测试。此前875实际根页曾先显示启动项目Home后进入旧Task793；这只是线索，需本轮实页和实际保存状态证实。

## 修改前根因与影响调查

- 当前数据流：init先解析原URL；显式Task/Session/Mission/launcher由原导航owner恢复并消费启动意图。无定位符时loadInitialData发现默认目录并加载global/tasks首屏，随后restoreInitialWorkspace读取host保存的Task指针与目录。
- 已证代码触发点：board.taskListPagePath读取不带项目过滤的global/tasks；initialRestoreTaskID先在这一页找保存ID，否则默认选第一个active Task。restoreTaskSelection本身已有global/tasks?taskID=...&limit=1精确读取和完整目录归属。故空指针会挑另一项目的活动Task，保存ID被分页遮住时也无法到达已有精确reader；实页/数据仍待本轮核实。
- 旧路径：该picker保留了旧的自动进入活动任务策略；当前架构只声明无URL时恢复实际保存偏好，没有声明从活动列表发明导航意图。已有显式Task URL修复独立于这一列表预选步骤，未覆盖保存指针分页问题。
- 相关合同：保留真实保存Task/Project指针、URL优先、显式launcher创建意图、首次离线后恢复、用户新选择优先、重连当前工作区、无效/失败定位的现有可见诊断。Task列表状态不是用户选择或任务存在性的事实来源。持久字段/结构不变，不需要schema（结构）迁移；不改Host设置事务、Task/Mission/Session执行、队列/恢复/调度或模型工具。发现真实调度异常则立即按共享机制全入口横审，不能从旧Task标题或logical active状态直接推断调度错误。
- 风险：空指针默认页、保存ID分页/归档、已有Task恢复、精确资源错误、显式Session/launcher/Task与重连都受入口策略影响，须各自用真实入口核对；不能仅以源码删除或构建证明效果。Scope内旧Task注释仍称localStorage，但保存实际走host事务，实施时同步更正这段相关解释。
- 验收不新增/运行任何UI自动化，包括初始化/文案/DOM/组件测试。当前检索只看到设置事务/归属/数据解析测试，没有发现picker测试；不无目标运行。若改动落在非UI协议须增加聚焦正向合同测试，本轮预计仅删除UI列表预选、直接使用既有身份reader。

## 首次资源与验收设计

从已闭合合格876-alignment-after复制：schema9/92表、255253行、原98项目与227附件、累计1249真实请求；实际计数准备时读取。before复用已真实构建并交付的main-D9X9cQOM.js及原回执，after重新构建。配对认证与完整模型目录分别验证，内容不进入日志/规格/Git。before首次0请求，after首次16个精确openai/gpt-6.1-sol流式请求，共用prepare前声明75分钟绝对截止，保留5分钟正常闭合，不提升live额度、不重启旧occurrence（执行轮次）或延长截止。

先在本人全新项目根页复现空保存状态的实际去向，并选择真实既有、位于首屏之外的Task，经正常UI保存后在同origin新根页冷启动，保留前后证据。实施方案须在实测后补齐、先落盘再改产品。后测默认Home、Goal入口、保存Task精确恢复、显式Session/launcher及定位错误；需要时由默认Home为本人新项目创建一个有限持续目标，真实Sol读取两份明确合成源文件、生成和回读结果，核对实际Session/Goal/目录与来源，不创建其他agent或Task，不以夹具或DOM断言冒充端到端。

本轮旧数据、所有项目业务文件/Git和附件完整保护，不触碰真实用户DB；新QA项目允许产生正常数据。每阶段原native句柄0、public shutdown200、出生身份与物理/输出/请求结清、配对副本退休、完整资格。真实CLI `/ui/`独立后台桌面页面，截图本人视觉复核。规格/产物三索引及现有docs:check同步，main范围提交、fresh fetch/普通merge、完整待推送集合及正常hook推送，不创建branch/worktree/release。持续Goal保持active。

## 准备期事实修正

真实global/tasks及SQLite engine_task均只有8个Task，低于首屏10个，801也在首屏；不能伪称已复现分页遮挡。首次只读调查脚本错误地要求801在首屏之外而退出，未产生任何任务/模型调用；已修正为记录实际可见性，保留原失败。不为凑数创建11个无业务Task、复制用户真实库或伪造历史。分页风险由picker代码证明，最终入口必须去掉列表预选并实际进入已有按ID精确reader；真实UI验收覆盖8条既有数据下的空指针Home、正常保存恢复及显式定位，分页数据规模边界如实保留。空指针通过正常选择本人项目Home并保存，再访问同origin根页复现，不用注入localStorage或伪造UI状态。

## 实页根因与最终实施方案（产品修改前）

01–03实页已确认：根页最初为startup-selection-877-before Home，随后URL变为taskID=tsk_g00VZRQQAP00yaqEnUZF、显示另一个项目793和Base/Stop。正常点击本人项目后，根URL清空定位符、Home与Goal入口出现；再次刷新自己的根页，仍进入同一个793。当前global/tasks原记录该Task为唯一active，实际目录为review-handoff-793/project，与CLI明确启动的当前项目不同。正常选择项目的既有applyDirectory已清空并保存workspaceTaskID/workspaceDirectory，因此这次不是从隐藏存储猜空指针。04–05以真实801显式URL和随后根页保留同一已保存Task，作为需保留的正向对照。本阶段没有Provider请求或执行启动。

直接根因是init内部picker把运行状态当导航意图；global/tasks首屏只是全局展示投影。最终删除该picker及其仅有的状态/ID抽取辅助和active集合，restoreInitialWorkspace直接取已规范化workspaceTaskID，通过原restoreTaskSelection的按ID全局reader恢复；空指针继续当前项目Home。保留原目录偏好、URL优先/epoch、失败诊断、重连和真实Task选择保存owner，不新增状态或兼容分支，不改持久化字段/schema。无保存ID时后置条件中的workspaceTaskID检查也随已证明的不可达条件移除；现有清空残留Task投影分支保留。Task保存的相关注释改为host设置/精确身份解释，删去旧localStorage说法。

先正常闭合before，再修改上述init/task注释与07-panel/05-config合同；after新构建、全新项目与原已声明16请求。实页重做空指针Home刷新、已有801保存/根页、显式Session/launcher与定位失败，并从实际Home开始有限Goal。真实checker核对新Goal/Session归属、两源/结果回读与实际Sol流式模型，保护所有旧数据；当前8条资料的分页规模边界仍明确保留。用户UI入口修复不改变Task运行状态，历史793的active/旧过期问题没有触发新的调度，不以标题或最后错误诊断调度问题。

## 实施与真实验收结果

已删除列表picker及其唯一辅助，保存ID直接进入既有全局精确reader；未新增状态、持久字段、后备路径或数据库迁移。Task保存注释与05/07架构同步。

06–14：新版根页保持本人当前项目Home，正常选择后刷新仍保持Home；显式801及随后无定位根页恢复同一原始Task；显式launcher刷新保持创建意图；875既有真实Session恢复原内容和项目；不可用Task定位显示原有错误，英文与中文均实际查看。通过正常设置选择中文、正常项目入口返回后根页刷新，Goal入口持续可见。没有注入浏览器存储或为凑分页样本修改原Task数据。

15–19：从本人Home选择精确openai/gpt-6.1-sol，先声明自动轮次12与已有Provider上限16，再由实际按钮开始有限Goal。实际Session为ses_-zUQFZJOAzzdBf6RDQ2v，Goal为pev_g0VZkQgjy00kTMNnWU1p，公共接口确认complete、会话idle、接收1自动轮次；11次实际模型请求均200、流式且源reader以EOF结清。真实工具完成两源读取、目录读取/查找、写入、结果回读、两源复核、Goal读取与更新。实际业务checker逐字核对原源文件、22行result.md中的项目/877-after标记、4个行动项、3位责任人和2/1/1分布、原始CSV全文、真实结果回读和5个来源的工具归属。当前项目只有1个根Session、全库仍8个原Task。原图17/18显示完成状态与详情，19实际点开结果来源，预览正确显示表格、数字右对齐和原始行动项，未改变用户窗口。

原before与after分别0、11请求；累计1260。两次public shutdown均200、原native句柄37666/44714均exit0，出生身份、物理退出、输出和请求均结清，4份配对认证/模型目录副本退休。before255253→255258行、保护98原项目；after255258→258659行、保护99原项目；92表schema9未变，完整旧业务行、项目业务文件/Git、227附件、源数据库和原认证/模型目录资格通过。after仅一条运行容量槽被本人执行重新取得并正常释放，原过期时间、本人出生时间/owner和终态释放均核实；不以此豁免业务数据。闭合保留3058566毫秒，未重启occurrence、提高额度或延长截止。

Node实际Vite构建main-CWKdLhpS.js、Overlay类型检查、2715项语言检查、60文件/401颜色代码检查、352规格/26架构文档检查通过。未新增或运行UI自动化测试。关闭调用首次误用Windows PowerShell5，出生身份观察器的ArgumentList不可用，尚未发送shutdown；改用原运行器所需PowerShell7后原服务正常200/exit0，保留两次真实回执。准备期分页断言错误亦已保留，不能算应用故障或通过证据。

边界：资料只有8个Task，超过首屏10条与归档遮挡的实页规模验收未达成；删除列表依赖由调用链证明，但不得将它宣称为已复现的大规模UI验收。旧定位失败后的网络重连为保留路径，本轮未人为断开服务模拟重连。此次不改Task/Mission/Session调度、Provider认证协议、原旧Task状态或schema。

本次实页同时发现get_continuous_goal/update_continuous_goal仍显示原技术名；875标签目录使用了另一组未对应真实工具声明的名称。留待下一轮先全仓核对声明、投影、同语义显示与公共合同，再修改并以本次真实数据验收，避免混入未实际构建验证的代码。

19张真实截图、手动操作和非敏感资格见[证据](../../artifacts/2026-11-02-startup-selection/README.md)。提交推送以原始Git/hook结束回执与随后fresh同步为准，不提前宣称成功。持续迭代Goal保持active。
