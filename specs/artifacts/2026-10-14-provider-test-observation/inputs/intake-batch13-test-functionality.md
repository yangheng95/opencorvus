# 第13批候选只读调查：Provider Test模型来源、结果事实与变更归属

## Recall / 本轮边界

Root已接收自动ID报告，另将本轮候选收敛到Provider Test。本agent只读定义、路由、调用、流式/选模/错误合同、模型目录和变更归属、相关历史与测试；只新增此scratch。没有运行测试、UI自动化、服务、Provider/模型请求，没有修改产品、正式spec、第12批文件或其他owner文件，没有再次委托。

第12批在Root正常提交/推送中，本报告读取到其新的保存后观察实现，但不把相关文件当前无diff当作自己交付。后述故障除既有测试文件中的明确合同外均是源码证据，本轮没有实页/HTTP复现，不宣称验收完成。

## 1. 全部生产入口与公共结果

唯一后端业务函数：`packages/opencorvus/src/provider/operations.ts:164–250`：

```ts
testProviderConnection(providerID: string, modelID: string | undefined, scope: ProviderOperationScope)
// scope = { config: () => Promise<Config.Info>, global: boolean }
// Promise<{status: 200 | 400, body: {ok, status: 'connected'|'error', providerID, modelID, message}}>
```

两个生产公开路由共享它：

- `server/routes/provider.ts:287–332`，POST `/provider/:providerID/test`，project `Config.get`、global=false。
- `server/routes/global.ts:870–903`，POST `/global/providers/:providerID/test`，`Config.getGlobal`、global=true，无活动Project也可调用。
- 两者输入body及body.modelID均optional；成功/业务失败200输出五字段。Auth读取故障有具名503。当前OpenAPI对400仍用通用BadRequestError，但函数两个早期400实际给出五字段test result，属既存文档/错误形状差异，不能把它当200成功或据schema删掉真实字段。

SDK当前 `types.gen.ts:27205–27250` / `GlobalProvidersTestData/Responses`保留optional模型和完整五字段200；`sdk.gen.ts`同时有project/global方法。纯Overlay消费变化不应手改生成SDK；如果决定更改后端错误公共合同，应由唯一route schema生成并核对影响。

Overlay唯一服务入口 `services/llm.ts:426–438`：

```ts
testProviderConnection(providerID: string, modelID: string, options?: {directory?: string; authority?: ApiAuthority})
// Promise<ProviderTestResult>
interface ProviderTestResult { ok: boolean; message?: string }
```

它捕获/检查ApiAuthority，按options.directory选global/project URL，POST `{modelID}`，原样返回apiJson。类型少声明status/providerID/modelID，但运行时对象没有被删字段。只有ProvidersPanel导入并调用此服务（:318）；没有CLI或其他Overlay组件另行调用。

另外两个实际生产脚本直接调用公开HTTP，不经过Overlay：

- `script/expert-squad-evolution-e2e.ts:740–764`先读catalog，再对明确Provider/model POST project Test，要求HTTP成功、ok=true、status=connected，用于后续Mission资格前置。
- `script/benchmark/external-agent/run-automationbench.ts:1608–1626`POST global Test，要求ok/status和实际modelID等于输入；它是benchmark启动后、任务创建前的资格，不是Task/Session内部自动重试。

搜索当前测试/脚本和两个函数全部引用后，没有发现第三个生产Test实现或在Task/Mission/Session每轮自动触发Test的代码。public SDK外部消费者未知，不能据此宣称只有两个外部调用者。

## 2. 选模链路：已确认的声明/有效模型错位

页面自定义行来源为 `ProvidersPanel.configProviders:472–479`，读取 `appStore.config.provider` 并过滤disabled；不是有效Provider目录。`unfilteredProviderEntries:924–946`保留声明provider，modelIds来自其models；`:1221`点击Test传 `row.provider.models || {}`。

`handleTest:297–305`首先执行 `Object.keys(models)[0]`。空对象/省略models便写本地 `{ok:false,message:t('provider.test.no_models')}` 并返回，真实HTTP完全没被调用。非空也只拿声明对象插入顺序的第一个ID，而不是catalog发布的默认模型或过滤后的有效模型。

有效模型真源链条不同：

1. `Provider.buildState`先从canonical models.json和plugin投影建立database，然后按config.provider同ID合并声明。`:377`先保留existing.models；空models不会清掉catalog模型；model过滤/blacklist/whitelist发生在后续原builder。
2. `Provider.catalog/catalogGlobal:858–871`给database、runnableProviders、issues。项目 `/provider:69–90`将database和runnable同ID合并后返回all，并由唯一Provider.sort产生default[id]；global路由相同contract。
3. `config-load.loadProviderInfo`保留原scope/authority/sequence，将HTTP事实写入appStore.providerCatalog，失败以独立providerLoadIssues表达，不把旧目录当新成功。
4. 后端Test先取原scope的runnable Provider，然后 `selectedModelID = modelID ?? Provider.sort(Object.values(provider.models))[0]?.id`（operations:191），并把同一config snapshot传给getModel/getLanguage。

