# 中文销售简报的原生 PPTX 交付

## Recall

- 用户要求持续本人独立批次迭代直到明确停止，不使用子 agent（代理）、新分支或工作树；现有凭据和完整模型目录可用于精确流式 GPT-6.1 Sol，不限制请求。每批先根因/影响/spec（规格），再实际修复、聚焦正向检查、真实桌面交互和本人看图、范围提交、获取并普通合并上游、正常推送。不能只交验收记录或以模型自述替代证据。
- 上批属于进展：`810df17bc066468917e43b139272ab1d7e46d90f`已正常推送，远端精确核对0/0、暂存空、原177条状态相同；Word原生标题/A4/连续标题链修复，20正向断言、真实Sol任务与桌面两页/两次实际下载检查通过。44次请求全部精确流式Sol/HTTP200/reader settled EOF；run15–18原句柄正常退出0、成对副本退役。仓外`opencorvus-iteration-20261127-docx-heading-pagination/delivery-result.json`保留实际推送核对；上批规格的提交前恢复点不冒充最新远端状态。
- 已读当前04-extensions的单一Work Artifact（工作产物）作者/校验/收据/交付合同，presentation与office-document作者schema（输入约束）、共享名称primitive（基础组件）、全部同名定义/调用、typed Tool（类型工具）、原生PPTX（PowerPoint Open XML Presentation，PowerPoint演示文稿）生命周期、filename相关测试、artifact正式下载投影、当前PPTX及review技能引用、11/9 Windows设备名记录。当前没有检索到产品UI（User Interface，用户界面）自动化测试；不新增或运行此类测试。原生Office产物生成/PNG（Portable Network Graphics，可移植网络图像）检查是文件生命周期，不能冒作应用视觉验收。

## 现象、直接触发与根因

- 可观察输入是本批要求的新中文原件名`销售经理简报.pptx`。`presentation.ts`的AuthorWorkArtifactInput.filename明确使用ASCII（American Standard Code for Information Interchange，美国信息交换标准代码）首字母及字符白名单，中文在进入OfficeCLI之前就被Zod（输入校验库）拒绝；当前仍需用真实schema正向用例记录红证。不是模型选错Office命令、凭据、文件写入故障或排版问题。
- DOCX（Word文档）/XLSX（电子表格）作者已通过`office-document.ts`的filename builder（名称约束构造器）复用`classifyEntryBasename(value,true)`，支持合法Unicode名称并拦截路径、保留设备别名及Windows非法字符/尾点空格；PPTX仍保留较早独立正则，仅basename检查还会接受CON等设备名。11/9设备名修复的明确范围为Office两格式，没有覆盖PPTX；原PPTX资格样例只用英文名，所以两者未暴露中文入口差异。
- 全仓当前定义只有presentation.ts的PPTX和office-document.ts的两格式builder，Tool从这两个schema组合投影，不需要另立模型工具、host（宿主）路由或兼容输入。AttachmentStore（附件库）主交付、正式Tool附件和InteractiveArtifact（交互产物）下载目录均消费实际源filename，必须保留同一真实名称，不用另存英文副本或写入后改名来绕过输入。
- 正式schema正向checker已取得红证：24用例17通过/7失败。PPTX拒绝中文及带重音的正常名称；CON被接受，其他设备别名/路径/非法字符返回旧白名单的不同错误；DOCX/XLSX相同输入的当前正确输出和明确错误合同均通过。仅纯数据输入校验，无设备路径文件操作。修复前分析完成，可按下述同一builder方案实施。
- 修后聚焦24用例24断言全部通过；另按名称筛选原设备名及正常作者合同7用例16断言通过，共31用例40断言。真实固定OfficeCLI的typed作者/检查/校验/正式收据交付链使用`演示资格验证.pptx`，源及正式交付filename精确保留，1用例2断言通过；后端类型及docs:check/architecture-index已通过。此为输入与原生文件证据，不冒作完整桌面或模型验收。
- `run19`的已授权精确Sol预检后已从真实开发页面提交三页简报任务；模型自然读CSV并复算，中文名作者成功。第一稿validate返回6条severity1文本溢出：14pt小标题可用13pt不足16pt、24pt标题可用21pt不足28pt、15pt两行正文可用32pt不足34pt，明确suggest.height。模型继续按实际建议修订完整计划；这是正确的业务校验/计划修订路径，未见队列、恢复或终态异常，不改变host门或忽略Warning。保留首稿工具原文，最终尚未通过。
- 已查阅[微软文件命名合同](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)：Unicode名称可用，路径字符、控制字符、设备别名（含COM/LPT的¹²³）和尾点/空格有明确限制。复用仓库既有primitive，不重写正则或自行扩大设备数字集合。设备名验收只操作纯输入元数据，禁止真实设备路径文件操作。

