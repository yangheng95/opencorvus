# 持续迭代第八批：无模型时的 Provider 发现入口

## Recall

用户要求持续批次并行体验与调查 UI/UX（User Interface/User Experience，用户界面/用户体验）、功能与缺陷，直到明确停止；根因和影响落盘后实施，真实桌面/截图人工复核、聚焦正向功能测试及必要且已授权的 GPT-6.1 Sol 端到端、范围提交、fresh fetch/merge 和正常 push，随后继续。第七批 fdaa6b629 已在 remote main；原 push55812 exit0，八项类型任务、docs348ops/26groups、19篇架构和凭据扫描0命中。本批开始 HEAD f48d1c69c（并行压缩证据身份交付），工作区只有他人三个共享索引和 untracked bun目录；无本任务产品修改。保留全部，不创建 branch/worktree。

沿用两个已授权一层只读分工，不再委托。UI分工发现 SharedResourceManagementPanel 的安装成功被刷新清空、更新成功可能覆盖刷新失败及共享操作/投影生命周期候选，尚无新实页，不能判定局部或已修复；该线索保留并待独立受控矩阵，不采用仅移动成功提示的补丁。功能分工与主agent读 provider.ts/operations.ts、ModelsDev、Auth、Config、global/project routes、ProvidersPanel/provider-form、SDK实际 baseURL/queryParams 实现、04/06/07架构和第5/7批与CS-021相关记录。全仓搜索全部discover caller、getProvider/list/catalog消费及同义URL实现；实际模板解析在provider.ts100，base-url.ts同名tracked模块无调用，暂不为无关清理修改它。不存在名为test/server/providers.test.ts或global-routes.test.ts的猜测路径，已改用rg定位；没有将失败读取算覆盖。历史首个保留65d0bfc98已有当前guard，全历史-S查询曾过慢中断，原始引入决定未知。

## 根因、影响与待运行证据

当前合法 config.provider[id]={api:loopback/v1,models:{}} 或省略models，Auth中API key可存在。buildState先合并配置/环境/Auth/plugin，随后617–619删除模型数为0的providers条目；getProvider/getProviderGlobal只返回这一可推理投影。discover的saved-key guard只收集此Info的model.api.url；因此可能形成发现先要模型的循环，配置地址与Auth存在却返回HTTP400地址归属错误。真实页以配置显示custom行，编辑保留空Key输入，提交原editing ID及合法地址，故不是Auth未配置。显式Key跳过saved guard，可作为同地址真实对照。

同类生产入口refreshModels也通过getProvider拿key；空OpenCorvus catalog或全部模型被白/黑名单过滤可能错误报告credentials未配置，阻止两条live-models refresh恢复空目录。这些是当前代码可达线索，运行事实尚待确认；不把一个路径通过当作排除共享根因。正常connectivity、模型选择与推理确实要求真实模型，不得扩大ready集合、假造模型或绕过getLanguage的canonical model校验。现有getLanguage1177–1190验证当前models再getSDK；public list/catalog/connected及ModelNotFound suggestions必须保持当前合同。

涉及全局与项目四个发现/实时刷新入口，零/已有模型、原配置顶层API与实际原model API、已存/显式/config-options/env凭据、过滤与失败的模型目录，以及普通模型连接与默认选择。Auth仍按ID全局共享，scope来自现有Config.get/GetGlobal；配置与目录不能另建影子状态。已有ProviderState只保留一份可解释的已解析Provider事实，推理ready应当是其模型集合派生，而不能删除发现所需凭据事实。若实施需复用同一状态及原配置/目录事实源，并保留启用/禁用准入。

Query/hash当前在请求和比较中清除；SDK另有options.queryParams，未找到保留query的产品合同，不本批顺带改该语义。options.baseURL/环境模板与model API的发现授权边界需区别于推理地址，尚未实跑，不先泛化为所有配置自动发现。不存在调度/队列/恢复/终态异常运行证据；资源UI的并发候选仍未排除，不能称已证明局部。后续如出现真实生命周期异常立即横审生产Task/Mission/Session轮次、重试、重启、串并行及多项目。

