# 输入语义边界根因修复与不同任务真实复验

## Recall与授权

用户最新要求：“先查清归档任务为什么误拒合法 Windows 源路径、通用验证为什么没发现它，从根因修复，再做真实端到端复验，继续用不同任务更新详细故障清单，别只手工补这份程序。”本轮在当前2c37ede22基础上修共享行为原则与检查器盲区，保原R01–R05、原R04错误程序和原三个通过结果，不手工救旧候选。十题探索/benchmark automation继续PAUSED，不启动Codex对照、不委托、不操作用户窗口/进程、不UI自动化。

已读AGENTS、benchmark-debug-template、上轮完整Recall/FAULTS、R04源码/完整自测/HANDOFF/合同、当前verification fragment/真实LLM投影/完成schema和manage_task描述、现有native runner/消费者及inspect-benchmark架构。全仓搜shared verification定义和调用、forward slash/backslash/path separator规则、engineering-craft和bash工具说明。当前共享文件工具的路径协议约束是各自字段专属；检索没有发现全局要求生成业务程序拒绝Windows反斜杠的规则。一次猜测prompt/system.ts路径不存在，只读错误，实际定位为session/system.ts；不作为产品故障。

## 已证根因与影响面（修改前）

1. 业务控制流：R04 main.relative_parts对反斜杠统一抛ValueError，load_entries同时用于source和target。源属于本机文件系统，目标属于ZIP命名域；原合同仅目标要求正斜杠。Path读同一源字节及原正确witness native0与原候选native1已实证。模型自行增加的portable source限制没有原用户依据，HANDOFF重复该限制也不能改变合同。具体心理原因/唯一提示因果未知。
2. 模型自验盲区：40个随机文件改变字节/顺序/数量，所有source仍用`dir {}/same.bin`等正斜杠表达；测试覆盖了target反斜杠拒绝，却没有独立核对source合法表示。使用成熟zipfile/Path不代表周围自写validator保留这些库的输入域。
3. 主方检查器同源盲区：bundle_cases三个source都写死正斜杠。输出字节/索引预期独立，但“哪些输入合法”的分类没有独立于实现习惯。原正确witness/错误prototype主要证明二进制/嵌套名等已枚举维度，不能证明跨字段语义。旧汇总status=passed容易把固定池相符看成完整合同已验；上轮人工复核才暴露缺口。
4. 通用规则缺口：现有文本要求合法变化与独立expected values，但没有明确让新增validation/normalization的可接受域也由原合同/对应边界的权威定义，或要求相似字段共用规则前证明语义相同。修复该规则和实际生成/消费不同角色的输入；不加host业务gate/状态机/评分阈值，不写Windows/反斜杠关键词路由。
5. 投影/完成：唯一verification fragment通过LLM.composeSystem供coding/orchestrator/完整runtime。完成summary引用同一原则、保schema字段与生产事务不变；单测只证真实可见说明，实际效果由本轮消费者核证。无新调度、恢复或并发异常证据，因此不扩生产调度横审；HTTP测试服务只是本轮自有可控业务依赖。
6. 风险/排除：有限真实试验不能证明总体故障率下降/根治。非UI后台程序/API验收，不需要独立前端/视觉基线。原归档源码不改；本轮修的是OpenCorvus共享工作方式与验收覆盖，不把作者补程序当模型能力。无持久schema/发布/版本变更，无不相关清理。

## 当前唯一实施与事前验收

- 改当前shared verification：按值的角色、来源/目标系统和语义确定允许域；相似类型不能自动共享validator/normalizer；验证合法性分类本身须有独立权威依据，新增限制不能来自作者程序；对接口适配用实际允许的等价表示核保留效果。改完成summary的引用说明，不增host字段或强制工作流。
- 当前bundle消费者新增由本机Path语义生成的合法source表示，target保持原ZIP合同。保存每个输入和原始来源证明。对原R04封存程序和原候选前正确witness各作一次同新消费者验证，保原三项，不改旧分；应观察正确witness全相符、旧候选在新维度被拒收。
- 两个新的不同完整程序：HTTP批量文档下载（业务ID→URL单段编码→响应字节→本机文件/receipt），以及温度监测报告（不同单位的原值→统一温度→校准→阈值状态）。分别用真实本地HTTP依赖/最终文件字节和独立明确温度结果消费，避免只在另一个文件题里重复同一反斜杠答案。
- 新消费者先正向验证完整正确witness及真实错误prototype；只作工具有效性，不作模型结果或小时资格。冻结公开合同/原型/私有输入/独立预期和运行器后才启动新模型。归档公开合同/原型/operator prompt保持上轮原文，不向新模型透露旧失败、私有case、参考源码或此Recall。
- 当前唯一runner以明确CASES列表配置入口、kind和已有consumer，删除退役phase→固定题池的控制分支；phase只作记录标签。自然结束与实际消费分列，汇总不再用passed表示整题合同认证。原历史runner副本/结果保留，不新增平行服务或调度实现。

