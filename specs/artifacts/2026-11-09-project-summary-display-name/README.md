# 第 112 批：侧栏完整项目名称桌面证据

两个独立 Windows 开发服务的真实 `/ui/` 页面。通过应用界面改名和置顶，从键盘触发真实项目摘要。未使用现有用户项目。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-unrenamed-project-summary.jpg) | 基线未改名时，摘要显示项目原名和原路径。 |
| [02](02-before-long-project-summary-shows-folder-only.jpg)、[03](03-before-chinese-long-project-summary-shows-folder-only.jpg) | 改名后侧栏截短，英文和中文摘要都只重复目录末段。 |
| [04](04-after-unrenamed-project-summary.jpg)、[05](05-after-full-custom-name-and-original-path.jpg)、[06](06-after-chinese-summary-keeps-user-name-and-path.jpg) | 候选普通项目保持原显示，已改名项目在两种语言完整显示用户原文和独立路径。 |
| [07](07-after-unbroken-name-wraps-without-clipping.jpg)、[08](08-after-pinned-project-keeps-full-summary.jpg) | 无空格的长名折成两行；置顶后摘要名称与路径保持。 |
| [09](09-after-pinned-project-opens-its-original-file.jpg) | 从置顶行打开实际项目及其原有 `note.txt`。 |

[基线页面](before-observed.json)、[候选页面](after-observed.json)记录键盘操作和页面观察。[检查器](check-project-summary-tcp.mjs) 使用当前接口说明；[初次改名](after-named-tcp.json)和[置顶后](after-pinned-tcp.json)的响应分别读取了两份项目及原文件。最终[对账](owned-summary-audit.json)匹配实际服务请求、目录、置顶、文件字节及退出收据。