## 修改前运行与实施计划

1. 在全新自有环境、真实生产backend /ui、Node冻结前端中，用只接受虚构样例Key的loopback /models与/model/info参与者确认零模型global/project失败及显式/已有模型对照。记录实际HTTP状态、精确ID、目录/config、Key匹配布尔值，不记录header或任何真实密钥。全新runtime内写入虚构Auth，不复制用户auth/models，不推理或写消息。页面真实编辑零模型行、Discover并截图人工查看；直接HTTP不能替代UI反馈验收。
2. 在上述证据后复核并落盘最终实现。候选根治方向为ProviderState保留已解析配置/凭据事实，以一个派生函数继续向list/catalog/getProvider/model选择提供原有可推理集合，供两类显式发现读取同一事实；不另加credentials map、fallback、伪模型或对LLM的host流程gate。Generic saved-key地址仍由当前scope的真实声明及model endpoint许可，禁止未知地址获得已存Key。live refresh仍只用现有顶层OpenCorvus发现endpoint，完整严格metadata后单个catalog原子写回。API Key选择须与现有SDK事实一致，保持错误与权限合同。
3. 非UI修改增加聚焦正向测试，真实本地HTTP资格覆盖0/已有模型、global/project隔离、明确地址错误、损坏Auth503、strict metadata与过滤后的恢复；不保留核心负向断言。复核现有测试的当前正向合同，测试失败工具链先修并重跑。真实桌面中英文Discover、保存后模型投影、清除/编辑交互与截图；无UI自动化。若实际改动共享Provider状态/SDK路径，配对暂存auth/models、预检后做必要Sol流式正向回归，并正常收尾，不将本地协议样例称在线推理。
4. 更新06-provider唯一架构合同、双语未发布日志、根/月/artifact索引，运行当前docs/typecheck及所需检查。自有scope全部正常stop、原exec实际退出、PID/port事实闭合，保留用户进程。只暂存本批hunk，标准提交、fresh上游merge、审查完整待推送集合和必要验证、正常push。无Release/tag/发布授权，持续goal active。

## 开始时状态

调查与修改前方案已落盘。产品源码未修改，真实前态、最终设计、实现及后态尚待执行。

## 真实前态与最终实施范围（产品编辑前）

Node私有当前前端构建exec16388 exit0。独有18578生产scope PID83240 / occurrence2df6c86d-101d-4e30-9667-1813b163926f、loopback50709，sample key随机生成，只保存在独有Auth与参与者内存，未写header或key日志。global/project saved零模型发现均真实400，显式样例key同地址200精确global-discovered-a/b，已有模型saved发现200 ready-known；两条live refresh均200 ok:false“credentials not configured”。参与者真实请求只命中显式与已有模型对照，认证匹配均true；不是实际远端凭据/模型推理。主agent真实项目编辑→Discover与New chat退休项目后全局Discover，均人工截图看到地址归属错误；菜单Refresh OpenCorvus models截图看到凭据误报，当前Auth确已由正常owner写入。页面零模型行的Key输入placeholder仍说paste，提示与持久化Auth的关系另作未修复边界，不因该文案把Auth判为缺失。tab18已正常关闭，原exec39448实际exit0，生产stop回执待归档。

两分工再次核对最终设计，主agent完整搜索ProviderState.providers全部读取者、六个外部消费文件和唯一两个getProvider生产caller（operations及session/llm）。配置/providers路由直接sort首模型id，故不能改变原公开list可推理过滤。最终修改只取消buildState末尾因零模型删除条目；保留enabled/disabled、failedProviderIDs及plugin/loader失败的所有排除。既有单份providers保存已解析事实；新增一个模型可用谓词和派生集合/单项读取，覆盖list/global、catalog/global、getProvider/global、modelFromState、getLanguage和suggestions、closest/getSmallModel；保留Info/model引用、模型缓存及canonical model准入，不新建cache、影子map或伪模型。

