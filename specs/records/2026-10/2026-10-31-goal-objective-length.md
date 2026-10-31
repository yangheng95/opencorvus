# 从长草稿进入持续目标的长度边界

## Recall

用户要求持续单agent自主体验整个产品，找到真实问题后修复、实际页面交互和截图人工复核、范围提交并正常推送；后续单agent要求覆盖原Goal多人文字，不委托。上一轮为progress：e73c612f3b5c6d7729f91a93f299598b686fe19e已推送，2026-10-31T05:28:27Z fresh main/upstream0/0；26普通文件干净、三索引自有行各一次。Sources长路径单行/末段优先及完整路径、复制、文件、行列、摘录、搜索、网页和附件实际闭环；17截图已人工查看。两原服务exec/native/launcher0、public shutdown200、物理/输出/请求/出生身份结清，配对auth/models副本退休。最新source-path-826-after为schema9/92表215870行，原十三QA项目Git/28 tracked、75附件、十三+三十九文件保持；模型累计1118，本轮从0新请求开始。用户18571真实服务/数据库/窗口不操作，不建branch/worktree。一次Dependabot重扫已用，不能重复。当前媒体清理、L01/L06及发布任务改动保持。

已读当前AGENTS、07-panel/continuous-goal入口与共享表单合同、809预算与原生校验、818首页可见入口、823实际自动项目与自然完成、750预算生命周期和826最终证据。全仓读取ContinuousGoalControl的source/刷新、草稿/创建/预算/提交/错误、App与SideChat全部生产挂载、唯一HTTP服务、后端schema及工具调用。当前正常入口和首次执行已有实际证据，不为旧反馈重新改版。另核查“无Goal时高度为0阻止刷新”的代码线索：刷新读取的是parent，而主入口parent为填满的chatSection，SideChat为side-chat-panel，不是空Goal自身；目前不能据此判定刷新/调度异常，不修改该路径。

## 调查范围与实施前分析

当前新线索是objective从Composer草稿程序化带入TextArea.value，UI（User Interface，用户界面）仅声明maxLength=16000，而save只检查trim后非空。后端ContinuousGoalCreate是trim/min1/max16000。HTML（HyperText Markup Language，超文本标记语言）约束对程序化预填与用户键入的行为需要实页证明，不能据代码直接称bug。Home确认先创建会话/自动项目，再由当前会话控件提交Goal；若超长值通过前端，可能出现400和空项目/会话。具体浏览器行为、错误/副作用与是否需要产品改动均未知，先真实复现再补根因和实施决定。

影响面包括Home、已存在Chat/Work、Task/Mission和SideChat共用Goal表单、通过+及/goal的同一草稿、原长度/去空白边界、客户端原生校验及焦点、自动项目启动、错误保真、SDK（Software Development Kit，软件开发工具包）/API（Application Programming Interface，应用接口）和数据。当前不改公开schema上限或启动策略，不制造消息或Goal事件；只输入本人构造的本地验收草稿，不改原历史。若有调度/并发/队列/唤醒/恢复/终态异常，立即横审全部生产入口、Task/Mission/Session轮次、正常/终态/重试重启/串并行/多项目；不能以模型或个例降级。

## 验收方案

新goal-length-827-before/38441从已完全退休826-after完整备份SQLite、配置、durable publication/包revision与75附件namespace，冻结同一main-2S0VY1ep.js。候选after/38442只在问题和实施方案明确、普通前端build/type成功后启动。首启固定60分钟绝对截止，两scope共用，至少五分钟结清余量，不重启或延期。仅启动原生开发serve /ui，不单开Vite；自有隐藏IAB（In-App Browser，内置浏览器）页实际交互与截图人工复核。配对复制已授权OpenAI认证和完整模型目录、本地验证OAuth/精确gpt-6.1-sol投影，但本轮每scope模型请求上限0，不启动合法Goal执行或发消息，累计保持1118。

基线从完成加载的New chat进入首页，输入16001字符草稿，通过真实可见Goal入口带入，观察字段长度、实际校验、错误反馈/焦点及确认后真实HTTP（Hypertext Transfer Protocol，超文本传输协议）和项目/会话事实。不用DOM（Document Object Model，文档对象模型）检查冒充视觉，允许只读诊断约束来源；不新增/修改/运行文案、DOM、组件、浏览器fixture或截图自动化测试。若真实缺陷成立，先补齐现象/触发/根因/旧遗漏/定义调用/公共合同/数据/测试/文档/交付风险后再改。候选覆盖超长带入、纠正输入、原空目标校验、指南返回/取消重开和两种界面语言，合法值只编辑/阅读/关闭，不宣称本轮重新执行Goal；823自然完成证据只作既有回归背景。

