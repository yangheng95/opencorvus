# 持续迭代第九批：Provider API Key 配置事实

## Recall

用户要求持续批次并行体验/调查 UI/UX（User Interface/User Experience，用户界面/用户体验）与功能，直到明确停止；先完成根因/影响与specs，再实现、真实桌面交互/截图人工复核、聚焦正向非UI测试及必要已授权GPT-6.1 Sol端到端、范围提交、fresh upstream merge及正常push后继续。上一轮为实际进展：第8批0075c2b7629348ed1a7df6a496121c7cddc2044d已由原push57489 exit0正常推到main，23测试79断言、14截图、4真实目标模型流式200/eof、三个自有进程正常exit0与复制auth/models清理。当前工作区他人MCP、Session附件和compaction，以及三个共享索引排序/新增项，全部保留；不建branch/worktree，不操作用户实例，不新增或运行UI自动化。新候选只读并行审计沿用两个已授权一层agent，禁止再次委托。

主agent已读AGENTS、06-provider/07-panel公开契约、第8批Recall/intake及真实HTTP/截图、ProviderInfoSchema、buildState/configStateSource/globalStateFor/stateFor、三条Provider响应路由、Auth/config故障边界、ProvidersPanel/API Key编辑/保存链、llm providerEntry/providerState/connectedModelOptions、config-load的请求独立settle/旧值保留、appStore issues。全仓搜索ProviderInfo定义/构造、API路由schema和所有UI key/状态消费者、SDK生成入口及旧spec决策。唯一Info schema在model-schema.ts89，完整构造只有catalog转换与config扩展；三个响应消费为GET /provider、/global/providers、/config/providers，SDK Provider同时供plugin context/hook。生成必须用SDK build的generate-openapi与原子writer，不手编平行schema。当前源码预像diff已保存；尚未编辑产品。

UI分工已人工查看第8批两张后态及outcomes：Panel724读config.options.apiKey或public entry.key，两个placeholder834/1307共用；providerState229有同义独立推断。实际状态UI消费者仅Panel919/963，sortedProviders.stateLabel不由Composer展示。零模型saved发现200、placeholder却说粘贴，保存模型/重读才显示configured。分工限定检索未发现本批触及范围UI自动化测试，已读若干服务/传输/纯数据合同而未运行，不按文件名误删。分工给出真实自有scope坏Auth→目录刷新失效→未知→恢复，坏global Config但旧挂载行Save Key成功、后续config清理失败的资格设计；尚未实跑，禁止把该设计当证据。

功能分工确认OAuth loader写dummy或access进最终options.apiKey（OpenAI/xAI/Snowflake/GitLab），不能当API-key配置来源；普通多env与Bedrock vendor自管来源不能扫描名称或猜token。Config列表route失败后传{}，config.read只在外层合并，必须把配置观察失败传入唯一builder并进入其缓存身份，防止与成功空配置混同。enabled白名单排除的editable custom仍来自config，但all没有它，只能未知；disabled custom当前已隐藏。Auth读失败catalog为200+issues；直接Auth/project Config保持typed503，不能把旧数据false冒充当前事实。

## 可观察现象与根因/影响

第8批已修显式发现所需configured事实被零模型删除的问题，并保持ready集合；公开catalog仍合并database与runnable，API/env Key只在providers，零模型HTTP行使用不带Key的database。界面原两套原始Key推断因这个投影边界失去真值；重复刷新无法产生未公开的配置事实，增加“刚保存过”map亦不根治。真实Auth可存在而UI报告未配置，并不代表Auth缺失或网络不可用。

本批能力严格定义为“已观察到非空API-key配置存在”，不是SDK最终选中认证、联网有效或模型可推理。true由当前原config.options.apiKey、保存Auth.type=api、既有环境解析真正返回的非空Key证明；只用trim判断存在，不改原字节。OAuth-only不是API Key；显式空config值不会消除仍存在的saved API配置事实（SDK选中规则另属既有合同）。false仅在相关来源均可观察且确认没有API Key时发布；配置/Auth/provider credential或loader读不完整、SDK自管/多env来源未明确、或当前public entry缺失时未知。已证正向API来源可保持true并同时携带独立issue，不因无关loader失败变“未配置”。

