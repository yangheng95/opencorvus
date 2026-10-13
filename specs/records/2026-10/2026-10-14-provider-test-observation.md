# Provider Test 的有效模型与结果事实（持续迭代第13批）

## Recall

用户原始要求：持续迭代opencorvus当前版本直到明确停止，按批并行体验和调查UI/UX（User Interface / User Experience，用户界面与体验）、功能完成度与缺陷，先根因/影响分析及spec（规格）落盘，再有证据修复、真实桌面交互、截图人工复核、聚焦正向功能测试与必要且已授权的GPT-6.1 Sol端到端验收、范围清晰提交、上游同步与正常push（推送），自主进入下一批。

持续目标active，不新建branch（分支）/worktree（工作树），用户已要求停止全部子agent；后续由Root独立完成调查、实现和验收，禁止继续委托。没有UI自动化测试；真实页面、截图、业务合同与实际Provider请求分别资格。只控制自有实例，不操作用户服务或窗口；私有凭据不入输出、spec或提交。任何实际共享调度、队列、唤醒、恢复、并发或终态异常都立即按全部生产入口、Task/Mission/Session occurrence（执行轮次）、正常终态、重试重启、串并行、多项目横审，不能以单例通过降级。

第12批交付2494f5da532487059d4e4c1215840716c19814fe（parent fdf86894e9463987be9fa801190b6724cdec2ca9）：79项/242正向断言、22张主agent实际查看的桌面原图（含1失败资格）、真实Config/Auth/catalog故障与恢复。Normal Git commit实际0；外层session17644完成5e14dc exit1发生在提交成功后的标准index并行锁，未删锁，精确批量核对与重结算61bab6 exit0。Fresh fetch89185a与merge b72975均0，pending只有该本任务提交；normal push原session23419完成4235b0实际0，全部原钩子通过，远端fdf86894e→2494f5da5。没有新增推理请求，第11批4个真实gpt-6.1-sol流式回执继续保留。完整delivery receipt/原push文本由本批artifact承接。

第13批开始HEAD2494f5da5；git status仍有另行授权的permission、compaction、侧聊和共享spec索引改动，保持原样。本批只修改自己的Provider Test范围，不混入这些工作。

已读：当前architecture06-provider、07-panel、07-panel-reactivity；B10诊断反馈/B11空声明继承/B12保存观察记录与原图/公开catalog响应；ProvidersPanel全部Test、scope、refresh、Save、SaveKey、Auth、delete与结果渲染入口；llm service/旧appStore.providerTest、Feedback/Disclosure；operations、project/global两test路由、Provider state/configured/runnable/models过滤与model解析、Auth typed read错误、原streamText/ProviderLLM错误redactor、隔离真实Provider审计和完整pair staging primitive。全仓搜索所有testProviderConnection、ProviderTestResult、testResults/测试generation、providerTest/setProviderTest、路由与现有业务测试；历史677f7afd（connection/selection ownership）、0075c2b76（bootstrap discovery）、e7cbfee23（observed key facts）及最早保留65d0bfc98语言结果行为已核对。

委托反馈：UI审计亲自查看B11继承模型原图/真实catalog数据与B12Feedback布局；功能审计确认backend已有省略modelID的真实默认选择，但Panel唯一caller用config.models首项且空则本地拒绝。两路由返回providerID/modelID/status，前端只声明ok/message。相同ID配置/Key/refresh变更未退休旧测试结果，delete也未推进在途generation，仍待本批实际资格。providerTestScopeGeneration还被所有save/Auth/read owner共用，不能为了退休Test而增它。旧appStore.providerTest没有生产writer，禁止复活第二事实源；自动ID主机信息丢失报告保留为后续批次，本批不混入。

## 根因与影响分析

可观察历史事实：空模型声明在真实catalog可继承catalog-one/catalog-two（B11公开200与原中文图），而当前Test按钮仍以声明首项为准。固定成功句“Provider is reachable.”由host（宿主）产生，不是模型原文，render以message优先覆盖当前语言摘要。相同ID保存后旧结果与在途completion退休不足目前只有源码证据，不把它写成已实跑竞态。当前Test没有timestamp/duration（时间戳/持续时间），不虚报测试日期本地化问题。

