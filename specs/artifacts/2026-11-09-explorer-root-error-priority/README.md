# Explorer 项目根读取错误：真实桌面证据

本人复核以下隔离桌面截图：

| 图 | 实页观察 |
| --- | --- |
| [01](01-before-all-folders-healthy.jpg) | 基线：三个目录展开，空目录和原文件可见 |
| [02](02-before-root-and-child-errors-stack.jpg) | 基线：四次实际 404，前三张卡占据根错误上方 |
| [03](03-before-child-error-with-available-tree.jpg) | 基线：根和同层目录恢复后，单一子错误和文件树同屏 |
| [04](04-after-healthy-tree.jpg) | 改后：同一物理目录状态的健康对照 |
| [05](05-after-only-root-error.jpg) | 改后：四次实际失败仅呈现一个根错误和重试 |
| [06](06-after-root-diagnostic.jpg) | 展开原始详情，显示实际 HTTP 404 和请求编号 |
| [07](07-after-chinese-root-error.jpg) | 中文同一根错误、详情及重试 |
| [08](08-after-independent-child-error.jpg) | 根恢复且下一轮读取完成后，独立的 drafts 错误与原文件同屏 |
| [09](09-after-recovered-empty-and-original-file.jpg) | 键盘触发目录重试后恢复空目录与原文件 |

[基线页面](before-observed.json)和[候选页面](after-observed.json)记录实际交互。根重试只请求根的既有行为在候选页面另有观察，归下一批单独复现。[代理](directory-scope-proxy.mjs)只变更自有测试目录的读取参数；[基线](before-proxy.log)和[候选](after-proxy.log)转发日志可与[真实服务逐条配对的审计](owned-request-audit.json)核对。审计同时验证两个目录和各自 Git HEAD 不变，隔离数据库无会话、消息、执行任务或 Provider 活动。模式切换见[时间线](proxy-mode-changes.jsonl)。

[在线接口检查器](check-folder-tcp.mjs)结果：[基线](before-initial-tcp.json)、[候选](after-initial-tcp.json)、[恢复](after-recovered-tcp.json)。[基线启动](before-startup.json)、[基线关闭](before-shutdown.json)、[候选启动](after-startup.json)、[候选关闭](after-shutdown.json)均来自实际进程；四个进程正常退出。
