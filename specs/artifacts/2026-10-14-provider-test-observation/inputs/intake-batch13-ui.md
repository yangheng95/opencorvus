# 第13批只读 UI/UX intake：Provider Test 与结果区

## Recall 与证据边界

Root已完成第12批真实桌面资格，正在归档/提交；本委托只调查Provider Test的结果语言、缺模型/缺凭据判断、时间/状态/长诊断和列表可用性。不得修改第12批交付文件，不修改产品/测试/正式spec，不执行UI自动化或模型请求，不启动/操作服务、页面、凭据，不再次委托。唯一写入本scratch。

已读最新ProvidersPanel、llm、app store、Provider operations与project/global test路由、Feedback/相关CSS、现有纯service测试、当前06-provider/07-panel/07-panel-reactivity、B10/B11/B12历史边界。重新读取当前AGENTS前部，未进行任何数据库或其他并行范围工作。全仓检索testProviderConnection/ProviderTestResult/providerTest/setProviderTest、所有testResults写入、六个provider.test语言键及测试调用；未运行测试。

本分工亲自查看B11 `after-inherited-empty-form-zh.png`：owned-inherited行显示0个显式模型、已配置Key，编辑textarea为空且继承提示可见；图中没有测试结果。另读B11自有公开API产物 `after/projection-global-inherited.json` 的投影：status200、owned-inherited、catalog-one/catalog-two、apiKeyConfigured=true、connected=true，证实空配置声明可以拥有继承的runtime模型。没有读取真实Auth/models文件。

亲自查看B12 `screenshots/after-project-inline-key-failure.png`：真实保存Key失败使用短英文摘要+Details，Provider行Test按钮可见，但没有点击Test结果。这张图只用于既有Feedback与列表信息结构参考，不能当成本批连接测试资格。

## 总结与优先范围建议

当前最清楚的候选是Provider Test缺少完整的“当前测试回执→本地化摘要/原始详情→失效退休”表示合同。三个紧邻问题都有代码证据，但本轮均没有实际点击Test资格：

1. 每次成功的固定英文产品回执覆盖中文摘要；长错误主文及HTTP诊断丢失。
2. 前端把config显式模型集合误作完整可测试集合，阻断catalog继承；后端把无runnable Provider归为缺配置/Key也不够精确。
3. 顶层Map按Provider ID保留结果，配置/Key修改后没有实际退休，可能让旧成功/失败贴在新配置旁边。

Root可将其作为同一Test子系统的正式分析范围，但应先实际复现后决定本批实施边界；不能只把英文字串换成中文就称模型选择与结果生命周期已修。

## 当前单一请求与结果流

- Test按钮位于Custom providers行，`ProvidersPanel.tsx:1221`传入`row.provider.models || {}`。catalog-only行没有同样Test按钮，不能在报告中声称两类行均可直接测试。
- `handleTest:297–305`先取Object.keys(models)[0]；没有ID就写入本地 `{ok:false,message:t(no_models)}`，直接return。没有实际HTTP、Provider或模型请求。
- 有ID时捕获directory、scopeGeneration、per-provider generation及当前authority/selectEpoch（307–315），写testing Set；调用唯一service `testProviderConnection`（llm.ts:426–438）。成功保存返回object；catch只保留err.message/String(err)，没有保留原Error对象、HTTP requestID/body等。
- service目前要求modelID:string；仅Panel为生产caller，另有llm-provider-operation-scope两个纯service测试。它通过原global/project路径POST `{modelID}`，不做翻译、不写另一个测试状态。
- 两后端路由均允许请求body与modelID缺席，并共享operations.testProviderConnection；project路由provider.ts:319–332，global.ts:896–903。返回包含ok、status、providerID、modelID、message；Overlay的ProviderTestResult只声明ok/message（llm.ts77–80），结果区没有展示实际model身份或时间。
- 后端operations.ts:177–250读取真实当前Config/Provider/model；调用ProviderLLM.wrapModel与streamText，usagePurpose=provider-connectivity，30秒abort、通常64 output token，实际提示Reply with OK。它只把stream error或SDK异常作为诊断返回；成功message是Host产品文案，不是模型回答原文。本文不改变这条现有真实请求合同，也没有调用它。

## 语言与文字归属