直接触发与数据根因：Panel.handleTest先Object.keys(row.provider.models)[0]，缺席就写译文快照并return，阻断backend有效目录选择。backend scopedProvider通过runnableProvider只保留模型数>0，零有效模型被错误归为“not configured/set key”，条件不能证明凭据缺失。实际请求捕获config并走scopedModel/scopedLanguage、ProviderLLM.wrapModel及streamText；成功/失败仅证明本次选定模型，不代表所有模型永久可用。

结果根因：唯一当前结果Map按Provider ID保留；普通save、Auth/Key与目录刷新没有推进该ID Test轮次。delete只删结果，旧请求可再次写回；原“row remount clears”注释与实际外层Map不符。scope/authority/selection及卸载的原退休已存在，不能绕开或用共同scope计数误退休其他操作。仅打开编辑或失败写入不是配置已变更的事实。

旧路径未根治：B10明确排除Test结果，B11只修表单声明保存/合并，B12只修保存事实与目录观察。locale（语言目录）键存在不证明实际response（响应）会使用它；当前catch仅Error.message丢失HTTP（Hypertext Transfer Protocol，超文本传输协议）请求身份与完整原诊断。Feedback已有短摘要/可展开详情及换行primitive（基础组件），不另建截断器或英文关键词翻译。

公共契约影响：唯一后台operations与两个公开route（路由），modelID已optional（可省略）；前端service必填参数是错位。调整producer（生产者）的明确结果原因时，两路由应复用一个当前schema（结构定义），同步公开API（Application Programming Interface，应用程序接口）、生成SDK（Software Development Kit，软件开发工具包）与消费者。普通validator错误及AuthReadError503仍保留原错误合同；凭据presence不是额外测试准入。有效模型仍由当前Provider过滤/排序/模型解析负责，不新增影子模型或凭据缓存。

测试/交付范围：现有llm-provider-operation-scope只证明两个transport（传输）路径，fixture（夹具）不是实际模型请求；本批补optional默认与完整回执正向合同、后台真实公开route的明确precondition（前置条件）/模型错误与流式结果合同。限定检索未找到相关UI自动化，不运行UI测试。真实Sol必须fresh绑定/复制完整Auth与相邻models，分别验证凭据可用、目标模型投影、实际request model完全gpt-6.1-sol；禁止复制OAuth refresh（授权刷新），使用项目已有审计/脱敏/正常停止清理primitive。

调度与共享机制适用性：当前候选是Test结果消费轮次，没有已观察后台Task/Mission/Session调度异常。实际桌面若出现迟到结果或busy，先横审当前operation全部caller、两scope、shared stream/request association、正常/错误/退休路径、重试/重挂/多项目与各Task/Mission/Session occurrence，结合实际请求与持久事实排除共享根因后才能收口为Panel owner。不能仅据最后错误/注释/模型自述结案。

风险及排除：不修改LLM（Large Language Model，大语言模型）工具选择/prompt工作流，不新增非流式模型调用；不给连接测试新增持久状态或时间。当前未接线旧providerTest分支不复活，删除影响先说明，不混入无关清理。自动ID、其他Provider发现协议、用户Auth刷新、模型所有项验证及release（发布）不在本批。长错误和并行生命周期尚待实际资格；没有真实证据时如实标未知，不据fixture宣称通过。

## 落盘实施方案

1. 第12批正常push已完成后，启动全新自有真实backend `/ui`，使用Node.js已成功冻结的前态UI（B12最终bundle的Test路径尚未改），原process shims与恢复/停止primitive。完整真实Auth/models fresh staging后验证凭据存在与目标投影，再用已有授权做一次原真实流式preflight，确认实际请求/回复与凭据可用；后续Test页面请求另行观察。自有fixture只用于零模型/不可用/连接失败路径，不能当真实Sol成功。真实中文点击空声明Test，核对公开有效目录与本地结果；再明确目标gpt-6.1-sol的实际Test与原审计、摘要/详情及修改后结果取得前态证据。
2. backend以原configured Provider事实读取与现有有效模型排序/解析，提供明确unavailable/no-models/request-failed/connected机器结果；一个schema供两个route公开合同复用，typed Auth读取错误原样抛出。明确modelID保持当前显式选择，未给modelID由backend唯一选择。发现前态结果与分析不符先更新方案，不盲改。
3. 前端删声明首项/空集合准入，service接入原optional默认语义与完整DTO（Data Transfer Object，数据传输对象）。结果Map仍为唯一当前回执；当前语言短摘要由明确结果生成，原模型/Provider技术标识与失败详情完整保留，使用既有Feedback/Disclosure。需要的产品正文覆盖当前全部语言，不按英文message匹配。
4. 相同ID真实配置/Auth/delete接受及明确目录变更沿原per-provider Test轮次退休结果与busy；只推进Test轮次，其他操作的captured owner保持。新Test开始结算此前结果；原scope/authority/selectEpoch与卸载继续负责大scope退休。根据全部mutation/refresh调用分析决定精确触发点，不以对象引用或可变摘要造generation事实。
5. 根因落地后补聚焦正向业务/后台公开route测试，修触及过期fixture；生成SDK、文档check、类型、Node build。真实中文/英语桌面查看成功、零模型、普通技术错误、Details展开/折叠/键盘及原输入密度；真实空声明继承+完整实际model/stream终态的已授权Sol资格。取消重挂、同ID配置/Key修改、delete重建、多Provider并行与scope A/B/A沿可恢复实际故障/原租约取得证据，不能拿UI自动化或fake成功替代。
6. 自有原页面和服务正常stop/join，凭据完整pair在实际exit后清理；保留每次原失败及修正结果。更新当前architecture、中英Unreleased与spec/artifact三个索引，当前文档检查。精确scope提交，fresh fetch+merge、完整pending ownership核对与正常push，回执带下一Recall。持续目标不结束。

