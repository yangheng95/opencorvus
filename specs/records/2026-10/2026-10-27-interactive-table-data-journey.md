# 交互表格的真实值与界面语言

## Recall

用户持续授权单agent（代理）自主体验全产品UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能、查根因、修复、真实页面及内容复核后提交推送，不重复已解决的Rendering（渲染）闪烁；旧Goal（目标）自动文本中的Astra并行要求被后续明确单agent覆盖。本轮不委托、不发同行消息、不建分支/工作树，不碰用户18571、用户数据库和用户窗口/进程。已授权实际OpenAI gpt-6.1-sol凭据使用，必须同时复制完整配对模型目录、分别证实凭据可用/精确投影/真实流式请求，秘密内容不进日志或提交。

上一Goal轮次为进展：4de3b0d55b87a64bbc053d0221f80d8d0ad1cc01已正常推送，2026-10-26T21:12:52Z重新fetch/merge（拉取/合并）后HEAD/upstream（当前/上游）相同0/0，36项本轮源清洁，177项同行改动保留。真实Mission→Task（使命到任务）交付、CSV（Comma-Separated Values，逗号分隔数据）表格预览/搜索/精确排序及共享下载保真已验证，14项纯数据/权限/错误合同测试通过。659真实60次流式请求累计282；其228853ms清理余量未达五分钟如实保留，后续660–662无认证运行均0请求且原进程/输出/请求结清，662余量1097273ms、92表16029行/593项原关键事实保持。新的实际菜单下载77字节与公开产物一致，660/661旧80字节失败保留。

本轮重新读取当前Goal合同、近期表单/侧聊/预算/入口证据和实际控件，未据旧问题复改：首页保持加号和/goal，已有规范表单及说明，不恢复装饰入口。代码调查在上轮复用的TableArtifact发现新数据呈现线索，转向真实交互表格验证。

## 修改前分析与影响

可观察现象待实际页面确认；代码线索是displayCell在dataType=boolean时直接按JavaScript（编程语言）truthiness（真假转换）返回英文Yes/No。公开table@1合同的row（数据行）允许string/number/boolean/null（字符串/数字/布尔/空值），列dataType是呈现描述，不保证该列每个值均布尔。因此字符串"false"会被改显示为Yes，改变真实事实。数字和日期的Intl（国际化格式器）使用系统默认语言，未读当前产品locale（语言）；切换语言后TanStack列定义的cell（单元格）闭包是否重算尚未知，需要实际语言切换验证。旧CSV改进只为显式text/csv提供文本单元格与精确比较，没有资格改写原交互式表格；本轮不会回写任何原payload（发布内容）。

已读07-panel的唯一消息绑定交互Artifact（产物）、真实Tool（工具）结果/Source（来源）、安全原生Table渲染与局部交互合同；schema.ts、publish-interactive-artifact真实工具定义、提示片段、TableArtifact唯一展示及artifact-export唯一导出器。全仓搜索displayCell、TableArtifact、table@1、dataType定义/调用/同义实现；现行CSV数据是字符串，必须继续原样。没有接口、数据库、权限、执行调度或持久化更改的必要证据；新故障若涉及唤醒/队列/恢复/终态，必须立即横向审计全部入口和共享执行轮次，不能按单表格降级。

## 基线与实施验收方案

1. 新663从完全关闭的662只读备份全表逐行核对，复制原持久产物命名空间，复用已交付普通Node构建main-cbWCPQ1o.js，通过真实开发CLI（Command Line Interface，命令行界面）/ui新建Work Chat（工作对话）。原项目README及现有输入/输出只读保持，不造Session/Message/Tool/Artifact（会话/消息/工具/产物）历史。
2. 配对现有认证与完整models（模型目录），进行当前真实流式预检，再在页面提交明确表格业务数据：三条验收记录，实际布尔true/false、字符串"false"、日期和数值。模型自然发布原生可搜索/排序的交互表格，不指定Host（宿主）工具选择状态机；不创建Task、子会话或代理。实际Tool及规范published payload决定覆盖范围；若模型未发布所需类型，不冒称已复现。
3. 20分钟物理边界，十分钟内关闭目标并至少留五分钟结清；实际无活动180000ms才调查原执行，观察超时不是终态，不重启同实例重置时钟。不设置可能耗尽的模型请求计数门槛，全部请求含预检/标题计入累计。先完成中英页面/查询/排序必要截图与公开产物读取，再关闭原exec/native/launcher（执行会话/原生宿主/启动器），物理/输出/请求均结清后清退auth/models副本，然后离线分析。
4. 只有取得真实原值与错误显示证据后实施。拟由同一纯数据formatter（格式函数）按明确类型格式化：只有真实boolean才翻译是/否，混合字符串/数字保留真实文本；日期/数字使用当前产品语言。Table列定义依赖同一语言，切换更新呈现但保留查询/排序/页码。源码原始字段标签属于作者内容，不翻译改写。日期时区/日历日期语义先查现合同，不凭本次本地时区表现扩改。
5. 非UI数据函数补聚焦正向输出测试，中英、true/false/"false"/0/null、金额/日期/无效原文；不新增/运行UI自动化测试。修复后新无认证664使用真实已发布表格重新操作语言/查询/排序/下载并截图人工复核，规范原payload逐项保持。类型、正式构建、i18n（Internationalization，国际化）和文档检查辅助验证，不能代替视觉。
6. 更新本记录/当前合同、原图与三索引，范围提交后重新fetch/merge，完整待推集合审查与正常hook（钩子）推送，不发布/tag（标签）/PR（拉取请求）。不能完成的要求和失败原样报告，持续Goal不标完成。

## 663实际复现与最终实施决策

