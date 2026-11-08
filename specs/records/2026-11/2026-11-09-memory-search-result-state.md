# 记忆搜索结果的当前状态与语言

## Recall

用户持续迭代至明确停止，最新明确不要子agent；本人独立。前批bdd2286d4已正常推送全部hook通过、HEAD/upstream0/0，原177条工作区状态精确保持。每批先根因/影响与spec（规格），再证据支持的修复、真实开发/ui桌面交互/截图本人复核、正向合同检查、范围提交/fetch普通merge/全待推审查/正常push。凭据/Sol授权未收到新答复；不重复问、不读取或使用认证/模型目录、不调用模型。

已读MemoryPanel完整数据加载/搜索/清除/For行派生与上一批locale accessor；settings.css所有knowledge-item基础/compact/title/meta/搜索两条规则；全仓data-mode与knowledge-item selector的定义和使用；两语言memory.score及search相邻键；唯一调用MemoryContextPanel；现07-panel/07-panel-reactivity/02-data边界；原Panel list/get/search、Memory.writeFile及同步SQLite FTS5（Full-Text Search 5，全文检索）入口。历史搜索const mode和CSS（Cascading Style Sheets，层叠样式表）英文伪元素均来自65d0bfc98基线；前批bdd只改meta语言派生，未动mode/样式，已经如实记录后续线索。

## 修改前根因与影响分析

前批实际11截图：正常Escape清除真实搜索后，两条原列表恢复，仍出现英文(search)和绿色metadata；只读DOM（Document Object Model，文档对象模型）观察两个原行data-mode=search。直接触发点是loadMemory依次setFiles(new rows)、setSearchMode(false)，For首次创建每行时的const mode先捕获旧true；搜索成功反向依次setFiles(mapped)、setSearchMode(true)，初次搜索新行可能反而捕获false。根因是把当前面板状态当作行创建时常量，样式/标记不再跟踪真实searchMode。调整写入顺序仅碰巧影响新行，不解决响应性，不能作为修复。

样式搜索规则依据原data-mode给metadata绿色，且伪元素content固定英文(search)，因此即使模式绑定正确仍违反当前界面语言和无障碍名称合同。此英文仅在此CSS定义，没有本地化键或独立产品状态。应保持现原搜索结果区分/布局密度/原title，替换为同一searchMode派生：data-mode直接读当前信号，标题旁用现Show/普通span显示本地化Search result/搜索结果；CSS只为该真实文本提供现字体/色彩，不再生成产品文字。新键memory.search_result进入唯一现两语言目录；不增平行mode state、缓存、后备旧标签、刷新/查询或状态机。

影响面为MemoryPanel列表/搜索两向转换、模式配色与结果标记、标签语言和无障碍名称、查询/详情/删除原文件身份；真实原文/来源技术值保持，不翻译事实。class规则只服务此MemoryPanel；其他组件data-mode各自语义不动。基础/compact样式保留原权重/颜色/字体；本任务默认只真实桌面验收，不主动扩展移动端。公开API（Application Programming Interface，应用接口）/SDK（Software Development Kit，软件开发工具包）/数据库结构/持久格式、Memory检索排名/内容和模型执行均不改，无迁移。没有观察到Task/Mission/Session occurrence（执行轮次）调度、队列、唤醒或终态异常；这是同步UI（User Interface，用户界面）派生错误，不以产品名称推断执行引擎根因。

风险：Show标签和data-mode双源、遗留伪元素形成重复英文、标题长导致溢出、搜索完成/清除导致原文或展开变化。两显示都直接读同一个searchMode，原伪元素删除，当前现排版截断规则保留；用真实搜索→清除→再搜索/中英往返截图确认。搜索与清除本来会重建结果集合/收起详情，其语义不在本批改变；语言切换应保留同一查询/展开。

未知：本批fresh实例第一轮搜索的具体mode、绿色在当前主题的可见程度、普通列表与搜索结果新文字的视觉密度；先启动真实前态截图确认，不凭源码宣称复现。未检索或使用UI自动化测试，禁止DOM/组件/文案断言/截图基线/浏览器fixture；只读DOM观察可解释可见现象但不是视觉资格。

## 验收方案（修改前）

Temp b41 before/after各一个真实Git项目，私有Git配置/身份/禁签/autocrlf=false、seed保留原notes字节与HEAD。沿前批原Memory.writeFile生成明确隔离两份原文与真实全文索引，不创建Session/消息、模型/embedding或凭据。before39002/after39003项目开发/ui，实际Notes列表→corvuslocale唯一匹配→清除回两原列表→再搜索。先截图真实前态；确认根因后才改产品。

after观察真实搜索结果的当前样式/英文Search result，语言切中文同条显示搜索结果/相关度，原查询/展开/内容保持；清除恢复原两普通条目/日期/正常metadata样式，重新提交正确结果状态；必要中英往返。本人逐图查看稳定页面，若初帧Loading或菜单淡出另补稳定截图。没有UI自动化或静态文案检查替代。

