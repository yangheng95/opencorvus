# 持续目标读取的项目权限范围

## Recall

498持续单agent，不委托，旧goal三Astra指示由后续人工单agent要求覆盖。上一turn为progress：497真实同owner正文49→1的分帧截断已以c1b5a7ca792cfb22d11cc1d156772345111fbd86修复、正常push/fresh HEAD=upstream；15图、原格式失败、10/16实际Sol与两原native/source-reader结算保留。所有临时auth/models副本已退休。完整配置原149目录保存10秒/恢复5秒仍未达，不因局部UI通过改长期Goal。开始status仅原.bun/及packages/opencorvus/bun/。

用户要求继续自主找问题、改善UI/功能、Sources与成员Rendering优先，最新“Goal完全看不到怎么用、默认布局怪”和授权内置浏览器调试仍适用。已读497 Recall/验收、continuous-goal当前架构、07-panel-reactivity，ConversationCard/ChatBubble/CardParts/SubagentConversationPanel/subagent-conversation/text-part-model/markdown-render、GoalGroup/GoalDialogHost/Board/TaskProgressBar/RightDock/TaskDirBar与中英文词条；全仓搜索task_scope.goals/progress.heading/goal.*调用和既有首页入口方案。沿已应用benchmark-debug-template/computer-use，不使用子agent。

## 修改前分析

497最后一个setter日志streaming=true不能证明完成状态停留：后续非流式结果如果与当前HTML完全相同，mount仅结束pending而不再调用setter；worker仍可保存完整结果。撤下这条未经证明的根因，不据此补丁。

当前有直接语义冲突：continuous-goal架构明确其跨轮次授权与Delivery Slice合同不同；但RightDock工具/标签和TaskDirBar复用task_scope.goals=Goals/目标，TaskProgressBar标题progress.heading也叫Goals/目标。GoalGroup实际展示deliverySliceID、objective、acceptance和review，GoalsBoardPanel空态只说尚未生成目标；GoalDialogHost同样只叫Goal/目标。用户寻找持续工作入口时，这个面板没有解释自己的含义，也没有区分会话顶部的持续目标。源码与公共数据流已确认两者不是同一能力；真实页面及拥挤程度仍待before截图，不先修改。

根因候选是跨能力共用同一个无修饰产品称谓及缺少面板职责说明，不是缺少后端Goal功能。此前Home创建/How修复只覆盖首页/会话控件，未触及交付合同的侧栏命名。受影响为右侧工具选择、已开tab、Task目录菜单/进度、编辑对话框及相关空态与无障碍名称。英文和中文要同步，保留用户/模型原始交付标题、技术标识与已有API/ID（Application Programming Interface，应用程序接口；Identifier，标识）不重命名。模型/调度/数据库/schema/权限均不改；没有已证实的队列/恢复/终态异常。如发现此类异常仍按AGENTS全入口Task/Mission/Session执行轮次横审。

## 实施前方案

1. 使用已物理结束497-after的完整真实QA（Quality Assurance，质量验收）库和完整5键配置作为只读源；先验证原native物理/output/request/launcher终态，SQLite serialize到新的498 before/after，不清空/伪造事实。记录全部应用表（包含原rowid）与完整schema/integrity、源bytes/mtime；不只保留少量夹具。源完整配对凭据已退休，本批不复制auth/models、不预检Provider、不创建模型输入，模型请求预算0。
2. 新18879/18881 Source CLI开发/ui，原487无模型serve、413 owned-host/446 native、20分钟自有资源边界。before完整UI复制497正式dist-vite（无诊断）；before公开shutdown和原handle/native结算后才改UI。after重建正式Vite完整资源进独立bundle。只操作内置浏览器2自有隐藏页，不重启用户18571/进程/窗口，不新branch/worktree。
3. 实际手动打开右侧Goals、会话顶部Continuous goal及Home指南，查看中英文与实际Task交付列表/进度。截图人工复核当前名词和是否能判断各入口用途。若确认冲突，既有locale key内容统一用Deliverables/交付成果，编辑单个用Deliverable/交付成果；面板增加简短职责/持续目标入口提示，复用既有正文primitive，不增业务状态或平行创建入口。实际范围以before证据补充为准。
4. TaskProgressBar现有无标题fallback硬编码Goal N已在触及路径发现，改为同一i18n（Internationalization，国际化）单数词条与本地化数字；用户/模型真实title保持。查全同语义文案并统一产品标签，不更改模型原始消息、工具名、路由、配置或持久ID。纯UI不新增/运行UI自动化/DOM（Document Object Model，文档对象模型）/组件/文案/快照/截图基线测试；实际桌面页面与截图是验收。
5. after真实正式页面复核Home、交付面板空/有数据、菜单/标签/进度、中英文和持续目标创建/取消；仅打开/取消不创建Session。类型、i18n与正式build、文档检查为补充，不替代视觉。未获取的场景明确未达，不伪造交付标题或执行LLM请求制造截图。
6. 原服务public shutdown/原handle exit及native物理/output/request/launcher/exact出生终态；源全量事实/字段/时间/rowid/bytes/mtime和完整canonical复核。只归档非秘密原证据，三索引/docs同步，范围commit、fresh fetch/merge、完整pending审查、正常push/fresh相等。版本不变，不发布/tag/PR（Pull Request，拉取请求），长期Goal active。