## 方案与影响面

### 真实任务追加：原生图表数据标签精度

- 本人已查看第二次校验的第二页PNG：原生净金额图标签为28.3/7.4，底部正文为28.25/7.35。作者计划及原生chart缓存仍为28.25/7.35，直接触发是`data_labels: value`未传数字格式；固定上游`ChartSvgRenderer.cs`的ValuePart复用FormatAxisValue，General小数格式为`0.#`。这不是数据汇总错误或光栅器改值。模型随后只能关闭金额标签、另补精确正文并完成旧能力下的交付，不能把这当作平台精度问题已根治。
- 全仓搜索确认`ChartElement`及`authorCommands`是唯一定义/映射，typed Tool直接组合其schema；当前所有调用点为原生资格和模型计划，没有另外维护SDK字段或持久化图表schema。现有资格使用整数1/2，无法暴露精度问题。固定[OfficeCLI源](https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/2900a4a20f49d6a94384d6ea7fb8cc0120999825/src/officecli/Core/Chart/ChartSvgRenderer.cs)及ChartHelper.Setter/Builder已支持`dataLabels.numFmt`；不修改SVG文字、不另画静态图或新建数字格式实现。
- 仓外同源隔离实验只修改自己的探针副本：原生set `dataLabels.numFmt=0.00`退出0，OOXML中`c:dLbls/c:numFmt`实际为formatCode=0.00/sourceLinked=0，SVG的两个text节点精确为28.25/7.35。首个探针遗漏生产隔离环境，触发.NET自解压文件缺失和自启动resident（常驻实例）持有副本；已用针对该探针文件的close释放并按生产OFFICECLI_NO_AUTO_RESIDENT/独立cache和bundle目录重跑通过。不更改或关闭用户其他文件/进程。
- 实施前追加方案：为唯一ChartElement增加可选、有界的`data_label_number_format`，说明使用原生OOXML数字格式，例如金额`0.00`；通过现有batch props直接映射到OfficeCLI的`dataLabels.numFmt`，保留原生图表及精确源数值。工具声明和presentation技能引用同一字段及实际图像复核要求；不以host路由强制模型选格式，不添加后备图表或格式化分支。现有未指定格式的普通自动数值合同保持，新字段必须经真实作者/原生读取/渲染输出验证，不单凭schema字符串通过。
- 公共变更只有作者图表计划新增可选字段，无路由、Tool ID、数据库或持久数据迁移。技能源变更须运行既有生成器同步唯一builtin载荷；不得手写镜像。先以真实原生资格中的小数及格式计划记录红证，再接入唯一映射、测试原生读取格式/数值以及SVG精确标签，最后以新服务的新Sol轮次重新作者、逐页看图、交付和桌面复核。旧交付文件保留，用新版本中文名，避免改写本批已经生成的原件。
- 另外观察到上游chart使用内联数值而没有嵌入XLSX。当前合同允许native chart，原生数据编辑器是否因此受限尚未知；不能把不存在的工作簿作为既有验收前提，也不能宣称完成PowerPoint桌面“编辑数据”验收。保留真实XML事实，作为后续独立调查，不在本批伪造工作簿通过。当前范围仍是安全中文名和原生标签精度两项可证根因。
- 后续启动`run20`零模型请求即被生产包完整性校验拒绝：自有宿主的OfficeCLI于探针时被上游自动更新，原清单33517480字节与当前33583016字节不符。首次探针/资格映射的identity读取清单而没有调用完整生产校验，所以此前精度实验和green只证明当时实际工具，暂不作为固定1.0.158的证据；不删除失败记录。已核对更新器保留的`.old`与原厂不可变清单精确匹配，并恢复全部5个受管文件、清单原文未修改。为真实资格补上现有`verifyWorkArtifactTargetPackageManifest`，使校验先覆盖实际闭包再调用原生工具。按固定二进制重跑探针/原资格后才能宣称通过。run20原句柄已退出1，凭据和模型目录副本已退役；下次使用唯一run21并绑定正常结清的run19事实，不复写失败run20。