| 内容 | 当前来源/行为 | 判断 |
| --- | --- | --- |
| Test / Testing / title | Panel1223/1226直接t | 渲染时语言读取，已接入双语 |
| success | operations238固定“Provider is reachable.”；Panel1259优先message | 明确产品文案；中文正常成功也会展示英文，不能算模型原文 |
| failure摘要 | Panel1260优先message；t(failed)只在空message时生效 | 当前正常失败几乎都会把诊断直接当摘要，缺少统一的当前语言简短结果 |
| 本地缺模型 | Panel302将t(no_models)结果存Map | 产生时按当前语言；存的是译文快照，非响应式key。B10已实页记录正常切语言卸载Panel，故不能声称正常切换后必然残留旧语言；具体可见边界仍需验证 |
| backend缺Provider/无模型 | operations187/200固定英文 | Host产品原因，但当前只有message没有机器reason字段，禁止按英文关键词翻译 |
| Provider/SDK错误 | operations225–227、243–244已有ProviderError投影 | 原始技术诊断应保留；可置Details，不能机器翻译/关键字改写其含义 |
| Provider ID/model ID/API地址/品牌/名称 | 配置与真实回执 | 保留身份与原文，不翻译 |

没有测试时间、持续时间、testedAt或lastTest字段。Panel的formatRelative171及1094/1101只用于两个目录刷新时间，不是Test时间。因此本轮没有“测试时间日期未本地化”的事实；如保持不显示时间，不需要新增时钟/timer。若为了表达历史结果决定加时间，必须由真实occurrence时间事实和现有日期工具负责，不按截图/按钮名字猜测。

## 缺模型与缺凭据的共同数据问题

`provider/provider.ts:377–380`从catalog既有models开始应用config覆盖；B11已用真实API确认空声明继承两个模型。当前Panel仍只从config的models取首项，因而配置为空时即使catalog当前有实际模型也会在本地提示“未配置模型，请添加”。这是与B11表单数量guard相同类别的声明/有效集合混淆，但属于尚未修的Test调用路径，不能说B11空声明保存资格已经覆盖它。

此外operations54–55调用getProvider/getProviderGlobal，而provider.ts1181–1186读取runnableProvider；822–828仅当模型数>0才返回Provider。于是实际配置存在但0可用模型、全部过滤/禁用/loader失败等情况可能都先进入187的“Provider is not configured. Set API key or auth first.”。这个条件不能证明Key缺失。200行“Provider has no available models”分支通常拿不到真正0模型Provider；不能以分支文字反推缺模型已经被正确分类。

界面不应以apiKeyConfigured=false/undefined新增测试准入：该字段是配置存在事实，不是推理能力；public/free/SDK托管或OAuth等仍由后端实际解析负责。也不能凭输入框空白判断无凭据。

最小事实来源方向是用当前backend的模型解析/排序选择测试模型。现有HTTP already optional modelID；可去掉前端对原config.models的强制首项/空集合判断，让服务请求遵循现有默认选择合同，并保留明确modelID调用语义。若为缺模型、Provider不可用、Auth来源等提供不同可操作摘要，需要producer输出明确reason/code，并同步两路由/生成类型/consumer，不能parse message。

不应为了让测试通过创建伪模型或在UI另建filtered模型库；保留enabled/disabled、模型引用、loader和实际SDK准入。成功/失败只说明本次选定模型的测试结果，不代表整个Provider所有模型永久可用。

## 结果生命周期与状态歧义

`testing`与`testResults`定义在Panel顶层（115–116），Map按Provider ID保存。当前实际setTestResults只有本地缺模型、HTTP结果/catch、scope变化clear（271）和删除成功delete（892）。startEdit、普通Save、SaveKey/Auth或单纯row remount没有删除Map中的旧值。

因此111–114注释所称“edited or removed，covered by row remount”对编辑并不成立：For重挂载的行仍读取同一个外层Map。配置API/Key/模型改变后旧结果可再次出现在相同Provider ID旁边。新测试开始316只置testing，旧成功/失败没有清理或标注为此前结果；没有时间/实际model展示可区分两次测试。以上为源码风险，尚未本轮实页验证。

并发边界：现有per-provider generation只在handleTest有model时310推进；Scope变更/卸载也推进大generation。普通配置/Key修改没有退休在途Test，因此旧请求可以在修改后返回并写同ID结果。删除只删现有Map值而未推进该ID generation，仍有较晚结果重新写回并被同ID重建行消费的可能。没有运行这个竞态，不称其已发生。

建议复用已有per-provider generation在本次Provider配置/credential实际accepted后退休对应测试，并清该ID结果及busy归属；不能只删结果而仍让旧completion写回，也不能只bump generation却让旧finally因失效跳过后留下testing Set。这个属于测试结果的当前配置归属，不增加credential/config哈希、另一个持久version或“已测试”事实缓存。只打开编辑后Cancel不一定需要清理结果；以明确修改接受边界为准。若Root选择保留历史结果，则应明确本次测试对象/时间及“此前结果”呈现，不能称它为新配置的当前资格。

