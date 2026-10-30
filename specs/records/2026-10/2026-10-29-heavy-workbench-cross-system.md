# HeavyWorkBench H05 横向对照与难度校准

## Recall

- 用户原话：“结果好还是不好，启动一个codex做横向对比，如果都好那就是难度太低了，要升级bench难度”。此前用户已明确没有token额度限制，不能再自行设总量截止。
- 当前证据：OpenCorvus H05无截断轮次真实完成，34分25秒，诊断20/20、外部独立agent非盲业务80/80，两次评估侧实际清洁复跑通过；只证明本题开发业务交付良好，尚无对照/分辨率证据。完整历史在既有H05记录和attempt-4-uncapped。
- 验收：实际启动独立Codex CLI，干净项目只获得相同TASK/task.json与冻结四输入；完成后封存原交付，评估侧实际清洁复跑、真实checker及相同16业务叶非盲审查。比较完整交付、关键项、真实恢复/并发证据、耗时和已记录用量；不拿最终文字或自报PASS作成绩。
- 预注册条件：两系统都满足原业务合格条件（>=80且全部关键叶满分、实际清洁复跑成立），即触发本题难度升级。高分不等于整套十题都容易，也不把异步历史对照包装成统计排名。升级后必须新版本、明确新增业务合同/真实故障与独立判定，不覆盖旧题或旧成绩；再次对照，检查是否仍有天花板。
- 已读：原构建Recall、H05实际运行Recall/原始注册与交付合同、现有suite/prepare/objective和Inspect边界、benchmark-debug-template；已核对本机codex-cli 0.148.0及exec帮助。官方执行/JSON事件说明见https://learn.chatgpt.com/docs/non-interactive-mode及https://learn.chatgpt.com/docs/developer-commands?surface=cli（2026-10-29访问）。
- 全仓搜索：现有Inspect负责OpenCorvus执行；未发现Codex基线适配。Codex自身exec拥有会话、流式模型、工具和完成职责；不新增模型调用器或调度器。薄启动/事件封存只负责显式命令、环境、过滤秘密推理、执行事实与结果。Codex默认凭据由其正常机制读取，不复制、不输出、不交给任务。
- 实验身份：请求同一`gpt-6.1-sol`，实际模型从Codex原生会话metadata核验，绝不静默替换。忽略个人config与外部rules来去除用户插件/外部路由，保留Codex原生工具。当前OpenCorvus历史请求未封存全部推理选项，因此本轮为开发难度探针，不作纯harness因果排名；不伪称相同配置已认证。
- 硬约束：不创建源仓库branch/worktree、不碰用户服务/窗口，不新增运行UI自动化，不读取/泄漏凭据，不让Codex读取评分器/oracle/历史答案。目录分离非操作系统安全隔离，comparable=false。保留并行文件修改；提交本任务范围，fetch/merge/upstream审查后正常push。

## 修改前问题分析

可观察现象为H05完整交付高分，但只有一个系统和一次开发观察。直接触发为用户要求横向对照。根因未知：可能OpenCorvus执行质量好，也可能H05披露根因、单一固定CSV和小型SQL事务使能力门槛较低。此前只验证可解性与评分规则，未做多系统难度校准，不能用格式丰富或过程很长证明任务困难。

影响面限对照注册、原生Codex执行记录、独立复跑/评分及条件触发后的版本化任务升级。生产Task调度、接口、持久化、UI和发布不适用，不改生产路径。风险包括历史答案污染、仅增加数据量/字数、暗改要求、不可解的“严格一次外部副作用”、评分器能被伪造表格欺骗，以及先看结果后改升级标准；用冻结相同输入、原件封存、真实黑盒执行、已公开业务语义、独立可解性审查及旧结果保留控制。

## 执行方案

1. 新建Codex专属运行根和公开输入项目，原文/四输入逐文件比对；记录原生CLI版本、精确模型、无总量截止、环境和命令。
2. 独立Codex只接收同一完整任务。流式JSONL（逐行JSON）事件保留自然消息、真实命令/结果与用量，不保存秘密推理正文；无活动按真实事件/工具状态调查，不机械总墙钟失败。
3. 封存完成版本，在评估侧新目录只用源码和原始输入实际复跑，再运行原H05 checker、独立SQL/并发/恢复核验及16叶审查。原生CLI错误与业务失败分开。
4. 若两方均业务合格，新版本先写清难度机制、输入/公开契约、真实服务环境、独立检查器和可解见证，经既有独立审查agent挑战后冻结。难度来自组合约束、已有状态演进、故障/并发交叠、恢复与审计的依赖链，不以不合理额度和材料堆量替代。
5. 新版本运行两系统对照；保留原版及新版本全部结果和未满足项。验证、索引与Git交付按仓库要求完成。

## 原生CLI设施发现与试验条件更正

