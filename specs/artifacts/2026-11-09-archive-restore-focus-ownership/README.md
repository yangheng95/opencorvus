# 归档恢复焦点证据

两套隔离开发服务直接提供 `/ui/`；操作者通过键盘和鼠标完成实际恢复。每张截图均在采集时人工查看。

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-archive-restore-targets.jpg) | 基线 Archive 初始页 |
| [02](02-before-restoring-with-full-real-page-window.jpg) | 基线三页 202 项，焦点在恢复 202 |
| [03](03-before-restore-followed-by-search-click.jpg) | 点击设置搜索后，基线结算时它失去焦点 |
| [04](04-before-restore-without-leaving-list.jpg) | 基线不移动焦点时，201 恢复后接续至 200 |
| [05](05-after-full-archive-at-restore-trigger.jpg) | 改后三页 202 项，同一起点 |
| [06](06-after-restored-with-settings-search-still-focused.jpg) | 改后恢复 202，左侧搜索仍有焦点 |
| [07](07-after-typing-directly-in-retained-search.jpg) | 无再次定位，直接输入并筛出 Appearance |
| [08](08-after-zh-restore-with-focus-handoff.jpg) | 中文 201 恢复后，在 200 继续 |
| [09](09-after-zh-archive-filter-with-one-result.jpg) | 中文查询唯一结果 001，键盘处于恢复按钮 |
| [10](10-after-zh-last-result-restored-and-section-focused.jpg) | 恢复后空结果与标题焦点同时呈现 |

[基线](before-focus.json)及[改后](after-focus.json)为真实页面焦点观察。基线服务 [39112](before-startup.json) 使用 `main-Hvhp8L6_.js`；改后 [39113](after-startup.json) 使用 `main-DyosuOlU.js`。两服务均接受正常关闭并退出 0。

[生产域初始化](initialize-archive.ts)创建两套 202 条空会话，[基线](before-archive.json)和[改后](after-archive.json)为验收前记录。[HTTP 检查器](check-archive-tcp.mjs)在服务在线时按其 `/doc` 解析真实响应（基线 [7 次](before-tcp.json)，改后 [9 次](after-tcp.json)）。[持久核对](audit-owned-data.py)在服务关闭后读取两套隔离数据库、归档写入完成日志和[原项目记录](seed.json)，详见[结果](owned-final-check.json)。这些检查无需模型或个人应用数据。