影响为Info公共数据与SDK/OpenAPI、现有cache输入身份、三条目录输出、两种编辑Key输入、providerState同义状态、当前catalog读失败/恢复。保持all/default/connected/runnable集合及模型、工具、LLM流式/消息合同；无新凭据map/cache、无原始Key的UI后备推断、无保存成功影子状态、无host流程gate。现有public Info.key及config中原始敏感字段的安全清理需要独立接口影响授权，本批不扩大；这里只停止UI用其猜配置事实。providerTest无写入的候选死路径、资源操作/refresh回执、外部删除已登记目录的global mutation均另记边界，不借本批清理。

Memory附带共享审计已完成当前源码/持久证据核验：global enabled=false且两Session无覆盖，两个Project文档revision1/idle、覆盖精确真实输入、lease释放，四请求200/eof及exit0；当前project-memory架构与2026-08-12正式方案明确enabled/auto_inject控制注入，而post-commit Organizer正常独立触发。不能从agentID或宽schema描述直接判调度异常；Config“Enable persistent memory store”描述仍过宽。本批不改Memory公开语义，也不声称重新运行全部Task/Mission重试重启/并发矩阵。

## 修改前方案与验收

1. 唯一Info schema新增可选boolean apiKeyConfigured；字段缺席明确表示未知，无默认false。buildState在既有database/configured Info投影上一次派生同一事实，不增加Auth读取或平行状态。使用原config字段、已读Auth类型及既有provider.key环境/API来源，不扫描最终OAuth options。配置观察是否成功显式传入现有构建链，并与原config快照共同构成当前cache输入身份；不让失败{}复用确认空配置的状态。两个列表route传递自己Config读取结果；保持200+issues和直接503边界。所有Model/SDK选择仍走ready原合同。
2. Overlay一个服务helper解释三态，当前catalog请求/解码失败(resource=catalog)时旧目录可留但凭据事实未知；成功时只读新字段/当前entry。认证方法resource=auth与独立global/config失败不冒充saved Auth失败；catalog内部读取失败由backend派生，不在UI再写一套规则。退休Panel与providerState原config/rawkey推断；两个Key placeholder共用true/false/unknown语言文本，未知仍可输入，保存忙碌用已有savingKey。providerState保持现有badge布局及真实测试receipt，不放宽目录all或所有状态徽标。
3. 先启动独有生产/UI前态，随机虚构样例Key及loopback registry/models，证明零模型已有Key、knownempty、项目配置override、排除条目、真实保存/刷新故障前态；不复制用户凭据、不推理、不插消息、不拦截浏览器网络。Node冻结前端，真实1280x720页面交互、截图人工查看；前态确认/最终设计细化落盘后才修改产品。
4. 聚焦正向Backend测试覆盖global/project0/有模型、saved/config/单env、OAuth dummy/access与OAuth加API、空override+saved、缺失Auth、Auth错误未知+明确config正向、ConfigJson/Invalid读取失败未知、loader/SDK自管来源与all/connected原精确集合。只运行相关测试，过期合同修复，工具故障修复后重跑原命令。UI故障恢复只用真实独有文件/生产失效入口，不写UI自动化；保存成功receipt与后续问题均可辨。
5. 新字段经正式SDK/OpenAPI生成及docs检查；谨慎审查并行变更hunk。后态实际中英文行内/编辑、保存后零模型仍已配置、当前未知/恢复、当前模型选择保持。共享builder/cache身份有变，做必要已授权fresh paired auth/models、credential/target/actual request分别确认的GPT-6.1 Sol流式回归，禁止复制OAuth刷新；正常停自有scope、原exec实际exit、PID/port和配对清理证据。
6. 更新唯一06-provider合同、双语未发布日志、根/月/artifact README；结构/type/docs/格式检查不能冒充视觉。范围提交，fresh上游merge、完整待推送集合验证、正常push，不Release/tag。结束保留goal active，进入下一批。

## 修改前状态记录

