# 记忆页响应真实项目元数据更新

## Recall

用户要求持续迭代直至明确停止；本人独立，不使用子agent。每批根因/影响分析先落盘，真实开发/ui与本人截图、聚焦正向功能检查、范围提交、fetch/普通merge/全待推集审查/正常push后继续。前批966e2289b已正常推送全部hook通过，HEAD/upstream0/0，原177条工作区状态保持。Sol/Provider凭据授权仍未收到，零认证/模型调用，不重复问、不读取或复制模型/凭据文件。

前批已验证同页语言排序/选择/目录与原主项目保持；其可选核验错误要求mutable timeUpdated恒定，已删除该无意义假设并按不可变创建/实际Project归属/content/revision重跑。正常配置可推进availabilityGeneration/timeUpdated，不能据此报调度故障。本批不重新引入该门槛。

已读MemoryContextPanel全源/新locale memo/原异步load/所选对象与文档scope、唯一ConfigDialogHost调用、App挂载、work-ledger服务raw load/runtimeRows索引、SSE（Server-Sent Events，服务端事件推送）全局WorkLedger入口/当前authority与handle检查/单一handler/重连/stop/独立Mailbox订阅、main唯一注册/清理/Task/Mission消费、唯一纯服务work-ledger-notification-stream测试、backend project PATCH/Instance.refresh、WorkLedger全局Project事件生成/共享transport-protocol schema。全仓singleton setter调用仅main和该服务测试，未检索到相关UI（User Interface，用户界面）自动化；现测试为纯HostTransport/实际handler数据合同，不是组件/DOM/浏览器测试。

## 修改前根因与影响分析

待真实前态确认：记忆页已加载/选择李四，在同一隔离服务通过正式PATCH把该项目改名Beta；若后台响应与原生WorkLedger事件已证明更新，页内仍旧名，而正常重进后才新名，则为读快照缺少真实更新入口。现projects只在API authority变化时加载一次，locale memo只重排同一原snapshot；SSE当前只有main一个可替换setter，Memory没有订阅。前批只修语言派生，不负责数据更新；从global runtimeRows按有无覆盖本地customName会形成不完整分页名称的双源，不能作为修复。

拟使同一现WorkLedger物理流支持自然多个消费者，替换单一setWorkLedgerChangeHandler为返回清理函数的subscribeWorkLedgerChanges，删除旧setter/变量路径，同步main与唯一服务测试。原main仍注册一次、Task列表通知仍在分发前只处理一次，Mailbox现逻辑保持。最后订阅退出时正常关闭原流；authority/handle/重连所有权和真实事件schema保持。各消费者错误独立原诊断，单个消费者异常不阻塞其余真实消费者；不增第二连接、轮询或伪事件。

Memory仅对真实connected/project.updated触发同一个目录全集load owner。raw projects仍唯一数据来源；loaded authority仅标记该snapshot归属，scope切换清空旧数据，同scope刷新保留当前数据直至新成功提交。每轮原AbortController/onCleanup退休旧读，不能由旧响应改写新快照。原所选对象升级为唯一selected key加纯成员派生，使用现optionValue=key；刷新按当前真实key保留选择，初次按现activeProject默认，目标缺失则明确无选择，不偷换其他项目。提交raw snapshot与selection使用现Solid批处理。错误继续原明确反馈/清空契约，不建立旧数据后备路径。

文档和Notes读取改以所选directory的纯memo为scope：名称/语言变更不把同目录误作新资源，也保留原搜索输入。刷新有已加载项目时允许继续使用当前控制，当前选择在新数据发布时按key验证；冷加载/新authority仍禁用。目标是完整真实新名称与保持真实选中资源，不是重开页面或本地编辑名称影子值。

影响面为内部sse订阅接口/全部main与服务测试调用、Memory当前项目读取/选择scope、当前07-panel及07-panel-reactivity相关合同。共享后端Project.update、事件schema、协议顺序/Task/Mission/Session occurrence（执行轮次）事实、模型流式路径、公开API（Application Programming Interface，应用接口）/SDK（Software Development Kit，软件开发工具包）/数据库结构及持久格式不改，无迁移。Typed sourceType等于已声明project.updated是事件契约，不解析文案或LLM（Large Language Model，大语言模型）意图。

### 共享机制审计边界

WorkLedger同一通道承载Task、Mission handoff、Session、Mailbox及Project元数据，必须保持一次生产通知与正确当前connection归属；main注册、任务列表通知、handoff、心跳过滤、其他消费者、重连/停止/最后清理均纳入本次源码及服务合同检查。不改变后端调度、队列、唤醒、运行终态或跨项目执行轮次，当前未观察这些异常；若真实运行出现相应异常，按全共享机制要求继续审计，不以此局部项目页定性。

