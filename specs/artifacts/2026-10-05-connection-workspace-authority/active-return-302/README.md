# 302 生成期间返回与瞬时文字异常

[Recall 与方案](../active-return-plan-302.md) · [月记录](../../../records/2026-10/2026-10-11-active-return-302.md)

本轮 root 单独操作，产品内唯一研究员仅作为测试对象。两次独立开发服务均使用正常前端和实际 gpt-6.1-sol 流式请求，没有加入诊断或改动生产源码。截图均来自真实 /ui 页面并人工复核；DOM（Document Object Model，文档对象模型）文字只作为异常证据，不是 UI 自动化测试或视觉通过的替代。

## live-01：区分 Task 运行与正文生成

- [实际时间、正文和读取汇总](live-01/observation-summary.json)：正文最终 5043 字符。14:00:23.327Z 离开项目，14:00:45.928Z 返回；正文于 14:00:49.967Z 完成，14:01:11.737Z 才重开子侧栏，Task 14:01:37.301Z 完成。因此这一轮的子侧栏返回不能证明返回后继续生成。
- [正文生成中关闭前](live-01/02-body-before-dock.png) / [重开后](live-01/03-body-after-dock.png)：当前在尾部跟随，第三/四节推进至第五/六节，属于跟随新正文，不是固定阅读锚点证明。
- [主动上翻来源](live-01/04-sources-before-switch.png) / [跨项目返回](live-01/06-sources-after-switch.png) / [完成后](live-01/07-completed-sources.png)：来源标题、域名及所在位置保持。前图指针悬停弹出真实来源提示，后图未悬停。
- [Task 完成](live-01/task-complete.json)、[12 次 Provider 请求审计](live-01/active-return-302-live-01-final-provider-audit.json)、[原 exec 24306 join](live-01/original-exec-joined.json)、[独立关闭复核](live-01/closure-readback.json)。自己的页面和进程已闭合，授权副本成对清理。

## live-02：补齐活跃返回并发现新异常

- [实际时间与数据](live-02/observation-summary.json)：14:05:04.191Z 离开、14:05:13.923Z 返回、14:05:28.574Z 重开子侧栏；正文直到 14:07:28.266Z 才完成。这次确实覆盖返回后继续增长。正式后端正文样本为 353、3329、7804 字符，最终 9012 字符。
- [离开前](live-02/01-sources-before-switch.png)、[重开后](live-02/02-live-body-after-return.png)、[继续增长至第九节](live-02/03-body-continued.png) 已人工查看。[正常继续增长时的页面文字](live-02/body-after-return-dom.txt) 与 [最终完整子侧栏文字](live-02/completed-child-text.txt) 保留原观察。
- 重开瞬间捕捉到异常文字读回：[原始工具文字输出](live-02/transient-return-observation.json) 在第二节下出现 `**文档事实22/Understanding/focus-order.html)`，并紧接“设计建议：用户主动”，该观察中缺少中间正文。同一工具调用稍后的截图中第二节已显示正常开头，14:05:52.800Z 的 [实际后端快照](live-02/after-child-open-bootstrap.json) 也包含完整第二节。尚无同一时刻原始 renderer 输入和 live/base 记录，不能凭最终正文正确排除产品问题，也不能排除 DOM 快照读取跨过一次更新；这条文字证据尚未证明实际绘制过损坏画面。
- [主动上翻 Sources](live-02/04-sources-during-growth.png) / [生成中关闭再重开](live-02/05-sources-reopened-growing.png) / [完成后](live-02/06-completed-sources.png)：三条来源及阅读位置保持。[最终正文尾部](live-02/07-completed-tail.png) 包含真实来源读取范围和截断说明。
- [Task 完成](live-02/task-complete.json)、[12 次 Provider 请求审计](live-02/active-return-302-live-02-final-provider-audit.json)、[原 exec 97911 join](live-02/original-exec-joined.json)、[独立关闭复核](live-02/closure-readback.json) 均完成。自己的第二个页面和第二组进程已闭合，授权副本成对清理。

## 下一步根因取证

SubagentConversationPanel 在 requestKey 切换时重置 liveProjection，而 resource 保留此前已读取的 conversation 值。delta anchor 可来自该 base；projectLivePartField 在新 base 与已积累增量不相容时使用 anchor 加 delta。若重新订阅前有缺口，这条路径可能拼接旧前缀与较晚片段。当前代码线索与第二节缺字现象相符，但尚缺实际同时输入，仍是待验证假设。

需要在一次正常跨项目返回中记录确切 Message/Part 身份、base 游标与文本、原始 live 事件、合并后传入 TextPart 的正文以及对应 Markdown revision，区分投影输入损坏、排版阶段异常与跨更新的快照读回。Side Chat 使用同一 projection，主会话 writer 与 Session/Mission cutover 也须按现有共享边界复核。禁止用最长文本、延迟显示、隐藏 Rendering 或恢复全部旧缓存来绕过问题。

本轮交付是新增真实复现和验收证据；没有把新异常标为已修复，也没有把正常 Task/Provider 结束等同于 UI 全部通过。证据文本经过凭据脱敏，观察器与请求文本副本去除文件末尾多余空行，私有原件保留；没有运行 UI 自动化测试。