修改前分析/方案已落盘；最终cache/不明确来源资格、当前前态、产品实现与后态待执行。无本批产品修改，不能宣称用户界面或端到端已通过。

## 真实前态与最终实施选择（产品修改前）

Node冻结UI exec20129实际exit0。fresh生产18582/registry18583自有scope PID80684、process win32:639274942709481783、occurrence5fd4eb59-0060-447a-94f1-0d24dffa4459，所有环境清空后白名单重建；Auth仅随机样例API/OAuth，不使用私有凭据，不推理或插入消息。真实global/project catalog仅owned-ready在connected；零模型API/env没有public key，sample saved发现两scope均真实200且返回各自ID。主agent实页项目零模型saved/env行、编辑→真实发现200、New chat转global零模型saved行，四截图均人工查看：粘贴Key错误提示与实际saved授权发现成功并存。未保存发现的模型，仍保持0模型前提；自有tab20已正常关闭，stop通过scope正常入口申请，原exec77496实际终态待归档。

最终字段为apiKeyConfigured可选boolean，缺席是公开未知，不用默认false或旧key/config UI后备推断。正向优先：原config明确非空API Key、Auth.type=api非空、既有generic环境实际解析为provider.key →true；显式空override+saved仍true，因为合同是存在事实而非SDK选中。OAuth-only已读且无其他API来源时false；不能从最终options中的dummy/access判true。已证true保留对应独立issues；无正向事实而Auth/Config/该provider凭据/loader不可观察、多env交SDK选择或不明options/API来源时缺席。只有已确认完整来源且无API key才false。private raw Info保留现有SDK用途；不新增credentials map/cache，不扩大HTTP all/default/connected或隐藏新路径。

buildState接收configAvailable观察事实，Auth读取失败在同一调用记录观察不可用；同一Info值在已有database/providers投影中派生一次。stateFor/globalStateFor和当前configStateSource共同传递该事实，cache输入按{config,configAvailable}标识当前单个构建结果，不与成功空config混同；这是真实缓存输入身份协议，不作为源码hash功能验收。两个列表route传自身Config结果是否成功，configIssues只保留原错误归属。global与project仍各用原environment/plugin/custom-loader配置，不另建失败builder或绕过推理准入。

Overlay的单一helper在catalog transport/解码失败时未知；成功时只消费该字段。field缺失或当前entry不在公开范围同样未知。savingKey是已有短暂操作状态而非凭据来源。providerState退休原config/raw-key逻辑，已有连接与测试receipt保持其真实合同，current catalog整体不可观察不呈新鲜connected；未知只在原status位置显示，不增加新的行/badge过滤。行内与编辑通过同一placeholder函数使用两种语言unknown文案。codecs不放宽协议作兼容；外部插件未派生字段天然不作确定事实。

源码预像中core Provider/路由/服务清洁，但双语locale有并行subagent刷新提示等hunk；保持其原文本/顺序，仅暂存自己的新增key。SDK/OpenAPI经正式writer产生后逐hunk审查，只收本字段差异，不把并行Session/MCP接口带入本批。未获得真实后态或通过原聚焦检查前不宣称完成。

旧providerConfig(id)仅由被退休的providerHasSavedApiKey调用，最新全仓rg显示已无生产调用。删除此本批形成的死wrapper，不改变Provider config写入/读取owner，也不清理无关providerTest路径；该删除属于原双推断退休范围。global.ts四处自动化路由换行和llm import换行为本次Prettier造成的无关纯格式hunk，审查并保存diff后精准reverse patch，仅保留本批语义变化。

## 新增正向合同发现的遗漏与修改前复核

功能分工仅新增provider-credential-presence.test.ts并真实运行：13项绿exec35647 exit0；补真实GitLab单env已解析、内置OAuth loader因ftp实例地址触发既有plugin.auth失败的正向合同后，exec63146实际exit1，14项13pass/1fail、25断言。HTTP200与issue正确，唯一apiKeyConfigured未知而规格期望true。generic env已在provider.ts中解析并merge，但后续plugin.auth/provider.loader共享删除configured投影，最终读取configured.key使此前已证环境Key事实消失。此为Info数据投影根因，不是Auth缺失或模型行为；global/project、所有这两种后期loader排除均有同样影响，模型准入本就应保留失败排除。

