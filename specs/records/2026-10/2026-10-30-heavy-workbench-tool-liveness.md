# 长程benchmark暴露的共享Tool活动所有权

## Recall

用户要求十题重型benchmark、严格可执行rubric、单层独立审查、真实OpenCorvus/fresh Codex对照，两好升级；无用户总token/总墙钟额度，便宜实验优先，不恢复六旧昂贵容器。当前L06/0.2.0冻结，真实Task `tsk_g00VZTFvzf0073YLIAGl`，来源Git2e6ffc7ce，唯一定位`D:/opencorvus-benchmark-runs/L06-current-pair-20261029.json`。4a928d538已正常push，原件与完整未满足项在长程/L06/L05 Recall。

20:53心跳先查Git与长程/L06/L04/横向Recall，保留其他任务Overlay/语言/索引/旧图片删除等改动。单层benchmark_review先封存L05完整预案数学审查（三原阻塞/主方拟澄清，不是实现批准），然后转只读横向审计本共享异常，禁止再委托、候选反馈、LLM/GPU/solver/用户进程/UI操作。原容器/Task不重启/取消，现有自动恢复事实保留；不能把运行时错误扣成候选业务0分或伪装未失败。

## 已观察事实与初步根因

原Task的base-developer同Session在20:44:47.927Z出现terminal/error occurrence（sequence125）：ProcessorUnsafeRetryError，工具执行开始后禁止在同assistant Message重试，cause文案`LLMActivity idle > 180000ms`。20:54 Task仍active、同Session新occurrence已streaming，原Docker `l06-refined-main`仍有效CPU约468%；原start20:24:48、20:42约800%，只挂候选project、networknone。完整原status封存`.../opencorvus/evidence/idle-unsafe-retry-20261029/status-original.json`。不以错误文案/active状态猜根因。

全仓定义/调用/历史搜索发现：

- session/processor.ts从EngineConfig读取session_tool_idle_ms=20分钟作为LLMActivityPolicy.maxPauseMs；consumer tool-call时pause、result/error时resume。原真实命令工具开始20:24:46.283到错误20:44:47.927约20分钟，直接触发是暂停期限，不是已证实3分钟无Provider字节。
- llm/activity.ts把StreamActivityMonitor的任何timedOut都替换为`LLMActivity idle > policy.idleMs`，抹掉了stream-activity.ts实际paused/maxPause/owner原因，导致180秒误诊。错误链必须保留真实物理触发。
- bash.ts仅在真实stdout/stderr块跨采样门槛时发布output_bytes/预览；SessionLoop只在appendToolProgress真实commit后续期当前Session的暂停观察。静默有效CPU计算没有stdout，不能用timer、filesystem或无变化running假装语义进展。
- processor已有SDK execute包装，但只markToolExecutionStarted；SDK可以先执行Tool，再让consumer处理tool-call。当前暂停所有权只由消费事件建立，与真实执行边界不完全一致。其20分钟无输出窗口把有明确工具自身timeout的长执行当作LLM停滞。
- UnsafeRetry保护是必要数据完整性规则，不能为了通过benchmark放开重放。Bash/ProcessSupervisor治理本机进程树与工具timeout；Docker daemon中的工作不等同于该本机树，原client中断后容器仍运行需按原身份收尾，不能宣称物理计算已停止。

## 深度与横向影响（修改前分析）

这不是L06数学/报告问题。所有原生SessionProcessor生产入口共享上述SDK包装、LLMActivity和pause monitor，需覆盖Task Orchestrator/Worker、Mission、普通Chat/SideChat、真实occurrence的正常/失败/重试/重启、串并行/多项目隔离。独立agent正审完整入口与取消传播；尚未完成的入口/事实标unknown，未判成某专家团局部问题。

当前架构task-control-plane.md规定durable Tool progress续期，同时明确Provider inactivity不得成为第二个绝对Tool运行上限；现有实现对静默有效工具与此目标冲突。旧路径只采输出，靠增大数字仍会在更长任务重现；轮询CPU/Docker并timer假bump又会造影子进展、绑定宿主/工具名。不能采取这些绕行。

生产源码尚未修改。拟修唯一Activity所有权，复用已存在scheduler runDelegated的父/子治理语义：在真正SDK Tool execute期间委托给该工具的实际timeout/取消/收据边界；execute结束后恢复有限LLM/发布等待观察。要处理execute早于consumer、并行多Tool、同步throw/异步reject、Tool结束但结果发布卡住、外部取消和旧attempt回调迟到，不能让一个调用释放另一个调用/Session/项目的所有权。任意没有自己治理的Tool promise可能无限挂起的风险尚须审查；未分析完不直接删除maxPause或取消保护。