显式发现读取同一State中的configured Info，新内部owner接收原config/global选项；generic仍只用explicit或Auth saved API key，不能借本批扩大为OAuth、headers/custom fetch认证。地址许可在原model.api.url集合上加入唯一顶层发现endpoint；以current config.api ?? canonical ModelsDev declaration.api选一个被当前scope覆盖后的声明，不同时许可被覆盖的旧catalog顶层地址。configured Info不存在（disabled/enabled/loader等原排除）时依旧不许可saved key。实时刷新复用同一个顶层endpoint选择和同一State配置事实，Key选择复用SDK现有string options.apiKey优先、否则provider.key的精确规则；显式空字符串不能||退回saved。原strict metadata/单catalog原子writer及route缓存失效保持。

不修改baseURL推理选择、URL模板/query/fragment处理、原global/projectHTTP schema、Auth存储或LLM参数/消息。base-url.ts无调用的重复代码已记录，本批不复活也不为无关清理删除它。资源设置成功/刷新混用与局部作用域的源码候选未实跑，保持未排除共享根因，不能作为本批已修或局部判定。零模型ProviderState重构涉及共享读取，实施后需原cache/live-refresh回归、聚焦正向HTTP/过滤/错误合同、全局/项目真实后态桌面及配对auth/models预检的Sol流式端到端；没有该证据不宣称完整交付。

## 首轮验证失败分析与收敛方案

原bootstrap首例通过，后7例未进入业务断言，在同一个已删除memoryProject目录触发ProjectDirectoryIntegrityError；live-models refresh 5例、cache identity9例已通过，不能将1/8算验收通过。Config.globalProjectDirectories2759读取Project.registeredDirectories持久登记，commitGlobalCandidate2808→removedGlobalSkillNames2778用provideProjectIdentity重新访问登记目录；memoryProject的asyncDispose只释放Instance、关闭自己的进程并物理删除目录，不删除登记。这是本文件每例删除项目后仍执行global mutation的错误生命周期。改为本文件单个项目贯穿所有用例，所有global恢复完成后再释放；先独立恢复Auth/catalog，重置读取，再恢复Config，participant由独立finally必定关闭，收尾异常保留真实失败。外部删除真实已登记项目影响global修改仍是后续共享合同审计候选，未排除生产影响，不在本批以测试夹具修正宣布该边界已解决。

复核发现operations新增无条件ModelsDev.get严格读取会破坏buildState捕获catalog.read失败、允许完整config继续工作的现有部分成功边界。按唯一优先级config.api ?? declaration.api，仅当config缺少api且需要catalog声明时读取，不建立失败fallback；增加明确配置api在损坏catalog下仍成功发现的正向合同。原getProvider静态类型Info为现有Record索引合同，公开runtime可返回undefined；保留该类型，避免扩散Session.llm调用合同的未授权重构。原typecheck暴露的3处联合类型错误修后重跑。首轮formatter错误是cwd错误，已在根目录用实际Prettier修正；原失败日志保留，并重跑原3文件验收。

## 修后验收与边界

实现完成：仅保留configured事实中的零模型，ready getter/list/catalog、模型准入和suggestions用同一派生谓词；live refresh复用SDK Key选择并保持严格metadata与单catalog writer。Generic在configured事实存在且配置api缺席时才读取canonical declaration，不让损坏独立catalog破坏完整config的发现；已有失败排除依旧返回原400。没有新增协议/路由/config面或非流式LLM。

原聚焦三文件runner重跑exec75698实际exit0：bootstrap9/9（21断言）、live-model-refresh5/5（17）、cache9/9（41），总23例79断言；backend typecheck49040实际exit0。新增覆盖真实loopback协议/global与project地址、0/已有模型、明确api加坏catalog仍成功、top-level覆盖后的地址错误、configured与ready输出、禁用地址400、options.apiKey优先与显式空值、AuthReadError503。最后缩小guard的catalog读取条件后，原同三文件再跑93463，实际exit0，仍23例79断言。cache-identity触及的两条负向“不含secret”断言删除，改成精确持久schema与真实credential identity正向合同；SHA-256在此是不可变安全身份协议，非可变源码验收。撤销本次formatter造成的三个无关纯格式hunk，仅保留5增6删的正向测试变化，没有扩展容量测试实现。

