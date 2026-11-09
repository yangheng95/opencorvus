# 项目本地环境变量的输入与保存：桌面证据

[实施分析](../../records/2026-11/2026-11-10-local-environment-variable-edits.md)。截图为本人隔离项目的实际开发页面，均人工查看。变量和值均为本人设置的无敏感验收数据。

| 图 | 旧版 `39331`，`main-BjThSWgB.js` |
| --- | --- |
| [01](01-before-existing-variables.jpg) | 原先三个已保存变量。 |
| [02](02-before-edited-variables.jpg) | 普通逐字符输入只留下首字符，输入焦点丢失。 |
| [03](03-before-full-rename-draft.jpg) | 一次性输入完整名称；删除和改名后的界面草稿只有两项。 |
| [04](04-before-removed-variables-return.jpg) | 保存返回真实 200，重开后删除的键和改名前的键都仍在。 |

[旧版原配置](before-original-config.json) · [实际请求](before-proxy.jsonl) · [保存后服务和磁盘回读](before-after-save.json) · [记录代理](local-environment-wire-proxy.mjs) · [服务启动](before-startup.json) · [服务关停](before-shutdown.json) · [代理关停](before-proxy-shutdown.json)

| 图 | 修复版 `39333`，`main-1In-HNjq.js` |
| --- | --- |
| [05](05-after-key-typing-focus.jpg) | 变量名逐字输入完整，焦点仍在名称。 |
| [06](06-after-value-typing-focus.jpg) | 值逐字输入完整，焦点仍在值。 |
| [07](07-after-owned-draft.jpg) | 改名并删除另一行后的实际保存草稿。 |
| [08](08-after-reopened-verified.jpg) | 重开显示改名的新值及另一入口增加和更新的两项。 |
| [09](09-after-cancel-draft.jpg) | 草稿删去已保存行，随后点击取消。 |
| [10](10-after-chinese-reopened.jpg) | 中文页面重新打开，取消编辑的行仍在。 |
| [11](11-after-added-draft.jpg) | 中文页面新增行并逐字输入，值有焦点；随后移除该行，保存无变更草稿。四行布局裁边留待另批。 |

[原配置](after-original-config.json) · [并发改动](after-concurrent-config.json) · [界面补丁记录](after-proxy.jsonl) · [保存后回读](after-saved-config.json) · [最终接口与磁盘检查](after-final-contract.json) · [检查器](check-final-environment.mjs) · [隔离项目检查](isolated-disk-check.json) · [服务启动](after-startup.json) · [服务关停](after-shutdown.json) · [代理关停](after-proxy-shutdown.json) · [退出检查](owned-cleanup.json)