## 真实执行边界

新原根`D:/opencorvus-benchmark-runs/contract-domain-repair-e2e-20261101`。本轮先执行一个新归档Task、一个新HTTP Task、一个新温度coding Session，均同当前产品和声明stdlib/runtime，使用新自有隔离实例和成对auth/models staging。分别核credential usable/catalog projected/actual gpt-6.1-sol/streaming；本轮新上限180实际请求含预检，不复用任何旧额度/副本/服务。用户本次明确授权真实端到端复验，普通执行不再逐步询问。

无活动180秒按真实事实更新；每个自然完成项目/Git/源/原交付先复制封存，再由消费者在独立目录读取原pyz/真实服务与数据。记录每次原工具错误、native失败、自然终态、独立结果、根因/恢复/未知；模型无私有验收反馈、不补原交付。若新结果仍失败，保首错并分析通用层缺陷，不把手工参考或重复相同case过关当效果。

结束正常dispose自有实例、移除staged凭据、源不动；保所有原始事实。聚焦正向测试、类型/docs与正常完整Git hook验证，范围commit、fetch merge审全部待推再push；保工作区overlay/媒体删除/索引/Bun等foreign，不branch/worktree/reset/clean/rebase/force/noverify。最新逐次故障清单另存本轮目录并连接上轮记录；新结果不能倒改上轮失败或宣称全域根治。

