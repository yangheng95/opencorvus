# 393 用户资源空内容与公开Session附件项目绑定

## 当前状态与Recall

本批完成四文件生产修复、62项/351断言后台绿测、核心typecheck与文档/格式检查。root执行的真实GPT-6.1 Sol **scope04已完成正常Global Chat首条→公开Session附件续聊、13有序Parts/2空text/3真实SDK读取、0/32/34字节、9次精确流式HTTP200 EOF，以及目标UI（User Interface，用户界面）三截图人工复核与0/32字节真实下载**；原native/MCP owner均正常结束并完成配对凭据清理。scope01仅程序化Session后台成功而UI缺入口；scope02仅Global首条成功，第二条未提交；scope03为Provider overloaded preflight失败。所有原失败与收尾独立保留，不合并冒称一次通过。完整[安全归档与证据索引](../../artifacts/2026-10-13-mcp-user-resource-input-393/README.md)已建立。最初只读方案与代码推演保留如下，分阶段实际结果在文末；本agent未改共享文档、使用真实凭据/模型/浏览器、提交或再次委托，真实运行及页面由root完成。

用户持续目标要求每批先分析根因/影响并落盘，再实施、真实验收、提交和正常推送。390已完成MCP（Model Context Protocol，模型上下文协议）工具结果空text/blob、audio和resource_link物化，明确保留用户输入 `session/prompt/parts.ts`。后续只读发现：该输入分支仍拒绝合法空资源；公开SessionPrompt又缺少内部必须的byteMaterializationProjectID，影响不止MCP，还覆盖普通已上传附件、data URL（统一资源定位符）和本地二进制文件。本393必须同时分析这两层，禁止在物化器fallback到Instance.project.id，禁止拿内部调用传入项目ID的测试冒充公开API（Application Programming Interface，应用程序编程接口）修复。

验收目标为真实SDK（Software Development Kit，软件开发工具包）resources/read的合法空text、空blob和混合项在正常用户输入路径完整物化；公开Session prompt用已验证Session的真实Project绑定附件写入/引用校验，保留外部schema、请求身份、重放、来源、原始正文、附件字节与跨项目隔离。空资源修复不放宽图像/普通inline上传的非空合同，不扩大模型音频/文件传输能力，也不自动获取resource_link URI（Uniform Resource Identifier，统一资源标识符）。

已重读390 Recall及当前04-extensions、07-panel、capability-search-runtime相关资源/输入/附件合同；读取全部PromptInput生产入口、Session公开路由、Command/init、SessionWake、runAgentSession、Task输入附件/消息bundle、GlobalChat/Mission、CLI、ACP（Agent Client Protocol，Agent客户端协议）、Overlay发送者、MCP readResource、App读取/下载/HTML入口、Message模型消费、AttachmentStore和两个Base64 decoder。当前HEAD只读观察为 `f48d1c69c`；并行UI/文件工作台、共享索引等修改由其他任务拥有。实施前须重新核对工作区与调用事实，不覆盖同伴改动。

全仓搜索覆盖 `SessionPrompt.prompt/persistNoReplySequence/continuePersistedPrompt`、`runSessionPrompt/materializeUserMessage/createUserMessage`、`SessionWake.wakeWithReceipt`、全部byteMaterializationProjectID定义/调用、`ResourceSource/clientName/MCP.readResource`、readResource/App通路、公共FilePart schema和各文件分支。没有发现本轮实际调度、队列、恢复或终态收敛异常；输入失败和代码中的既有重放机制不等于新的调度异常。若后续运行发现此类异常，立即按AGENTS共享机制要求横审，不能归因单个MCP用例。

## 可观察现象、直接触发与证据等级

当前仅代码可确定的输入输出推演，未运行新的SDK或HTTP（Hypertext Transfer Protocol，超文本传输协议）探针：

| 真实路径接受的输入/服务器结果 | 当前控制流结果 |
| --- | --- |
| 用户FilePart.source为resource，resources/read只返回 `{uri,text:""}` | parts.ts要求text.length>0，最终抛 `MCP resource <client>/<uri> did not return usable text or blob content` |
| 同入口只返回 `{uri,mimeType:"text/csv",blob:""}` | blob真值判断跳过，抛相同错误 |
| contents内有效正文加空blob | materializedResourceContent被正文置true，整次返回成功但零字节文件未物化；空项被静默漏掉 |
| 公开Session message提交合法非空MCP blob | 进入AttachmentStore前 `requireByteMaterializationProjectID` 抛缺少内部项目绑定 |
| 公开Session message提交同项目规范 `/attachment/...` FilePart | 即使真实字节已上传，requireReference前也抛同一缺失项目绑定 |
| 公开Session message提交合法非空data URL或file://二进制 | 解码/读路径进入相同项目要求，不能完成正常附件物化 |

空资源问题不能归因SDK拒绝：安装MCP SDK1.31.0的 `dist/esm/types.js:739` 为text使用z.string()；750–765的Base64Schema以atob校验，空串合法；900–901的ReadResourceResult.contents与1109的EmbeddedResource使用同一Text/BlobResourceContents union。390的真实工具回环和0字节存储证据已证明底层存储接受空文件，但它没有实际覆盖本用户输入链，不能挪作393成功验收。

这些错误发生在materializeUserMessage完成之前，`runSessionPrompt:174–175`尚未提交用户Message/Part bundle，因此连同本次其它正常输入也不能整体成为已接受消息。混合有效项可能掩盖遗漏。注意AttachmentStore字节写入先于消息bundle：同次并行parts中已成功处理的文件可能已经落库，不能声称所有文件和消息拥有同一个回滚事务；继续既有引用/垃圾回收合同，不在本批另建回滚系统。

## 根因一：空内容被当成不存在

`session/prompt/parts.ts:425–503`识别真实resource source，按clientName/uri调用 `MCP.readResource`，然后用 `typeof text === "string" && text.length > 0` 或 `blob`真值判定。前者排除合法空文本；后者既排除空blob，直接改为string判定后又会遇到严格raw decoder的非空要求。这是MCP资源语义到用户Part表示的边界遗漏，不能只改一处布尔条件。

`mcp/index.ts:4189–4217`绑定当前配置中的exactConnectedRuntime，并让官方SDK client.readResource验证结果与超时，失败原样抛出。没有内容猜测、URI自动转换或局部缓存。SDK返回固定contents数组；parts.ts现有把单个object包成数组的兼容写法在合法SDK返回下不会被使用，不应作为错误服务器结果的另一合同。建议同范围改为直接消费typed contents，保留空数组的明确“无可用内容”错误；这是移除可证明多余的输入形状fallback，需root随方案明确批准。

当前用户包装是每个resource source先写真实Host读取说明，再按服务器顺序放入原text或规范FilePart；blob继续保留resourceSource、调用者filename、返回MIME优先/输入MIME次之以及同一项目附件。修复应保持这些消息事实，不能改成伪Tool结果或重新调用工具结果序列化。

## 根因二：公开入口剔除内部绑定，却未由可信owner补回

`server/routes/session.ts:248–260` 的PublicSessionPromptInput明确omit byteMaterializationProjectID。这符合外部不能自报字节归属项目的约束，不能把该字段重新暴露给调用者。

