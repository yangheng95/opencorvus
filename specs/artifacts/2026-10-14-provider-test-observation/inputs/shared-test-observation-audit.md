# Provider Test旧观察的共享机制横向审计

## Recall与结论边界

Root已真实观察到：声明models为空但catalog有gpt-6.1-sol时Test本地拒绝；保存明确模型后旧错误仍显示；一次真实Sol Test返回200且实际reader EOF后，中文页面仍显示固定英文；另一次自有上游HTTP400形成的旧诊断，在同ID保存新closed-port API后仍显示。本agent按AGENTS补查全部生产Test、共享LLM（Large Language Model，大语言模型）stream、Provider/model快照、Response association、取消/终态、Task/Mission/Session occurrence、重试重启、串并行及多项目。

本轮只读源码与Root提供的两份**脱敏**JSON，写此scratch。没有测试/服务/模型调用，没有读取auth/models原凭据，没有编辑产品/spec或再次委托。Root的实际截图已由Root人工复核，本agent没有另行打开图片，不能把其视觉检查写成自己完成。

有限结论：**已完成Test的旧卡片未退休，可定位为Panel对已完成观察的持有规则缺口；它使用共享传输，但没有证据表明该具体旧卡片来自仍在排队/运行的原请求。**依据不只是代码命名：Test回执与保存已被Root实际观察，独立reader数据确认真实Test已settled EOF，代码显示已完成result单独存于组件Map，后续Save不更新该Map。这个判断不等于全部共享取消、restart、Task/Mission多项目已实跑排除；下面逐项列明源码覆盖与运行未知。

## 1. 独立核对的真实源事实

只读取以下两个精确文件：

- `specs/artifacts/2026-10-14-provider-test-observation/inputs/before-independent-provider-audit.json`
- `specs/artifacts/2026-10-14-provider-test-observation/inputs/before-precondition-public.json`

原工具chunk `4ce70b`将已脱敏JSON投影到model/status/reader/identity/terminal，实际exit0；没有打印真实请求headers/body或凭据。

| 实际物理请求 | status / stream | reader与终态 | source关联 |
| --- | --- | --- | --- |
| preflight Memory | 200 / true | settled，44 chunks/34445 bytes，EOF at1791921502785 | observed，session `ses_h7wLK7kQRR7ogWre2Fa5`，真实request `msg_hmmM2XuA9qHlldNe6Gxh`，agent memory，activity `act_g0VXxfyP900VVp4SFTii` attempt0 |
| preflight Chat | 200 / true | settled，39 chunks/510604 bytes，EOF at1791921498754 | 同Session和原user request，agent chat，独立activity `act_g0VXxfysb00bjHa8VBUp` attempt0，assistantMessageID `msg_g0VXxfyQR00olWj0CZNA` |
| Root实际Provider Test | 200 / true | settled，4 chunks/6632 bytes，EOF at1791921719557 | identityState=unknown，requestContext缺席；没有伪造Session/agent |

三者实际请求model均为gpt-6.1-sol。前两条共享user来源且agent/activity不同是实际两个调用者，不是单凭命名把重复请求归为模型行为。第三条unknown与Test当前不传requestContext的代码合同一致，不能把它关联给前一次Chat/Memory，也不能称该未提供字段本身就是丢失请求身份的故障。

另一源文件确认：global/project的owned-zero Test均实际400、ok=false、modelID空、message为“Provider is not configured. Set API key or auth first.”；同次catalog实际owned-zero `apiKeyConfigured=true`、models=[]，openai effective models=[gpt-6.1-sol]。global-missing也返回同一400。这证明该前置错误不能推导为“没有配置Key”。这些是实际公开HTTP结果，但没有启动模型。

自有上游HTTP400、SDK消费、Test返回错误、保存新端点以及旧诊断仍显示的完成顺序由Root直接报告，Root已查看对应原图。当前给我的独立JSON不包含该400尝试和后续Save的完整时间线，所以本报告不虚构它们的reader计数、requestID或物理清理时间。

## 2. 全部Test入口与正式执行入口的关系

Test两条生产路由：project `server/routes/provider.ts:287–332`与global `routes/global.ts:870–903`，唯一业务函数 `provider/operations.ts:164–250`。唯一Overlay调用者是 `ProvidersPanel.handleTest:297–340`→`services/llm.testProviderConnection:426–438`；公开SDK只是相同路由客户端。两个脚本前置（expert-squad-evolution-e2e:745、run-automationbench:1616）直接调用相同HTTP，随后才创建/执行其任务，不是第三套Test实现。

