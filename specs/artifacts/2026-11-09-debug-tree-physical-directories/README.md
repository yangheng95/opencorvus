# 调试目录树：命令、真实页面与项目对照

本批验收使用两个真实调试命令及两个隔离桌面开发服务。本人复核全部截图。

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-physical-tree-visible-in-explorer.jpg) | 基线 Explorer 证明空目录及合法近名真实存在 |
| [02](02-after-explorer-shows-existing-directory-identities.jpg) | 改后键盘展开保留原目录身份 |
| [03](03-after-opens-user-documentation-in-similar-folder.jpg) | 改后从真实文件搜索打开近名目录下的原文 |

[命令检查器](check-debug-tree.mjs)的[基线](before-tree-cli.json)与[改后](after-tree-cli.json)包含两命令的真实完整输出、限制和缺目录错误。[基线](before-tree-http.json)及[改后](after-tree-http.json)真实读取项目列表、文件搜索和目录索引。[桌面基线](before-observed.json)、[改后焦点与原文](after-observed.json)、[关停回执](shutdown-verification.json)及[隔离审计](owned-final-check.json)保存验证边界。