还发现旧共享状态路径：llm.providerState240–259读取appStore.providerTest，但setProviderTest在全packages只找到app.ts263定义，当前生产Test写的是Panel Map；workspace仅重置旧字段。它不是此按钮结果的真实事实源。按AGENTS先记录死路径与删除影响，若正式实现触及status应统一到当前唯一回执或删除无用投影，不可把两个状态同时写起来当作修复。本文未做清理。

## 长诊断与列表可用性

当前结果位于行grid的result整行，CSS settings3012–3021保持main/summary/actions、key、result、models顺序；.provider-connection-feedback3219仅指定grid-area。Feedback已有min-width/overflow-wrap保护，不能仅凭长字符串推断横向溢出。

但Test结果1257没有details，所有message进入主正文；长SDK错误/多项stream错误会直接增长主列表行高，Error catch还仅保留message。该密度风险由布局与数据链支持，没有本批长错误截图证明实际截断或不可点。

现成方案是与B10/B12相同的Feedback：当前语言的简短成功/失败摘要；真实返回的技术message、实际provider/model与HTTP异常详情进入既有Disclosure。Error保留原值供当前formatErrorDetails（包含B12安全receipt投影）生成详情，不能继续在catch降为message或新增局部截断器。产品固定成功句可由ok/status驱动本地化摘要，不需用关键词识别英文句子。Success不必重复一份固定英文产品message充当详情；真实诊断/身份如有则保留。

按钮disabled正在测试、成功status/error alert的ARIA（Accessible Rich Internet Applications，无障碍富互联网应用）语义来自现有Button/Feedback。没有本轮键盘操作证据，不能宣称禁用后焦点留存/Tab恢复通过；实际需要检查Test、Details与相邻Edit/Delete/SaveKey可用性。多Provider并行测试仍应保留独立busy/结果，不能退回一个全局“测试中”。

## 历史与旧路径未覆盖原因

git -S结果显示当前message优先结果渲染在最早保留65d0bfc98（2026-08-07）已存在，不能据此猜最初产品意图。B10明确排除testResults，B11/B12也延期连接测试语言/receipt。B12的新post-save观察并不清testResults，也没有改变test model选择，所以本次候选不是B12新造的回归。

当前Architecture07-panel2799–2819明确空声明继承与配置保存不等于推理资格，07-panel-reactivity43–51明确摘要/原诊断与既有归属；当前Test结果未完整使用这两层合同。仅locale键存在不证明它们在真实response下被使用。

## Root独立真实资格建议（本分工未执行）

1. Root在B12正常交付后落正式范围/spec，启动新自有生产/ui，不重启已关闭旧scope。先中文真正0可用模型Provider点击Test，英文对照，记录真实本地/HTTP结果；不可把config0当runtime0。
2. 用自有空声明但canonical有模型的Provider复现前端本地拒绝；对照其公开catalog的精确models/connected字段。修后若点击Test会真的请求模型，必须按用户授权选择实际目标Provider/模型，不能用loopback伪LLM成功代替生产请求。
3. 成功语言资格需要真实流式Provider Test；若复用已授权目标gpt-6.1-sol，必须fresh完整auth/models配对与三项预检、实际请求model/usagePurpose、HTTP/stream终态和清理证据。不读取或打印Key，不由模型自述判断成功。
4. 无凭据/不可用/全部过滤等precondition可在自有scope走真实API确认明确code/status；Auth读取故障应是原typed503，而不是空凭据。保留Provider/SDK原诊断，禁止fake/intercept响应。没有可安全真实复现的长错误时，将长诊断视觉资格标为未满足而不是拼假响应。
5. 成功后同ID修改API/Key/模型，或测试仍pending时接受修改，确认旧receipt与busy按合同退休；再测一次得到新结果。另覆盖删除/同ID重建、两个Provider并行、scope A→B→A及组件卸载。所有页面动作由Root实际执行，不能仅跑service fixture证明视觉或竞态。
6. 检查稳定语言下中文/英文摘要、Details键盘展开/收起/选中文本、长诊断换行和相邻按钮；传统语言设置会卸载Panel，明确记录结果清理而不是声称跨卸载恢复。当前无时间字段时无需新增日期验收。
7. 如改service请求或共享producer理由code，补精确正向结果/错误合同及正式SDK生成；现有llm-provider-operation-scope仅两项服务路径测试，不是Provider Test真实运行。限定检索未找到Provider组件对应UI自动化测试，未运行/新增任何UI测试。新业务数据检查不允许源码文案/DOM/快照断言，也不能拿testFixtures冒充实际Provider请求。

## 收尾

本分工只写本ignored intake，B12交付文件、所有产品及并行改动保持原样。当前证据等级：源码与历史合同已审；B11继承API数据及B11/B12布局原图已读；本批Test成功/失败/缺模型/竞态/语言视觉全部尚未新实跑。Root决定正式范围并完成真实资格后才能声称修复。