Test不调用SessionPrompt、不创建Message/Task/Mission occurrence、不读写Prompt generation，也不进入Scheduler delivery queue。它是一个明确POST操作，config/Provider→getLanguage→ProviderLLM.wrapModel→共享llm/api.streamText→消费stream→返回JSON。全仓session/mission/engine/task-api/scheduler源码检索没有Test函数或Panel testResults引用。

共享生产LLM调用面已核对：

| 生产调用族 | 来源与运行owner |
| --- | --- |
| 正式Session（Chat/Work/Mission根会话、Task/子Agent会话） | 进入SessionPrompt/SessionLoop，`session/loop.ts:1947`创建SessionProcessor，`:2037/2108`绑定assistant到当前abort owner，processor:869起withLLMActivity，:926调用LLM.stream |
| Title辅助 | `session/prompt/title.ts:37–57`collectLLMText，真实首user/session，独立activity attempt，LLM.stream，沿input.abort |
| Project MEMORY.MD Organizer | `memory/project-memory-organizer.ts:278–302`source user或实际pending occurrenceID、owner.sessionID、独立activity，LLM.stream，checkpoint与原Organizer持久租约 |
| Provider Test | `provider/operations.ts:210–229`直接共享streamText，独立30秒AbortSignal，无Session上下文，usagePurpose provider-connectivity |
| Git提交信息helper | `project/vcs-commit-message.ts:89–124`EffectiveConfig与helper model，collectLLMText NonReplayable策略，直接共享streamText，input.signal/activity owner；当前不提供Response Session association |
| Metric Judge | `tool/metric-judge-runner.ts:102–136`TaskToolExecutionScope的有效config/model，inactivity activity，生产依赖绑定共享streamText；finally dispose；当前不提供Response Session association |

只有原生产metric dependencies属性调用在搜索中形状不同；其默认依赖确实导入共享wrapper。未新增非流式路径。Test旧Map不被这些正式执行入口引用，因此修它不能通过改Task/Mission状态机或LLM工具提示来“解决”。

## 3. 模型与配置快照：共享缓存不会回写Panel结果

Test operations:177先取一次scope.config；scopedProvider/scopedModel/scopedLanguage都传该config。`Provider.stateFor:690–701`与globalStateFor:704–715做Config.Info.parse快照及canonical source缓存，project显式cache按currentProjectDirectory隔离；global有独立cache。失败构建会删除对应cache entry。模型接口从同一state按provider/model键解析，不从Panel Map取得任何数据。

`getSDK:899–919`由state.config、原provider options/key及model构造baseURL/headers；`:956`创建闭包捕获该次options、fetch和容量resource。`reset/resetAll:718–726`只是丢缓存供之后读取，不会改写已经发出的request闭包，亦没有“旧请求结果清理Panel Map”的通道。已发请求沿其原配置结束是正确因果，不应为了新配置保存把旧结果改写成新端点测试。

Auth/canonical catalog不是整次Test里与Config锁在一个大事务的快照。provider state构建会读取当时的Auth，操作中reset后可重建；getSDK还独立确定实际credential generation。现代码保证请求构造选定的闭包，不足以宣称跨任意并发Auth/catalog变更都具有统一原子snapshot。Root这次提供的reader记录只有实际model与执行身份，不包含API/Key原子读取证据。本次已完成卡片问题不需要修改这个更宽的读取合同。

`ProviderLLM.wrapModel`每次返回包装language，WeakMap保留请求时Provider.Model用于usage；它不保存UI Test成功状态。相同Provider/model上的多个包装、usage和response observer各有原对象身份，不将上一次Session结果赋给下一次Test。

## 4. Response association横审

`session/llm.ts:178–219`从真实user.id或requestID建立StreamRequestIdentity，包含agentID/providerID/modelID/apiModelID，与sessionID/activity一起显式传Provider.getLanguage。`provider.ts:1220–1228`在首次await之前冻结复制context。带context的language和SDK不进共享缓存（:946、1243、1251）；context-free Test保留原缓存合同。

`util/provider-response-observation.ts:26–56`是临时WeakMap<Response, observer>：只绑定确切Response对象，重复注册是具名冲突；take消费该对象绑定。回调异常转onObservationError，不替换原物理结果。它既不按“最后一次Provider ID”索引，也不读取Panel testResults。

