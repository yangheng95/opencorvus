# Manifest薄reader、选优及公开产物合同独立审查

审查者：`/root/benchmark_review`。没有修改主仓库、读取作者代码/凭据、再次委托、启动服务/模型或任何资格训练。全部新文件仅写入本目录；本轮测试和探针是合成reader合同，不是训练或科学结果。

## 最终局部结论

**以`source-final-stop/`捕获版本为准，本轮已发现的I/O、引用与终态声明计数缺口修复后可认可，未发现新的实质阻断。** 这不批准L01冻结，不认证逐尝试trace/receipt内容、实际参数来源、计数真实性、恢复、论文或训练。所有成功返回仍为`artifact_contract_checked`，训练未认证且两个scientific outcomes为unassessed，公开OUTPUTS文案与此一致。

## 原件及实际复跑

- `source-snapshot/`：初版，独立实际运行原10项测试通过，同时保留当时失败探针。
- `source-repaired/`：中途路径修复快照，仅封存，不冒称已执行该特定中间版本。
- `source-final/`：路径修复及原生路径错误转换版本，独立13项测试通过；此时仍接受矛盾的plateau/stalled声明，原件保留。
- `source-final-stop/`：增加终态必要计数的最终本轮版本，独立15项测试通过，并重新运行全部路径/选择/状态探针。

精确命令、UTC、退出码和原始stdout/stderr在`executions.json`、`executions-final-stop.json`及同名前缀文件。探针输出在各版本`*-probe-results/observations.json`。测试代码只在自有临时目录创建纯数值零权重、空trace与明确synthetic receipt；声明41000不意味着发生了任何训练。

## 已修复且实际复核的缺口

1. 初版写死project/results/manifest.json，合法自定义输出根会json_read失败。最终函数第三参数及CLI --manifest均必需，manifest相对项目根解析；自定义trial-a/manifest.json的24记录结构实际通过，不再混淆项目根与输出根。
2. 初版对0-attempt incomplete的非null trace/receipt跳过类型/作用域校验，`../outside.jsonl`及对象类型可被接受。最终每个非null引用均独立检查；两个探针分别返回artifact_scope和artifact_path。
3. NUL真实CLI最终返回artifact_path机器收据、退出2。**初版在本机的实证是artifact_file且同样退出2，未出现未捕获异常**；不将先前担忧包装成已发生事实。最终另将原生resolve异常统一映射到artifact_path，原始前后输出保留。
4. 路径版仍接受仅1次更新的finite_plateau、0次尝试的optimizer_stalled。最终分别返回plateau_count和terminal_attempt；有效25步plateau及一次未接受终结的声明合同也由最终15项测试覆盖。max_updates各阶段attempt=accepted=注册上限，末阶段的终态必要计数已纳入结构检查。

这些只证明声明自身逻辑一致，不证明25次更新或一次失败真的发生；真实值仍须轨迹、源码、命令和受控清洁重训核验。

## 注册、权重与选择的实质核对

- profile是19基础+5续训的唯一ID/参数来源。集合必须完全一致且每ID一次；缺项和重复项分别得到run_coverage/run_id_unique。不增设另一个注册表。
- 最终初始配对探针中，同PDE/seed的两个基础方法使用不同初始8数组，实际返回initial_pairing；续训initial与所选父final一致性由原测试的真实NPZ读取及明确差异错误覆盖。只比同一角色的数值状态，不把一致性当成Xavier真实性或训练证明。
- 续训父只从seed345三hybrid合法有限终态按独立训练total_loss最小选；完全相等时较小Adam学习率。未完成或数值失败的中途checkpoint不入父候选。
- PDE最终解另按profile.solution_selection：seed345基础合法有限终态，convection加注册续训；训练total_loss最小、精确tie按config ID字典序。本审查者以真实零权重读取集成验证了两种tie的差别：父为lr1e-04，而相同loss下最终解ID为lr1e-02；这是公开的两个不同规则，不是按L2RE挑选。
- 额外集成探针以较低训练loss的numerical_failure与较高loss的合法终态竞争，失败被正确排除，未充当最终解。全部不合格时解为null；continuation_parent为null时五续训依赖状态及零计数/null文件按合同检查。
- 所有质量分量来自选定ID的同一个final网络。独立metrics读取纯数值8数组，不执行候选推理或pickle；它不能验证receipt里实际运行了哪些超参数，这一点OUTPUTS已说明。

## 快速R9原子化核对

附带检查的捕获rubric为189叶、总100分，各组权重与groupPoints一致。14个calibration-pending叶共9分，每PDE3分：L2RE1、评价残差RMSE1、条件族共1（两族各.5，wave四族各.25）。全部critical、threshold=null、comparison<=，均显式绑定public/profile.json:solution_selection，同一模型不允许跨checkpoint拼接。

14个metric路径能在独立数值输出中解析到对应PDE标量；这证明字段对齐，不证明阈值已校准。增加叶数不证明难度，也不替代可达性、完整父选择/最终解选择的真实见证。R9继续pending，不能发布成功分或整体freeze。

## 合成夹具与真实性边界

OUTPUTS明确文件/结构检查不认证trace/receipt内容；源码返回training_attestation=not_performed、study_complete=unassessed、solution_reproduced=unassessed。合成24条未开始记录可以结构通过，合成41000/空trace也可能通过薄reader，但没有被当成完整研究通过。该边界目前公开且一致。

仍需受控新目录执行完整源码、逐尝试停止证据与调用计数、真实参数、共享前缀与恢复来源、论文/图和最终质量校准。本轮没有填写阈值或候选成绩。
