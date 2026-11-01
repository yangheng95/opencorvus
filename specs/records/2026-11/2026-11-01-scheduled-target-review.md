# 计划任务作者流程与项目目标复核

## Recall

用户要求持续单agent自主排查当前版本UI/UX（User Interface/User Experience，用户界面/体验）和功能，实际体验后提交推送；不得操作正在使用的窗口。较新单agent要求覆盖旧Goal（持续目标）的Astra委托措辞，不委托。上一轮859为progress（实质进展）：e4fd542c9已推送并fresh fetch/普通merge回读0/0，36自有文件干净、176原无关状态保留。侧栏定位普通/单列表/置顶及嵌套Task实测，22原图含7张最终构建，三实例/6认证模型副本全部结清。最新退休859-after2为schema（数据库结构）9/92表234523行、140附件、62项目原业务文件/Git身份、9Goal保全，模型新增0/累计1180。用户18571服务、真实数据库和窗口不操作。

已读当前AGENTS、859 Recall和最终回执、当前07-panel计划任务日历/编辑快照/版本/暂停/错误合同，829计划任务校验旅程和646–648完整控制历史。旧校验本地化、暂停时间和长请求回执均已修复，不当作当前新问题。全仓搜索ScheduledAutomationsPanel、calendar/automations服务、配置入口、列表/表单/项目目标及相关测试；检索路径没有发现UI自动化，scheduled-automations现有纯服务测试不是视觉验收。本轮先实际体验当前作者流程，不能为继续迭代制造旧故障。

## 调查范围与初始方案

重点复核62项目规模下的目标选择可发现性、编辑保留/取消及创建后的暂停返回。源码线索：项目目标Listbox（列表框）直接展示全部discovered projects，编辑将target.projectIds映射成当前发现的目录；尚未确认搜索/选择/缺失目标是否形成体验或数据问题。先检查真实界面、公共定义与项目列表；发现问题后补齐触发点、数据/控制流根因、旧验收遗漏、所有定义/消费者/公共合同/数据/测试/文档和交付风险，方案补全前不修改产品。实际调度、队列、唤醒、恢复、并发或终态异常若出现，立即横向审计共享入口与Task/Mission/Session（任务/协作工作/会话）发生轮次，不局部归因。

仅复制已退休859-after2完整QA（Quality Assurance，质量保证）库与业务文件/140附件、durable publication和包revision，先保护全部原行全列与62项目文件/Git身份。使用正式开发serve `/ui`，自有隐藏内置页面；before/38521及候选after/38522共享全新60分钟绝对期限，启动余10分钟、结清余5分钟，不延期、不重启已结束发生轮次。已授权OpenAI认证与完整models目录配对复制，启动前分别验证Provider（模型提供方）注册与精确gpt-6.1-sol投影，模型请求上限0/累计1180。新计划仅本人命名、明确2099日期，保存后通过真实UI暂停；不点击立即运行，不修改旧定义、系统时钟或真实数据，不删除历史。

UI验收仅真实页面交互、原图和人工视觉复核；类型、语言、普通构建只作辅助，不新增/运行任何UI自动化。若改非UI契约，使用聚焦正向测试及真实生产checker（检查器）。当前尚无实现决定。结束时公开shutdown200、原exec/native/launcher退出、出生身份/物理/输出/请求结清并退休全部配对副本；逐表原数据/附件/项目/Git/9Goal回读保全。三索引只写自有条目，运行当前docs:check，独立范围commit、fresh fetch/普通merge、完整待推审查、正常hook push和远端回读；不创建分支、工作树、版本或Release（发布）。

## 实页根因、影响与实施决定

before/38521的main-ByPqZRvr.js实际进入Scheduled作者表单，输入“目标选择草稿860”后再次点击页头New automation，原输入立即清空且焦点回Name，02原图和实际前后输入状态确认。直接触发点为页头新建入口在showForm期间仍显示，重新进入beginCreate→resetForm覆盖同一作者输入；旧校验和取消验收没有覆盖这个多余自重置入口。决定让页头新建仅在非作者状态显示；列表/只读详情仍可新建，表单自己的保存、取消、返回保留，不新增平行草稿或确认流程。

03实页项目目标列表只有218px可见高度、2985px内容，62个真实选项，匿名项显示完整UUID（Universally Unique Identifier，通用唯一标识符），只能滚动/按名字前缀导航。目录路径包含可识别项目来源却被截断，optionTextValue只取原name，不能按目录查找。完整registered discovery已读代码核对，所有已注册项目均参与，目录缺失不因此被过滤；“缺失目标映射”只是初始线索，本轮没有删除项目场景证据，不修改后端或target writer。此处为作者选择可发现性缺口，不是执行调度/恢复问题。

实施复用现SearchField、Listbox、matchesSearchTerms及projectLedgerDisplayName；后者为侧栏/命令搜索的同一匿名名称格式。搜索当前完整发现列表的本地化标签、原name、目录和项目ID（Identity，身份标识），不改真实目录/ID/后端排序；匿名标签统一为当前语言短名+原后缀，原名字保留为检索元数据。显示本地化可见数/总数/已选数及空结果提示。搜索Enter停在当前筛选，不提交作者表单；上下键交接实际Listbox选项，列表继续由现基础组件处理导航和多选；Escape使用SearchField的清空行为。

选择仍只有selectedProjectDirectories一份事实；Listbox只接收当前可见已选项，选项变更合并当前可见集合，保留搜索隐藏的原选中目录，沿现ComposerReferenceSelector相同的可见选择合同，不引入第二选中缓存。resetForm清空查询，不改编辑快照、原scope/session target、条件版本、日历比较、长请求和写入服务。项目/Automation的公开路由、API（Application Programming Interface，应用接口）、schema及LLM（Large Language Model，大语言模型）请求均不改。