公共接口/配置、真实tools目录、测试/文档和交付影响待完整方案收敛后列出。UI不适用，不修改界面或运行UI自动化；数据库格式/迁移目前无修改需求，是否新增持久事实须优先避免，不能另造队列/状态机/工具选择规则/LLM路由。凭据不读取、不进记录/日志/提交。

## 验收计划（尚未执行修复）

先保存真实错误/时间/工具part和物理边界元数据，不复制隐藏推理或敏感Provider正文。用现有受控流式Provider/SessionProcessor checker和真实自有进程做便宜正向复现：工具真实运行超过缩短的暂停观察仍自然返回正确输出/终态；实际执行早于consumer；并行两工具与多Session/项目正确隔离；工具结束后真正无进展发布等待仍按原有限契约错误；显式工具timeout/外部abort进入原有明确错误与物理收尾。mock/缩时检查只认证局部，须有真实生产Tool/进程路径，不能当新候选成绩或替代完整L06自然运行。

修后单层独立审查；已启动旧PID加载的是旧代码，不伪称热生效或重启用户/有效计算。原L06 occurrence与自动续跑保留并标运行时受干扰；待实际终态再封存/评分，是否需新鲜修复版pilot依据同一冻结合同和原件决定，不重复LLM smoke凑次数。新Spec同步三个索引/当前文档检查，所有自有修改范围提交，正常fetch/merge/审查全部待推集合/push，不绕hook或新建branch/worktree。

## 完整源审与实施方案

独立源审已封存`D:/opencorvus-benchmark-runs/l06-idle-shared-review-20261029`，45源快照/安装SDK段/原occurrence。普通/Scoped MCP漏传abortSignal也是相关P1：已有callToolWithTaskRecovery支持signal，三个上层没有投影；MCP App正确传入。package RPC已有可重置的真实输出/RPC inactivity，不是固定总deadline。MCP Task TTL是保留/删除期限，不保证执行停止，禁止createdAt+ttl冒充执行lease。当前实际原Tool输入timeout=2100000ms（35分钟），却在1201444ms后被父pause中断，进一步排除其自身35分钟正常到期。

不采用裸execute Promise无限委托。实施为有限、类型化真实执行lease：

1. 新共用执行deadline对象自身真正武装timeout/组合外部abort，固定deadline与有界cleanup截止不可续写；对象有运行时身份，普通metadata或MCP返回字典不能伪造。Bash只用此同一deadline治理原foreground timeout，保留ProcessSupervisor物理收尾；background原lease/readiness语义不变。
2. SessionLoop通过已有Tool上下文的内部observer接受该对象，先经同一appendToolProgress提交真实期限事实，再交给精确processor/call的当前SDK执行owner。普通ctx.metadata字典不取得放宽资格；没有真实有限期限的工具仍受原guard。无新持久表/队列/配置，原Tool progress为唯一落盘路径。
3. SDK execute入口先建立精确call暂停并证明实际Tool已开始，消除早于consumer/first-byte的窗口；finally交回。consumer不为已完成的SDK call再制造悬空owner。并行call/attempt/processor各自隔离，旧release只能释放自己。LLMActivity新有限hold只推迟暂停期限，不能延长普通Provider idle、不能扩展Task/token/活动总额度；工具结束交回后有限观察恢复。
4. StreamActivityMonitor仍保留普通idle与无lease的pause guard；仅真实deadline在有效期内有限延后。lease关闭是实际执行治理的交接，不是timer heartbeat；物理cleanup超过自身有限截止也不能无限豁免。真实maxPause原因沿原idle分类保留为cause，不能继续用180000文案盖掉20min。
5. MCP普通/Scoped动态Tool的SDK options.abortSignal及直接Scoped API的显式signal传到底层既有函数；不从Task TTL或working轮询生成lease，不新增MCP协议/重复调用或强制新路由。全部生产调用点同步、聚焦取消响应正向测试。

预计触及util/stream-activity、llm/activity、session/processor/loop、Bash及共享deadline小primitive、MCP三个调用投影、聚焦后端测试与Provider/Task当前文档。修改前这些源均无本地用户差异；其他Overlay/语言/07-panel/共享索引改动仍保留。先以缩时正向合同/实际SDK与自有进程复现原失败，保留red原件，再实现/必要回归/独立审查；无UI自动化、无新LLM候选或GPU训练。

## 实施、实际资格与独立最终审查