风险包括注册覆盖main/重复任务通知、一个listener异常阻断其他、旧连接迟到事件、组件清理误停其他消费者、分页刷新丢失选中项、异步旧响应覆盖、名字更新误清空文档/笔记查询及重连遗漏离线变化。先完成真实前态后才实施；若原页已自动更新则排除假设，不为满足计划修改产品。

## 验收方案（修改前）

Temp b39 before/after各三个真实Git项目Alpha/李四/张三，私有Git配置/身份/禁签/autocrlf=false，seed记录六份原文/HEAD；通过原领域注册，无Session/消息/模型。before38998开发/ui加载Memory并选择李四，公开PATCH原目录/ID改Beta；独立真实SSE客户端先收到connected，再观察与PATCH回执一致projectID/directory/sequence的project.updated，用唯一WorkLedgerEvent schema解析。该额外checker是独立客户端，不将其称作浏览器第二条流。本人截图旧label/正常重进后newlabel，区分事件未达与组件缺订阅。

after38999 Node构建新UI；同场景真实改名立即新label/菜单排序/目录和笔记查询保持，中英往返与原主项目保持。纯服务正向测试覆盖同一实际运输分发入口、多个订阅/错误消费者隔离/一次物理流/当前authority与正常清理；mock HostTransport仅局部合同，不能替代真实SSE和页面。禁止UI自动化/源码文案/DOM/组件/快照/浏览器fixture测试。

需要时用本人正常shutdown、离线领域更新未选项目Gamma，再启动同一自有profile/port，实际connected后的页面恢复新全集并保留当前选择；不刷新或重启用户服务。原notes/Git和配置清单保持，真实公开API/原生事件/截图与正常退出均记录。若重连或投影收敛异常须追查公共owner，不能以超时绕过。模型/权限/Task/Mission执行恢复仍未验，不把UI连接恢复扩大为引擎端到端。

辅助typecheck/i18n/正常Node build/renderer/docs/architecture。范围提交自身文件/spec/artifacts及3README本条，fetch+普通merge/待推审核/正常push，不创建branch/worktree/tag/Release，不操作用户窗口/进程/凭据。

## 未达成

本批已完成下述真实项目更新/恢复与范围验证；Sol/完整模型链路、空目录索引、历史计划/子树删除等旧线索继续独立未验。引擎Task/Mission/Session执行恢复未验，不能由本批UI连接恢复推断。


## 前态确认与实施定稿

38998/IAB84选李四并在Notes搜索框保留未提交keep-this-query，01真实截图。独立实际SSE客户端先收connected，再正式PATCH原Li目录/ID，HTTP200/requestID b95280e4-5c3b-485a-8f15-8fad09cae06a/name=Beta；原事件sourceType=project.updated、projectID prj_hGEiheFVqvFWvJLZxI5b、原目录及sequence1794173537314与该PATCH回执time.updated精确一致，Project响应运行时/doc/Ajv2020与原WorkLedgerEvent schema均通过。不是根据名称或模型自述猜测更新成功。

02同页仍旧Project李四/原目录/原查询，03菜单仍Alpha/张三/李四；正常离开General再回Memory，04才Alpha/Beta/张三，且默认选择回Alpha。全部4图本人呈现查看。说明是真实Project事件已有、当前组件缺少更新入口，不是事件漏投递、名字编码或后台改名失败。页84关闭，36921正常shutdown200/原session exit0/prompts0后实施。