原模型目录投影gpt-6.1-sol、OAuth（Open Authorization，现有授权）凭据可用、当前真实流式预检分别通过；页面手工明确选择同一模型并提交原请求。真实Session为ses_-zUQnyKTxzzFJ0yNSeLz，完成Tool publish_interactive_artifact的真实Message为msg_g0VZC1hpi00Q3HJFH8fj，发布art_g0VZC1kQB00IP64jiJlS；后续原Message msg_g0VZC1kYE00Kp8bLO5mB finish=stop。公开精确Artifact路由确认4个原列身份及类型，passed行值分别为true、false、字符串"false"，日期2026-10-27/26/25和计数12345.67/25/0完全符合请求。

图02实际中文页面分别显示Yes、No、Yes及英文Oct日期，第三行事实被错误改写；图03搜索false却显示0/3。原数据没有坏，公共payload与真实完成Tool都保留正确字符串。全局搜索的直接根因是现TanStack默认getColumnCanGlobalFilter仅接受第一行值为string或number的列，passed列首行true，整列被排除。默认过滤也只读原值，不考虑当前语言显示。当前唯一shared services/text-search.matchesSearchParts已在诊断日志等使用，按原始/显示文本同时做字面、不区分大小写的查询，复用这一实现，不再新增查询协议。

663已先关闭：原exec29284/native/launcher均0、公共关闭200、物理/输出/请求结清，5次gpt-6.1-sol流式200且reader settled/eof，累计282→287；auth/models副本已清退，源模型完整内容/元数据及auth元数据保持，原92表16029源行及593项目标关键事实严格保持，余量904365ms。准备脚本末行沿用无认证模板的静态false/0显示有误，已核对实际preparation为true/null、目录9155406字节及真实stage/preflight，不使用该旧console行作为事实。公共/session/status在结束时为idle，最后Message stop、5读者结清；标题“进行中”单独不能当执行泄漏证据，状态呈现语义另核对，当前没有可证明的调度异常。同行发布消息只作外部线索，不回复或修改其收据；CSV提交未宣称纳入冻结的0.1.33安装包。

实施边界：提取一个纯数据格式器，真实boolean才取当前语言是/否，混合"false"与0仍是原文；数字/日期明确传产品locale，保留当前时区解析合同，不在此批扩改日期时区。Table列定义显式依赖同一格式器，保持同一TanStack实例和查询/排序signal。所有列均可参与全局查询，对原值和当前显示值复用matchesSearchParts。全局过滤的受控值由唯一query与同一格式器/列类型映射派生，使语言改变能使现TanStack过滤memo失效并重算，不能只改显示而保留旧语言的匹配结果。分页继续使用原自动重置规则；语言导致匹配集合改变时据新结果分页，不声称跨页位置保持。本次仅3行真实数据，跨页仍不在视觉验收范围。

## 664修复后真实页面与数据核对

普通Node正式构建main-DD9IIRAw.js经真实开发CLI /ui呈现。图04保留源字符串false、真实布尔英文Yes/No；手工name排序及false查询显示原生失败和来源字符串两行（图05）。从实际Settings/Appearance切换简体中文后返回同一挂载表格，false查询、name升序与2/3结果保持，布尔文案和日期同步为否及中文日期（图06）。查询否仅显示原生失败（图07），查询2026年10月27日仅显示原生通过（图08），清除回3/3仍保留排序、是/否/false及完整原值（图09）。没有用自动DOM断言或纯函数测试冒充这些实际操作。

在中文日期筛选1行时手工点原Table菜单下载，浏览器报告完成原文件路径；独立Python csv解析和UTF-8逐字节核对163字节：导出仍是原顺序三行、true/false/false、原ISO（International Organization for Standardization，国际标准组织）日期和12345.67/25/0。CSV不承诺保留原布尔/字符串类型区别，原规范JSON提供类型事实。664公开精确Artifact及全部原Messages与663完成快照严格相等；既有659任务input/orders.csv、summary.csv和report.md字节与其已提交证据完全相等。

继续从真实既有Task页面打开summary.csv，点击金额排序、查询华北，得到1/3和50.00（图10）；仅声明这一实际查询和排序控件，完整三行金额升序仍由上批真实截图及当前未改比较器的正向测试证明，不扩大本批实页覆盖。Header（标题栏）线索已排除：最初肉眼读取省略了“非”，原图/当前AX（Accessibility，可访问性）状态对应非进行中/Not running，公开/session/status为idle、Message finish=stop、5读者结清；不是已证明的执行/队列异常，不据其虚构调度根因。

664已关闭：原exec60085/native/launcher均0、公共关闭200、物理完成/输出排空/请求清理全部为真，0模型请求；源92表17362行、629项原关键事实及原项目说明保持，余量967094ms。663/664结清事实独立，累计实际模型287不变。模型请求、公开内容、原文件与导出核对均exit 0；没有绕过失败或放宽旧断言。

聚焦checker（检查器）4项纯呈现/搜索正向测试和6项现CSV解析/比较测试，共10通过；Overlay类型、2语言2561键和正式构建均0，现有大块体积提示保留。没有修改后端、公共接口/SDK（Software Development Kit，软件开发工具包）、数据库、调度、凭据或版本；Table声明的原作者数据与唯一HTTP产物源不变。50行分页和跨时区未实页验收；其它renderer（渲染器）的日期线索不混入本批交付，后续从真实页面另查。

CSS（Cascading Style Sheets，层叠样式表）Token检查与renderer公共面检查通过，当前docs:check为351操作/26组通过；三索引与10原图/规范发布数据/实际CSV副本/evidence已同步。先fetch/merge确认同行3165d1547发布收据已在上游，本批只提交表格数据/搜索/双语呈现及对应当前合同与实测记录，保留所有其它工作区更改。推送成功与最终0/0事实在交付时从原工具取得，不预写。
