# 成员活动导航的身份与朗读名称

## Recall

509只用一个Codex开发agent。用户要求持续自主体验改进UI（User Interface，用户界面）/功能、优先Sources与Rendering（渲染中）、真实页面复核后提交推送；后来明确禁止子agent，覆盖旧Goal三Astra文字。沿已读computer-use与benchmark-debug-template技能，不委托。上一轮508为progress：0d3e94da91d407a8a7ea33073d002607f37fb01d已正常push、fresh HEAD=origin/main；29/64次Sol真实流式请求、23图、正式无诊断辅助和修正观察器后活跃并发读验。产品未改，仍未覆盖成员流中刷新/同文档断流重连。三个服务/页面及全部auth/models副本已结算退休，未用额度退休。开始status只原.bun/、packages/opencorvus/bun/未跟踪，保留。

已读508 Recall/结算、当前AGENTS、07-panel-reactivity的同角色Session身份/真实参与者归属、ConversationAgentRail完整行/分组/定位、SubagentProgressGrid/Panel/SessionIdentity和subagent-presentation唯一身份工具、两语言目录、当前样式和package命令。全仓搜索compactLabel、agentRailInput、agent_rail.detail.user_input、ConversationAgentRail及样式：唯一组件挂载在App，旧语言键仅该Tooltip使用，两语言均声明；相关test目录没有组件/语言键/compactLabel命中，未运行任何UI自动化。已有服务投影测试不是本轮UI验收依据。

## 修改前分析

508真实页面的AX（Accessibility，无障碍）观察发现两个base-researcher导航按钮的名称从“base-researcher · Running · # Repository Investigation …”起，包含完整委派说明、原Task输入与责任数千字。直接触发为长输入成为record.inputPreview.text；compactLabel无长度边界直接追加整个agentRailInput，aria-label完整输出。Tooltip虽将正文夹为三行，却不影响按钮名称；不是屏幕宽度或底层Message错误。首个问题是导航名称与详情边界混用，不能靠随意截断提示词或删消息补救。

同角色两真实Session在成员选择器、列表和进度卡已通过subagentSessionIdentity使用真实ID后缀，Rail却仍只取record.agentID作为按钮及Tooltip标题。故查看来源A/B前，在该入口缺少相同身份线索。旧416/现行身份合同已修前三处，但Rail没有使用公共primitive（基础组件）。另外Tooltip把所有provider role=user的原输入称为“User input/用户输入”，而当前真实输入可来自编排器/委派；现有参与者归属合同明确role=user不等于人类作者。这里应标明“Input/输入”，保留原文而不重分类消息。

影响为App共用活动栏的Task、普通Session及Mission关联Task导航、键盘/屏幕阅读器名称与悬浮详情；原Session/Message/occurrence（执行轮次）目标、分组/排序、加载和runLocate、Sources归属均继续使用现有事实。本轮没有已观察调度/队列/恢复异常，若出现立即横审全部入口/轮次/终态/重试重启/串并行/多项目。无后端协议、Provider、配置写入、数据库或schema演进；无需迁移，不清数据。风险主要是标签响应性、同角色身份与实际打开目标不一致、Tooltip宽度截断；必须真实点击和截图核对。

## 落地方案与验收

1. 先用关闭508-after完整数据库及五键canonical创建独立agent-rail-identity-509-before，全部90表/所有原字段/主键或rowid/时间精确记录；Source bytes/mtime/schema3/integrity保持。模型预算**before0/after0**，不带auth/models、不创建消息/Task/Goal或效果重放。正式before UI复用508已实际核对的无诊断main-BZjSJ4zp，当前0d与其构建时源码的生产差异仅docs，先核对差异与实际加载script。Source CLI（Command Line Interface，命令行接口）开发/ui18933，原生20分钟边界/180秒启动无活动，内置浏览器2自有页，用户18571不操作。
2. 先在真实旧Task tsk_g00VYhVoHG009opnUqaV上人工键盘聚焦/查看同角色两个Rail按钮和Tooltip、实际打开成员与来源，保存原AX名称和截图作现象证据。AX只作观察，不编写长度、DOM（Document Object Model，文档对象模型）、源码文案或截图断言；不使用/新增UI自动化测试。若没有真实现象，记录未知而不猜测改动。
3. 用现有subagentSessionIdentity及SubagentSessionIdentity呈现Rail的成员角色/真实会话后缀，peer来自同一当前records，非成员继续真实agentID；不新建身份或配置副本。按钮以本地化“View/查看 {agent} · {status}”表达导航，详情保留原input原文；删除旧compactLabel唯一实现，旧user_input键改为input且同步两语言，移除旧键，不加兼容层。成员选择、历史定位、当前occurrence/状态与工具数据不改。
4. 更新当前07-panel-reactivity关于身份覆盖及导航名称/详情的合同。检查现有目录i18n、Overlay类型及正式Node/Vite构建；纯UI变更不写/运行UI自动化或用静态检查替代人工验收。不升级依赖、版本或发布。
5. before公开shutdown200、原exec/native/output/request/launcher/精确出生完整结算后，以其完整源数据建after18935、当前正式构建；由于服务冻结静态字节，不靠重建后刷新同一旧服务伪称新包。实际两语言聚焦/悬浮、同角色两个Rail点击到原来源、同target隐藏重开及必要普通/编排器导航，截图人工复核；通过UI切换自有副本语言，不触碰用户应用。新旧标签、状态、原输入、源身份与原导航事实逐项描述，未知矩阵不扩大资格。
6. after同边界关闭，核对两scope实际模型0/max0、所有源与副本原行、schema/对象/integrity/源bytesmtime/完整canonical。保留原生结算及非秘密证据，不归档数据库、全库dump、完整私有日志。三索引/docs同步；范围提交、fresh fetch/merge upstream、完整待推集合审查、正常push hooks/fresh相等；不新branch/worktree、rebase、force、no-verify、tag/PR/Release。未达的成员流中刷新/传输重连、149目录10秒保存/5秒恢复、Rust父图及其他矩阵继续保留，长期Goal active。

