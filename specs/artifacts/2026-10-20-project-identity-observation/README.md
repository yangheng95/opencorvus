# Project 身份读取观察证据

[Recall与验收合同](../../records/2026-10/2026-10-20-project-identity-observation.md)。只保存选定真实阶段、正向合同和物理结算；凭据、数据库及完整Provider正文不入库。

最终完整性能目标 **failed**：60项目冷保存19.72s，恢复4.44s；冷写期间真实页面GET/global/config 5.745s/200。数据完整接受/恢复、Ask及全量60项目校验通过，cold<=10s未达到。checks/benchmark-result.json.gz保留原门槛及各自资格；before/after/final-cost保留原requestID、span与阶段，lifecycle保留真实逐出/重建与读取事实。

- 01/02：before进入页面时的Not loaded及后续Ask。
- 03：第一版scope的真实页面结果；其剩余窗口已在记录说明。
- 04/05：最终源码下保存中返回New chat、进入General后的实际Ask页面。

accepted-contracts包含28项/80expect的正向运行合同：完整候选、重复投影失败恢复、旧跨进程事件顺序、lease/刷新/回收及锁序；初次失败和撤回锁序实验日志均保留。最终所有自有scope shutdown200、原句柄join0、native physical/output/request结算；运行及私有auth/models均成对退休，6次真实预检均gpt-6.1-sol/stream/200/EOF。UI只有真实交互和人工截图，没有UI自动化。本轮不改变schema或真实用户数据库。