因此 `config.provider[id].models={}` 且有效catalog有继承模型是合法可达状态，页面却报“未配置模型—至少添加一个”。已有真实配置/Provider数据正向测试 `test/provider-empty-declarations.test.ts:288–298`对global/project验证：空声明200，catalog返回catalog-model/shared-model，connected包含该Provider。该测试不调用Test，不是本轮UI复现，但明确排除了“后端空声明一定无模型”的假设。

相邻同根因：声明第一个model可能已被当前blacklist/alpha/loader过滤，而catalog仍有其他可用model；页面会传一个当前不可用显式ID，后端精确拒绝它而不会擅自换模型。不能把这归咎为Provider联网失败。完整覆盖要对照声明与实际catalog，不宜只删空对象guard后继续声明选模。

现有可复用前端primitive：`llm.modelsForProvider:374–377`读canonical appStore.providerCatalog模型；`defaultModelForProvider:408–420`按显式当前config.model（属于该Provider且目录存在）、catalog.default[id]、目录排序首个选出值。后端可选modelID的默认分支也已存在。正式方案应明确选择哪一个现有合同：若界面要让用户预知测试模型，可展示并提交当前目录里明确模型ID；若采用公开API默认模型，则省略modelID并展示服务器实际返回的modelID。不要再复制第三套排序规则，也不要在服务端把显式失效ID自动换成别的模型。

catalog.all包括尚不可运行的目录条目，不能仅凭all里有模型就断言认证/推理可用；loader/enable过滤与真实连接仍由后端权威判断。当前custom行也可因enabled名单排除而继续可编辑，这不等于授予其可运行资格。

## 3. 后端错误、真实流式与授权边界

当前行为精确如下：

| 路径 | 实际HTTP/数据合同 |
| --- | --- |
| scope.config或scopedProvider读取抛出 | 位于try前，沿原服务器错误处理；不能统称Test业务false |
| scopedProvider未返回runnable Info | 400 + ok=false/status=error/providerID/modelID输入或空串 + `Provider is not configured. Set API key or auth first.` |
| Provider存在但默认未选到模型 | 400 +同五字段，message=`Provider has no available models.` |
| 显式modelID缺失或SDK加载/请求抛出普通异常 | 200 +ok=false/status=error，保留selectedModelID；原错误/一层cause message进入现有ProviderError脱敏 |
| Auth.findReadError | catch显式rethrow，保持typed503，不能降成普通reachable失败 |
| stream内error事件 | 全部消费后，200 +ok=false/status=error与错误字符串；保留providerID/selectedModelID |
| stream正常消费完成且没有error事件 | 200 +ok=true/status=connected/providerID/selectedModelID，message固定`Provider is reachable.` |

注意 `getProvider/getProviderGlobal`当前通过 `runnableProvider`只返回models非空的Info。因此真实configured零模型或全部过滤的Provider，也会落入第一个“not configured，set key”400；这条message**不能证明Auth没配置**。第二个no-available分支在正常当前runnable getter下通常不可达。若本批修结果事实，可改为不虚构凭据缺失的现有错误描述或按现有configured事实区分，但不能扩大runnable公共getter。是否纳入后端公共错误变化需Root先落盘。

Test是真实最小模型请求，不是GET/models或凭据格式检查。operations:206–220走实际getLanguage→ProviderLLM.wrapModel→唯一llm/api.streamText，usagePurpose=`provider-connectivity`，请求内容`Reply with OK.`。普通模型maxOutputTokens=64；OpenAI OAuth（Open Authorization，开放授权）特例沿原store:false/instructions，不设该maxOutputTokens。30秒AbortSignal，wrapper timeoutMs=false只关闭另一默认计时器，保留此30秒信号；wrapper包裹async iterable处理abort。共享wrapper明确maxRetries=0，此Test没有另包withLLMActivity，不能误称有SDK自动重试。

LLM交互仍流式：`:222`for-await消费SDK v7的stream；向UI的控制HTTP最终返回JSON，不要求把控制响应误改为SSE（Server-Sent Events，服务器发送事件）。包装模型保留请求时Provider/model metadata，llm/api:103–129在onStepEnd落UsageLedger，purpose专门标识连接测试，无虚构Session/Agent归属。外部benchmark汇总也显式分开provider-connectivity。

