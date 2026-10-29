# 数小时有效工作的长程评估校准

## Recall

- 用户原始目标：10个重型全链路任务与rubric、独立审查、对齐成熟benchmark；随后要求实际OpenCorvus case、Codex横向比较、两方都好即提高难度。
- 最新硬要求：“我需要那种能执行几个小时的评估任务”；“opencorvus用的什么模式？rubric足够难吗”。用户从未设置token额度，禁止再以自设总量终止交付。
- 已完成事实：旧H05 OpenCorvus与独立Codex都100非盲开发业务点，各自实际评估侧清洁复跑与直接SQL验收通过。旧题是code域、builtin/base 2026.10.14.1、direct/native Task，gpt-6.1-sol；没有Mission/持续Goal。它的简单核心及宽泛20叶构成天花板，34分钟不是小时级证明。Codex CLI同模型接口400未执行题目，另起无父历史Codex app agent完成；模型实际身份/用量不暴露，不作同模型排名。详情见横向记录。
- 已撤回：原H05工程v0.2未冻结原型5个本轮新文件，因无法证明小时级，精确核对未跟踪/本轮创建后删除；设计调查保留并明确搁置。没有交付半成品新benchmark或覆盖旧题。
- 验收目标：真实有效的论文理解→研究方案→实现与数值单测→参数搜索/配对实验→失败与消融分析→图表/报告→独立清洁复训。实际观察数小时工作，不设置至少运行数小时的过关条件，不睡眠/重复已完成实验凑时长。分别报告模型/工具、有效训练、环境准备和无活动等待，重叠时间不相加。
- 已读：既有全部Recall、当前Inspect Task边界、真实H05原Task绑定、PaperBench官方说明和固定上游源码、Inspect Evals集成说明、原PINN paper.md/addendum/rubric及完整PDF相关页、PDF skill。原论文为Rathore等《Challenges in Training PINNs: A Loss Landscape Perspective》，PMLR235:42159–42191，https://proceedings.mlr.press/v235/rathore24a.html 。
- 来源：`openai/frontier-evals`固定`b78dab1da774a6456b1ed9c48c9ff194ee3ff36d`，缓存`D:/opencorvus-benchmark-runs/paperbench-discovery-20261029/`。Git-LFS对象按发布者不可变object ID验证真实文件身份，不把源代码摘要作为功能门槛。上游MIT与论文CC BY4.0分别保留，不统一重许可。
- 独立审查：`benchmark_review`只读且禁止再委托；已确认研究难度本质提升，但完整矩阵1260训练/5166万名义迭代+谱/NNCG可能远超过数小时。1963叶不是权重；按已核对上游递归聚合，Code Development41.77045%、Code Execution14.16117%、Result Analysis44.06838%。任何自拟权重或裁剪均另立派生版本，不冒称官方分。
- 输入修正：已取回原PDF33页及15张原始图，渲染并实际查看PDF第8/18/21页。Table2 convection NNCG loss原值3.63e-7，Markdown丢指数；Table3波方程NNCG原硬件29秒/步。算法6未定义v0问题仍需自洽公开数学合同，不能偷看黑名单作者代码填缺口。已提供补充材料有明确不复现的章节/图，需保留其范围。
- 实际环境：RTX5090 32GiB，AMD5500六核十二线程，D盘约1.7TiB可用。Docker29.7.2已运行。PyTorch2.7.1+CUDA12.8镜像`pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2`已拉取。新建无网络、无宿主卷容器真实float64二阶参数导数通过，GPU sm_120；当前科学镜像已补齐NumPy/SciPy/Matplotlib等固定依赖，见下节实证。该预检只证明设备/核心导数可用，不证明完整PINN/PCG、精度或小时级时长。独立Ubuntu WSL诊断出现HCS超时，没有重启用户环境；Docker CUDA实际路径已通过，不依赖该诊断。
- 硬约束：只操作自有新项目/容器，不碰用户窗口或重启/杀用户进程；不新建源仓库branch/worktree，保护并行修改。所有LLM走现有流式Task/原生Codex，Inspect负责执行观察；不新增私有LLM调度器或隐藏消息。无UI自动化、无外部业务发布，不向任务传递凭据/评分器/历史答案。完成修改须范围提交并按fetch/merge/检查待推集合/push规则交付。

