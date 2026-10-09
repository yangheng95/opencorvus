# 247 关闭再打开侧栏时恢复流式前文

用户要求持续自主发现和修复产品问题，最新限定只用单 agent。246 已修提交草稿的请求归属，但留下两次真实正文恢复失败：运行时 canonical TextPart 为空，侧栏重建后只能收到新增量，前面的 649/851 个显示字符降为 13 个。

247 修复共享 producer。currentText 仍是唯一累加器，已有 Tool input 的单个 200ms 发布队列同时写完整正文前缀；原流式增量继续提供给 CLI（Command Line Interface，命令行界面）和 ACP（Agent Client Protocol，agent 客户端协议）。自然 text-end 先等待发布完成，失败与中止保存最终已接受部分并结束 Part，重试沿既有 attempt 清理。没有新正文存储、重放层、伪消息或前端补字。

新真实本地 HTTP（Hypertext Transfer Protocol，超文本传输协议）Provider 检查修复前因缺持久前缀失败；修复后 5 项正向测试通过，覆盖晚连接、同 Part 最终输出、Unicode、中止、真实网络重试和两项目并行。相关 26 项回归及后端类型检查通过。原扩展夹具的两类失败单独保存并修正夹具生命周期，未混称生产缺陷。没有运行 UI（User Interface，用户界面）自动化。

两个独立 Sol 开发服务均正常退役，各有 9 次真实流式 200/EOF（End of File，流结束）。live-01 返回太晚，完整照片已在终态，不作为运行中恢复通过。review-01 取得关键证据：关闭前 Working/1277 显示字符，整 Dock 卸载后返回仍 Working/1879 字符，运行数据库的同 Part 已保存 2202 字符，回到开头照片早于实际最后字节；最终完整正文 3218 字符、空且可用输入框。原 foreground 均实际 join exit 0，物理/输出/请求/端口/成对凭据退役另有独立回读。

完整分析、原失败、后端检查、人工照片和正常退出见 [Recall](../../artifacts/2026-10-05-connection-workspace-authority/streaming-prefix-plan-247.md) 与 [证据索引](../../artifacts/2026-10-05-connection-workspace-authority/streaming-prefix-247/README.md)。原 Research 子 agent Dock、完整 Task/Mission 重启、高并发性能和所有 Rendering 帧尚未逐项验收；200ms 调度可能受发布背压影响。本轮是已提交批次的进展，持续迭代目标不标记完成。
