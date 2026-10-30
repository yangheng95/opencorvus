# HeavyWorkBench-Long · 0.2.0-dev

**状态：套件开发中，L06/0.2.0单题合同已冻结，真实OpenCorvus与fresh Codex同合同各100/100，已触发另升L06/0.3建设；有效小时尚未证明。** 这是独立派生研究任务，不是官方PaperBench或完整原论文复现分数。[Recall与未满足项](../../records/2026-10/2026-10-29-heavy-workbench-long.md)是当前工作记录。旧H05两方100点与难度天花板见[横向证据](../2026-10-29-heavy-workbench-cross-system/README.md)。

L01针对Rathore等ICML2024论文《Challenges in Training PINNs: A Loss Landscape Perspective》，包括独立实现、三方程比较、配对实验、优化器数值验证、真实训练、恢复、谱诊断、图表与可清洁复训的论文。工作量来自实际科学问题和依赖链，不设最少运行时长，不用sleep或空转达标；总模型token/总墙钟不设截止。

拟公开合同见[public/TASK.md](public/TASK.md)，尚须根据真实收敛资格和独立审查收敛后冻结。L01仍未冻结；L06/0.2.0现有已冻结的开发可执行合同，尚无新版候选小时级实证。S06是另立身份的微型管线测试，不计十题。不能把旧题、资格或整个套件宣称为已完成小时级升级。

[public/profile.json](public/profile.json)列出19基础配置、5续训分支及有效父状态选择规则；[rubric.draft.json](rubric.draft.json)含189个二元原子叶、100分组权重，**其中9分结果锚点待校准，禁止发布总成绩**。原子数量不是难度证据。公开论文、数据与各自许可在`public/`，评估侧原官方rubric、真实资格源码/导出/回执在[evaluator/](evaluator/README.md)，不进入候选项目。

## L01局部数值资格（历史过程，非候选成绩）

使用本地隔离Docker GPU容器，基础镜像固定为`pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2`，PyTorch2.7.1/CUDA12.8，RTX5090。科学依赖镜像仅作本地准备，未发布。实际全批10,000残差点、width100、float64训练/二阶导数/Hessian-vector product及真实closure路径通过。NumPy独立读取权重重算三个方程全网格结果；与GPU自动微分的一/二阶导数最大绝对差5.33e-15，损失/L2RE在1e-9相对、1e-10绝对容差内吻合。资格训练264 Adam+16 L-BFGS步，**不证明论文结论、完整矩阵或小时级难度**。

真实稳态Adam每步convection0.01722秒、reaction0.01751秒、wave0.04664秒；L-BFGS16步分别1.093/0.863/2.211秒，33–36次closure。已知正定线性系统PCG显式残差7.62e-10；实际PINN高阻尼资格PCG显式残差7.24e-10。高阻尼1e4只是设备/导数/线性代数路径资格，不冒充论文小阻尼NNCG成功。

独立审查发现并关闭评分数据控制漏洞：正式数值CLI自行生成权威网格，不能读取候选提供的点文件。常数模型在完整权威网格上有明确非零误差。数值primitive不证明训练真实发生，仍需源码、实际完整执行和清洁复训证据。

最新[独立阶段审查](evaluator/independent-review/REVIEW.md)及[机器可读结论](evaluator/independent-review/stage-assessment.json)实际另起环境重跑15项NumPy、3项Torch测试及边界见证，核对9组真实GPU收据；认可已关闭上述点控制、native零步、分量零导数与合同冲突，**未批准正式冻结**。其自有源码副本、精确命令/输出与历史/新复跑身份都保存在该目录。仍缺晚期NNCG、R9锚点、完整候选长跑和清洁复训，不能把工具资格通过写成成熟benchmark已完成。

后续[晚期资格](evaluator/late-qualification/README.md)已取得真实60分钟代表训练、非正曲率失败与21步低秩刷新路径。原小阻尼两分支失败保留，新增μ=1为冻结前派生阻尼敏感性；μ=10仅为资格探索。21步与单一代表配置不能证明完整200步、选优父配置或整个19-run研究已通过。R9及正式候选长跑继续待完成。

