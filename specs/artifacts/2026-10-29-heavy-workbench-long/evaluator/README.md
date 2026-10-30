# 评估侧材料：不得交给候选

`original-paperbench-rubric.json`是固定上游原件，1963叶；原有层级权重保留，不将叶数当权重，不将派生分数称官方成绩。上游来源、许可见包内来源清单及public/SOURCE.md。

`qualification/`是评估者的真实数值/环境资格，不是受测agent答卷：

- `events.json`：真实GPU训练/closure/Hessian-vector product测时、已知SPD PCG与实际高阻尼PCG；`qualify_pinn.py`为对应源，`numeric-exports.zip`含实际数值权重、权威数据及GPU输入导数。
- `numpy-crosscheck.json`：评估侧NumPy从上述权重独立重算三问题全部评价点，与GPU结果比较。
- `independent-component-check.json`：三个问题×三个损失分量、参数梯度/Hessian向量差分与实际Ritz残差；不能把30阶Krylov估计称为完整谱。
- `torch-cli-receipt.json`：新CLI实际运行及明确标量/梯度/Hessian差分接受条件。源码在仓库`script/benchmark/pinn_numeric_check.py`和`pinn_torch_check.py`；15个NumPy聚焦测试、3个Torch聚焦测试通过。增加的严格零bias导数是数学正确值，不额外加正则改变问题。
- `Dockerfile.science`、`science-environment.txt`与`receipt.json`给出准备环境和镜像身份。环境准备不计候选耗时；未将4GB基础镜像或任何凭据提交。

示例（在准备的依赖环境中，解压exports到自有目录）：

```powershell
python script/benchmark/pinn_numeric_check.py evaluate --problem convection --checkpoint <export>/convection-checkpoint.npz --out <receipt>.json
python script/benchmark/pinn_torch_check.py --problem convection --component residual --checkpoint <export>/convection-checkpoint.npz --device cuda --spectral-steps 30 --out <derivatives>.json
python -m unittest discover -s script/benchmark -p test_pinn_numeric_check.py
python -m unittest discover -s script/benchmark -p test_pinn_torch_check.py
```

这些检查不能认证训练来源/优化器/配置归属，完整验收仍需从公开输入执行实际候选源码、完整清洁复训和独立审查。晚期NNCG小阻尼、全注册矩阵、R9结果锚点和小时级行为尚未资格，不能用本目录的通过结论代替它们。

后续晚期原件与预冻结修订在[late-qualification/](late-qualification/README.md)：两小阻尼的真实失败、私有工具修复、已知矩阵与21步刷新资格分别保留。完整200步、当前终态合同及其他问题的代表运行仍以实际后续末态为准，不从局部通过推导整题通过。

[full-continuation-and-restore/](full-continuation-and-restore/README.md)补充完整μ1×200、真实Adam/L-BFGS新进程恢复与独立逐参数重算；依然不能替代完整候选验收。[registration-review-uncapped/](registration-review-uncapped/REVIEW.md)是最终无总量截断注册/启动工具独立审查，[registration-review/](registration-review/REVIEW.md)保留更早参数化初稿历史。[r9-design-review/](r9-design-review/REVIEW.md)指出不能让高方法分补偿全部PDE解质量失败，数值底线尚未冻结。

[quality-metrics-review/](quality-metrics-review/REVIEW.md)保存本轮18测试、真实三导出CLI、CPU独立自动微分、新增逐族/评价残差及非有限错误、六个实际常数网络与三个解析诊断。阈值未填，不能当候选分。

新增`script/benchmark/pinn_submission_check.py --root <项目根> --manifest <相对项目根的输出目录>/manifest.json --profile <评估者保存的public/profile.json> --out <收据>`只检查注册/声明计数/根内文件和数值权重、配对及独立训练loss选择；始终返回训练未认证、科学状态unassessed。不能用其退出0代替逐attempt审查、完整清洁复训或独立论文/恢复/谱验收。机器交付形状见公开OUTPUTS.md。

