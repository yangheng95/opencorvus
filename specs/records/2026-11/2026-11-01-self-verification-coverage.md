# 模型自验的语义覆盖缺口：根因修复与新任务实测

## Recall

用户：“继续查为什么模型自己的测试还是漏掉合法本机路径，从通用层修复，再用不同的新任务做真实端到端验证并更新故障清单，别把外部检查器补测通过当成模型自验已经改善。”本轮仅推进该授权：调查R06所有模型参与者的实际测试，修共享验证行为，在两个新领域作修前/修后独立真实执行。旧R01–R08原件/分数不改，十题心跳继续PAUSED，不启动Codex对照或root子agent，不修旧候选。

起点HEAD=f8bd73d08。已读AGENTS、benchmark-debug-template、前轮Recall/ROOT-CAUSE/FAULTS、R06源/测试/HANDOFF/53工具原事实与普通Message、共享verification/完成summary、engineering-craft、coding、base owner/tester/method、真实runner及Inspect边界。全仓搜共享原则/完成工具/role与coverage调用，实际拼装测试覆盖coding及完整runtime。一次搜索误写apply-patch.ts路径，实际是apply_patch.ts；一次inline Python引号SyntaxError、一次观察输出cp1252错误，前者没有执行statement、后者已保存原事实后打印失败，均是root观察工具问题，不作模型故障或生产异常。

外部原根`D:/opencorvus-benchmark-runs/self-verification-coverage-e2e-20261101`，原R06可观察事实及本轮开始staged index/status已先保存。当前59个foreign暂存项与其他overlay/媒体/索引/Bun改动全部保留，不混提交。若交付时仍有foreign staged，使用仅本任务条目的临时Git index形成范围提交，再精确更新本任务index条目；不stash/reset/branch/worktree或篡改foreign blob。

## 修改前已证深度与影响面

1. 直接现象：R06源码validate_path用Path.parts处理source、split('/')处理target，且仅target拒反斜杠。实现已识别角色差异。原test_delivery的合法source全由手写正斜杠字符串构造；创建文件时调用Path不等于manifest字段被序列化为本机表示。target非法输入测试不能给source正向条件提供证据。
2. 模型实际执行：owner原part prt_g0VZjHcDp00lCdKckN9Z运行四项unittest并过。内部Tester part prt_g0VZjIfIM00MQTO6JHZR实际生成`folder %d, é/same.bin`的source，扩Unicode/块边界/乱序/JSON escaping，共七次实际归档；同样全部正斜杠。随后重跑owner原四项并accepted。独立参与者和输出独立预期没有自动产生独立的语义覆盖；只看保存测试文件也会漏记这些实际模型测试。
3. 失效链：producer从公开样例和主要已坏效果设计测试，正确实现里另加的分角色校验没有对应的判别性正向输入；Reviewer扩充的是既有样例维度。最终“测试完成”的证据覆盖payload/顺序/目录/块大小，不能证明序列化后的source域。没有证据证明模型被全局Windows规则误导、环境未投影或工具阻止构造该输入；具体内部注意力/随机因果未知。
4. 前轮规则为何不足：它定义输入合法性的权威和应测等价表示，却没有要求将具体实现决策与能区分合理错误实现的已执行条件连接。模型能写正确的不同分支，同时选择绕过其差异的测试。shared原则存在于实际请求不等于行为执行。新增一张root外部case只能补评估，不补模型自产测试。
5. 现有base method强调producer PASS不是authority、tester独立推导；没有冲突的禁止本机输入要求。engineering-craft要求验证具体改动，需在单一共享原则补明确语义判别/实际输入追踪，不复制Windows专用清单到skill、base-tester或host。无调度/队列/唤醒/恢复异常证据，不扩共享生产状态机审计。没有UI、schema迁移、公开API结构/业务gate、版本发布或无关清理。

## 唯一通用修复计划（baseline后实施）

修改现有verification fragment的相关段落，将“认识合法域”连接到“实际构造判别输入”：从原合同和本次实现决策推导测试条件，问哪个合理错误规则仍能通过现有测试；对物质性的角色/表示/单位/顺序区别，构造合法正向输入强制执行该区别，独立断言要求效果。追踪实际序列化/传入值、最终入口、观察值与断言；数据创建用了某库、测试名称/数量、阅读正确代码、另一个角色的拒绝测试均不能充当此条件已执行。独立review再从合同推导该链，不能只扩producer已选维度。

