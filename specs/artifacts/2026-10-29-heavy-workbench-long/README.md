# HeavyWorkBench-Long · 0.2.0-dev

**状态：资格与独立审查中，尚未冻结、尚无候选长程成绩。** 这是独立派生研究任务，不是官方PaperBench或完整原论文复现分数。[Recall与未满足项](../../records/2026-10/2026-10-29-heavy-workbench-long.md)是当前工作记录。旧H05两方100点与难度天花板见[横向证据](../2026-10-29-heavy-workbench-cross-system/README.md)。

L01针对Rathore等ICML2024论文《Challenges in Training PINNs: A Loss Landscape Perspective》，包括独立实现、三方程比较、配对实验、优化器数值验证、真实训练、恢复、谱诊断、图表与可清洁复训的论文。工作量来自实际科学问题和依赖链，不设最少运行时长，不用sleep或空转达标；总模型token/总墙钟不设截止。

拟公开合同见[public/TASK.md](public/TASK.md)，尚须根据真实收敛资格和独立审查收敛后冻结。当前只有L01在进行环境/数值资格；不能把原有其余九题或整个十题套件宣称为已完成小时级升级。

[public/profile.json](public/profile.json)列出19基础配置、5续训分支及有效父状态选择规则；[rubric.draft.json](rubric.draft.json)含178个二元原子叶、100分组权重，**其中9分结果锚点待校准，禁止发布总成绩**。原子数量不是难度证据。公开论文、数据与各自许可在`public/`，评估侧原官方rubric、真实资格源码/导出/回执在[evaluator/](evaluator/README.md)，不进入候选项目。

## 数值资格

使用本地隔离Docker GPU容器，基础镜像固定为`pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2`，PyTorch2.7.1/CUDA12.8，RTX5090。科学依赖镜像仅作本地准备，未发布。实际全批10,000残差点、width100、float64训练/二阶导数/Hessian-vector product及真实closure路径通过。NumPy独立读取权重重算三个方程全网格结果；与GPU自动微分的一/二阶导数最大绝对差5.33e-15，损失/L2RE在1e-9相对、1e-10绝对容差内吻合。资格训练264 Adam+16 L-BFGS步，**不证明论文结论、完整矩阵或小时级难度**。

真实稳态Adam每步convection0.01722秒、reaction0.01751秒、wave0.04664秒；L-BFGS16步分别1.093/0.863/2.211秒，33–36次closure。已知正定线性系统PCG显式残差7.62e-10；实际PINN高阻尼资格PCG显式残差7.24e-10。高阻尼1e4只是设备/导数/线性代数路径资格，不冒充论文小阻尼NNCG成功。

独立审查发现并关闭评分数据控制漏洞：正式数值CLI自行生成权威网格，不能读取候选提供的点文件。常数模型在完整权威网格上有明确非零误差。数值primitive不证明训练真实发生，仍需源码、实际完整执行和清洁复训证据。

最新[独立阶段审查](evaluator/independent-review/REVIEW.md)及[机器可读结论](evaluator/independent-review/stage-assessment.json)实际另起环境重跑15项NumPy、3项Torch测试及边界见证，核对9组真实GPU收据；认可已关闭上述点控制、native零步、分量零导数与合同冲突，**未批准正式冻结**。其自有源码副本、精确命令/输出与历史/新复跑身份都保存在该目录。仍缺晚期NNCG、R9锚点、完整候选长跑和清洁复训，不能把工具资格通过写成成熟benchmark已完成。

后续[晚期资格](evaluator/late-qualification/README.md)已取得真实60分钟代表训练、非正曲率失败与21步低秩刷新路径。原小阻尼两分支失败保留，新增μ=1为冻结前派生阻尼敏感性；μ=10仅为资格探索。21步与单一代表配置不能证明完整200步、选优父配置或整个19-run研究已通过。R9及正式候选长跑继续待完成。
