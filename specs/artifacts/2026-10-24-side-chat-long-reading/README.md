# 长回复中的阅读意图与原 Sources

[Recall、方案与资格边界](../../records/2026-10/2026-10-24-side-chat-long-reading.md)，[真实运行证据](evidence.json)，[原来源身份](source-identities.json)，[安全请求观察](requests.jsonl)。本轮一个开发 agent、两个隔离内置浏览器页面，全部下列图片实际呈现并人工查看，没有用户界面自动化测试、模拟流或合成消息。

563只覆盖约两秒短回复，本轮补齐真实长流：原 Side chat 2 接收一次有限用户请求，实际 gpt-6.1-sol 输出 01—80 项、4,377 字符，规范 Message `msg_g0VYv5h4100McYySB2lj` 自创建到完成为 101,527 ms。原 Provider reader（读取流）于 23:50:29.688 UTC 开始读取，23:52:09.218 UTC EOF（End Of File，读完），规范 Message 随后完成。图片的实际写入时刻和这条原始流边界逐项列在 evidence；没有用“正在处理”文字或模型自述单独证明仍在生成。

| 图片 | 实际资格 |
| --- | --- |
| [01](01-original-source-before-stream.png) | 长流前，原 Task 的 base-researcher · 1cq3 来源卡片、ACL 标题/域名和复制入口真实可见。 |
| [02](02-side-paused-during-stream.png) | 23:50:36，原流读取中实际上翻，旧侧聊消息与恢复按钮可见，底部仍为停止/处理中。 |
| [03](03-original-source-during-stream.png) | 23:50:55，流读取中查看另一页，原成员来源及读位保持。 |
| [04](04-side-still-paused-during-stream.png) | 23:51:40，仍在同一原流内，旧侧聊读位继续保持。最初误用完成后文件名，按真实资格改名保留；不是完成态截图。 |
| [05](05-side-paused-after-eof.png) | 实际 EOF 后输入框恢复，仍保持原阅读位置和恢复按钮，未被新长文拉走。 |
| [06](06-long-reply-latest-after-jump.png) | 手动点击“滚动到底部”，真实长回复第 77—80 项与引用入口可见。 |
| [07](07-original-source-after-eof.png) | EOF 后再次查看同一成员，原来源标题、URL、复制入口和原文位置保持。 |

原来源来自既有已完成 Task `tsk_g00VYhrJxy00qIC54qvM`，其独立子成员 `ses_h0gcSAerl0lMXEbz1cq3` 的 Source Part `prt_g0VYhrsML00F2uyTDsUa`，不是 orchestrator 正文或新增模型伪造的引用。另一条原 arXiv Source 也保留 canonical 身份。这里只读取过去的成员记录，没有运行、委托或创建任何子 agent、Task、Mission 或持续目标。

两页实际五个流实例：每页一个工作账本、一个原 Task 事件流、一个主 Session 事件流和一个 Side Session 事件流。每个都有同一 stream ID 的短 admission（准入）和实际请求记录，关闭两页时各自 abort；本次未重建这些实例。只就本轮实际流和实图报告稳定，不扩展为所有 Rendering 入口已根治。

真实模型请求共 4/上限 6：预检 chat/memory 两次、新长问题 chat/memory 两次，全部 gpt-6.1-sol、流式 200、原 source reader EOF。凭据、模型投影、实际模型分别验证；当前完整 OpenAI 条目及完整相邻模型目录配对复制，auth/catalog 各退休一份。原 catalog 完整内容、9,155,406 字节及修改时间保持。

原 exec 93807、原生 target 93056，完整 occurrence（执行轮次）/birth 身份见 evidence。独立 20 分钟原生边界、180 秒启动无活动、五分钟收尾；公开 shutdown 200，预留 802,537 ms，原 exec/native/launcher 均退出 0，physical/output/request 完成、原链 dead_or_reused。

源 90 表原 175,427 行的完整身份/字段/时间、数据库字节/修改时间与完整配置保持，schema 4→4、实际对象一致、integrity ok。目标原行仅本项目记忆 chunk/file、两条容量租约和实际接收新问题的 Side2 time_updated 正常变化；其余旧 Task/Mission/Session/Goal 及原 Source 字段保持。规范记忆修订 4→5、321→482 tokens，待办正常消费。没有接触用户数据库或 18571 进程/窗口。

本轮没有复现新产品缺陷，没有改生产代码、前端或迁移，也没有无目标重建；使用563完整 `main-BGogOrxR.js`。文档及正常推送检查是补充，视觉资格来自以上实际页面。

另有可复核的后续线索：三个没有持续目标 created 事实的当前 owner，在本次两页观察期收到 72/62/59 次持续目标 GET，共 193 次。当前组件既监听规范失效通知，也设置定时 refresh；是否可以收敛轮询须下一批完整审计，不能把此计数直接当成 Sources 闪烁根因。事实源为 `protocol_event continuous_goal.created`，`engine_goal` 是另一类 Task 验收目标，不混同。整体 Goal active。