- 提取现两格式的filename builder为同一work-artifact名称模块，三格式复用同一实现；保持现trim、6–120长度、首点/空白及各自扩展名规则，普通Unicode、ASCII与扩展名大小写保持真实字符串。删除PPTX旧白名单及私有两格式函数；不保留旧协议或并行规则。PPTX非法名由同一ZodError/filename路径及明确custom错误返回，设备别名在私有workspace创建前拒绝。
- 影响限作者输入校验、该模块的两处消费者、聚焦输入到输出/错误合同、原生PPTX资格样例、当前04架构及本记录/产物/三索引。公开字段形状、Tool ID（标识）、SDK（Software Development Kit，软件开发工具包）、API（Application Programming Interface，应用程序接口）、数据库/持久格式、原附件及已有源文件不变。新输入接受面扩大且设备名完整校验；既有DOCX/XLSX合同保持，不改通用文件/portable身份规则。
- 三格式已有重复名称策略，现有共同分类器是唯一安全事实来源；共享builder是已证重复的最小抽取。生成的builtin Skill payload（内置技能载荷）按现有共同build生成器读取canonical资源；先确认当前构建调用闭包，不手写生成内容或另立镜像。现有技能已经要求保留用户filename，本批不通过提示词让模型换英文名。
- 构建闭包已确认：build.ts、build.local.ts和根generate.ts在编译前均调用generateOpencorvusGeneratedBuildArtifacts，统一生成builtin Skill载荷；本批不修改技能资源，生成镜像无需手写更新。当前源PPTX能力说明要求保留用户指定安全名，与修后的输入一致。
- 排版/原生图表/交付缺陷目前未知。真实任务若发现问题，必须先补充根因/影响再实施；不以本次名称修复预先宣称完整PPTX通过。若出现调度/队列/唤醒/恢复/并发/终态异常，立即横审全部Task/Mission/Session（任务/编排/会话）轮次与入口、正常终态/重试重启/串并行/多项目，不能按单例或模型行为降级。当前没有此类异常证据。

## 真实任务与验收标准

- 在原Work会话`ses_hXaoxvf6sXUeNwnhrZTA`，重新读取真实sales.csv独立复算，制作三页中文16:9销售经理简报，原件`销售经理简报.pptx`保存到`deliverables/销售经理简报.pptx`。第一页讲5笔/净金额35.60及退款/零额；第二页使用两个分开的原生可编辑图表分别比较区域净金额（华东28.25/华南7.35）和订单数（3/2），不把不同量纲混在同一轴，币种未知不捏造；第三页区分已知事实、数据缺失与退款/样品核对行动。不增加外部图片、来源、日期、成本或目标事实。
- 模型本人自然完成完整作者/检查/校验、查看每页实际图片、修正实际问题、精确收据正式交付及规范字节保存，不用子代理、不创建Task/Mission、不提交推送示例项目。源OOXML（Office Open XML，Office开放XML格式）具有3页、原生chart及正确categories/series/cache值，中文正文和金额完整；规范源、正式下载、保存文件及实际浏览器下载逐字节相同。
- 本人启动当前开发模式`/ui/`，进入实际交付卡、逐页切换并截图人工复核标题、中文、图表类别/系列/单位/规模、文字裁切、可读性、页序、名称及实际下载。DOM（Document Object Model，文档对象模型）文本、静态字符串、构建、分数、模型自述和摘要外形不能替代视觉；不做产品界面自动化或截图基线。只使用自有隔离页面/服务，不刷新、重启或关闭用户其他应用。
- 非UI聚焦正向检查进入真实schema输出和明确错误合同，先红后绿；原生资格进入真实OfficeCLI/渲染/收据/正式Tool链，使用安全中文名。聚焦现有设备别名相关合同及必要DOCX/XLSX回归；不全量bun test。当前docs:check、architecture-index、后端类型及正常push钩子完成后才声明交付。

## 环境、数据保护及 Git

- 仓外`%TEMP%/opencorvus-iteration-20261127-sales-presentation`保存初始177状态、真实协议/请求审计、原9个项目文件及完整既有Work记录；共享自有root为`%TEMP%/opencorvus-test-run-vN8ljL/runner-32260-XefI2X/artifact-delivery`，示例项目HEAD仍为`f7bf091156c9b137c4eb3d5b822721294e9a8f24`。启动前验证上个原服务确已正常结清，无活跃凭据副本；本批服务使用新唯一run19及原句柄，不因观察超时重开。
- 沿用验证过的固定OfficeCLI1.0.158闭包与宿主，当前源码开发服务/既有前端构建。凭据与完整models.json成对复制，分别验证可用、精确Sol已投影、实际流式请求一致；不刷新源凭据，不把秘密写入日志/spec/提交。180000ms无真实活动才调查，60分钟服务寿命只用于资源清理；原句柄正常结清后退役副本。Node.js负责Windows浏览器渲染，不用Bun启动Playwright。
- 只修改本批文件，不改原9个项目文件和既有自然历史。三个脏索引只暂存本批各一链接。完成范围修改无论验收是否全部达成都创建可审查提交；获取远端最新/普通merge（合并）upstream（上游），检查完整待推集合、必要验证，再正常push（推送），不绕过hook（钩子）、不变基/强推、不开分支/工作树、不发布/tag（标签）/Release（版本发布）。未满足项须精确记录，不写成基本完成。

## 实施与验收结果