[artifact-contract-validation/](artifact-contract-validation/README.md)保存修后18+13+3=34项CPU工具测试的真实命令/输出和源码快照。任意输出根由必需--manifest显式定位；所有非null引用独立校验，NUL映射具名错误。[learning-rate-selection/](learning-rate-selection/README.md)保存另外两个已注册convection混合LR的profile投影、真实启动/初始化一致与部分Adam活动，完整终态仍待后续原件。

[manifest-review/](manifest-review/REVIEW.md)保存独立10/13/15项版本与实际缺口/修复探针，最终认可薄reader局部合同；独立集成验证了三LR父tie与最终解ID tie的不同规则、初始化配对、数值失败排除和R9字段权重。当前最终本地全工具验证为artifact-contract-validation/terminal-count-repair/的36项，不覆盖/抹去原34项历史；均不认证训练或冻结质量阈值。

[cheap-first/](cheap-first/README.md)是用户纠正后的当前实验优先级及六容器暂停原件；旧活跃表不授权自动恢复。[native-lbfgs-zero/](native-lbfgs-zero/README.md)保存真实原生零步和独立重算。[nine-case-review/](nine-case-review/README.md)保存28次旧checker实跑、九题升级设计与未冻结矩阵；新增[L06阶段资格](../cases/L06/README.md)只在数学/业务范围局部有效，不计作完成十题。

[S06最终微型判定](../cases/L06/smoke/evaluator/final-smoke-assessment.json)四项通过：原生650.922秒，两方独立源码复跑/业务checker分别.818秒和.923秒，两值4.5/5.5；实际流式模型/子角色与dirty runtime如实保留，comparable=false。不是重型case、小时级或整个套件通过。

当前便宜接续：[L06严格下界独立审查](../cases/L06/evaluator/independent-relaxation/REVIEW.md)另从原输入重建1488变量/1096行，精确下界约46220.2662、可行上界51263，仍不能认证1%；[L04独立最终审查](../cases/L04/evaluator/independent-review/repair-review/REVIEW.md)冷跑实际迁移/epoch/进程恢复，抓到并复核共享NULL身份修复，最终4升级+2明确中止，原数据保存。两者都是局部资格，未批准重型冻结/候选分/小时级。

后续[L06原生整数/CP-SAT独立审查](../cases/L06/evaluator/independent-cpsat/REVIEW.md)记录阶段上界49032.9与终态来源修复。更新的[质量追加审查](../cases/L06/evaluator/independent-public-contract/quality-addendum/REVIEW.md)已独立确认最终成本47808/native界47380、基例1%可达，私有参考已预注册；严格LP与native信任口径分列。[公开合同/47叶rubric](../cases/L06/README.md)仍未冻结，独立只认可设计及10叶输出primitive，完整参考/其他37叶/变体/校准和长程候选继续待完成。当前无新增活跃长计算，active-quality只是历史快照。不得把本评估目录交给候选。

L06现有[30数值叶与完整源码参考](../cases/L06/README.md)：新精确谓词采集器只用一个业务递推，独立输入漂移/负gap漏洞已关闭；主方只读raw/source的新完整交付已真实约7分钟。参考资格不是受测agent成绩，独立完整复跑及17叶/变体/聚合/冻结仍pending。不得将其评估侧代码/答案投给候选。

L06后续[完整独立复建、变价参考和47叶聚合](../cases/L06/README.md)已获相应局部资格；真实参考44pass/2partial/1unassessed、总分null，D02实际数值控制/校准/冻结仍未关闭，禁止将私有评分/参考投给候选。

L06/0.2.0[最终独立合同审查](../cases/L06/evaluator/independent-freeze-review/REVIEW.md)现已批准冻结；当前规范路径rubric.json/public TASK.md、OUTPUTS.md、profile.json。参考正向98分不作候选分，实际新两系统/有效小时仍未完成；私有资格/控制/key不得进入候选项目。

当前L01整题建设入口为[l01-whole-case](l01-whole-case/README.md)：实际自然reaction终态与新NNCG诊断失败、同架构结构控制/原图、完整研究源码及唯一正在执行的作者矩阵。上文旧组件/活跃表仅历史，不当重启依据。未有完整L01评分或冻结。
