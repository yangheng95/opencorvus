# 文件公开错误合同与真实响应对齐

## Recall

用户持续按批并行调查UI（User Interface，用户界面）/UX（User Experience，使用体验）、功能与缺陷，分析先落盘，真实隔离桌面/截图人工复核、聚焦正向功能测试、范围提交/普通merge upstream/正常push后继续，直到明确停止。b19 a9344736e已正常push，全部hook/secret scan0通过；main/origin0/0、原177状态保留、暂存空。先前b04/Sol与b16通知等未验范围仍保留，不重复询问凭据授权，零凭据/模型；所有本人旧页面/服务已关闭。

两既有代理一层只读并行：functional_audit全13个FileRoutes operation、错误定义/handler/运行调用与SDK（Software Development Kit，软件开发工具包）源横审，ui_audit核Explorer变更/ApiError/恢复/历史。都不编辑/运行UI/再次委托。已读File.Create/Move/Copy/Remove/Upload/Read/ReadSource/Download/List/Search/Status及其路径、锁/发布/linked-entry、Git source paths error；FileRoutes全部声明/validator/Plugin初始化、server error helpers/NamedErrorStatus/实际序列化、NamedError.Schema单一原定义、生成OpenAPI（开放接口描述规范）/SDK transaction脚本、现OpenAPI及FileCreateErrors、既有file-write-identity/file-text/file-download/OpenAPI-runtime测试、当前07-panel文件契约、10-26无模型文件操作、10-30可见New、10-13文本准入和b08具名500/正式生成交付记录。全仓定义/调用/同义/旧决定搜索完成。

排除创建正文准入的静态线索：10-13只明确reader/text-save无损合同，File.create公开string内容并无同样新约束；Explorer唯一生产createEntry只给空content，Write/Edit/ApplyPatch另走executionFiles。不能用新建后保存冒充初始内容，也不为找问题增加新输入框。此线索无当前合同违例实证，不实施。

## 修改前根因与影响分析

确定的公开合同问题：File.create实际已按原File.InvalidPathError/ConflictError/EntryNotFoundError及server handler返回400/409/404（既有真实HTTP（Hypertext Transfer Protocol，超文本传输协议）测试也覆盖），但FileRoutes复用全局errors固定模板，现生成FileCreateErrors400仅BadRequestError、404含NotFound/LogFileNotFound、409甚至TaskCancellationIncompleteError。静态读取正式OpenAPI与生成type均确认。所有caller运行时仍收到真实body，编译期消费者却无法准确缩窄/取领域path。

数据流根因：错误类.Schema定义原name/data，serverErrorResponse对NamedError保留toObject并按name给状态；operation的responses单独套通用状态模板，SDK/OpenAPI与API文档再忠实生成该错误声明。旧文件功能已迁入具名错误，声明没有同步，因此重新生成本身不能根治。Download/ReadSource后来按名字局部声明正确name，但data仍是泛record；若其它同名ref改精确Schema，必须统一同一原Schema，不能留下双定义。

全13operation有限矩阵：B=BAD_REQUEST_SCHEMA，I=File.InvalidPathError.Schema，N=EntryNotFound.Schema，C=Conflict.Schema，W=WriteConflict.Schema，U=NamedError.Unknown.Schema，G=GitSourceEnumerationError.Schema。find.text/find.files/file.list：400B/500U；file.read：400B/404N/500U；download/readSource：400B|I/404N/500U；write：400B|I/404N/409W/500U；create/copy/move：400B|I/404N/409C/500U；delete：400B|I/404N/500U；upload：400B|UploadInvalidTarget/Name/Content三原Schema，409UploadConflict，500U；status：500U|G。所有有validator的操作保留其真实BadRequest分支。跨切面bootstrap/plugin/config任意错误不在本批穷举。

补充共享审计：status经gitSourceLinkDiffs和直接gitSourcePaths可真实抛G，handler保留其name/data500；不能把500一概Unknown。list/read/download/readSource未进入gitSourcePaths：list ignore matcher读取真实ignore/物理坐标，read Git baseline用独立机器协议，download原件/sidecar，readSource PromotionJournal路径；这些普通IO/解析异常仍Unknown500。PublicationError为AggregateError，非NamedError，不因名字带Upload就判400。

方案：只在FileRoutes复用原.Schema/成熟resolver+z.union，给已证重复的400/404/409/500建私有响应常量；保持每operation局部有限矩阵。不要改全局ERRORS（其409服务其它路由）、新建错误类/复制payload字段/翻译技术原文/修改运行错误或UI。正式SDK build事务从canonical server声明生成OpenAPI/types/client/dist，只提交实际变化；正式docs:api/docs:check，不手改生成文件。SDK编译正向验证FileConflict缩窄后data.path为string。

