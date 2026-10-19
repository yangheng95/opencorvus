# 工作区链接读取失败的启动收敛

## Recall

用户持续要求单agent自主迭代、优先Sources/成员Rendering、真实桌面体验后提交推送。最近push要求已完成：283892c54与origin/main一致，上一goal turn为progress。当前仅原有.bun与packages/opencorvus/bun未跟踪，保留。最新单agent要求覆盖goal旧Astra文字，不委派。不得动用户18571服务/页面、清库、改已交付迁移、创建branch/worktree或发布。本轮先复核430尚未资格的“合法URL但目标不存在”错误路径，不以改标题替代实证修复。

## 修改前调查与影响分析

已读431/430 Recall、AGENTS、07-panel/07-panel-reactivity，initApp/loadInitialData/restoreInitialWorkspaceLocation/restoreInitialWorkspace、workspace-location唯一parser/formatter、main restoreClientLocation及Task/Chat/Mission导航、workspace admission/selectEpoch、conversation-session与task真实错误退休、App Feedback、connection monitor。全仓搜索其定义、调用点、同语义错误呈现与当前测试。当前代码显示：parser的WorkspaceLocationError被捕获并存入workspaceLocationError；随后的await restoreInitialWorkspaceLocation位于startConnectionMonitor之前且无局部catch。真实resource读取出错能越过reconcileCapabilities、onConnected和monitor启动，只由main顶层运行时日志接住。旧430仅修链接语法错误，未根治资源读取失败。

可观察页面症状和实际HTTP错误尚待独立页面复现，不凭代码推测声称已复现。范围包括Task显式ID、Chat/Work及Mission Session、无显式URL的原Task偏好恢复、正常选择/失败/后续选择、API authority与选择epoch变更。后端Task/Mission/Session执行轮次、排队、唤醒、重启恢复没有异常证据，本轮不改执行机制、数据库、Provider或持久格式。客户端启动恢复与连接探测共用流程需要横向核对，不能把所有目标失败都包装为格式错误或自动改选另一个会话。

当前检索到workspace-admission、connection-startup-diagnostics等测试文件，须先读内容判定是否UI自动化；不运行本轮检索到的DOM/组件/选择投影测试，符合禁令的现存UI自动化及其独占材料随触及范围删除。纯协议/物理文件错误映射测试不因文件名被误删。不会新增UI自动化、源码文案断言或mock端到端。

## 实施前方案

1. 使用原412自有QA runtime历史，正式Node Vite构建经唯一preparePackageBuildEnvironment绑定仓库.scratch/package-runtime；两次不可变publication和独立NativeService scope（18603 before/18605 after），各600秒总限、180秒无活动、最多12累计真实流请求。复用既有413生产ProcessFacade/native/shutdown wrapper；如复制Provider凭据，完整绑定auth/models并真实确认gpt-6.1-sol预检，之后不发送业务输入。
2. 在独立IAB页打开原真实Work Session，再通过合法定位参数访问一个不存在的Session/Mission（只读请求，不造消息或数据库行），记录页面、实际网络/console和原错误。人工确认正常侧边栏操作、Sources仍可恢复；不刷新用户页面。不以HTTP/DOM文字代替真实截图。
3. 证实根因后补实施决定：保留原错误及唯一workspaceLocationError诊断面，启动的目标选择失败不得阻断独立连接监测/能力加载；错误不得晚到覆盖新authority/新选择。不fallback、自动改选、清除真实来源或吞掉无法归属的错误。复核Task/Chat/Mission及无显式URL恢复共享入口；任何新增公共契约先全仓核对。
4. 正式构建after，在真实页面复验错误摘要/Details、后续正常会话选择与Sources、正常reload。需要的UI改动只用真实交互/截图人工验收；检查不代替视觉证据。若未证实当前缺陷，记录未知，不制造补丁。
5. 自有页关闭、公开shutdown、原工具句柄join，原生物理退出与auth/models成对退休。归档选定事实/脚本/截图，不归档凭据、完整DB或请求body。同步三索引，运行适用检查，范围commit，fresh fetch/merge、完整pending审查、正常push，持续goal active。

## 准备结果及验收方式修正

正式before Node Vite构建1分18秒、renderer public surface checker和构建exit0。原18603 before独立scope真实启动被CopiedOAuthCredentialExpiredError拒绝：源authority的复制访问令牌已过期，未进入预检或产品页面；native terminal exit1、physical/output/request全完成、host/target退场、auth/models成对退休、launcher exit1。没有再次尝试该已结算scope，也不通过测试副本刷新原凭据。

