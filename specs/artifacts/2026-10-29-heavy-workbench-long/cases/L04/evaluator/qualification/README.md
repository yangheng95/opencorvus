# 已有数据库/事务切换实际资格

`originals.zip`保存各轮完整源、输入、结果数据库、argv/PID/exit/stdout/stderr和控制事件。`run-a`为最初从已知seed创建原库的构造；`run-b-explicit-input`是首次必需--input版本，从相同关闭原库复制四个新实例。源码快照与初轮source不改写；seed只作归档准备材料，不进入当前执行器。

后续独立NULL身份反例推动修复，当前实现/完整实际源为run-d-storage-identity-final的四源（新增共享l04_request.py），run-b是修前必需--input历史，不能继续称最终实现。run-c/run-d共保留4成功升级+2明确身份歧义中止场景，最终53进程/245事实、约7.18秒；合法收据保留及v2 NOT NULL/非空约束真实验证。不是依据数量给重型分数。

核心结果是逐业务身份/金额/币种/退款、权威别名、隔离raw、schema迁移史和收据/audit真实保存，进程中断前/后的独立数据库查询、恢复与后续合法写可复现。存在旧写者进入后再切换的真实进程/阶段握手，其结果为stale_epoch；源数据库无WAL，只使用本地DELETE/FULL。没有模拟物理断电或用户进程。

复核先解压到自有新目录，只复制current-source或该轮executed-source及inputs/v1，然后：

```text
python -B qualify_migration.py --input <冻结原输入目录> --output <不存在的新目录>
```

执行器不从既有结果库恢复，不在输入目录写入。终态库/过程原件支持便宜局部资格，不构成完整重型L04、回退/前向修复政策或数小时证明。独立审查结果另列。