前/后真实18578生产服务均用独立fresh数据、真实Git项目和同一个Node冻结前端：本批不修改UI源码，冻结前端无需再生成另一份实现。前83240/2df6c86d、后86188/12fafbb2，全局/项目saved空模型从400变200，返回各自global-discovered-a/b与project-discovered-a/b；显式同地址和已有模型对照继续200。两条live refresh从ok:false凭据误报变ok:true，并返回global-live-a/b和project-live-a。项目whitelist仍只有owned-filtered-model，真实推理目录0并未阻止实时发现恢复。真实UI英文项目发现→保存2个、中文重复发现/实时刷新、Composer确认项目IDs；New chat转全局后中文空模型发现→保存2个、英文再发现/实时刷新→全局2个live模型，选择global-discovered-a自然显示在Composer。14张截图（3前态11后态）均人工查看；曾过早采集中文busy状态，已实际等待业务结果重新拍摄覆盖，不将“发现中”当成功证据。一次猜测中文tab名失败，随后按真实snapshot定位模型服务商，没有源码文案自动断言。直接生产HTTP与持久项目config复核同样精确IDs；全局模型保存后的项目模型集合依现有Config继承合并，保留global与project声明；地址仍按project override，不将继承集合称作用域泄漏。

实际后UI只对自有生成样例Key参与者调用，不冒充远端Provider推理；普通测试只能证明局部合同。另执行必要且已授权的真实GPT-6.1 Sol端到端：fresh paired auth/models，禁止复制OAuth刷新；启动前credential available、catalog projected与apiModel gpt-6.1-sol三项分别核验。原生产Global Chat start preflight持久化流式回复并确认实际模型后，再接收公开业务输入202并持久化READY。Sol PID85032 / occurrence9c62d732，原exec50104实际exit0；4次实际gpt-6.1-sol请求均streaming:true、HTTP200、reader settled/eof，其中2个memory参与者与2个chat参与者为生产自然消息，不是测试合成。此scope持久global memory.enabled=false，两个自然Global Chat项目均未覆盖该字段；仍记录2次agentID=memory请求。该身份只作为线索，不单独认定具体触发根因；现MemoryInjection检查enabled，Organizer未检索到该字段，Config描述Enable persistent memory store。开关控制与Project MEMORY.MD独立语义的合同尚未知，已立即交给同一只读功能分工横审全部Task/Mission/Session轮次、正常/终态、重试重启、串并行及多项目。4次reader均正常eof、进程正常stop是已证事实，不能据此把该共享配置/触发候选降为局部或宣称已排除。待本批push后作为下一批优先候选，不在Provider交付内草率加gate。

前/后原exec39448/89939均实际exit0，before12:12:04.816Z / after12:42:04.618Z父进程记录已归档；Sol12:37:13.483Z父记录exit0、18580无listener且auth.json与models.json逐文件清理完成。额外12:43:40.852Z真实TCP表确认18578/50709/49817/18580四端口均无listener。仅关闭自有tab18/19、正常停止自有scope，保留用户窗口与进程。

未解决边界：零模型行已存Key的placeholder仍误呈未配置，当前原因候选是ready connected被当凭据存在；资源设置operation成功/refresh错误混用仍未真实矩阵验收；已登记目录外部删除影响global mutation尚未共享运行审计；baseURL模板/query/Auth options-only generic未扩大合同；无Release/tag/发布、无线上Venice资格。下一批在本批范围提交与正常push后继续这些有证据候选，不能将本批称整个产品完成。



最后条件收敛后原93463实际exit0，23例79断言仍通过；docs-final348ops/26groups、源provider/operations及新增bootstrap test的Prettier检查全部实际exit0。证据逐文件对既有private credential及编码形式在内存扫描，41个文本产物0命中，不输出凭据或digest。批8提交范围为2个Provider源文件、1个新增正向合同文件、1个旧测试最小正向修正、06-provider唯一架构、双语未发布日志及本批spec/artifact/index行。shared index的排序与393等其他hunk保持原样，不把并行任务内容加入本批。