同文件571附近的preparePublicSessionPrompt已调用 `getActiveProjectSession(sessionID)`；该唯一helper通过 `Session.assertLineageInProject`验证当前项目与Session谱系。随后它构建 authoredPrompt，只补author/extra/agent，未写byteMaterializationProjectID；545行executePublicSessionPrompt原样交SessionPrompt.prompt。`session/prompt/index.ts:81`仅解析原输入并进入runSessionPrompt；prepareUserMessage只准备配置、Session身份与模型，不补该字段。物化器56–59行则明确要求调用者提供绑定。缺口在公开输入owner向内部合同的交接，不在AttachmentStore、模型或MCP传输。

正确绑定来源是这里已经验证过的 `session.projectID`。不能在低层物化器根据当前Instance、URI项目段、文件目录、MIME或SessionID重新推断。公开请求的body fingerprint仍只计算调用者原始语义，随后由authoredPrompt补私有项目字段；`applyRightSidebarConversationPromptOverlay`保留其它字段，准备/持久化应始终使用同一已绑定input，不形成第二来源或修改重放身份。

## 所有公开prompt入口与内部owner矩阵

| 入口/消费者 | 当前调用与绑定事实 | 393边界 |
| --- | --- | --- |
| `POST /session/:sessionID/message`、SDK session.prompt | 唯一PublicSessionPromptInput→preparePublicSessionPrompt→SessionPrompt.prompt；缺byteProject。Standalone/assistant/Chat/Work与可准入的Side Chat共用；Mission和projected worker另受现有公开授权规则限制。 | 修公开owner一次，保持稳定messageID及现有授权；所有受准入的file类型共享修复。 |
| Overlay已存在Chat/Work续聊 | services/chat.ts的sessionPromptParts把真实已上传附件变为canonical FilePart+attachment-index；promptSessionMessage:272调用上述route。RightSidebarConversation路由只创建/选择/关闭会话，文档明确prompt/history复用canonical Session route。 | 普通附件是真实活跃消费方，不能只测MCP。 |
| SideChatPanel | 319附近调用相同/message，当前UI提交只含text。 | 会受route内部修复覆盖，但当前UI文本不触发字节缺口。 |
| MCP App `ui/message` | McpAppArtifact:413明确只接受非空user text，经promptSessionMessage发送；文件内容在该桥接消息入口被拒绝。 | 同一route但不是现有附件触发来源；不宣传App发音频/资源输入已修复。 |
| CLI `run` | cli/cmd/run.ts:328建立file://parts，665由正式SDK session.prompt发送。 | 二进制文件受影响；文本/目录见下表；`--command`进入已绑定Command。 |
| ACP普通prompt | acp/agent.ts:1661调用SDK session.prompt；图像/data URL、嵌入blob及file链接转换后的file parts可能进入字节分支。 | 项目缺口影响这些非空附件；ACP空内容另有上游适配遗漏，不随下游修复自动解决。 |
| `POST /session/:id/command` | SessionCommand:159–175取已存在Session，将template和调用者FilePart合并，显式传session.projectID。 | 已满足项目绑定，仍会遇到用户MCP资源空值问题；作为公开对照入口。 |
| `POST /session/:id/init` | SessionInitializer→SessionPrompt.command→上述Command绑定。 | 没有独立FilePart schema，不需新增绑定路径。 |
| `POST /session/:id/shell` | SessionShell独立命令输入，不接收Prompt FilePart。 | 排除，禁止顺带调整执行/重放。 |
| 全局Chat首条 `global.chat.start` | materializeUserUploadParts在已分配项目内生成canonical附件；global-chat-start:380调用SessionWake，后者171显式byteProject。 | 不缺同一字段；原上传非空合同保持。首条成功不能证明续聊附件正常。 |
| Mission dispatch/wake、Panel mission输入 | dispatch纯文本；wake先materializeUserUploadParts，再SessionWake（mission route:758–787）；Panel同样传既有附件到Wake。 | 字节绑定已显式提供；不更改Mission授权或调度。 |
| Task创建/根message/resume | task-api的materializeApiAttachments接收显式projectID；buildTaskSessionMessageBundle直接以验证后的refs持久化attachment-index，不经此Prompt文件分支。 | 独立正确owner，不能更换为SessionPrompt路径；保留项目/Task归属。 |
| Task worker operator-steer | 专用文本输入，执行时走projected worker/runAgentSession。 | 不提供任意用户ResourceSource；无据扩附件协议。 |

当前route注释/类型仍出现prompt_async字样，但全仓未找到第二个活跃公开prompt_async路由；不得臆造另一个待修接口。通用Message/Part更新接口只是已有事实操作，不是新Prompt物化入口。

内部生产调用也已横查：runAgentSession以真实session.projectID为绑定，若上游显式值不同则拒绝；build、orchestrator、Mission恢复、Control和GitHub CLI均显式传对应Session/Task项目。SessionWake统一显式绑定当前已拥有的项目，再供global Chat/Mission/automation/continuous-goal等调用者使用；它不是物化器fallback。delegate_agent只构造text，因此没有byteProject是合理的；Tool.Context的prompt passthrough没有另一个file producer。已持久化continuation/replay消费规范消息，不应再读取用户资源或重新推导附件。

### 附带前端形状线索（不作为本批已证实活跃入口）

`overlay/services/task.ts:617` 的导出submitMessage分支把附件放在顶层attachments，和严格PublicSessionPromptInput只接parts不同。但当前全仓只找到该函数定义，没有生产调用者，尚不能把它称为活跃UI缺陷或本项目绑定错误的触发证据。此次记录事实，不改该文件、不扩大清理；若以后接入需按真实公共schema统一。活跃chat.ts路径已正确组装FilePart，独立受byteProject缺口影响。

## 所有FilePart字节与消费后果

| parts.ts入口 | 处理和项目需求 | 当前缺口/修复限制 |
| --- | --- | --- |
| MCP resource text | 原string成为text Part，读取说明保留source URI；不写附件。 | 空text被误拒/遗漏；接受空string后规范Message.TextPart本身允许空串。 |
| MCP resource blob | 返回MIME优先、part.mime次之；AttachmentStore.write需byteProject；规范file保留source/filename。 | 空blob需显式0字节；非空也受公开绑定缺口影响。 |
| canonical `/attachment/<project>/<name>` | 不论text/image/PDF/其它MIME或attachment-index标记，均先requireReference(projectID,url,mime)。 | 已上传的普通文件、零字节引用同样缺绑定；修复后仍应按真实Session项目验证外来URL、MIME、大小、完整性。 |
| `data:*;base64,...` | decodeDataUrlBase64Bytes严格校验，再write需byteProject。 | 正常非空字节受绑定缺口；空/损坏data URL仍按既有明确错误，不因MCP资源支持空串而放宽。 |
| `file://`非text/非directory | writeFromPath需byteProject，返回canonical引用并保留Host文件上下文。 | 二进制/PDF/图像等CLI/程序输入受影响；不改文件读取或MIME策略。 |
| `file://` text-like | 归一到text/plain，以真实executionAuthority执行ReadTool，检查完整读取或显式start/end范围。 | 不经过四个requireByteMaterializationProjectID点；Read可能返回自己已拥有的附件。保持字符/行预算及明确范围错误，不能用该成功对照说明所有文件正常。 |
| `file://` directory | 同一Read工具读取目录，超过完整结果预算给明确错误。 | 不依赖本字段；不改变目录引用或枚举合同。 |
| HTTP(S)/其它URL | 当前没有这里的byte materialization分支，原FilePart继续向下游。 | 不能因绑定修复宣称支持远程fetch；模型侧需要canonical URL的媒体合同可能另行拒绝，属未在本批实测的既有边界。 |

