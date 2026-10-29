# Build协调阶段文件观测

对应[调查与实施记录](../../records/2026-10/2026-10-29-build-handoff-observation.md)。

旧真实Task的首物理执行写入文件后请求协调，提前清理并跳过Host事实发布；续跑捕获已修改的工作树，只提交已有文件，因此Review正确读取到后一轮的空差异。修复让协调出口复用同一必需发布边界，保留原不可变文件端点。历史已丢失的首轮观测不伪造补写。

正式后端checker采用真实Git、SQLite、SessionProcessor、写文件/协调工具及Build adapter，仅模型网络使用脚本流。两模式red均缺失事实，修复后25项通过、90个正向断言；类型、文档与架构索引通过，见[backend-checks.json](backend-checks.json)。

真实Code/Mission创建唯一Task，由实际Sol执行者改写两个文件、跑通两个Python测试并调用协调工具。确认前Host观测已retained；中断及重启后仍能人工打开相同原始差异，且原Git blobs与实际文件字节一致，见[observation.json](observation.json)。

完整提交工作流尚未通过：首阶段64次请求额度耗尽；一次同截止续验又遇到保留用户文本身份错误，并查出Task失败终态会自动产生Git提交，实际操作者尚未确认。55条预算失败消息、四个checkpoint事实及真实Git提交记录保留于[followup-facts.json](followup-facts.json)，进入[共享终态与恢复调查](../../records/2026-10/2026-10-29-task-terminal-checkpoint-recovery.md)，不把自动提交或模型自述当作批准。

80次实际请求均为精确Sol流式，79次200/EOF，另1次200响应在主动公开shutdown时正常abort；本轮累计873。两次公开shutdown200，原exec/native/launcher均0，物理/输出/请求全部结清，成对auth/catalog副本清退。最初全EOF私有检查器拒绝该主动abort，后续只读检查用真实shutdown请求/响应时间验证同一reader，保留原始失败与完整结果，见[runtime.json](runtime.json)。

原隔离源库92表116096行逐行不变；本次QA库schema仍9、146855行、完整性ok；27份原附件逐字节不变，新增Task/Session/事实归属本场景，原行仅两个进程容量lease的运行字段更新，见[data-review.json](data-review.json)。用户正在使用的18571页面、进程和数据库未操作。

| 原图 | 人工复核内容 |
| --- | --- |
| [01](01-real-sol-preflight.png) | 可见普通对话与精确模型预检 |
| [02](02-real-mission-input.png) | 当前独立项目、代码模式、完整有限任务输入 |
| [03](03-real-worker-sources.png) | 真实执行者与原文件Sources |
| [04](04-host-diff-before-confirmation.png) | 请求协调后、批准前的源码Host差异 |
| [05](05-test-diff-before-confirmation.png) | 同一发生轮次的新增测试差异 |
| [06](06-original-diff-after-restart.png) | 中断及重启后原源码差异仍可读；Task实际失败状态可见 |
| [07](07-original-test-after-restart.png) | 重启后同一原测试差异 |
