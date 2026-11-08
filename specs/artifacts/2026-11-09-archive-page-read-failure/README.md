# 归档分页读取失败证据

对应[Recall、根因与验收](../../records/2026-11/2026-11-09-archive-page-read-failure.md)。全部由本人在隔离项目的真实桌面 `/ui` 交互并复核；无界面自动化或模型调用。

- [01](01-before-first-page-footer.jpg)–[04](04-before-zh-query-raw-error.jpg)：旧版页尾点击失败，错误仅在页首，中文查询主错误仍为原英文。
- [05](05-after-first-page-footer.jpg)–[11](11-after-zh-query-failure-first-build.jpg)：第一轮，真实恢复失败使用独立摘要，中文查询本地化；稳定离线提示遮挡横排页尾反馈。06–07为全局提示出现前，09–10记录遮挡。
- [12](12-final-online-continuation.jpg)–[15](15-final-offline-alignment-review.jpg)：第二轮，反馈挪到按钮上方，已不遮挡，但共享对齐使反馈窄幅居中。
- [16](16-aligned-zh-footer-with-offline-banner.jpg)–[18](18-aligned-en-original-diagnostic.jpg)：最终构建的中英文可见反馈，原查询重试、原始诊断与底部提示可同时查看。
- [19](19-recovered-continuation-original-tail.jpg)–[21](21-recovered-query-original-row.jpg)：同地址恢复，原页续页到 102；原查询重试得到精确的唯一归档。

[旧版](before-online-tcp.json)、[最终在线](after-online-tcp.json)及[恢复后](after-recovered-tcp.json)各三项真实 HTTP 200，首批/续页/搜索按运行时 `/doc` schema 及原身份复核。[隔离数据核对](owned-final-check.json)记录两个 Git 文件及 204 条原归档。启动收据和服务契约脚本可供复核；脚本不驱动浏览器。