- 三格式使用唯一`workArtifactFilename`，旧PPTX ASCII白名单和DOCX/XLSX私有builder删除。名称红证24用例17过/7失败；最终31个聚焦正向用例40断言通过，包括中文/重音/ASCII/大写扩展名原值与设备别名/路径/非法字符的明确filename错误。无产品UI自动化检查。
- 唯一PPTX图表schema新增可选`data_label_number_format`，有界字符串直接传原生`dataLabels.numFmt`；工具声明、当前架构和presentation技能一致。已运行现有builtin技能生成器，派生载荷同步canonical资源，包括上批已提交的DOCX资源；没有手写生成镜像。原生资格改为中文名和28.25/7.35的`0.00`图表，并在工具入口前调用真实包验证器。新字段红证为严格schema拒绝该键；恢复固定1.0.158后完整生命周期1用例4断言通过，原生get同时返回value/0.00及精确series。探针也用实际`--version`及原清单身份重跑，原生XML和SVG精确标签再次通过。
- 原`run19`完成三页16302字节`销售经理简报.pptx`，自然修复6条真实溢出、在旧能力下关闭舍入标签；本人打开实际交付卡并看了第一页，独立文件checker核对3页/两个原生chart/全部计划文本/9文件及462条原记录。该轮不作为最终精度或三页桌面验收。完整旧轮工具结果、舍入第二页图及原件保留。
- 正常退出的run19原句柄与成对副本已结清；失败run20零模型请求的启动拒绝、原句柄退出1与副本退役完整保留。固定宿主全部5受管文件恢复原厂清单，未修改清单。新唯一`run21`实际开发服务58652完成精确Sol预检；本人通过隔离Chrome真实页面提交新用户轮次，模型重读技能和CSV、十进制复算、自然选择金额0.00/笔数0、重新作者/检查/校验、读取3张实际PNG、正式交付并保存新原件。该轮没有工具失败或排版Warning，实际消息自然stop。
- 最终`art_g0Vc7s5Ye005Xo5lmnrm`源`销售经理简报-精度修订.pptx`16259字节，真实ZIP/OOXML检查3页/精确16:9、全部作者文本、两个独立原生column对象及内联数值28.25/7.35与3/2；各自原生标签showVal=1、格式与计划一致，金额0.00/sourceLinked=0。完整3张1280×720正式PNG与模型实际审阅图逐字节相同，并绑定正式Tool附件/交互产物/收据；不使用可变源码摘要证明正确性。
- 本人实际展开新交付卡、切换1→2→3，逐页截图复核：5笔/35.60、退款−2.05和零金额样品；两图不同量纲分开、柱上28.25/7.35及3/2；第三页已知事实/缺日期币种成本目标/核对行动与末尾来源完整，未见文字裁切。真实下载菜单显示准确中文源名及三张PNG，本人点击PPTX下载；Downloads中新文件16259字节与正式规范源和项目保存原件逐字节相同。桌面截图和源PNG均归档，没有把DOM/模型自述/typecheck当作视觉结论。
- 独立checker最终通过：run19后完整704条既有原记录（message128/part343/request113/outcome113/artifact7）逐行原值保留，原10个文件（含旧16302字节PPTX）逐字节保留，示例项目HEAD仍为f7bf091156c9b137c4eb3d5b822721294e9a8f24。原九文件和更早462行也已在旧轮检查，新的交付只新增精度修订原件及自然历史。
- 两个正常服务共66次请求：62次业务/4次预检，全部provider=openai、modelID/apiModelID=gpt-6.1-sol、streaming=true、HTTP200、reader settled及terminal EOF。run19和run21原启动句柄均已join退出0，自有端口关闭，凭据和完整模型目录副本已退役；不修改源凭据、不记录秘密。失败run20另列，不能混入成功请求数或省略。
- 最终后端typecheck、docs:check（353操作/26组）及architecture-index（20文档）通过，差异检查通过。提交前恢复点：本批产品改动、32聚焦用例44断言、模型任务和真实桌面/下载验收完成；下一步只暂存本批文件，复核原177状态及三个索引各一链接，创建范围提交，fresh fetch/普通合并上游、核对全部待推集合，运行正常push钩子并推送。实际提交/推送后的远端和状态核对保存在仓外`delivery-result.json`，不得用此提交前文字冒充已推送。

## 已知边界与下一批线索

- 预览为OfficeCLI/本地渲染器，不宣称Microsoft PowerPoint像素一致；原生数据为c:val/c:numLit，未在PowerPoint桌面进入“编辑数据”。该数据编辑体验需要下一批独立真实调查，不伪称嵌入XLSX或已经验收。
- 图表使用上游默认标签/坐标字级；本次桌面及原图可核对数值，但远距离演示字号未扩展验收。实际预览辅助名称仍含系统生成的“Rendered slide”，本批没有UI源码变更，后续可调查当前语言下的统一可访问名称。以上不改变本批中文文件名和原生金额标签精度已验证的范围。