最终根治只在既有database Info的同一个apiKeyConfigured字段记录env解析产生的正向存在事实，再由最终同一派生复用它；generic与已有DashScope credential owner返回Key的路径均覆盖。没有额外map、再次读取env、保留失败configured条目、选中dummy或增加SDK重放。此前cache/SDK行为和公共schema不变；最终metadata与原loader issue并存。必须重跑同14项，不能用前13项通过覆盖该红证据。首次Bedrock测试把值写Env.set但真实vendor读取process.env，是夹具来源错误，已改为该真实输入源并还原，不据此修改产品。

## Sol 首轮检查器故障分析（修复检查器前）

原 exec10184 实际 exit1；业务聊天已有持久完成消息并通过 READY/provider/model 断言，失败在 sol.ts100 的 reader settled。检查器仅按 sessionID 取 requests.find 首项，同一真实 Session 内 Memory 和 Chat 合法并行，业务首项是仍 reading 的 Memory，而 Chat 带真实 assistantMessageID、已200/stream/eof。finally 主动 stop 随后使该 Memory aborted，不能将由检查器主动终止造成的状态当作产品调度事故。最终审计四条均目标模型，preflight Memory/Chat eof、业务 Chat eof、业务 Memory aborted；原父进程确认 port0 和 auth/models 配对移除。保留全部失败证据，禁止以仅重试成功抹去本轮。

请求身份完整合同是 sessionID + 用户真实 messageID(streamRequest.requestID) + agentID=chat + activity.assistantMessageID=持久 assistant.id；修复原检查器在该身份上核验流式200/eof，并等待此轮已经真实产生的全部 source reader 自然终态后才正常停服务，继续以真实audit、持久消息、无活动超时与请求预算判定。不会增加固定延迟、伪造成功或修改模型/Memory调度。共享owner只读横向复核已委托原一层agent，覆盖生产入口与 occurrence/正常终态/重试重启/并发隔离；完整新的故障恢复运行矩阵未实跑，不冒充已验证。fresh sol-02只有在首轮物理exit1/ports0/配对清理确认之后启动，重新独立验证credential、target projection、实际请求模型。

## 后态真实故障资格与 transport 资格动作前复核

实页已完成中英文项目/全局 healthy、排除条目unknown、真实Save Key但仍0模型、Auth坏JSON刷新未知/编辑未知/恢复、global Config坏JSON时Auth保存成功但cleanup500和catalog config.read后未知/恢复。自有HTTP确认Auth坏时config/env正向true、saved/empty未知；Config坏时catalog200+ConfigJsonError、自定义条目当前缺席但旧可编辑行留在UI。所有操作只在18582/18583自有scope，未拦截网络或改用户实例。

为补 current catalog transport失败时旧 known事实不冒充新鲜的实页资格，先恢复所有自有文件、截图known，然后通过自有stop-requested正常退出后台，原exec核对物理exit0/两个端口0；保持已挂载独有页面，在其原Refresh Provider操作中真实网络拒绝，原handleRefreshCatalog finally仍reloadProviderInfo，资源独立settle把catalog请求错误记录为当前issue，helper据此未知。此为有意关闭无生产任务的自有资格服务，不是发现产品恢复异常。仅此后建立fresh final occurrence，使用最终backend源码/同一冻结UI、自有随机样例独立storage，再从原页正常操作/必要reload验证成功目录后恢复。新scope不用旧缓存/pair，不在观测超时后仅为重试而重启；前轮物理退出与输入恢复必须先完成。保持失败与恢复截图/原进程回执，不用DOM断言或browser interceptor。

## 最终实现、验收与边界