## 分析与影响面

根因是原题内在状态空间/依赖链过小且答案被题面直接披露；评分内容完整不等于有分辨率。把运行分钟数拉长也不能解决。研究复现包含数学正确性、优化器状态、配对搜索、真实训练、谱/线性代数与数值结论之间的依赖；但完整原研究又可能超出单机可接受范围，因此须先做真实路径资格与测时，再冻结派生范围。

本次只改benchmark资料、case-specific数值检查器及必要薄启动元数据；生产Task/Mission/Session调度、数据库schema、UI和发布均不适用。Task可以长跑，不以切换模式名代替难度。科学研究设计专家团的selector仅覆盖早期研究设计，不能因为名称更专业就把编码实验任务交给一个范围不符的专家团。

## 初始待测方案（已由下文19配置审查稿替代，未冻结）

1. 完成固定科学依赖镜像及全批量float64资格：输入一/二阶导数、参数梯度/Hessian-vector product（海森矩阵向量积）、L-BFGS真实多closure、Nyström/PCG（预条件共轭梯度）和实际稳态测时。不用矩阵乘法或GPU型号推断最终工作量。
2. 拟评估范围：三个方程设置、固定宽度100、配对种子345/456/567、Adam学习率1e-4/1e-3/1e-2，Adam/L-BFGS/11k切换混合，共63基础配置；41k为最大优化更新，真实零步/早停须有明确状态及梯度证据。NNCG/GD有限续训与阻尼搜索的具体规模由真实路径校准后冻结，不强制复制原2000步。这里只是待测方案，不是已验证时长。
3. 精确公开采样网格/端点、初始速度、周期边界配对、各残差池归一、精度、初始化、迭代与closure计数、早停、选优和负结果规则。任何缩减都写清只在本派生范围最优，未覆盖原完整跨宽度/切换研究。
4. 编写独立数值checker：解析解与手算函数残差；已知SPD二次问题的Hessian/PCG残差；从实际checkpoint独立前向/空间导数重算损失和L2RE，绑定全部注册配置；清洁重新训练与checkpoint重新评价分开。
5. 写原子加权rubric，主要分值绑定真实方法与可复核实验结果，报告不能补偿错误方程/假执行/缺关键实验；用真实多质量见证校验。独立审查输入足够、可解、故障/数值边界与权重后再冻结。
6. 先运行一个真正长程开发pilot，再根据实际有效工作时长、得分、失败与成本校准其余九题，不提前宣称十题都已小时级验证或专家成熟认证。运行采用定时观察真实活动，维持无token/总墙钟截断。

## 当前未达成

未冻结长程任务/评分、未完成真实完整数值路径资格与时间校准、未开始长程候选运行，未取得其清洁复训或专业专家校准。当前不能报告小时级benchmark已完成。

## 2026-10-29 本轮实证与接续位置