## 当前状态

方案在产品修改前落盘。当前已完成本批有证据的修复及下述实际资格，84项聚焦正向合同、24张Root亲自查看的原图与9条真实Sol请求有原回执；完整扩展矩阵仍按末尾未达成项继续下一批，不宣称持续目标已完成。

## 实施前真实资格

方案文档检查ab4ffc exit0（345 ops/26 groups）。制作PowerShell launcher时08fb3a在shell解析阶段exit1，没有启动实例或调用模型；改用文件内literal源码，e4f3ee exit0，再启动原fe42ec/session4834，自有PID70552、18610/18611、occurrence2bf3aebf-38f0-4570-9f0f-0dce41cae4a9。前态使用B12 Node最终build的冻结UI，只复用未改的Test路径；当前backend仍走真实源码/runtime恢复与`/ui`，没有独立Vite。

完整相邻Auth/models fresh staging（catalog227个Provider）及目标projection已分别确认，再做一次原preflight。该preflight实际产生两条真实gpt-6.1-sol流式请求（memory/chat，均有原Session/StreamRequestIdentity、HTTP200、reader settled EOF），不是一条；之后页面Test第三条实际gpt-6.1-sol200/EOF按原直接Test合同无Session context。原脱敏observer快照保存给独立审计，不据模型自述判定成功。

真实中文全局页面先在声明models:{}、公开有效目录gpt-6.1-sol的同一openai行点击Test，本地“未配置模型”已实页复现。经原表单保存明确gpt-6.1-sol后，行显示1模型但保留旧无模型结果。之后实际Sol Test完成，中文页面显示固定英文“Provider is reachable.”。五张原始桌面截图由主agent实际查看；另两图为自有实际HTTP400端点经原SDK/Test/页面的完整长诊断，以及原表单接受不同API地址后旧诊断仍在同一行。此HTTP参加者只资格受控真实网络输入和当前页面密度，不当第三方Provider或Sol成功。

原公开precondition探针aa887b exit0：global/project owned-zero均真实400“not configured/set key”，同时catalog的该ID保存Key=true且models为空；missing ID也400同句。声明与凭据/有效模型混淆得到真实源事实，Probe没有用错误消息反推Auth。请求关联header实际null也如实保留。

补充共享横审已独立完成并由主agent核对：全部生产Test入口/caller与Task/Mission/Session occurrence、shared Provider snapshot/capacity/transport、正常终态、取消/retry/recovery与串并行多项目关联逐项列出源码。三条实际请求均settled EOF，Memory/Chat关联各自真实执行身份，直接Test无Session context符合当前合同；已完成旧卡片可以定位为Panel观察未退休，不能说该Test仍卡在共享流/队列。没有据此宣称全部在途变更、跨项目并发、重启或capacity数据库都实跑排除；仍按后态真实资格保留边界。

前态tab3已关闭，自有stop-request原3ada3c exit0；原session4834完成1acbb9实际exit0，原正常runtime settle、instance dispose、listener stop及Log.close完成。parent在实际退出且两个监听器0后删除完整Auth/models副本。此前先启动81090e/session66226在内存保留实际凭据，实际exit后完整原stdout/stderr/backend日志安全扫描1c5006 exit0：原日志和归档内容都无这些真实凭据字节；不以先前未flush的空日志冒充扫描完成。

