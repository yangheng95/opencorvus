# live-01 真实新构建视觉复测

实际 own IAB（In-App Browser，应用内浏览器）90 使用开发 `http://localhost:18183/ui/`，[页面资源](served-assets.json) 确认 main-t7w5atJn.js。Main `ses_-zUSPxmJuzzSR887zu40` 实际产生 4 个 Source URL 和 282 字符结论；Side `ses_-zUSPxg3Jzzl87bIwGO4` 继承 4 条消息和相应来源。新 User `msg_164ad940-d181-4fa9-943e-b328e3e33da4` 为 233 字符，Assistant `msg_g0VXa2PIF00FAHBeAfsL`、TextPart `prt_g0VXa2QgM005YIzOone7` 最终 3586 个原始字符。

| UTC 观察 | 实际事实 | 证据 |
|---|---|---|
| 18:57:14.834 | 仍 Working，已接受正文 1002 个显示字符，列表第 4 段粗体/编号正确；第 5 段未闭合的标记按 parser 当时解释显示 | [运行照片](side-running-list.jpg)、[诊断](side-running-list-geometry.json) |
| 18:57:35.748 | 仍 Working，回到第一段阅读，介绍的行内代码和标题格式可见，scrollTop407.3333435058594 / height2586 / client466 | [阅读照片](side-reading-prefix.jpg)、[诊断](side-reading-prefix-geometry.json) |
| 18:57:58.423 / .581 / .637 | Source reader 最后字节 / EOF（End of File，流结束）/ Message 自然完成 | [原 Provider](streaming-markdown-248-live-01-final-provider-audit.json)、[原 canonical](canonical-current-conversations.json) |
| 18:58:01.644 | 只读 SQLite observer 已是终态，不能作为运行中数据库证据 | [原标量](live-canonical-metadata.json) |
| 18:58:23.983 | 同一首段仍可读，scrollTop保持407.3333435058594，height4227 / client388；正文3319显示字符、12条列表 | [结束阅读](side-reading-terminal.jpg)、[诊断](side-reading-terminal-geometry.json) |
| 终态来源与末尾 | 3项搜索来源各有真实标题/域名和摘要入口，实际抓取来源另有原URL；部分表格及代码可见 | [Sources](reference-sources.jpg)、[表格部分视图](side-terminal-table.jpg)、[代码](side-terminal-code.jpg) |
| 18:59:48.029 | 输入为空、可用、高72px，阅读区388px | [原尺寸与状态](side-terminal-geometry.json) |

两张关键 Working 照片均早于同 Assistant 的 Source reader 最后字节；不是用已完成文本模拟流式。未以 DOM（Document Object Model，文档对象模型）节点计数、构建结果、console 或 EOF 替代人工视觉。scrollTop保持不能等同于所有像素不变：时间/作者 header 与输入区在结束时改变，照片有可见位置变化，另行调查。表格未截图全部行列，不扩大通过范围。

Own90 已关闭，sole shutdown 后原 foreground25089 实际 join exit0。Target47384/Host51520 的 [原 Native](streaming-markdown-248-live-01-native-host-settled.json) 正常 exit0，早于原600000ms期限；累计12预算内实际9次 gpt-6.1-sol、stream/200/EOF。[预检](streaming-markdown-248-live-01-preflight-ready.json) 分别证明 credential usable、完整 catalog projected 与 actual model/stream；[独立 closure](closure-readback.json) 和 [物理/输出/请求/成对清理](streaming-markdown-248-live-01-physical-terminal-and-pair-cleanup.json) 确认原进程/端口退役、auth/models 同时清理。完整脱敏新日志9546行、未知时间0，所有 observer 完成后才 [归档5个精确本次 Native pile](owned-native-pile-archive.json)。没有延长、重启或操作用户页面。
