# 持续目标的流中暂停与恢复

## Recall

566继续用户授权的自主产品迭代，只用单agent，后来的单agent要求覆盖旧Goal三个Astra文本。上一轮为progress：79aceac19修复慢首次读取被背景refetch反复替换，十张真实图覆盖主/Side/Task/Mission表单，正常push后fresh0/0。原565两个服务/页面均闭合，真实4次Sol预检reader EOF、两scope配对auth/models各退休1，源schema4→目标5及后续5→5、90表全部原行和字节mtime保持。565没有执行Goal，不能把表单资格当执行验收。整体Goal active。

用户已授权OpenCorvus热认证OpenAI、完整模型目录、真实gpt-6.1-sol流式隔离验收；只用自有独立服务及浏览器页面，不重启、关闭或刷新用户窗口/18571服务，不碰其用户数据库。开始git status显示原无关video/assets删除及.bun/、packages/opencorvus/bun/保留；当前HEAD79aceac19，开始无暂存。本轮不创建branch/worktree，不粗暴回退，不发布。

已读565 Recall/结果、当前continuous-goal架构、533默认页到真实执行记录、561首页归属与帮助记录，及当前Home main.onStartGoal/App唯一handoff、ContinuousGoalControl创建/更新/状态/表单与单resource刷新、service唯一HTTP与owner失效、schema、store公开事务投影、controller goalPrompt及paused/blocked/complete计划出口。已搜索正式Goal路由、所有共用控件入口和本地化pause/usage定义。533真实首两轮过快，第三轮结束851ms后才暂停，明确没有流中暂停资格；本批优先填此实证缺口，不为重复通过而缩小为表单。

## 修改前分析与影响面

公开合同：Home确认才创建真实Chat，再携同一requestID/输入/authority/selection交给现有Goal POST；Goal来自protocol_event单源，状态与accepted turns、原usage关联分别投影。pause是显式intent修订，停止后续自动输入准入；已经接受的controller输入及其当前Provider请求沿正常owner结算，不能把pause误作取消当前回复。resume保留Goal identity、累计usage与轮次并重检预算；complete由真实证据判断。任务终态、模型stop、预算到达不等于Goal完成。

当前565改动只合并后台读取，显式POST/PATCH后重读、expectedRevision、requestID和写后错误均保持；流中PATCH完成后表单/strip及新本地notice是否清楚，需要实际页面和持久事实。潜在影响包括Home新Session交接、流中暂停/当前回复、后续输入准入、预算与恢复、usage晚结算、完成证据和所属会话；Task/Mission/Side共用控件，但本批先不宣称它们的新执行资格。数据、接口、工具、模型策略、schema与迁移预期不改；没有先验已证明的产品bug，先观察后决定。

若出现调度、队列、唤醒、恢复、并发或终态收敛异常，立即横向审计全部Task/Mission/Session生产入口和occurrence、正常/终态、重试/重启、串并行、多项目；仅本Chat通过或最后错误不能排除共享根因。若发现纯展示问题，也先补齐真实触发、来源、旧路径未治原因、调用/公开契约/数据/测试/文档/风险再改唯一实现。禁止用延迟、host路由或状态机教LLM流程。

## 实施前方案与验收

