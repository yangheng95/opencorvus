# Provider Test 在途变更与作用域资格（持续迭代第14批）

## Recall

用户原始要求：持续迭代opencorvus当前版本直到明确停止，先根因与影响分析并落盘specs，再实现有证据的修复、真实桌面页面交互、截图人工复核、聚焦正向合同、必要且授权的GPT-6.1 Sol端到端验收、范围提交、上游合并及正常推送，自主进入下一批。最新明确要求“停止所有子agent，你自己做并验收”；所有本树子agent已停止，本批完全由Root独立执行，不继续委托或发消息。

第13批范围提交e91191975b61e0b88d5e87e7ba0380804109c77e，parent9a8c1a856759009c0f1f461a3c8a9c51732c5bce、162文件。Root实际84项正向合同/219断言、24原始桌面图、9条真实gpt-6.1-sol流式200/EOF请求；两个完整Auth/models fresh pair分别验证凭据和目标投影，在原进程正常退出后清理；完整原日志的实际凭据扫描0。部分流错误保留已收到文本，两scope默认模型/前置条件/typed Auth错误和原HTTP错误合同已验证。原失败、Saving图及删除确认超时原图均保留并明确边界。

提交自身实际0；外层28608完成56801a1和首reconcile10961完成5d2b491为并发标准index锁，不删锁。改为一次批量精确结算7f5cc60，保留所有peer暂存。推送准备遇到独立Files/长Source阅读交付：46926caf7原图展示、1d07e88a1阅读修复、a71a3ee14恢复被旧索引误带回的33文件、74ff844f6准确记载事故均逐项审阅，未自行改写他人历史。正常hook完整通过，目标74ff844f64c73a76a30df8baca7647a2c3817fa3的release/module检查0（1157 modules/5910 edges/4 clean imports）、secret scan0。首原push15034完成1c7357实际1：远端已并发到同一74ff，expected9a8的ref事务失败；fresh fetch1cd0830、mergefaa1ee0、完整pending空，原normal retry57673仍在进行，不能借其他任务推送自称本次重试0。后续实际结果追加。

持续目标active，不创建branch/worktree，不操作用户窗口/服务、不发布。仍有compaction、真实Provider审计和其他任务改动及独立Git暂存，全部保留。本批只关注Provider Test尚未资格的生命周期，自动ID候选继续保留为后续调查。

已读：B13完整Recall/根因/24原图/公开合同/独立共享机制横审；current architecture05-config、06-provider、07-panel及07-panel-reactivity；当前ProvidersPanel唯一观察Map、Test generation、scope/authority/selection owner、Save/Key/Auth/Delete/refresh及所有调用；llm服务、provider-save、api authority；AuthRoutes、Auth共享写锁与Provider刷新invalidations；B12实际Config/Auth process-lock holder、正常服务启动/停止和假输入运行器；ModelsDev唯一catalog/显式目录校验。全仓Test入口及Task/Mission/Session关联已经在B13横审，本批追加实际现象时继续核对，不把旧EOF事实推广为新执行矩阵。

## 当前证据与未知

已资格：同ID完成结果在Config/Key接受后退休；真实Sol请求received后、EOF前保存全局名称，文件mtime处于两者之间，EOF后原结果未回写；project Test真实200；目标live模型刷新只退休其ID，其他Sol观察保留；registry刷新退休全部；实际全局删除清除自有样例配置/Auth。仅打开编辑和删除确认超时保留原观察，符合未接受变更边界。

尚未资格：不同Provider同时在途、在途Key接受、删除后同ID重建、取消重开/卸载、scope A/B/A及API authority退休、跨作用域延后接受的全局Auth变更、外部窗口/服务改配置传播；完整Task/Mission/Session重启/多项目容量矩阵未实跑。fresh OAuth登录会产生真实外部认证，本批不为没有证据的怀疑更改用户凭据；已有B13真实Sol资格按准确边界保留。

新候选只有源码线索：`AuthRoutes`写入唯一全局Auth，200前已完成原Auth.set和Provider/native-agent cache reset；其当前回执为ok/issues，没有新Provider mutation事件。Panel的接受后退休只在原options.isCurrentDirectory/owns成立时作用于该组件Map。切换设置/项目可卸载该组件，已经开始的物理Auth写入仍可能在新组件读取旧凭据之后接受。此时是否存在现成目录重读/真实事件传播、是否能让旧观察留在当前scope，尚未知。不能从条件检查或最后一个busy状态直接判bug，也不能未确认就新增全局generation、影子凭据缓存或广播合成消息。