最新[完整续训和恢复资格](evaluator/full-continuation-and-restore/README.md)已取得μ1×200实际接受、10刷新与Adam/L-BFGS真实新进程恢复，后者逐参数最大差0。[R9独立设计审查](evaluator/r9-design-review/REVIEW.md)同时指出原非关键9分的加权通过漏洞；当前待校准PDE质量叶均为关键项，公开区分研究完成与解复现成功。阈值及完整选择合同的可达性继续待证据，不能由91分方法成绩代替物理解质量。

[最终注册工具审查](evaluator/registration-review-uncapped/REVIEW.md)实际通过4项元数据合同测试与定向类型/格式检查。当前薄启动只接受显式null token政策，已删除原总量阈值取消路径；真实模型/Provider/Task端到端仍待冻结后的pilot。科学资格、注册检查和候选成绩分别记录。

本轮补充[OUTPUTS.md机器交付合同](public/OUTPUTS.md)：24配置覆盖、逐阶段计数/路径、初始化及续训父配对、实际执行证据与每PDE同一final的训练loss选优。评估侧`pinn_submission_check.py`是薄只读结构/权重端点检查，训练来源、日志内容与科学状态仍待实际完整复训和审查，不能用合成记录通过冒充科学验收。

[新增质量指标独立复核](evaluator/quality-metrics-review/REVIEW.md)实际重跑18项测试、三份真实导出CLI与独立CPU自动微分；完整评价网格残差和逐条件族指标匹配，低质量网络/解析诊断分开保留。没有填写R9阈值或批准freeze。三代表资格及另两注册convection学习率的历史记录保留，六旧昂贵任务目前Paused，尚无新候选成绩。

[机器交付独立审查](evaluator/manifest-review/REVIEW.md)实际找出并复核修复了项目/输出根混淆、未开始记录的非null引用、plateau/stalled声明计数矛盾；最终15项manifest测试与独立端点/两种tie探针通过。当前工具全范围[36项实跑](evaluator/artifact-contract-validation/README.md)仅证明数值与结构合同。R9已拆为14个pending关键质量叶、共9分，阈值仍null，完整选择可达性仍待终态证据。

用户最新要求[便宜实验优先](evaluator/cheap-first/README.md)：六个自有昂贵容器已可逆暂停；先做必要条件/枚举/短程，而非同时完整训练。[九题独立审查](evaluator/nine-case-review/REVIEW.md)实跑28次旧checker并明确升级缺口。[L06](cases/L06/README.md)低成本审查发现并修正了期末/阶段仓容、输入维度/概率和严格JSON问题，仍未证明成本最优或小时级。[S06](cases/L06/smoke/README.md)真实原生完成、数学最优及两方清洁源码复跑均通过微型合同；它不计入十题，不证明重型难度。

便宜接续新增[L06严格下界](cases/L06/evaluator/independent-relaxation/REVIEW.md)：完整LP .047秒，独立从输入重建1488变量/1096行并精确核算下界约46220.2662；与51263上界仍不能认证1%。[L04合成旧库迁移能力](cases/L04/README.md)已实际独立冷跑，修复共享NULL身份漏洞，4升级+2按合同中止/原库保留通过当前局部协议；两者均非冻结重型题、候选分或小时级成绩。

历史[L06完整公开合同与rubric稿](cases/L06/README.md)含11CSV/设施原材料、5CLI事实映射及47叶100分草案，当时质量/逐叶grader/完整参考/变体尚未就绪；当前冻结与真实两100以本页末节及L06当前记录为准。[不同整数搜索](cases/L06/evaluator/qualification/v2/integer-search/README.md)与独立业务复核取得新可行上界49032.9，仍未认证1%。只新增一个CPU参考界资格，真实活跃路径以长程Recall末节为准；六旧昂贵容器仍Paused。局部资格/草案不构成十题、候选分或小时级证明。