- H05横向比较、原件、两份清洁复跑与100/100开发分已提交`d1ea6db42`并正常push；全量pre-push现行检查通过、秘密扫描0。其他任务继续修改共享main及界面文件，必须保留它们的改动。
- 本地科学依赖镜像构建完成：`opencorvus-benchmark-science:20261029`，基础镜像固定如Recall；额外numpy1.26.4/scipy1.15.3/matplotlib3.10.3/reportlab4.4.0/pypdf5.5.0。构建文件、日志与真实数值资格在外部cache，准备时间不计入候选工作。
- 真实10000残差点、width100、float64资格完成：三问题各264 Adam+16 L-BFGS，真实closure共33–36。稳态Adam分别.01722/.01751/.04664秒，L-BFGS16步1.093/.863/2.211秒；HVP每次.0324/.0308/.0861秒。已知SPD PCG显式残差7.62e-10；实际高阻尼1e4/rank8的PINN PCG7.24e-10，仅证明路径，不证明论文小阻尼成功。
- `script/benchmark/pinn_numeric_check.py`由评估侧生成权威全数据、仅从NPZ读取数值权重并独立前向/导数/损失；15个聚焦正向测试通过，包括完整四层导出→加载→真实CLI。三问题GPU导出的实际权重与独立NumPy全评价网格标量一致，一/二阶输入导数最大差5.33e-15。
- `pinn_torch_check.py`不导入候选代码，独立读取数值权重/权威数据，检查参数梯度、HVP中心差分与显式Ritz残差；已知SPD全谱、闭式参数梯度、残差对输出bias的严格零导数3项正向测试实跑通过。三问题×total/residual/constraint共9份真实GPU交叉验证通过，HVP差分相对误差1.89e-11～4.22e-10。新CLI增加明确数值接受条件，退出0不能只表示“写了JSON”；完整参数图仍非训练真实性证明。
- 独立审查者额外实际复跑NumPy测试与Torch已知例；发现并关闭候选自选评分点漏洞、L-BFGS零步无法合法终止的合同冲突、残差分量输出bias未参与造成unused-tensor错误。数学上零导数/零Hessian按零填充并验证，没有增加正则或改变目标。
- 独立审查原件已归档`specs/artifacts/2026-10-29-heavy-workbench-long/evaluator/independent-review/stage-assessment.json`及同目录精确命令/输出/源副本：另起15 NumPy+3 Torch/边界复跑通过，审核9组GPU差分。它明确`formal_freeze_approved=false`，不冒称批准完整新题。源码提交前docs:check通过（351路由/26组），真实新CLI退出0且三个数值接受条件全部为true。
- 数值工具/审查稿/原件提交`c376b9fe9`已正常push，现行pre-push检查与秘密扫描通过；未发布新冻结benchmark或候选成绩。完整独立`REVIEW.md`及历史命令/原输出在审查目录，历史UTC未知保留null。
- 按用户仓库“长时间benchmark使用定时唤醒”要求，本聊天已创建20分钟心跳`benchmark`（名称“长程 benchmark 迭代与真实验收”，ACTIVE），用于继续本未完成目标，状态不变保持安静；有可执行工作继续推进，只在重要新结果/完成/失败/确需选择时通知。不会用关闭本轮对话冒充整个目标完成。必要的一层独立review/Codex仍为用户既有授权，被委托者不得再委托。
- 63配置未采用；独立按真实稳态粗推19配置达到全上限也约11.14小时，合法共用prefix约省.46h，未含NNCG/复训，不是已验证最终时长。首轮审查稿为19基础配置+4续训分支、174叶，后续未冻结修改见本记录后节及唯一当前`public/profile.json`。R9结果锚点明确calibration-pending，**禁止发布总成绩/称冻结**。原论文及PDF/15图、许可和官方原rubric已按各自归属保存，不让候选读评估侧。
- 最初代表性真实收敛资格当时运行于自有容器`oc-pinn-convergence-20261029-a`、会话5652；现已终态，见后节与封存原件，不再检查其已自动清理的容器。原始实时事实为`D:/opencorvus-benchmark-runs/paperbench-discovery-20261029/convergence-qualification/events.json`；PowerShell stdout重定向存在缓冲，不能把stdout文件暂空当无活动。该probe的`step`计尝试的局限保留，不能用它认证当前first-zero-stop合同或候选成绩。

### 下次唤醒的必要工作（不是已完成）

