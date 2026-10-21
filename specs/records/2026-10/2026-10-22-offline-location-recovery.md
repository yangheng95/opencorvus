# 离线启动链接与首次连接恢复

## Recall

515继续单开发 agent，不委托；后续用户单 agent 要求覆盖长期 Goal 旧三Astra文字。514为 progress：b36a57b8991ea3775166a4cb6be6c94d2a69b372 已正常推送、fresh HEAD=origin/main/0差异；十张真实图、历史决定语义修复、完整hook、原90表156566行/schema3/canonical保持。原48411/82784与页面102/103/104均完整结算，模型0且无授权副本。开始只有原 .bun/ 与 packages/opencorvus/bun/ 未跟踪，保留。

用户要求持续自主找问题、修复、真实内置浏览器体验后提交推送。本轮检查打开 Task 链接时后端离线、首次恢复健康后原意图是否恢复，同时覆盖已有正常工作区重连与用户显式改选。继续已应用 computer-use 与 benchmark-debug-template；不操作用户18571/真实用户数据库，不新增/运行 UI 自动化测试。

## 修改前分析

已读 initApp/restoreInitialWorkspaceLocation/restoreInitialWorkspace/loadInitialData、connection 的真实健康检查/可见期 monitor、monitor-tick 单轮排他、connection-projection 的原 authority/selection fenced hydration、main 唯一 initApp 调用与 restoreClientLocation/onConnected、settings workspaceEpoch、ServerConnectionSettingsGroup/浏览器真实设置存储、workspace 导航入口。全仓搜索函数、回调和调用点；Task 显式定位通过原 global 索引/selector，Chat/Mission/launcher 通过 main 原导航 owner，所有入口共享 WorkspaceLocation 解析和 init 生命周期，不能另加一条重连路由。

可疑差异：正常首次健康会先恢复 initialSearch 的显式位置，再加载对应工作区并调用 onConnected 聚焦 Task；首次检查失败后的 monitor 回调先默认目录发现，再仅 restoreInitialWorkspace（已保存选择），并不使用 initialLocation，也不调用 main 的初始 Task 聚焦。默认目录发现可进入无目录首页。510只修正常首次健康与失效启动根，未实测首轮离线；原 monitor 在初次离线后仍会注册，不能误报为所有离线都不监控。此时仅代码线索，真实问题/错误位置/用户导航取消边界仍未知，先实页复现，不开始生产修改。

潜在影响为所有显式位置类型（Task/Chat/Mission/launcher）的第一次健康恢复，不能把 Task 用例通过当全部分支资格。普通同一文档 Task/Session SSE（Server-Sent Events，服务端事件流）继续由现有 stream owner 恢复，内核 Task/Mission/Session 调度、occurrence（执行轮次）、重试/终态/项目隔离不预期改变；若发现实际调度/恢复/终态异常，立即沿共享机制横向审计全部生产入口、正常/终态、重试重启、串并行/多项目，不能用单例排除共享根因。

不修改 API、SDK、schema、持久格式、模型/凭据或服务端权限。若修复，必须在实际证据后补根因与方案，使用现有 API authority、init generation、workspace/selection owner 保证用户改选优先；首次恢复消费原启动意图，后续正常重连不能拉回旧链接。不能用隐藏状态、合成消息、后备路径、假网络响应或无界重试遮蔽。

## 启动前验收与资源边界

采用真正分离的自有前端/后端服务：前端A始终通过源码开发 /ui 提供正式资源，在原设置页面只把自有服务URL改为暂未启动的后端B；用户名/密码不改，不复制auth/models。用真实页面导航载入原Task链接，B确实没有listener而非拦截/伪造HTTP；随后启动B，观察原monitor和真实请求/页面恢复。跨源只用两个自有loopback端口，不改系统网络或用户服务。

固定零模型 scopes，均原生20分钟、启动180秒无活动边界，源库完整只读serialize：

| scope | 端口 | 用途/源 |
| --- | --- | --- |
| before-ui | 18963 | 正式 main-WG2_rq1Y；源已关闭514-after |
| before-api | 18965 | 首次真正上线；源已关闭514-after |
| after-ui | 18967 | 条件修复后正式Node构建；源已关闭before-ui |
| after-api | 18969 | 首次真正上线；源已关闭before-api |
| after-api-restart | 18969 | 前一个API完整结算后新occurrence；源已关闭after-api |
| after-api-session | 18969 | 再次完整结算后新occurrence；源已关闭after-api-restart |
| after-api-supersede | 18969 | 最后一次有限恢复；源已关闭after-api-session |