真实TCP list/get/search各HTTP200/current/doc schema及原文件ID/标题/内容/正score只是后端集成烟测，不代替实页。UI-only改动不写UI测试；typecheck、i18n、新Node build/renderer、docs和架构索引辅助验证。最终保留原Git文件/HEAD与原记忆身份归属/内容/不可变创建时间，记录正常可变host项目元数据而不设伪时间门槛；自己的服务正常shutdown/原exec session退出0，自己的页面关闭。只提交本批四个产品文件/当前架构/spec/artifacts/三README本条；原177无关状态保留，无branch/worktree/Release/tag/用户窗口进程操作。Sol、完整模型/权限/引擎执行恢复仍未验。

## 当前状态

已完成下述独立真实前态、实现与桌面复验。Sol/模型/权限/引擎执行恢复仍未验。


## 真实前态与实施定稿

本批39002/IAB88独立复现：01初始两原条目普通列表；真实提交corvuslocale，02唯一原命中Score0.25且metadata普通色、标题原名（无搜索结果标记），只读DOM解释为该命中data-mode=list。Escape清除并同页切中文，03原两条恢复、日期正常中文，但均错误显示英文(search)/绿色metadata，真实查询已空。三张截图均本人呈现查看；DOM观察不是视觉替代，错误也体现在原始截图及无障碍名称。

实际TCP三项list/get/search均HTTP200/current/doc schema、原两个ID/标题/详情内容/唯一正score0.24639561621802644通过。自有页88关闭，服务原session98699正常shutdown200/exit0/prompts0。之后才改产品。

实施直接删除For内const mode并把data-mode绑定searchMode()派生；标题只在同一searchMode真实为true时以原Show/普通span显示memory.search_result（Search result/搜索结果），保留原title原文。CSS旧title::after硬编码文字及其选择器完整移除，新真实文字span只沿用原font/color/size；搜索metadata绿色仍由当前data-mode唯一驱动。两语言各增一键，无重复标签/旧CSS后备或第二mode事实。搜索/清除/API加载本身的写入顺序、实际排名和文件内容保持。


## 实施与实际桌面复验

原const mode与CSS英文title::after路径已删除；data-mode与真实本地化标签都直接由唯一searchMode派生。新Show/普通span沿原标题排版，搜索metadata继续用原good色彩token，普通列表回原muted。两语言新增memory.search_result，无新配置、模式缓存、API或数据路径；实际搜索/加载写入顺序和后端内容/排名不变。

39003/实际IAB89：04原两普通条目、普通metadata与原标题；真实提交corvuslocale，05唯一原结果正确出现(Search result)及绿色metadata/snippet，展开后原内容和日期准确。原页切中文，06稳定标题旁(搜索结果)、相关度0.25/中文详情日期，查询corvuslocale/展开/原始双语内容保持。Escape清除，07稳定两条原普通列表/普通灰色metadata/日期，没有把任何原文或数据改名；手动只读DOM辅助观察两原行mode=list，视觉资格来自本人实际查看07。再次中文搜索，08唯一真实原结果正确搜索标记与绿色样式；同页切英文，09仍当前结果(Search result)/Score0.25、查询/内容保持。九张原始截图全部本人呈现查看，无UI自动化或截图基线。两次搜索真实走生产FTS，没有向页面注入状态或事件。

before/after实际TCP各list/get/search三项（合计6次）全部HTTP200/current运行时/doc/Ajv2020 schema通过；两文件原ID/标题、get原文、唯一真实FTS命中正score0.24639561621802644精确，界面四舍五入0.25。数据审查原两个Git项目notes与seed/HEAD:notes.txt逐字节一致、原两个HEAD相同；四个原记忆ID/Project归属/title/source/kind/不可变创建时间/content完整保持；两DB各Project1/Session0/Message0/memory_file3/memory_chunk3（含host项目文档），两profile config文件0。生产初始化生成的未跟踪.gitattributes/.gitignore/.opencorvus如实记录，未清理。可变host文档时间未作跨读常量门槛。

## 验证与交付范围

UI-only改动，没有新增/修改/运行UI自动化或负向测试；真实HTTP是原后端集成烟测，不冒充UI/模型/执行引擎端到端。typecheck、i18n2语言/2932键、正常Node build51.60s（main-XG8JNngj.js）及renderer公共面通过；docs352operations/26groups、架构索引20文档和精确diff检查通过，提交前再次检查。无公开API/SDK/数据库/持久格式或模型流式修改。

原before98699/after79757均正常POST/shutdown200并消费原session exit0/prompts0；自己的页88/89已关闭。提交只含四个overlay产品文件、当前07-panel、spec/artifacts与三README本条，原177无关工作区状态精确保留；fetch普通merge/完整待推集合检查/正常push按原流程，最终以Git回执为准。未使用子agent、用户窗口/服务或凭据，无branch/worktree/tag/Release/发布。Sol、完整模型权限、Task/Mission/Session执行恢复仍未达成，不将本次显示状态收敛误报为引擎恢复验收。