1. 重读本Recall，检查git状态、实际自有容器/实时events；只收敛自有运行，不重启用户Docker/WSL。代表配置自然终态后，独立重算终态loss/gradient/L2RE，记录真实尝试与有效更新，保留失败原件。
2. 用该晚期真实checkpoint资格小阻尼.01/.1、rank20、PCG显式残差、Armijo和谱；按公开Nyström稳定化公式实现已知矩阵与真实Hessian。δ只稳定投影，不能假定H+μI正定；算法错误须修真实根因，不静默换优化器。不能靠早期高阻尼4步资格跳过。
3. 其余两方程代表配置与结果锚点仍无资格。完成三问题可达性与最终contract（含初始化/Adam参数/终态/续训失败/选优资格/谱和恢复容差）审查后冻结新版本；旧草稿不能直接计分。失败续训不凑200，三混合无有效父状态则dependency_incomplete。
4. 把薄启动器的历史专用benchmark/case元数据限制合理参数化（先全仓检索及聚焦正向测试），复用现有Inspect/真实流式Task；不新建私有LLM调用器/队列/隐消息。不设token/总墙钟截断，真实长训练必须有实际工具/进度事实。只移交公开文件，评估器、资格权重、原官方rubric和旧答案不得进入候选项目。既有授权Provider staging必须成对移交auth+models且不输出内容。
5. 启动真正长程OpenCorvus开发pilot，记录实际Task绑定/模型/用量/活动。用定时唤醒观察真实进度，完成后封存原件、评估侧完整清洁重训、同一冻结规则独立审查；必要时新鲜Codex对照并按用户两方都好则升级。新题未跑不能报“已经小时级”。
6. 原始十题其余九题尚未完成小时级升级/校准。先完成一题实证，再以真实重型工作依赖和可执行评分升级其余九题、独立挑战与闭环；不能用研究草案、原子叶数量或单题通过冒充十题达到成熟经验标准。

## 06:55 UTC定时接续：晚期方法资格

先重读两份Recall、公开合同和评估源，再检查状态。convection真实训练持续推进至最后阶段，梯度/参数仍变化，未把最大更新终态称为收敛。该probe旧`step`计尝试的局限保留；后续新增代表资格分别记录attempt/native/nonzero/closure与真实optimizer_stalled，不凑零步。

本阶段新增自有外部`qualify_late_newton.py`，按公开Nyström/PCG/Armijo合同进行数值资格；同一固定科学镜像、无网络、不读候选/作者实现。已知64维SPD实际求解相对误差6.42e-9；已知精确rank4矩阵的Nyström近似相对误差1.24e-14，逆预条件器相对误差8.14e-15；非正曲率映射到具名状态的正向错误合同也实跑。`late-known-qualification-b/known-spd.json`是本版原始收据，初版known-only资料仍保留外部目录，不把它当晚期真实PINN证明。

随后convection已自然达到30000次L-BFGS native尝试上限，训练3604.738秒；独立loss=.0007902502413、L2RE=.368155。未称梯度收敛，也不是候选工作。最初probe没有逐attempt的first-zero-stop证据，独立审查明确不能作当前合同R9锚点。

晚期A轮2个GD×200与2个小阻尼NNCG×21上限资格已结束：GD指标退化，小阻尼两者第一attempt遇PCG非正曲率、0接受。晚期HVP差分相对误差4.39e-11，负Rayleigh Ritz约−.143（小特征值估计未充分收敛，不当精确最小值）。这是实际数学系统的失败，不是Task调度/队列问题；投影δ没有使H+μI正定，原失败完整保留。

独立reviewer实际发现私有资格工具3项问题：浮点零变化误计更新、分解异常退出整个运行、非有限曲率/显式失败残差语义缺失。已修真实代码，4项聚焦错误/零步合同实跑通过；其中LinAlgError envelope明确为局部注入，不冒充端到端。B轮保留原失败，新探索μ=1/10都21/21接受、覆盖第21更新刷新；逐步PCG≤1e-8、gtd<0、Armijo、parameter_step_inf>0由主评估者和独立审查另行核算通过。μ=1第三分支seed20263029/20263030；μ10探索原件保留，不进公开矩阵。

