# 可读权限审批与紧凑历史

Task 的实时请求和历史重建现共用一个原 ledger Request 投影。摘要不再拼接诊断 JSON；Task 与独立 Session 都保留完整结构化 scope。待审批弹窗直接显示可滚动的请求资源，技术身份可展开；已完成请求以单行标题展开详情，原决策单独保留。中英文标签随当前语言切换，原技术值不翻译。

[真实功能与持久化](results.json)：同一 Task 新 Goal 自动重开 epoch4，实际只读、输出 PERMISSION467READY、Goal complete 和 Task completed；写入和完成均通过真实单次批准。独立 Chat 的 write 请求也经中文弹窗单次批准，实际文件为 PERMISSION467FILE，模型实际输出 PERMISSION467DONE。该全局新 Chat 归属产品新建的匿名项目，文件在自有 QA runtime/data/projects 下；没有把它伪称为原 project 目录的文件。

[实际页面](manual-ui.json)包含17张1280×720人工截图：

- [原历史的新呈现](task-history-en.png)、[展开](task-history-details-en.png)、[滚动后可读详情](task-history-details-visible-en.png)。
- [真实 Goal 审批](task-approval-en.png)、[展开审批详情](task-approval-details-en.png)、[Task 完成审批](task-completion-approval-en.png)。
- [中文完成历史](task-completed-zh.png)、[重新选择恢复](task-history-restored-zh.png)。
- [独立 Chat 中文 write 审批](chat-write-approval-zh.png)、[完整身份](chat-write-details-zh.png)、[实际写入完成](chat-write-completed-zh.png)。
- 视觉复核发现历史仍有冗余行，最终重新构建：[英语单行历史](final-history-en.png)、[最终详情](final-history-details-en.png)、[中文单行历史](final-history-zh.png)。最终 scope 还验证键盘收起、URL恢复和语言恢复；最终布局修改只影响 compact 历史，真实待审批帧来自前一正式构建，其 pending 分支内容与样式保持一致。
- 删除无调用方的旧文本分支和正文样式后，再次构建并用独立页面复核：[当前英语布局](current-history-en.png)、[当前完整详情](current-history-details-en.png)、[实际选择与复制](current-details-selected-en.png)。原scope与Ctrl+C实际复制均为920字符，原空剪贴板已恢复。

[检查记录](validation.json)保留原恢复失败与修复后24例正向合同。恢复失败揭示后台交接保留了已关闭的数据库 post-commit effect owner；Task 后台入口及 Task/Mission 控制驱动独立重入现使用原数据库上下文脱离 primitive。原 A2A 和 activity-reconciliation 失败均重跑通过，数据库 closed-owner 校验保持。其他独立 Session/scheduler/OS 回调的共性审计仍开放，没有据此宣称全局所有恢复问题已根治。

[原 native/Provider 结算](native-settlement.json)与[复制对退休](private-pair-retirement.json)记录三个原服务/公开shutdown/原launcher全部结算。15/预设16个实际 Sol 流均200/eof；完整模型目录与凭据分别预检，源未写入/refresh。完整历史131 Project/176 Session、原目录/归属和 schema2保留。删除检索到的一份 UI 自动化测试，没有新增或运行 UI 自动化。配置性能、Sources/侧agent直播 Rendering 等原未达项继续保留。