首个原生CLI occurrence `heavywork-H05-codex-20261029-1e289e37`启动4.564秒后明确400/model_not_found：gpt-6.1-sol不受该Codex ChatGPT原生路由支持，未执行题目、exit1；原始注册/事件/失败保留，不能评分为业务0。只读非秘密配置表明本机配置请求gpt-6.1-sol，但缓存模型列表仅有其他旧型号，不能凭配置文本假定模型已可用，也不静默切模型。

按用户“启动一个codex”的产品对照目标，改用当前Codex应用的独立新agent，fork_turns=none，仅提供新项目和相同公开任务，禁止再次委托。该原生协作工具不暴露实际Provider/model身份或完整用量，不作同模型因果排名，明确记录未知；不再编造CLI已成功或模型相同。此为新的开发难度探针occurrence，原失败不覆盖。旧OpenCorvus与新Codex均用实际工作物、评估侧清洁复跑及同一业务rubric判断天花板。

## 横向结果与用户新的小时级要求

Codex独立agent `/root/codex_h05_baseline`（fork none、禁止再委托）已完成并提交`5977e59b483fca22ae59a8a1c6da302fac948291`，项目`D:/opencorvus-benchmark-runs/heavywork-H05-codex-agent-20261029-4b158784/project`。主评估者仅7份源码/策略+冻结4输入，实际清洁复跑65.438秒退出0，真实诊断20/20，直接SQL核对12个新库逐身份金额一致。既有独立审查者另在自己的新目录实际复跑62.364秒退出0，核对14库、38条子命令、四进程3292投递及恢复，16叶非盲业务80/80，全部critical满分。旧H05两方均100开发业务点，预注册升级条件已满足。Codex身份/完整用量未知，不作同模型速度/费用排名。

用户最新原话：“我需要那种能执行几个小时的评估任务”“opencorvus用的什么模式？rubric足够难吗”。实际H05 Task原件明确`productPillar=code`、`packageRevisionBinding builtin/base 2026.10.14.1`、direct/native执行；没有Mission或持续Goal。Task本身无总墙钟终止，旧题耗时短不能归因于模式。旧20叶rubric对本题分辨率不足。

**最新方向优先于工程小题升级预案**：几个小时必须来自真实有效的研究/实现/实验/复核依赖链，不加sleep、重复空转、字数和文件数，也不靠消耗token或压额度。正在构建的H05工程v0.2最多是一个子问题探针，未验证小时级，不能作为本要求交付或发布；未冻结原型撤回，设计笔记保留为调查证据。

长程先研究真实完整论文复现任务，使用作者共建、以实际执行/结果为主的成熟rubric，而非20个宽泛写作锚点。已读取PaperBench官方说明/实现、Inspect实现；固定上游`openai/frontier-evals`提交`b78dab1da774a6456b1ed9c48c9ff194ee3ff36d`，原始树及PINN资料在`D:/opencorvus-benchmark-runs/paperbench-discovery-20261029`。PINN是《Challenges in Training PINNs: A Loss Landscape Perspective》，不需HF或外部模型私有凭据，数据可由公开PDE生成，当前GPU为RTX5090 32GiB，Docker29.7.2及Ubuntu24.04可用，Torch尚未安装。硬件/环境可行不等于已验证数小时；下一步先完成来源/许可、实验矩阵及GPU运行资格，再冻结长程任务和rubric，后运行真实pilot。不导入PaperBench默认token/消息/总墙钟上限。

PINN完整官方rubric本地递归统计1963叶（1815执行、126代码、22分析）；这只是结构事实，不以叶项数当难度证明。原研究包含3种PDE、5随机种子、4网络宽度、多个学习率及切换配置、41000迭代与谱分析，完整矩阵可能超出“几个小时”，必须先做实际单步/子实验测时来定义明确且科学有意义的小时级范围；若裁剪则使用新派生版本，不冒充官方全PaperBench分数，也不在看到模型结果后改范围。


## L06冻结新对照接续：保留原运行时干扰

新L06/0.2.0已按唯一18public预注册顺序OpenCorvus→fresh Codex，定位D:/opencorvus-benchmark-runs/L06-current-pair-20261029.json。≥90且critical全过为作者预注册good，两good另升新版本；实际模型/资源不同的comparable=false限制保留。22:06UTC原OpenCorvus仍active，已自然进入base-tester验收，fresh Codex未启动。原候选在35分钟Tool自身期限前被20分钟共享暂停guard干扰且误报180秒，随后自然续跑；这是真实运行时失败，原件不能删，也不能判业务0或据此声称任务本身需要数小时。共享机制修复/真实资格及独立结论见[专门记录](2026-10-30-heavy-workbench-tool-liveness.md)，旧PID未热修。待自然终态封存、同合同独立业务评估后再fresh Codex，当前无新版成对成绩。

