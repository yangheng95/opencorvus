# 312 来源侧栏 Rendering 调查

[Recall 与实施前调查方案](../../artifacts/2026-10-05-connection-workspace-authority/source-render-plan-312.md)。单 agent。

真实普通Side chat交替产生两条来源和4938字符原始正文，7次gpt-6.1-sol流式请求全部200/EOF。观察帧中既有正文保留，来源可读，重开Dock回到原文件来源附近。当前样本没有复现反复Rendering，也不支持来源迟到再切分已存在正文的候选触发，因此不改生产代码。

[截图、实际时间线及限制](../../artifacts/2026-10-05-connection-workspace-authority/source-render-312/README.md)。下一步应调查SubagentConversationPanel专有实时合并/补全路径，不能用本轮普通Side替代原Research Studio当前子侧栏流式资格。页和服务已关闭，原执行器实际exit0；goal保持active。