进一步审计MemoryPanel唯一scope effect：其直接读取props.directory/active，任何新对象依赖或active切换都会清除查询和重新加载。故本批选择fact改为key+原raw成员派生，selectedDirectory单独memo以保持同目录身份；后台刷新已有options时保留可用控件和MemoryPanel active，实际loading事实仍按原标志记录。响应后读取最新选择key，使用[Solid batch](https://docs.solidjs.com/reference/reactive-utilities/batch)原生批处理发布新raw/选择，避免受控Select短暂不匹配。新authority清空，错误沿原清空/明确反馈，当前API owner检查与AbortController仍唯一退休机制。未提交查询不会调用搜索/embedding，未做模型或凭据请求。

共享订阅接口将替换旧singleton而非保留兼容setter；main/唯一服务测试所有调用同步迁移。服务测试只覆盖真实运输dispatcher的局部多消费者/生命周期合同，完整前态失败证据是上述实际HTTP/SSE及本人实页，不制造“新函数不存在”的负向测试或把import失败当根因。后端事件生产者、schema和Task/Mission/Session调度入口不改。

实施复核补充：Solid组件prop getter会把内部读取的原信号传给子effect，仅让`!loadingProjects || projects.length>0`值同为true仍不足以隔离刷新依赖。因此MemoryPanel active也通过纯memo发布真实布尔可用性，和selectedDirectory一样仅在语义scope变化时通知原清理effect；没有额外布尔state或第二数据源。此处保留输入的资格仍须真实改名前后截图验证。


## 实施结果与真实验收

原单handler已删除，以同一物理WorkLedger流的多个独立订阅替换。main原消费者与Memory页各有清理owner，Task通知仍只分发一次；一个订阅抛错不截断其他真实消费者，原authority/handle防迟到保护、重连和Mailbox路径保持。raw项目全集仍由原分页load读取；当前选择唯一key，名称排序/成员对象/目录/active均从原事实派生。后台刷新保留同scope控件，批量发布新数据并按最新key验证当前选择；所选目录不变时不重置MemoryPanel查询。新API authority/明确load失败仍走原清空/反馈，未建立后备名称或轮询。

after38999实际PATCH返回200/requestID fcb995b3-0734-46c4-acad-2f465584a036，原Li项目prj_h4zIW31CpGSorqd81jMj改Beta，实际project.updated的原目录/ID/sequence1794174362861与该回执一致，原运行时/doc与WorkLedgerEvent schema均通过。05选李四/原目录/未提交查询；06实时Beta/原目录/keep-this-query；07新菜单Alpha/Beta/张三且Beta选中；08中文排序张三/Alpha/Beta；09回英文Alpha/Beta/张三，查询仍保留。本人全部呈现查看，不以DOM文字代替截图。

正常shutdown自己的38999进程后，10实页显示backend unreachable，同时Beta/原目录/草稿保留。服务离线期间使用原Project领域入口把未选张三改Gamma，原ID prj_hmbwFhKB9C27y5qvFaZp/目录不变；没有向浏览器注入事件。以同一自有profile/port启动新occurrence iteration-b39-recovered（receipt pid27544），实际流重新connected后11菜单Alpha/Beta/Gamma，Beta及原查询仍保留，无手动页面刷新。真实选择Gamma，12为正常初次Loading帧，不作为稳定交付图；13稳定revision0/0tokens/正确张三目录/正常空Notes，按新directory语义清空旧查询。14返回主界面仍Let's work on Alpha，侧栏原main消费者已同时显示Gamma/Beta/Alpha。两消费者实际并行工作，未覆盖主注册。

恢复后实际TCP四项：Project.list精确原三ID/目录与当前Alpha/Beta/Gamma，以及三目录ProjectMemory.get原content空/revision0；全部HTTP200并通过当前/doc/Ajv2020 schema。原HTTP读与后续DB可变更新时间不作为常量比较。六个Git项目原notes.txt与seed、Git HEAD:notes.txt逐字节相同，六个原HEAD精确相同；before/after各3个Project，Session0/Message0；两profile config文件0。原生产初始化创建的未跟踪.gitattributes/.gitignore/.opencorvus如实记录，没有清理或混入源码提交。

## 聚焦检查与交付范围

`bun run test:unit test/work-ledger-notification-stream.test.ts`通过2项/15断言，覆盖真实运输dispatcher的多消费者/单物理流/错误隔离/当前authority/剩余消费者及最后owner正常关闭。它使用纯HostTransport fixture，只证明服务局部合同；上文真实HTTP/SSE/手动页面才是集成证据。未新增或运行UI自动化、负向核心断言或哈希门槛。

Overlay typecheck、i18n2931项、正常Node build（1m6s，main-LXDIZF0V.js）及renderer公共面通过；文档和架构索引检查通过，提交前再次运行。未改公开API/SDK/事件schema/数据库结构或持久格式；模型/权限/引擎任务执行无本批端到端资格。未操作用户服务、窗口、凭据或发布。

before36921、after28199、recovered31256均自己正常POST/shutdown200并消费原session exit0，prompts/session/toolParts0；自有页84/85均关闭。证据14张原始桌面截图及实际回执/数据审查存对应artifact目录。提交仅4个overlay实现/服务测试文件、2份当前架构、本spec/证据与3README本条；原177条无关工作区状态按原样保留。按原流程fetch/普通merge/完整待推集合检查/正常push，结果以Git回执为准。