Message.toModelMessages对用户普通text保留正文；手动上传attachment-index给名称/MIME/规范引用；canonical文本附件仍给可Read引用。二进制只在目标模型已有图像/PDF输入能力时进入typed文件通道；音频等并不因为本次资源物化自动增加Provider支持。0字节CSV可作为真实文件存在，不等于0字节图像/PDF是有效媒体。测试应以可合法表示空内容的text/CSV/octet-stream证明资源语义，不把空媒体送入Provider后失败冒称绑定回归。

## MCP App、ACP与跨入口等价性

`MCP.readResource`及CallToolResult嵌入resource的Text/BlobResourceContents来源相同，空blob→零字节、非空→现有严格raw解码这一个后端字节合同已证明等价。两处文本/附件包装不等价：工具结果拼接正文并携带isError/预算/恢复/原content；用户输入产生真实user Parts、保持读取说明和ResourceSource，MIME与filename默认值也不同。不能把parts整体送进materializeMcpToolResult。

MCP App host的resources/read原样转给SDK（mcp-app-host:441），前端mcpAppDownloadBytes按typeof text/blob接纳空串并精确按字节预算下载。App UI资源加载要求单一匹配ui:// URI、MIME和非空HTML，保证可运行应用快照；这个非空限制不是通用资源缺陷，禁止放宽。前端使用Uint8Array/atob，后端使用Buffer/严格raw，不为跨宿主复用而迁移整个解码或消费层。

ACP embedded resource在agent.ts:1605–1623先按text/blob真值判断：空项可在到达SessionPrompt前被静默丢弃；非空blob转data URL，空blob若直接传给通用data URL decoder仍违反其非空合同。这是独立的ACP输入适配边界；项目绑定修复会帮助其正常非空附件，用户MCP.readResource修复覆盖不到上游空项。393先记录未修复，不盲目扩ACP生产范围；后续应另定真实ACP schema/实例调用与零字节附加方式，不能宣称本批修好所有资源协议输入。

## 历史与现有覆盖缺口

`65d0bfc98`已经同时存在用户资源text.length/blob真值判断、requireByteMaterializationProjectID、公开schema omit该字段且handler未补的形状；未发现该public handler曾有正确项目绑定而被近期删除的证据。`af354ef8b`确立raw非空与canonical padded Base64两种不同合同；必须保留普通上传、身份和媒体边界。388/390只修工具结果物化，用户Prompt/ACP不属于其完成范围。

现有server/session-prompt-idempotency和相关cross-process测试主要用纯文本，部分替换SessionProcessor来检验请求身份；这种成功不能证明实际文件输入、Provider转换或真实模型链。Command测试有自己的显式项目owner。390 materialize-result-content验证真实SDK工具返回及附件，但不经过resources/read→user Parts。Overlay mcp-app-payload-contract是纯数据下载/预算测试，不是UI自动化且当前未专门列空串。以上本轮仅阅读，没有运行。后续聚焦测试必须进入生产route/materializer，不拿单个helper或mock completed消息冒充完整链。

## 最小单源实施方案（待root批准）

1. 在preparePublicSessionPrompt的authoredPrompt构造中，使用已由getActiveProjectSession校验的 `session.projectID`显式补byteMaterializationProjectID。外部schema保持omit，body fingerprint先按原公开语义计算，现有messageID/author/config/overlay/权限准入与重放不变。不修改所有消费方、不降低低层required检查，不引入Instance fallback。
2. 用户MCP资源text按string类型接受含空串；blob按string类型接纳。共享资源blob字节语义仅包含“空string→Buffer.alloc(0)，非空string→既有decodeRawBase64Payload”。两个已证明等价的后端生产消费者是parts.ts和390 materialize.ts，可将该小段提到一个MCP资源专用纯函数，替换390内联段与新的用户调用，保留raw decoder唯一非空实现；不创建通用资源registry、缓存、消息适配框架或浏览器兼容层。函数名/文件由root批准时确定，建议独立轻量MCP模块，避免引入整个materialize图。
3. 保留当前ResourceSource、用户filename、MIME选择、顺序、Host说明、附件canonical URL以及ByteProject所有权；合法空text作为真实空text Part并使该资源处理成立，空blob写实际零字节附件。SDK-valid contents数组直接遍历；空数组/无可用内容保持明确错误，损坏Base64继续raw decoder错误。
4. 不改SessionWake/runAgentSession/Task输入的正确绑定，不改ACP/App/UI生产代码，不改AttachmentStore或Provider传输。不得为过旧测试加入fallback或从URI猜Project。新增聚焦后台合同测试与必要spec/证据，共享索引/架构/CHANGELOG和最终提交由root处理。

预计生产范围为 `server/routes/session.ts`、`session/prompt/parts.ts`、MCP资源小型纯解码模块及 `mcp/materialize.ts`的等价委托；测试覆盖真实Session公开API和官方SDK资源，复跑390直接相关结果合同。根因分析已经给出为什么可以共享字节函数、为什么不能共享整体物化器；没有在证据前先造抽象。

## 聚焦正向测试与公开API验收计划

必须先正式runner红测记录原失败，再实施，再绿测。每个核心断言应是正确输出/持久化/明确错误合同，禁止以“没有调用/不存在/不包含”作为核心验收。

| 合同组 | 正向结果检查 |
| --- | --- |
| MCP资源 | 真实官方SDK Client→本地McpServer resources/read：空text、空CSV blob、非空正文夹空项及二进制项，准确顺序、原文、ResourceSource/filename/MIME、项目归属和实际0/非0文件字节。空数组与损坏内容返回现有明确错误。 |
| 公开Session正常文件 | 正常SDK/HTTP POST/message进入生产PublicSessionPromptInput/handler：同项目canonical文本/二进制引用、有效非空data URL、file://二进制，每类成功持久化规范FilePart；实际AttachmentStore读回字节与公开样本精确一致。手动attachment-index和普通programmatic file各自模型消费合同保持。 |
| 文件对照 | file://完整文本及目录返回实际Read上下文；合法start/end范围返回明确内容；非法范围返回既有明确错误。空data URL仍返回严格decoder错误。 |
| 归属与公共输入 | 两个真实临时项目/Session各自附件写入自己的项目；异项目canonical引用返回真实归属错误；调用者传私有byteProject字段仍为公共schema明确错误。URI项目段不能改写已验证Session owner。 |
| 其它公开入口 | /command的已有项目绑定仍完成附件；普通Chat/Work/SideChat中实际允许的输入身份仍由统一route处理。GlobalChat/Mission/Task只针对触及合同选择已有正向对照，不无目标全量测试。 |
| 消息与重放 | 同一messageID/原body的成功重放返回原input/reply身份、规范Parts与附件字节；错误发生在未完成物化阶段时保留精确错误及既有后续准入行为。不得为通过测试伪造助手/工具完成消息。 |

公开HTTP成功路径会继续模型循环：聚焦后台测试可使用仓库成熟的受控本地流式Provider fixture作为**明确测试替身**，由真实SessionProcessor/AI SDK消费流并持久化完成输出，不spy替换materialize/AttachmentStore/公开handler或伪造completed消息。它只能证明生产数据与HTTP流程，不能称真实Sol端到端。优先现有受控流式fixture并显式固定请求/时限，不复制runner；是否采用和具体测试范围须root审批后实施。