上述有限方案已落到唯一生产路径：新execution-deadline primitive自身武装固定timeout、组合原caller signal并对对象做运行时身份校验；dispose同时撤销资格。SessionLoop先经同一持久progress提交真实deadline，再绑定精确active SDK call。Bash在supervisor的try/finally内构造该期限对象，构造失败仍进入原有界物理收尾；terminate/dispose共用一次缓存的绝对cleanup截止。普通metadata和MCP TTL没有被当作执行凭据，无lease调用继续有限观察。SDK同步值、PromiseLike、直接AsyncIterable返回形状均保持；旧attempt/call release只释放自己。LLMActivity保留实际paused/owner原因及cause，原unsafe-retry保护不变。三个MCP入口只补齐既有函数的取消signal投影，没有新协议、消息、队列、持久表或工具选择流程。

最终固定执行16份源/测试，实际7文件53项、146断言、94.71秒全部通过，执行命令exit0且前后文件直接字节同一；包内typecheck exit0。另实际SessionPrompt→SessionLoop→SDK→Bash/标准库子进程→SQLite期限事实/输出文件及timeout、caller abort三条路径3项/13断言/13.65秒通过；stdio MCP三入口接收方实际收到对应request的取消通知。真实Loop使用受控有限流式Provider，只认证生产工具链，不冒充真实模型业务能力。既有shell13项回归与这些资格重叠，不相加当独立样本。

保留真实失败：SDK缩时red及首次green；首轮MCP测试错误地期待SDK不包装abort、direct Scoped漏inventory观察；首轮Loop误等resident Session整体结束且生成脚本换行错误。原失败/测试源/修后收据均保留，不包装首次全过。独立实现审查还发现返回形状、迭代器判定、构造保护与cleanup界、dispose撤销等问题，均修后复核；其首个被转译器消掉的无效AST探针明确标无效，未冒充产品反例。

单层独立reviewer最终逐字节核对当前16源与固定执行快照，读取最终53项/实际三路径/typecheck原件，结论implementation_review_and_final_qualification_accepted_with_stated_scope、当前无实质阻断；未再重复测试。独立原源审/首轮/追加/旧pending判定全部保留于[修复原件](../../artifacts/2026-10-30-heavy-workbench-tool-liveness/README.md)。docs:check主方原回执chunk957534为351 ops/26 groups/exit0，最终包装后再执行当前文档检查。包装ZIP的成员原字节核对仅证明已执行/审查对象身份，不替代功能正确性。

依据实际安装AI SDK7.0.138和MCP SDK1.32.0及[AI SDK Tool合同](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool)、[MCP Task TTL合同](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks#ttl-and-resource-management)实施：AsyncIterable必须保持直接可迭代，TTL是保留资源边界而非实际执行timeout。原SDK片段随各ZIP保留对应MIT许可。

## 原候选接续与未完成项

22:06:09Z原Task仍running/active，base-developer已交接给自然产生的base-tester，实际原生工具正在等待其既定独立冷求解终态。原l06-refined-main已自动清理；l06-final-main在21:16:58Z自然exit0，不能因消失重启，也不能把已输出报告当整个Task终态。旧listener仍加载2e6ffc7ce旧代码，当前修复没有热生效，不操作/重启有效工作。原20分钟失败与自动恢复必须保留为runtime interference，后续业务成绩/活动测时和是否需修复版fresh试跑另行判定。

L06自然终态后才封存完成版本，进入同冻结合同评估侧实际source-only执行/图形复核/单层独立评分，再顺序启动已预注册的fresh Codex；不把观察器超时当业务0，不重建第二个同dataset Task。10题、新成对成绩、有效数小时与成熟性证据均未完成，心跳保持ACTIVE。


## 推送检查发现的生成元数据同步

首次正常push的hook在api:routes-check明确拒绝：Config工具暂停说明已按新语义修改，但packages/sdk/openapi.json仍为旧说明。不是路由/运行行为失败；全仓搜索同文案还定位SDK types.gen.ts注释。修改前SDK树无本地用户差异，已先保存全部tracked源；用现有SDK规范生成器从唯一源重建OpenAPI/注释/声明，不手改生成物、不绕hook，也不扩大为应用版本或发布。运行时16源不变，原53项资格继续有效；生成与hook复验结果追加原件。

现有SDK规范生成器实际30.87秒exit0；真实diff恰OpenAPI说明与SDK类型注释各一行，没有路由/字段或其他生成文件变化。生成前全部SDK tracked对象、stdout/stderr/命令与生成后两文件封存primary/publish-metadata-originals.zip。主方最终包装docs:check再通过351 ops/26 groups（chunkdd786e），保留首push失败chunk4cf914，不绕hook；正常重新fetch/merge/检查待推集合后再次push。