## 触发、数据流及影响分析

执行链：真实页Test→当前service捕获scope/authority→两真实route→同operations读取当前配置及有效目录→原Provider语言/认证→单个stream→完整Result/原HTTP error→唯一Map及per-ID generation。LLM（Large Language Model，大语言模型）流保持真实生产路径；测试自身不创建Task/Mission/Session，不以模型自述作为身份或结束证据。

Config写入属于当前project/global声明；Auth属于跨项目全局凭据；canonical catalog也是共享源，live refresh已有实际providers IDs。三种接受事实影响范围不同，不能把同ID或当前pane所有权当成等价语义，也不能以对象引用、源码摘要或时钟造变更事实。已开始写入与随后UI scope退休必须分别观察。

旧方案边界：B12只资格保存观察，B13只资格上述已完成/一个真实在途Config场景；未实跑矩阵不能说已根治所有生命周期。本批首先补实际证据；如观察正确则只记录资格，不为增加改动而重构。若复现跨scope/global共享问题，立即横审全部生产入口、Task/Mission/Session occurrence（执行轮次）、正常终态、重试恢复、串并行和多项目；只有生产代码、持久化事实和实际流证据排除后才能收口为局部UI owner。

公共契约/调用/交付：暂不改变schema、路由、DTO（Data Transfer Object，数据传输对象）、认证存储或SDK（Software Development Kit，软件开发工具包）。任何后续变更先全仓补查定义、caller、同语义和历史，精化此方案再实施。所有产品正文和无障碍名称保持当前中英语言；技术诊断、用户/模型原文保真。不新增/运行UI自动化；业务合同测试和类型/构建不能代替真实页面截图。

## 实施前冻结资格方案

1. B13正常重试实际完成并记录后，启动新的自有开发backend及`/ui`，使用已成功Node构建且Provider区域与当前源一致的冻结UI；不启动独立Vite。只用本批生成的虚构API凭据及合法完整显式catalog，禁止读取、复制或修改用户Auth。受控HTTP参加者仅返回实际有身份的明确错误，保留真实请求body里的model/streaming及接收/回应时间；不伪造模型成功或Message。该参加者只资格故障输入和当前生产/UI路径，不能冒充第三方认证或真实Sol。本批如需要新的真实Sol资格，先另行明确fresh完整pair/target/实际请求及预算，沿原授权运行。
2. Root实际并行启动两个Provider Test，查看两行busy与各自正常错误终态；用已有生产Auth/Config文件锁在自有目录形成可恢复延迟，不浏览器拦截、改DOM或注入app state。只有实际锁ready/HTTP开始后操作；及时明确释放原锁，记录原birth、接受事实、最终流及页面。重建、Key、取消/重挂、scope和authority按独立发生顺序留图，不能用复述或静态源码判定。
3. 专门调查全局Auth延后接受：旧scope已开始保存、物理写锁尚持有时通过真实导航切换新scope，执行新观察，随后释放原锁，核对接受回执、原Auth generation（不保存Key）、目录及真实页面是否自然收敛。锁只是调查故障输入，生产路径不新增gate或流程路由。若具体scope切换会卸载组件，如实记录组件边界，禁止假装同一Map被重用。
4. 已观察异常先落具体根因、影响、排除/未知和唯一实现方案，再修复并回到原输入复验。纯UI不加自动化测试；非UI替代合同必须有聚焦正向明确输出/状态/错误测试。不存在异常时只交付独立验收记录，不扩大无关清理。
5. 所有自有原请求、锁、页面、服务正常settle/join；在实际进程退出/端口释放后清理本批假输入pair并扫描完整原日志。归档原图与原失败，更新specs/README和相关索引/README、当前文档检查；本批所有修改范围提交、fresh upstream merge、完整pending审阅与正常push，然后继续。

## 当前状态

本方案在第14批运行器、生产修改或UI操作前落盘。源码候选与范围已分析；新矩阵运行尚未开始。B13重试原句柄继续观察；未把计划或待返回的命令记为通过。

## 第14批原始执行与输入修正

方案及B13实际回执checkpoint已范围提交6cd7aa4521d84afd218600d6c74055363220db91（24路径、parent a2f8a793d），原commit72272完成54e77c实际0，精确batch index结算0。fresh fetch65d47e0/merge9f36fa0、完整pending两项均仅已授权且读完的文档方案，normal push50627完成a93f5c实际0，全部原hooks0，远端捕获6cd7aa452。本批没有生产修改，方案提交不是新矩阵通过。