真实GPT-6.1 Sol由root后续另授权统一安排：fresh隔离scope、原成熟native runner、授权OpenAI凭据与完整models配对stage、credential/catalog/actual model/stream预检、固定总时限/请求数、真实用户通过正式Session公共API附加公开资源/普通附件，让模型自然读取需要的内容并可见回答。checker独立核对规范user Parts、实际附件字节、持久化assistant及流HTTP200/EOF；UI/下载/人工截图与模型事实分开。不能使用内部byteProject字段直接调用materializer后宣称公开入口成功，不能把读取说明或模型复述当作原字节证明。

## 可选无凭据短期SDK探针计划（尚未执行）

如root在审批实施前需要追加运行证据，可在 `.tmp-mcp-user-resource-input-393`以正式隔离runner运行专用探针；先记录本计划再运行，禁止直接临时长驻服务。本次spec交接尚不执行。

- owner为该单个前台测试进程，固定总上限120000ms；每个SDK请求10000ms，最多8次resources/read。只绑定127.0.0.1、port:0，实际端口与PID/开始/原截止写scratch；HTTP idleTimeout:0避免未说明的SSE空闲中断，总deadline绝不续期。
- 使用已安装官方SDK Server/Client和现有成熟Streamable HTTP测试结构，公开固定empty.txt/empty.csv/nonempty/mixed资源；全部输入与结果可归档，禁止读取用户文件、真实config/auth/models或任何外部网络。
- 该短期探针只观察SDK schema实际空值往返及当前生产输入物化的明确结果。若进入Session准备，使用正式隔离临时项目、真实Session/配置与现有测试前置；不启动真实模型、不复制凭据、不伪造生产消息。公开API完整绿测需要上节明确测试替身或后续真实模型，不能以资源SDK往返冒充。
- try/finally按原创建者关闭client/transport/McpServer，再stop同一个HTTP owner；所有pending请求用本次AbortController取消并await settled；记录每个close outcome、退出码、原deadline及端口释放。runner只回收自己精确临时根，不操作用户进程，不扩大删除；服务异常先保留原日志并修辅助根因，不盲重试。

## 风险、未知与交付边界

当前强证据是代码/schema/历史/调用链；HTTP实际错误响应状态与每一媒体消费结果尚未运行确认，实施前红测必须保留其精确输出，不能预写“通过”。所有file项目绑定应在同一个可信公开owner完成，因此一次修复会扩大原本失败路径的真实覆盖，需要同时验证Project/MIME/完整性错误仍准确。

空blob支持仅是MCP资源零字节语义，不代表空图像/PDF有效；通用data URL与上传raw继续非空。用户MCP文本没有Tool输出预算/保存恢复语义，不借修空值顺带改截断、来源或MCP授权。ACP空输入、HTTP远程file语义、当前未调用的Overlay submitMessage形状、App业务编辑与UI资源HTML合同均明确排除，不能包装为全部资源输入完成。

请求重放、正常结束、并行多项目与错误恢复测试必须复用真实现有Session owner；如运行出现调度/恢复/终态异常，按共享机制全横向审计并保留失败，不降级为这个MCP服务的问题。目前没有此类实测异常，故不修改相关调度代码。本agent仅交付spec，root仍需批准实施、完成真实验收、维护共享文档并范围提交/正常推送。

## 实施授权与精确合同（红测前）

root已完整阅读并批准393实施。生产范围精确为 `server/routes/session.ts`、`session/prompt/parts.ts`、`mcp/materialize.ts` 和新增轻量 `mcp/resource-content.ts`。导出函数固定 `decodeMcpResourceBlob(blob: string, context: string): Buffer`：空串返回Buffer.alloc(0)，其它值仅调用唯一util/base64 raw decoder。公开authoredPrompt以已经验证的session.projectID显式绑定；外部schema与请求fingerprint不变。用户text接受任意string，blob按string类型，直接遍历SDK typed contents，删除单object fallback；保持来源、MIME、filename、顺序和错误。其它正确调用者、ACP/App/UI、全局raw decoder与公共schema不改。

获准新增聚焦后台合同测试，通过真实官方SDK MCP资源服务和生产公开handler→SessionProcessor→持久化；复用成熟受控本地流式Provider替身，无真实模型/凭据。禁止spy替换handler/materializer/store、合成completed消息或负向核心断言。覆盖空/混合资源、普通canonical/data/file二进制、私有字段和跨项目明确错误、同messageID重放；复跑390物化/Provider与必要请求身份正向合同。仅在测试内绑定127.0.0.1临时port，SDK请求固定10秒、单用例60秒，所有请求/服务在原owner finally关闭；配置与文件只在正式隔离runner根。正式Bun1.4.0 PATH先红后绿，命令日志与退出码只进入 `.tmp-mcp-user-resource-input-393`。如出现共享调度/恢复/终态异常先报告并横审，不以测试替身解释为局部问题。真实Sol和页面仍由root后续负责，本轮不提交/共享文档/委托。

### 第一轮正式红测与测试owner修正

正式Bun1.4.0 runner的before.log为13项：5 pass/8 fail/35断言，exit1。canonical/data/file与replay缺byteProject，MCP空text/blob无可用内容，混合blob缺byteProject，均有明确原错误；Command、非空MCP文本、公共私字段拒绝、空data URL和空contents错误通过。跨项目case的原断言被测试析构SuppressedError遮蔽：新测试在活动Instance.provide回调内await-using memoryProject，其析构调用disposeAll，触发Instance:1995禁止活动回调内全局销毁的明确守卫。该守卫是共享入口的正确合同，测试owner必须在Instance外层，不修改或降级产品生命周期。原日志保留，已通知root。修正测试资源拥有位置，并补两个同时存在项目各自成功物化相同公开字节的正向用例，再正式红测。

### 确认红测与唯一生产修改

修正测试owner后的before-confirmed.log：14项5 pass/9 fail/36断言，exit1，43.06秒；所有失败均为预期项目绑定/空内容边界，跨项目case现在准确显示缺byteProject掩盖了应有归属错误，没有SuppressedError。增加的两项目正向case也在首次data附件缺绑定处失败。确认后保存三份生产原像与空production-before.diff，再按批准的四文件合同实施；raw decoder/公共schema/fingerprint、其它正确调用者均不改。用户资源沿SDK typed contents，已不保留单object兼容入口。

### 第一轮绿测与准确验证边界

获准生产修改后的after.log：14项全部通过、124断言、exit0（93.69秒）。成功路径使用真实公开Hono SessionRoutes的Request/Response handler，真实SessionProcessor/AI SDK与成熟受控本地流式Provider、规范MessageStore和AttachmentStore；MCP部分另有实际官方SDK Streamable HTTP资源服务。没有spy产品handler/物化/存储，没有手写completed消息。两个同时存在项目各自写同字节并保留不同真实项目归属；Command对照、跨项目明确错误、私字段schema错误和原messageID重放均通过。