实施精化：Config接受200/typed committed、Auth接受、cleanup接受和Delete提交均是独立Test退休边界，不能只在Save开始或末尾清一次。catalog刷新成功影响所有当前观察；model刷新已有公开providers IDs，service保留该现成字段按真实ID退休，不在UI硬编码第二份opencorvus目标。普通只读重挂、search、失败且未提交的write或仅开/取消表单不当成提交。保留外部窗口/backend改配置的精确传播未知，不按对象引用、Key摘要或revision猜变更。

委托实施限定backend operations、两route及新聚焦provider-connection-test.test.ts，禁止再委托/SDK/Overlay/提交。agent指出现400为唯一私有BAD_REQUEST_SCHEMA的validator合同，直接换业务result会丢普通400。已在修改前精确追加授权server/error.ts仅导出原唯一schema，名字/形状/原helper调用保持，两route400以该schema与新业务结果union描述；全仓定义/调用和原diff先核对，不复制第二BadRequest或raw ref旁路。SDK/openapi现有peer修改由Root保留并负责精确生成差异。

聚焦后台首轮00f297实际exit1（17 pass/1 fail、38 assertions），原日志保留。红态是实际global malformed Auth Test应503却为ProviderInitError500；同输入project为503。直接触发：operations的catch发现nested AuthReadError仍throw外层error，Provider.getSDK按既有契约用cause包为InitError，error-handler仅原AuthReadError映射503。根因是Test错误消费未取已识别的authority cause；历史CS-035和公开两route已承诺503。成熟同语义provider.refreshModels已有`const authError=Auth.findReadError(error); if(authError) throw authError`，本批按原primitive修唯一Test catch并重跑原18项，不改mapper、SDK初始化或fixture期望。全仓同写法Mission/ExpertSquad保护别的上游输入，此次没有其nested InitError运行事实，不扩为未证实全面故障。Backend typecheck32192完成74f9b0实际exit0；global.ts原automation格式差异已单独保留副本，禁止整文件改他人区域。

用户最新指令：“停止所有子agent，你自己做并验收”。已检查本树仅原两个子agent，均已完成，并逐个interrupt；自此停止委托与消息触发，后续所有调查、实现、检查、真实页面及模型资格由Root独立完成。持续迭代目标未停止。此前agent产物只作待Root亲自复核的输入，不代替Root验收；后台原18项e57c31 exit0/38断言、655ad7类型exit0保留，Root将核对全部实际差异并亲自重跑聚焦checker。

Root亲自完整审查后重跑：七个业务/服务文件05787f exit0，64项177正向断言；后台原公开route/TCP checker session69457完成559cfe exit0，18项38断言；overlay类型77268完成62ac5d exit0。SDK原既有事务生成5598完成8ce8c3 exit0；生成前完整保存并审阅peer原83/4 types、311/4 OpenAPI差异，未丢旧更改。Node首后态build25239完成a84a17 exit0；尚未用此中间bundle作实页资格。

在结果完整性复核中发现原Test消费全部stream后仅保留errors，实际最终文本未进入公开回执。当前改动触及这条LLM结果流，必须让实际模型原文可查看，不能把固定host成功句充当模型回复。实施前决定：唯一DTO增加output字符串，沿既有单个stream消费循环累积原text-delta文本（包括错误前已收到文本），各无流/前置失败为实际空输出；成功message仍是原协议说明。两route/SDK、正向完整回执测试同步同一schema，Feedback详情显示实际模型原文，成功短摘要同时显示实际选定modelID；不改prompt/模型/重试/流式协议，不另造聊天Message或影子state。所有caller已搜索，Panel和两个checker仅新增读取/保持ok合同；已有SDK客户端忽略新增字段的行为不作为兼容实现。原模型文本不翻译、不截断，技术诊断仍保留原来源。

最终输出合同实施后，SDK26062完成37adcb实际exit0；Root服务329a0a exit0（64项177断言），Node最终build71852完成4067a9 exit0。部分流测试首轮3930完成d26526 exit1（18 pass/2 fail）：期望误把SDK实际已归一化的明确message当对象字符串，真实接收值为Owned stream refusal，错误前output确实OK。核对当前SDK7 normalizeStreamProviderError后修正fixture，原checker重跑68912完成f074e0 exit0（20项42断言），不为旧期望改真实实现。Backend类型83966完成a28f8c实际0；Overlay直接Node命令83ebd8前的24f227 exit1为不存在package-local TypeScript路径，按package.json原typecheck重跑20606完成160bf4实际0。formatter工具280c6b exit1为依赖未在根目录链接，复用已安装diff8路径后20539c/481b0a均0，仅应用本任务新增/修改行的格式，原基线格式不变。