首launcher a600ea实际1，自有PID41860、18614/18615；输入错误把repository bootstrap源文件直接当完整显式catalog，原校验明确missing kilo。models-bootstrap.json有意由唯一ModelsDev.bootstrapCatalog/provisionDefaultCatalog补齐local声明；显式来源要求已完整。进程自然1、监听0、完整假输入pair清理已由parent确认，未进入页面或推理。保存原执行runtime/launcher后，改为隔离默认canonical路径上的ModelsDev.get初始化，再复制该完整事实并加入两个自有样例；不手抄Kilo或增加目录fallback。

第二原launcher93b394/session29199自有PID86420、18616/18617、occurrence e5c17996-00ca-4f0a-b2c2-ab0e9a5a3f84。完整默认catalog加两个样例共90，项目A/B各独立Git仓库，真实公开POST/session200创建两个空assistant Session，仅作真实导航准备，没有Message/Tool/LLM输出注入。两个Provider的配置models:{}、有效模型各一项、APIKeyConfigured=true；此轮只用生成的假Auth，0 real Sol。

Root真实tab5亲自看过5原图。第一并行请求1/2仅间隔14ms，都body.streaming=true、模型对应A/B、实际各10秒后HTTP400；Key操作时两响应已结束，图02只证明完成结果A退休/B保留，不冒充在途。原输入不增预算，第二轮在一个正常人工操作窗口发起3/4、看两busy、保存A Key：图04 A已回Test、B仍Testing。实际Auth mtime1791927456967.4575在A received1791927456269与responded1791927466276之间；B received1791927456534/响应1791927466535。原响应结束后图05 A保持接受后的无旧卡片，B有自己的failed模型回执。实际HTTP参加者只资格控制故障输入和当前生产/UI owner，不宣称Provider认证或Sol成功。

删除重建前移除自有enabled whitelist的真实PATCH返回409，首probe只记录状态，重新原请求保存完整body：NonCanonicalConfigFileError指向自有after/project canonical路径与仓库D:/myhexin-local/opencorvus/.opencorvus/opencorvus.jsonc冲突。该错误不证明产品写入成功，不删除用户配置。源码removalPatch会移除enabled名单中的ID，因此本次样例准备需先让原catalog声明能在删除后继续显示，不能借filter排除观察。

运行器根因：launcher把OPENCORVUS_PROJECT_DIR设置为after/project；运行器只初始化project-A/B Git，默认project仍是父仓内空目录。真实git -C该目录rev-parse观察解析到父仓。配置/所有已知Project验证触及这个默认scope，正确拒绝非canonical源；这是隔离输入缺口，不能把它改成Provider退休bug或覆盖全局约束。影响本轮进一步Config/Delete矩阵，已经按明确global route完成的两Provider/Key观察证据仍保持其实际边界。

tab5已关闭，stop marker d804db0；原session29199完成10f6ae实际0，正常runtime settle/dispose、listener释放与日志关闭。parent在实际exit后清除auth/models假输入pair，监听0。先启动privacy95682，完成c09158实际0，对实际完整stdout0/stderr9680/backend138018bytes扫描当前生成的已知假凭据及归档0泄漏；原用户Auth未读取/复制。原before1/after0以及所有失败、输入、原图都保留。

下一自有occurrence实施前精化：在任何Global Config/Provider操作前先初始化launcher默认project为独立Git输入，同时复用初始化primitive创建A/B。完成原完整catalog校验、真实默认scope Git authority和实际global Config可写前置后再进入页面；fixture准备失败先正常退出，不把None或未返回状态记为0。保留原source输入，新增fresh final目录/18618-18619，原actor10秒与75分钟进程上限不变，不延长或重置已经结束的owner。没有生产补丁、UI自动化或用户配置操作。

## 跨作用域实际缺口与共享横审

修正后原final launcher9c18c5/session46765，PID87288、18618/18619、occurrence9f480ad4-bddd-4f08-9c41-f73c09237fa2。所有默认/A/B Git在Config之前创建并核对精确实际root；真实原global PATCH移除自有whitelist98813b exit0（200、完整catalog90、两个owned各有效模型1）。目录修正没有产品补丁。