这属于后端生产handler/处理器合同验收：测试通过app.fetch进入实际公开handler，没有额外启动整个产品HTTP监听/Overlay；本地Provider是明确测试替身，不是GPT-6.1 Sol，不证明真实模型或桌面视觉。所有新SDK/HTTP/Provider owner在finally正常关闭，正式runner退出0；首次测试owner位置错误及两轮红测原日志均保留。测试集中在一个新server/session-prompt-attachments.test.ts，共14项；没有为目录分类重复创建另一个测试fixture。随后只格式化新测试与新轻量函数，并执行390相关四组和既有公开身份正向合同、核心类型检查。

## 最终后台检查与交接状态

| 正式指定文件 | 结果 |
| --- | --- |
| 新 `server/session-prompt-attachments.test.ts` | 14 pass /124断言，after.log exit0 |
| `mcp/materialize-result-content.test.ts` | 16 pass /100断言 |
| `capability/projected-output-authority.test.ts` | 5 pass /78断言 |
| `mcp/result-provenance.test.ts` | 2 pass /7断言 |
| `tool-result-attachment-provider-projection.test.ts` | 12 pass /21断言 |
| `server/session-prompt-idempotency.test.ts` | 13 pass /21断言 |

关联五文件related.log合计48项/227断言、全部exit0；加新增14项总计62项/351断言。既有身份测试中的模拟只证明其原局部合同，本批新增成功路径均使用受控流式Provider的真实SessionProcessor。62项数字不是62个真实模型用例。工具结果的原content、isError、AttachmentStore、截断恢复和Provider音频限制继续通过；没有以本地测试声明Sol端到端或桌面通过。

核心typecheck.log（tsc --noEmit）exit0，docs-check.log exit0（348 ops/26 groups），新函数/测试Prettier check与本范围git diff --check均通过。新增测试只作格式化，产品语义在首轮绿测后未再次修改。正式runner自有进程与SDK/HTTP/受控Provider在finally闭合，全部绿测子进程退出0；相关五文件日志中可识别的独立临时根另经只读检查已回收。没有常驻服务、真实凭据或模型调用。

最终生产范围严格为4文件：公开Session route新增已验证Project绑定；Prompt parts接纳空资源并只遍历SDK typed contents；新mcp/resource-content.ts提供唯一资源blob空值语义；mcp/materialize.ts改为调用该函数，保留其它媒体严格解码。唯一新测试为server/session-prompt-attachments.test.ts；本spec加自有 `.tmp-mcp-user-resource-input-393`日志/原像由本任务拥有。未改ACP/App/UI/raw decoder/公共schema/其它正确调用者或共享runner。

截至后台验证阶段（以下真实scope尚未执行）未达成：真实Sol、整个产品HTTP监听和桌面输入/截图。ACP上游空项转换、远程HTTP file、各种媒体Provider能力仍不可外推；本批未为file://文本/目录新增实页验证。root须复核范围、完成后续真实验收并更新共享索引/架构/CHANGELOG、范围提交和正常推送。原before.log的测试析构错误、before-confirmed.log的9项目标失败均保留，不能被绿测覆盖。

## 真实验收 helper 准备授权（尚未启动）

root 已接受四文件后台修复，授权本 agent **仅准备** fresh `.tmp-mcp-user-resource-input-393/live-attempt-01` 与父 scratch 的公开资源、SDK 服务、公开 API 发送器和只读 checker；禁止启动服务、模型、浏览器或复制/读取真实凭据。本轮不改生产、测试、共享 runner 或共享文档，不提交。root 独占实际启动、凭据与完整 models 配对 stage/preflight、页面和正常收尾，直接复用当前 `.tmp-product-iteration/live-sol-launch.ps1`，QualificationKind=NativeService，builtin base，应用端口18506，物理600000ms、累计20请求、180000ms流无活动限制；不改原截止。

自有 MCP 服务只在 root 执行后监听127.0.0.1:18507，idleTimeout=0，固定600000ms owner，记录PID/occurrence/开始/原截止。root 用匹配occurrence的专用 `mcp-stop.json` 正常请求退出；finally逐个关闭自有短期SDK Client、Client transport、各McpServer/Server transport和HTTP，并输出owner、ready、terminal及close结果。启动自检只列资源，不读资源；实际resources/read另记独立计数和原contents，不能让自检冒充生产调用。原到期也正常收尾但明确标为deadline，不伪称主动正常关闭。所有句柄由启动者join；不操作用户进程。

公开样本固定为空text、空CSV blob，以及混合正文（review_code=MOSS-393-PUBLIC）、空text、非空CSV（Maple=3/Iris=4）和尾段；普通上传CSV为Notebook=7/Pen=5。资源URI为reports://public/empty-text、reports://public/empty.csv、reports://public/mixed，clientName为public_user_resources。原字节、完整contents和请求文本保留在scratch，不含私有数据。资源服务不声明工具，不创建专家包，也不改变默认Base。

root应用ready且精确preflight通过后，发送器通过project header向真实/config合并唯一MCP配置，验证Base；使用真实 `POST /attachment?filename=public-upload.csv`、Content-Type=text/csv和原始CSV字节取得canonical引用，再正常 `POST /session` 创建assistant会话，记录并立即报告Session/Project/messageID/URL/原截止。随后仅一次 `POST /session/:id/message`：agent=chat、model=openai/gpt-6.1-sol，三个公开FilePartResourceSource及普通canonical FilePart，不含内部byteMaterializationProjectID。messageID在发出前固定落盘；不自动重发或替换身份。用户自然要求中文核对正文/两份CSV数值与合计/空资源情况及引用，不教host替模型选择工具，不用Task/Mission入口绕过待修route。

业务应尽早发出；按root补充要求，首次业务请求前检查两个owner较早截止至少剩120000ms，HTTP等待上限取该原截止减120000ms，给root至少两分钟桌面/附件下载窗口。超时保留原HTTP错误，不能把取消HTTP等待当作取消模型；root按原owner处理，不延长或盲重试。NativeService回执只证明物理服务/Provider流，业务成功另由checker证明。

checker读取真实公开Session/Message响应，以及SQLite只读一致事务中的Session、规范user Parts、assistant和工具事实。核对空文本存在及完整顺序、MCP ResourceSource/filename/MIME、所有文件canonical项目归属、AttachmentStore实际0字节及两份CSV精确原字节/元数据、SDK三次真实资源读取原结果。普通上传必须与实际upload回执相同。assistant须真实completed/stop且实际openai/gpt-6.1-sol，可见回答另保存供人工复核；模型关于字节的自述不作证据。Provider audit必须同native PID、1–20请求、每次精确模型/stream=true/HTTP200/reader settled EOF。页面、下载与物理关闭/成对凭据删除由root补充，不能从checker推断。helper准备阶段只做语法解析与纯公开样本生成，不运行其网络或数据库逻辑；真实Sol、SDK资源调用、整个产品HTTP和页面目前仍未执行。

root补充独立UI适配：当前native serve只识别可执行文件相邻ui或共享dist-vite。为隔离并行UI源码/构建，root按成熟376方法在自己的393 scratch生成private bundle（已reviewed原Bun可执行文件加已通过392的ui-after），仅在自有launcher副本替换taskBun路径及PSScriptRoot为原.tmp-product-iteration常量；原factory/preflight/qualification/physical/output/request/pair-cleanup全部保留，不改共享runner。该适配由root独立review/执行，helper仅读实际ownerJSON nativeDeadlineAt，不按脚本开始时间猜截止；未知风险为UI静态包与当前API兼容，实际页面前不宣称通过。本agent不创建或执行该launcher副本。

