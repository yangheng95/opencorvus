# sqlite-utils完整安全导入任务：原生对照准备

这是新的完整仓库任务，来自[固定DeepSWE原任务](https://github.com/datacurve-ai/deep-swe/tree/0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea/tasks/sqlite-utils-safe-import-checkpoints)，base为`simonw/sqlite-utils@8d74ffc93292c604d5827e2b44fffedca0c28c19`。不是重跑原月结/L01/L02/L06。用户原十题/有效候选小时仍0/10；来源的long-horizon标签、源码/测试数量和作者执行耗时均不补资格。

[实施前Recall及影响/公平合同](BUILD-PLAN.md)先于准备代码。完整真实仓库、原task/环境/tests/solution及原引用封在`D:/opencorvus-benchmark-runs/sqlite-safe-import-pair-20261101`；不修改原reference，先按本机独立runtime运行。候选将只得到原base和[公开完整任务](public/TASK.md)、原prompt、[质量维度](public/QUALITY.md)、[同运行时](public/RUNTIME.md)，无private tests/solution/旧答案/Recall。原任务与上游均Apache-2.0，原源码LICENSE保；引用不是官方Linux/Docker/网络锁定成绩。

## 真正消费及边界

当前单一[evaluator](evaluator/consume_native.py)实际运行完整原60个新功能函数的正向状态/具名错误适配，并执行真实子进程CLI：普通insert、启用、持久invariants、safe insert/upsert/bulk UPDATE的提交/错误回滚、独立sqlite3重新打开核用户数据/schema/index/trigger、list/validate/disable。SQL预期来自固定测试交易和明确旧状态，不来自作者缓存。API异常检查真实类型名称，不强加作者定义模块；不透明id CLI按字符串表示、内部metadata表名不作通过条件。`native_commands.status=committed`是该原准备代码对进程0的标签；业务提交结论另以实际SQLite状态确认，validate命令0不能冒数据提交。

| 完整programme（候选前登记） | 当前真实子进程exit | 结果 |
| --- | --- | --- |
| 未改原reference | 0 | 60函数通过，真实CLI全链及独立用户状态相符 |
| 合法内部表名/ID前缀替代 | 0 | 同完整实际消费者接受合法实现组织 |
| rollback方法真实执行commit的完整错误源 | 4 | 实际数据库状态与恢复预期冲突，原失败/差异保 |
| 原完整base，未实现新功能 | 4 | 新功能具名失败；普通insert可执行，enable命令1，后续阶段未执行 |

[逐programme全结果/原argv](evidence/validation-summary.json)保全部向量。不能将base缺同一能力导致的60失败当60独立缺陷、错误率或难度；首base因原异常import得到collection error时60函数尚未执行，外层PowerShell1/未独立捕获的Python父码也不冒4。原第一reference、工具观察问题和各适配前原件全保外部，最终consumer先另封后验证。源snapshot首次维护遗漏如实记于Recall，不伪造归档。

未跑未审的全base pass-to-pass测试；只对直接相关原普通操作作实际回归。这个有限prepared contract不认证任意SQLite版本、所有SQL/嵌套边界、完整旧功能回归或统计成熟。原negative断言未作为当前消费者运行；真实正向整状态和具名错误合同替换，原件是不可变研究输入。所有原生执行使用独立新venv，无Docker/WSL/用户窗口、UI自动化、旧venv/GPU改动或新模型请求。私有消费者不是candidate交付，不给候选参考解答，也不代替接下来的真实Codex/OC结果。

下一是正常Git保存/同public和base冻结后一次必要fresh原生对照；不在作者准备、更多参考/小题/组件资格或重复整审处宣称十题完成。当前candidate/Provider尚未启动，以外部current.json和后续真实启动收据优先。总心跳ACTIVE/20min保持。
