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
- 实际环境：RTX5090 32GiB，AMD5500六核十二线程，D盘约1.7TiB可用。Docker29.7.2已运行。PyTorch2.7.1+CUDA12.8镜像`pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2`已拉取。新建无网络、无宿主卷容器真实float64二阶参数导数通过，GPU sm_120；scipy/matplotlib尚缺。该预检只证明设备/核心导数可用，不证明完整PINN/PCG、精度或小时级时长。独立Ubuntu WSL诊断出现HCS超时，没有重启用户环境；Docker CUDA实际路径已通过，不依赖该诊断。
- 硬约束：只操作自有新项目/容器，不碰用户窗口或重启/杀用户进程；不新建源仓库branch/worktree，保护并行修改。所有LLM走现有流式Task/原生Codex，Inspect负责执行观察；不新增私有LLM调度器或隐藏消息。无UI自动化、无外部业务发布，不向任务传递凭据/评分器/历史答案。完成修改须范围提交并按fetch/merge/检查待推集合/push规则交付。

## 分析与影响面

根因是原题内在状态空间/依赖链过小且答案被题面直接披露；评分内容完整不等于有分辨率。把运行分钟数拉长也不能解决。研究复现包含数学正确性、优化器状态、配对搜索、真实训练、谱/线性代数与数值结论之间的依赖；但完整原研究又可能超出单机可接受范围，因此须先做真实路径资格与测时，再冻结派生范围。

本次只改benchmark资料、case-specific数值检查器及必要薄启动元数据；生产Task/Mission/Session调度、数据库schema、UI和发布均不适用。Task可以长跑，不以切换模式名代替难度。科学研究设计专家团的selector仅覆盖早期研究设计，不能因为名称更专业就把编码实验任务交给一个范围不符的专家团。

## 当前下一步（未冻结）

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
- 63配置未采用；独立按真实稳态粗推19配置达到全上限也约11.14小时，合法共用prefix约省.46h，未含NNCG/复训，不是已验证最终时长。当前审查稿为19基础配置+4续训分支，范围见`specs/artifacts/2026-10-29-heavy-workbench-long/public/TASK.md`和唯一注册表`public/profile.json`。174原子叶100分草案`rubric.draft.json`，其中R9结果锚点明确calibration-pending，**禁止发布总成绩/称冻结**。原论文及PDF/15图、许可和官方原rubric已按各自归属保存，不让候选读评估侧。
- 代表性真实收敛资格仍运行：自有容器`oc-pinn-convergence-20261029-a`，启动命令会话5652，外部`qualify_convergence.py`；只在自有cache工作，网络关闭。实时事实读`D:/opencorvus-benchmark-runs/paperbench-discovery-20261029/convergence-qualification/events.json`；PowerShell stdout重定向存在缓冲，不能把stdout文件暂空当无活动。该probe的`step`为native step尝试索引，遇零步后的25次plateau只能作原始资格观测，不能按最终新合同当25次有效更新；正式候选按最新attempt/native/nonzero/closure分计。末态才生成`convection-checkpoint.npz`，不得把资格当候选成绩。

### 下次唤醒的必要工作（不是已完成）

1. 重读本Recall，检查git状态、实际自有容器/实时events；只收敛自有运行，不重启用户Docker/WSL。代表配置自然终态后，独立重算终态loss/gradient/L2RE，记录真实尝试与有效更新，保留失败原件。
2. 用该晚期真实checkpoint资格小阻尼.01/.1、rank20、PCG显式残差、Armijo和谱；按公开Nyström稳定化公式实现已知矩阵与真实Hessian。δ只稳定投影，不能假定H+μI正定；算法错误须修真实根因，不静默换优化器。不能靠早期高阻尼4步资格跳过。
3. 其余两方程代表配置与结果锚点仍无资格。完成三问题可达性与最终contract（含初始化/Adam参数/终态/续训失败/选优资格/谱和恢复容差）审查后冻结新版本；旧草稿不能直接计分。失败续训不凑200，三混合无有效父状态则dependency_incomplete。
4. 把薄启动器的历史专用benchmark/case元数据限制合理参数化（先全仓检索及聚焦正向测试），复用现有Inspect/真实流式Task；不新建私有LLM调用器/队列/隐消息。不设token/总墙钟截断，真实长训练必须有实际工具/进度事实。只移交公开文件，评估器、资格权重、原官方rubric和旧答案不得进入候选项目。既有授权Provider staging必须成对移交auth+models且不输出内容。
5. 启动真正长程OpenCorvus开发pilot，记录实际Task绑定/模型/用量/活动。用定时唤醒观察真实进度，完成后封存原件、评估侧完整清洁重训、同一冻结规则独立审查；必要时新鲜Codex对照并按用户两方都好则升级。新题未跑不能报“已经小时级”。
6. 原始十题其余九题尚未完成小时级升级/校准。先完成一题实证，再以真实重型工作依赖和可执行评分升级其余九题、独立挑战与闭环；不能用研究草案、原子叶数量或单题通过冒充十题达到成熟经验标准。
