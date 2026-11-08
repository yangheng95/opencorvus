# 记忆分块写入绑定原文件项目

## Recall

用户要求持续批次迭代直至明确停止，最新明确不要子agent，本人独立。前批842a19c2b正常push全部hook通过、HEAD/upstream0/0，原177条工作区状态精确保持。先根因/影响/spec（规格）再证据支持的修复、聚焦正向测试、真实开发/ui交互和本人截图、范围提交/fetch普通merge/全待推审查/正常push。Sol/Provider凭据授权未收到新答复，不重复问、不读/复制认证及模型目录、不进行模型调用。

已读Memory领域createFile/writeFile/writeChunks/内部updateFile/findByKey/FTS（Full-Text Search，全文检索）写删、全部scoped/global read/delete、MemorySearch实际SQL join、MemoryFile/Chunk结构、Database事务/NotFoundError/foreign_keys、Panel知识list/get/search/delete和MemoryTool所有动作、ContextTools读取、现02-data/07-panel/07-panel-reactivity边界。全仓writeChunks定义与调用：唯一生产调用是同模块writeFile（传刚创建或当前Project按key读取的fileID与同ProjectID），额外是search-filter-order.test.ts和project-memory.test.ts的真实领域测试；无直接HTTP/LLM（Large Language Model，大语言模型）写分块入口。历史入口来自65d0bfc98。当前上层工具传正确项目，不能从底层疑点直接宣称用户可触发漏洞。

## 修改前根因与影响分析

待真实确认的底层数据完整性缺口：writeChunks(fileId,projectId,markdown)在事务里按两ID查文件仅用来检查host-owned kind；若没有匹配file，它继续删除/插入chunks与FTS。两个独立外键仅分别要求fileID和ProjectID存在，没有验证同属一项目。故已存在Owner文件ID配Caller项目ID可能成功形成不一致chunk；MemorySearch按chunk/FTS项目筛选，但JOIN mf.id=mc.file_id，可能投影Owner标题配Caller内容。Caller须已有自己正常记忆，否则projectHasMemory早退会掩盖现象。未知fileID则可能落SQLite外键错误，丢失明确NotFound领域合同。

直接触发是领域分块函数接受不匹配父子身份，不是模型选择工具、调度/队列/唤醒/终态异常。旧代码有host文件保护但缺少查无父文件的明确分支；正确where筛选后未据结果拒绝，因此单靠SQL存在where不等于完整性。生产writeFile路径目前传正确pair，必须区分实际可复现的领域入口缺口与未证实的外部可利用性。真实前态需运行当前函数/SQLite/FTS再做结论；若外键或当前checker已明确拒绝则排除假设，不按计划硬改。

若复现，使用现Database.NotFoundError，对fileID不属于给定ProjectID（包括未知ID）在同一事务、任何chunk/FTS变化前返回明确named error；原host-owned同项目ProtectedProjectMemoryError保持。只修writeChunks唯一父身份查验，直接继承现事务，不加全局Instance路由旁路、LLM gate、备用存储或第二父事实。writeFile和原createFile+writeChunks合法调用、删除/读取和FTS排名保持。新的明确错误是内部领域契约，不是公共API/SDK schema变更。

横向审计：findByKey/updateFile/scoped getFile/getChunks/delete均按Project与file同时筛选；writeFile按当前Project key创建/读取后委托同一writeChunks；Panel和MemoryTool直接用Instance Project，不接受跨Project写chunk参数。global getFile/getChunks是独立已有基础读入口，未在本批改为另一权限协议。只读完整性审查可记录本批孤立前态产生的不一致行；用户历史数据库是否存在同类行未知，不读取用户生产库，也不删除、修写或猜测归属。当前修改不改schema/持久格式，不需迁移；不能宣称修复了历史未知数据。若后续需要历史修复，必须另有保留用户数据的版本化迁移/明确事实，不能清空数据库或静默过滤。

影响面：Memory/index.ts的writeChunks错误与事务、合法writeFile及FTS公共primitive（基础组件）、host保护、读取联接一致性、调用测试、现数据架构说明。无Session/Mission/Task执行轮次或模型流式路径变化，不改变HTTP（Hypertext Transfer Protocol，超文本传输协议）/SDK（Software Development Kit，软件开发工具包）/事件格式/数据库版本10。风险是误把合法文件当不存在、误处理host保护、事务部分变更、不同项目持久复读，以及把底层复现包装成外部端到端；用明确正向输出/错误类型/合法状态和真实数据验证，不写核心负向断言。