在候选尚未开始/题面未冻结阶段，独立审查认可保留两小阻尼失败并增μ=1作派生敏感性。公开profile改为19基础+5续训，178叶；C组仍15、总分100，R9仍pending。21步不是200步证明，代表基点也不是已完成三学习率选优。已启动μ1×200完整资格自有容器`oc-pinn-late-newton-200-20261029-a`，会话87691，实时`late-newton-200-qualification/nncg-mu-1.0/progress.json`；CLI`--branch-index-offset 2`保持第三分支正确sketch种子。最新原件与资格源归档`specs/artifacts/2026-10-29-heavy-workbench-long/evaluator/late-qualification/README.md`。

另外两问题用新`qualify_problem_convergence.py`按最终更新/终态合同作单一代表资格，不是候选提交；reaction容器`oc-pinn-reaction-convergence-20261029-a`，会话6261，实时`reaction-convergence-qualification/events.json`；wave容器`oc-pinn-wave-convergence-20261029-a`，会话60677，实时`wave-convergence-qualification/events.json`。初始化、11000切换、后续真实计数、first-zero-stop、保存100/120更新状态均按当前合同，两个已执行源副本分别留在目录`executed-source.py`。为补旧convection终态证据，已用当前合同重新执行convection：容器`oc-pinn-convection-contract-20261029-a`，会话22932，实时`convection-contract-qualification/events.json`，新增完整`lbfgs-attempts.jsonl`逐次记录。该必要复验修补明确合同证据缺口，不是凑时长。三个GPU资格并发，记录实际耗时但不当独占GPU速度排名。先检查上述自有事实再推进，不能重复启动已有资格或打断用户进程。

薄启动元数据已先搜索：生产唯一匹配为`script/benchmark/serve_heavy_workbench.ts`第16行固定旧benchmark身份、17行仅Hxx；当前代码尚未修改。其他native-run-contract处理通用native完成/批次，不含本launcher注册身份；不存在第二个HeavyWorkBench启动路径。未来更改仅扩大注册身份合同并正向测试，不改变Task、Provider、队列、LLM工具或终态归属。

## 07:32 UTC接续：启动注册合同分析与实施方案

GPU代表资格仍有效推进；本轮先完成可独立推进的薄启动准备。可观察问题：旧launcher在任何环境/Provider操作之前硬拒绝新`HeavyWorkBench-Long/0.2.0-dev`与L01。直接触发是16/17行字面值限制；根因是首个H05试验将试验身份当成了通用入口合同。旧路径只服务一次H05，尚无第二身份，因此此前没有抽象；现在新题已有公开profile且确实需要复用同一执行入口。

全仓搜索只有该launcher匹配旧身份，未发现同语义注册解析入口；native-run-contract负责native操作/终态/批次，不应与此混合。影响面限注册文件解析及调用launcher，保留原有项目路径包含校验、真实流式Provider预检、成对auth/models暂存、原生Task执行与cleanup。Task/Mission/Session调度、数据库、UI与发布不适用。metadata身份校验不向LLM选择工具或流程；不新增私有路由。风险是丢失额外试验元数据、null额度被错误默认化、非法模型/路径在启动后才发现；使用单一纯数据解析合同保留额外字段，明确null/正整数和调用方原路径校验，错误在暂存凭据之前呈现。

实施：提取一个当前注册解析实现，用已有Zod库验证versioned benchmark身份、case ID、精确OpenAI模型、正整数真实闲置秒数、lineage口径、显式null或正整数token字段与非空运行路径；删除launcher旧重复断言。旧H05及新L01都走这一实现，不加兼容分支。聚焦正向测试覆盖旧已交付注册、新长程profile身份且null保持原值，以及明确字段错误契约。此局部解析测试不证明真实Provider/Task端到端；新题冻结后仍须原生Inspect实际预检与长跑。当前工具清单未提供独立Inspect连接器，下一步按仓库既有Inspect CLI/HTTP入口操作，不另造LLM执行器。

