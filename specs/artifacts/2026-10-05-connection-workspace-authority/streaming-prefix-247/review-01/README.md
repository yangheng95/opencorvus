# review-01 真实运行中恢复

Main `ses_-zUSQ30uWzzyuVGJJX76` 实际生成 4 个 Source URL 和 268 字符结论；Side `ses_-zUSQ2vIdzzqzoeGu5Wb` 继承 4 条消息及对应来源。用户实际长题 Message `msg_af017532-bce8-4103-b8a3-a9a5c439133d` 为 233 字符；Assistant `msg_g0VXZx9p000xAB6TdTEq` 和正文 Part `prt_g0VXZxAwy00f9cCyK9qi` 在关闭、返回与最终输出之间保持同一身份。

| 原观察（UTC） | 实际事实 | 证据 |
|---|---|---|
| 18:36:28.730 | Working，1277 显示字符，1 个冻结块/1202 字符活动尾部 | [关闭前](side-before-close.jpg)、[几何](side-before-close-geometry.json) |
| 紧接关闭 | 整 Dock 关闭，Side DOM 确实移除 | [卸载](side-closed-geometry.json) |
| 18:36:40.333 | 重开仍 Working，同消息 1879 字符，正文包含介绍及从第 1 段起的前缀 | [重开照片](side-reopened.jpg)、[完整可访问记录](side-reopened.txt)、[几何](side-reopened-geometry.json) |
| 18:36:46.906 | 只读原运行 SQLite，Message 尚未完成；同正文 Part 保存 2202 字符及 start | [原数据库标量](live-canonical-metadata.json) |
| 18:36:54.474 | 人工回到开头，仍 Working，恢复的介绍可见，阅读位置为 0 | [开头照片](side-reopened-prefix.jpg)、[几何](side-reopened-prefix-geometry.json) |
| 18:36:59.434 / .579 / .669 | Source reader 最后字节 / EOF / Message 自然完成，最终同 Part 3218 字符 | [原 Provider](streaming-prefix-247-review-01-final-provider-audit.json)、[canonical](canonical-current-conversations.json) |
| 18:37:09.776 | 第一段照片实际已终态，不称为运行中帧 | [第一段](side-reopened-first-paragraph.jpg)、[实际状态](side-reopened-first-paragraph-geometry.json) |
| 18:37:56.437 | 完整代码末尾、空且可用的 72px 输入框，388px 阅读区 | [结束](side-terminal.jpg)、[几何](side-terminal-geometry.json) |

照片由 root 实际呈现并人工检查；页面只读诊断辅助绑定身份和尺寸，不执行自动视觉断言。展开 [参考历史 Sources](reference-sources-reading.jpg) 后三项来源有真实标题/域名，抓取来源沿原 URL。该来源照片在终态，不能算流式来源阅读证明；当前 Markdown 活动列表尾部的原始符号同样未据此声称全面修好。

Own IAB 89 已关闭；原 foreground 42251 已 join，实际 exit 0。Target 75892/Host 44676 的 [原 Native](streaming-prefix-247-review-01-native-host-settled.json) 于 18:38:05.995 UTC 正常 exit 0，早于原固定期限；12 次累计预算内实际 9 次 Sol/stream/200/EOF。[独立 closure](closure-readback.json)、[物理与成对清理](streaming-prefix-247-review-01-physical-terminal-and-pair-cleanup.json)、[原 Provider](streaming-prefix-247-review-01-final-provider-audit.json) 分别证明进程、输出、请求和凭据退役，未以 pid 不存在替代原 foreground 结果。完整脱敏新日志 8003 行、未知时间 0，全部 observers 结束后归档 5 个本次精确 pile。当前前端仍是 246 的 main-D_-2LIPy.js，本轮仅修改共享后端数据生产。