全仓已核对所有Listbox多选消费者（另一个是ComposerReferenceSelector）、SearchField键盘合同、匹配服务、短项目名称函数及其两现消费者、Project discovery/current和Automation目标解析/提交，以及旧646–648/829范围。检索发现project-ledger-display-name.test.ts对侧栏/主页显示文案进行自动断言；按用户禁止保留UI自动化的要求删除，不运行、不移植为另一个测试。全仓无独立脚本/fixture只为此文件服务，通用纯服务运行器保留。text-search是纯数据筛选服务，本轮不修改这些服务、不为UI编写镜像测试。依据[W3C列表框键盘/多选合同](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)保留焦点与选择分离，参考现仓库受控可见多选实现；Kobalte网页Listbox专页当前不可达，API依据已安装类型及现生产调用，不换依赖。DOM即Document Object Model（文档对象模型）。

风险在搜索隐藏选项后的多选合并、清空/无结果后的选中保留、搜索Enter误提交、原生键盘和匿名名称/长路径视觉。真实验收将覆盖两不同项目分别筛选/选择、清空后两项仍选、零结果/恢复、取消/重开、同一远期定义编辑及公开target IDs回读；中英文、鼠标、方向键/Space/Enter均人工实测。先通过原表单创建自有2099年两目标定义并暂停作为基线，候选编辑同一原ID；原定义和所有旧历史保持。非UI能力没有替换合同，不需要修改服务测试。补当前07-panel与三索引、普通类型/语言/build、实页和正常Git交付。

原界面已真实保存并暂停本人定义atm_g0VZhCcWe0007YAwbWFW，版本atm_g0VZhCfoO00jpJeMAxhp；2099-01-05 09:00 Asia/Shanghai、nextRun4071258000000、lastRun null，两个目标分别为原827匿名项目prj_hU2x5qELOWzhTRNnVUxn与Idle stop review 836/prj_h1LNzctnkMfyYf3ccSFP。04原图和公共回执证实详情只显示Selected projects，却没有实际目标名称/目录，用户不编辑就无法核对运行位置。这是同一作者旅程的新确认缺口：详情消费target.scope却没有呈现target.projectIds，不是后端丢目标。

因此同步在只读详情增加目标项目清单，从当前selected定义的真实projectIds派生，复用同一项目标签和现discovery对应的真实目录；读取不到目录时完整显示原保存ID，不伪造或丢弃身份，不改变writer。新增清单使用普通语义列表与现表面/字号/间距，边界内可滚动；不把交互控件塞入列表框选项。候选保存后必须在详情直接看到这两个真实目标，并通过公共API确认仍是原两ID。仅新增呈现与筛选，仍无持久格式、执行调度或模型变更。

## 实施与最终验收

候选after/38522实页主脚本main-D-dJxxLr.js。作者状态隐藏冗余页头新建入口，编辑和新建均以原名称输入及截图11/13复核；列表/只读详情新建仍可正常进入。项目选择复用同一个短名称格式和多词元数据匹配，现单一selectedProjectDirectories保留隐藏选择，仅由当前可见集合接收Listbox多选修改。搜索/数量/空状态均中英文，Enter停在当前作者流程、方向键交接现选项、Space多选、Clear/Escape恢复均实测。

06–10真实显示1/62但已选2；Space取消可见827后计数1，改搜IDLE 836时原隐藏目标仍选中；再选择827、清空及零结果均保留两项。搜索Enter后公共定义和revision逐字段等于原快照；编辑改名/选择后取消也完整相同。重开原Name/两目标/2099日历保持，再改名“项目目标筛选验收860 AFTER”、调整原提示词，并在只显示827的筛选状态保存。仍是同一ID，最终revision atm_g0VZhExRb00EjCX5i7L1；公共两项目ID、原完整日历、nextRun4071258000000、paused、lastRun null均正确，旧两条定义完整保持。只读详情直接呈现原两目标名称和完整目录。中文再次搜索、零结果、Escape、Space取消/恢复及取消后公共最终定义与已保存快照完全相同。17张原图均亲自呈现并人工查看，见[证据](../../artifacts/2026-11-01-scheduled-target-review/README.md)。

检索到的显示名称UI文案断言已按规范删除，未运行、未新增替代测试。没有更改匹配/名称/日期纯服务、API、条件版本、schema或调度；不声称缺失目标删除场景、实际模型运行或竞态故障注入通过。类型最终检查退出0，两语言2682键检查与普通前端build/renderer public surface检查均0。

两个自有页面均关闭，公开shutdown200、原exec/native/launcher退出0，物理/输出/请求和出生身份结清，四份配对认证/完整目录副本退休；最小截止余量2507429ms，未延期。schema始终9/92表，原234523行逐列保全，最终234537：before新增两版本人定义、四目标版本行、一远期Fire与一组正常lease/grant；after仅一版本人编辑、两目标版本行与一组lease/grant。全部原数据库及源库、140附件、62项目文件/Git身份保全，文件排除0。最终交互后9Goal公开状态/用量/轮次完整一致，模型新增0/累计1180，源认证元数据和完整模型目录原字节/元数据保持。

用户18571/真实数据库/窗口未操作，原176项无关工作区状态与共享索引工作内容保留。三索引只加本条，交付使用当前docs检查、独立范围提交、fresh fetch/普通merge、完整待推集合复核、正常hook推送和远端回读，不创建分支/工作树或发布。
