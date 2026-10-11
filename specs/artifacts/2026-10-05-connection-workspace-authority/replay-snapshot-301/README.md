# 301 完整快照回放修复

[Recall 与影响分析](../replay-snapshot-plan-301.md) · [月记录](../../../records/2026-10/2026-10-11-replay-snapshot-301.md)

本轮由 root 单独完成；产品的一名研究员是被测功能。共享回放缓存现在保留每个身份的最新完整快照及其后的增量，Session 初载也使用同一归并，并等待已接收的订阅投递完成。正常连接仍收到每个原始事件。没有前端诊断、最长文本规则或新增消息。

归档文本经过凭据脱敏；构建日志的行尾空格规范化，私有原始日志保留。图像来自实际页面。

## 实际验证

- [首次 HTTP 快照与 SSE 原始帧](live-01/initial-bootstrap.json)：2026-10-11T13:34:44.004Z 发起，收到 20 帧；文字 Part `prt_g0VXkQLHA00p7Veoq9jE` 在 7.672 秒前开始，回放 sequence 557 的完整正文为 603 字符，与 HTTP 当前值一致。另一个 Part 回放为 93 字符。未重播这些 Part 的历史空正文。
- [稍后读取](live-01/streaming-return-bootstrap.json)：13:36:24.975Z Task 仍 active，共 13 帧，11 个工具 Part、1 个消息 metadata 和连接帧；文本已离开保留窗口，此次不能算额外文本回放证明。
- [只读观察器](live-01/observe-bootstrap.ts) 使用正式 conversation 与 events 路由、首次选择同样的 after_live=0；它是后端数据观察，不替代视觉验收。
- 真实页面：[流式正文](live-01/01-streaming-child.png)、[切换项目](live-01/02-other-project.png)、[返回子侧栏](live-01/03-returned-child.png)、[三条 Sources](live-01/04-completed-sources.png)、[W3C 来源实际跳转](live-01/05-source-destination.png)。人工观察第 9/10 节仍在生成，完成后切换项目并返回，随后回读来源。跨项目切换发生在完成后，不宣称覆盖生成期间的跨项目恢复。
- [真实持久化正文](live-01/canonical-current-conversations.json) 中研究员最终正文 4397 字符；[Task 终态](live-01/task-complete.json) 为 epoch 1 completed；[Provider 审计](live-01/replay-snapshot-301-live-01-final-provider-audit.json) 有 13 次实际 gpt-6.1-sol 流式请求完成，包括独立预检。
- [19 项聚焦后端回归](live-01/backend-tests-final.log)、[2 项真实 Mission/Task 根消息移交回归](live-01/move-tests.log)、[后端类型检查](live-01/backend-types-final.log)、[正常 UI 构建](live-01/build.log) 均实际结束成功。没有运行 UI 自动化测试。
- [原 exec 76451 已 join](live-01/original-exec-joined.json)、[原生结算](live-01/replay-snapshot-301-live-01-native-host-settled.json)、[独立闭合](live-01/closure-readback.json) 和 [有界本轮调试文件归档](live-01/owned-native-pile-archive.json) 已保存。自己的两个页面已关闭，原生进程及 Host 已结束，授权凭据和模型副本成对清理。

## 仍需继续

300 复现的共享旧完整快照覆盖已修复，并经当前真实正文验证。本轮不是原始 Research Studio 全任务复刻，也没有对子侧栏每一帧作诊断；不能把这次结果泛化成原截图所有 Rendering 闪烁均已根治。独立 HTTP base/live 叠加风险仍缺少真实倒退证据，后续继续从实际页面定位。