同ID删除重建已完成实页/原HTTP资格。首次分步操作的原请求2在重建/新Test3之前已结束，7c2230原时间戳明确保留该未达竞态窗口，不虚报。重新预填真实表单，在一个正常人工动作窗口内Test4→确认删除→原目录显示→Add接受→新Test5，原4 received1791928522364，重建Config mtime1791928525228.3057/Auth mtime1791928525283.1167，新5 received1791928525775；4/5分别1791928532365/1791928535776响应400。图09展示重建名称与新Test busy，图10最终完整详情确认为refusal5。没有在4响应后/5响应前取得中间截图，因此只证明同窗接受与最终新回执，不宣称那3.4秒的busy全部人工看过。

新增缺口已经实际复现：生产Auth锁holder13616/PID89952只持有本次fake canonical Auth文件，原300000ms上限不变。22:04:58.407旧全局Pane实际PUT/auth/owned-lifecycle-a开始；离开设置，通过真实project-A导航的New chat for this project进入项目设置，22:05:28.040实际POST/provider/owned-lifecycle-a/test开始，participant请求6于1791929128050收到、1791929138052返回400。显式release63b1370，holder6ede5f实际0；Auth generation a42afea2→31e200fe，mtime1791929142035.3677；旧PUT于22:05:42.037真实200（43630ms），即新项目Test已完成约4秒后接受。fda367只从原server日志投影请求身份/路由/时间/结束码，完整原件另保。图11真实旧Key Loading、图12新项目Test、图13在该Auth接受之后仍显示旧refusal6。不是根据最后一条错误或标题判定。

直接根因：接受的全局Auth事实被绑定到发起它的旧组件/原directory/selection owner。handleSaveKey在await原200之后仅owns()成立才retire；旧组件卸载/作用域退休使该分支跳过，而新组件已有自己的观察Map，无法接收这份已接受的共享变更。authority revision只随backend URL/访问凭据/native rotation变化；api-state.configure(directory)不更新它，因此这次是同一backend的有效全局写入，不是被新backend拒收的旧响应。HTTP API保持真实成功、全局Auth持久化与原nonce正常更新。

横向生产审计：Auth.set/setWithGeneration/setIfGeneration/remove/updateApiMetadata共用唯一共享JSON事实锁、原子写和持久generation；observe/inspect分开，读不伪造新值。API set/remove、Provider removal、CLI auth、ProviderAuth api/OAuth、CredentialExchange的CAS提交路径已搜索；MCP Auth是另一个域，明确排除。两AuthRoutes在200之前收齐Provider.resetAll/native-agent reset issues；Provider.getSDK使用当前已捕获Provider/config/options，按真实选中credential建立SDK/capacity身份，旧已发出的调用保持原认证直到自己的正常终态。既有selected credential摘要用于真实资源身份，不作为本批功能/源码哈希门槛，本批不改它。

Task/Mission/Session全部caller及自动化/CLI/直接Test通过B13共享审计的Provider/ProviderLLM流入口。直接Test不创建Task/Mission/Session；本轮只有合法空Session导航准备和物理HTTP错误，没有注入Message/Tool、子agent或模型成功。正常/错误/终态、重试/重启的SDK恢复是原资源owner；scope切换只退休UI，不重置后台持久generation或将旧请求搬到新项目。实际A/B并行、同ID重建、项目/全局route与4/5/6正常HTTP400→Test200收敛、两个服务正常退出和锁释放都有原证据；没有发现重复派发、丢写或仍挂住的原请求。完整Task/Mission/Session容量数据库与重启/多项目运行矩阵未执行，不以这些局部事实声称全部排除。

同语义UI路径：配置接受（含typed committed）、Auth/Key、credential cleanup、Delete及两个显式catalog writer都可能在原Pane退休后接受。Config项目写入只影响其directory；Global Config/Auth/canonical catalog是共享事实。当前callback对结果/表单所有权的保护正确，但不能兼作接受事实的传播门。apiRequest仍在真实response后核对backend authority，目录切换不使它退休。当前events/global SSE没有Provider Auth接受事件；引入后端新协议会扩大全部CLI/跨进程与replay合同，本次没有这些运行证据，不借此新增不完整事件协议。

