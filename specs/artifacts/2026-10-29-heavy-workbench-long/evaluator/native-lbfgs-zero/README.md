# 真实原生L-BFGS零步边界

构造四层width100网络，全零权重、output bias=2e-8，在权威convection数据上实际调用Torch2.7.1原生L-BFGS一次。真实n_iter1/closure1、native t=1，但参数变化0、接受更新0；梯度约1.43575e-8高于1e-9，gᵀd约−2.06139e-16触发方向导数保护，正确状态为optimizer_stalled。

`execution.json`、`executed-source.py`、前后NPZ与`receipt.json`是主评估者实际CPU执行；`independent-numpy.json`另从8数组和手算bias梯度重算完整网格。相邻九题审查归档的native附录另用纯标准库核对12项，不冒充第二次native运行。

这是刻意构造的边界，违研究随机初始化；它不是注册参考解、R9好解或候选成绩。它证明不能把native n_iter、t或一次step调用直接算作接受更新。