注册解析3项聚焦正向测试已通过，旧项读取实际归档的H05 registration；新项读取当前公开L01 profile并保持null额度。启用strictNullChecks的定向检查发现原launcher的可选server在异步闭包中丢失类型收窄及空取消列表推断never[]，已以同一已建立listener的const引用和显式回执数组类型修复，不改变运行对象/清理归属。最初测试fixture字面量类型与格式问题也已修正，聚焦测试、strictNullChecks定向类型检查和Prettier通过。

继续可独立推进的恢复资格：reaction/wave已实际存下第100次接受更新的完整模型、L-BFGS history、CPU/CUDA随机状态及第120次未中断权重。将在新自有容器进程仅加载该可信快照并执行20更新，与原120权重按既定atol1e-10/rtol1e-8逐参数比较；不得重跑11k/100前缀。容器内PID通常均为1，因此同时记录真实PID namespace和外部新容器身份，与两个仍运行的原生产容器区分，不能只凭“PID1”声称新进程。只读自有科学资格数据，不涉及产品Task/Mission/Session恢复、用户窗口、Provider或凭据。该20更新复验只证明科学优化器恢复局部合同，不替代完整候选清洁复训。

上述L-BFGS恢复已实跑通过：reaction和wave各新执行20非零更新、native100→120、history99→100，与未中断第120权重最大差均0，真实新进程namespace与两个仍存活原进程不同，外部Docker CID及原始命令保留。Inspect现成环境可用：`packages/inspect-benchmark/.venv`，inspect-ai0.3.259、opencorvus-inspect0.3.4；仍只计划复用其Task API solver，没有新增Inspect替代实现。

Adam恢复尚未资格，现按同一公开容差补充500+100未中断producer与仅100恢复consumer：两个独立Docker创建/退出、新容器ID为引擎真实身份。producer保存模型/Adam/CPU-CUDA RNG；consumer只读自有可信500快照，不训练前缀，再与600未中断逐参数比较。依赖原进程已退出时PID namespace inode可能复用，不能以namespace不同当唯一新进程证明；本补充以实际不同Docker容器身份与命令收据证明执行轮次，不做自算源码摘要门槛。仅为恢复合同局部资格，不计候选运行时间或论文成绩。

Adam补充已实际完成：producer600更新并保存500状态，另一真实Docker容器只恢复后100更新；逐参数最大差0，无前缀重跑，原始执行0/0退出。μ1完整NNCG200也已自然终态：200接受、10次刷新、17614次HVP，耗时1256.165秒（共享GPU），最大显式PCG相对残差9.98e-9，Armijo及逐参数非零均核验；独立终值loss=.0004707843653、L2RE=.28797693。这是非选优代表基点的资格，不是完整19-run候选成绩，旧小阻尼失败继续保留。

独立R9设计审查明确指出：原3个PDE结果叶共9分、非critical、加权>=80的草案可让所有解质量失败仍91分过关，拆叶本身也不能补救。现先将待校准PDE质量叶标为critical，公开区分study_complete和solution_reproduced；后者同一合格checkpoint必须同时满足每PDE解误差、独立评价残差、每族初边值底线，不能由高分补偿。此为评估侧业务标准，不修改Task状态机或host工具流程。具体阈值、选优与原子化仍须三问题当前合同的可达见证、零/常数/初值拟合等低质量对照、数值重放容差，不能按当前.288误差倒填宽松线，更不能用非凸精确轨迹当金标准。来源`r9-design-review/REVIEW.md`已独立落盘。R9继续pending，不发布总成绩。

### 当前注册资源政策收敛（实施前更正方案）

