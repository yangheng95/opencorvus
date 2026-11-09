# 代理设置的项目范围证据

两个隔离开发服务使用真实 `/ui/` 与正常项目配置路由。每张截图均由本人操作及查看。

| 图 | 真实桌面观察 |
| --- | --- |
| [01](01-before-proxy-section-without-project-context.jpg) | 基线代理区没有当前项目 |
| [02](02-before-proxy-saves-without-disclosing-project.jpg) | 真实保存仅显示 Saved，未说明写入范围 |
| [03](03-before-no-project-accepts-draft-then-fails.jpg) | 无项目仍可输入、提交后通用失败 |
| [04](04-before-no-project-save-only-explained-in-details.jpg) | 原错误在详情中才说明要求当前目录 |
| [05](05-before-sibling-has-same-heading-but-own-proxy.jpg) | 相邻项目仍为空，标题不揭示目标 |
| [06](06-after-proxy-names-write-destination-before-editing.jpg) | 改后在编辑前显示当前项目 |
| [07](07-after-keyboard-reveals-primary-project-directory.jpg) | 键盘展开完整项目目录 |
| [08](08-after-primary-project-saved-with-scope-visible.jpg) | 首项目保存 31296 后仍可见范围 |
| [09](09-after-sibling-project-scope-and-path.jpg) | 相邻项目显示自己的名称和目录 |
| [10](10-after-sibling-project-saves-distinct-value.jpg) | 相邻项目保存自己的 31297 |
| [11](11-after-directory-free-project-guidance.jpg) | 无项目时提前提示 |
| [12](12-after-chinese-directory-free-proxy-guidance.jpg) | 同一无项目状态切到中文 |
| [13](13-after-connection-validation-remains-available-without-project.jpg) | 无项目时独立连接校验仍可操作 |
| [14](14-after-reopened-primary-project-recovers-its-own-value.jpg) | 重开原项目恢复其名称与值 |

[基线](before-observed.json)、[改后](after-observed.json)真实页面观察；[检查器](check-proxy-scope-tcp.mjs)按实际服务 `/doc` 验收[基线](before-tcp.json)和[改后](after-tcp.json)的项目身份及配置。[持久核对](audit-owned-proxy.py)核对[原项目](seed.json)、配置文件、数据库和实际写入日志，结果见[审计记录](owned-final-check.json)。[基线 39121](before-startup.json)和[改后 39122](after-startup.json)均已正常退出。