影响：13个文件/查找API声明、生成SDK错误类型与文档；运行HTTP状态/body、路径安全/锁/覆盖/原件/写入字节、SDK请求实现、模型/权限/设置/数据库/持久格式均不变。无Task/Mission/Session调度/执行轮次/并发/队列/唤醒/恢复/终态异常事实，若真实出现立即完整共享横审。风险为遗漏validator400、同名schema双源、漏G500、误把普通异常声明成领域错误、泛状态污染其它domain、生成顺带无关差异；以原类Schema、操作矩阵、真实响应匹配各自OpenAPI和精确生成diff检查。

## 验收与交付计划

本人Temp b20/profile-before/after、project-before/after；private Git配置、fresh开发serve before38958/after38959 /ui。普通前端无改，复用实际main-BuKeJYrJ.js。自有notes.txt/source.txt及测试用文件，所有创建/移动/复制/删除只限本批可重建输入，保留原bytes声明，不动用户项目/凭据/数据库。无模型或伪造业务参与者消息。

before先真实公开HTTP和/doc：重名create→FileConflict409、越界→InvalidPath400、missing→NotFound404、validator缺参数→BadRequest；保存原请求ID/body和该operation/status旧schema对实际响应的验证结果。使用已声明依赖Ajv8.20（2020版）验证真实响应是否满足该公开schema，不自写schema校验器、不用静态字符串/摘要冒充合同。探索真实UI New→New file重名notes.txt409、Details/中英文摘要及重新New成功，证明现前端真实错误恢复；不改UI，不把目录读取Retry当变更重试。

实证成立补记录后，新增聚焦非UI真实HTTP/OpenAPI合同测试，用memoryProject/真实文件+Server.App请求与真实/doc，显式核name/data/status及Ajv验证对应操作schema。先新测试旧声明失败，再修声明跑绿。覆盖validator分支/创建移动复制删除missing与conflict/旧revision写入/上传四具名错误、普通IO500和真实linked-ancestor G500；保留成功新建/读取/字节路径。真实Hono局部checker不是完整桌面E2E（End-to-End，端到端），单独after服务实际HTTP/公开doc及UI证据。禁止UI/DOM/组件/浏览器fixture/快照/像素/文案自动化。

after全部矩阵实际验证范围按回执写明，UI重名错误/完整Details/本批新名字成功打开，当前语言和实际截图人工复核。Backend/SDK typecheck、正式SDK build、docs:api/check、architecture-index及原OpenAPI inventory聚焦测试；不无目标全量bun test。所有本人页面/serve/临时链接正常收拢，原启动session exit0，精确原177状态/三README本条/范围commit/fetch普通merge/完整待推集合审查/正常hook push后下一批。

## 修改前真实实证与实施决定

before38958原服务、真实/doc200与四个HTTP请求，声明依赖Ajv2020实际验证：create重名409/FileConflictError（926ff89d-37e2-441b-9da4-f692ebfd9701）、create越界400/FileInvalidPathError（59b6506a-3fcd-401f-9a36-bdb51e337312）、copy缺失404/FileNotFoundError（34f59437-911d-42e8-a6d5-caf2ec501e31）三个实际body均不满足各自operation/status的现schema；普通create错误类型参数400/B实际满足（39c62a15-010a-4819-a213-e70fd6f9835d）。独立checker以“actual必须被schema接受”正向契约exit1，逐项实际校验错误已落JSON（JavaScript Object Notation，JavaScript 对象表示法），不用工具异常代替产品问题。正式OpenAPI文件和生成FileCreateErrors同样错配，足以按完整矩阵修元数据。

本人IAB42实际main-BuKeJYrJ.js，Home Browse files→Explorer New→New file，notes.txt重名真实409，Details原ID=e4659f96-11ce-40a4-8dd4-a57c3a5c08be/原body FileConflictError+path；切中文同一错误摘要和控件正确随语言，原技术诊断保留。再从New而非读取Retry，创建notes-b20-before-ok.txt，真实打开空白文本编辑器，焦点进入该文件；原notes/source逐字节保持，新文件实际0bytes。截图01—04已呈现并人工查看；Details内容区域纵向有限，未声称一张截图全部诊断同时可见，完整原文另存实际界面text。运行UI恢复已有正确合同，产品UI不改。

所有前置已通过，后续先新增真实HTTP/OpenAPI聚焦正向测试红，再只修声明与正式生成产物；不因元数据错误改HTTP行为或扩大创建正文准入。

### 新正向回归的改前结果

`bun run test test/server/file-error-contracts.test.ts`进入原isolated checker：4项中成功create/read/copy/move/delete/upload的真实字节/schema1pass；领域错误schema、validator400声明、真实indexed linked-ancestor G500声明3fail，26 assertions。首个失败明确实际FileConflictError被旧TaskCancellationIncompleteError const拒绝；另两项是find.text缺400、file.status缺500。真实成功和错误体均先核对，进程/输出settlement=true，exit1不是runner故障。允许开始生产元数据改动。

