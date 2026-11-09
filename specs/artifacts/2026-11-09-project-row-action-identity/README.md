# 项目行快捷按钮：真实桌面与项目作用域

| 图 | 实际观察 |
| --- | --- |
| [01](01-before-same-name-projects.jpg) | 基线两行 Atlas 已有不同目录提示 |
| [02](02-before-west-generic-actions.jpg) | 西项目菜单入口焦点 |
| [03](03-before-west-generic-start.jpg) | 西项目加号的通用提示 |
| [04](04-before-east-same-generic-actions.jpg) | 东项目菜单入口读作同一个通用名称 |
| [05](05-before-east-same-generic-start.jpg) | 东项目加号提示同样没有目标 |
| [06](06-before-chinese-start-generic.jpg) | 中文同样只有通用提示 |
| [07](07-first-candidate-west-literal-placeholder.jpg)、[08](08-first-candidate-east-literal-placeholder.jpg) | 首轮候选字面占位符，真实复核未通过 |
| [09](09-final-west-name-and-tooltip.jpg)、[10](10-final-east-name-and-tooltip.jpg) | 最终英文提示区分两个 Atlas |
| [11](11-final-unique-project-name.jpg) | 单名项目只显示项目名 |
| [12](12-final-west-actions-menu.jpg) | 由可访问名称含西目录的按钮打开原菜单 |
| [13](13-final-pinned-project-keeps-disambiguation.jpg) | 实际置顶后仍显示同一目录区别 |
| [14](14-final-chinese-label-and-tooltip.jpg) | 中文提示完整区分东项目 |
| [15](15-final-east-start-work.jpg) | 由中文目标按钮进入项目工作入口 |
| [16](16-final-start-opens-east-project-files.jpg)、[17](17-final-east-original-file-content.jpg) | 实际资源管理器目录和打开的原文件来自东项目 |

所有 17 张实页截图已人工查看。[基线](before-observed.json)、[首轮候选](first-candidate-observed.json)、[最终候选](after-observed.json)保存实际键盘焦点与读出的名称。[在线接口检查器](check-project-actions-tcp.mjs)分别核对[基线](before-initial-tcp.json)、[最终候选初始](after-initial-tcp.json)和[真实置顶后](after-pinned-tcp.json)的目录、原文件与列表状态。[审计](owned-project-audit.json)含相应服务编号、真实置顶、原文件、进程及持久数据。[首轮候选读取](first-candidate-initial-tcp.json)、[启动](first-candidate-startup.json)、[退出](first-candidate-shutdown.json)分别保留。