Provider fetch的实际Response在:1095取observer，既有source reader读取时计chunk，:1115/1132给它当前闭包context，终态:1099–1104先发布真实settlement再释放capacity。HTTP非成功在:1059–1092消费实际错误body并抛APICallError，不伪称已绑定成功stream；通用fetch异常路径释放capacity后rethrow。当前架构06-provider:216–233明确无body/HTTP错误/fetch失败/未绑定分别保持未知，不按上一会话猜context。

真实脱敏artifact证明同Session的Memory/Chat具备不同实际agent/activity，context-free Test的reader是unknown且已EOF。这足以反驳“Test卡片实际上拿到了上一次Chat/Memory的Response association”作为当前三请求事实的解释；不能据此推断所有多项目/延迟SDK重试均已实测无错。

## 5. 正常、异常、取消、重试、重启与容量

### 共同物理层

所有上述生产SDK fetch在`provider.ts:960`进DurableExecutionCapacity。resourceKey由Provider ID、实际credential generation的非明文身份和language-model class构成；故同一data root、同Provider/凭据的不同项目**有意共享**容量上限，不是项目串线。没有Task、Session、UI Test状态在容量表中。

`runtime/durable-execution-capacity.ts`以leaseID/ownerID fence入表和续租；等待饱和槽的循环:118–127响应调用方abort。当前lease30秒、每10秒续租，release幂等且保留expiry作为崩溃边界。异常续租abort所属capacity signal。下一次真实fetch重新admit；这个轮询不是重新发送模型请求或业务Scheduler queue。

`settlementTrackedReadableStream:145–214`只拥有一个upstream reader。EOF/读取错误/consumer cancel/owner abort争同一个beginSettlement；结束回调只一次。abort先结束下游，再等reader.cancel实际resolve/reject后发布aborted；consumer cancel同样await原cleanup。Provider终态callback在finally release capacity。`abortableIterable:264+`使阻塞iter.next响应abort并避免消费端无限等待，底层清理由原reader仍负责。

这些代码没有任何路径把“stream未释放”转成已完成Test Map缓存；反过来Map清空也不能释放/取消物理reader。Root提供Test reader settled EOF说明该次物理reader已正常结算；capacity release函数按该callback会执行，但本轮没有读取容量表证明无其他租约、release持久化无失败，也不能把EOF证明扩成全进程停机完成。

### Test

唯一wrapper `llm/api.ts`把SDK maxRetries固定为0。Test没有withLLMActivity或durable retry occurrence；30秒信号从streamText调用阶段起约束流与fetch容量等待，Config/SDK准备更早部分不在这段信号内。正常EOF返回业务结果；stream error/throw形成实际失败，AuthReadError仍保持typed503。路由没有把浏览器关闭/HTTP离开自动接到这30秒signal；UI ownership退休仅抑制过期呈现，不能宣称原模型已物理取消。进程重启不会持久恢复/自动重发某次Test，旧物理容量由lease expiry处理。

### Session / Task / Mission occurrence

SessionProcessor:869–880以原input.abort进入withLLMActivity；每attempt有activity id/attempt与同一assistantMessageID。LLM.stream使用run.signal。processor:916–924 join SDK prepare Promise后才允许attempt cleanup，:1497–1501在异步chunk handler之后再校验abort，防止旧handler继续推进。活动重试:807–867按attempt scope保留/处理Parts，再由统一activity层beforeRetry/退避/新attempt执行；不是SDK暗中重放。activity:498+保留单次terminal，external abort、budget、非重试错误和重试耗尽都有明确结算。

SessionLoop:2953–3002按具体abort owner和callbacks/pending controls/wakes决定是否继续同可复用Session，停止时beginTermination并await finish；PromptState以directory/session/owner generation匹配，finish:1143统一terminatePromptResources。已完成一次输入不等于可复用Session彻底dispose。Task runner:1457+把真实user/message/model与WorkerTurnDescriptor在原权威bundle内落盘，:1743–1753捕获精确prompt owner并continuePersistedPrompt，不调用Test。Mission根会话沿SessionLoop；host-recovery:108–131先处理delete/closing/closed，再按持久Mission occurrence恢复，不能由某张Test成功卡唤醒。

重启恢复由 `engine/host-recovery`、`mission/process-recovery`、SessionLoop现有已持久Message/控制/Tool occurrence处理；Panel Test Map是组件内存，不在任何这些表或恢复入口中。并行Task/子Session彼此有真实Session/Message/StreamRequest identity；同一Session串行/重用由Prompt generation与回调匹配持有。多项目Config state按directory，Task/Mission恢复按各项目Instance进入；物理Provider容量跨项目共享是明确单一资源策略。

