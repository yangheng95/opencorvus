# 持续迭代第七批：模型数量与服务商搜索计数

## Recall

用户要求持续分批并行体验 UI/UX（User Interface/User Experience，用户界面/用户体验）、功能与缺陷，直到明确停止；每批根因/影响先落盘specs，再实施、真实桌面交互截图人工复核、聚焦正向功能测试、必要且授权的GPT-6.1 Sol端到端、范围提交、fresh fetch/merge upstream与正常push，再下一批。上一批92d6025bf修复Venice计量和共享后台停机，原push exec88512实际exit0、全部hook通过，远端包含该提交及并行已有72测试289断言验收的e08017392。主agent复核其文档/规范数据后另重跑24项停机交叉检查63断言、原exec67460 exit0。当前HEAD/origin/main/ls-remote均e08017392。真实Sol-05、所有自有UI/原生scope已物理退出，复制凭据与模型目录已清理；上一批实际交付回执与push/交叉日志复制到本批artifact，不以标题或模型自述作为证据。

开始检查git status，当前仍有其他任务的MCP、Session/Task、Explorer、电子表格补丁、共享两语言/07-panel/索引、压缩及非UI数据测试改动；保留全部，不新增branch/worktree。已保存相关共享差异，最终只暂存本批具体hunk。两个既有一层只读分工、禁止再委托：UI分工复核全部数量句、当前tc与0/1/2真实合同；功能分工核验catalog/config所有生产入口、scope和可见集合。两者均未改文件、运行UI自动化、调用模型或凭据、操作用户实例。主agent负责实现与真实页验收。

主agent已读ProvidersPanel/ComposerModelSelector/UsagePanel、utils/i18n、en-US/zh-CN、config-load、provider-refresh/form、Provider operations、ModelsDev schema、provider.buildState、project /provider与global/providers，以及06-provider/07-panel、第五批地址合同、第六批延期调查和实际截图证据。全仓搜索provider.models.count/count_one、provider.form.discover.success、usage.models_count、provider.search.count及同义消费者，只有当前五处数量显示与Composer旧分支；ConversationTurnControl单模型显示实际模型名不属于数量句。失败的猜测路径已用rg --files/源码搜索定位再读，不把读取失败算覆盖。

## 根因与影响

第五批真实英文设置截图已显示“1 models”，当前代码仍一致：ProvidersPanel935/967直接t固定复数，Composer521独立三元选择count_one，Discover591和Usage609固定复数。成熟tc117读取同一键的one/other对象，既有ReleaseNotes/MissionSkill等已使用；当前只支持中/英文，不需要新增复数工具或改变全局helper。Discovery还把成功数量预翻译存入formNotice字符串，渲染1396不能根据当前语言重算；状态应保存真实count，再渲染翻译，保留现有所有退休点。页面切换是否保留该draft待实际交互核对，不凭静态存储推断可见旧语言已经复现。

Provider.buildState364–450把config.provider按key并入当前database，project /provider76–86、global/providers611–625再按key合并connected。config-load以实际authority/directory/sequence写入appStore。Panel957–959渲染目录行时过滤无效条目并排除custom同ID，983分母却直接config custom数量加完整catalog长度；正常目录下多算量为交集大小。仅改为catalog.length仍错误：custom只过滤disabled，可被enabled排除或在目录局部失败时继续编辑。应让未搜索的实际custom/catalog行集合供给渲染与计数。外部目录schema未强制record key等于内部id，不能宣称任意目录ID唯一；本批没有异常目录实例，不新增归一化规则。

顶部Configured=全部config声明ID∪connected ID，含options-only/disabled配置；Catalog=HTTP完整增强目录，含custom重叠项。这两个population与下方可呈现行不同，保持各自事实。connected也不代表本次联网认证成功：配置、环境、已存auth、autoload均可产生投影；零模型config只从connected移除。认证方法清单、连接测试状态和已存key标签各有原owner，本批不改变其含义。

