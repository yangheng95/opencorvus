# 流中双成员切换与来源阅读

## Recall

用户要求持续自主体验/修复UI（User Interface，用户界面）、UX（User Experience，用户体验）与功能，关注Sources和成员侧栏Rendering闪烁。最新人工约束是单开发agent；旧goal中三个Astra已被覆盖，不委托Codex子agent。应用中的两位真实成员是被测功能。已授权完整auth/models配对使用真实gpt-6.1-sol，凭据不进入日志或提交；所有模型交互流式。旧数据清理和当前v1迁移已落地，本轮保留当前历史，不重复清库。

416是progress：0e06915e348e58e8609497425a7f0fe8f69a68c0已推送（98082/3ed3a4 exit0），fresh fetch确认远端726bfa6ca包含该提交。实现真实Session短标识在选择器/列表/进度卡一致，15条真实Sol流、21张原图；Sources第2/3行和双向完成态阅读位置通过。原Task13消息/38Part/8工具/10artifact及415历史17消息/48Part/14工具/15artifact保持。原Native与复制配对均收尾。没有把同时流中切换、动态新成员和所有Rendering资格算作完成。

当前HEAD726bfa6ca；compaction脚本/记录、三索引和grant记录有其他改动，全部保留。已读416完整Recall/证据、当前SubagentConversationPanel的options/targetKey/HTTP资源/live投影/refresh与32项readingPositions合同、SubagentSessionIdentity、07-panel-reactivity、task-control-plane的同Turn兄弟dispatch及collection合同、dispatch_agent/dispatch_agents工具和当前真实authority投影。全仓调用与同语义定位沿现有源码，未读取/运行UI测试。

## 问题深度与本轮边界

已知事实：Base当前scheduler投影含dispatch_agent、不含dispatch_agents；单工具可在同一真实assistant Turn发出多个独立兄弟委派。416原输入说“可并行”，实际两位顺序完成，属于未覆盖，不据此判定调度故障。UI options以Session值和label稳定，出现第二位同agentID时label会由单角色变为角色加短标识；此前已挂载的targetKey不含label，因此应保留正文与阅读位置。流事件、HTTP追平、切换目标和成员列表隐藏仍需真实验证。

候选触发：同名第二位加入、活动正文增加、选中另一成员、暂停阅读时原成员继续生成、从文件来源回到成员、完成态收敛。可能影响选择器、live/HTTP归并、渲染身份、滚动锚点和Sources来源绑定。直接根因当前未知，不先改产品。没有公共接口/配置/schema/模型prompt改动计划，不加入host gate、伪消息、隐藏工具或绕行。出现调度/队列/恢复/并发/终态异常立即横审Task/Mission/Session全部入口、轮次、正常/终态、重启/重试、串并行及多项目；不以模型自述或单例通过排除共享根因。

## 实施前真实验收方案

复用现有member-live-rendering-412-fresh project/v1数据库。当前Node前端构建live-member-switching-417-live-bundle，正式backend /ui端口18545。新scope固定48条累计真实请求、Provider无活动180秒、Native资源上限600秒，不延长运行中的预算。Native资源上限用于进程收尾，不替代业务无活动超时。使用原审查过的413包装器、完整auth/models复制、实际credential usable/catalog projected/actualModel精确Sol预检，才由正式CLI创建真实Task。

新输入明确两位独立成员同时启动，不等待第一位完成再启动第二位；各自只read README第2/3行并直接交付约1500字中文解释，引用原始行号和“仅用于界面测试”，事实/解释/建议/示例清楚区分，无外部网络、shell、文件修改或额外成员。使用真实编排器已有工具自然实现，不修改工具权限或合成第二位。约1500字提供真实流中阅读窗口，不添加人工sleep。

先开自有页面，再创建Task，完成预检后立即进入任务。观察首成员Sources出现、第二位加入时选项名称变化、运行中切换、各自中段阅读位置、来源打开第2/3行、回到成员和终态。截图均原始保存并人工查看；AX（Accessibility，辅助功能树）/DOM（Document Object Model，文档对象模型）仅辅助定位，不自动断言UI。若没有赶上流中窗口或任务未并行，原样记录，并沿实际工具、message/Part/Provider时间核实，不能声明双成员流中通过。

