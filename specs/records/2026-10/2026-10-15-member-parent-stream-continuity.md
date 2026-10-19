# 主会话流中成员侧栏连续性

## Recall

用户持续要求单agent自主迭代、优先Sources和成员Rendering，实际体验验证后提交推送。最新人工单agent要求覆盖goal旧Astra并行文字。本轮前一goal turn为progress：efd3c4313已提交、正常push并fresh fetch确认，修复同页刷新定位与冲突链接反馈；当前HEAD相同，原.bun及packages/opencorvus/bun未跟踪，保留。不得清库、改已交付迁移、动用户窗口/服务、创建分支/worktree或发布。本批只一个开发agent，不委派，也不创建新的被测产品成员；最多一个真实主会话业务输入。

## 已读资料与修改前分析

已读430 Recall、425完成态Sources/成员证据、412及420成员真实流与历史根因，当前07-panel/07-panel-reactivity的单一投影/渲染/可见性/阅读合同；当前TextPart、text-part-model、markdown-render服务/worker、SubagentConversationPanel、ConversationCard、ChatBubble、CardParts，以及subagent-conversation的target/read/live/merge与排序。全仓搜索Rendering唯一呈现点、TextPart调用与run分组、成员资源和生命周期定义/调用、相关当前测试及历史记录。subagent-conversation-service测试内容为纯运输Message/Part身份/顺序/epoch合并与请求/错误合同，不渲染DOM/组件；本批不运行。不得新增/运行任何UI自动化、fixture消息、截图/DOM断言。

原现象是成员正文反复被Rendering打断；旧历史有两个独立根因：pending即显示占位，以及上层真实owner反复销毁。当前TextPart只在pending且没有已接受HTML时显示占位，实际输入等值guard避免重复提交；ConversationCard非keyed分支、成员target/request分离、保留resource storage与force-mounted外层均已交付。425只资格为完成态历史，420是当时实现的真实成员流与关闭重开，不证明今天所有组合。当前源码尚无新失败证据；不隐藏状态、不扩大缓存、不重写调度，不因旧标题或最后一个状态制造补丁。

本次新增资格为：真实主会话产生新模型/工具/来源流时，打开同一父source下已有已完成成员正文，检查父投影更新是否导致成员重挂载、成员text被清空或已有HTML丢失。可能触发点包括成员record/target重算、CardParts索引run成员插入、窗口隐藏与阅读恢复；具体根因未知。若出现错误，必须以实际目标、消息/Part身份、owner create/dispose、接受HTML与真实截图关联后再决定修改。正常新正文首次渲染、真正切换目标或主区自己退休不能冒充侧栏复发。

范围先限UI消费者。当前没有Task/Mission/Session执行轮次、调度、队列、唤醒、恢复或并发终态异常证据，不改后台机制、Provider、数据库或协议。如新证据触及上述共享机制，立即横审所有生产入口、正常/终态、重试重启、串并行及多项目隔离，再补方案。仅发现纯UI问题时，以唯一原实现修根因，严格保留源身份/原消息/阅读锚点与可见诊断。

## 实施前方案

1. 原始SQLite只读确认412真实普通父/成员身份、metadata及原Source/消息绑定，优先选择原父ses_-zUS0X33CzzWEKMgCk98和已有成员ses_-zUS0WzzQzzDOGrIbYwN；不假定它仍可用，不注入消息/Source。先准备全部脚本和bundle，再启动600秒硬期限、180秒无活动、最多12累计实际流请求的独立NativeService scope（含完整auth/models与gpt-6.1-sol真实预检）。沿成熟413生产ProcessFacade/native回执与公开shutdown机制，仅用自有runtime与端口18599/ui。
2. 复用420被动Vite transform诊断，只记录text model/bubble/scroll的create/dispose和text长度/HTML是否为空/pending/streaming/error，不改控制流、模型文本或渲染输出。诊断HTML输出到自有独立publication，不覆盖正式源码/用户服务。构建使用唯一公共隔离环境，Node Vite，不单起Vite服务器。保留诊断脚本及正式源原件以便复核差异。
3. CUA只开自有IAB页面，默认桌面viewport，实际选已有成员并暂停阅读、查看Sources与原正文。通过正常主输入发送一条真实输入：仅由主会话自己read README第2–3行并连续输出长Markdown，不委派、不建Task/Mission、不改文件或shell。流中查看旧成员、All agents往返、关闭重开与Source文件tab返回，按实际时点截图人工复核。仅观察无UI断言、自动loop或假事件。若主原会话不受当前公开Conversation authority接纳，保留实际错误，不旁路生产准入。
4. 被动日志与实际Provider/持久事实确定新的触发和影响面；若有实证新根因，先补完整决定再改唯一实现，正式构建用新scope重新同场景体验。若当前未复现新缺陷，诚实记录本次范围和未知，不制造补丁或将这一次观察外推为全部Rendering完成。
5. 自有页关闭、公开shutdown、原句柄join，核对physical/output/request/原host-target exact occurrence与auth/models配对退休。脚本/必要事实/原图归档不含凭据或完整数据库，三索引同步，当前docs/architecture与适用检查，范围commit后fresh fetch/merge、完整pending审查和正常push；持续goal active。