2026-10-30 00:27UTC新增：原OpenCorvus封存版本已真正完成评估侧源码基例/两控制新执行与同冻结独立17叶评价，主方实际l06_grade给100/100、47pass、全部28critical通过/business_success/goodtrue。不是参考98、Inspect completion或时长推定。旧运行时干扰与有效小时未认证保留，独立reviewer熟悉参考/非盲AI-agent限制公开。随后新 /root/codex_l06_fresh fork none启动，唯一pair/codex/project同18public，未收到OC答案/私有grader/控制/权重/凭据，禁止再委托，无总token/墙钟截断。实际Codex model/usage未知，仍不作同模型速度/费用因果排名。待自然终态封存及同合同真实冷评价，若也good则另升新版本，当前成对结果尚未取得。


原L06 OpenCorvus在22:34:59.758Z自然完成，Inspect2:30:45/task_completed accuracy1仅生命周期指标。完整版本/错误/自动恢复封存，listener正常退休，原API关闭不当失败。30冻结数值叶主方通过，真正评估侧单一8CPU源码冷执行已启动（动态定位active_evaluation）；17独立人工/执行及输入控制仍待。当前无完整业务分数/good，fresh Codex未启动。独立reviewer正按同冻结rubric审查已封存程序/报告/真实图，明确熟悉参考/非盲；未实测叶unassessed。原运行时干扰和native资源/模型限制保留，不拿墙钟、cache tokens或内部cost0作难度/费用排名。完成真正同合同评价后才启动只含同18public的fresh Codex（fork none/禁止再委托），两好另升版本，不改当前线。


原OC的评估侧基例23:17:12Z自然exit0、C47648.2/固定L47380/30numeric过，主/独立均实际看新图，独立补D01/D08–10/F05 full。只剩关键D02报价/行序两个真实控制待完成，total/good仍null。报价23:20:36Z已顺序启动f9563061...，行序尚未启动，严格一次一组；以动态定位和原终态收据为准，不再请求退休原Task API。fresh Codex未启动，不能拿已有好迹象跳过真实输入计算/评分或预注册对照；两个好再新版本，旧线不变。


## 本轮最终接续Recall

L06最新正式OpenCorvus成绩100/100、47pass/全部critical过；fresh /root/codex_l06_fresh已顺序启动，未取得Codex成绩。实际model/usage unknown、comparable=false；只给同18public，不给私有grader/参考/当前OC答案。完成后真正同合同冷评分，两good才另升新版本。原故障、评估计算和未知间隙不计内在有效小时。


## 最新L06接续：fresh Codex自然交付、评估侧复建中

Codex完整554文件/原Git/所有产物封存，HEAD eef74425dcd9b9d6e161c9aa303b38c90f400e25，原18public完整同一，01:25:16Z是观察封存收据。最终输出validation/source-only-reordered/result，独立30numeric全过/C47641.5，不据此提前给47叶总分或good。实际模型/usage仍unknown、comparablefalse；57分钟左右的候选观察窗口及并行验收耗时不当内在小时证明。

01:26:50Z仅一组评估侧Codex source-only base启动b8af7d5f...，12封存源码/声明依赖/冻结raw/new results/networknone8CPU，保持原README阶段参数。单层reviewer只读阶段评价，private两控制及执行相关叶须实际冷执行后补；原OC100不改。完整同冻结l06_grade且Codex也good后才触发新版本，当前未触发。动态定位/未满足项见长程及L06/L02最新Recall。


## 最新接续Recall：成对两100，已触发另升新版本

Codex注册quote/row已先后自然exit0，C47646.7/47658.4，各30numeric过，完整原件先封存后精确清理CID67ae/7fcb，不重跑。主方和单层reviewer均实际看新三图；独立quote25、row23必要核验通过。review-final.json的17叶full绑定原sealed五路径及codex-L06-eef74425dcd9-phase1；主方实际l06_grade exit0，正式100/100/47pass/全部28critical通过/business_success及good=true，原阶段46pass/D02未评仍留。外部pair/codex/evaluation/final-assessment、final-grade-command；安全归档cases/L06/evaluator/pilot-codex-20261030。原OC100不变，两good真实触发升级。

唯一动态locator active_evaluation=null、fresh_codex.business_grade已写真实输出、upgrade_required=true。所有本轮候选和评估侧完整solver均终态，不再请求退休OC API/重启listener/重跑dataset或旧容器。六旧昂贵任务保持Paused。模型/usage未知、comparable=false及非盲AI审查限制保留；57分钟候选观察窗/并行自验/评估计算不当数小时有效工作。

新L06/0.3建设计划在evaluator/upgrade-v0.3/PLAN.md，旧冻结public/rubric/FREEZE只读。新信息历史primitive+闭式枚举0.052秒证明合法9/2、提前知叶7/2且被具名nonanticipativity_violation拒绝；125完整政策/3125放宽政策不是难度或时长样本数。独立逆推亦9/2；首脚本在写metadata时复用了value变量而用了字面兜底，虽前置逆推assert真实通过，已保存qualify-initial/assessment-initial并改为直接引用真实backward映射，不能用常量冒充计算输出。本例只因果机制资格；完整新材料/参考/业务执行/报告/质量线/原子rubric/独立冻结及fresh候选区分度仍待。整套冻结1/10、小时资格0/10，其余九题继续，心跳ACTIVE。