1. namespace goal-live-pause-566-before，独立54054，仅空闲时启动。完整复制已闭合565-after全部90表实际原行/对象/schema5及完整canonical，先确认原native/exec/launcher/physical/output/request、Provider EOF和认证目录退休。使用565最终正式完整UI main-D5Ah_P6W.js及source CLI `/ui`；无独立Vite，不注入上一批八秒延迟或模拟响应。完整配对OpenAI凭据与models，启动前分别验证凭据、投影与真实wire模型。
2. 每scope最大8真实请求，批次最多16（只有确需修复后才启动after；未用额度不等于已执行）。20分钟原生服务边界，启动无活动180秒，至少五分钟主动收尾。预检通常2请求，其余只用于本批真实Goal两次有限续跑及自然helper；原reader、确切模型和实际请求分别留证，不通过扩请求来掩盖失败。
3. 人工全局首页加号→持续目标，创建一个明确隔离的文字长文Goal，turnBudget=2，只有文字输出、不访问外部/文件、不委派，完成由操作者阅读后手动登记。目标内容是重复被唤醒时输出约3000中文字使用说明，方便实际流中操作；只依正常Goal控制器/Provider流，不制造隐藏或假用户消息。实际首个模型reader开放且正文有增量后，通过原暂停按钮提交，记录PATCH事实时间、原Provider reader与assistant completion；不把流前/流后点击说成流中。
4. 看图并核原GET及SQLite事实：同一Goal paused、accepted第1轮、原可见controller作者和助手正文，当前回复正常结算；仅观察持久输入，不将无事件消极断言当自动测试。随后原Resume进入第2轮、自然预算到达，查看累计tokens/turns、完整长文和Goal参与者；通过原Details→完成证据→完成，核同Goal complete与用量保持。所有UI均真实手动交互、截图人工复核，无UI自动化。
5. 先在服务启动前准备只读checker：独立读取实际UI创建的Goal/Session、公开GET对照同一identity/state/usage与原protocol_event/消息/Parts；不以DOM文本、模型自述、mock、fixture-only代替实页或公开合同。若产品修复涉及非UI契约，补聚焦正向测试并重跑真实失败路径；纯UI不写或运行自动化测试。
6. 关闭自有页面，原公开shutdown→join原exec→native/launcher/物理输出请求闭合→完整源/目标差异/配置/schema/integrity检查→配对退休auth/models。目标自然usage、消息、Project记忆、租约/时间变动逐项说明；源数据库全部原字段/时间/字节mtime保持。四索引、实际图/非秘密结算、当前文档检查；精确index提交保留所有其他改动，fetch原完成→merge upstream→审查全部待推集合→正常hooks push→fresh0/0。整体Goal继续active。

## 首次真实结果与验收深化

已创建真实首页Goal pev_g0VYvMpUG00RmhjAsQQq / Chat ses_-zUR4dB1AzzBKBy02oXz / Project prj_hj4xczrilOy87WrTGITd。实际live-first原reader reading、助手603字时点击暂停，paused-live仍reading且1241字；paused-progress3258字，原回复最终stop/3818字/36546令牌。暂停intent1792803534504先于助手完成1792803590329整55825ms，paused-reviewed公开投影仍同Goal paused/1/2。原界面恢复后第二输入被接受，budget_limited/2/2且当前reader reading，完整保留第一轮用量；这些是正常合同，不是唤醒/收敛异常。

为覆盖真实晚结算，在原预算与两轮额度内深化最后一步：若第二流仍在读取，操作者依据已完整阅读的第一份说明及当前真实暂停/恢复事实，在第二流中提交具体完成证据；然后让已接收第二回复自然结束，核complete保留且同Goal累计usage继续按请求起始关联结算，不把完成误作强制取消。不新建第三Goal或增加调用。依据是当前架构late settlement合同、llm.ts请求起始captureContinuousGoalUsage与store.ts按goal_id关联原usage的唯一投影。若实际操作已在EOF之后，只保留流后完成资格，不重启回复或伪称流中。此为验收深化，无产品改动。

第二回复实际stop/3841字，原reader EOF1792803714585，助手完成1792803714618；原完成intent1792803731871，晚17253ms。因此原Goal的完整创建/流中暂停/恢复/两轮预算/人工完成通过，但晚结算资格尚无。该时序为实际人工操作结果，无调度或产品失败，不重启原回复，也不把before-completion的reading快照扩大成提交时仍reading。

01:03之前明确修订上述“不增加调用”限制：同一20分钟scope和原最大8请求内，通过原已完成详情的“创建下一个目标”建立第二个独立有限Goal，turnBudget=1，剩余请求额度4，不启动新服务或after。该目标明确是晚结算观测窗口，输出约6000中文字，给人工留足时间；操作者在确切reading及部分正文后通过原控件登记完成，之后继续观察同一已接受回复及原usage关联。第二Goal另有新身份，第一Goal完整两轮事实保持，不混入原75,959令牌。全部只用原Provider/原始流和现有Goal控件，不模拟时序或修改执行实现。若真实失败按共享机制横审；若通过只交付真实新资格，不虚构修复。

