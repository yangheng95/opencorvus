# 300 完整生命周期与首次回放证据

[Recall、共享入口审计和后续要求](../render-lifetime-plan-300.md) · [月记录](../../../records/2026-10/2026-10-11-render-lifetime-300.md)

本轮root独立完成，产品唯一研究员是被测功能。没有协作子agent。最终撤掉全部临时诊断，无生产修复。

## 已验证事实

- [Task身份/固定期限](live-01/task-boundary-admitted.json)、[真实终态](live-01/task-complete.json)、[12次Provider流式审计](live-01/render-lifetime-300-live-01-final-provider-audit.json)。
- [完整诊断汇总](live-01/trace-summary.json)、[原始诊断行](live-01/full-diagnostic-rows.json)、[持久化消息/来源](live-01/canonical-current-conversations.json)。266条记录未触及独立上限；子侧栏owner5从2到4228字符，直到人工关闭Dock才退休，pending=false、34块。
- [首次来源](live-01/01-child-start.png)、[流式中途](live-01/02-streaming-body.png)、[正文末尾](live-01/03-late-body.png)、[完成后Sources](live-01/04-completed-sources.png)、[操作者关闭Dock](live-01/05-completed-dock-closed.png)，均真实页面截图并人工复核。
- 主会话完整快照后的live sequence8将同一86字Part改为空，owner2退休、owner3从5字重建；实际前后正文和事件见诊断汇总replacements。首次快照缺少live游标、选择重置0、事件流从0回放的路径已对应到代码。
- [原exec6205 join](live-01/original-exec-joined.json)、[原生结算](live-01/render-lifetime-300-live-01-native-host-settled.json)、[独立闭合](live-01/closure-readback.json)与成对凭据清理记录完成。

## 范围与下一步

主会话两个owner当时均处于首次排版，证据证明数据回退和重建，未证明用户原截图的所有肉眼闪烁由此引起。子侧栏这次完整生成稳定，不能泛化成所有入口/恢复路径稳定。

必须继续核对Task/Mission/Session、Side/子侧栏、首次加载/重连/重启/rewind、串并行及项目隔离的快照与事件边界。禁止用最长文本或读取结束时随意跳过游标掩盖丢失事件。诊断源码仅保留[审计副本](diagnostic-only.ts)，运行源码已撤除。