参数化初稿沿用了原工具的null/正整数双值，但再次核对用户“我限制你预算了？”及已落盘无截断要求：当前任务没有正整数额度授权，保留该开关会保留此前误取消的执行路径，不应仅靠每次填null避免。全仓相关当前实现仍仅此launcher；前三轮带cap注册/取消属于冻结历史，不需要保留可执行旧路径。本次在授权benchmark范围内删除该本地工具的总token取消分支，只接受显式null，保留完整lineage用量记录和真实闲置预检。`tokenBudgetScope`既有字段仅标识用量归属，不触发取消。不会改变历史原件、产品Task控制、Provider或用户服务，也不扩大为全仓清理。

相应聚焦合同增加正整数配置映射到明确null政策字段错误；旧H05无截断注册与L01仍使用同一解析实现。此前正整数支持的方案文本保留为本轮分析历史，以本节单一当前政策为准。真实Provider/Task验收仍待新题冻结后进行，局部4项注册测试不能冒充该端到端验收。

## 08:46 UTC最新接续状态与下一轮优先项

本轮注册/无截断合同4测试、strictNullChecks定向类型检查、Prettier通过；独立`registration-review-uncapped/`实际另起检查认可，未调用Provider或启动服务。此前3测试初稿保留为历史，不把它当最终源。Inspect入口已确认是`packages/inspect-benchmark`唯一Python集成；使用既有`opencorvus_benchmark`/`opencorvus_task`及公开Task API，`--model none`避免Inspect另发模型请求。当前没有新候选Task，L01仍未冻结，不能把lifecycle scorer当业务成绩。

| 当前自有活跃容器 | 外部cache实时事实 | 08:46观察 |
| --- | --- | --- |
| oc-pinn-convection-contract-20261029-a | convection-contract-qualification/events.json、lbfgs-attempts.jsonl | L-BFGS13100尝试/13100接受，仍推进 |
| oc-pinn-reaction-convergence-20261029-a | reaction-convergence-qualification/events.json | L-BFGS14300尝试/14300接受，仍推进 |
| oc-pinn-wave-convergence-20261029-a | wave-convergence-qualification/events.json | L-BFGS11100尝试/11100接受，仍推进 |

`late-newton-200-qualification`、`optimizer-restore-qualification`、`adam-restore-qualification`已终态，不重复启动；原件与回执在`evaluator/full-continuation-and-restore/`。此处已执行source并非完整研究源码包；两个大L-BFGS optimizer状态保留外部cache，原件位置/大小明确，未谎称小zip包含它们。Adam小状态已随包。原论文第20页已实际渲染查看，确认算法6 v0符号问题，公开使用自洽PCG定义而不猜作者实现。

下一轮先读取本表实际活跃事实，完成末态后独立重算/审查，停止把旧已移除容器当失败。可独立推进：扩展NumPy检查器报告独立评价网格残差与各初边值族量；用手算函数和真实导出正向验证。按R9独立报告准备零/常数/仅初值拟合等低质量见证，与三问题可达见证一起校准，不能只拆叶或按当前误差倒填阈值；确定同一checkpoint的公开选择规则及原子质量合同，明确study_complete与solution_reproduced。

同时补齐候选manifest明确I/O与逐配置独立检查边界（元数据不能证明训练来源，仍需受控清洁重训/源码/真实执行），再经既有独立agent审查冻结。启动工具已准备，无须重复做注册实现；冻结后才生成只含public文件的新项目和真实Inspect单样本，成对暂存auth/models并核验实际模型，保持无总token/总墙钟截断。环境可准备样本自有科学容器并提供真实工作路径/CID，闲置环境不计工作量；不引入替代LLM调用器或隐藏工具。完成后完整原件封存、独立清洁重训与同一冻结rubric审查，必要时新鲜Codex对照；按用户条件再升级。其余九题仍须实质升级与验证，不能忘记整个十题目标。