## Before 发现的真实读取故障与范围调整

原38166/18879是正式c1 UI+Source CLI、无凭据/无models/无新模型输入；完整497-after源90表131156行、150Project/199Session/schema3与原5键canonical全部复制。模型配置引用Sol但该隔离环境没有可运行的投影，正是有效的“当前模型不可用、仍需查看已有数据”条件。原68页面历史正文可读，并明确显示Model configuration unavailable；但顶端Continuous goal额外报request failed。实际GET /continuous-goal/chat/ses_-zUS0X33CzzWEKMgCk98返回400 ProviderModelNotFoundError，原body/时间与截图01保留。这不能只当模型未配置而忽略数据读取的能力缺口，也不能据它伪称当前用户授权不可用。

共享权限链已确认：server.ts的唯一project middleware依据projectRouteContextKind选择persisted、identity或runtime；现有GET Session conversation/message/history/events和file/data读走identity，continuous-goal GET没有列入，落入runtime，执行InstanceBootstrap的config.validate。candidate model validation按现有合同在模型不可用时返回该400，发生在真实Goal store读取前。continuous-goal GET本身只resolveGoalOwner/readContinuousGoal，仅读原Project/Session/Task/Mission/Goal协议与usage，未请求模型或启动执行。既有Project identity提供同一Instance.project/directory，保留真实跨Project归属及删除/归档校验。这条遗漏才是当前修复目标，导航称谓改进暂不实施，不混入本批。

横向审计：3种公开owner GET共享同一只读handler/store；POST/PATCH仍需runtime做当前配置/执行能力校验。数据架构与公共400/409身份、GET方法之外的权限分类不变，执行入口Session prompt/Task/Mission admission仍走原runtime。background continuous-goal.reconcile每秒从active intent行选择目录，原源一条turnBudget1/已接受1的记录仍触发project.open config.validate失败；失败发生在reconcileContinuousGoal/continuation admission之前。此路径必须与界面读取区分：本批GET修复不会改变调度、预算、恢复、重试、串并行或多Project执行权限，也不声称解决这条无可用模型配置下的重复初始化。所有Task/Mission/Session执行仍受相同Project model validation和原执行轮次/终态合同约束，原历史保留。后续需要单独审计Controller外层目录筛选与已达预算的无效初始化，不能以本批读取通过降级该问题。

实施只在共享PROJECT_IDENTITY_CONVERSATION_ROUTE_PATTERNS加入GET /continuous-goal/(chat|task|mission)/:ownerID精确模式；不在handler另加数据读取实现或try/catch fallback，不改创建/更新能力，不教LLM选择流程。全仓定义/调用/同语义和当前readiness/provider/config架构已核对；当前测试project-route-context.test.ts都是正向权限映射，新增三kind的read=identity/create=runtime/update=runtime映射。实服务checker在原完整无模型投影条件验证GET返回当前持久Goal/null、准确owner错误与原model-config错误；UI必须实际呈现顶部控件/已有Goal详情，同时原模型不可用提示保持。