每次端口复用前必须先公开shutdown并join原native/输出/request/launcher/精确出生链，使用新runtime/diagnostic根和完整原数据副本，不重启活跃模型或重置预算。after四API阶段最多各启动一次，不无界添加scope；所有scope最大/实际模型都为0、没有凭据和模型目录副本。前端A保持原occurrence，不能靠刷新冒充同文档正常重连。

验收顺序：before对原511 Task链接离线冷启动→B上线观察真实结果；证实根因后实施。after重做同一正向恢复；改选另一个项目的真实历史Chat，停原B并换新B验证普通重连保留当前选择；再用已捕获的真实Chat链接离线冷启动验证Chat首次恢复；最后离线载入Task链接、由用户动作“新对话”改选，再上线验证旧意图不会覆盖新选择。Mission/原生WebView2无本轮实页资格，代码审计不能冒充视觉通过。没有新Task/Goal/Provider执行。

UI仅真实控件/导航/截图人工复核，DOM只读观察无断言；无UI自动化/源码文案/组件/fixture测试。修改后正式Node构建、Overlay类型/本地化及必要的当前文档/架构检查；非UI变更如产生独立数据契约，补聚焦正向测试。归档最小真实请求和页面证据，不收录数据库、原行私有快照或秘密。

全部实际scope原物理链、页面、模型0和90表原数据/schema3/canonical/source bytesmtime结算；实际秘密值扫描、更新三索引、范围提交、fresh fetch/merge/待推集合审查、正常push/hooks/fresh相等。不创建分支、worktree、tag、PR或发布。长期Goal active。

## 真实复现与横向审计

before-ui18963/原40607/IAB105，真实设置只把 Server URL 改到18965，未触及用户名/密码。载入原 Task511 链接后01图实际 Offline，原URL保留；系统监听观察B为空，随后真实启动 before-api18965/原41759。02图已经 Online18965、原Task在列表，而主区仍首页；稍后19:29:31Z只读观察 document.visible、data-empty-chat-home=true，地址仍携带原taskID。03真实手动点相同Task立刻打开 Completed 与原正文，home=false；所以不是数据缺失、跨源失败或Task不能打开。两原scope公开shutdown200、原exec exit0/native输出/request/launcher/精确出生链结算，105关闭，无模型请求。

根因是 initApp 两套健康后流程：正常初次消费 initialLocation，并经 onConnected 聚焦Task；重连先发现默认目录（本例无目录返回loaded=false），只恢复已保存选择且不经初次聚焦。首次网络失败因此跳过了仍有效的输入。URL本身未丢，不能把它写成清空URL的bug。旧510仅覆盖原健康首次入口。

进一步横向搜索全部 checkConnection 与 refreshConnectionWorkspace：除init/周期monitor外，连接设置保存会自行健康检查并刷新，workspace.applyDirectory也有健康探测。全仓只有main一个initApp、init一个startConnectionMonitor，generic monitor只有connection生产调用和纯控制合同测试。当前monitor把全局appStore.connected当作恢复完成：外部探测先置Online或初始化数据失败时，下一次健康探测可能不触发尚未完成的恢复。初次健康分支抛错还会跳过monitor注册。这里不把传输健康伪报Offline，也不另建初始化/重连恢复实现。

实施方案：原init closure保留一个可消费的initialLocation输入和一个工作区恢复完成receipt；首次与普通重连共用唯一recoverWorkspace。原显式位置只在原selection/workspace epoch仍拥有启动意图时消费，成功首次生命周期之后退役；用户导航/切换后端都通过现有beginWorkspaceSelection/Departure改变epoch，不能被旧输入覆盖。Task经原global索引/selector和main初次聚焦；Chat/Mission/launcher仍经同一restoreClientLocation。既有saved-restore、API authority/init generation、状态错误和真实参与者不变。monitor在初次尝试的finally注册，仍沿原10秒可见期单轮探测；generic monitor增加必需的recovery-complete谓词，同时满足真实网络健康和原工作区receipt才算已恢复。恢复失败保持receipt未完成，下次真实健康探测重试同一owner，不改全局健康事实或增加轮询器。

正常/终态Task和Session读取、Mission父会话入口、saved/显式/invalid/launcher、首次/后续、重启/credential authority/目录切换/用户改选均按原owner审查。后端Task/Mission/Session occurrence和调度队列不参与该客户端导航；无Prompt或执行，原持久化与实际请求用于排除新内核终态问题。不同项目的Session切换与后端新PID复验用于检查最新选择隔离；Mission和原生WebView2仍不冒充本轮实页通过。

测试影响：遇到现存monitor-tick.test.ts中的“不检查/不回调”负向核心用例，先删除这些过期负向用例，不运行它们。该文件只测独立传输控制函数、不含DOM/组件/文案或浏览器fixture，保留/重写为明确探测/恢复receipt、错误契约与串行事件的正向合同，并用真实自有loopback HTTP检查pending恢复，不能把它当UI端到端资格。新回调接口无兼容分支，更新唯一生产调用和全部相关控制测试；UI入口只用真实页面人工验收。

