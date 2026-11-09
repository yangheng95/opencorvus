# 授权模式重载：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-10-permission-mode-reload-focus.md)。真实开发服务读取两个隔离项目的实际配置；透传只延迟实际配置响应，并只记录其已公开的授权模式。不更改授权配置，不运行界面自动化。

| 前态 | 复核所见 |
| --- | --- |
| [01](before-01-mode-unavailable.jpg) | 未确认时只有重载动作。 |
| [02](before-02-native-reload-drops-focus.jpg) | 重载等待焦点回页面根。 |
| [03](before-03-unqualified-config-reload-failure.jpg) | 真实超时只留下顶部原始字符串。 |
| [04](before-04-success-drops-reload-focus.jpg) | 实际已选模式恢复，但没有接续原焦点。 |

| 候选 | 复核所见 |
| --- | --- |
| [05](after-05-en-reload-focus-and-diagnostics.jpg) | 英文重载等待保持原按钮焦点和展开的诊断。 |
| [06](after-06-en-failure-during-viewport-change.jpg) | 观察期间视口变化且焦点回页面根；该次不作为稳定失败焦点验收。 |
| [07](after-07-en-confirmed-option-focus.jpg) | 实际重载成功，真实选中模式接收焦点。 |
| [08](after-08-zh-reload-pending-focus.jpg) / [09](after-09-zh-failure-retains-reload-focus.jpg) | 稳定桌面中文重载等待及失败均保留原按钮焦点。 |
| [10](after-10-zh-user-moves-focus-during-reload.jpg) / [11](after-11-zh-success-preserves-user-focus.jpg) | 用户主动 Tab 到批准与操作记录，真实成功后焦点仍在该控件。 |

[前态](before-proxy.jsonl)、[候选](after-proxy.jsonl)记录真实配置读取及请求标识；[前态](before-tcp.json)、[候选](after-tcp.json)直接核对接口和运行时 schema。[数据复核](owned-final-check.json)记录原文件和无权限策略或执行写入。