唯一Info schema与正式SDK/OpenAPI新增可选apiKeyConfigured；buildState只用已观察来源派生，现有Info在环境解析点保留正向事实，配置可观察性进入同一缓存身份。project/global路由传递自己的Config结果；Overlay一处helper消费三态，两个placeholder与状态退休原raw key/config猜测；仅增加三项双语key，删除本批失去调用的providerConfig wrapper。all/default/connected与流式/消息/凭据选择合同保持。唯一06-provider公开合同与双语未发布日志同步；本批没有升级或发布版本。

最终新增合同原exec45992实际exit0：14pass/26断言；bootstrap9/21与cache9/41原exec69954中各文件exit0，误写不存在live filename使总exec1，保留原日志，改为真实provider-live-model-refresh.test.ts原exec90835 exit0，5pass/17断言。共37pass/105断言，均聚焦非UI正向实际后端合同。不能将不存在文件的失败冒充检查通过；旧23/79此前原exec2984也已通过。Backend最终exec68262、Overlay8408均实际exit0；SDK正式build16151和冻结Node UI43303 exit0（构建在删除无调用wrapper前，wrapper未参与目标行为；最终页面使用该冻结UI，最终backend含环境root修复）。

24张本批实际1280×720桌面截图主agent人工查看，包含4前态、英文/中文项目/global、saved/config/env/empty/unprojected0模型、真实Save Key保持0模型、composer精确owned-ready/ready-known、Auth坏JSON与Config部分保存失败/正常恢复、真实服务正常停机导致catalog网络拒绝而旧编辑行双输入未知、fresh最终源码在原页直接Refresh恢复双输入。浏览器无拦截、UI自动化、模拟LLM或合成消息；所有自有Auth为随机虚构样例，未使用用户实例。三个scope原exec77496/81343/56914均实际exit0，18582/18583最终0listener，自有tab20/21正常关闭。资格矩阵、真实HTTP与物理回执已归档。

Sol-01原exec10184实际exit1已保留：checker仅按Session选中合法Memory首请求，业务Chat已经200/eof与持久READY；finally主动stop令Memoryaborted。只读实际SQLite确认两个Project身份、preflightrev1/idle、业务rev0/retry_wait且精确原输入仍pending、无lease/dropped0，Chat completed/finish stop，engine_task0、停机session_prompt_owner0。共享代码横审覆盖Session真实来源（API/control/command/shell/user wake/Task operator）、Task pipeline/interaction终态重放、Memory唯一run及同Project串行/lease/revision/availability generation、FIFO提交、错误release/retry_wait、config redrive和reopen恢复、Instance先cancel再drain。没有发现本次产品调度根因；完整Task/Mission/重启/lease expiry/并发竞争新的实跑矩阵未执行，禁止宣称全部共享机制已通过。

Sol-02修复checker身份为Session+真实用户messageID+chat agent+真实assistantMessageID，并等待本轮已产生全部source reader自然settled后才正常停机。fresh配对Auth/models各自验证available/projected/实际gpt-6.1-sol；原exec34351实际exit0，4条真实目标模型stream200/eof（两Memory、两Chat），业务202/READY/持久assistant与身份对应，原父进程0listener且复制auth/models都已移除。禁止用本轮绿覆盖原轮红或声称固定延迟解决收敛。

独立复核未发现字段注入/双源：catalog/config构造显式列字段，原env成功点写同一Info，最终派生复用，失败configured仍排除。DashScope marker在原credential解析成功点，但未单独真实环境运行；SDK自管/多env未知保持，相关范围未完整跨平台实跑。原14项红exec63146有工具输出但无独立日志，已明确记录。已归档77文件/24截图初次扫描已知私有credential与自有随机Key字节0match；最后文档/脚本补充后需重扫。

下一批候选来自真实配置清理失败回执的JSON原输入内容：调查ConfigJsonError/Invalid公共错误是否将含私有key的完整配置进入HTTP/UI及同义消费者，并分开检查本地化摘要与详细技术原文合同。仅只读并行intake；本批提交、fresh上游合并及正常push完成后才落盘下一批最终方案或修改产品。

当前本批所有实现/验收已可审查，文档结构检查、精确范围提交、fresh upstream merge/完整待推送集合与正常push收尾待执行。持续goal仍active，不将“本批已可审查”冒充已推送或整个迭代任务完成。
