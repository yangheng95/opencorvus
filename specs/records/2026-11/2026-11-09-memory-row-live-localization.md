# 记忆条目随当前语言更新

## Recall

用户要求持续逐批迭代直到明确停止，并明确不要子agent；本批本人独立。前批739eec87e已正常推送，全部hook通过、HEAD/upstream0/0，原177条工作区状态精确保持。先调查根因/影响并落盘，再真实前态与证据支持的修改、本人真实开发/ui交互/截图、聚焦正向检查、范围提交与fetch/普通merge/待推审查/正常push。无凭据或Sol授权新答复，不重复问、不读取或使用凭据/模型目录，不发起模型请求。

已读MemoryPanel全源、MemoryContextPanel与前批07-panel/07-panel-reactivity/current02-data相关合同、原Memory领域writeFile/writeChunks、Panel知识list/get/search路由、MemorySearch实际SQLite FTS5（Full-Text Search 5，全文检索）路径、MemorySource/MemoryFile定义、SearchField与两语言memory.score。全仓MemoryPanel调用仅MemoryContextPanel；memory.score仅本行和两语言目录，无第二实现。搜索与构建文档仍采用既有工具，不新增UI测试。初步读取的搜索排名测试不用于本批UI资格，非本批相关实现不扩大清理。

## 修改前根因与影响分析

待真实确认：英文加载已有Notes行后同页切中文，若列表日期仍英文格式，而同一条展开详细日期已中文；英文提交实际FTS搜索后同页切中文，若相关度仍Score，其他界面中文，则是行级一次性派生未跟踪语言。MemoryPanel的For回调在行对象首次建立时同步计算time/scoreHint/meta常量，JSX只读取常量；已有formatDate/Intl/t本来支持当前locale，但调用不在reactive owner内。旧详情日期在JSX直接调用formatDateTime，scope标签也直接t；语言变化不应重载原数据/清空当前查询或展开项，重开页面不能根治。前批b38项目选项locale memo和b39原项目更新订阅修复不涉及Notes每行元数据。

直接影响当前Notes列表时间与搜索相关度文案/数字、同页语言切换、原内容/文件身份/来源source原值，以及查询/展开detail状态。若前态确认，替换同一行meta常量为纯reactive accessor，继续原formatDate/t/Intl，JSX读取该派生；删除被替代常量，不新增格式化库、语言state、name缓存或数据读取。detail现有日期路径保持。范围为MemoryPanel单组件与当前架构说明；无后端API（Application Programming Interface，应用接口）/SDK（Software Development Kit，软件开发工具包）/数据库schema或持久数据演进、模型/调度/队列/唤醒/终态变化，无迁移。当前没有这些共享执行机制异常；出现时按全局横向审计要求追查。

未知：实际浏览器Intl日期格式、当前列表行是否被语言切换重建、具体score数值及locale是否改变数字形式；必须实际观察，不预写通过。用户/原始记忆标题内容/source技术值保留原文，不翻译事实。风险为为了语言反应而重新查询导致当前搜索/展开丢失，或保留旧计算常量造成双源；用原行和真实查询/展开前后截图验证。当前不能把typecheck/build/DOM文字当视觉验收。

## 验收方案（修改前）

Temp b40 before/after各一个真实Git项目，独立profile/私有Git身份/禁签/autocrlf=false，seed保留原notes字节与HEAD。通过原Memory.writeFile写入明确隔离原文并生成真实FTS索引；不建Session/消息、不模拟模型输出、不调Provider。已读MemorySearch.search为同步SQLite全文检索，不使用embedding/LLM（Large Language Model，大语言模型）。用正式开发/ui服务39000/39001，真实设置Memory & Context，英文列表与展开日期，再语言切中文，截图确认是否存在问题。实际搜索唯一原文token corvuslocale，查看原HTTP返回score、真实行标题和相关度，语言往返保留查询/展开；清除后回列表，截图稳定日期。

真实TCP的list/get/search通过当前/doc/Ajv2020验证原ID/标题/内容/正score合同，只是未改后端的集成证据；UI仅本人实际交互、原始截图人工查看，不新增/修改/运行UI自动化（包括DOM/源码/快照/组件/浏览器fixture）。纯UI改动不写自动化UI测试；辅助typecheck/i18n/正常Node build/renderer/docs/架构索引。必要修复必须在真实前态确认后执行；如果语言原本正常则排除假设，不为满足方案而改产品。

结束验证原Notes/Git提交/原记忆身份内容与当前数据归属，记录实际可变时间而不要求跨读恒定，正常shutdown自有服务/消费原session/关闭自有页。只提交本批文件与3README本条，原177状态保留；无新branch/worktree/tag/Release、用户进程或窗口操作、凭据使用。Sol、完整模型权限、引擎Task/Mission/Session执行恢复继续未验，不包装成完整端到端。

## 当前状态