该单个CPU参考任务已自然结束，独立核验成本47808/native界47380，基例1%比例约0.9033%，[终态/独立范围/基例预注册](cases/L06/README.md)单列；完整参考交付与冻结仍pending。独立完整合同审查认可设计/10叶primitive，本轮具体漏洞已修，未批准其余37叶/职业参考/变体/小时级。当前不留新增活跃长计算，不重复求解凑时长。

最新[L06数值与源码交付资格](cases/L06/README.md)：30数值叶独立复核关闭输入漂移/负gap漏洞；主方真正raw-source全链约7分钟、成本47746.2，仍不发布候选总分。唯一完整独立复跑使用同源/全部CSV反转，末态以Recall为准；17执行/审查叶、变体/聚合/校准及十题长程验证仍待完成。

L06现有[完整独立基例复建与证据聚合](cases/L06/README.md)：固定L下不同正确计划47737.6通过，唯一报价控制无需再求界即可证明1%可达；新聚合器不以94/96高分补偿关键输入失败。报价source实际执行、多质量校准/冻结和fresh双系统仍待完成，整套十题新版小时级仍0/10。

L06现已完成[最终独立合同审查并冻结0.2.0](cases/L06/README.md)，真实参考完整评价98仅为资格锚点。冻结Git树2e6ffc7ce的18个public已用于预注册双系统顺序试跑，OpenCorvus真实Task tsk_g00VZTFvzf0073YLIAGl已自然完成，OpenCorvus实际清洁完整评价100，fresh Codex已顺序启动；[Recall](../../records/2026-10/2026-10-29-heavy-workbench-long.md)及外部定位保存实况。开发合同冻结1/10、候选小时资格0/10，不能以单题代替十题。后续[逐题矩阵](cases/README.md)区分局部资格与未实施项；L05的真实现场/在途/EOF局部资格及L02发布时间隔离原语均不当完整题冻结。


最新[真实OpenCorvus试跑收据](cases/L06/evaluator/pilot-opencorvus-20261029/README.md)：原Task自然完成、完整版本封存/正常cleanup，30数值叶通过；真正基例源码冷执行与同冻结独立评价正在进行，尚无总分或小时认证。L05新增[顺序事故现场](cases/L05/README.md)经独立真实反例修复后取得限定范围资格，完整题与其余九题仍需继续建设。


## 当前双系统结案与新版本建设

[L06/0.2.0真实成对结果](cases/L06/evaluator/pilot-codex-20261030/paired-comparison.json)：两方各100/47pass/28critical通过，均经评估侧源码基例、注册报价和行序控制以及同冻结单层独立17叶审查，再由真实grader聚合。不是参考分或Inspect完成分；旧public/rubric/FREEZE与两结果保留。非盲AI审查/模型未知和资源隔离限制仍在，不作同模型速度/费用因果排名。

两good已触发[新L06/0.3计划与机制](cases/L06/evaluator/upgrade-v0.3/PLAN.md)：分阶段信息/历史承诺/执行政策。闭式9/2合法与7/2提前知叶的枚举只证明机制活跃，不是新题冻结或数小时难度。[L02](cases/L02/README.md)已前移公开截止以隔离全部inner，新增非单位MSE/WIS手算与实际metric CLI，保留真实极大指数/声明矛盾失败和修复；完整每日worker/真实选模/研究交付仍未实现。当前套件冻结1/10、候选有效小时资格0/10，十题目标未完成。


[L02完整每日数值参考](cases/L02/evaluator/qualification/daily-full-reference/README.md)已真实完成12outer/36inner、108预测/12选择及单层独立核验，原CSV/只读1CPU/netnone权限、逐格指标/拟合来源和真实图均有原件。去天气消融更优、A1/ZA转移边界四天区间失效如实保留；研究质量线/通用候选grader/rubric与冻结仍待。不是新候选成绩，套件仍冻结1/10、有效小时0/10。
