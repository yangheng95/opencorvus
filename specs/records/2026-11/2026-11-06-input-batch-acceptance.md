# 同轮输入与回复接纳记录

## Recall

- 原要求：提问数量、文件修改摘要和中文要清楚易懂；持续自主排查，只用一个 agent（代理），真实页面验证后提交推送，不操作用户窗口。前批已分别交付回答数量、路径阅读和工具摘要，本批追查实页发现的历史“等待中”，不回头修复已解决的闪烁。
- 当前来源为 main 的 d651c600；开始状态177项均为其他工作，必须保留。不得操作18571、真实用户数据库或窗口；不创建分支/工作树，不发布版本。历史消息和回复事实不可改写。
- 已读：当前02-data、task-control-plane、07-panel；2026-11-02-execution-navigation、2026-11-06-tool-result-language；session loop/message/index、prompt parts、Task-root message delivery、orchestrator agent/ingress delivery、Task/Session conversation routes和现有pending-delivery/failed-history-replay测试。
- 全仓搜索：pendingDelivery的写入在prompt/parts，消费在Session.beginAssistantReplyWithCommit；接纳集合由SessionLoop产生，Message.acceptedInputMessageIDs供完成回复、协议回执、历史投影共用。Task和普通/Mission Session的conversation均调用同一projectConversationAgentView。没有委托。
- 验收：混合输入必须在同一真实assistant接纳集合中按时间顺序完整保存，最后一个仍为parentID；原消息和排队语义保留。聚焦正向数据测试、真实原生开发运行及隔离页面截图人工复核；不运行UI（User Interface，用户界面）自动化测试。

## 现象、证据和根因

原Task“批准后提交801”最终completed，但其同一orchestrator Session内Mission消息8MGR仍投影为pending。旧导航修复只改善身份和定位，明确保留原状态，没有解决接纳事实。

只读退休的962-after副本：原输入8MGR有真实scheduler投递来源与sequence 107、Task epoch 1的第三条不可变ingress；它在1793302972378可见，控制输入hbZ9在下一毫秒可见。随后assistant hqbWzH08YAlTKHDJmkv1只接纳控制输入。真实原Provider（模型服务）流式请求1793302973341的尾部有两条连续user输入，分别1308/1202字节；这些仅为输入结构证据，不能把摘要字节数当作消息身份或内容校验。原始消息、ingress及接纳集合分别保存在不提交的调查文件中。

直接代码缺陷：loop在deliver非空时把acceptedInputMessageIDs直接设为deliver.map；但deliver只含带pendingDelivery标记的输入，visible同时还可能包含最新assistant之后刚可见、没有此标记的其他输入。Task-root真实参与者的跨Session转移保留作者与身份，并不走prompt的排队标记写入；随后控制输入走prompt，可带该标记。因此同一可见批次的另一条真实输入可能未进入接纳事实。普通对话并发首次写入与排队输入混合也具有相同风险。模型是否实际理解某段文本不参与该判定。

尚待运行证据：真实复现混合标记及新接纳集合；协议收据/终态、重启和项目隔离的横向审计结果。不得把既有completed任务或零请求启动冒充这些验收。历史记录不可凭“任务最终完成”补写accepted IDs，也不把pending直接改成completed。

以上为实施前未知项；下面按实际验收更新，不追溯改写原调查判断。

## 影响面与实施方案

1. 复用currentUnacceptedInputBatch一个集合算法：按原visible顺序，合并当前释放的pending输入和最新assistant之后的全部user输入。保留parentID尾部及同一Turn内冻结的集合，不改变模型消息、队列分区或owner生命周期。
2. deliver为空时仍优先恢复精确failedAcceptedInputBatch；有新投递批次时纳入其完整可见新输入。旧路径中的deliver-only选择同步删除，不增加另一份状态或历史兼容路径。
3. 聚焦正向数据测试覆盖混合输入、早于前一assistant的排队输入、并发首次输入、已答历史后的输入、失败精确批次。检索到的session测试为后端协议测试；移除本任务触及的空集合/不置位等负向核心断言，改以明确正向输出验收。测试不导入UI、翻译或DOM（Document Object Model，文档对象模型）。
4. 横向核对所有生产入口：Task根输入/worker；Mission根输入、协调投递与恢复；普通/side-chat Session；正常、失败重试、terminal、owner死后恢复、串并行与多项目。共享Session实际acceptance事务和completed-reply查询必须保持单一事实来源。未能实测的分支明确列为边界。
5. 修改02-data当前接纳合同；不改数据库schema（结构）/持久格式，不改历史数据，不增加模型调用非流式路径或host（宿主）工具路由。风险是错误扩大接纳集合或破坏retry；须用顺序、精确身份及实际回复事实验证。

## 资源与验收计划

在创建任何服务、凭据副本或数据库副本前，将共同绝对截止和资源端口写入私有batch-deadline.json。最多60分钟，保留至少5分钟正常收敛；隔离旧数据只读页面38804（0模型请求），独立新项目的真实流式验收38805（最多8请求），可选同源复核38806（0请求）；累计基线1461。复制凭据时同时复制完整模型目录，分别验证账号、目标模型投影和实际请求模型，秘密不得进入spec、提交或工具输出。不扩展原截止；失败保留原证据。

既有提问/文件/工具摘要与新输入状态在真实开发/ui页面人工交互、截图查看。全部服务通过正常shutdown退出并核对原句柄、物理资源及请求结清；移除本人配对凭据副本。当前docs检查与后端类型检查，范围清晰提交，fresh fetch、普通合并、审查待推全集、正常hook推送，保留其他177项状态。持续目标保持进行中。

## 实施与验收结果