### 准备交接结果

已准备父scratch中的 `prepare-live.mjs`、`mcp-resources.ts`、`send-session.mjs`、`check-live.ts`、`stop-mcp.mjs`、`LIVE-HELPERS.md`。仅运行纯文件生成器，公开fixture为empty.txt/empty.csv各0字节、混合CSV32字节、普通上传CSV34字节；配置/完整resources/user request共8文件，全部wx创建。prepare.log/prepare.exit为exit0。3个JavaScript脚本通过Node --check；2个TypeScript helper通过Bun.Transpiler语法解析（没有求值或加载其生产imports），helper-syntax.log/exit为exit0。这不是SDK、产品HTTP或模型验收。

stop helper用同目录stage加exclusive硬链接原子发布完整JSON，owner不会读到半写入的请求；实际Windows服务close/端口释放尚未运行，必须由root执行并保留terminal/join证据。checker仅在root真实scope内执行时读取已经配对stage的auth到内存供CredentialRedactor脱敏，不复制或输出其内容；本次准备过程没有读取任何auth/models。本轮代码/测试保持冻结，只有本spec及scratch增加准备记录；原后台红绿证据未覆盖。

## Root真实执行审批与前检

root已独立读取四生产diff、完整14用例和related原runner结果，接受62项/351断言与精确边界；已逐份review六helper的公开样本、SDK owner、POST attachment/session/message、只读数据库事务/真实字节及normal stop。批准一次fresh393 NativeService与三公开MCP资源，沿本goal已授权OpenAI凭据/完整models配对、精确Sol全流式。Root自有launcher仅私有Bun+已通过392 UI及原helper目录替换，PowerShell7解析零诊断；原600秒/20累计请求/180秒无活动/物理output请求结算和成对清理保持。实际启动前18506/18507无监听。生成helper仅公开样本/语法成功，无旧owner重用或模型请求重发。

前批392已经范围提交830972c0d且远端实际包含；共享并行66f796d22文件条目与328ee71c6 Side Chat交付的功能/真实截图/模型/native证据已独立阅读，正常push hook全部通过（0 secrets）。两次push远端锁因并行owner已推相同HEAD拒绝，持续正常fetch/merge/完整待推集合审查，不强推。它们不进入393生产范围；393私有UI绑定已验收392构建，避免并行构建混入。

### 首次真实输入失败、协议前置与有界恢复批准

首次upload200/34 bytes、Session创建200；同一public message返回404，原NotFoundError为MCP server not found: public_user_resources，全部响应原样保留。GET/mcp200明确该配置status=disconnected；GET原message404为Message not found。源码state初始化只登记disconnected，readResource要求exactConnectedRuntime；配置定义不等于连接。正式用例先MCP.resources初始化，此发送器省略了实际资源连接前置，不是本批空值/项目绑定修复失败。root最初将失败点误说上传，已立即以实际receipt纠正。

公开POST/mcp/public_user_resources/connect200，随后GET/mcp明确connected；此行为是原公开连接协议，不改host数据流或生产。root读到parts先完整物化再持久化，首次资源读取在client选择处失败，公开原message明确未创建；route executePublicSessionExecution只对已持久input作converge，非忙/error原样throw并finally删除原active操作。Root批准仅一次纠正后的同Session、同messageID和完整原body请求；复用真实已上传规范引用，不重做上传/建Session，不绕过公共handler，不改身份或原截止。结果写独立attempt-02文件，原失败记录不覆盖；checker显式读attempt-02，不增fallback或自动重试。未来fresh helper补正常connect/status前置。此次没有共享调度/恢复异常，依据是明确资源连接状态、真实404/200及原准入/持久化代码，而非模型自述。

Root首次checker辅助失败为INVALID_OPENCORVUS_TEST_RUNTIME：脚本把正式test-only HOME标记用于普通只读checker，却未声明正式runner processRoot。按既有390 checker撤掉该错误标记，继续明确OPENCORVUS_HOME指向原已拥有runtime；不降低生产隔离守卫、不改测试/产品、不另建runtime。原错误与脚本前态保留，重跑相同checker。

## Scope01实际完成与页面边界

root已完成scope01真实后台checker：同一个原messageID/body在明确public MCP connect之后完成，13个规范有序user Parts（含两项空text）、0/32/34字节附件实际存储及公开HTTP逐字节一致、3次真实SDK资源读取、7次精确gpt-6.1-sol流式HTTP200/EOF。原404与failed receipts、连接前disconnected、公开connect200/connected、第二次独立response均保留。checker只读取显式attempt-02成功回执，不把失败覆盖或改写成成功。

物理回执为native terminal exited/0、physicalCompletion/outputDrainComplete/requestCleanupComplete均true；7次Provider EOF；复制的auth/models均removed、pairedCleanupComplete=true。MCP terminal为owned-stop-file/exit0，所有Client/transport/Server/http close为closed。root报告原执行handles59140/16546/81600均已join exit0；两个原截止均未延期。scope01已关闭，不能复用其凭据对或重新启动原owner。

scope01桌面仅观察到Work ledger及preflight的Reply with OK，目标用户资源会话与下载**未验收**。直接POST/session(kind=assistant)不会创建right-sidebar conversation元数据，而Work ledger投影仅选取conversation.surface=right-sidebar且experience为chat/work（work-ledger/projection.ts:365–366）。这是helper选择了不可由当前产品导航到达的程序化Session，并非以title或裸kind即可加入Chat列表的合同；不修改scope01 metadata、不制造入口或消息，也不把preflight页面算作资源验收。后台成功与页面未达成分别保留。

## Scope02正常Global Chat续聊计划（root授权准备，尚未启动）

root授权fresh `live-attempt-02`，本agent只改自有helper、该spec与scratch，仍禁止启动模型/服务/浏览器、读取或复制凭据、产品/测试/共享文档修改和提交。先把scope01关闭后当前六helper原字节存于 `live-attempt-01/helper-snapshot-after-close`；此快照是包括root明确connect和checker修正后的收尾版本，不能冒充首次失败时原像。既有失败与root保留的前态仍独立保存。后续所有helper必须接收**必填绝对scope根**，不内置默认scope、runtime或生产owner fallback。

重新读取的真实合同为：`GlobalChatStartInput`严格只接受 `{requestID,text,attachments?,model?}`，其中model是完整字符串openai/gpt-6.1-sol；没有mode/target/directory。POST `/global/chat/start`返回**202** `{requestID,session,messageID}`。`ensureSession`通过GlobalCreationAllocation.reserve/materializeProject分配 `Global.Path.data/projects/YYYY/MM/DD/UUID`，`GlobalConversationService.create`固定experience=chat，并正常创建带right-sidebar conversation身份的assistant Session；请求头不能让它强绑native.project。root已确认采用真实返回session.directory/projectID，不加虚构mode/target，不改metadata。UI由root在Work ledger选择该真实Chat（界面模式是页面选择，不是该API参数）。

发送器首条调用Global Chat start，真实用户自然说明“准备核对公开CSV资料，稍后发送附件”，等待实际首条assistant完成；它仅建立可导航会话。返回后立即公开ready JSON，含Session/Project/初始messageID、directory、URL和两个原截止；helper校验directory位于本native runtime/data/projects之下，且owner.runtime本身属于传入fresh scope，避免任何用户项目。接下来所有project-scoped config/connect/upload/prompt请求header都使用这个返回directory；checker的AttachmentStore根也用该directory，数据库仍是同native runtime数据库。