原十三项目Git/28 tracked、75附件、十三+三十九原文件，旧Task68/Mission80/Chat3/Work8、报告Goal12/380471/1、823预检2/Goal9/242063/1、824六消息/两94与90字节Source、825两/四消息、网页4/2和文件3/8、附件4/176字节完整HTTP与92表原行各列保持。本轮可能新增的空项目/会话须从真实输入与writer事实解释，不清理原数据来迎合检查。公共shutdown200、原exec/native/launcher0及物理/输出/请求/OS（Operating System，操作系统）出生身份结清后退休配对副本，源认证元数据和模型目录字节/元数据保持。同步架构/证据与三索引，当前docs检查、范围提交、fresh fetch/普通merge/完整待推集合审查、正常hook push及fresh远端回读。长期Goal保持active。

## 真实基线、根因及实施决定

38441/main-2S0VY1ep.js 的实际New chat首页正常，01确认可见持续目标入口与原Composer/starter布局。本人输入16001字符草稿，从Open goal带入原表单；02及只读诊断显示value.length16001、maxLength16000、tooLong=false、valid=true。点击Start goal后确实发生Home→新会话导航，04显示泛化请求失败及新Anonymous项目，05展开原始响应为HTTP POST400、objective/too_big、<=16000。06关闭表单后空Work与原长草稿并存。完整HTTP确认新会话ses_-zUQOZSwyzz3zVNCFWmY零消息、Goalnull，新Project和Session各一、目录在本scope runtime/data/projects内，22原文件保存；Provider请求0。这是当前实页和持久事实确认的问题，不是根据HTML属性猜测，也不是调度/模型/迁移异常。

直接触发是Composer草稿以value程序化带入；原maxLength只限制用户编辑，本次真实浏览器没有将预填标记tooLong。控制流为shared save仅检查trim非空→Home launch→main.onStartGoal→createGlobalConversationSession先创建项目/Session并迁移草稿→GoalFormRequest→当前会话mutate→唯一后端schema拒绝16001。809修了预算的原生边界与安全整数，但没有检查预填objective长度；818/823入口/指南和自然完成未覆盖超长输入。后端正确维持16000，问题在副作用前的UI校验遗漏。

全仓核对仅ContinuousGoalControl声明该UI maxLength并提交create；App的Home/主Chat/Work/Task/Mission及SideChat全部复用它，Home请求转移仍同一组件，原服务/工具均走后端ContinuousGoalCreate。当前不改API/SDK、schema、持久格式、自动项目或调度策略；LLM工具输入仍由后端原schema校验。客户端已有的16000声明提为同一私有常量供maxLength和save共用，没有另加策略面或两个客户端实现。save在创建输入构造/launch/mutate前校验trim后的原字符串长度，超限使用新本地化错误key进入既有Feedback，保留完整原文、预算/草稿和当前页面；同一错误分支将焦点回到原Objective字段，其余错误沿既有Feedback焦点。两语言各新增一个带本地化limit数字的长度提示；不截断、不自动创建/清理数据、不增加公共校验副本或新Dialog。

风险为误拒合法trim边界、已有表单错误焦点改变、取消/指南重开丢草稿以及Home/已有会话行为不一致。候选实页覆盖英文16001、中文超限与纠正、16000及仅边缘空白的值、原空目标原生提示、指南返回和关闭重开；只提交无效值，不启动合法Goal或模型，未执行部分明确限定。当前没有产品UI自动化测试，纯UI不新增/运行任何自动化测试；类型/双语/普通Node构建/docs只作辅助。基线已public shutdown200、原exec/native/launcher0结清并退休配对副本，余3297454ms；215870原行全部列保持，新增至215944含真实新项目/Session及其发布/记忆/运行租约事实，没有Goal或模型请求。候选继续同一截止，不延长。私有SQLite reader初次把null-prototype行与普通对象直接比较失败，已改为比较真实id列表后原验收成功，未放宽实体或数据要求。

## 首候选的实际复核与阅读位置修正

