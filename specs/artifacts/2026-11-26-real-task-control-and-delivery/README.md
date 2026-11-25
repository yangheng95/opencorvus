# 真实任务控制与交付证据

本批使用用户授权的 GPT-6.1 Sol，实际物理请求 32/32，全部流式、HTTP 200、正常来源读取结清与 EOF（流结束）。已修复检查器遗漏必填专家团身份的问题，实际完成首个源文件检查 Task；第二 Task 因额度耗尽失败，取消与重启阶段尚未进入，完整验收未通过。

- [请求额度与两次运行的真实结果](request-budget.json)：基线 2、复验 30，共用 32 上限；含阶段状态和配对副本清理结果。
- [全部实际模型请求回执](model-request-audit.json)：真实模型、流式、HTTP 状态及来源读取身份，没有请求正文、HTTP header（请求头）或凭据。
- [基线正式 Provider 预检](baseline-provider-preflight.json)及[复验预检](after-provider-preflight.json)：分别证明凭据可用、目标投影和实际请求模型一致。
- [真实 Task 持久化事实](task-facts.json)：从已结清运行的数据库只读导出，含 Task 创建、真实生命周期、派发和完成决定；不以模型总结单独证明任务完成。
- [基线创建错误](baseline-create-error.txt)：正式接口对缺少 `promptProfile` 的原始 400 响应。
- [真实完成 Task 页面](desktop-completed-task-loaded.png)：本人查看当前模型、原请求、真实成员进展、完成操作和终态，未要求额外文件交付。
- [第二 Task 的额度终态](desktop-budget-limited-task.png)和[展开的原始错误](desktop-budget-error-details.png)：本人实际切换、查看并展开。第二 Task 没有被表述为成功。

截图来自正式开发服务 `/ui` 的专用桌面 Chrome 标签页；没有新增或运行界面自动化。原始完整日志和运行根保留于本批临时目录，原始 `source.patch` 含既有无关工作区差异，未纳入本批提交。两次运行的凭据及模型副本均已退休，不归档凭据或数据库。