首条完成后，在该真实项目PATCH唯一MCP配置，GET验证默认Base与entry，POST `/mcp/public_user_resources/connect`并GET明确connected，随后真实POST `/attachment`上传同34字节公开CSV。第二条使用固定落盘的新messageID、三个原ResourceSource与canonical附件，通过**同一公开 `/session/:id/message`** 发送资料，不再POST/session、不走Task/Mission、也不调用内部wake。session.ts:570–631仍先验证Session lineage并绑定session.projectID，再applyRightSidebarConversationPromptOverlay保留chat身份，最后同executePublicSessionPrompt/SessionProcessor；Overlay services/chat.ts:269的真实续聊也走这一公开route。因此首条GlobalChat使用已有SessionWake的正确绑定不能替代第二条393目标合同，checker必须独立识别两条输入/两次真实assistant完成。

scope02继续fresh NativeService 600000ms物理、累计20请求、180000ms流无活动；MCP独立固定600000ms/idle0。首条和第二条实际业务模型请求发出前均要求较早owner原截止至少剩180000ms；第二条HTTP等待上限为较早截止减180000ms，给页面和附件下载留两分钟，并预定在较早截止减60000ms前主动正常close。超时保留错误，不自行重发、取消owner或延长预算。root准备自己的private launcher，同已审核两处适配/reuse392UI，配对stage与preflight独立执行，绝不复用scope01 pair。

scope02 checker除scope01全部字节/顺序/来源/模型流合同外，还验证GlobalChat202返回的真实request/session/message身份、正常conversation元数据及分配的项目目录、首条原文/真实completed reply；第二条结果显式由调用者给定成功receipt文件名（不fallback）。公开API与SQLite同Session/项目，AttachmentStore目录取返回owner而非native.project。页面必须能自然选择目标Chat、看到初始和资源续聊、空/混合原文、三CSV附件与最终中文答复，并实际下载核对样本；UI和真实下载由root操作截图人工复核。当前scope02只有计划/准备，未声明任何SDK、模型或页面结果。

### Scope02 helper准备交接

六helper已按上述合同更新，scope01收尾版六文件原字节快照保持。只执行纯文件prepare到明确绝对 `live-attempt-02`，8份公开样本/配置生成成功exit0；3份JavaScript Node --check与2份TypeScript Bun.Transpiler仅语法解析exit0，未加载执行服务/数据库模块。日志为prepare-scope02.log/exit和helper-syntax-scope02.log/exit，命令写在父scratch LIVE-HELPERS.md。首次202成功即写global-chat-ready.json，方便root尽早打开真实Chat；随后等真实首条stop/completed，再正常connect及固定第二messageID续聊。checker显式要求scope根、observe/check和response文件名，并读取同事务global_creation_allocation的真实accepted项目/Session。当前所有准备进程均已结束；root的private launcher及native服务未由本agent修改或启动，未读取任何凭据。

### Scope01实际成功与准确关闭

纠正连接前置后同messageID/body的第二次public prompt200、完成助手msg_g0VXvwqDd00rZpTLYiQD。checker实际13 ordered user Parts（含两空text）、3 SDK资源读取，AttachmentStore完整0/32/34字节与公开HTTP逐字节相符；实际回答正确给MOSS-393-PUBLIC、Maple3/Iris4合计7、Notebook7/Pen5合计12、空文本与零行CSV、真实引用。独立native最终7次精确gpt-6.1-sol/stream/200/EOF。原helper首次404和checker隔离失败均保留，不覆盖失败。

Scope01裸POST/session assistant缺work-ledger可导航元数据，由当前公开producer/ledger定义与实际tab32导航证明，这是验收选路不足，不能伪补metadata/合成消息。target消息展示/GUI下载未达成，实际导航截图只标边界。tab32关闭后成熟public shutdown完成，physical native12:56:35在原deadline12:56:37之前exit0；pair12:56:39删除发生在物理/output/request结算后。MCP原stop-file正常close/terminal，全closeFacts closed，原launcher59140/MCP16546/attempt02 81600工具均join exit0。未延长任何原deadline。下一fresh scope使用正常GlobalChat真实首条→同公开续聊路径，另外资格UI/下载。

Root已完整review scope02 GlobalChat严格schema/202、原生分配项目边界、首条真实完成、连接前置及第二条public route、checker额外first/allocation事实，批准一次fresh实际运行。自有launcher逐字节复用已reviewed01私有launcher，复用同immutable Bun+已验收392 UI，只传新的RunRoot/EvidenceRoot/prefix；绝不复用旧runtime/credentials/deadline。首条/续聊/数据与页面分别检查，closeBy原deadline-60s。

### Scope02原配置/Session配置辅助断言修正

正常GlobalChat202、首条13:13:09真实completed/Sol，cwd/root均返回项目。发送器GET/config后误断言项目raw profile=base而失败dynamic，尚未connect/upload/生成第二ID。agent只读核对202 metadata.configOverlay.prompt_profile.active=base；Config.get读取项目层，该terminal+MCP文件由Config.Info.safeParse注入默认dynamic后merge，EffectiveConfig再按真实Session overlay恢复base。实际请求头选返回目录正确，不以名称臆断角色切换。root批准改为核验真实Session overlay base、原MCP声明及实际Sol，记录raw/effective差异，不写profile/metadata、不重发Global首条。第二条尚未存在，继续合法connect/upload/固定ID是首次提交，原预算不变；原send失败日志和script保留。配置层默认注入的广泛影响留独立后续分析，本批不在live时更改产品。

### Scope02未提交与fresh03批准

scope02原Base surface断言后调查耗时，原continue脚本在180秒预留guard明确拒绝；没有生成附件续聊messageID或发送第二条。tab33只记录真实可导航初始Chat（截图正文尚加载，不把它称最终答复UI）。根因属于错误helper边界及其修复耗时，未改产品。Native13:20:38正常physical/output/request结算、13:20:42配对清理，早于原closeBy13:20:53/原deadline13:21:53；5次实际Sol流200EOF，MCP正常owned-stop-file/all close。原handles40474/78612实际exit0，sender2393与continue原failure保留。

root已纠正fresh sender为Session metadata configOverlay Base验证并分别记录raw/effective值；保持公开connect前置、正式runtime归属和无TEST_HOME标记。批准fresh03复用同mature launcher/immutable392 UI/公开样本，新的runtime/pair/occurrence/deadline，直接正常Global首条及public附件续聊，不延长02或复用其数据。目标仍是严格正常Chat正文与实际下载，不以初始图或前两轮后台成功冒称完成。

## Scope03实际Provider失败与收尾

fresh03在preflight阶段收到真实 `AI_StreamProviderError: Our servers are currently overloaded. Please try again later.`；[原failed.json](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-03/native/evidence/failed.json)与[最终audit](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-03/closure/final-provider-audit.json.gz)完整保留。两请求HTTP200，但仅一EOF，另一错误后reader清理为aborted；不能用HTTP200或正常物理清理把这次称为模型/业务成功。没有业务用户回合或页面。

