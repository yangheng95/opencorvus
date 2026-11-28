# 共用判别值的工具输入完整性

## Recall

- 用户要求本人持续迭代直到明确停止，不用子代理、额外Codex聊天、分支或工作树。现有Provider（模型提供方）凭据及完整模型目录、精确openai/gpt-6.1-sol流式请求不限；不刷新或披露凭据、不发布版本。每批先完整根因/影响和spec（规格），再修复、聚焦正向检查、真实桌面与截图本人复核、必要真实模型任务、范围提交、最新上游普通合并及正常push（推送）后继续，不止于记录。
- 上批7985221a434811de366723f84d6d69baf1458fbc原43847推送句柄已加入退出0，HEAD/上游/实际远端精确一致0/0、暂存空、177原差异保留。45后台案例105断言、锁定OfficeCLI1.0.158的1原生DOCX（Word文档）案例22断言、类型/正常hook（钩子）、29精确Sol流200/EOF（End Of File，流结束）、8原生截图、4实际DOCX/PDF（Portable Document Format，便携式文档）下载通过。真实新任务首次12逻辑段/4多行/9软换行成功，旧失败/模型拆段恢复仍保留。
- 上批私有直接CLI（Command Line Interface，命令行接口）实验漏用生产隔离环境，Temp验收副本意外自更新1.0.163，正式不可变包检查拦住；已从精确原备份恢复1.0.158、重跑原原生检查及候选首请求，通过5受管文件真实身份核验。无效1.0.163实验不计验收。之后所有Office调用沿prepareWorkArtifactRuntimeEnvironment，私有工作器请求前再次验证完整不可变包，不重复直接裸调用。自有驻留路径已退役、未触碰用户进程。
- run158原67553/159原72650均排空并加入退出0、成对凭据/模型目录副本及51776退役、自有455/459页关闭；旧392/428未绑定不伪称关闭。新批shared-discriminator-input在开始前重新保护原23文件/3327旧五表行、2完成Task（任务）/23任务行/59字节资源，样例Git f7bf091156c9b137c4eb3d5b822721294e9a8f24；现有66旧交付物与8业务输入为新基线，不能继续称旧3189为全部旧行。
- 已读前批Recall/结果、06-provider、唯一tool-execution-input分支选择/物化与schema-nullability原根Ajv（JSON Schema检查器）上下文、ProviderSchema/SessionLoop实际准备/执行、生产结构化输出和MCP（Model Context Protocol，模型上下文协议）动态schema路径。定义/调用搜索只找到同一个选择器，NULL语义共用两调用源；历史未找到覆盖“多个分支共用同一常量”的合同。上批证明属性完整空值语义，尚不能证明选择器选了正确分支。

## 线索、影响与验收方案（生产修改前）

- 当前线索：selectJsonSchemaVariant遇到第一份所有必需常量均匹配的对象就立即返回，不核对其他同值常量分支是否才接受完整原始输入。若同kind的一个分支允许真实null，另一个只允许可选字符串，原始规范联合本应保留null；若选中后者就可能误删合法值。当前是控制流线索，须通过实际生产StructuredOutput→prepareProviderTool→执行→onSuccess完整正向输出复现，不能仅凭命名或理论宣称缺陷。
- 同一分支选择还把其他联合分支的属性无条件清除，不区分非空实际数据、闭对象可选null占位和开放对象允许的额外属性。须一并核对共有常量、不同常量、结构唯一、开放/封闭对象、真实null/非空外来字段、原根引用以及规范明确错误合同，防止修局部后仍损失原始数据。该审计是共享输入数据机制，不是调度异常；若另发现队列/唤醒/恢复/并发/终态异常立即执行全入口/Task-Mission（多步任务）-Session occurrence（会话执行轮次）/重试重启/串并行/项目隔离审计。
- 若机械复现，先补实际观察、直接触发、控制与数据流根因、旧路径未根治原因、全定义/调用/同语义/历史、公共契约、数据/测试/文档/交付风险，再改现选择器。不得按schema顺序猜业务、加工具流程gate（门槛）、吞错误重试、引入fallback（后备路径）、新判别字段或新持久格式。规范校验仍拥有最终值/错误，合法原始数据优先保持其规范语义；引用和schema约束应复用现有成熟原根编译上下文，不再手写第二套验证器。
- 后台新增正向完整执行合同，并重跑现有空值/嵌套联合/原根引用/实际Office默认语言与空单元格/公式/真实面板及授权合同；明确错误类型属于正向错误输出。公开/持久schema不变时不做无依据迁移或SDK（Software Development Kit，软件开发工具包）重新生成。检查实际准备成本，不能以可变源码摘要验收。
- 真实桌面沿独立开发/ui/而不另起Vite，使用原有发布/下载或新自然业务任务回归共享工具与当前页面；需要时精确Sol流式验收已有授权。MCP与结构化输出本地合同不冒充外部MCP服务端到端。禁UI（User Interface，用户界面）自动化、DOM（Document Object Model，文档对象模型）/组件/源码文案/快照/像素测试；真实截图必须本人查看，不以类型/构建或模型自述替代。
- 保留所有原数据与177无关差异，凭据/完整目录配对且分别验证可用、模型投影和实际请求一致；排空服务、加入原句柄、退役成对副本/自有端口/页面。当前spec与证据同步三个索引；文档检查、范围提交、最新上游普通合并、全待推集合核对、正常推送/加入原句柄/实际远端检查后继续。当前尚未确认新故障或实施，不预写通过。