本轮声明业务输入为0，只验证既有历史与只读不存在目标；模型调用不是这个UI错误的前置条件。改为唯一当前验收路径：新read-before/read-after不可变scope（18607/18609），不复制auth/models，不预检或调用Provider。仍直接复用413已有--owned-host分支的生产foreground ProcessFacade/ProcessSupervisor与600秒物理deadline，目标为正式开发入口src/index.ts serve及自有UI publication。不是变更产品的凭据/模型策略或增加产品fallback；不宣称本批完成真实LLM验收。原失败及其退休回执保留。

## 复现与实施决定

18607 read-before真实原Work正文/Sources可读（图01），未配置模型的提示如实呈现，不发送业务。合法但不存在的ses_-zUS0X33CzzWEKMgCk99 Work链接实际返回API 404 coding/work/session，随后选中状态与URL被清空，只剩项目首页（图02）。同一不存在Session的Mission链接也只剩首页（图03），但原请求事实复核明确为400 ProviderModelNotFoundError，尚未进入Session存在性判断，不能称为Mission 404。自有runtime/log/dev.log中有runtime:initApp、实际请求ID和Work NotFoundError: Session not found证据；CUA console日志为空，不能用空console否认真实失败。代码调用栈与await位置确认恢复异常跳过能力reconcile与monitor启动。before已公开shutdown200、原75697 joined exit0及完整原生退出；不在该scope继续测试。

实施在唯一init恢复入口收敛错误，复用workspaceLocationError和已有双语Feedback/Details，不新增状态面或缓存。parser与runtime恢复使用同一报告函数；Task已有taskSelectionError时保留其专属错误面，避免重复摘要。显式URL和原Task偏好恢复共享处理，重连原Task恢复也不能中断独立连接/投影初始化。不自动重试或改选其他目标。

归属必须由真正启动选择的owner判定：init内Task恢复捕获beginWorkspaceSelection的真实epoch，已被替换的异步错误退休；main已有Chat/launcher helper与Mission预读各自在其真实authority/epoch内退休晚到错误后，才把仍属于当前操作的错误交给init报告。不是按“当前epoch+1”猜测、按错误关键字过滤，或建立平行选择状态。改动限init/main UI消费者，Task/Mission/Session后端、协议、持久化和schema均不变。检视的测试为原始输入/transport/配置/文件owner与选择事务合同，无DOM/组件渲染或浏览器驱动，本轮不运行也不伪称UI验收。

第一轮代码typecheck通过、Node Vite 52.01秒通过，尚未publish或进入页面。代码复核发现两个新实现归属点需要修正：Task恢复必须把真实已退休的结果返回false，不能再由外层当作成功bump epoch；Mission预读catch不能覆盖已经转交给openMissionWithUILifecycle的新epoch，否则会误退休当前hydrate错误。已在正式页面前修正，后续重新构建最终publication，不把未体验的第一轮build当视觉验收。

最终typecheck通过、Node Vite 51.08秒及真实renderer checker通过。18609 read-after已就绪但在打开页面前复核出上述模型目录环境问题，公开shutdown200、原62768 joined exit0，未把它列为已完成视觉资格。修正验收环境后使用新catalog-before/catalog-after scope（18611/18613）：完整复制唯一现有models.json目录文件，auth.json保持未配置，不调用Provider或生成业务输入。前者复用原78秒构建的不可变before publication，后者使用最终51.08秒publication；不更换运行中bundle或已结算scope。模型目录是原生产读接口的必要配置，不通过伪造API回复绕过错误。原两种环境失败、原图和原回执全部保留。

catalog-only原18611/18613进一步确认：Provider投影还取决于真实auth授权，完整目录本身不能使openai/gpt-6.1-sol成为可用Provider。Mission仍真实400 ProviderModelNotFoundError，不能声明目标404。after Work 404已实际显示双语资源的英文Feedback/原Details（图05/06），且13:51:38错误之后，原服务日志13:51:47起每约10秒记录真实/global/health 200，证明连接monitor继续。后续原Work正文可读，但Sources点击被同一缺失Provider环境阻断，图07只是正文恢复，不能声称文件高亮成功。两个scope均公开shutdown200、原7048/94700 joined exit0。现有token过期不意味着用户没有其他已授权authority。

继续只读核对用户早已授权复制的C:/Users/hengu/.codex/auth.json：访问token实际有效至2026-10-24，源只读未刷新。新私有paired authority把现有token字段映射到当前Auth.Entry（UUID generation），同时复制完整相邻models目录文件；敏感值只在内存/私有临时文件，不进日志或spec。仅在新paired-before/paired-after scope（18615/18617）由原stageDiagnosticProvider复制完整auth/models并验证凭据、投影及实际gpt-6.1-sol流请求；业务输入仍0。每次成对退休，最终额外退休私有authority的两个文件，源Codex authority保持原文件/mtime。不是把目录未投影误报为凭据未配置，也不使用伪造凭据、测试副本refresh或产品配置旁路。

## 完整环境的新发现与追加根因决定