## 原页面现象、数据及实施资格

before18933/原54627/native91304/IAB90，实际无诊断main-BZjSJ4zp；原Task首次带taskID的URL停在首页，点击现有Anonymous cd883e下真实Task后才加载，首份rail观察为空保留，不能作为Task初始URL恢复通过。第二份真实观察四按钮原名称分别747、3937、3948、1722字元；两个成员相同“base-researcher · Completed”标题，原输入确含委派说明。02/03键盘ArrowRight仅聚焦真实按钮，已人工查看两份相同悬浮标题与User input；Enter真实打开B，04图与原Session/ACL来源一致。这是短名称/详情和Session辨识的实际缺口，不是错误来源数据。

before公开shutdown200、原54627 exit0，native/output/request/launcher/精确出生链完整结算，90页关闭，实际模型0/max0。90表152721原行全部字段/身份/时间与源bytes/mtime/schema3/实际对象/integrity/完整canonical保持，Provider activity382→382。复制旧启动helper时默认项目路径日期被整体替换为22，启动横幅打印该路径；逐表复核进一步确认全部表计数仍相同，不能据横幅推断创建了新项目元数据。后续launch改用已存在的实际QA项目目录，不删除是否预先存在尚未知的目录或数据。

生产修改前git diff确认当前组件、两语言、架构没有其他未提交差异。修改只限Rail复用现有Session身份、当前状态本地化短导航名称、原输入详情的中性标题；其旧compactLabel和旧user_input键删除。纯UI不新增/运行测试；当前check:i18n核对目录键/占位符的整体合同，不用源码文案断言或它的通过替代页面验收。未触碰数据库、接口、模型与调度。待正式after页面实际复核，未提前宣称通过。

## 第一版视觉反馈与同范围修订

after18935/原51493/native91396/IAB91，实际main-BZfoDLYa自动打开原Task；初始原Task URL路径已真实呈现，和before首页现象不能仅按默认目录横幅归因，初始选择差异根因仍未知。05图及原只读观察显示两个新名称均39字元、DP6d/ByPb与原Session/Message对应；同文档原输入仍完整留在Tooltip详情，标签改为Input。Overlay TSC（TypeScript Compiler，类型检查器）原34347及i18n2527键、正式build原49730/53.27秒均exit0。

人工05图发现局部布局问题：复用的SubagentSessionIdentity根是display:flex的块级span，原Tooltip强标题只预期内联文本；身份自然占一行，后面的“ · Completed”单独成行且带前导点。全仓CSS定义唯一在conversation.css，其他选择器/进度卡依赖该公共flex语义，不能为Rail改共享组件。只在Rail header明确使用grid和既有间距token，把身份和真实状态分别呈现，状态用现有字体/颜色token，移除孤立分隔符；输入正文/240宽及原三行详情密度保持。此反馈来源为实图，不是静态推断代替视觉。

第一after已公开shutdown200、原51493 exit0/native/output/request/launcher/精确出生完整，91页关闭，0模型/max0。before/after各90表152721原行及全部表计数、字段/身份/时间、source bytes/mtime、schema3/实际对象/integrity/完整canonical保持，Provider activity382→382，修正此前关于启动横幅会创建项目元数据的猜测。新建第三个显式review18937零模型scope，使用关闭after完整数据和修订正式UI，仍不带auth/models、三scope总实际预算0；用于完成本批同一视觉反馈和完整中英文/真实导航复核，不将它冒充新模型、重连或扩大29/64旧预算。原before/after记录保持，不重启原服务或覆盖其冻结资源。

## 关联描述的实际根因与最终范围