完成summary只引用共享原则，明确区分模型自产/实际执行覆盖与外部补测；无新schema/gate/固定流程/新工具/隐藏消息/关键词路由，不强制固定测试数或普遍mutation框架。聚焦正向投影测试及真实模型请求绑定证明可见性，但行为结论只能来自下面原测试/运行事实。

## 新任务、事前条件与测量

新增两个完整stdlib程序任务，沿现有唯一native runner和真实Session/Task/Provider/工具/发布链运行：

- SQLite查询导出Task：manifest中的表/列标识符与相等过滤值属不同SQL语义域，支持已有合法SQLite名称和字面数据；导出实际数据库精确列/行、JSON与原库逻辑状态保留。
- UTC会话台账Coding Session：CSV原ID与带时区时间分别处理；按真实瞬间计算时长、UTC输出/分日汇总，合法不同偏移和跨日/小数秒，明确负时长错误合同。

每题完整原型、公开合同/样例、独立私有预期、原生最终消费者先就绪；完整正确witness及真实错误原型消费仅证工具有效，不作模型结果。SQLite实际创建合法带引号/关键字/Unicode表列名、精确字面过滤；时间预期为手工明确UTC瞬间/数值，不从候选parser求真值。权威依据：[SQLite标识符](https://sqlite.org/lang_keywords.html)、[Python datetime](https://docs.python.org/3.14/library/datetime.html)。不以语句/分支覆盖率代替语义效果。

固定先before两题，再共享修复后after同两题、同公开字节/初始原型/operator prompt/runtime。每次独立自然实例/项目/会话，无前轮答案/失败/私有grader/Recall或中途反馈。两阶段各新140实际请求上限（含preflight），新auth/models成对副本usable/projected/actual分别核，流式gpt-6.1-sol；不复用旧预算/副本/服务。无活动180秒基于真实执行事实，不设agent墙钟门槛。原自然终态先封完整项目/Git/测试/交接/发布资源与生产工具事实，再外部消费，结束dispose且退休副本、源不动。

主指标分开记录：producer自己构造并实际运行了哪些合法语义条件、内部Reviewer补了哪些、root外部独立消费者检出/补了哪些。只有从实际测试数据构造/序列化、调用到断言与原成功回执的链条完整，才能计模型自验覆盖。测试源码中出现关键词、分支正确、只有外部通过、只导入/编译或自述均不足。对可以原样执行的模型自测，评估副本中的完整合理错误programme可作判别性核验；不改原测试/原候选，不把root运行当模型原先执行。若该核验不能绑定最终入口，则明确unknown，不能补wrapper救证据。

修前本来覆盖的条件不计收益；修后仍遗漏记失败清单。每题小样本仅支持具体原件和有限对照，不能证明总体漏验率、提示唯一因果或根治。原始过程错误/恢复/交付缺陷/工具问题逐次续R09起；不按模型成败筛题/seed、不用测试或文件计数计重型资格。保存/复核后聚焦检查、docs、范围commit、正常fetch/merge审完整待推/完整hook/push，foreign保持。

## 启动与原缺口敏感性实证

准备期间peer已推进ad3fc0b49324d415a96dae036841cf1d0166ea71，冻结登记以该真实HEAD为准，共享verification与本轮起点一致，foreign暂存由peer自然提交清空，不把peer提交冒本任务。两个新消费者完整正确witness/真实原型各全相符/被检出，两项聚焦Python测试通过，冻结公开与私有预期后才启动before。

首before选择旧C:/Users/hengu/.local/share/opencorvus/auth.json，缺配套models，模型前失败（0request/0case）；初始日志和result移至before-startup-failed保。按现行runtime-paths的Windows LOCALAPPDATA/opencorvus/data找到了完整配对来源，run_phase先验证两文件存在再调用原runner，原失败没有执行模型或用预算。后续真正preflight核usable/projected/actual由原runner完成。未查询或复活任何旧服务。

原R06敏感性probe：只在评估副本加`not target and backslash`拒绝规则，其他源码和完整原test_delivery字节保；执行原owner的exact-bytes正向方法及原Reviewer七次脚本均native0。当前外部消费者保旧三项0、新native-source项1。原R06主项目不动。该实证证明自验遗漏，不能作为新模型执行或修复收益；原观测脚本/完整wrongprogramme/argv/回执保在original-r06-sensitivity。

## 修前结果与事前方案修订（after尚未执行）

before自然结束/native0，共60实际请求含2preflight；源副本正常退休且源字节不变。R09 Task tsk_g00VZjU1kW00TlEcoBgt，自产六项最终测试实际通过，已构造带空格/Unicode/双引号标识符、SQL样文本/单引号值、BINARY/类型及原库保留；原part prt_g0VZjVL7m00K8OHf3HT5是最终构建后回执。R10 Session ses_-zUQGUOpDzzgGK8wu2PX自产七项实际通过，混合offset的UTC结果、UTC分日、微秒/ID/正确错误均有具体断言，原最终part prt_g0VZjWLsw00vAW8GCxbt。外部消费各3/3、4/4只是另一路。两题修前已覆盖，后续通过不能作收益。

为避免只重复天花板样例，把两个新领域保为transfer/regression；after同阶段末追加R13全新归档Task，原公开合同/初始prototype/operator prompt与R06相同，只观察新模型自己的测试是否补到旧缺口，绝不重开/补旧候选。该追加在after首次模型调用前登记；初始registration保留，after-registration单列修订与原因。after新独立上限180，before剩余80退休不借用，不作同资源收益。旧R06到新回归仍有时间/随机性/版本上下文等限制，仅作具体语义复验而非唯一因果。没有新增旧作者研究或小时资格。

首启动cases=[]而registeredCasesAgree=true还暴露runner对空数组every的聚合盲点；overall status确为execution_failed，没有真实模型通过。当前唯一runner应要求实际case数等于声明case数后才汇总相符。只改评估数据聚合，保首误导字段，增加真实启动失败输出合同测试，明确不算模型自验改善。源码/公开输入/预期/容差不改。

## 最新自然终态、自产证据与边界

before 2026-11-01T14:40:35.061311Z→14:50:56.853647Z/native0，60requests；after 14:55:40.906825Z→15:15:29.421327Z/native0，117requests。两phase共177gpt-6.1-sol/streaming/HTTP200且source-reader全settled。165 canonical tool_part_request/outcome逐一绑定（159completed、6failed、pending0），另5次Bash native非零，共11过程故障；未将同一根因引出的多方法error数当多缺陷。均正常dispose/成对副本retired/sourceBytesPreserved，未用预算退休，无新活跃模型/长计算，不再请求旧服务。

after R11 SQL Task tsk_g00VZjXqvp00kPXoh3G6最终自产五项、外部3/3；模型Tester另54exports+两次empty，在实际授权边界错误后用项目内目录继续，原测试/NUMERIC补测归属分清。它违反原no-delegation，最终披露不当原约束满足；这是新保留的未满足项，不被技术通过掩盖。R12 UTC Session ses_-zUQGPIdkzzZ70ePVhJe自产六项、外部4/4；修前已覆盖，均不计本轮收益。

R13归档Task tsk_g00VZjbPA600hXrQhaLJ自然结束。producer自己新增test_native_source_separators：真实物理源、manifest中的反斜杠文本、复制原pyz/异地cwd/-I、精确ZIP字节/完整成员/index全链。原part prt_g0VZjc8Dj00mPyTldJ3N及prt_g0VZjcPQ100j4gHdAh1S实际五项通过，native方法不是skip。没有Reviewer或委托，也没有root私料/反馈。Task发布snapshot程序与封存/外部消费pyz同字节；root外部4/4另列，原源码未补。

root事后敏感性只改变评估副本中的source_path为拒反斜杠，测试字节不变，R13原正向方法native1（被测程序2），旧R06原owner正向/原Reviewer对同类错误仍0。SQL/UTC两阶段原自产测试对去掉quote/丢offset的错误均失败，故修前已有判别力不计收益。新模型实际执行证据与root后验测试资格化分列。本轮只观察到目标漏项的一次具体自产变化；时间/标题/随机性/有限sample限制保，无唯一提示因果、总体改善率/根治结论。

五个自然项目/Git/资源完整封存ZIP在外部，生产SQLite关闭后原备份另保；仓库约5.6MB投影是原source/pyz/测试/交接/输入输出/canonical事实/traceZIP/冻结前后实现，不冒完整workspace，不含实际凭据。原模型测试按证据保存、不注册为仓库自动测试；root敏感性只执行指定正向方法。首root读档另猜错一次test_bundle.py，真实为已列出的test_delivery.py；保存原tool输出后改准确路径，未改源或模型。formatter错误cwd同样保，不当模型/共享生产异常。

50聚焦后端测试/9项Python真实消费者与启动聚合合同/core类型检查已真实通过。后续docs、diffcheck和完整正常Git hook以实际保存收据为准。维护不替代5次真实model执行，不追补原分/资格，十题心跳仍PAUSED。本轮聚焦工作已执行完，R11流程违约及通用根治/环境覆盖仍明确未满足；后续不自动借本轮预算或重开旧对象。