实施前冻结修复：新增一个UI服务层的已接受Provider变更通知primitive，沿现有api-state监听器的订阅/清理方式，只保存当前listener、不保存测试值、凭据、revision影子或重放队列。通知仅由原已接受HTTP/typed committed结果产生，携带捕获的backend authority、实际global/project scope及已知IDs或明确全部；不是模型/会话消息。当前ProvidersPanel订阅后用原唯一Map和per-ID generation退休，scope/selection/draft/read owner保持原样。已知API Key、Config和Delete按真实ID；共享registry明确all，live models保留真实returned IDs。通用认证完成回执没有实际redirect target清单，保守退休当前全局Provider观察，不根据请求品牌猜目标；取消/失败无接受事实。其它窗口、CLI或请求在取得response前真实断开后的传播仍未知，不把这个进程内通知冒充后端全局持久事件。

同步移除上述原组件内的接受后retire调用，由通知consumer统一负责；Test开始和scope退休仍按各自原owner处理。消息有且只有原真实API结果，Map仍是唯一当前测试事实。服务通知补聚焦正向metadata/多订阅输出测试，不新增UI测试；Root重新Node构建并用同一实际锁/导航/原API矩阵复验，必要Model资格按真实边界决定。先落本分析再改产品。

复现页tab6已关闭、stop marker36b3960，原46765完成ad528b实际0；正常settle/listener/log结束、pair清理与端口0。此前privacy81917完成3a1f8d实际0：完整stdout0、stderr12386、backend228702bytes按实际当前fake值扫描与归档均0。原13张图全部Root实际查看。修复前证据冻结，尚无本段生产修改或修后验收。

B13原normal retry57673完成5e8e81实际0，push-retry.exit已确认0，原日志Everything up-to-date、全部正常hooks通过。重试捕获与远端确认的交付头为74ff844f64c73a76a30df8baca7647a2c3817fa3，包含范围e91191975。首远端ref并发拒绝1和最终本任务正常重试0分别承接previous-batch/完整原日志，完整pending首五个已授权审阅、最终空，不合成一个无失败回执。fresh重试fetch1cd0830/mergefaa1ee0才是最终同步；此前pending-review.json里的156f87/284080是上一同步，保原元数据并以本段和原retry日志纠正，不覆盖。

## 首次修后复验与结论纠正

修后原postfix runtime PID85804、18620/18621、occurrence9b774b06-2669-48d5-aad8-fc769a014375，完整catalog90、默认/A/B精确Git identity均正常；只使用本批fake Auth。聚焦8文件68正向测试184断言、overlay typecheck、Node UI build均实际0。旧全局PUT 6dbe5b2a于22:26:42.090开始，新项目Test 2c5be92d于22:26:43.940开始、22:26:53.980 Test API200，HTTP参加者请求1实际streaming=true/10秒后400。Root显式释放原Auth锁后，原PUT22:29:14.473才200，耗时152383ms；图15仍显示旧结果，不能记为修复通过。

补审发现关键遗漏：host-transport.ts唯一DEFAULT_REQUEST_TIMEOUT_MILLISECONDS=15000，transportRequestSignal默认产生AbortSignal.timeout；该Auth请求未选择serverSettledRequest。首次修前PUT43630ms、首次修后152383ms都超过真实前端响应边界。故前段“已实际复现通知缺口”和“直接根因”必须降为源码候选：上述运行只证明持久化在客户端超时后成功，无法证明有效响应到达旧组件后的通知缺失。保留原事实、图片与原判断以便审查，以本节纠正其证据效力；不得用无console error推定响应已到达。这个超时后的跨窗口/CLI传播仍属此前明确未知，不能用进程内listener方案宣称已修复。

下一冻结资格：保留原10秒HTTP参加者、15秒产品超时、300000ms原锁上限不变。用独立的自有故障输入控制器，在观察到本轮新增真实HTTP参加者请求已回应后立即写原锁release marker，绝对最多60秒结束；只观察本批原请求文件，不操作UI/DOM、不注入状态、不产生产品消息或重放响应。Root在一个人工动作窗口完成旧Global Save Key→真实项目A导航→Test，再人工查看接受后截图与后端原request时间。必须记录PUT总耗时确实小于15000ms及实际页面结果，之后才可判断该通知候选是否成立。若窗口失败，保留原失败且不得延长产品或原请求预算。尚无新的生产修改。

## 有效窗口对照、实现与交付资格

修后postfix原short-window生产锁holder62101、响应控制器41122，二者均原句柄正常0；控制器只在收到新增真实participant请求2的respondedAt后释放原锁，没有延长10秒输入、15秒产品或锁上限。旧全局PUT e7315a80于22:32:21.010开始；project-A Test c64a5297于22:32:23.130开始、22:32:33.176 API200。原HTTP2 received1791930743169/responded1791930753172、streaming=true、400；控制器在1791930753182明确release，原PUT22:32:33.356完成200，12346ms。Root原图16看到项目Test busy，原图17看到接受后的Test可用、旧卡片退休。