本轮没有运行重试、进程重启、Task/Mission恢复、cancel或两个项目同时Test；源码覆盖不能宣称这些路径全部验收通过。若下一阶段出现原请求未结束、错误association、容量槽卡住或停机未收敛，应继续这个共享机制审计，不得让局部Map改动遮蔽它。

## 6. 旧Map的因果闭环与修复隔离边界

Panel `handleTest`await完整控制HTTP后把result写 `Map<providerID,result>`，finally按当前owner清testing。Map没有backend订阅、持久化或TTL，也没有新端点/Key事实的比较；正常scope/authority/selection变化才清全Map。Save/Key/认证/目录刷新没有目标Provider Test退休动作。Root看到不同新API旁仍显示上一次已完成HTTP400诊断，与这一确定数据流完全匹配，即使没有任何并发也会发生。

针对**已完成旧结果**，共享排队/取消机制不是这个值继续存在的必要原因，当前实际EOF也排除了该Test仍在流式等待作为解释。针对**in-flight变更晚到覆盖**仍是待真实资格的另一边界：原请求正确继续结束，但UI必须按其旧观察owner决定是否还能写当前行；不能把真实旧请求改记为新端点成功。

最小方案应只复用现有Test per-provider generation并结算它自己的testing/result，保留实际旧HTTP/Provider结果作为旧观察的事实。不能用共享providerTestScopeGeneration处理单ID变化，因为providerLoadOptions（Save/Auth/refresh也用）捕获这层，递增会使保存尾部读取一起退休。不能用旧request的finally清除新owner busy，不能复制结果到当前无生产setter使用的appStore.providerTest形成第二来源，也不能通过重启服务/取消所有Session隐藏旧卡片。

如果只处理已完成Map，仍须明确报告in-flight变化未完成；若完整处理，Root可用自有可控响应参与者延迟实际Test响应、先经实际公开Save提交新API，再放行旧响应，检查当前行的结果/忙碌事实。该资格保持真实HTTP/SDK，不能拦截response或mock UI；不需要真实模型费用。任务/内存等共享终态异常一旦出现则按上节扩大。

## 7. 已有测试与真实证据还缺什么

只读发现下列原测试可为后续聚焦checker提供范围参考，不是本轮运行结果：

- `provider-request-association.test.ts`真实本地HTTP+生产Provider/SDK，覆盖并行same-model不同caller、延迟使用后保持冻结身份、context-free正常缓存、一个SDK多step的同caller。它直接使用SDK来审计transport，不是完整Session/Task/Mission验收。
- `provider-response-observation.test.ts`覆盖确切Response、真实reader异常、等待upstream取消、EOF及callback隔离；含真实本地HTTP案例和原生ReadableStream局部案例。不能用局部流夹具替代当前进程shutdown。
- `durable-execution-capacity.test.ts`有降额后精确槽owner、饱和等待abort正向结果；本轮没运行。
- `session/prompt-cancellation-occurrence.test.ts`包含production shutdown跨两项目、精确active input和已settled input历史、public abort；`execution-occurrence-lifecycle.test.ts`覆盖可复用Session连续输入、精确owner settlement/终态publication；存在如`expect(released).toBe(false)`的原等待阶段断言，若Root选择修改/运行应先完整按当前正向要求复核，不把搜索到的整文件自动视为合格全量回归。
- `runtime-startup-recovery.test.ts`、Task/Mission crash-check等更宽恢复检查属其他并行owner/既有验收，不能为本Test Map修复擅自运行或改动。

现有实际artifact只涵盖同一preflight Session的Memory/Chat和后续Test三条正常200/EOF，以及两scope零模型400。尚缺本轮独立的in-flight变更/取消/错误流reader/跨项目并发/重启/容量表/最终server stop事实；不能填成“全部通过”。Root已完成的长错误与新端点旧卡片视觉事实可以支持已完成Map根因，但不补足这些未运行边界。

## 当前交接

共享调用/快照/association/流终态/容量/正式occurrence恢复路径已经一层只读横审；三条真实脱敏请求和两scope前置400已独立核对。可以将**已完成观察在同ID事实变更后仍被当作当前观察显示**作为本批确定修复范围，同时保留in-flight与物理取消未知。不要写“共享机制完全无问题”；当前证据只排除了共享未结束原请求作为这张已完成旧卡片继续显示的根因，不授权改变共享队列/恢复/模型协议。
