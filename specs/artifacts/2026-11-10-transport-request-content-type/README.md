# 宿主请求体媒体类型：真实目录操作证据

[根因和方案](../../records/2026-11/2026-11-10-transport-request-content-type.md)。桌面截图来自本人隔离开发页面，均已实际查看。记录代理只检查自有目录写动作的媒体类型、`source` 和服务响应身份，其余原样转发。

| 图 | 旧版 `39327`，`main-CzKUCAnP.js` |
| --- | --- |
| [01](01-before-project-root-error.jpg) | 项目目录操作真实 400。 |
| [02](02-before-global-root-error.jpg) | 全局目录操作真实 400。 |

[真实请求字段及 400 回执](before-proxy.jsonl) · [隔离代理](directory-wire-proxy.mjs) · [启动](before-startup.json) · [服务关停](before-shutdown.json) · [代理关停](before-proxy-shutdown.json)

| 图 | 修复版 `39329`，`main-BjThSWgB.js` |
| --- | --- |
| [03](03-after-project-root-success.jpg) · [04](04-after-project-root-chinese.jpg) | 鼠标动作收到真实项目目录结果，切中文仍保留同一回执。 |
| [05](05-after-global-root-success.jpg) · [06](06-after-project-root-keyboard.jpg) | 键盘操作成功、焦点保留；两条独立剪贴板精确匹配自有目录路径。 |

[真实单值字段与三个 200](after-proxy.jsonl) · [操作前目录存在性](after-pre-action-roots.json) · [操作后目录及剪贴板结果](after-post-action-roots.json) · [目录公开契约](after-directory-contract.json) · [前](after-initial-tcp.json)/[后](after-tcp.json)目录读取 · [原输入与进程](closed-and-inputs.json) · [数据库计数](database-facts.json) · [启动](after-startup.json) · [服务关停](after-shutdown.json) · [代理关停](after-proxy-shutdown.json)