38442/main-0fQEC_Yr.js 的07实际点击Start goal后保持launcher页，完整16001字符、120000/2预算和焦点均保留，显示16,000明确提示。08展开预算时，Objective聚焦使正文回到上方，但尾部共用Feedback只有标题处于折叠线内，说明正文在可滚动区域更下方；09纠正为16000编辑值时提示清除。07通过不足以宣称预算展开状态也最佳，需补修阅读位置。

根因是新增字段长度错误沿旧全局预算Feedback放在表单尾部，与Objective纠错焦点相距整个展开的预算正文。采用现TextField.Root.invalid及ErrorMessage原primitive，将这一字段错误直接放在Objective下并关联原字段，role=alert；其他预算/状态错误继续原唯一全局Feedback。同一validation信号派生，不加状态/错误副本，互斥呈现，原字符/预算/后台契约不变。此为真实视觉结果驱动的修正，不强制折叠用户预算或隐藏说明。首候选已公开shutdown200、原exec/native/launcher0、余2806320ms退休配对副本，215944→215946仅runtime lease/grant各一，空案例22文件/原行保持。最终after2/38443继续同一截止，重新构建并冻结实际新版本；不因观察超时重启，也不抹去中间截图。

## 最终实页与数据结果

38443冻结main-DREqu_ht.js。10实际提交同一16001草稿，错误直接在Objective下方、原字段聚焦、URL仍为launcher；11保留120000/2且预算展开时完整提示可见。12将原字段编辑为16000字符，原校验清除，About goals→Back to form仍是同一值/预算/展开状态；13关闭后可见入口重开保持。14清空并点击Start goal，原本地化Enter an objective原生提示与焦点正确。15从Composer带入边缘空白，原16002/trim16000仅作编辑阅读，未点击合法启动；不把此状态观察写成有效Goal执行通过。

经本隔离页自身外观设置切换简体中文，16显示“目标内容不能超过16,000个字符，完整草稿已保留”，原文、页归属与焦点正确；17纠正为短草稿后关闭重开保持。18实际打开基线留下的原Work会话，从原+→持续目标/goal菜单进入，提交相同超长值，同一字段提示而原会话/Goal事实保持。最终无关Task/Mission/SideChat没有逐个实页新启动；只确认它们共用该组件，不扩大验收范围。18截图均实际呈现查看，没有新增/运行UI自动化、DOM/文案/组件/fixture/截图断言；只读长度和validity是根因诊断，不是视觉验收。

完整旧Task68/Mission80/Chat3/Work8、两完成Goal、报告12/380471/1、823预检2/Goal9/242063/1、824六消息/两94与90字节Source、825两/四消息、网页4/2Source、文件3/8Source与附件4/176字节HTTP逐字段保持。基线空会话完整导出仍零消息、Goalnull、selection一致；原22文件/Project/Session各列保持。最终SQL回读新Session/Project均0，是实际诊断计数；保护检查以原实体和完整内容为正向合同，没有将“不调用”或UI文本断言作为测试。基线的两条outbox事件实为session.created/session.updated，新增memory_file/chunk均归新Project，不能误称Project事件或模型消息；全部原92表各列保留。215870→215944→215946→215948，两个候选各仅一对runtime activation lease/grant。schema9、integrity/FK有效，75附件namespace、十三旧项目Git/28 tracked、十三+三十九原文件及空案例22文件全部保持。

三原exec80608/36108/5634与native/launcher全0，各public shutdown200；物理/输出/请求及OS出生身份结清，配对认证与完整模型目录副本全部退休。第一次固定deadline1793428481596未变，结清余3297454/2806320/2375476ms。本轮每scope请求0、累计1118，源认证元数据、模型目录字节/元数据保持；用户18571/真实DB/窗口/进程未操作。没有新的Goal或模型执行；既有823真实自动完成仅作历史背景。

最终`bun run --cwd packages/overlay typecheck`、普通`build`（Node Vite/renderer公共面）、`check:i18n`（2662键/两语言）和当前`docs:check`通过。具体证据见[产物入口](../../artifacts/2026-10-31-goal-objective-length/README.md)。生产变更仅共享表单及两语言键，当前07-panel合同同步；不改版本、API/SDK/schema或发布。保留媒体删除、L01/L06/发布任务的无关工作，只提交本轮文件及三索引自有行，随后fresh fetch/普通merge、完整待推集合审查、正常hooks push和fresh远端回读。长期Goal继续active，不将本批交付当作停止。
