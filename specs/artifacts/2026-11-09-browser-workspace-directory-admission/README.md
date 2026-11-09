# 浏览器文件夹确认：真实桌面及服务证据

本人逐张查看下列实际开发页：

| 图 | 实际观察 |
| --- | --- |
| [01](01-before-existing-folder-dialog.jpg)、[02](02-before-relative-entry.jpg) | 基线现有文件夹入口和相对路径 |
| [03](03-before-relative-entry-dismisses-form.jpg)、[04](04-before-relative-entry-settled.jpg) | 基线相对输入关闭表单，错误目录发布为当前项目 |
| [05](05-before-missing-absolute-project-switch.jpg) | 基线绝对缺失目录导致无项目首页 |
| [06](06-before-valid-absolute-opens-project.jpg)、[07](07-before-valid-project-files.jpg) | 基线健康路径与真实文件 |
| [08](08-after-relative-keeps-dialog-and-project.jpg) | 相对路径在同一字段内提示，原项目保留 |
| [09](09-after-missing-folder-keeps-input.jpg)、[10](10-after-missing-folder-real-diagnostic.jpg) | 缺失目录保留表单、输入、焦点和真实 400 详情 |
| [11](11-after-file-is-not-directory.jpg) | 真实文件被判为非目录，仍在原表单 |
| [12](12-after-corrected-folder-opens-target.jpg)、[13](13-after-original-target-file.jpg) | 纠正后正常进入目标，打开原文件 |
| [14](14-after-chinese-validation-and-preserved-file.jpg)、[15](15-after-cancel-keeps-target.jpg) | 中文校验、取消及原项目与文件保留 |
| [16](16-after-promotion-rejects-missing-parent-in-dialog.jpg) | 匿名项目的缺失父目录留在原中文表单 |
| [17](17-after-conversion-opens-new-project.jpg)、[18](18-after-promoted-project-in-ledger-and-explorer.jpg)、[19](19-after-promoted-project-retains-original-file.jpg) | 转换结果从加载到原文件真实打开 |

[基线](before-observed.json)和[候选](after-observed.json)保存键盘时刻和页面事实；[请求及持久事实审计](owned-workspace-audit.json)与真实服务记录逐条配对。[基线列表](before-work-ledger.json)、[目录接口检查](after-directory-contract.json)、[最终项目与原文件](after-final-projects-tcp.json)分别记录实际响应。[目录检查器](check-workspace-directory-tcp.mjs)和[最终项目检查器](check-final-projects-tcp.mjs)通过开发服务接口说明验证实际响应。匿名测试项目的[实际创建回执](anonymous-seed.json)和[初始化脚本](seed-anonymous.mjs)限本批隔离目录。
