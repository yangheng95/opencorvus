# 项目记忆通知动作归属：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-10-project-memory-notice-action-ownership.md)。两个开发服务各自拥有两个 Git 项目及通过生产领域服务写入的真实通知。只确认通知；没有调用组织器、使用模型或改写记忆正文。

| 前态 | 本人复核所见 |
| --- | --- |
| [01](before-01-alpha-notice-with-dismiss.jpg) | 项目 A 的原通知，Dismiss 可用。 |
| [02](before-02-switching-to-bravo.jpg) | 发起 A 的确认后进入项目 B，B 正在加载。 |
| [03](before-03-bravo-notice-while-alpha-request-pending.jpg) | B 的通知加载，但两个按钮被 A 的在途动作禁用，显示 Dismissing…。 |
| [04](before-04-bravo-after-alpha-request-settled.jpg) | A 实际已确认但网页超时，英文错误显示到未操作的 B。 |
| [05](before-05-chinese-keeps-wrong-english-action-error.jpg) | 切换中文后 B 仍显示原英文错误摘要。 |

| 后态 | 本人复核所见 |
| --- | --- |
| [06](after-06-bravo-actions-available-while-alpha-pending.jpg) | A 回执在途，B 自己的通知与按钮可用。 |
| [07](after-07-bravo-keeps-own-state-after-alpha-timeout.jpg) | A 超时以后，B 仍保持自己的状态。 |
| [08](after-08-bravo-own-transport-error.jpg) | B 自己的关闭动作失败，原按钮保留焦点。 |
| [09](after-09-bravo-original-transport-diagnostic.jpg) | 首轮候选有完整堆栈，但固定提示条过高。 |
| [10](after-10-final-diagnostic-bounded.jpg) | 最终候选诊断高度有界，主输入文字仍可见。 |
| [11](after-11-final-diagnostic-scrolls-to-stack-tail.jpg) | 实际滚动读到诊断末端。 |
| [12](after-12-chinese-retranslates-current-error.jpg) | 中文摘要与原始技术诊断同时保留。 |
| [13](after-13-bravo-acknowledgement-clears-notice.jpg) | 恢复连接并键盘确认后，实际数据使 B 的通知清除。 |

[前态透传](before-proxy.jsonl)和[候选透传](after-proxy.jsonl)记录实际确认或到达服务前的传输终态；[前态确认](before-settled-tcp.json)、[候选切换读回](after-isolated-tcp.json)、[B 故障后读回](after-failed-tcp.json)及[候选最终确认](after-settled-tcp.json)来自直接公开接口。[最终只读核查](owned-final-check.json)包含磁盘通知、原 Git 文件与正文；[首轮关停](candidate-shutdown.json)和[最终关停](after-shutdown.json)为正常退出回执。
