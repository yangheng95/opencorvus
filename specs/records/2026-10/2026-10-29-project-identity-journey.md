# 项目名称、侧栏和首页作用域

## Recall

用户要求持续单代理自主排查UI/UX与功能，直到明确停止；后续不用子agent覆盖旧Goal中的Astra文字。不重查已修Rendering、不建branch/worktree、不重启/刷新用户18571或窗口、只在实际无法安全判断的冲突等待。非简单工作先落spec及根因影响分析，真实开发/ui交互与原图人工复核，禁止UI自动化；必要正向非UI checker，范围commit、fresh fetch/merge/完整待推集审核及正常hooks/push。整体Goal保持active。

上一turn为progress：fe94a0f289b6d1d529dc8c034dd48dff19dfaf5a已正常推送，19:04:28Z fresh sync0/0、40自有文件收敛，保留177外部状态。修复已完成Goal详情清空下一创建草稿，28原图/中英文/真实暂停预算1→2→1及两个规范更新事件通过；旧103482行全部保留、当前103484行/schema9/integrity ok，五原文件保持。772两个实例公开200、exec/native/launcher0、三项结算/出生身份退休、catalog副本清退，模型0/累计767、190/191页关闭；原772截止不重开/续期。当前共享fe94包含另一用户benchmark3dec已推交付，0.1.36/37发布由另一个人类聊天处理，不纳入本批或创建Release/tag。

已读772 Recall/结果、07-panel Work Ledger/Project分组与当前首页合同；ProjectLedgerGroup header/menu、WorkLedger pin/reload、main.selectWorkLedgerProject/renameWorkLedgerProject、workspace.renameProjectRecord/closeProject入口、project-route-context及app-dialog共享host。全仓检索renameProjectRecord/onRenameProject/Home项目名定义和调用。重命名只改变Project记录显示名、不改workspace目录，侧栏使用projectDisplayName；Conversation.homeProjectName目前只读projectDirectoryLabel。名称是否在真实页面不一致仍未知，不能从代码推断直接改。Header折叠与项目选择在同入口，实际是否打断当前阅读待证；不预设改动。

## 调查与实施资格

从闭合772-after完整92表103484行备份、规范资源/namespace和当前普通Node构建，开发serve /ui。使用真实已存在、无活动执行的QA项目stream-stop-755/project及必要对照项目source-group-752/project，源原件只读。实际项目header选择/首页、同组菜单重命名、取消/确认、侧栏/搜索/首页显示、项目置顶/解除、现有会话返回、可逆Close project和搜索重开；双语与键盘/焦点。所有metadata写入仅自有隔离数据库，原workspace路径/项目源文件不改。永久Delete、Promotion搬目录和用户18571不在本批动作内。若原name为空，UI不能精确恢复空名时保留真实修改并如实列出，不改SQL制造恢复。

先实页观察，发现问题再补可观察现象、触发、控制/数据流根因、旧路径未治原因、全部定义/调用/同语义/公共契约、数据、测试、文档交付与风险。初始不修改API/SDK/数据库迁移或Provider；无认证只读实例的模型不可用提示不是凭据或目录故障。任何调度/队列/唤醒/恢复/并发/终态异常按全部Task/Mission/Session轮次及所有入口、正常/终态、重试重启、串并行、多项目横审，不据单一场景降级。纯UI禁止自动化测试；非UI契约变更须聚焦正向原checker，类型/build/docs不代替视觉。

## 有限资源与交付

773首次启动前固定60分钟原生绝对截止，必要改后实例沿同一期限；每实例15分钟预定公开正常shutdown、至少5分钟收拢余量。基线38307/必要改后38308，独立run/bundle/IAB页，无auth复制、完整catalog用于历史投影、Provider上限0/累计767。观察超时轮询同一原handle及精确出生身份，不据此重开；结束公开200、原exec/native/launcher0、物理输出请求三项结算和出生链退休后才清退副本。核对全部旧行及预期Project名称/时间/pin变化、源库、schema9/integrity、五原QA输入、源auth/catalog metadata与catalog字节。

