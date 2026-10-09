# 247 共享流式正文前缀恢复

本轮只由 root 单 agent 执行。修复前，正文增量只进入临时事件和运行累加器，持久 Part 在自然结束前始终为空；246 的两次真实侧栏返回因此从 649/851 个显示字符降到 13 个。247 沿已有 Tool input 的同一个 200ms 发布队列保存完整正文前缀，保留原增量事件；结束、重试与中止沿当前身份和写入契约收敛。

- [方案与 Recall](../streaming-prefix-plan-247.md)：分析、共享入口横审、公开契约、原失败与实施准入。
- [后端检查](checks/README.md)：真实本地 HTTP（Hypertext Transfer Protocol，超文本传输协议）Provider、当前 SDK（Software Development Kit，软件开发工具包）/processor/持久层/会话事件，5 项新正向契约及 26 项相关回归。
- [live-01 原始边界](live-01/README.md)：原 Native 正常退出，但重新打开照片晚于模型完成，不当作运行中恢复通过。
- [review-01 补齐真实验收](review-01/README.md)：仍在生成时关闭整 Dock、重开同一消息、回读持久前缀、恢复开头阅读与自然完成。

两次均使用独立 `/ui` 开发服务，完整成对 auth/models，预检分别证明凭据可用、目标模型已投影、实际 `gpt-6.1-sol` 且流式。累计请求预算分别为 12，实际各 9 次 200/EOF（End of File，流结束）。原 foreground 分别 91189、42251 已 join，实际 exit 0；两原 Native、物理进程、输出、请求与成对凭据退役由各自原始记录和独立回读证明。没有延长期限、重启原 scope 或关闭用户服务。

这次真实证据覆盖 Side chat 与普通主对话。原 Research 子 agent Dock、完整 Task/Mission 重启恢复、更高并发吞吐和所有 Rendering 帧仍未逐项实测。流式未完成列表仍会出现原始 Markdown（轻量标记语言）尾部；本轮只修正文恢复数据根因，不宣称所有视觉问题已经解决。200ms 是调度节奏，发布背压可能延迟下一次持久前缀。