已完成下述真实前态、实现与当前语言验收。模型/权限/引擎执行资格继续未达成本批范围。


## 真实前态与实施定稿

本人在39000开发/ui/IAB86加载真实领域写入的两个原始记忆，01英文列表user · 11/9/2026与展开详情Created 11/9/2026均实际显示。原页切中文，02其他界面及详情均中文日期2026/11/9，但两个列表原行仍11/9/2026，原文/展开保留。切回英文，真实提交corvuslocale，03命中唯一原条目user · Score 0.25；原页切中文，04界面与Project标签中文，相关度仍Score 0.25，原查询保留。四张原始截图均本人呈现查看；不是单纯缺语言目录项，既有memory.score中文为相关度 {{value}}。

实际HTTP list/get/search均200/当前运行时/doc schema通过，两个原fileID/标题精确，详情原文精确；实际SQLite FTS得分0.24639561621802644，对应显示0.25。原项目/文件/数据无语言字段或模型输出；MemorySearch同步SQL，未调用embedding/Provider。原页86关闭，before原session1619正常shutdown200/exit0、prompts0后才实施。

定稿为For回调内唯一meta accessor，内含原formatDate与scoreHint/Intl/t计算，JSX在语言反应作用域读取meta()；替换三个旧常量，没有新增信号、memo缓存、读请求、行重建key或语言切换事件。详情/来源/source/标题/内容/score原数字契约保持，语言切换只派生显示。两语言数字小数符号在实际en-US/zh-CN都是0.25，因此不能虚报本次观察到数字符号差异；代码继续现Intl以当前locale格式化。


## 实施与复验结果

MemoryPanel行内唯一meta已改为纯accessor，原formatDate/Intl/t在JSX读取时跟踪当前locale；旧time/scoreHint/meta一次性常量被替换，无额外state、行key、数据请求或翻译原文。当前架构同步记录。

39001/真实IAB87：05英文列表及原文详情；原页切中文，06列表date已2026/11/9、原详情保持，但截图捕获菜单关闭淡出，故不作为稳定资格。07补充稳定截图：两行日期与详情均当前中文，原始双语内容及展开未变。切回英文并真实提交FTS搜索corvuslocale、展开原条目，08显示Score0.25与原文；原页切中文，09稳定显示相关度0.25，查询corvuslocale、原文件详情/内容均保持。回英文10稳定显示Score0.25，查询/展开保持。中英文原技术source user与原始标题/内容保持真实值；两语言数字形式均0.25，没有虚报数字符号差异。

真实Escape清除查询，11实际恢复原两条列表及英文日期。此步骤新观察到两个普通条目仍带英文(search)且metadata呈搜索颜色；只读DOM确认原两ID的data-mode=search。后续源码读取发现同For回调的mode也为一次性常量，loadMemory先setFiles后setSearchMode(false)，CSS settings.css的search规则另有硬编码(search)伪元素。它属于后续独立调查线索，本批不宣称普通列表模式正确，也不以此扩大已限定语言日期/score修复；真实截图11保留原现象，不删除或遮盖。下一批应先分析模式/样式/语言合同与影响，再落盘实施。

before/after各实际TCP list/get/search三项（合计6次）均HTTP200/current运行时/doc/Ajv2020 schema通过，两个原文件ID/标题及get原文精确，唯一真实FTS命中score0.24639561621802644，与界面0.25一致。生产数据入口无模型/embedding/凭据调用。两Git项目原notes.txt与seed及HEAD:notes.txt逐字节一致，两个原HEAD保持；四个原Memory文件身份/Project归属/标题/source/kind/不可变timeCreated/内容完整保持，正常Project MEMORY.MD可变元数据未设常量比较门槛。两DB各Project1/Session0/Message0/memory_file3/memory_chunk3（含一个host项目文档），profile config文件0。正常生成的未跟踪.gitattributes/.gitignore/.opencorvus如实记录，未清理。

## 检查与交付

纯UI改动，没有新增/修改/运行UI自动化或负向测试，没有模型验收。typecheck、i18n（2语言/2931键）、正常Node build51.65s（main-DYPmdYoB.js）及renderer公共面通过；docs352operations/26groups、架构索引20文档与精确diff检查通过。真实桌面11张原始截图均本人呈现查看，06为淡出过渡，稳定资格07/09/10；辅助检查与实际HTTP不能替代这些视觉证据。

自有before原session1619及after88378均正常POST/shutdown200并消费exit0/prompts0；自有页86/87关闭。只提交MemoryPanel、当前07-panel、此spec与证据、三个README本条；原177条无关工作区状态保留。执行fetch/普通merge/全待推集审查/正常push，结果以Git回执为准。未触及API/SDK/DB/迁移或调度恢复，未操作用户窗口/服务、分支/worktree/Release/tag/凭据。Sol及完整引擎/模型/权限链路仍未验，后续模式线索尚未修复。