继续同Pane A/B并行：原请求3 received1791930771765、4 received1791930772066，均streaming=true/实际10秒400；图18两busy，图19实际A Key接受后A恢复Test而B仍Testing，图20全部原请求结束后A维持退休、B返回自己的失败模型卡片。当前fake Key变化使initialCredentialMatched=false只表示与启动样例字节不同，不是认证故障；参加者始终明确返回400，不伪造成功。

postfix页tab7关闭，stop97ba12；原runtime95332完成f8f370实际0，正常settle/log close、parent端口0、假auth/models整对清理；privacy71867完成5ff560实际0，完整stdout0/stderr9680/backend147429bytes扫描和归档均0已知当前凭据。没有停止用户进程。

为排除原超时混因，fresh shortbase使用同一当前runtime输入、修前B13冻结ui-final，PID80732、18622/18623、occurrence83092926-b9ca-4f21-88c0-33f613ea44dd；默认/A/B Git在Config前初始化，完整catalog90。生产锁30347及响应控制器99169均原句柄正常0。旧全局PUT 8e8f78a2于22:35:15.435开始；project-A Test 9990b8aa于22:35:17.606开始、22:35:27.703 API200；HTTP1 received1791930917691/responded1791930927697、streaming=true/400；全局PUT22:35:27.793真实200，12357ms，小于产品15000ms。Root原图21看到项目Test busy，原图22在有效保存响应后仍显示完整refusal1。该有效对照才支持旧组件接受传播缺口；原超时窗口不参与该结论。

Root关闭tab8，原runtime20888完成4e3c0c实际0，正常settle、两个端口0、整对假输入清理；privacy6839完成824e0a实际0，完整stdout0/stderr2420/backend106356bytes扫描与归档均0当前已知假凭据。所有22原PNG Root亲自查看，14在归档前补读原图核对其只显示busy。当前实现为provider-mutation.ts唯一无状态接受通知、ProvidersPanel唯一Map及原per-ID generation消费者，删除原组件重复退休路径；完整ProviderRemovalReceipt沿现有SDK事实区分全局Auth接受与项目Config范围，不修改后端/SDK/推理/模型流。

原聚焦命令在packages/overlay使用Bun1.4：bun test ./test/provider-mutation-contract.test.ts ./test/llm-provider-operation-scope.test.ts ./test/provider-refresh.test.ts ./test/provider-save.test.ts ./test/project-configuration-ownership.test.ts ./test/config-service-fail-fast.test.ts ./test/api-error.test.ts ./test/provider-auth-authority.test.ts。实际b03ea9为68pass/184expect/8files/0fail，其中新通知4个正向metadata合同7断言；没有UI/DOM/组件/源码文案/快照测试。bun run typecheck原9234→8171c3实际0；Node --max-old-space-size=8192 node_modules/vite/bin/vite.js build --config vite.config.ts --outDir本批ui-after原99544→13e868实际0，56.27s，保留现有chunk警告。formatter仅本批3源路径/实际hunk，未触碰原基线差异。

本批共15个真实HTTP故障输入请求，0 real Sol。Provider/ProviderLLM、后端公共合同与消息均未变，本批目标是已接受响应的UI观察寿命；B13实际9次Sol只保持其原批次资格，不算本批新验收。项目Config、泛认证、registry/models刷新同语义入口已实现且有局部合同/源码影响审查，全部在途桌面矩阵尚未完成；未宣称其它窗口/CLI、15秒超时后才提交或完整Task/Mission/Session容量/重启矩阵通过。没有新产品文案，本次视觉核验为桌面英文Providers区域；现有当前语言摘要和原诊断保真保持。

原输入、全部原图、每轮完整完成日志gzip、物理退出/pair清理、正向检查输出及逐请求route事实归档至specs/artifacts/2026-10-14-provider-test-lifecycle。仅当前收集的已知假凭据可以声称扫描，不能反推未保留的历史秘密已扫描。首catalog失败、默认Git输入失败、错过竞态和两次超时窗口全部原样承接，不把它们压成成功。当前生产修改及结果尚待范围commit、fresh上游合并和本任务normal push实际回执；不创建Release/tag/PR。