## 实施与验收结果

生产唯一recoverWorkspace实现已落地：可消费initialLocation保留首次输入，workspaceReady只代表该owner已完成恢复，不替代健康状态。首次显式恢复在默认目录发现之前，经原selector及onConnected；普通重连沿原当前工作区刷新。原API/init generation及selection/workspace epoch保护仍在，用户改选使旧启动意图退役。monitor必需的isRecoveryComplete由同一初始化owner提供，初次尝试finally注册；没有全局新订阅器、第二轮询器、持久标记、合成消息或权限变化。

先删除旧负向用例，再以最初六个正向控制合同真实跑出4通过/2失败：外部探测已置Online但恢复未完成，以及恢复失败后重试的明确receipt失败。修复后六项通过；再补当前/后继owner交接的明确最终receipt，最终7通过/11断言。包含真实Node loopback HTTP而非UI假响应，其余是局部控制合同，不冒充真实网页。原隐藏、停止和稳定连接“不调用”测试未运行/未保留；单轮串行事件、探测错误、恢复错误、PID替换及后继owner都有正向结果。Overlay typecheck、i18n2529键、docs345操作/26组、architecture20文档通过。正式Node构建7313模块/54.51秒/main-DhV28lza，原依赖与大chunk提示保留。

after-ui18967/原5056/IAB106，真实设置指向尚未启动18969；04为原Task链接Offline，after-api原5282上线后05在同一冷启动文档自动进入原Task Completed和正文，home=false，无手动选Task。随后真实点击另一项目的Chat；06截于选择尚未结算时，URL仍旧Task，07才是完成后的准确Session链接及原OK正文，未把过渡态当完成。所选为ses_hQ3FfPiEUHmcbvhsNsTE、experience=chat，目录为原511-preflight的47a99662项目，与Task的ebb75947项目不同。

公开关闭原5282并完整结算后，08同一文档真实Offline且Chat正文保留；after-api-restart原4438新PID上线后09仍为该Chat与原OK，未reload、未回到启动Task。再关闭4438并完整结算，沿准确Chat链接reload产生真正冷启动；10为Offline，after-api-session原45131上线后11自动恢复原Session/目录/experience和正文。最后关闭45131，载入原Task链接后在Offline实际点New chat，12链接变为launcher=chat/productPillar=work；after-api-supersede原12101上线后13仍为该新入口，旧Task未覆盖用户意图。13中的草稿是上线后才输入，不能称作跨离线保留既有草稿。没有发送消息或创建新Task/Goal。十三张保存图全部实际查看，无UI自动化测试。

七scope公开shutdown200、原40607/41759/5056/5282/4438/45131/12101均exit0，原native/输出/request/launcher/精确出生链完整结算，105/106关闭。每次18969复用之前已结算原occurrence并从其完整数据创建新scope，没有重启活跃模型、扩额或覆盖原证据。真实preserve checker七scope均90表156566原行身份/所有字段/时间差异0，schema3实际对象/integrity、完整canonical及来源bytes/mtime保持，Provider activity均391→391；模型实际0/最大0，无auth/models副本。用户18571/真实用户库、schema和版本均未改变。

一个私有编排命令在成功调用PowerShell settle脚本后，错误使用仅适合原生命令的LASTEXITCODE继续判断，null导致外层提前exit0，故该次没有执行后继prepare。按实际输出识别后，仅执行尚未执行的prepare/copy，后续PS调用用Stop错误语义、原生命令单独判断exit code；没有重复启动、重置预算或把命令0当全部完成。

边界：本轮实页覆盖Task/Chat首次恢复、同文档当前Chat/PID替换与新launcher改选；Mission/WebView2、真实LLM流、所有Sources/连续帧Rendering未取得新资格。工作区首次读取被强制中断后再恢复，以及在初始读取仍未完成窗口内同时执行另一导航，未做新的完整实页场景；控制receipt重试/交接合同和代码审查不能冒充这些资格。继续保留长期Goal。归档会压缩原构建日志及重复原始结算/数据检查记录，逐字节保留原内容并扫描解压后的实际秘密值；可读摘要仅由原事实生成，不用摘要或可变源码hash替代功能验收。

