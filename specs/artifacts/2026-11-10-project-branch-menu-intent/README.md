# Git 分支菜单打开意图证据

对应 [根因与验收记录](../../records/2026-11/2026-11-10-project-branch-menu-intent.md)。截图来自独立开发桌面，Git 分支和会话是自建项目的真实持久记录。

| 场景 | 人工复核原图 |
| --- | --- |
| 修改前 | [原环境面板](01-before-environment.jpg)、[尚未读取完已显示展开](02-before-branch-read-pending.jpg)、[再次点击仍迟到展开](03-before-menu-opens-after-second-click.jpg) |
| 首次候选 | [进度](04-after-branch-progress.jpg)、[鼠标取消后焦点](05-after-mouse-cancel-keeps-focus.jpg)、[键盘取消](06-initial-branch-escape.jpg) |
| 最终英文 | [加载中保留原名和箭头](07-final-en-branch-progress.jpg)、[同一控件取消](08-final-en-mouse-cancel.jpg)、[新请求打开当前分支](09-final-en-reopened-current-branch.jpg) |
| 最终中文 | [读取中](10-final-zh-branch-progress.jpg)、[Escape 保留环境面板](11-final-zh-escape-keeps-environment.jpg)、[真实读取失败](12-final-zh-branch-error.jpg)、[重试得到当前分支](13-final-zh-retry-real-current-branch.jpg)、[关闭环境后焦点](14-final-closed-environment-keeps-focus.jpg) |

[基线](before-proxy.jsonl)、[初次候选](after-initial-proxy.jsonl)及[最终代理](after-proxy.jsonl)记录原服务响应、浏览器取消和交付。实时结构核验：[修改前](before-baseline-tcp.json)、[改后初始](after-baseline-tcp.json)、[最终状态](after-settled-tcp.json)。
