# 完整续训与真实新进程恢复资格

此处仍是评估侧可达性与工具资格，没有候选Task或正式成绩。

- `nncg-200.zip`保留完整μ=1、第三分支seed的200次实际接受更新，10次Nyström刷新；`nncg-200-summary.json`、`nncg-200-trace-audit.json`与`nncg-200-independent-final.json`可直接阅读。最大PCG显式相对残差9.98e-9、全部Armijo通过、最小参数变化3.62e-4；总17614次海森矩阵向量积，1256.165秒为共享GPU环境分支耗时。独立终值loss0.0004707843653、L2RE0.28797693。该基点没有完成三学习率选优，结果不能冒充完整注册研究或原论文精度。
- `lbfgs-restore.zip`、`lbfgs-restore-receipts.json`、`lbfgs-restore-processes.json`：reaction/wave从真实第100次接受更新的完整优化器状态，在新进程各执行20更新，与原未中断第120权重逐参数最大差均0。原进程仍存活且PID namespace不同，新Docker容器身份也保留；容器内PID均为1，未单独拿该数字证明新进程。`*-uninterrupted-120.npz`为对照原权重。
- 两个约33MB的原L-BFGS状态保留在本机原始私有运行存储，精确位置/大小在`large-state-locations.json`；没有把原始状态暗称已包含在小zip中。重新生成这些快照须运行已归档的代表训练源，再运行`qualify_optimizer_restore.py`；此证据包不是独立完整研究重训包。
- `adam-restore.zip`包含500更新完整快照、600更新未中断权重、新容器恢复后100更新权重与回执；原始命令与0/0退出在`adam-restore-execution.json`。逐参数最大差0，没有重跑前500更新。两次真实Docker创建身份不同，namespace inode可能复用，未把它当唯一证明。初始600步的L2RE约1只是早期恢复对照，不是PDE解合格。
- `original-paper-page-20.png`由随包原PDF第20页实际渲染并查看，确认算法5/6与未定义v0的原符号；没有把OCR文本当唯一数学依据。该页保留原论文CC BY4.0归属，来源见public/SOURCE.md。

源文件和回执区分重新训练、继续训练、仅重算、局部错误注入及控制面注册解析。CPU/CUDA随机状态均在真实快照中加载；确定性全批训练的参数一致性不能额外冒称已测试任意随机训练分支。当前仍缺三问题最终质量底线、低质量对照、完整候选长跑/清洁复训与正式双审。