## 已确认根因、影响与实施合同（生产修改前补齐）

- 2026-11-28重新跑原生产链检查，命令为packages/opencorvus下`bun run test test/provider-tool-null-values.test.ts`；原exec块8a4606退出1，隔离目录opencorvus-test-run-7bEyMd，物理与输出收敛true。13案例8通过/5失败/23断言：共用record常量时可空分支排第二导致value:null变{}；开放note分支真实rows被删；封闭note分支非空rows被删后错误输入成功；其他hint空占位存在时再次丢合法value:null；alpha/beta两种互不包含的空值解释任取第一份并成功。可空分支排第一及闭对象已知外来null占位通过，证明分支顺序与无条件删除都是直接触发点。此前压缩前最后一次输出未完整观测，不把它计作通过。
- 数据流是ProviderSchema.input投影→SessionLoop.prepareProviderTool→ProviderSchema.materializeInput→唯一tool-execution-input→原Zod/StructuredOutput校验和执行。旧实现首先接受必需const匹配的第一叶，未验证其余完整约束；随后遇到其他分支定义的属性无条件continue，连非空真实值或开放分支允许的值也删。原规范校验看见的已经是被改写的数据，故不能发现源输入损失。上批共享null语义只修“选中属性允许什么”，未修“选择哪个分支”和“哪些外来字段可删”。
- 全仓定义与调用搜索确认只有这个执行物化实现；registry、preset、原生扩展、MCP动态工具和StructuredOutput均经准备入口；仅requiresOpenAIStrictToolSchema为真的模型进入该适配。结构联合、嵌套判别、文件发布内容/附件、Office电子表格字面/公式、扩展授权输入、原根引用是直接回归面；非OpenAI模型及无联合普通属性沿原合同。MCP没有本地Zod最终校验的路径应保留原无效输入给其真实协议拥有者，不宣称已获得本地typed错误或外部服务验收。
- 替换旧首常量/唯一形状猜选器，保留同一个入口与递归对象叶/原根引用基础。完整原约束已接受原值时直接保持值。其余候选仅进行现有可选非空属性null→省略；闭对象才允许移除已知兄弟分支的null占位，真实非空值、开放对象额外值必须原样保留。各候选用原根完整联合约束校验（包含oneOf/外层约束），仅选择能保留所有其他有效候选字段和值的结果；相同结果等价，不可比较或无有效结果时保留原输入交回现有最终校验，不新增错误体系、工具调用、执行重试或流程规则。
- 共用schema-nullability已有Ajv原根上下文，增加完整值判定，不复制编译器、存储用户输入或手写schema验证器。官方[Ajv API](https://ajv.js.org/api.html)确认getSchema返回按注册根/片段的编译函数；[数据修改说明](https://ajv.js.org/guide/modifying-data.html)确认removeAdditional/useDefaults/coerceTypes属于显式修改选项，本项目继续关闭它们。泛型候选字段包含比较只比较已物化JSON值，不解释业务或schema。
- 对公共schema、持久数据、SDK、语言包、UI布局、版本和数据库均无格式变更，不迁移或重新生成。修改当前06-provider合同一处以移除过期猜选说明，原选择器整体替换属于已授权根因修复，不扩展清理。补原根引用/完整oneOf约束与正向输出、明确错误测试；原实际发布/Office输入、类型及真实模型读取文件→结构输出再回归。准备成本未知，实施后测真实Office声明，若明显增加需处理同根编译复用，不能忽略。
- 不涉及调度/队列/终态控制修改，当前复现未观察此类异常。主要风险是规范联合编译成本、模型真实空占位和嵌套oneOf外层约束；用聚焦当前生产测试、实际Provider流及原生桌面观察解决，未通过前不得宣称交付。

### 回归发现与方案校正（对应修改前）

- 原14987扩大回归发现旧structural-union最后案例把同一nested联合直接自引用，未前进输入位置。旧遍历跳过循环后输出data，所以旧测试只证明自制叶选择，不能证明完整规范接受。现实际Ajv在此栈溢出。官方[draft-2020-12 §9.4.1](https://json-schema.org/draft/2020-12/json-schema-core#section-9.4.1)及[draft-07](https://json-schema.org/draft-07/json-schema-core)明确此类无限递归语义未定义且实现不得无限循环。当前合同改为沿现有对象联合路径集合检测后明确schema错误，不静默跳过循环，也不捕获栈溢出猜叶。先收集/检测联合对象叶再做完整校验；合法“子属性推进输入位置”的递归继续允许，新增实际输出检查。范围仅现有联合遍历，不另造通用schema验证器。
- 新oneOf错误案例起初两个相同分支也使提供方输入本身无效，前置声明检查已正确拦住（14通过/1失败）。修正样本为一个声明hint、另一个只有kind的分支：原hint:null只匹配投影第一分支，移除hint后同时匹配两个规范分支；验证完整oneOf确实产生当前StructuredOutputPayloadError，避免把测试夹具错误当产品缺陷。

## 真实端到端发现的终态问题与横向审计（生产修改前）

- run160通过5受管不可变文件核验、凭据/完整目录/实际精确Sol流预检。真实桌面Excel会话ses_hj9qUBhWOC2b9wgTCEns首次作者/检查/验证/交付成功，art_g0VcF0NZa00vC10KCf2Z，原生三页已本人查看。公开session/message的format结构输出会话ses_-zUNkzaklzzAS8wxHlGu实际读取150字节输入并调用StructuredOutput成功，页面展开实际currency:null、总笔数6、净额17.65；原26435却HTTP500/退出1，诊断为completed without a durable reply。此处立即按共享终态机制审计，不以工具绿勾或数据正确降级。
- 根因：processUserMessage捕获规范结构值，beforeAssistantCompletion把值写到同一真实assistant.structured；Processor在工具结果全收敛后仍持久化真实Provider步finish=tool-calls。processUserMessage随后因structured已赋值结束本轮，但completed-reply唯一TypeScript/SQL（Structured Query Language，结构化查询语言）合同正确把普通tool-calls排除在最终回复之外。生产者把“格式编码响应已完成”写成“还需继续的工具步”，与消费者冲突；不是消息缺失、队列遗失、凭据、Provider未结束或模型算错。
- 旧structured-output-base-budget案例伪造Provider finish=stop掩盖该差异。本批只把流事件改为真实tool-calls，原3101退出1、0通过/1失败/1过滤，8kuUVY物理收敛true，准确复现同一durable reply错误。不是UI自动化；它仍是局部Provider流测试，真实Sol运行才是端到端证据。
- 横向入口：公开Session prompt→preparePublicSessionPrompt/executePublicSessionPrompt、项目Conversation/Global Chat、ControlMessage/gateway、CLI/GitHub、ACP（Agent Client Protocol，代理客户端协议）、AgentRunner、Task根调度/编排器、委派入口全仓搜索同一SessionLoop。仅公开Prompt的format与持久user.format投影条件结构编码；ControlMessage/委派/编排器/AgentRunner实际构造Prompt不设置json_schema，Task根决策工具收据与Mission唤醒不以结构输出代替决策。公开路由禁止跨Task/Mission权属直接Prompt。仍回归共享调度边界，不能只凭本场景排除共性。
- 横向正常/终态：completed-reply供SessionLoop、公开幂等重放、AgentRunner、ACP、持续目标、Session fork与Task-root ingress使用；protocol/session-wake-state的SQL使用同一合同。保留该唯一消费者规则，普通工具步、typed park/handoff、完成错误、进程中断、acceptedInputMessageIDs批次与Task决策完整性均不改。改动应发生在已有beforeAssistantCompletion最终生产分类位置：规范结构值已成功捕获且原finish=tool-calls且无规范错误时，将同一assistant最终finish分类为stop；真实step-finish仍保存Provider原tool-calls。其他错误/长度终态不覆盖，不合成消息、不加LLM工具流程门或额外模型调用。
- 横向重试/重启：精确输入重试和公开重放均读取同一不可变最终assistant；修复后的stop被原有TypeScript/SQL与恢复读者接受，旧失败保留原事实。permission恢复沿resumeOwnedPermissionInvocation重建同一format编码器；结构工具自身不产生权限副作用，通用受阻调用完成/错误/进程中断仍走原工具恢复合同，不能伪称做了真实跨进程中断验收。无持久格式变化或新影子状态/恢复分支，不迁移用户数据。回归正常真实会话、同identity公开重放、原调度TypeScript/SQL边界与现有进程/权限恢复测试。
- 横向串并行/隔离：模型调用串行策略不改，两个真实Work区间可重叠但Session/输入/项目归属从各自持久行检查；保留北/南8原输入、原23文件/3327旧行/2完成Task/23任务行/59字节资源，核对SQLite与旧交付物。没有证据支持队列/唤醒或多项目状态共享缺陷；本修复仅纠正最终响应生产分类，后续真实任务仍须通过后方可收敛。
- 第一份公开格式尝试ses_-zUNkzjEzzz9DOywRsGQ因kind只有const而无type，被真实Provider以invalid_function_parameters拒绝；是有效JSON Schema与Provider声明子集差异的新线索，尚未根因修复，保留失败。后续当前任务声明显式type:string以覆盖本批共用判别/空值目标，不把前失败计成功；下一批审计投影对无type const/enum的支持，不能在本批宣称任意JSON Schema都能真实Provider接受。

## 实施、真实验收与交付准备

- 参数物化已整体替换旧猜选器，共享原根Ajv上下文验证完整值，保留最大数据候选；合法原值保持、同常量顺序两方向、开放属性、非空外来字段明确错误、真实null与占位并存、不可比较解释明确错误、完整oneOf/外层约束、原根引用、递归错误与正常子对象递归全部通过。未改规范schema/SDK/持久格式/数据库schema13/版本0.1.56或UI布局。
- 最终写入钩子只在实际捕获结构值、无错误且原finish=tool-calls时分类stop，真实Provider step-finish仍为tool-calls。新增集成检查验证完整持久消息、SQL完成/恢复查询和同输入重放返回相同assistant；原调度普通工具、park/handoff、错误/进程中断、批次合同保持通过。旧错误会话未改写。
- 当前实际通过10后台文件/74案例/175断言：5622c0的2文件22/35；原45935加入0的3文件28/76；原4129中调度/ACP两个文件各自0合计13/27（整体因新增测试SQL参数键误写userMessageID而失败，已改为真实messageID，不能把整体计0）；原50246加入0的2文件10/36；原15070加入0的Mission真实子进程StructuredOutput中断恢复过滤案例1/1，接续后台类型检查退出0。此前测试夹具/SQL调用键错误均已修复并重跑对应原验收。没有新增/运行UI自动化；局部流stub不冒充真实模型。
- 真实Office任务从原生桌面输入启动，首次作者→检查→验证→读取PDF→交付成功，完整3工作表/6580字节XLSX/368115字节3页PDF。本人真实展开、缩放50%/75%、翻到全部3页、点击两个实际下载；下载字节与当前规范附件完全一致。独立读取实际XLSX全部单元格与完整作者输入相等，再按原CSV使用Decimal核对6笔原记录/原顺序、普通3/23.65、退款2/-6、样品1/0、总6/17.65；缺失币种明确未知。原型表格预览保留现有网格、静态值及尾零省略，不宣称公式工作簿或参考Excel像素对齐。
- 修复后run161公开格式新会话ses_-zUNkxY3Gzzr3DErUUCy，真实读取输入→StructuredOutput首次成功，真实assistant msg_g0VcF2TNz00VwBUeRzdh最终stop，完整结构值保留currency:null、去除可选非空note:null占位，6/17.65和3组均独立源数据核对。再次POST同一msg_9e58ba4f-d66e-4cb1-aadc-f0a17f7e2d70请求返回HTTP200/相同assistant/完整持久消息原样，桌面实际展开currency:null并人工查看正常空闲终态。通过的是公开API发起与随后真实桌面查看，未伪称其格式输入由原生UI创建。
- 真实Provider总24次精确gpt-6.1-sol流请求，run16019/run1615，全HTTP200、reader收敛EOF；其中第一份无type const声明仍是流内业务拒绝，另一个是修复前终态HTTP500，二者明确保留，不能把24个流通道都计业务成功。5受管原生运行文件均在启动请求前通过不可变身份核验。
- 原23文件/3327旧五表行、2完成Task/23任务行/59字节原CSV资源及快照、8北南业务输入保持；66旧交付物含6电子表格通过实际API读取完整payload相等，SQLite完整性ok。20次真实Office准备测量首114.11ms、后19次平均57.51ms；前批同类首85.94/平均38.48，约增加19ms重复准备成本。完整联合校验有此代价，不宣称缓存跨不同schema对象命中或绝对延迟承诺。
- 本批10原始桌面截图本人复核，原始47成员ZIP保留图片、2原文件、8业务输入和公开事实字节；排除凭据/完整数据库/原私有配置/不透明推理内容。原服务160的86653、161的10886都已排空并加入退出0，成对凭据与模型目录副本已退役、51776关闭，自有463/466/469页已关闭，旧392/428未绑定不伪称关闭。
- 下一批已确认需调查：合法但省略type的const声明被真实Provider拒绝；尚未承诺修复。当前批聚焦参数完整性与实际发现的结构响应最终分类；文档检查、范围提交、上游同步、待推集合和原推送退出/实际远端确认仍待执行后记录，不预写通过。
