# 审批与历史刷新：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-10-permission-ledger-refresh.md)。真实开发服务读隔离项目的权限台账；透传只延迟指定项目的实际 history 响应，未改写接口返回。本人复核真实桌面，未使用界面自动化测试或修改授权。

| 前态 | 复核所见 |
| --- | --- |
| [01](before-01-accepted-records.jpg) | 两项真实读取确认零审批和零历史；已保存审批展开。 |
| [02](before-02-refresh-removes-accepted-records.jpg) | 读取等待换成整页加载占位，焦点回页面根。 |
| [03](before-03-failure-replaces-confirmed-pair.jpg) | 失败替换原结果，只保留简化错误字符串。 |
| [04](before-04-recovery-reopens-collapsed.jpg) | 重试后真实零结果回来，但原展开和焦点未恢复。 |

| 候选 | 复核所见 |
| --- | --- |
| [05](after-05-initial-local-loading-zh.jpg) / [06](after-06-initial-timeout-no-false-empty-zh.jpg) | 中文首次等待和失败留在权限区域，实际超时诊断可展开，没有虚构零记录。 |
| [07](after-07-retry-moved-focus-zh.jpg) / [08](after-08-initial-recovery-keeps-user-focus-zh.jpg) | 主动移到外层披露，成功后焦点仍在原处，零结果经真实读取确认。 |
| [09](after-09-refresh-retains-approved-view-en.jpg) / [10](after-10-refresh-error-keeps-accepted-details-en.jpg) | 英文慢刷新和失败时都保留展开的已保存审批、最后成功记录和同页控件。 |
| [11](after-11-retry-retains-button-and-accepted-view-en.jpg) / [12](after-12-recovered-keeps-refresh-and-disclosure-en.jpg) | 重试期间保留原诊断及焦点；成功后原按钮和展开状态保持。 |

[前态代理记录](before-proxy.jsonl)、[候选代理记录](after-proxy.jsonl)显示真实超时和成功恢复。[前态](before-tcp.json)、[候选](after-tcp.json)各有四项直接接口及 schema 核对。[数据复核](owned-final-check.json)记录原字节、原权限数据和无执行活动。