权威依据：[Python Path按本机系统解释路径](https://docs.python.org/3/library/pathlib.html)、[urllib URL quoting](https://docs.python.org/3/library/urllib.parse.html#urllib.parse.quote)。新温度换算及阈值为本任务明确给定的业务合同，不宣称医学/物理安全认证。

## 实施与模型前真实验证

已实现共享输入admissibility原则及公开完成summary的分类依据说明，schema形状和host事务不变。当前runner明确配置三case/入口，汇总status=completed只指执行结束，registeredCasesAgree另列固定输入结果；移除退役phase→题池分支。新原根registration在2026-11-01 21:49:14（Asia/Shanghai）冻结，之后才开始新Provider；归档公开合同、原型、operator prompt逐字与原R04相同，私有期望/旧失败/参考/Recall均未提供。

新版归档消费者对原R04完整原pyz实测：原nested-binary/unicode-order/reversed-manifest各0，新native-source-representation为1；原候选前正确witness四项全0。仅这一次新范围消费，原三个结果不回改。每个源字段附本机Path与实际字节吻合证据，不用自写portable validator给合法性作真值。HTTP与温度完整正确witness均全相符、真实错误prototype均被当前消费者检出，HTTP证据包括实际GET wire path和输出字节。

新任务重用现有JSON数值比较primitive时发现bool是Python int子类：旧helper的numeric分支会误拒合法JSON boolean。只在该唯一helper先处理真实bool、保numeric语义，新增True/False成功对象正向测试；原forecast无bool预期，旧评分未改。全仓核当前调用仅forecast/新domain及其tests。50项聚焦后端测试、五项Python消费者测试通过，core package tsc通过。它们只证明政策投影/工具及消费者，不当模型成果。

实际新归档Task为tsk_g00VZjH6bI00LSmU24SV，当前自然执行。已观察一个typed工具错误：将公开attachment下载到Task根之外的临时路径，被TaskProcessBoundaryError拒绝；随后改项目内.review-delivered.pyz继续检查。它是工具授权域，与业务程序允许的本机source语义不同，不放宽该边界，也不当共享调度异常。最终结果尚待原件消费，不预填成功。

## 模型结束后的同语义检查器审计登记

三次新执行已经自然结束，当前固定消费者4/3/4均相符，首两Task发布的原pyz与执行文件字节一致并符合原不可变资源引用；实例已dispose。完整阅读当前JSON比较调用发现workflow消费者仍直接用Python `==`比较index/report，bool与0/1可能相等，绕过新修的唯一typed JSON helper。此为相同“表示类型不等于语义域”的工具缺口，不能无证据忽略。

先用原候选前正确witness生成两个完整错误programme：bundle把空文件bytes的整数0改成JSON false，stock把不足库存success:false改成success:0，其他真实流程不变；对冻结的本轮初始workflow消费者实测是否误收。若确证，只改当前workflow的JSON比较调用到现有same_value，不改输入/期望/容差/候选；补正向真实消费者测试并对新R06原程序作一次受影响消费者复验。原初消费原件和冻结源码保，旧R04/R05原分不回改；这是模型之后的检查器修复及明确等价复验，不冒第二次模型试验或效果增益。

## 最新真实终态与修复结果

三次新执行自然结束，控制器2026-11-01T13:49:14.1867864Z至14:06:17.2267544Z/native0（Asia/Shanghai 21:49至22:06）。R06归档Task tsk_g00VZjH6bI00LSmU24SV，R07下载Task tsk_g00VZjJNJk00aPMKO3pr，R08温度Coding Session ses_-zUQGfYK9zzL1TFMvcI2，实际最终程序消费者初次分别4/4、3/3、4/4相符。温度末项为合同正确native2/BELOW_ABSOLUTE_ZERO，不当成功报告或native0。模型没有收到私有grade反馈，没有手工补交付或重新发模型试验。

R06原源码按字段角色区分source的Path.parts和target的ZIP路径约束，旧合法Windows源路径误拒未在新原件出现。但作者自测仍未显式覆盖该正向表示；它由独立消费者检验，不宣称自验习惯根治。R07原ID/URL单段/本机路径分别处理，真实GET和文件/receipt均相符。R08原单位物理下界、Celsius换算、校准与阈值分阶段，完整原源码和交接已读。首两Task发布资源与封存、被执行pyz字节一致；真实不可变snapshot/attachment完整性只证身份，功能由实际CLI/HTTP/数据证明。Coding正式项目pyz不强加Task发布要求。

原Provider101请求全部gpt-6.1-sol/streaming/HTTP200，含2预检，三run增量55/21/23；实际投影shared policy97、完成summary50、patch说明97请求，专用helper请求不冒全部参与者同一上下文。关闭后生产SQLite按tool_part_request/outcome连接原message/session核94请求94结果（92completed、2failed、pending0）。R06一次写runtime tmp超Task根、R07一次过期patch上下文，模型自行恢复；其余21工具的R08无观察错误。没有新共享调度/队列/恢复异常证据。正常dispose/errors=[]，成对auth/models副本retired，源字节保留，未用完预算退休，旧服务与本轮终态均不重接。

模型后两份完整错类型programme在冻结初版实际误收，换唯一helper调用后检出；R06原pyz一次受影响复验仍四项相符。完整前后源码/错误程序/初次和修后消费保，原R04/R05结果不改。6项Python真实消费者测试通过（10.285秒/native0），50项聚焦后端测试通过、core类型检查通过。后续docs和完整正常Git hook结果以真实保存收据为准。没有UI修改或自动化验收，没有新的职业/统计成熟或有效小时资格。

原始完整先封项目/Git/交付/资源封到外部complete-project-archives：R06 124687bytes/101成员/824166原bytes；R07 114834bytes/85成员/414228原bytes；R08 49467bytes/48成员/192785原bytes。原生产DB外部保。仓库本轮约2.7MB小投影含可读源码/交付、实际输入输出、canonical工具、脱敏Provider投影、原trace ZIP、准备与两版消费者/收据，不冒完整workspace。初root仅收attachment遗漏R07的artifact_snapshot绑定，读原snapshot事实后补定位，初观察保；是观察脚本缺口，不是模型没发布。

全目标仍是原用户要求的多任务故障诊断与修复。本轮可完成的根因修复和三次真实复验已达，详细故障继续到R08；有限通过不证明所有输入、总体故障率下降或提示唯一因果。旧十题/心跳继续PAUSED，不因本轮完成重新启动旧研究。

提交前影响面复核发现，workflow原来以精确数字相等比较，直接用helper默认1e-8会放宽原索引/库存数字合同。实施前明确：只给唯一same_value增加绝对容差参数、递归传递；workflow指定0，forecast/温度保原默认，布尔类型仍独立。新增完整programme的微小错误字节数与实际输出差异检查，对最终受影响原pyz一次复验，保上次模型后消费而不覆盖。该调整保护原容差，不新增题池、阈值或模型调用。

该容差保护已实际执行：precision-recheck中原R06 true、wrong-boolean-bytes/wrong-success-number/wrong-fractional-bytes各false，保存完整argv/输入/输出与期望；当前六项Python消费者测试再过。docs:check已真实通过352ops/26groups。原两个错误witness源含writer产出的双CR字节，原始文件保，不格式化冒功能修复；精确证据路径的whitespace属性保原始字节，活跃实现仍正常检查。范围暂存只加入三个索引的本任务一行，peer索引重排/overlay/媒体/Bun全保。
