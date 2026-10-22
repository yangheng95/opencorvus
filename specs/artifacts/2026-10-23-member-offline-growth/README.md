# 成员离线新增内容恢复

[根因、方案和资格](../../records/2026-10/2026-10-23-member-offline-growth.md) · [实际请求、数据与资源证据](evidence.json) · [低频生命周期记录](lifecycle.ndjson)

修复前，完整重连快照只更新主对话，成员侧栏仍靠实时事件序号刷新，因此停留旧正文和四条 Sources。现在快照成功提交后，当前成员沿原 controller 合并读取；目标和已展示正文保持原组件身份。

| 实际截图 | 人工观察 |
| --- | --- |
| [原旧结尾](before-old-end.png) | 旧完整历史，11 段正文、4 来源 |
| [重连仍停旧内容](before-reconnected-stale.png) | 主对话已恢复，但侧栏仍为 LIVE539C_AFTER_END |
| [手动重开对照](before-manual-reopen.png) | 原服务已有新正文及 ReConcile，第五来源立即可读 |
| [修复版旧结尾](fixed-old-end.png) | 同一完整旧历史作为修复复验起点 |
| [同页离线](fixed-offline.png) | 页面保留，未 reload 或切换成员 |
| [自动出现新结尾](fixed-auto-new-end.png) | 自然重连后自动显示 LIVE541_AFTER_END |
| [自动恢复的新来源](fixed-auto-new-source.png) | 实际上滚读取第五条来源及新增长正文 |

七图均实际呈现并人工查看，无截图基线、像素差异或 DOM 自动化断言。原 11 个正文 owner 和 4 个 Source owner 保持，三段新正文及新来源正常首次挂载。实际页面成员 GET 在独立 checker 之前发生，双方流量明确区分。

新内容来自此前原成员真实 Sol 执行后的完整数据库，没有合成或删减消息。本批 8 次当前认证的实际 Sol 流式请求均 200/原 EOF；四服务正常退出，16 份 auth/models 副本退休。完整 90 表原业务数据保留，用户数据库未参与。28 项纯服务合同与 overlay 类型检查通过。

本次覆盖已完成 Task 的历史增长恢复。活跃流和 Session/Mission 离线增长仍需各自实页验证，不宣称所有 Rendering 场景已解决。