## 2026-10-19交付收敛

用户要求“push你这几天的改动”。重新检查工作区及fresh fetch：当前main与origin/main均为efd3c4313，此前所有代码修复已经推送。剩余本批三个索引、方案和九张真实截图尚未提交；本次只完成它们的证据归档及正常推送，不追加未验证的产品修改。不操作当前用户localhost:18571窗口或服务，原有.bun和packages/opencorvus/bun仍保留。下面运行事实发生于2026-10-15，2026-10-19复核归档，不能称为今天重新运行的验收。

## 实际运行与人工视觉结果

诊断bundle通过公共preparePackageBuildEnvironment先绑定仓库.scratch/package-runtime，Node Vite真实构建54.12秒、exit0。只有被动生命周期日志及owner属性，正式产品源码未修改；本轮不是一组产品修复前后对照，也没有另行运行正式生产bundle的同场景验收。

独立18599 NativeService实际预检确认Provider凭据可用、模型目录已投影、实际gpt-6.1-sol流请求。仅主会话发送一次业务输入msg_d953f4ff-f2d4-4d50-9933-7e83e47def30，实际read README.md第2—3行，再自然流出16节正文及末尾表格。持久事实为原父/成员两会话合计15→18条消息、4→5个source-file；新增消息为一条用户、finish=tool-calls的助手和finish=stop的助手，均属于原父ses_-zUS0X33CzzWEKMgCk98。原成员ses_-zUS0WzzQzzDOGrIbYwN的完整Session、12条Message和29个Part与运行前逐值相同。所记录QA库版本前后均为2，不是本轮发生迁移；本轮没有通过应用打开默认用户库。

09张原图覆盖原成员、主输入接纳、主流中成员列表往返、关闭重开、长正文流出、Sources打开README第2—3行、文件tab返回及主自然完成。06图主区Running/Stop和新第7—8节与原成员正文/Sources同时可见；07图同一主流继续时实际文件2—3行高亮；08、09图返回原成员仍可阅读。人工查看这些时点，原成员未出现已接受正文反复被Rendering替换的现象。初次加载未接受HTML前的Rendering属于冷启动，不作为复发。2026-10-19再次人工查看06、07原图确认归档区域与文字；未刷新或重开用户页面。

被动owner观察在开始、流中和结束三个时点均为原成员5—12，正文长度分别53/228/205/2078/204/2791/204/2689，三个时点身份与已接受正文一致。这里只记录人工时点观察，不新增DOM/组件断言或UI自动化。console日志接口最多保留500条，主流pending事件使初始create历史被截断；两份500条日志有重叠，不能相加声称1000条独立观测，也不能以空SCROLL检索声称从未创建。可见主区虚拟化dispose与成员owner不是同一对象，各类counter也不可按数字直接互认。因此不宣称完整逐帧无闪烁或生命周期创建次数为一，不外推到成员自身流、其他工作流或所有并发组合。

工具准备有一次read-only evaluate访问performance.now得到TypeError；该API在此观察环境不可用，随后改为外侧时间和只读DOM观察。首图文件已落盘并重新实际查看，不把工具错误归为产品失败。当前没有新渲染根因实证，依照方案不制造代码补丁；泛化dock标题的语义只是待核实线索，本轮未改文案。

最后Provider审计共5条实际请求：预检2条、原父业务3条（memory一次、work工具轮和正文轮各一次），均gpt-6.1-sol、streaming=true、HTTP 200，实际reader settled/eof。通过公开POST /shutdown返回200，原生terminal exit0，physicalCompletion/outputDrainComplete/requestCleanupComplete均已满足，原host/target实例退场，复制的auth/models成对退休，launcher-child-exit为0。恢复时原66900工具句柄已关闭，不能重新join；原物理回执和launcher退出回执作为已完成证据，不重复关闭或启动服务。归档只保留选定事实、脚本、诊断源副本、日志及截图，不含完整数据库、实际auth/models或请求body。

## 验证与交付范围

2026-10-19当前docs:check实际通过345 operations/26 groups，check:architecture-index通过20 current documents；结果归档。52个归档文件含9张截图，压缩文本已逐一解压并以内存中的实际凭据值完成披露检查，git diff --check通过。提交范围为本批规格、索引与真实验收产物。随后fresh fetch、merge当前upstream、审查完整upstream..HEAD并按正常pre-push检查推送，不跳hook。此前Sources、取消生命周期、刷新定位和构建隔离的代码提交已在远端，本批不重新宣称这些旧提交产生了新改动。本次无版本更新、schema变更、凭据调用或发布。
