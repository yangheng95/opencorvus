# 有限字面值工具声明的类型投影

## Recall

- 用户要求持续按批次迭代直到明确停止，本人独立执行，不用子代理、额外聊天、分支或工作树。现有Provider（模型提供方）凭据及完整模型目录、精确openai/gpt-6.1-sol流式请求不限；不刷新或披露凭据。先根因/影响与spec（规格），再修复、聚焦正向检查、真实桌面与截图本人复核、必要真实模型任务，范围提交、最新上游普通合并、正常push（推送）及原句柄退出/实际远端核对后继续。
- 前批f6ac7f41d24e60c79b778d843336cf91ebc16bca的原76883推送已加入退出0，私有delivery-result核对HEAD/上游/实际远端同值0/0、暂存空、177原差异精确保留。74后台案例175断言、类型/全部正常钩子、24精确Sol流200/EOF（End Of File，流结束）、10原生截图、2真实XLSX（Excel工作簿）/PDF（Portable Document Format，便携式文档）下载复核。24个流中第一份无类型声明拒绝和第二份修复前终态错误保留，未冒充业务全部成功。
- 参数联合保留合法null/开放数据并按完整原约束消歧，真实格式响应最终分类stop，原Provider步tool-calls保持；前批已做全生产入口/Task（任务）/Mission（多步任务）/Session occurrence（会话执行轮次）、恢复、重放与项目隔离审计。真实新结构任务读取150字节源输入，首次输出6/17.65、currency:null并完成，同identity公开重放返回原assistant；原生Excel3页和所有实际单元格/下载字节核对。
- 原run160的86653/run161的10886均已排空并加入0、成对凭据和完整目录副本及51776退役、自有463/466/469页关闭；旧392/428未绑定不伪称关闭。新批重新保护原23文件/3426旧五表行（message606/part1777/request488/outcome488/artifact67）、67旧交付物含6电子表格、北南8业务输入、原2完成Task/23任务行/59字节原CSV资源，样例Git f7bf091156c9b137c4eb3d5b822721294e9a8f24。无版本更新、额外授权或请求上限。
- 已读前批Recall/错误摘要、06-provider当前合同、ProviderTransform.schema→strictifyOpenAISchemaNode、ProviderSchema.input/materializeInput、SessionLoop真实结构工具/公开format入口和实际预检工作器。已全仓搜索有限字面值类型与投影：同一normalizeOpenAIStrictToolSchema入口无独立有限值类型投影；合并根联合属性只有显式string类型才合并const/enum。所有OpenAI严格参数工具共享该投影；非严格模型沿各自现有入口。

## 已观察问题、影响与调查方案（生产修改前）