已按单一集合算法实施。首次直接bun test误用默认5秒，双项目流式失败历史验收被截断；改用仓库run-tests标准隔离运行器（原生60秒预算）后12项队列/接纳、1项双项目失败历史及压缩共46个断言通过，没有修改测试超时或以模拟服务冒充真实Provider。

首个真实Provider checker在调用模型前因本轮脚本漏传PromptInput当前必需的author字段被Zod明确拒绝，0次模型请求。该实例正常shutdown 200、原句柄exit0、物理结清及成对副本退休；失败收据保留。已核对当前schema并补齐真实user作者。在分配前声明一次纠正后的live-recheck：重用已释放38805端口、新的独立空数据目录，仍用原共同绝对截止及全批最多8次请求（首个实例为0），不增加预算、不复用旧证据；保留初次数据库。这个重跑用于修复验收脚本，不是产品成功证据，结果另记。

### 共享机制审计和验收

- 原protocol_delivery_receipt明确为task_ingress，message_id=8MGR、ingress_id=第三条hbZ9，对应真实投递；不是丢失收据或只凭标题判断。原库五类Session均有接纳数组：assistant 411、build 70、delegated-worker 131、mission 210、orchestrator 28条，证明该字段是跨角色协议而非本页私有状态。
- 直接生产loop入口全仓核对：orchestrator/agent、session路由两处、session/wake及shell resume；SessionPrompt.index/run把普通对话、Mission和projected worker的prompt交给同一loop。输入分区、owner与终态发布未改，唯一集合写入仍为beginAssistantReplyWithCommit同一事务，逐条验证Session归属。completed-reply的SQL（Structured Query Language，结构化查询语言）与内存读者均使用同一accepted ID数组，不新增状态来源。
- 正常轮次在processTurn前生成集合，同一runActiveTurn内保持冻结；stop并进入下一批时才重置。deliver为空的失败重试仍先读取failedAcceptedInputBatch，新增正向断言验证精确双输入身份。owner死后恢复仍由原physical occurrence和数据库pending输入判断，未改并发接管、重试次数或终态约束。Task/Mission epoch、协议receipt与终态拒绝均保持原权威。
- 新增纯后端数据用例覆盖混合标记、早于前轮末回复的排队输入、交错顺序、并发首次输入、已答历史及精确失败重试。最终仓库标准隔离运行器：13项接纳/队列17断言、1项双项目失败历史/压缩30断言，共14项47断言通过。后者使用本地流式Provider，仅证明该后端链路，不算真实OpenAI验收。
- 修正author后的Task测试构造把普通对话loop置于真实Task所有权之下，现有权限合同正确拒绝“no explicit runtime Task authority”，仍为0模型请求。保留拒绝，不绕过Task授权；一次生成路径重复后缀也被启动预检拒绝，未创建服务。随后把验收范围改为普通Session共享批次，两个独立项目并行真实流式调用4次通过。两种标记实际为participant=false、queued=true；回复明确接纳各自两条ID，且包含各自原输入的独立标记。
- 内部Session未声明产品入口，不能以其成功冒充页面。修正脚本使用当前createRightSidebarConversationSession及applyRightSidebarConversationPromptOverlay正式创建/提示合同，在剩余4次预算内重做两个项目；公共selection均idle，conversation及SSE连接快照各为两个真实执行，第二个执行包含两输入和同一实际reply，精确一致。04/06实图已人工查看，两项目原标记和回复对应，累计8次全部gpt-6.1-sol、流式、200、reader结清，累计1469，不超原8次/共同截止。
- 38806在已声明0请求额度下，从已正常关闭的正式对话库冷启动。实际公共HTTP/SSE再次验证两批接纳和执行身份，agentView与关闭前精确一致；92表1570行逐行完全相同。首次汇总脚本错误套用旧大库固定新增两条租约的假设，实际冷读没有新增；删除这一不成立的固定增量断言，保留逐表完整记录比较，不以自算摘要或启动日志代替行为验收。

本轮确认并修复的是共享输入集合遗漏，未将其降级为单一Task问题。边界：没有实测完整Task/Mission编排、混合批次遇自动压缩、崩溃时未完成owner恢复、所有取消分支。失败历史/压缩用例覆盖已有协议，不能证明这些混合场景；继续审计，不声称全部调度路径已排除异常。旧8MGR缺少原接纳记录仍保持原貌，未通过迁移、补写数组或修改状态标签抹掉历史事实。

### 页面、保全与交付

本人隐藏38804原生/ui实页复核原部分问答：3题、2已答、1留空，各原答案相符；重命名记录实际可见原路径/目标路径，3条修改记录、6行新增/3行删除及类型/差异清楚。01—03截图已人工查看。04—06为上述正式对话新结果，05包含悬浮遮挡，06才为无遮挡复核；不把短暂“正在渲染”误报为旧闪烁复发。

原309209→309211行只新增一对正常控制租约，schema10/92表、129项目文件/Git（版本控制）与299附件、源数据库和原认证/完整模型目录保留，零文件系统豁免。全部六个实际服务实例正常shutdown 200、原native句柄exit0，物理/输出/请求结清，12份配对认证/模型副本退休，最后关闭仍有2187990毫秒余量；本人三个浏览器页已关闭，未操作用户窗口。没有新增UI自动化、数据库格式/版本或发布改动。

格式化器曾调整loop无关区域；保存并审查差异，确认该文件开始时干净后，仅保留三个接纳相关修改块，恢复其他原格式。最终后端类型与文档检查通过。三索引、本记录和[实图/资格](../../artifacts/2026-11-06-input-batch-acceptance/README.md)同步；范围清晰提交、上游普通合并和正常推送按Git实际回执收尾，持续目标保持进行中。
