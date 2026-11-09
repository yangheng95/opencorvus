# 第 114 批：已恢复之后重试归档刷新

三套独立 Windows 开发服务的 `/ui/` 实页。每套隔离项目通过生产领域入口创建 102 条未发消息的归档对话。真实恢复收到成功回执后，同源代理只转发下一次归档读取的原响应头和原始响应前 32 字节，随后关闭该请求。其它读取及网页双向连接正常转发。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-two-pages-and-final-restore.jpg)、[02](02-before-committed-restore-with-retained-tail.jpg) | 基线实际加载两页并恢复末项，保留其它已接受条目。 |
| [03](03-before-refresh-error-has-no-retry.jpg)、[04](04-before-real-truncated-body-diagnostic.jpg)、[05](05-before-changing-query-restarts-at-one-page.jpg) | 无局部重试，保留原网络诊断；改搜索后仅回到 100 条。 |
| [06](06-after-two-pages-and-real-restore-trigger.jpg)、[07](07-after-refresh-error-offers-read-only-retry.jpg)、[08](08-after-retains-real-network-diagnostic.jpg)、[09](09-after-chinese-refresh-error-and-retry.jpg) | 首轮候选的实际两页、恢复结果、双语重试及原诊断。 |
| [10](10-after-retry-keeps-count-query-and-receipt.jpg)、[11](11-first-candidate-restores-last-accepted-row.jpg) | 首轮读回 101 条并保留第二页末项，焦点验收仍未通过。 |
| [12](12-final-english-retry-with-original-query.jpg)、[13](13-final-chinese-keyboard-focus-on-retry.jpg)、[14](14-final-retry-focuses-archive-heading.jpg)、[15](15-final-retry-retains-real-second-page-tail.jpg) | 最终候选双语、真实键盘重试、标题焦点和第二页末项。 |

[代理](archive-refresh-proxy.mjs) 参数为 `<代理端口> <服务端口> <本批恢复目标会话 ID>`。[基线](before-observed.json)、[首轮](after-observed.json)、[最终](final-observed.json) 提供真实操作和页面观察。[在线检查器](check-archive-refresh-tcp.mjs) 验证当前接口说明及会话身份，[首轮](after-tcp.json)、[最终](final-tcp.json) 结果附服务请求编号。[对账](archive-refresh-audit.json) 对应三个环境的请求、游标、持久化和退出结果。