## Root最终实际资格与边界

后态独立18612/18613、PID76036、occurrence67b675c0-f843-4046-8032-5f8dd94eac3d使用Node最终成功bundle和真实源码backend，完整fresh Auth/models227 Provider pair投影与实际凭据preflight分别验证。两条preflight加四条真实UI Test全为gpt-6.1-sol、streaming200、settled EOF，未刷新复制OAuth。后态英文空声明Test成功，展开实际原文OK.；中文另一次原文OK；项目真实Test原文OK.。固定host说明不再覆盖语言摘要或冒充回复。原provider直接Test没有Session context，符合其现合同。

Root在真实页保存同ID名称（空models仍合法）后原完成结果退休；保存自有样例Key后no-models旧结果退休。第三条后态UI Sol在途时立即保存名称：原AX同时Test/Save busy；物理global Config mtime1791925065620.5562在Solreceived1791925065287与EOF1791925066376之间。随后实际200 GET确认新名称，EOF后原卡片没有回写，当前行保留新配置。此处有actual HTTP/原source-reader/文件时间/实际页证据，局部结果owner横审可收口；不把它推广为所有共享capacity与调度矩阵证明。

中文零模型400保留当前语言摘要及原HTTP method/status/path/真实requestID/body/output。真实自有HTTP400长诊断从主行移入原Disclosure，Enter展开和Space收起均实操；全部文字换行完整可见。该受控真实HTTP端点不资格第三方Provider成功。项目表单把failure端点改为port1接受后旧结果退休；新Test实际经当前transport返回HTTP502 Bad Gateway，记录实际错误，不假称本地connection refused。

选择真实preflight Chat后server完整原日志实际POST /provider/openai/test200，先前全局三次为/global/providers/openai/test200。项目OpenCorvus模型refresh实际200并调用真实/model/info与/models，旧no-models观察退休，其他openai成功观察保留；全目录refresh实际200后openai观察退休。原行models0是声明数量，不能反推有效目录；回到全局当前行未继承项目观察。

第一次项目删除确认已超过原时限，原图after-project-delete-retired-zh实际显示原结果，明确为失败资格而非接受。回全局重跑两次真实确认（原AXconfirm→loading→empty），实际accepted Delete清除自有配置/Auth、configured4→3、catalog229→228；当前scope结果随接受退休。未实跑在途Delete/recreate，不据完成删除推断竞态通过。

24张原图全部Root实际看过（5 before/19 after），其中Saving表单图只证明中间态；after-inherited-testing-en捕获时已完成。完整结果由artifact qualification.json明确标注，没有UI自动化测试/截图差异断言。后态tab4关闭，stop marker abbd2e0；原session23827完成1dba7d实际0，正常settle/dispose/listener/Log.close。parent实际退出后监听0并移除完整auth.json/models.json。此前privacy53224完成543dbc实际0，对完整stdout0、stderr14887、backend201133bytes扫描真实内存凭据与归档都0泄漏。前态清理与扫描也已完成；archive700d6f0汇总119个原输入/检查/运行/图片对象、9条真实Sol、84 tests/219 assertions，原失败均保留。

公开postcondition68d53d0同时确认global/project owned-zero400 no_models且savedKey=true，missing400 provider_unavailable；OpenAI有效目标gpt-6.1-sol、APIKeyConfigured=false并不否定OAuth。文档首check e5b6fc1为两Test路由新增明确400合同应进入生成API正文，原docs:api99520e0只更新中英各两行，随后重跑原docs:check。当前architecture06/07及唯一CHANGELOG Unreleased中英同步，本批没有版本发布。

未达成与后续：fresh OAuth认证变更、不同Provider同时在途、在途Key-save/Delete重建、重启/authority替换及全多项目调度/容量矩阵、外部窗口配置传播未取得实际证据。影响限于扩展生命周期资格边界，不把已有代码横审和单例通过替代它们。持续目标保持active，下一批Root独立优先补剩余实际资格；必要时发现共享机制异常立即全入口横审。自动ID候选仍保留下一调查，不混入本批已验证修复。