当前成功合同是流正常完成且没有error事件，不校验模型文本是否严格等于OK。没有本轮真实空输出/拒绝/异常EOF证据，不能凭这个描述另造backend成功判定缺陷。语言模型调用可能计费；页面按钮title已明确“发送最小请求验证API key与模型”。本轮没有发任何Test请求。未来本地SSE参与者只能证明真实协议链，不能冒充真实厂商鉴权/模型质量；真实Provider资格仍须Root已有授权和凭据/目录/实际模型三项核对。

## 4. 结果事实及语言显示

Panel局部 `testResults: Map<providerID, ProviderTestResult>`保存三种不同来源：本地no-model提示、HTTP200业务结果、catch后的 `{ok:false,message:err.message}`。接口只有ok/message，因此TS层没有要求真实provider/model/status存在；但HTTP200运行时原字段仍在。

`:1255–1260`只用ok切tone并优先显示message，没有显示实际providerID/modelID或请求身份。后端成功message固定英文，会一直覆盖 `t('provider.test.success')`，所以中文页面也显示英文成功句。这是确定的渲染数据流，不需要猜测品牌文本是否应翻译。建议产品正文基于ok/status由当前locale渲染，实际供应方错误/message作为原文details；真实模型标识保留原文。不能用翻译成功句替代实际请求模型事实。

普通400/503会被apiJson抛为保留status/path/body/requestID的ApiError，但Panel catch只留message，丢掉可呈现的结构化错误身份。可沿既有formatErrorDetails展示细节和本地化摘要；不要把“请求失败/未知”合成有实际modelID的server receipt，也不要拿输入模型冒充服务器已测试模型。

另一个现存旧状态是appStore.providerTest：`llm.providerState:245–259`读取它，`store/app.ts:263`导出setter，但全仓当前生产只有workspace清空它，没有任何Test成功发布者。Panel从未调用setter。因此不要为本批将局部Test map再复制到这个store，造成双事实源。它属于触及范围内可核对的旧代码候选；若要删除须说明providerState状态分支/接口影响，不能顺手扩大无关清理。

## 5. 同scope变更归属与共享机制边界

当前已经正确处理的维度：

- Test启动捕获providerTestScopeGeneration、该Provider自己的generation、providerLoadOptions。
- `ownsResult`同时验证它们与原authority/selection/directory；普通目录A/B/A、同目录API authority更换都由effect:255–278推进scope generation并清busy/results。卸载:434–440也退休scope。
- 每个Provider的Test独立，可以并行；同ID后起generation覆盖前一个owner。UI按钮testing时disabled，但代码本身没有额外排队/重试。

仍有源码资格候选：Test结果只按ID持有，没有将same-scope已提交config/Auth/catalog变更纳入其owner。第12批handleSave、SaveKey、handleAuth、catalog/models refresh更新对应事实并reload，但没有改变Test generation或清Test结果。旧成功卡可以继续对应已经更换的API/Key/model；in-flight旧请求晚到仍满足ownsResult并写回。`handleDelete:892–895`只删result，没有递增per-ID generation，所以被删ID的在途响应还能再次写map；若随后同ID重建，旧结果可被新行看到。以上未在本轮实跑，不称实际race复现。

实现风险：不要为同scope变更递增`providerTestScopeGeneration`——它也被providerLoadOptions捕获，所有Save/Auth/refresh复合动作都共享这层scope owner，贸然推进会把正在处理的保存后读取一起退休。应复用Test独有per-provider generations，在明确目标事实变更时结算对应busy/result；旧finally在owns=false时不会清busy，退休操作必须同时处理当前busy，不能制造残留。

哪些变化退休测试应在spec讲清楚：成功config200/committed receipt、成功Auth写入、Provider删除、明确catalog/model刷新/替换都可能改变Test语义；单纯打开/编辑未提交draft并不一定改变当前后端事实。不要用config/API key明文JSON作为新cache键，也不要另建通用workflow或后台重试器。

当前发现是UI结果owner缺少same-provider变化维度，不是已观察后端调度或终态异常。横向调用面已覆盖两个HTTP scope、Panel串/并行Tests、真实benchmark前置、SDK外部边界；Test本身不创建Task/Mission/Session occurrence，不在其每轮/恢复时自动执行。其在途请求使用自己的30秒信号，当前路由没有把HTTP断开自动等同于模型物理取消，scope退休仅停止旧UI反馈。未来真实资格若出现请求无法完成/取消、实例停机或跨项目互相阻塞，须立即按AGENTS扩大到实际共享stream/Instance/Task/Mission/Session正常终态/重试重启横审，不能用“只是Test”降级。

## 6. 历史及未根治原因