全部方案/原图/非秘密回执在specs，根/月/artifact索引和当前docs检查同步；范围提交、fresh fetch/merge/完整待推全集审查及正常hooks/push，保留其他聊天暂存和发布/benchmark改动。不创建新版本/tag/Release/PR，不声明单批等于全产品完成。

## 基线实证、完整根因与首阶段实施

38307/192，图01–04人工查看：原首页project，真实Rename对话框明确只改显示名、不改目录；输入项目体验773并确认。19:13:23.896Z PATCH /project/current实际400/13ms，request926267ba-96b7-4bc5-8170-21db99854c43，config.validate.models→project.open失败ProviderModelNotFoundError(openai/gpt-6.1-sol)，原Project.name仍null/time_updated未变。没有Provider实际请求。运行配置不可用是执行环境条件，重命名被它阻止是错误依赖；完整catalog在位，不把此错误误报为目录缺失。当前runMainAsync/reportError仅写诊断日志，因此该失败画面没有原位反馈，不声称已经成功。

同一项目键盘Pin成功，图05分入Pinned，操作后焦点落AX根。尝试取消置顶的第一次Tab/Enter打开了Organize sidebar，随后PW语义定位未匹配；此时实例已按预定15分钟正常shutdown，不据此判定永久缺少Unpin。pin后的焦点与当前键盘入口须在改后新scope复核。192关闭，原15216/native/launcher0、公开200与三项/精确身份结算，catalog退休、余2693623ms；目标暂时保持真实pinned，源项目/源数据库未变。不重开基线。

直接根因为projectRouteContextKind只将worktrees等路径列为identity，GET/PATCH /project/current落默认runtime，Server在ProjectRoutes前进入InstanceBootstrap的模型校验，纯名称事务尚未执行就失败。同语义project pin/global list和Chat/Work rename已经是metadata/identity路径，旧修复遗漏Project自身名称。PATCH handler在Project.update后还await Instance.refresh，后者明确是teardown-grade、先cancel background再drain serving leases；仅改显示名不需改变Git身份/配置/能力，这段刷新还把纯metadata操作耦合到Task/Mission/Session持有的运行期生命周期。

横审现Instance.refresh全部生产直接调用：改前为current-name及通用Project properties两个handler；本批只移除name-only的刷新，通用properties包含commands，保留runtime和完整refresh。init-git本来是identity并在Git创建后dispose，保持原合同。Task/Mission/Session正常/终态、恢复/重试及串并行的执行身份来自Project ID/generation/worktree与现lease，不来自name，均不更改。所有当前动态name读取全仓检索仅/project/current和gateway.stats使用Instance.project快照，二者改用原Project.get读取同一规范DB metadata；插件baseInput.project是加载时快照，旧refresh快路径applyContext本来替换Context.project而不更新该已捕获引用，不改变插件契约。真实Project删除/晋升仍受原identity admission与持久fence约束；不同Project由原目录scope决定，不扩global路由旁路。

实施：当前GET/PATCH加入唯一identity分类；GET current和Gateway stats按当前leased Project ID读取Project.get，缺失以现NotFoundError明确404，声明其公开错误；PATCH使用原Project.update及project.updated事实直接返回，删除name-only Instance.refresh，不新增cache/metadata writer/备用路径。Project.id/worktree/sandboxes/generation及命令/配置均保持。正向测试走真实Server.App路由、不可执行model配置、两Project及在途identity serving lease下GET/PATCH、持久名称/事件和保留owner事实；重启dispose后按规范数据重新读取。新404需要同步唯一SDK/双语API文档并跑原OpenAPI检查，不能只改类型绕过。

当前成功重命名后的Home别名仍缺实证，首改后实际确认，再完整分析/修改其当前唯一名称投影；不凭代码预设已修。元数据失败后的通用日志反馈与Pin焦点另以真实新scope验证，不把已正常结束的旧页当故障。无schema迁移、无模型请求或新增执行调度分支，余下scope沿同一20:10:15.297Z绝对截止与0额度。
补充精确横审：`Instance.refresh()`生产直接调用在本改前为两个Project handler：current-name与通用`PATCH /:projectID`。通用properties包含commands，仍保留runtime及refresh；init-git本来是identity并在Git创建后dispose，不是refresh直接调用。初版分类测试将init-git误写runtime，真实checker明确identity而失败；已按真实现行契约改为通用properties的runtime正向断言。Project.initGit旧注释中的“两个调用refresh”不是当前调用证据，本批不扩大为该无关注释清理。首个真实Server测试已通过：持有identity serving lease时重命名/读取、两个Project隔离、规范事件、明确400和dispose后重读。
## 成功重命名后的首页名称根因与UI实施

