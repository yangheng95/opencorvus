# Explorer 空目录反馈：真实桌面和读取证据

两套隔离开发服务。本人复核全部下列截图：

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-expanded-empty-folder-has-no-status.jpg) | 基线真实空目录只显示展开 |
| [02](02-before-empty-and-populated-folders.jpg) | 同层非空目录实际显示文件 |
| [03](03-after-en-empty-state-and-focused-folder.jpg) | 改后英文 Empty 与选中行焦点 |
| [04](04-after-empty-and-populated-folder-comparison.jpg) | 空和非空目录同屏 |
| [05](05-after-chinese-empty-folder.jpg) | 原地切中文后显示「空目录」 |
| [06](06-after-creating-first-file-in-owned-folder.jpg) | 实际新建对话框显示目标和文件名 |
| [07](07-after-creation-shows-file-instead-of-empty-status.jpg) | 真实写入后文件出现在原树 |
| [08](08-after-real-offline-directory-errors.jpg) | 真实服务关停时显示原目录错误 |
| [09](09-after-single-folder-shows-error-not-empty.jpg) | 真实 404 时单目录行显示 Error |
| [10](10-after-recovered-read-shows-real-empty-folder.jpg) | 恢复原请求后，同页真实读成功显示 Empty |

[在线检查器](check-folder-tcp.mjs)验证[基线](before-initial-tcp.json)、[改后](after-initial-tcp.json)和[创建后](after-created-tcp.json)实际目录数据。[创建回执](file-create-requests.json)、[基线](before-observed.json)、[改后](after-observed.json)与[单目录故障及恢复](proxy-observed.json)保存页面事实。[隔离代理](folder-error-proxy.mjs)只重写一个读取参数，[请求记录](folder-error-proxy.log)和[审计](owned-final-check.json)包含真实服务的配对编号、原文件及关停。
