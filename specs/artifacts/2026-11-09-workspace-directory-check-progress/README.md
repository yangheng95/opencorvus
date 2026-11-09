# 第 111 批：目录检查与改名的桌面证据

在两个独立 Windows 开发服务的 `/ui/` 页面实操。代理只延迟两个目标请求，转发真实状态、响应与网页双向连接；没有合成目录、重命名响应或页面状态。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-directory-check-says-saving.jpg)、[02](02-before-chinese-directory-check-says-saving.jpg)、[03](03-before-metadata-rename-says-saving.jpg) | 英文和中文的目录检查与真实元数据改名都显示保存。 |
| [04](04-after-directory-check-announces-checking.jpg)、[05](05-after-check-restores-correction.jpg) | 英文说明正在检查；检查完成后保留原输入与纠正方式。 |
| [06](06-after-chinese-directory-check-announces-checking.jpg)、[07](07-after-corrected-directory-is-checked.jpg)、[08](08-after-confirmed-directory-opens-own-file.jpg) | 中文检查说明准确，在同一框纠正后进入目标项目，键盘打开原有文件。 |
| [09](09-after-real-rename-still-announces-saving.jpg)、[10](10-after-rename-retains-the-original-file.jpg) | 同一候选页面真正改名仍显示保存。改名完成后侧栏可见新名称，文件和物理目录仍属同一目标。 |

[基线](before-observed.json)和[候选](after-observed.json)记录实际操作时间和页面可见文字。[代理](pending-delay-proxy.mjs) 的调用形式为 `node pending-delay-proxy.mjs <代理端口> <服务端口> 7000`。[在线合同检查结果](after-directory-contract.json) 使用[前一批的目录检查器](../2026-11-09-workspace-directory-error-summary/check-workspace-directory-tcp.mjs)。[对账](pending-progress-audit.json) 包含实际请求编号、代理延迟、项目持久化事实、原文件以及退出收据。