改后38308真实PATCH已200（最终日志/持久状态待结束归档）；图06实看侧栏项目体验773、首页Let's work on project。直接触发为Conversation.homeProjectName始终projectDirectoryLabel(directory)，省略规范Project.name。sidebar ProjectLedgerGroup已通过projectDisplayName正确消费Work Ledger的Project行。work-ledger服务现runtimeRows只保留非Project行，另存目录数组，导致首页拿不到同一现行投影。此次将现runtimeRows统一保留全部WorkLedgerRow，并由该Map派生Project行/目录，移除平行目录数组；新增只读workLedgerProject(directory)，依现projectDirectoryKey匹配。首页调用现projectDisplayName并使用该Project行的title（即规范Project.name的现行投影），缺省名字仍按原目录标签合同。相同current loadedRows刷新/authority/retire机制，无新HTTP请求、缓存writer、SQL迁移、Provider行为或公共API。复查WorkLedger.reload发现其do/while会读取全部nextCursor后一次发布loadedRows；界面的前十组只是ProgressiveList呈现，不会截断服务内Project名称事实。加载完成前沿原缺省标签合同，未新增独立拉取或名称缓存。当前所选项目实证已在投影中。所有服务调用点已搜索，runtime task/session lookup保持各自kind约束，Project展示不影响调度/Owner/预算/持久事实。纯UI不写/运行测试，以后实例实际改名、搜索、置顶/解除、中英文截图及close/reopen验收。用户当前18571不改。

## 实际验收与交付复核

最终38309 /ui为普通build main-sidzO0nv.js。16原图均已呈现人工查看：重开中文名显示一致；再改Project journey 773真实200/8ms，sidebar与Home同步；后端阶段200/9ms；解除pin恢复未置顶。File→Close project返回无目录首页、仍保留侧栏项目，点击同一项目恢复名称；中文界面不翻译英文原名，恢复English并保持空输入区。命令搜索仅Chats/work/commands，当前Project行被既有转换排除，按新名查询0候选；没有宣称搜索重开已实现，实际从侧栏重开。取消/空名UI、全部执行中调度、Gateway真实执行环境与非桌面矩阵未操作。

正式isolated checker最终14 route classification +1真实Server测试通过；持有真实identity serving lease时两个项目GET/PATCH成功、规范events与dispose重开保留。后端/前端typecheck、最终普通build/renderer、SDK正式事务生成、6条OpenAPI规则36route文件、351ops/26groups双语API生成、2614键语言检查均0；最初两个错误（测试误判init-git、UI读取name而非title）已由真实checker发现并纠正。work-ledger-notification-stream.test.ts检索到后确认是纯transport服务测试，无DOM/render/源码文案，不运行或修改。

三个实例共用原20:10:15.297Z截止，各自公开shutdown200、原exec15216/38739/50245与native/launcher0、物理/输出/请求完整结算及精确出生链退休；catalog副本已清退，最少剩1476514ms，0模型/累计767、未复制auth。92表103484原行全部存在；每库仅目标Project一行按真实name/time_updated/time_pinned变动，其余103483行逐行相同；三个源数据库完整行保持、schema9/integrity ok。五原QA文件字节/metadata、附件三namespace字节保持。无schema升级、无新增Session/Message/Goal/执行事件，用户18571未操作。

当前批解决纯名称修改的错误执行初始化/teardown依赖和Home漏用名称两项根因。通用失败原位反馈、跨组pin焦点和按项目名搜索属于后续持续体验项，不声明全产品完成。完整原图、请求、数据、checks与三实例结算在对应artifact入口；范围commit和fresh fetch/merge/正常hooks及push待交付回执。
