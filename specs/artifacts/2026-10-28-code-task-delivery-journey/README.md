# 当前代码任务交付证据

记录见[输入、输出与验收方案](../../records/2026-10/2026-10-28-code-task-delivery-journey.md)。13张原始JPEG截图均实际呈现并人工查看，未改像素；通常1280×720，完整产物工作区2560×1440。

- [01 原始请求](01-code-mission-request.jpg)：真实Code Mission输入和上下文。
- [02 Mission运行](02-mission-running.jpg)、[03 Task运行](03-task-running.jpg)：自然创建的真实参与者及进度。
- [04 原Skill错误](04-task-member-tool-result.jpg)：工具组中的Skill引用名调用失败，不能把组标题glob当根因。
- [05 旧会话位置](05-task-operator-followup.jpg)：原历史内容，不证明补充输入已在当前视口。
- [06 补充授权](06-task-followup-current.jpg)：同一任务接收本地提交授权并继续。
- [07 原任务完成](07-task-completed.jpg)：规范完成、两份Python文件及实际改动。
- [08 修复后实际加载](08-fixed-skill-load.jpg)：真实返回dynamic-team-method完整内容。
- [09 独立审查](09-independent-review.jpg)、[10 修复后任务完成](10-fixed-task-completed.jpg)：真实审查与规范终态。
- [11 文件预览](11-delivered-source-preview.jpg)：预览已打开，正文局部可见；[12 完整实现](12-delivered-source-workspace.jpg)、[13 完整测试](13-delivered-tests-workspace.jpg)为实际完整阅读区域。

[运行事实](runtime-review.json)包含两个真实Code Mission、旧/新不可变包绑定、精确Skill请求与结果、聚焦检查的原失败与最终2项59断言通过、独立Python12项与四个原结果、数据库原行及明确正常变更、三个实例结清和真实下载字节。

案例原输入为[浮点初始实现](case/original-invoice.py)，真实交付为[invoice.py](case/invoice.py)与[test_invoice.py](case/test_invoice.py)。浏览器实际下载分别889/2053字节，等于原本地交付提交7ec5560与项目文件。它们是本次自有模型任务的真实输出，不是产品UI自动化测试。

范围：26处加载指令、16个包更新为2026.10.28.1；其他能力身份与授权不变。实际新增168次Sol流式请求，累计556；无凭据阅读实例零调用。两个付费实例未达十分钟关闭目标，三个实例均满足五分钟结清余量，认证副本退休。未声称各领域模型工作流、全产品或发布全部通过；Mission附加Git限制另行调查。