## 第二目标与最终真实资格

原“创建新目标”建立pev_g0VYvOGuo00zC974B6k5，预算1，仍属同一ses_-zUR4dB1AzzBKBy02oXz，独立created事实，不重写首目标。09实图看到GOAL566_LATE_BEGIN及实际流式正文。中途一次沿陈旧AX（Accessibility，可访问性树）索引误选另一已有会话，后续当前控件是disabled Send；回到只读checker取得的准确canonical Session URL，重新读取当前153详情、333完成入口后操作。此为操作者定位错误，不归因于产品；实际新Goal仍沿原请求持续输出，全部运行仅五个真实请求，消息及写入事实见结算。

第二目标完成intent1792803952822，late-completed-reading公开GET为同Goal complete/1/1/0令牌、原reader reading、助手5299字符，10实图同时看到已完成和当前会话执行中/停止操作。当前已接受回复自然结算，助手完成1792803976708，比完成intent晚23886ms；usage关联晚23862ms，最终公开GET complete/43845令牌，助手stop/6197字符，11实图实际看到更新后的累计用量和结束标记。没有把已完成Goal当取消当前回复，也没有丢失晚到用量。

首目标原定义、全部created/updated/continuation不可变事实逐项与首目标完成时快照核对一致，原两条原provider_usage_event关联合计75959；第二目标一条43845，均provider=openai/model=gpt-6.1-sol、session相同而goal_id各自正确。三条真实goal-controller输入及三条真实assistant stop完整持久化，作者、parent、时间与完整正文分别保留。字符计数3818/3841/6197含Markdown和标记。未把模型解释当界面证明，实际状态来自原公开GET与数据库事实，视觉来自十一张已呈现人工查看的[截图](../../artifacts/2026-10-24-goal-live-pause/README.md)。

本批实际流程通过，未建立新产品bug：pause的当前回复收尾、resume后的下一轮、accepted计数预算、手动完成及已完成后的原usage归属都符合当前合同。没有调度、唤醒、恢复或终态异常证据，因此没有改共享执行器或为单场景加旁路。未修改UI生产代码、API、LLM工具/策略、数据格式/schema/已交付迁移；不新建after或重复构建未改动的前端。沿565已资格化完整正式publication验收，不把build/typecheck当视觉证据。

## 完整范围闭合与交付

scope启动前完整源90表177254原行、schema5/integrity/完整canonical已保存。收尾重新核对全部源rowid/主键/字段/时间、数据库字节mtime与完整配置均精确保持，目标仅两个原runtime_execution_capacity_lease的lease_id/owner_id/time_acquired/expires_at正常更新，源与目标schema5对象一致、完整性ok。真实新Project/Session/Goal/消息/用量/协议事件追加；Provider activity434→438与五次wire请求不同，不用它替代原请求审计。

原服务99830已join退出0，公开shutdown200，原生host/launcher退出0、physicalCompletion/outputDrainComplete/requestCleanupComplete全部true，原进程链dead_or_reused；自有页231已关闭。关闭时保留606870ms，满足五分钟主动收尾。实际5/8请求均gpt-6.1-sol、streaming=true、200、原provider-source-reader settled/eof；其中2预检、3真实Goal回复。auth/models各退休1，源完整模型目录9155406字节、原mtime和内容保持。可选after未启动、原用户18571服务和数据库未作为操作目标，凭据不归档。

新增本记录、十一图/安全时间线和结算以及三处索引，无新产品实现或UI自动化测试。只读正向checker实际进入原GET与持久化，核同Goal/Project/Session、complete、accepted数、原usage映射和请求EOF；不以mock、源码字符串或组件渲染代替真实路径。Task/Mission/Side执行、跨进程恢复和连续闪烁视频本批没有新增资格，不能推广。整体Goal仍active，下一批继续单agent自主调查。

交付前运行当前docs:check、审查精确差异并用独立index仅提交本批和索引新行，保留所有其他工作区/暂存。正常fetch原进程完成后merge upstream、审查完整待推集合、正常hooks push及fresh fetch核对；实际提交与推送结果以Git命令和提交历史为准，不预填成功。