## 验收方案（修改前）

Temp b42 before/after各Owner/Caller两个真实Git项目，私有Git身份/禁签/autocrlf=false、原notes/HEAD seed；分别注册真实Project和正常Memory.writeFile原文。before原领域writeChunks故意用Owner fileID+Caller ProjectID写隔离探针，记录当前返回/实际SQL父子身份/实际Caller FTS结果；不改生产源码或伪造SQLite行。公开开发服务39004的/ui选择Caller并实际搜索crosschunkprobe，若显示Owner文件标题而Caller列表原父文件不同，绑定截图与实际HTTP/schema证据，明确根因是领域错pair并非UI串项目。

after须先把已确认根因与最终方案落盘，再新增聚焦正向领域测试：合法chunks/FTS输出、未知和外项目pair映射现NotFoundError准确message、同项目host文件映射Protected错误、原两项目合法内容/身份保持、正常writeFile按key更新仍同原fileID/最新内容。禁止UI自动化、mock/fixture-only冒充端到端。真实隔离生产领域checker映射错误后，正常写Caller自己文件探针并公开API搜索精确Caller原ID/标题/内容，Owner原合法内容保持；重启同profile服务39005持久复读，并实际/ui选两项目/搜索/展开原文，本人截图人工查看。该UI仅对合法数据集成验证，底层错误合同由真实函数/SQLite与测试证明，不宣称HTTP暴露了writeChunks或模型E2E（End-to-End，端到端）。

聚焦官方backend测试runner；typecheck/docs/架构/必要运行检查。前端产品未改，不无目标重建或运行UI测试；当前已构建main-XG8JNngj.js可服务真实/ui。最终核对四个原Git文件/HEAD、合法原记忆归属/内容/不可变创建时间与config文件清单，正常shutdown自有进程/原session退出0、关闭自有页。范围提交本批代码/测试/当前架构/spec/artifacts与3README本条；原177无关状态保持，正常同步/推送后下一批。无branch/worktree/tag/Release/用户进程窗口/凭据操作；历史不一致数据和Sol/完整权限模型引擎恢复仍未知或未验。

## 当前状态

已完成下述领域/真实数据/HTTP/桌面前后验证和修复；历史用户不一致数据、Sol/权限/完整模型引擎执行恢复仍未知或未验。


## 真实前态与最终根因确认

隔离helper初版漏关Instance.provide参数对象，Bun在任何模块执行/数据写入前解析失败；修复helper语法并重跑原领域验收，原失败日志保留helper-parse-failed.log，不能以此报产品失败。产品源码尚未修改。

实际before领域writer接受Owner file mem_g0VaQHI3d00Yv27kn4Gi / Caller Project prj_h5q4vT3c1rwRyzOR4wY5错pair；真实SQLite行chunk.projectID=Caller，而同一fileID的file.projectID=Owner prj_hd3vQDsJdA8oFffisoVR。Caller自己正常file mem_g0VaQHI8j00V5RmGSDRd存在，排除早退空项目掩盖。真实Memory.search返回Owner original note及Caller探针正文；这不是只看最后错误状态或命名猜因。

39004/IAB90实际Memory设置默认Caller Notes/Caller原目录，01普通列表唯一Caller original note。正式提交crosschunkprobe，02在同Caller选择/目录中显示Owner original note/探针正文/Score0.38；展开03真实当前Project的get返回API404/Memory file not found。这说明scoped get仍正确，搜索从已写入不一致数据join出另一文件标题，根因在writer父身份准入而不是UI随机选错项目。三图本人呈现查看，未注入UI数据。

五项真实HTTP（Caller list/search、Owner exact get、Caller exact get、Caller→Owner exact error）状态200/200/200/200/404，均当前运行时/doc/Ajv2020 schema通过；Owner原合法正文与Caller原正文各精确，原结果ID匹配SQL记录。错误为明确NotFoundError/data.message合同。自有页90关闭，before原session56704正常shutdown200/exit0/prompts0。

定稿：在原同一writeChunks事务查父文件后，先以现NotFoundError拒绝无匹配pair，message包含该fileID和ProjectID；再执行原host保护与原FTS/chunk替换。无schema/历史数据重写、不改搜索join以过滤症状，也不把当前生产工具的正确pair替换为另一写路径。聚焦测试包含合法真实分块与索引、未知file明确NotFound、外项目pair明确NotFound并复读两原合法内容、同项目host Protected合同，以及现writeFile按key更新原ID/内容。所有测试使用真实隔离SQLite/领域，均正向输出/类型/状态合同；真实HTTP与UI仍独立验收。