- 原真实会话ses_-zUNkzjEzzz9DOywRsGQ通过公开session/message格式请求，以kind:{const: settlement}作为合法声明，但Provider在/properties/result/anyOf/0/properties/kind拒绝“schema must specify a type”，流内invalid_function_parameters，模型尚未执行工具。上一批显式type:string的同业务请求成功，不能把第一份失败计作凭据或模型算错。当前本地JSON Schema（JSON结构约束）Ajv检查接受无type常量，故局部测试不能证明Provider子集可接收。
- 代码线索：strictify只做可选属性必需化/空占位，未把有限const/enum值已确定的JSON类型投影出来；递归又无差别进入每个对象/数组，包括const、enum、default、examples中的真实字面数据。后者可能把字面对象的properties等业务键当schema改写，目前尚未机械复现，不能预判已修复。
- 官方[JSON Schema enum说明](https://json-schema.org/understanding-json-schema/reference/enum)明确enum可省略type并混合值类型；[OpenAI支持的结构声明子集](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas)说明类型与嵌套anyOf的限制。当前仓库实际用best-effort function工具定义而非声称strict:true全量JSON Schema；只做有严格语义依据的有限值投影，原规范仍拥有执行校验。不猜测无约束schema的业务类型，不新增后备工具或绕行请求。
- 先用真实生产StructuredOutput→prepareProviderTool→提供方声明→执行/onSuccess建立正向输出与完整声明约束复现：字符串/数值/布尔/null常量、混合枚举、原根引用、嵌套数组/对象字面值及显式类型交集。必须保留const/enum本身、注释与字面对象身份；typed错误合同按原规范验证。若发现递归修改数据，先补直接触发/根因/受影响关键字与公开调用面后再修同一个入口，不复制JSON Schema验证器。
- 相关契约面：动态MCP（Model Context Protocol，模型上下文协议）工具、用户format结构输出、Zod导出预置工具、根联合合并/严格根envelope（参数包络）和原根引用、可选null占位。当前尚不改变公开/持久schema、SDK（Software Development Kit，软件开发工具包）、数据库schema13、版本0.1.56或业务提示流程；若实现需要依赖变化，先明确成熟工具必要性与锁文件影响，不为局部问题引入平行验证层。
- 验收重放原失败的无type常量业务声明，精确Sol真实流读取源CSV并保留未知币种null、6/17.65和真实引用，实际进入原终态checker（检查器）。新输入/输出不预填答案。真实独立开发/ui/原生交互、截图人工复核和必要下载；无UI（User Interface，用户界面）自动化、DOM（Document Object Model，文档对象模型）/组件/源码文案/快照/像素测试，不另起Vite。不以单元、类型或控制台代替真实页面。
- 若再观察调度/队列/唤醒/恢复/并发/终态异常，立即审计全生产入口/Task-Mission-Session occurrence/正常终态/重试重启/串并行/项目隔离，不能以模型行为或单例通过降级。凭据与完整模型目录配对，启动前分别证实可用、目标模型投影与实际请求模型一致，所有Office调用沿生产隔离环境且首请求前验证锁定1.0.158完整5受管文件，不重复裸CLI自更新事故。
- 保留3426旧行及全部原数据、177无关差异；三个索引已加本批精确链接、十月索引不动。收敛时排空/原句柄退出/退役成对副本和自有端口页面、归档无凭据原字节证据，文档检查、范围提交、最新上游普通合并/全待推集合核对/正常推送，核实原push句柄0及实际远端后继续。

当前只有上述真实声明拒绝与代码线索，尚无本批生产修改或新通过结论。

## 已确认根因与实施合同（生产修改前补齐）

- 真实生产准备链的两个新正向案例在8fa86f退出1，ZoE4nX物理/输出收敛true：标量const/混合enum类型全部缺失；const/enum/default/examples中的普通对象properties被必需化，kind/false被改成anyOf，required原original被替换，原字面数据已改变。全量值/声明断言属于后台工具合同，不是UI文案测试。
- 横向核对同文件schemaValidationIdentity发现第二份通用JSON递归无差别移除title/description等键。新增实际ProviderSchema.normalize根联合案例，以两个合法const对象{description:北仓/南仓}输入，实际规范投影只接受第一份，输出[true,false]。f1e726退出1、qU0yPK收敛true，3案例全失败，证明去重键也把业务数据当schema注释，不能仅修strictify。
- 数据流：ProviderSchema.input/output/normalize→ProviderTransform.schema的根联合属性域合并与严格投影。直接触发是有限值未注明类型、字面对象有schema同名业务键、根联合字面对象仅注释同名业务值不同。根因是两个递归实现没有区分schema位置、schema映射容器和字面数据。原Zod导出通常带type、简单标量数据不含properties/description，旧局部Ajv又接受无type，所以未捕获真实Provider缺口；最终规范校验看到的声明已被误改，可能导致模型生成错误值或合法分支不可表达。
- 成熟工具选择：锁文件已含Ajv使用的json-schema-traverse1.0.0，且本地有类型定义。已读[官方遍历合同](https://github.com/epoberezkin/json-schema-traverse)：只回调schema对象，支持前/后序、原JSON Pointer，不解析引用，默认不把const/enum/default数据当子schema。使用此成熟遍历器作为直接精确依赖，沿同一私有遍历primitive处理两个已证实重复入口，移除原任意JSON递归的schema解释；不复制库或修改其全局关键字表。标准2019/2020的dependentSchemas/prefixItems/unevaluatedItems/unevaluatedProperties/contentSchema通过该primitive补其子schema入口，不进入未知注释数据或更改引用。
- 投影先在未修改原根遍历中计算每个schema位置可选属性的完整null语义，再对独立副本后序处理实际schema节点，保留原根Ajv上下文和schema映射键身份；不在已编译原根上原地修改。仅无显式type且有限const/非空enum能严格推出类型时补JSON类型（整数常量可用number，因为const本身保持精确值）；混合域保持类型集合，既有显式类型与其他全部约束保留，不猜无约束schema。const/enum/default/examples原始完整JSON值保持。
- 去重只删除实际schema节点的注释，稳定对象键排序仍可覆盖数据对象但不得删除其业务键；相同验证约束的不同schema描述仍允许既有去重/较长说明选择，真实字面域不同必须都保留。预置工具/根包络/原根引用/可选null/嵌套联合、授权工具字符预算和实际模型声明是直接回归面。Gemini现有值转换策略不是本批已验证支持；不据此宣称跨提供方任意schema可接受。
- package依赖和bun.lock需同步声明现已锁定成熟包，不升级其他依赖；修改前保存packages/opencorvus/package.json原字节，检查正常锁文件/拓扑。无公开工具/持久格式、数据库/版本或SDK变化。增加映射名称与新标准子schema位置的正向完整输出检查，重复原无type声明的真实业务验收；准备成本和真实Provider对子集混合/对象有限值支持仍未知，必须实测，不能预写全类型真实接受。

## 实施与验证结果

- 两个已证实入口改用同一个实际schema位置遍历primitive：成熟json-schema-traverse处理draft-07，单一私有入口补2019/2020子schema；无全局关键字表修改。严格投影先从完整未改原根求可选null语义，再对独立副本后序处理，有限值补确定类型。去重先只删除实际schema注释，再对完整JSON键排序，字面对象的description等数据保持。旧任意JSON递归schema解释删除，没有平行或兼容实现。
- 精确新增直接依赖json-schema-traverse1.0.0；bun add重新排序的两个无关条目已按审查过的差异恢复原位置。最终packages/opencorvus/package.json和bun.lock各仅一行增加，无其他依赖版本变动，根package/overlay配置保持。schema13/版本0.1.56/公开和持久格式不变，未重新生成SDK。
- 6后台文件共55案例122断言实际通过：原53098中的5个既有文件分别退出0，50案例111断言；其整体退出1是新增2020位置夹具未声明tuple/document为required，却按必需属性期望，忽略真实可选null包装。仅修夹具required并以2c7ac8重跑原新文件，5案例11断言退出0；不把53098整体计0。覆盖各JSON有限类型、完整对象/数组常量和枚举、示例默认值、业务注释同名键、映射名const/properties、原根引用、标准新子schema位置，以及已有联合/空值/权限与字符预算。原47753后台类型检查加入退出0。
- run162请求前验证锁定OfficeCLI1.0.158完整5受管文件、Provider凭据可用、完整目录目标已投影、实际gpt-6.1-sol流。5次HTTP200/reader EOF、全部排空；原60912加入退出0，成对凭据/模型目录副本和51776已退役。没有本批原生Office调用或模型委派。
- 原失败完整业务format/parts/model原样复制，只给新Session与唯一输入身份：ses_-zUNksqsNzzFAJmfS2fm/msg_231d96c4-3f51-43c5-abb1-0a5a807a2d9c。仍是kind仅const、无type的原声明。真实读取源CSV→StructuredOutput首次完成，真实assistant msg_g0VcF7Awh00l62G11Aak以stop持久化，6笔/17.65/3组与Decimal独立重算一致、currency:null完整保留。精确同identity公开重放HTTP200返回同assistant及完整消息原样。不是把type加进验收输入绕过问题。
- 原生独立/ui/打开该真实会话，实际展开工具输入、result、options，截图本人复核kind/6/17.65/currency:null、成功输出与空闲终态；2原始JPG存证，自有475页已关闭，旧392/428未绑定不伪称关闭。格式请求由公开API发起，随后桌面真实交互，没有伪称UI具备格式schema编辑器，没有DOM/组件/文案/快照/像素或其他UI自动化。
- 原23文件/3426旧行、2完成Task/23任务行/59字节原资源及快照、8北南输入全部保持，SQLite完整性ok；67旧交付物含6表格逐一实际API读取完整载荷相等。项目记忆revision20/idle/pending0/dropped0。20次实际Office准备首106.56ms、后19次平均52.78ms；与前批114.11/57.51处于同一量级，不宣称统计性能提升或跨新schema缓存命中。
- 文档检查037543退出0：354接口/26组、20当前架构文档链接有效。证据20文件，26成员原字节ZIP保留2截图/8业务输入/公开事实；排除凭据、完整数据库、原私有配置和不透明推理内容。旧失败可通过原f6ac证据与新provenance核对，没有改写为成功。
- 局限：真实Provider验证的是原无type标量const业务声明；混合枚举、对象/数组字面数据与标准2020位置为本地生产投影/执行合同，不宣称任意Provider子集或外部MCP/Gemini服务都支持。根合并开放性与Gemini既有转换策略不在本批真实验收范围。当前范围提交、上游同步、正常push及原句柄/实际远端核对将在执行后收据中记录。