只读生产SQLite checker绑定CLI接受的Task/project/request、真实两个Session、read/source Part/消息/工具结果和生命周期；以真实消息/Provider时间判断重叠，以观察时间绑定截图。诊断reader沿416使用busy_timeout=5000并顺序运行，避免同时恢复WAL（Write-Ahead Log，预写日志）。保留416完整历史并比较内容，不用可变源码哈希作为验收门槛。

发现缺陷后先补触发/根因/旧路径/调用/公共合同/数据/测试/文档/交付风险分析，再按证据修改并新独立scope复验。纯UI不新增/运行任何自动化UI测试；非UI实现另有聚焦正向行为验收。结束关闭自有页面、公开shutdown、join原Native handle、核对精确PID/出生身份及physical/output/request、退休复制配对，保留数据。更新记录/三索引、docs:check与architecture-index，范围提交、fresh fetch/merge、完整待推集复核并正常push；整体goal保持active。

## 真实失败与立即扩展的共享审计

真实Task tsk_g00VY0Dhzi00R4lvcuZT，request738bf881-b4a4-4ea1-bd72-9d3327c5fb4b，06:24:43.524请求/06:24:47.757接受，Native80656，scope live-member-switching-417-71c19625-3150-4317-a12c-fd756b882717。第一成员ses_htkLpMFoSpehJxwwF8Wt最终正文msg_g0VY0Dp700021hopL3FQ在1791959171730完成；第二成员ses_h8IVFI3Lfd9a03dfiawO首assistant消息1791959185147才开始，晚13.417秒。最初两次dispatch属于不同root消息msg_hdgEUj174iSvPrNUkNy8/msg_hgXhTqNv4ZkEPGBlpKTq，各自一条真实Tool Part。明示并发未达成，不能按模型“同一轮启动”的开场白判通过。

模型后来明确承认未并发，并以prior_dispatch继续第一成员；又一次同Session续跑依然没有重叠第二成员。截图12是重试后的状态。Root只在两位已完成且再次重复尝试后，通过产品Stop取消自有Task；不是停止整体goal。截图13/14、实际monitor failed.json保留TASK_TERMINAL_CANCELLED，公开shutdown200（4d1bb8），原81176 join13bb98 exit0，复制配对物理退休。进程正常退出不等于业务验收通过。

共享根因候选已出现明确代码链：provider/tool-call-policy.ts对@ai-sdk/openai及Azure返回串行策略；transform.optionsForToolRequest在activeTools>0时设置parallelToolCalls:false；SessionLLM在真实SDK命名空间封装前使用该值。单decision提交结束当前Orchestrator Turn；最初只有单dispatch_agent公开能力，下一轮依赖其真实生命周期唤醒。这使“同provider step多个单成员Tool”这个初始验收假设在当前OpenAI策略下不成立。06-provider合同又明确该策略不得串行化不同Session/Task/Agent/Project；集合dispatch_agents通过一个真实Tool表达完整并行集合，并用现有单dispatch物理实现Promise.all，保持单步Provider策略。

这不是已排除共享影响后的Base局部问题：全仓生产manifest扫描发现120个包仍显式授予单dispatch_agent，仅dynamic/light两个包授予dispatch_agents；精确列表存direct-entrypoints.txt/collection-entrypoints.txt。Base、Advanced、Research Studio以及多个领域包均在影响面。现在必须完成共享机制横审，覆盖Task创建/恢复、Mission创建Task/接受修复、Session绑定、初始/续跑、多项目/重复投递/重启、串行与集合正常/失败/取消终态，再决定统一实现；禁止只替换Base并宣布全局修复。当前还未修改任何产品能力/调度/Provider策略。

另一个真实现象：点击Stop后Task已Cancelled，但root正文出现Task-root activation fence rejected，status=cancelling（截图14）。这属于取消终态链的独立待核实错误归类问题，将纳入同一共享审计，不能仅隐藏红色错误框。根因未完成调查，尚未修复。

UI已有证据：02/03第一成员真实生成中可读正文并打开Sources第2行；04暂停中段，05第二位加入后同一正文位置保持且label自然获得F8Wt后缀；06显示第一位Completed/第二位Running；07/08进入第二位真实生成正文并暂停；10完成后返回同一位置；11打开第二位Sources第3行。09初始采集备注误写peer仍在生成，实际前一条AX已经Completed，observations.jsonl追加显式更正，不能用命名替代实际时间。14张原图均人工查看，没有看到重复Rendering替换，但这不证明所有闪烁已消除，也不满足同时流中双成员资格。