mature watcher按原owner自动完成native physical/output/request和auth/models配对删除；原launcher86932 exit1保持失败，MCP59484通过正常stop-file/all close/exit0结束。failed.json中当时cleanup尚未验证的描述不重写，后续[物理与配对回执](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-03/closure/physical-terminal-and-pair-cleanup.json)单独证明清理。未延期、重用03 pair、改权限或另造结果；root等待Provider后授权fresh04。

## Scope04正常Chat公开续聊、实页与下载成功

scope04为独立runtime/pair/occurrence，复用已纠正的合法公开connect前置、配置surface校验和原NativeService预算；同成熟native launcher只保留既定private Bun+392 UI、原helper根两处适配。其[Global Chat202](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/global-chat-start-response.json)自然建立 `ses_hy8M8XN2Rne4fRPQQSPD` / `prj_h4GNrUzySvBzLq1B98xi`，初始用户 `msg_h1UwLBZv7i44OtOQAdB7`真实完成；第二用户 `msg_fb59ba41-541e-447c-9a6f-a60e4213a5fd`通过本批修复的公开/session/:id/message提交同三ResourceSource与真实upload canonical引用，没有内部byteProject字段、Task/Mission包装或metadata补丁。

[独立checker](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/live-check.json)与[规范持久化](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/live-canonical.json.gz)验证Global allocation、两条真实user和首尾assistant完成、精确Project/Session归属，第二条13个有序Part包含两项空text、3份0/32/34字节实际附件，3次真实SDK资源读取原contents准确。[最终Provider audit](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/closure/final-provider-audit.json.gz)为累计9请求，全部openai/gpt-6.1-sol、stream=true、HTTP200、reader settled/EOF。checker/check.log exit0、sender91821 exit0由root实际执行报告；答案不替代字节证明。

root实际tab35在正常可导航Global Chat看到两条用户消息、三CSV cards、完整中文核对：MOSS-393-PUBLIC，Maple3/Iris4总7，Notebook7/Pen5总12，空资源正文与Host读取提示区别、空CSV0行/无表头无记录、规范引用。实际截图为Code模式的Chat，Base与Sol显示可见；计划中Work ledger不是唯一入口，也不添加虚构API mode字段。root人工查看[资源及下载卡片](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/screenshots/live-resource-cards-downloads.png)、[答案表格](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/screenshots/live-answer-table.png)、[空资源解释/引用](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/screenshots/live-resource-answer.png)，归档agent另实际读取三图复核；[视觉记录](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/visual-review.json)和page-ax只作辅助。没有UI自动化测试或DOM文案验收替代。

实际点击下载空CSV0字节和混合CSV32字节，root逐字节比较见[download-byte-review](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/download-byte-review.json)。归档时再次从精确AttachmentStore路径读scope01/04共6份公开文件、04两份真实下载，与样本8组精确相等；非空CSV以gzip保存原CRLF字节，避免Git文本正规化。普通上传34字节已证明实际store及公开HTTP完整，scope04没有单独点击下载它，不扩张该UI结论。

root关闭tab35后原native于13:46:30.299Z exited/0，physicalCompletion/outputDrainComplete/requestCleanupComplete全部true；13:46:34.413Z复制auth/models均removed、端口释放，[最终回执](../../artifacts/2026-10-13-mcp-user-resource-input-393/live-attempt-04/closure/physical-terminal-and-pair-cleanup.json)记录全过程。MCP24740为owned-stop-file、全部Client/Transport/Server/HTTP关闭、exit0；native launcher62230 exit0。[03/04句柄来源记录](../../artifacts/2026-10-13-mcp-user-resource-input-393/root-reported-handle-outcomes.json)标明root实际执行报告，归档agent没有伪造独立进程观察。四scope均已关闭、原预算从未延期；NativeService资格与业务/UI证据各自分开。

## 安全归档与最终交付边界

归档目录 `specs/artifacts/2026-10-13-mcp-user-resource-input-393` 通过显式逐文件allowlist收集247份公开源证据，包括后台原红绿/62项351断言、类型与格式/文档检查、3生产原像、四scope请求/原失败/SDK/原owner与preflight/最终Provider审计/native物理和配对清理、helper快照及正式04三图；另保留两张明确不代表目标成功的01/02导航图。README、来源标注的root报告和扫描/链接验证记录为生成的归档说明。

[allowlist与扫描](../../artifacts/2026-10-13-mcp-user-resource-input-393/allowlist-and-scan.json)给出完整源→目标清单、每份原字节/gzip大小、四scope实际审计终态及8组实际字节复查。没有复制auth/models正文、SQLite/WAL、整个runtime/project、二进制/UI bundle、node_modules、无关共享索引前像。原audit由成熟运行器CredentialRedactor处理；归档agent只做高信号token/JWT/私钥/Bearer/凭据字段模式检查，0命中，**没有读取真实凭据，也不声称重新按已知secret值扫描**。

脚本采集保留原目录名：01 helper-snapshot-after-close是当时收尾快照；scripts-final-used与helper-collected-after-close含后续采集的共享helper，不能一概当作首次失败时启动原像。原缺connect、原错误TEST_HOME及02错误Base断言源码单独保留，日志与结果无覆盖。helper修复没有改公共产品合同；395配置问题另有独立spec，不混入393生产diff。

最终可宣称：公开Session项目绑定+用户MCP合法空text/blob与有序混合内容已后台及真实正常Chat链成功，实际显示/下载符合公开字节。data/file二进制、同ID重放及跨项目错误由后台合同覆盖；不外推ACP/App、远程HTTP file、所有媒体Provider transport、Task/Mission/worker或MCP资源输入picker。root仍负责共享索引/架构/CHANGELOG、最终独立复核与范围提交/正常push；本agent不提交，生产和测试冻结。

[归档最终校验](../../artifacts/2026-10-13-mcp-user-resource-input-393/archive-verification.json)完成：251文件、247显式源证据、91份gzip与原公开内容逐字节一致，本spec/归档README本地链接均存在；扫描0高信号凭据模式命中，无真实凭据读取。精确可提交档案清单另输出至自有scratch `archive-final-file-list.txt`，共享文档建议在 `shared-doc-suggestions-393.md`，均未自动应用到共享文件。历史未达成和原失败均保留，范围冻结交root复核。

## Root 交付复核

Root已人工查看scope04三张真实页面截图并逐项核对自然两用户消息、三CSV卡片、表格合计7/12、报告MOSS-393-PUBLIC、空资源解释和真实canonical引用；原下载0/32字节与公共样本精确一致。已复核完整四scope分别独立收尾与原失败，scope04原launcher62230、sender91821、MCP24740均exit0；01/02不能提升为GUI完成，03aborted/overloaded不得计成功。62个聚焦正向功能测试/351断言、正式红态及工具修正原失败保留，生产差异限定四文件与新14用例。

归档完成后Root复用当前CredentialRedactor，在内存读取本任务原授权Provider credential source，再逐份解压并扫描所有归档公开文本中的真实密钥值及现有JSON/URL编码；最终实际receipt记载精确扫描数、0命中，未输出任何密钥，未重新复制runtime或配对authority。此安全检查不是变动源码摘要验收。新增known-credential-scan.json为Root独立复核，不改原archive pattern报告的权限/边界。共享04-extensions与02-data、对应中英Unreleased和三层索引已更新，docs348/26通过；本批不升版本、不建Release/tag/PR。范围提交与正常上游同步按Git实际回执执行。
