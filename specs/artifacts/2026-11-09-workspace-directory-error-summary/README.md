# 第 110 批：手填目录错误反馈的桌面证据

在独立 Windows 开发服务的 `/ui/` 页面真实键盘输入并确认。两套目录和持久化资料均为本批创建，未接入已有用户项目或模型。

| 截图 | 人工复核 |
| --- | --- |
| [01](01-before-missing-directory-generic-summary.jpg)、[02](02-before-regular-file-same-summary.jpg)、[03](03-before-host-mismatch-same-summary.jpg) | 基线英文的三个不同服务拒绝共用保存失败摘要。 |
| [04](04-before-chinese-generic-save-message.jpg) | 基线中文的缺目录错误只说未能确认保存结果。 |
| [05](05-after-missing-directory-actionable-summary.jpg)、[06](06-after-original-diagnostic-stays-available.jpg) | 英文缺目录提示说明纠正方式，展开保留原服务诊断。 |
| [07](07-after-file-requires-a-directory.jpg)、[08](08-after-host-format-explanation.jpg) | 英文分别提示改输目录或按服务操作系统的格式输入。 |
| [09](09-after-chinese-missing-directory-summary.jpg)、[09b](09b-after-chinese-file-is-not-directory.jpg)、[09c](09c-after-chinese-server-path-format.jpg) | 同三种错误的中文摘要，仍可在原输入处改正。 |
| [10](10-after-corrected-directory-opens-original-file.jpg) | 改正后进入目标项目，键盘打开它的原有文件。 |
| [11](11-after-real-disconnect-keeps-dialog.jpg)、[12](12-after-cancel-preserves-target-file.jpg) | 自有服务停止后提示重试；取消后保留目标文件并恢复按钮焦点。 |

[基线页面记录](before-observed.json)、[候选页面记录](after-observed.json) 提供原页面观察和操作时间。[在线合同检查器](check-workspace-directory-tcp.mjs) 使用真实开发服务与在线接口说明，[结果](after-directory-contract.json) 给出请求编号与响应事实。[最终对账](owned-feedback-audit.json) 核对页面和检查器的服务编号、退出收据、项目计数和原文件内容。反向操作系统路径错误未在非 Windows 宿主实测。