## 共享机制审计进度与验证边界

| 范围 | 已核对的真实合同与证据 | 当前判断/未覆盖 |
| --- | --- | --- |
| 生产入口 | 120个单成员manifest、2个集合manifest；实际Base authority-ready及所有真实root请求的tool_declarations | 并发入口缺口是共享配置与执行协议组合，禁止定为Base局部问题。用户项目安装包/作者模板还需继续追踪。 |
| Task创建与Mission来源 | server/routes/orchestrator、global-task-service、tool/panel均进EngineService.createTask；task-api/index解析creator/项目、Mission opened occurrence并冻结package revision；engine/task-package-projection按Task取不可变版本 | Mission来源并不改变其子Task的Provider/decision协议。真实本轮是单Project CLI Task，未新跑Mission/多Project矩阵。 |
| Session与轮次 | session/loop在taskRootActivation下为processor设置stopAfterAssistantCompletion；retainAssistantForNextProviderStep一旦taskRootAssistantHasDecisionReceipt为真就finish=stop/return false；普通Session无该root条件 | 单个OpenAI step只有一次Tool调用，与首个decision结束root Turn组合造成顺序。不能用跨step兄弟Tool许可推断实际可并行。 |
| 正常、重试、续跑 | 两次初始委派与两次prior_dispatch续跑均有独立不可变lineage/真实输入，价格Session接到两次续跑，第二成员仍不重叠 | 继续下发相同自然语言无法改变公开调用协议；新增轮次不是并发成功。 |
| 终态与取消 | 正式Stop写task.cancelled epoch1；assistant却存UnknownError，描述status=cancelling；规范执行终态又记录ExecutionCancellationError | 根因线索是task-root-fact-store将当前epoch/当前lease但非active状态的拒绝抛为普通Error；消费者完整类型传播与accepted-activity settlement尚须逐入口验证。不能放宽fence或遮蔽UI错误。 |
| 集合执行/恢复 | dispatch_agents单真实Tool的成员数组通过Promise.all共享单dispatch执行；checkpoint按原Tool/index持久化；recovery按原pinned package/Task/成员lineage恢复 | 现有实现可作为统一并发入口候选，正式更改前要完成授予来源、工具定义、prompt、调用与历史决定影响分析。 |
| 跨进程/并发隔离 | 官方runner执行dispatch-agents-tool、dispatch-occurrence-recovery-authority、dispatch-occurrence-cross-process-claim、dispatch-admission-fence、provider-tool-call-policy，17测试/34断言全过 | 仅后端聚焦契约；包含真实跨进程owner/claim检查，也包含局部stub，不宣称这组测试是产品UI或完整LLM端到端。多项目真实并发、集合正常/失败/重启的新版验收仍待补。 |

当前结果是**失败基线已复现，产品修复未完成**。本轮不通过只改Base、解除Provider串行策略、增加Root轮询或兼容映射来缩小问题。下一实施批必须统一当前生产包的真实集合能力与相关authoring/安装合同，再跑真实重叠请求和UI切换；取消fence错误单独完成类型/消费者正向合同与真实Stop复验。旧Task的不可变包和原始消息作为历史事实保留，不悄悄重写其授权。

## 执行证据

Node正式UI构建95266/77fe16 exit0（1m9s）。官方后端5文件runner12632/450c73 exit0，17测试/34断言。证据checker2a2ee9 exit0仅表示精确失败及来源/时序核对成功：19条Sol请求全部流式/200，18个reader EOF、最后1个由主动取消收敛为aborted；5张截图区间确实落在对应assistant生成窗口。首次两成员实际间隔13.417秒，明确未重叠。416原13消息/38Part/8工具/10artifact内容保持。

原生进程80656正常物理退出，output/request cleanup齐全，auth/models复制配对退休，自有页面39关闭。Task monitor的failed.json和UI取消异常原样保留，未写task-complete。原图、截图时间/更正、SQLite事实、实际tool声明、两类manifest路径、执行脚本和失败日志见[证据](../../artifacts/2026-10-14-live-member-switching/README.md)。整体goal active；两项已发现问题仍需修复和复验。
