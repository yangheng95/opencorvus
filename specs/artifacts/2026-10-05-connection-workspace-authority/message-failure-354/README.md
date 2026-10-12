# 354 历史错误的消息归属

[Recall与方案](../message-failure-plan-354.md)。本轮单agent，修复原Message错误被错误汇总到子会话结尾、覆盖最新执行状态的问题。五条历史错误按消息呈现，包括没有正文的失败；共享错误块保留详情和复制。成员头部使用最新真实activity状态。

正式构建main-K84VChgh.js；同一原353历史完整复制90表，未变更其Task/Project/Session身份或failed终态。18335/ui旧版、18336/ui新版均启动真实项目服务，13张截图实际呈现并人工查看。新版保留36个Source、五条原Message错误：前三次无正文错误在初始上下文之后，另外两次在R26/R28 Source之后、恢复正文之前；R36及最终完成说明不再附加历史错误。列表明确显示Completed；当前Task仍Failed，主会话负责人错误保留。

- [旧版结尾](01-before-history-footer.png)、[旧版头部](02-before-history-head.png)。
- [新版结尾](03-after-completed-footer.png)、[前三次错误](04-after-original-errors-head.png)、[原始详情](05-after-original-diagnostic.png)。
- [真实复制后粘贴](06-after-copied-diagnostic.png)、[成员Completed](07-after-member-completed.png)、[列表返回](08-after-list-return.png)、[Dock返回](09-after-dock-return.png)。已展开详情与阅读位置保留。
- [R24正文](10-after-r24-recovery-seam.png)、[R26来源后中断](11-after-first-body-interruption.png)、[R28来源后中断](12-after-second-body-interruption.png)、[初次恢复正文](13-after-initial-recovery.png)。

第一次通过浏览器DOM点击复制时，工具剪贴板及粘贴仍是其先前36条测试清单，未计为通过。改用同一页面真实可访问性点击后，剪贴板和实际粘贴均为该错误说明及原始JSON；截图06为实际粘贴。临时草稿已清空，未发送。原始两种观察均保存在manual-observations.json，不把按钮的“Copied”反馈单独当作复制验收。

25项纯会话服务数据契约测试通过（63断言）；typecheck、build及renderer surface、CSS token检查、docs:check（345操作/25组）通过。没有新增或运行UI自动化测试；这些检查不替代截图人工复核。

history-01原launch64560和history-02原launch75612均实际exit0。原生端口/Host/Native/output/request完整闭合，两个页面均在服务存活窗口内截图后关闭；无auth/models复制和新模型调用。实际物理回执分别为15:21:53.559Z与15:29:45.014Z。原353任务因负责人末次Provider流内过载失败，完整Task端到端及负责人全文核对仍未达成。本轮遵守共享流内错误不自动重放的合同，没有修改retry策略或伪造完成。goal继续active，下一轮继续审计恢复与真实使用问题。
