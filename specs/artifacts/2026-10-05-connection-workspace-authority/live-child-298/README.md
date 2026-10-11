# 298 真实子侧栏流式与来源观察

[Recall与影响分析](../live-child-plan-298.md) · [月记录](../../../records/2026-10/2026-10-11-live-child-298.md)

这是一次真实产品功能验证和诊断记录，未产生生产修复。代码调查、页面操作和归档均由root单独完成；没有委托Codex协作agent。隔离产品中的唯一研究员是被测功能。

## 可核对的结果

- [真实接受与固定期限](live-01/task-boundary-admitted.json)、[Task终态](live-01/task-complete.json)、[13次实际Provider审计](live-01/live-child-298-live-01-final-provider-audit.json)：目标gpt-6.1-sol，流式，真实Task epoch 1完成，原生/请求闭合。
- [持久化正文与来源](live-01/canonical-current-conversations.json)：2921字符研究正文和三条source-url；W3C原地址404保留，随后读取同篇.html成功。
- [来源生成](live-01/01-live-sources.png)、[正文流式](live-01/02-live-body.png)、[回看来源](live-01/03-sources-reading.png)、[MDN跳转](live-01/04-source-destination.png)、[完成后来源](live-01/05-completed-sources.png)均由root实际打开页面、截图和人工查看。
- [诊断汇总](live-01/trace-summary.json)及[完整本次日志](live-01/live-child-298-live-01-runtime.log)：73次正文投影样本；记录阶段未见子侧栏owner退休或正文前缀退步。
- [原exec真实join](live-01/original-exec-joined.json)、[独立物理闭合](live-01/closure-readback.json)、[成对清理](live-01/live-child-298-live-01-physical-terminal-and-pair-cleanup.json)：自己的页面、进程与授权副本已收束。

## 未完成边界

500条诊断提前触顶，只有12:14:14.057Z—12:15:10.448Z有效记录。普通函数被反复求值造成相同content相位重复；后半程无法据此证明组件稳定。截图中未见闪烁不等于原Research Studio问题已根治。主会话初载有一次文本owner替换，尚未判定根因。

临时诊断源码仅留[审计副本](diagnostic-only.ts)，生产引用全部移除；最终生产源与ccb8b24ec完全一致。后续应改进有界诊断后再覆盖完整生命周期，并调查首次Task切入的快照/实时事件交汇。旧overlay覆盖风险目前只有代码证据，未用推测替代真实根因。

最终撤除诊断后的overlay typecheck（类型检查）和build（构建）均真实exit 0，构建51.09s，产物公共面检查通过；不以这些检查替代截图验收。