review18937/原53525/native73068/IAB92，06图已人工查看新身份/状态分行，布局正确。但原DOM观察发现button name虽39字元，aria-describedby仍指向Tooltip完整body，实际description为3943字元，包含整个原输入。安装的@kobalte/core/src/tooltip/tooltip-trigger.tsx第199行真实将打开的contentId作为aria-describedby；当前Button正常转发属性。故只修aria-label不足以解决聚焦时的长内容关联，不能用短名称代替完整无障碍合同，也不宣称已做真实屏幕阅读器语音测试。

本批最终方案收敛为**导航Tooltip只呈现真实身份与状态，完整原输入在其原会话Handoff context中读取**。不override Kobalte关联、不aria-hidden原文、不截断或关键词解析模型提示、不删除/改写任何Message、Part、inputPreview或工具事实。原Tooltip本来三行裁切，实际可见预览只显示Repository Investigation技术前缀，完整消息仍由既有会话原始交接披露拥有；移除这个重复导航预览改善用途边界。全仓搜索agentRailInput与新detail.input键确认只有该唯一Tooltip消费者，删除函数/局部input及两语言中这一过渡键；旧user_input键已删除，不保留双实现。原inputPreview其他进度卡/会话调用不变。最终页必须实际展开Handoff context确认完整原输入可读，并分别点击A/B到原Sources。

review公开shutdown200、原53525 exit0、native/output/request/launcher/精确出生完整，92页关闭，模型0/max0。追加显式final18939零模型scope，从关闭review全量数据及正式新包验收最终实现；四scope总实际/上限仍0，不复用活跃服务或任何旧模型余量。只在当前UI分析范围内继续修复，不扩为无关清理。最终需要英中名称、真实关联描述、标题截图、两Source、原输入披露、编排器定位和侧栏保留；缺项如实记录。

## 最终实际验收与收尾

最终final18939/原70991/native32004/IAB93，实际main-Bv-r8j-J，原Task参数页自动进入当前Task。07图及原DOM事实显示英文A导航name39字元，Kobalte正常关联的Tooltip textContent31字元；15图中文B对应name31、关联内容25。这里按原字符串代码单元计数，没有设长度断言或把它当真实读屏语音验收。双成员原Session与原最终Message身份在新名称、Tooltip、选中面板、来源中一致。

08/12图分别经新英文Rail的真实Enter进入A/arXiv和B/ACL；13图非成员orchestrator Completed原入口实际定位并高亮Main原卡片，右侧B来源保持。09/10实际展开原会话Handoff context，原输入3893字元的呈现含Repository Investigation、原Task、Original Request、Reason、Question及Dispatch evidence首尾均可读，原data/inputPreview不改。原文从导航重复预览收回唯一会话详情，不加aria-hidden、override或提示词解析。

14图经真实Settings Appearance切中文，15/18两身份Tooltip与状态本地化，17同B隐藏/重开保留原来源，19/20新中文A入口对应真实arXiv。一次按AX的checkbox称谓作Playwright role查找未匹配，未计成功；重新读实际AX172/171后完成真实隐藏重开。原Cua输出和图保留，没有UI自动化。最终browser errors/warnings观察为空仅补充事实，不能替代20张已人工查看截图。未做真实屏幕阅读器软件/语音、全部状态、普通Session/Mission独立页或新活跃流/传输重连验收。

最终UI不再使用input预览，删除唯一agentRailInput及局部变量、旧user_input及中间input键，全仓搜索确认其三个旧Tooltip section样式只服务已删除块后一并移除；其他组件/字段不动。最终Overlay类型检查原73465、两语言目录2526键、CSS（Cascading Style Sheets，层叠样式表）token检查均exit0，正式Node构建原14153/52.56秒exit0；前两构建原49730/53.27和14261/51.75同为exit0。生产差异格式检查通过，原始构建日志保留自己的空白输出。未把静态或构建检查冒充视觉或性能达标。

四scope before/after/review/final原54627/51493/53525/70991皆公开shutdown200/exec exit0/native physical-output-request-launcher/精确出生链完整，90/91/92/93页关闭；各实际模型0/max0/exhausted false，不带auth/models、无凭据使用。联合数据核对四scope各90表152721原行/全部表计数/字段/rowid或主键/时间保持，原源bytes/mtime、schema3/实际对象/integrity/完整五键canonical相同，Provider activity382→382；没有用户进程/窗口/18571数据库操作、清库或迁移。仅最终自有浏览器语言偏好切至中文。结果及原始结算见[20图与完整证据](../../artifacts/2026-10-22-agent-rail-identity/README.md)。

当前原Task参数首次打开在before停首页、其余三个自动恢复的差异根因仍未知，不能据启动默认路径相关性宣称修复；作为后续入口调查。完整149目录10秒保存/5秒恢复、Rust父图、成员流中刷新/同文档重连及其他矩阵保留。三索引与当前架构合同同步、文档/架构检查、范围提交与正常upstream同步/待推复核/push收尾，长期Goal保持active。