before已公开shutdown200、原38166 exit0、原native physical/output/request/launcher/exact出生终态后才改源码。after18881沿相同完整源、canonical与无凭据/无models条件，继续预算0；UI未修改，直接使用已验证正式c1资源，不必重建前端。after新serve/原native20分钟监管与真实页面/截图，聚焦非UI测试、backend类型/docs/normal hooks。所有原数据/模型不变，不通过删配置、改default model、复制凭据或放宽执行校验让验收通过。

## 实施与真实验收

生产仅在共享路由分类器增加一条三owner的GET模式；对应当前架构同步读取权限合同。聚焦正向测试验证三kind的GET=identity、POST/PATCH=runtime；原11项测试/17项expect通过，包含真实OpenAPI（OpenAPI Specification，开放接口规范）命名409合同。原52132 exit0、backend typecheck原18960 exit0。没有UI自动化测试，没有前端代码变化或新前端构建。

真实Source CLI（Command Line Interface，命令行接口）18881六项HTTP（Hypertext Transfer Protocol，超文本传输协议）检查通过：同一空Chat由400变为200/null；实际持久Chat返回budget_limited与37196/100000 tokens、1/1轮；实际Task与Mission均返回complete。原Chat owner置于真实其他Project返回409 ContinuousGoalError/owner_unavailable；原Session config运行时仍返回400 ProviderModelNotFoundError，provider/model仍为openai/gpt-6.1-sol。读取恢复不改变创建、更新或执行授权。没有发起模型输入、复制凭据或投影models。

五张实际1280×720截图均人工查看并归档：01是修改前“历史正文可读而Goal失败”，文件名unqualified保留原命名，但无可用模型是有效的只读场景；02是同一Chat修复后Create控件可见，底部模型不可用提示仍准确显示。03是验收者误把真实experience=chat的owner构造成experience=work而进入404/Could not open workspace link，不能计作Goal成功或产品缺陷。查原metadata后使用准确chat路由，04显示实际旧Goal预算状态和用量，05打开Details显示原objective、预算和用量；仅查看/关闭，没有保存、恢复或完成Goal。自有68/69页均已关闭，用户进程/窗口未操作。

before原38166和after原51039均public shutdown200、原handle exit0；native监管进程/目标的原出生身份均已结束，physicalCompletion/outputDrainComplete/requestCleanupComplete以及launcher结算完整。after收尾后重新运行全量数据检查：90表131156原行的所有字段、时间、rowid/主键均相等，差异0；源原始60751872字节与mtime、完整5键canonical、实际schema对象和user_version=3、integrity均保持。原Provider activity321→321。未清库、未升级schema、未碰真实用户库。

保留验证工具首轮失败：JSON保存Uint8Array（二进制字节数组）后变为数字键对象，直接与原生BLOB（Binary Large Object，二进制大对象）比较失败。修复检查器的序列化表示比较，同时源/clone原生typed数据继续逐字段比较真实字节；没有改库或用哈希代替功能与数据验收。原失败preserve-binary-001.log和修复后原检查均保留。

非秘密证据、复现脚本、截图与六项实服务结果见[产物](../../artifacts/2026-10-21-goal-read-project-authority/README.md)。原私有全库行JSON、数据库、原始运行历史不提交。归档脚本保留最初goal-deliverable-navigation-498工作目录身份，不能误认本轮已实施交付面板改名。

三索引已同步，当前docs:check通过（345 operations/26 groups）。实际当前凭据值扫描覆盖本批私有文本、脚本、日志和归档/记录/索引，共81文件96200278字节、匹配0；仅安全扫描，不输出或使用凭据发请求。源无凭据副本，本轮0模型输入。

## 交付边界与下一项

本轮只解决“模型/运行配置不可用时仍能读取持久Goal”。后台Controller每秒选择active intent目录并尝试完整初始化的问题仍未修复，已到turnBudget的Goal也在外层候选集合；不能用三类读取通过声称调度/恢复/并发收敛通过。下一轮必须继续共享入口、执行轮次、预算、终态、重试/重启、串并行及多Project隔离审计。交付成果与持续目标的命名冲突尚未改，原149目录完整配置保存10秒/恢复5秒指标仍未达，成员Rendering当前批无新流验收，长期Goal继续active。版本未变，不创建tag/Release/PR。