## 实施与聚焦测试

原writeChunks父查询后新增现NotFoundError分支，只有同Project的真实父文件才继续原host保护、FTS与chunk替换。没有搜索结果过滤、上层路由旁路、第二写实现或schema改变。当前02-data同步父子归属写事务合同，并明确不猜测历史归属。

新增真实SQLite领域测试chunk-project-ownership.test.ts。修改前正式runner执行5项，3pass/2fail/10断言：外项目pair被接受使错误结果不是NotFoundError；未知file落SQL外键/Drizzle错误。其余合法分块/host保护/生产按key更新已通过，证明失败是当前真实函数行为，不是缺少新接口或单纯import失败。失败运行YjSEsG保留，physical/output settlement=true。实现后新测试5pass/16断言；同次原search-filter-order3pass/7断言，合计8项/23断言。均正向输出、明确错误类型/data、合法原内容/索引合同，无UI自动化、mock、负向核心断言或伪摘要门槛。新增测试按原Prettier格式化，非大文件无关格式化。

## 新生产领域与独立进程验收

after真实领域错pair映射NotFoundError/data.message，Owner file mem_g0VaQIHbs00ZNYpXYuv1与Caller Project prj_hTAFb22jsZYtu6AmpHmV明确写入回执；随后合法替换Caller自己原file mem_g0VaQIHgy00LtWni2Ofl成功，实际Caller FTS精确返回Caller original note/合法正文/score0.21694251164817405。原Owner合法正文完整，存储父关系精确一致。未重写历史before诊断数据，也未把实际错误当凭据/模型问题。

领域进程正常退出后，以同profile独立启动39005，持久化实际HTTP五项再次200/200/200/200/404，均当前运行时/doc/Ajv2020 schema通过；当前Caller list/search/get的原fileID/标题/新合法正文精确，Owner原正文精确，Caller读Owner仍为既有明确NotFoundError。before与after共10个实际HTTP响应含两个明确404合同，不是仅fixture或静态检查。该函数不是公共HTTP写入口，不能把本验收称为外部写漏洞/模型调用端到端。

本人真实/ui/IAB91：04 Caller Notes/Caller原目录下crosschunkprobe精确显示Caller original note/Score0.22，展开正文完整，与同项目get一致；05通过原项目选择器切Owner Notes，原目录/原Owner note及原始内容保持、查询按目录scope重置。全部5张（before3/after2）原始截图本人呈现查看。前端未改，沿用前批已验证构建main-XG8JNngj.js，不无目标重复重建；UI仅证明合法持久数据的集成呈现，错误原语资格来自真实领域/SQLite/HTTP。

数据审查四Git项目原notes与seed和HEAD:notes.txt逐字节一致、四原HEAD精确；四原Memory file身份/Project归属/title/source/kind/创建时间保持。before实际有原2合法note chunk加1复现错归属chunk，after精确两原note的合法chunk（Caller内容为明确授权隔离合法替换）；原始父/子身份逐行落盘，不删除或掩盖前态。两profile均Project2/Session0/Message0；before memory_file4/chunk5，after4/4，包含两个host项目文档；config文件0。正常生成未跟踪.gitattributes/.gitignore/.opencorvus如实记录，未清理。可变host文档时间未设跨读常量检查。

## 检查与交付范围

backend typecheck通过，聚焦8项23断言通过；docs/架构/精确diff提交前检查。未新增/运行UI自动化，未改公共API/SDK/数据库版本10/持久格式/模型流式/调度恢复。自有before56704和after22522均正常POST/shutdown200并消费原session exit0/prompts0；自有页90/91关闭。helper首次语法失败及真实red/green日志均保留，不以工具故障掩盖未验。

范围仅Memory/index.ts、聚焦新测试、现02-data、spec/证据和三个README本条，原177无关状态保留。fetch普通merge/完整待推检查/正常push按原流程，以Git回执为准。无子agent、用户进程/窗口/凭据操作，无branch/worktree/tag/Release/发布。历史用户数据库未查、没有虚报历史数据修复；Sol/完整模型/权限/Task/Mission/Session执行恢复继续未达成。
