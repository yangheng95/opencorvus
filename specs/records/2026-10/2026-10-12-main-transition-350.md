# 350 长消息重排阅读位置

真实长用户消息尾部仍可见时，开关右栏让第一可见虚拟item内部增长约一千像素，主会话从R35/R36跳到R23附近。该问题在仅三段研究正文时已复现，owner/epoch稳定且Markdown未等待，排除了阶段交接与32缓存作为必要条件。

主reader现在通过原有恢复机制保持真实Markdown段落，并处理viewport width和布局回声；已有输入所有权优先，keydown登记使用capture，避免controller重建后的监听顺序漏掉PageUp。真实Task、Session往返、动画中PageUp、新阅读点保持与在线回底均已截图复核。

[Recall](../../artifacts/2026-10-05-connection-workspace-authority/main-transition-plan-350.md) / [20张截图、失败记录与实际检查](../../artifacts/2026-10-05-connection-workspace-authority/main-transition-350/README.md)。01真实Task通过，02固定时限资格失败完整保留，03四分钟内重新在线验收并主动闭合。最终类型/构建通过；无UI自动测试，原长期Research Studio全帧Rendering仍属未覆盖边界。
