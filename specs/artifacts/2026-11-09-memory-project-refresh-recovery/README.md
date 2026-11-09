# 第 116 批：记忆项目列表的真实桌面证据

从两套自有 Git 项目和隔离开发服务验证。代理仍转发原始工作列表与网页双向流；特定请求收到原服务器 200 后只交付 32 字节正文。正常重试转发原始完整响应。

| 截图 | 本人复核 |
| --- | --- |
| [01](01-before-accepted-project-and-unsent-draft.jpg)、[02](02-before-refresh-failure-clears-project-and-draft.jpg)、[03](03-before-chinese-uses-raw-error-as-summary.jpg) | 前态：已选项目、文档、焦点和输入；一次失败清掉全部，中文显示原始英文原因。 |
| [04](04-before-remount-selects-current-workspace.jpg)、[05](05-before-reselect-loses-unsent-draft.jpg) | 前态：重进恢复默认项目，手动再选原目录仍是空草稿。 |
| [06](06-after-accepted-project-and-unsent-draft.jpg)、[07](07-after-failed-refresh-keeps-project-document-and-draft.jpg)、[08](08-after-original-refresh-diagnostic.jpg)、[09](09-after-chinese-refresh-with-retry.jpg) | 候选：选定原项目、失败后保留目录/文档/草稿/焦点、展开真实诊断、中文摘要及重试。 |
| [10](10-after-keyboard-retry-updates-name-keeps-draft.jpg)、[11](11-after-deliberate-project-switch-updates-scope.jpg)、[12](12-after-main-workspace-stays-current.jpg) | 键盘重试更新同一项目名称与焦点；主动换项目才切换笔记/文档范围，主工作区保持。 |
| [13](13-after-first-read-failure-is-distinct-from-empty.jpg)、[14](14-after-initial-failure-original-diagnostic.jpg)、[15](15-after-initial-retry-opens-current-project.jpg) | 独立页面首读失败与已接受空结果分开；原诊断可展开，键盘重试恢复正确默认项目和输入。 |

[基线](before-observed.json)、[候选](after-observed.json)、[首读](cold-observed.json) 是真实页面操作观察；对应代理原记录为 `before-proxy.jsonl`、`after-proxy.jsonl`、`cold-proxy.jsonl`。`before` 记录中 `archive-page` 为早期复用的事件标签，路由与项目身份都是真实 Memory 项目列表。代理命令为 `node memory-project-refresh-proxy.mjs <代理端口> <开发端口> <隔离项目绝对目录> [initial-cut]`。首次候选服务冻结了旧资源（`first-start-proxy.jsonl`），已经排除，候选只计实际提供 `main-DlC2yIw7.js` 的服务。

[项目操作脚本](memory-project-actions.mjs) 通过现有生产接口初始化、改名，未触及任何用户项目。[真实服务检查](check-memory-project-tcp.mjs) 和[结果](after-live-check.json) 验证路由、项目身份/原目录、项目文档/笔记及原 Git 文件；与网页观察分开。`*-startup.json`、`*-shutdown.json` 对应自有服务/代理的正常启动和退出回执。
