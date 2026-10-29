# 数值/机器交付工具：完整局部检查

在既定科学镜像、自有无网络只读CPU容器中，从本目录保存的源码快照实际运行18 NumPy + 13 manifest + 3 Torch = 34项测试，全通过。精确命令、退出0、耗时与完整输出见execution.json及stderr.txt。未请求GPU、未训练、未调用模型；本目录不是候选答卷或科学成功证明。

此前主机过宽pattern选入Torch模块时因未安装Torch而整体失败，不能当34项通过；在准备好的科学环境完成了同一工具全范围验收，主机不装全局依赖。manifest夹具使用明确合成计数和结构，只证明薄reader返回端点及unassessed状态，不能证明训练发生。独立审查另存manifest-review，不能用本轮通过替代其结论。

## 终态必要计数修复后的当前验证

本目录根部的34项是修复路径后的历史快照，不能称最终源。最终reader增加plateau/stalled必要计数后，`terminal-count-repair/`从修后源码另起同一无网络只读CPU环境，实际18 NumPy + 15 manifest + 3 Torch = 36项通过（exit0）；源码、命令和完整输出分别保存。新增问题/改动是重跑原因，没有重复训练或消耗模型。独立结论见相邻manifest-review/REVIEW.md，仍未批准科学freeze。
