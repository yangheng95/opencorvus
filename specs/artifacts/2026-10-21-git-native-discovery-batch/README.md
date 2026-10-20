# Git 原生组合的局部收益及调用边界

[修改前方案和当前裁决](../../records/2026-10/2026-10-21-git-native-discovery-batch.md)。489单agent、Bun1.4.0、当前Git2.45.1.windows.1；没有生产代码、配置、schema或UI改动，没有Provider/凭据/模型请求，没有用户18571/进程操作。本批不是完整Config或视觉资格。

## 实际结果

[全部矩阵](matrix.json)、[八个原scope完整结算](physical-scopes.json)、[149个原项目输入](input-projects.json)、[原始296个Git输出](original-git-outputs.json.gz)、[原3665行保留](source-preserved.json)。各组JSON为可读摘要，相邻同名`.json.gz`无损保留原完整request/spawn记录；解压完整bytes与原文件相同，这仅验证原始记录保存，不替代功能/性能验收。

| 原组 | 局部墙钟ms | 原helper数 | 主线程最大计时间隔ms |
| --- | ---: | ---: | ---: |
| [single-a](single-a-result.json) | 17990.633 | 296 | 650.576 |
| [batch-a](batch-a-result.json) | 9389.974 | 2 | 17.386 |
| [batch-b](batch-b-result.json) | 9304.746 | 2 | 83.180 |
| [single-b](single-b-result.json) | 18581.350 | 296 | 527.191 |
| [single-c](single-c-result.json) | 17161.952 | 296 | 424.247 |
| [micro-a](micro-a-result.json) | 18920.230 | 256 | 326.677 |
| [micro-b](micro-b-result.json) | 19970.813 | 264 | 421.766 |
| [single-d](single-d-result.json) | 18089.409 | 296 | 543.387 |

每组同一完整149目录/148 Git/1非Git、原并发12、两次真实Git观察；注册目录混合循环分别44402次stat和44402次realpath，另有输入基线与输出物理身份复核读取，计数不冒充全部系统调用。全部per-project/observation的stdout/stderr与原始single-a逐项一致，设备/inode/realpath原身份检查通过；没有可变源码hash门槛。八组共1708个原helper、2368次真实Git查询观察；for-each组合器本身也是真实Git父进程，不把它们误计成查询输出。

组合组通过Git自身`for-each-repo`在一个原Process.runHost控制边界内执行148个Git后代，原Job负责整棵树/父死亡和active-process-zero结算。这里一次提交完整列表改变了调度结构，不能外推为原Project.fromDirectory已加速。

第二组micro保留原逐目录异步负载与并发12，仅把同事件轮次、完全相同原GIT_CEILING_DIRECTORIES的在途请求组合；没有缓存、固定等待窗口、worker或daemon。实际micro-a有230个单项批，micro-b有243个，因此helper仍256/264次，实测比原对照更慢。**该原型不交付。** 不从第一组局部9.3秒宣称完整保存10秒或恢复5秒达标，也不以计时间隔替代真实页面/帧速度。

## 数据与生命周期

八个原工具句柄64502/87947/7485/9279/97316/84055/3163/52471均exit0；每组独立4分钟资源边界，未延长或重启。原host/target出生时间当前复核dead_or_reused，native物理/output/request/launcher完整。每个真实request只归属对应原PID/birth/runtime occurrence，metrics live0。

源schema3/integrity ok；149Project/198Session/518Message/1155Part/1407protocol/119request/119outcome全部3665行、rowid/字段/时间及源库size/mtime保持。没有初始化或迁移源库，没有新增业务消息、Goal或成员。完整私人历史仅留私有输入，归档项目列表和真实Git路径输出用于核对。

初四组源码快照为[measure-inventory.ts.txt](measure-inventory.ts.txt)，追加四组为[measure.ts.txt](measure.ts.txt)；原启动器快照与最终启动器均保留。原始各组日志/完整request/spawn记录与准备、物理/source核对脚本相邻。没有新UI自动化或实际页面资格。

当前限制：组合的非空stderr按仓库归属、错误/部分执行、别名/损坏.git、跨进程注册、取消/恢复及所有生产入口尚未获得新资格。下一方向需评估显式批量发现边界与原初始/准入两次新鲜观察，先完成完整Project/Instance/注册算法影响分析；不能以增加等待窗、泛化ceiling、缓存旧事实或新旁路绕开问题。
