# 已安装专家团续页：真实桌面证据

对应[调查与方案](../../records/2026-11/2026-11-10-installed-expert-squad-catalog-continuation.md)。正式 SDK 在自有 Git 项目创建 22 个项目安装，真实开发服务同时提供 5 个内置专家团。透传仅延迟指定项目的有游标安装读取，服务的状态、正文和请求不改写。本人查看原始桌面截图，没有界面自动化测试。

| 前态 | 复核所见 |
| --- | --- |
| [01](before-01-accepted-first-page.jpg) | 已接受首页，筛选与物理安装真实可读。 |
| [02](before-02-first-page-during-continuation.jpg) | 续页等待卸载已接受列表，键盘焦点回页面根。 |
| [03](before-03-continuation-timeout-hides-catalog.jpg) | 超时错误被当作整个目录不可用。 |
| [04](before-04-retry-restarts-first-page.jpg) | 旧重试只重读首页，焦点仍在页面根。 |
| [05](before-05-stale-cursor-hides-catalog.jpg) | 自有项目真实安装后，旧游标 409 也遮住目录。 |

| 第一版候选 | 复核所见 |
| --- | --- |
| [06](after-06-continuation-keeps-accepted-page.jpg) | 原行、当前筛选与忙态续页焦点保留。 |
| [07](after-07-timeout-summary-clipped.jpg) | 超时保留原行和 Retry，但摘要落在视口底边。 |
| [08](after-08-timeout-retry-keeps-original-diagnostics.jpg) / [09](after-09-first-visible-appended-installation.jpg) | 同游标只重读一次，原诊断保留，成功聚焦新增首行。 |

| 最终候选 | 复核所见 |
| --- | --- |
| [10](after-10-final-en-timeout-summary-visible.jpg) / [11](after-11-final-en-appended-first-row-focus.jpg) | 无需额外移动就能看见完整超时摘要，重试成功聚焦第一条新增行。 |
| [12](after-12-final-zh-stale-cursor-refresh-action.jpg) / [13](after-13-final-zh-stale-original-diagnostics.jpg) / [14](after-14-final-zh-stale-diagnostic-body.jpg) | 真实 409 不遮住原行，展示中文刷新动作与原响应。 |
| [15](after-15-final-zh-refresh-restores-pager-focus.jpg) | 现筛选保持，重新读取首页后焦点回到加载更多。 |
| [16](after-16-final-zh-new-page-pending-focus-moved.jpg) / [17](after-17-final-zh-new-page-keeps-row-focus.jpg) | 真实新游标追加八项，用户提前移到 Page Review 14 的焦点保持。 |
| [18](after-18-final-zh-appended-detail.jpg) / [19](after-19-final-zh-exact-last-row-return.jpg) | 正常打开真实末行，返回该安装的精确行。 |

[前态](before-proxy.jsonl)、[第一候选](first-candidate-proxy.jsonl)和[最终候选](after-proxy.jsonl)是透传响应记录；[前态](before-tcp.json)、[最终原目录](after-tcp.json)、[最终安装后](after-advanced-tcp.json)是实际运行时 schema 检查。[数据复核](owned-final-check.json)记录原文件、隔离新增和零执行数据。