影响全局/项目设置custom与目录行、搜索全部/单行/零结果/清除、enabled/disabled声明、目录展开、Composer过滤后1/2模型数量、Discover成功1/2、Usage实际唯一模型集合。Discover零ID是ok:false明确错误，不造0成功；Composer零匹配是no_matches，不造0模型组；Usage零记录没有Provider行，不能虚构0-model统计。静态当前最早65d0bfc98已同时有排重和重复分母，后续状态/表单改动没有统一它；最初引入决定未知。无调度/唤醒/恢复/终态异常线索，不改这些共享机制；发现真实异常立即横审。无API/schema、模型路由、认证、账本或依赖修改，根因限当前UI派生行与翻译数据。

## 实施方案（产品修改前）

1. 先用独有无真实凭据生产backend `/ui`与Node私有前端取得当前实页证据。声明独立ModelsDev目录必须有opencorvus/kilo的当前必需项，另外使用明确本地目录1/2模型及custom0/1/2模型数据；所有metadata经当前schema、production catalog/config HTTP投影，不造DOM或拦截UI请求。英文model/中文模型覆盖所有数量行，记录当前N/(N+C)、独有ID单行及实际HTTP/config。用真实本地/models和SSE（Server-Sent Events，服务器发送事件）参与者完成Discover和必要Usage数据，协议样例不是在线供应方推理/账单；不发送聊天或复制真实凭据。
2. 把provider.models.count、provider.form.discover.success、usage.models_count改为现有one/other目录对象；五处消费者统一tc，Composer旧count_one目录/判断同步删除。Usage占位符统一为count。Discovery唯一success state从预翻译字符串改为number|null，只在当前response ownership确认后保存真实count，沿用reset/start/edit/save/cancel/invalidate的null退休，渲染时tc；不另存一份文案。原错误与数据owner保持，当前语言及0错误边界真实复核。
3. 将当前custom/catalog映射各自整理成未搜索的行memo，保留原valid/custom排重、状态、模型摘要、排序；由它们派生查询行，分母仅取两份原始可呈现集合长度，分子和For仍用查询结果。不得增appStore计数、backend计数、第二个catalog、通用service、特殊LLM gate或额外配置。保留Configured/Catalog口径、信息架构、密度与交互。
4. 不新增、修改或运行UI自动化（包括源码文案/DOM/组件/截图断言）；本批仅UI派生/翻译，不添以实现镜像为目的的非UI测试。真实全局/项目作用域：0/1/2设置、model/模型全部匹配、独有ID1/N、无匹配0/N与清除、enabled排除仍可编辑custom、目录展开；Composer2→过滤1→无匹配→清除→选择并重开；Discover实际1/2成功及0明确错误；Usage无数据、真实一/两模型Provider、中英文与周期切换。主agent查看目标截图并按结果迭代、重新截图确认。类型/i18n/Node build/docs只是辅助；没有页面和截图则未达成。无模型能力或路由改动，真实Sol不适用此UI数量验收，不冒用上一批Sol通过作为本批证据。
5. 更新当前07-panel、双语未发布日志、根/月/artifact索引，运行当前docs checker。所有自有tab正常关闭、生产stop原exec实际退出与PID/port回执；保留用户进程。范围清晰标准Git提交、fresh upstream merge、完整待推送集合和必要验证、正常push，持续goal active。

## 修改前状态（实施前落盘）

静态根因/影响、全部定义/调用/同义合同及分工反馈已复核，方案已落盘。产品源码尚未修改。修改前独有生产scope PID27624 / occurrence 3fc08ca4-dd42-4a1d-a3c4-4bea9153d40a、端口18576与本地参与者49210：project `/provider` HTTP200投影8条（4 custom），真实页面英文model搜索8/12；通过应用Back to app→New chat自然退休项目上下文，再进设置，全局HTTP200目录7条（3 custom），真实搜索7/10。Local one单行1/12及1 models、实际GET /count-one/v1/models后Discovered 1 models、真实三次本地stream→用量Provider count-one 1 models / count-two 2 models均人工查看并截图保存。目录必需opencorvus/kilo0模型，catalog-one1/catalog-two2，自有custom0/1/2；项目另有1模型。实际账本3次75 Token，不是远端推理或实际账单。已正常关闭自有tab15，以stop-requested结束自有服务，原exec92554实际exit0；未操作用户实例。实施与后态待执行。真实在线目录、凭据/LLM推理、所有异常外部目录与所有加载失败组合不属于当前证据，保持未知，不扩大宣称。