18615/18617真实gpt-6.1-sol预检均通过。原版Mission实际404只显示首页（08），修复版显示摘要与原404/请求ID/响应正文（09/10），切换真实设置后中文同步（11）。错误后重新选择Work正常，先通过真实滚轮暂停跟随、读到可见Source再点击，实际README第2—3行高亮（12）；不能把工具自动定位离屏控件时的移动当成真实Source点击成功。前07只证明正文恢复，未获得文件请求结果，原因不据此确定。正常已取消Task读取成功（13）。

随后未知Task ID揭示另一根因：selectTask在确认目录前就发布{id}的selectedSource，batch冲刷时activeProjectDirectory→taskOwningDirectory在真实反应式消费者中抛出，早于后面的try/finally。init虽报告摘要（14），同一无目录Task仍留在运行态，后续Mission切换也在该旧owner上失败（runtime:work-ledger.select-mission）；15只是失败首页，不能称为正常Mission。原Task仍未改写DB，错误只污染前端内存。原paired-after已公开shutdown200、原43698 joined exit0。

横向已读所有生产selectTask调用（main Task/launcher、旧聊天启动、dom-utils、重试、归档/删除收尾、init）及Project directory/composer-model/task-path/board消费者、API global/tasks与store查询。全局列表默认只加载10行，缺少一行不证明对象不存在，不能用分页列表直接拒绝旧Task或猜当前项目目录。决定在同一个/global/tasks查询及同一个listGlobalTasks生产reader增加可选精确taskID过滤，SQL在limit之前过滤，沿原getGlobalTaskBoard/route/Zod/生成OpenAPI与SDK合同投影。init Task恢复以该查询取得真实目录后才交原selector；未知结果使用WorkspaceLocationError，不伪造HTTP 404。selector自身在发布前使用原taskOwningDirectory保证身份完整。全局列表仍保留原分页，部分页面不能把一个已准入Task判为orphan；hasMore与其对应页面先共同提交，再作孤立选择判断。没有新后备查询、平行缓存、数据库版本或执行入口。

新增非UI正向验收在现有session-directory-filter真实内存SQLite/Server.App checker中创建完整有效领域记录，验证12条Task与另一个Project下精确taskID+limit=1的原Task/目录输出；它只证明后端查询合同，不代替页面验收。其余既有UI/组件自动化不运行。新scope verified（18619）使用最终正式bundle重新验证未知Task→正常Mission→正常Task/Work/Sources/刷新，不能沿用14/15作为成功证据。当前无Task/Mission/Session后端调度或终态异常；此追加修复为全体前端入口的已准入资源身份完整性及原只读索引契约。

追加实现后官方root generate退出0，OpenAPI及SDK从真实route重新生成。当前root typecheck实际8包全新检查通过（非缓存），正式Node Vite 1分20秒及renderer checker退出0。新正向测试第一次失败是本agent把store的原始TaskRow当作camelCase公共view读取；实际store合同为item.directory/task.project_id，公共API为task.directory/project.id。修正测试的层次映射并增加13条结果的完整正向顺序断言后重跑原checker，未为错误测试修改生产实现。失败原日志保留。

## 最终真实验收与边界

正式verified 18619对未知Task显示原WorkspaceLocationError及Details（16/17），随后真实Mission草稿恢复且刷新保持正确owner（18/19）；真实已取消Task直接链接及刷新保留45秒原正文（20/21）。原Work历史完整显示（22），真实滚轮定位可见Source后点击README，实际第2—3行高亮（23）。切换当前界面为中文后再次访问未知Task，错误面同步中文，原错误事实保留（24）。未创建Task/Mission/消息或修改既有草稿。最终日志734条server request事件、27条完成的health 200；错误后monitor继续。本轮没有新成员流式生成，不能扩大为Rendering所有场景资格。

聚焦真实SQLite/Server.App正向checker最终1 pass、5 expects（3 filtered）；官方generate、8包全新typecheck、正式Node Vite 80秒和renderer checker通过。docs:check、architecture-index、api:routes-check均exit0。schema仍2，无迁移文件修改。

8个自有scope全部完成native physical/output/request结算，before预检因已过期原凭据exit1，其余7个公开shutdown200、launcher joined exit0。三个paired scope各2次实际gpt-6.1-sol流请求、HTTP200及reader EOF；无本轮业务输入。各scope auth/models已成对退休，额外私有authority两个文件也已精确删除；原Codex authority尺寸及mtime与准备前相同。归档不含凭据、DB或Provider原始body。

图07只证明正文恢复，文件点击结果未资格、具体原因未知；图15虽文件名含normal，实际是中间版本被ghost Task污染后的失败页。两者保留原始失败，不计成功。未完整资格并发导航竞态、所有归档链接及新成员Rendering。用户最新指出Goal难发现及默认页布局异常，下一批单独调查入口、owner合同和实际首页视觉；本批不把导航修复宣称已解决该产品诉求。
