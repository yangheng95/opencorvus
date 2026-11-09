# 已安装专家团详情重试：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-10-installed-expert-squad-detail-retry.md)。只在隔离项目中用透传代理延迟 Research Studio 的真实精确设置详情响应；服务器状态、响应内容和身份未改写。本人逐张复核截图，未运行界面自动化测试。

| 前态截图 | 所见 |
| --- | --- |
| [01](before-01-initial-loading.jpg) | 首次详情等待，焦点在 Back to list。 |
| [02](before-02-open-original-diagnostics.jpg) | 超时后手动展开，显示原始 `TimeoutError: signal timed out`。 |
| [03](before-03-retry-loses-focus.jpg) | 键盘重试卸载诊断，焦点落到页面根。 |
| [04](before-04-recovered-unfocused.jpg) | 同一精确安装恢复，焦点仍停在页面根。 |

| 候选截图 | 所见 |
| --- | --- |
| [05](after-05-initial-loading.jpg) | 第一版保留首次等待的返回焦点。 |
| [06](after-06-retry-keeps-expanded-diagnostics-focus.jpg) / [07](after-07-recovered-heading-focus.jpg) | 等待时展开诊断和按钮焦点仍在；成功聚焦到实际标题，但其边框横跨整个网格列。 |
| [08](after-08-final-en-pending.jpg) / [09](after-09-final-en-compact-heading-focus.jpg) | 最终英文版再次通过实际重试；焦点框现在准确环绕标题。 |
| [10](after-10-final-zh-pending-focus-moved.jpg) / [11](after-11-final-zh-recovered-keeps-back-focus.jpg) | 中文重试中主动移到返回，真实成功后该焦点不动。 |
| [12](after-12-final-zh-return-exact-row.jpg) | Enter 返回准确的 Research Studio 安装行。 |

[基线](before-proxy.jsonl)、[第一版候选](first-candidate-proxy.jsonl)与[最终候选](after-proxy.jsonl)记录真实响应和延迟。直接运行时检查：[前态](before-tcp.json)、[最终](after-tcp.json)。[数据复核](owned-final-check.json)包含原 Git 文件和零执行数据。