最终实际日志观察共有53个error记录，18个server失败的类型全部为ProviderModelNotFoundError/HTTP400，其余为同一config.validate/客户端配置加载或模型提示的传播，没有其他未分类error。已核对project/bootstrap.ts的config.validate及provider.ts:getModelFromCatalog：可运行Provider或目标模型投影缺失时产生这个明确错误。本轮没有绑定auth/models，不能从这些错误推断凭据有效性，也不称为数据库故障或console clean；导航/正文读取的实际资格独立保留。完整安全字段观察另存runtime-error-observation.json，最终扫描会覆盖新增观察与所有解压内容。

## 配置完整的独立复核（启动前追加）

前七scope及全部进程/页面已经完整关闭、预算0结算，原证据不改写。只读恢复已成立，但项目能力初始化在未投影目标模型时返回400，不能据此宣称模型已配置场景的完整启动。因此另开两个有限qualified scopes：qualified-ui18971/max0从已关闭after-ui克隆，qualified-api18973从已关闭after-api-supersede克隆，使用同一正式main-DhV28lza和Source CLI；不修改生产或增加新的开发agent。

qualified-api固定最多8次实际gpt-6.1-sol流式请求，包括真实预检、标题/记忆等所有辅助请求；没有业务Task/新Goal/产品成员计划，不允许运行中扩额或重新启动重置预算。先完整复制当前授权OpenAI入口与完整models.json到配对私有源，再由原stageDiagnosticProvider同时进入runtime，分别核对源不变、目标已投影、真实凭据请求可用及实际模型/stream=true/200/原source EOF。只做现有Task链接真正离线→首次上线的配置完整复核，不以模型自述验收UI。凭据值不进入prompt、日志或Git；不刷新/交换原凭据。

复用已审查504 NativeService实际Provider预检、413原生宿主、512独立物理/Provider资格/配对退休工具，去掉512网络故障观察器，UI仍只靠真实设置与实际无listener。两个scope仍20分钟原生/180秒启动无活动边界；qualified-api的实际请求只认原audit，所有辅助调用都计入8。源schema3/canonical保持，不用行/源码hash验收。新的自然预检Session/Message与正常容量租约变化按真实事实保留，不能回填旧租约掩盖运行。

无论预检或UI资格成功与否，都先join原native/输出/request/launcher/精确出生链，再独立退休runtime及私有源auth/models四成员，实际秘密值扫描全部输出，保留失败的资格和真实请求计数。结束做独立数据保留观察，原前七scope仍各0，新增批次总最大8。只在这些完成后范围提交和正常push。

## 独立复核结果与交付

qualified-ui18971/原14464/IAB107先经真实设置指向尚未启动的18973，再载入原Task链接；14图为真实Offline。qualified-api原49642以完整配对auth/models启动，原NativeService预检确认credential usable、catalog projected、实际gpt-6.1-sol/stream=true。15图在同一文档首次健康后自动进入原Task Completed与原正文，模型显示openai/gpt-6.1-sol；没有手动选择Task、业务新Task、Goal或新增成员。两张保存图实际查看。实际158条完成请求、全部runtime error和浏览器error观察均已归档，本次error为空，不能据此改写先前七scope的53条配置错误。

新增预算实际2/8，全部原Provider reader为200/EOF，未扩额或重启；未用6次额度退休。两scope公开shutdown200，原14464/49642均exit0，原native/输出/request/launcher/精确出生链完整关闭；107已关闭。runtime auth/models两成员与私有源两成员均在物理结算后退休，原auth access/refresh、完整catalog bytes/mtime保持。退休阶段实际扫描100文件441678047字节0秘密值命中；该复用脚本另检查了512记录，最终交付扫描另明确覆盖当前515记录、所有交付文件及全部解压内容，不将旧记录扫描冒充当前记录扫描。

独立真实SQLite检查仍为90表156566原行/schema3实际对象/integrity与完整canonical、来源bytes/mtime保持。qualified-ui所有原字段及计数相同；qualified-api仅两个原runtime_execution_capacity_lease行的lease_id、owner_id、time_acquired、expires_at自然更新，未回填旧租约。真实预检新增1Session/2Message/4Part、1项目与记忆、相应事件/总线/控制和usage记录，完整增量表见qualified-data-summary.json，Provider activity391→392、两次实际Provider请求均计入审计。除上述容量租约字段外，原行身份/字段/时间全保留。模型预检只证明配置和真实流式调用，不能替代业务Task/成员实时Rendering资格。

正式资源与生产代码未在补充复核期间改变，7项控制合同、类型/本地化/构建资格继续对应同一main-DhV28lza。最终docs:check345操作/26组、architecture-index20文档复核通过，生产/测试/索引/架构差异检查通过。实际秘密值扫描与原物理/数据观察一起归档；范围提交和正常Git hook/push以真实Git状态为交付事实，不提前宣称远端完成。长期Goal保持active；当前用户18571服务未刷新或重启，使用新代码需要该服务后续正常加载新构建。
