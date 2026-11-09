# 第 113 批：目录检查等待时取消的桌面证据

两套独立 Windows 开发服务的实际 `/ui/` 页面。代理不替换结果：它转发真实检查和改名，然后延迟向页面交付原响应，继续转发真实网页双向连接。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-escape-leaves-directory-check-open.jpg)、[02](02-before-delayed-response-still-switches-project.jpg)、[03](03-before-metadata-write-remains-locked.jpg) | 基线按 Escape 无法撤回只读检查，稍后切换；写入同样锁定，但已可观察到实际改名。 |
| [04](04-after-cancel-is-available-during-check.jpg)、[05](05-after-escape-keeps-project-and-file.jpg) | 英文等待期间 Cancel 可用；Escape 关闭并保留原项目、文件及焦点。 |
| [06](06-after-chinese-cancel-button-available.jpg)、[07](07-after-chinese-cancel-keeps-original-workspace.jpg) | 中文点击取消可撤回，保留同一工作区。 |
| [08](08-after-original-deadline-and-timeout-diagnostic.jpg)、[09](09-after-current-check-shows-actual-directory-error.jpg)、[10](10-after-new-confirmation-opens-target-file.jpg) | 超时保留原诊断；后续实际缺目录错误可纠正；有效确认打开目标原文件。 |
| [11](11-after-real-write-still-waits-for-receipt.jpg)、[12](12-after-confirmed-write-keeps-original-target-file.jpg) | 真实改名等待回执，完成后新名和原文件均可见。 |

[代理](response-delay-proxy.mjs) 参数为 `<代理端口> <服务端口> 7000 19000`；末项只用于名为 `deadline-owned-folder` 的检查。实际操作见[基线](before-observed.json)和[候选](after-observed.json)。[在线检查](after-directory-contract.json)使用[第 110 批检查器](../2026-11-09-workspace-directory-error-summary/check-workspace-directory-tcp.mjs)。[对账](directory-cancel-audit.json)记录原请求编号、客户端中止或成功交付、实际持久化及退出收据。
