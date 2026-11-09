# 官方用量文档链接名称：桌面与接口证据

实际开发页面 `/ui/`。逐张截图已由本人查看；名称以真实浏览器无障碍树和键盘焦点为证。

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-en-first-link-generic.jpg) | 基线焦点在 AWS，名称只有 Official docs |
| [02](02-before-en-second-link-same-name.jpg) | Tab 到 Azure，目的不同但名称相同 |
| [03](03-before-zh-third-link-generic.jpg) | 中文 Google 链接同样只叫「官方文档」 |
| [04](04-after-en-aws-link-name-and-focus.jpg) | 改后焦点在 AWS，短文字和样式维持 |
| [05](05-after-en-azure-link-name-and-focus.jpg) | Tab 到 Azure，真实名称已区别来源 |
| [06](06-after-zh-google-link-name-and-focus.jpg) | 中文三个名称各带来源，焦点到第三项 |
| [07](07-after-day-remount-link-and-focus.jpg) | 切「今天」后卡片重建，名称和键盘可达性保持 |

[基线观察](before-observed.json)及[改后观察](after-observed.json)记录实时焦点、真实目的地址和可见文字。[在线检查器](check-official-docs-tcp.mjs)读取运行时接口说明，验证[基线](before-tcp.json)和[改后](after-tcp.json)的四周期、六来源和三个云文档地址。[隔离项目审计](owned-final-check.json)记录请求、数据和正常退出证据。