## 实施与后态验收

实施复用tc，三个目录键统一one/other并删除Composer旧count_one；五处消费者完全迁移。Discovery唯一成功state保存number|null，所有失效/reset/startEdit/discover/save清理点及ownsResponse保留。Custom与catalog各一份未搜索映射，查询行和分母从同源集合派生；原过滤、模型摘要、状态与排序保持。Configured/Catalog仍为声明/connected并集与完整目录投影。全仓复核无旧消费者；两分工再次只读review无阻断，主agent逐项复核代码与真实页。

后态常规生产scope PID82204 / e28cf77e-0c34-4107-894f-b0e830df2e81、端口18576 / 56619，原exec67965实际exit0。Node新构建页面：项目英文model/中文模型8/8，英文单行1/8、无匹配0/8、清除恢复4custom+4catalog；新对话自然退休项目后全局中英文7/7，Configured3/Catalog7保持。真实GET发现1/2分别正确英文单复数、中文1；零ID显示ok:false当前错误反馈。目录单模型展开仍提供原保存Key入口。Composer 1/2分组→owned-dual-a过滤1→空结果→clear→选owned-dual-a→重开selected事实，中文1/2、过滤1且selected保持；未发送聊天。真实本地三次stream使生产账本count-one1模型/count-two2模型、总75 Token，后态英文/中文正确，用量Today/This week/This year自然周期切换保持。

额外独有edges生产scope PID81284 / 5476d1e3-947a-4998-bd79-d28a1393674b、18576 / 57332，原exec55980实际exit0。全局enabled=[count-two,catalog-two]、disabled=[count-zero]，HTTP200活动目录2条；项目可呈现3custom+1catalog=4/4，Configured4/Catalog2；全局2custom+1catalog=3/3，Configured3/Catalog2。被enabled排除的count-one仍按当前合同编辑，disabled声明继续计入Configured；全局单项1/3、零结果0/3、clear恢复完整行。该独有实例未产生stream，生产Usage200为零账本，英/中文真实Provider无用量状态经截图复核。没有造0-model Composer组或0-ID发现成功。

全部目标截图由主agent亲自查看，受控数据经过正常backend与真实页面，没有UI自动化、测试断言、页面脚本写状态或请求拦截。辅助原命令：overlay tsc --noEmit(exec87997 exit0)、check:i18n(2locale/2199key exit0)、Node ui-before(exec23863 exit0)/ui-after(exec80458 exit0)、bun run docs:check(348ops26groups exit0)。修改属于UI派生与翻译，不改非UI服务/函数/schema，没有新增镜像实现测试；正向功能路径为实际生产HTTP发现/目录和stream ledger，实页是UI验收依据。本批未调用真实Sol，不以旧模型通过证明本次。命令包装归档首次把global.catalog当作global.all读取而报错，已依据真实global响应形状修复并重跑，未记为通过；真实页交互曾猜错今日/新建对话的名称，随后从实际状态读取今天/新对话继续，属于操作器定位错误，不是产品缺陷。

语言通过Appearance设置切换必须卸载Provider页，旧发现draft自然退休；因此没有声称已观察到同一draft的旧语言故障或连续语言响应，源码数值归属与渲染读取localeSeq是局部合同证据。tc仍直接String(count)，1000以上本地化数字分组尚未修复，本批0/1/2未覆盖此边界。所有异常外部目录/加载失败组合仍未知。无调度/并发/唤醒/恢复/终态异常；三scope正常生产stop后原execexit0、PID/四端口均释放，未关闭用户进程。

交付前更新07-panel单一当前契约、根CHANGELOG双语未发布条目及根/月/artifact索引。证据目录保存三scope初始HTTP/账本、实际GET路径与模型、owner/occurrence/exit、源码准备器与检查日志，归档移除配置中的API-key值。当前并行Main已含其他已提交工作；只暂存本批组件、翻译具体hunk、文档具体hunk和独有证据，不混入其他修改。范围提交、fresh fetch/merge、完整待推送集合与正常push待执行，持续goal active。