- `65d0bfc983`根提交已有声明取第一个model、空model本地拒绝、局部结果Map和后端selected/default模型操作。没有找到此之前原始决策，不推测产品意图。
- `677f7afd17`（2026-10-06）补authority/selection/目录归属，但没有加入同scope配置/凭据变更；对应归档 `next-provider-panel-audit.md:23,25,33`明确Test是单POST、旧主要问题是连接切换反馈，原A/B/A已有guard。当前不能重新报这些已修维度。
- `3026d8551`把后端流事件/throw错误message接入现有ProviderError脱敏；`0163df103`增加provider-connectivity用量purpose；`0c187499b`保留AuthReadError typed503；`1fbad2847`迁移SDK v7的fullStream→stream。这些都没有改变声明模型来源/前端结果呈现。
- 第7批count spec明确connected并不代表此次真实联网成功；第8批保留configured零模型但runnable getter不扩大；第11批明确models:{}合法继承；第12批只解决保存后catalog观察。它们未改Test选模，所以现在正常可编辑/可继承状态更容易碰到旧guard，不能让用户加假模型来绕过。

## 7. 测试清单与资格建议

本轮均未运行：

| 文件/检查器 | 已有内容与资格边界 |
| --- | --- |
| `overlay/test/llm-provider-operation-scope.test.ts` | 两例纯service本地HostTransport：global路径、project目录/body。不是UI测试；fake response仅ok/message，若完善结果接口，应按真实producer补status/providerID/modelID，不能保留半形状兼容分支 |
| `overlay/test/config-load-ownership.test.ts` | service ownership、独立resource结果；可验证catalog事实发布，不覆盖Test请求/页面 |
| `overlay/test/provider-refresh.test.ts` | 刷新服务合同，非UI；不证明Test卡已退休 |
| `opencorvus/test/provider-empty-declarations.test.ts:288+` | 真实Config/Provider/public handler/持久文件的global/project继承模型正向数据合同；不发模型，不是Test HTTP资格 |
| `opencorvus/test/provider-stream-error.test.ts` | decoder/Message/collectLLMText局部正向错误合同；有脚本async iterable，不是Test route的真实Provider流 |
| `opencorvus/test/provider-error-redaction.test.ts` | 成熟纯数据脱敏输出合同；不代表任何实际Test请求发生 |
| `opencorvus/test/controlled-streaming-provider.test.ts` | 检查本地SSE参与者本身；不是自动跨Config→vendor→Test route，不能单独冒充完整checker |
| `expert-squad-evolution-e2e.ts`、`run-automationbench.ts` | 有生产HTTP Test前置，但会进入更广真实模型工作，不适合为了这个小修复直接运行整个脚本 |

全仓精确Test函数、路由、UI data-testid/ProvidersPanel引用检索在当前相关test/spec文件中**未发现UI自动化或源码文案/DOM断言**；没有应据本次证据删除的具体UI测试文件。不能把HostTransport标成UI，也不能因后端测试读真实config/catalog文件便标成UI源码检查。没有扩大扫描无关UI路径，更没有运行任何UI测试。

没有找到直接覆盖当前Test operations/两个路由完整正向流的现成单测。若Root只改UI选模/结果显示/退休，可先用已存在服务数据primitive做纯业务exact-output测试，真实页面完成UI资格；若增加或修改非UI结果adapter，就加对应完整结果解析/实际ApiError身份正向合同，禁止组件源码断言或复制一套test-only owner逻辑。

最聚焦的后端真实协议资格（待授权实施）：独有runtime/model catalog含当前required本地项，虚构provider既有两个目录模型、config声明models:{}，API指向loopback SSE参与者。两scope真实public Test：显式模型和省略模型各自返回精确providerID/modelID/status/ok，并核对参与者实际请求model、stream:true、正常EOF与Usage purpose。另用真实HTTP400/stream error输入检验原错误结果，不要用spy替代stream或复制SDK。它是本地协议资格，不能称真实厂商认证通过。

桌面建议矩阵：两scope声明空/有效目录非空；非空声明第一个被过滤；同scope已完成Test后保存API/Key/model并观察卡与新请求；Test在途时完成变更/删除/重建，原owner结果与新scope清晰；更换语言后正文翻译而技术模型ID保真。真实页面截图和请求实证由Root执行，不由数据测试代替。若卡片需显示selected/default模型，先明确授权该按钮到底测试哪一个现有目录模型，再实施唯一选模primitive。

## 当前结论

确定源码缺陷是配置声明被当成有效测试模型来源，已合法继承的模型被本地guard阻挡；结果字段/语言与same-scope事实变更归属存在可追踪候选。后端具备流式、精确返回模型和scope隔离的现有基础，无需新增模型调用协议、Auth来源、推理fallback或平行catalog。真实前后资格、同scope竞态及后台终态均尚未在本轮运行，不能写成已修复或共享根因全部排除。