### 测试与工具链纠正

首次元数据修复后checker仍1pass/3fail，31assertions；不能以类型/build通过宣称交付。其一为本批新测试错误期望：assertExistingParent对缺父目录明确400/FileInvalidPathError，实际body同代码，已改测试为该当前契约，不改生产错误。其余两例在Bun嵌套asymmetric toMatchObject之后，实际样本message/error类型变成object。本人Temp纯JSON最小框架probe独立重现：原message字符串/error数组，expect.any嵌套断言后变成{}，原生assert确认类型异常，probe exit1。此为当前Bun1.4.3局部断言副作用；改新测试为明确primitive类型/数组/当前错误体断言，保留未经该matcher改写的JSON供Ajv。未降级schema校验、未加clone掩盖产品输出、未改应用/全局runner/依赖。随后重跑原聚焦checker，不用工具错误掩盖未完成。

## 实施与最终验收

FileRoutes私有fileErrorResponse复用成熟resolver，fileMutationErrors只复用已重复的同义400/404/409/500响应，所有payload直接原NamedError.Schema；global errors只继续提供真实B，不改全局模板/handler/validator/middleware。下载handler仅普通formatter换行。13项operation局部矩阵落地，read/download/readSource同名File schema统一，status包含G|U，上传三具名400及专属409准确。File本体/Overlay source和服务均无差异。

修正新测试/局部框架断言后，原checker重跑：新4pass/124 assertions，原runtime OpenAPI inventory2pass/9 assertions，共6pass/133 assertions、exit0。覆盖18领域错误样本、12validator400、真实Git indexed linked-ancestor500、成功create/read/copy/move/delete/upload及精确文件字节；这是生产Hono+真实FS（File System，文件系统）/Git的非UI局部checker，不称TCP（Transmission Control Protocol，传输控制协议）/桌面E2E。缺父目录是400I，create404发布后消失时序本批未诱发。

正式SDK build事务exit0，Backend/SDK各typecheck通过，严格SDK消费示例编译exit0：create/copy/move Conflict path、delete NotFound path、write Conflict path、upload目标/name、status reason/path均可缩窄为原string字段。没有手改生成types。生成semantic diff：精确13个operation变化、9个原错误Schema新增、既有components无变化，operation inventory相同；sdk.gen仅FileStatusErrors type参数/导入，运行请求逻辑无变。正式docs:api更新两份canonical API参考，docs:check352ops/26groups、architecture-index20docs通过。

实际after38959 TCP：与before相同四请求逐一通过其operation schema：409C请求5e5f34be-f6ac-4a4d-97de-9a42a67d2d22、400I请求8c6b7594-f2ff-40fb-8921-f76d5e0ac038、404N请求7549afed-d87e-4fac-bc1d-da4b05bf3740、400B请求33e6f20a-6943-44e3-953b-c48bda9b88ba。完整运行协议与生成协议准确一致；初次checker错把正式CLI generateOpenApiSpec:106明确添加的x-codeSamples文档示例也当运行协议而失配，已按该既有生成来源分离此单一展示扩展、保留其它全部字段精确比较，不把它作为产品问题或削弱响应schema校验。

本人notes.txt独占读锁，真实GET/file/content返回500/U，请求db7c6c1f-ebbc-4a2a-bea3-677855c444eb，Ajv通过其U schema；对应原日志EBUSY/open/本人notes.txt。helper finally正常Dispose/exit0，释放后notes/source/new-file公开读取200、原文与磁盘逐字节一致，分别33/17/0bytes。

本人IAB43/main-BuKeJYrJ.js，Home Browse files→New→notes.txt真实409，Details原ID51afac67-7a79-4d6f-ba2e-ac4228fea1d2与FileConflictError/path正确；切中文摘要/控件随语言，原诊断保留同ID。再次New新名notes-b20-after-ok.txt成功开空编辑器，实际0bytes，原notes/source保持。截图05—07实际呈现并人工查看，before01—04也已查看。前端无改复用现普通bundle，不新增/运行UI自动化；不把非空create正文/其它mutation都称本批实页已验。

## 边界与交付收拢

任意bootstrap/plugin/config跨切面异常不在有限File矩阵穷举；publication race、其它操作逐项TCP/GUI及其它宿主未冒领。错误Details显示区域有原生纵向约束，不称一张图展示全文；实际界面原文另存。Sol授权仍未答，零模型/凭据；先前开放范围保持。

IAB42/43关闭，两serve通过POST/shutdown，原session65641/24933 exit0；读锁51529正常Dispose/exit0。失败checker按原runner保留Temp诊断目录，均已确认物理/输出结算，没有运行的test/helper遗留。普通SDKbuild和全量doc只在本人Temp/正式产物路径，无新branch/worktree/Release/tag/publish。结束保留原177状态、精确三索引本条、范围commit/fetch普通merge/完整待推集合审查/正常hook push后继续。
