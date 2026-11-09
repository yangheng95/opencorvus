# 项目本地环境保存回执：真实桌面证据

[实施分析](../../records/2026-11/2026-11-10-local-environment-save-acknowledgement.md)。图片是本人隔离 1280×720 页面、实际配置数据，均人工查看。两次验收只切断代理返回，不伪造服务写入或响应结果。

| 图 | 旧版 main-CeKFPQ9E.js |
| --- | --- |
| [01](01-before-draft.jpg) | 第一次普通输入并准备保存。 |
| [02](02-before-replayed-close.jpg) | 无响应头时，透明重发的第二个真实 200 让表单正常关闭。 |
| [03](03-before-partial-receipt-false-failure.jpg) | 只有 200 响应头与部分正文时，实际已写入却显示保存失败。 |
| [04](04-before-stale-reopen.jpg) | 取消重开仍读取浏览器缓存的上一次值。 |

[第一次真实线上请求](before-proxy.jsonl) · [正文截断真实线上请求](before-partial-proxy.jsonl) · [初始读取](before-original-config.json) · [最终接口和磁盘](before-final-config.json) · [启动](before-startup.json) · [服务关停](before-shutdown.json) · [代理关停](before-proxy-shutdown.json) · [正文代理关停](before-partial-proxy-shutdown.json) · [退出检查](before-cleanup.json)

| 图 | 首轮候选 main-CQP3l6SN.js |
| --- | --- |
| [05](05-after-unconfirmed.jpg) | 保留草稿并提供核对；此轮焦点尚未接续。 |
| [06](06-after-original-diagnostic.jpg) | 实际传输诊断 Failed to fetch。 |
| [07](07-after-verified.jpg) | 实际读到已保存的编辑及另一入口写入的两个字段。 |

| 图 | 最终候选 main-BoLVp90r.js |
| --- | --- |
| [08](08-final-unconfirmed-focus.jpg) | 键盘保存后焦点落在核对按钮。 |
| [09](09-final-verified-focus.jpg) | 实际读取显示成功和并发值，焦点转到关闭。 |
| [10](10-final-match-reopened.jpg) | 关闭并重开后读到本次编辑及其他写入。 |
| [11](11-final-zh-unconfirmed.jpg) | 中文无法确认提示和完整草稿。 |
| [12](12-final-zh-different-draft-kept.jpg) | 当前值不同，保留草稿，焦点仍在核对。 |
| [13](13-final-zh-current-reopened.jpg) | 取消后重开显示真实当前值。 |

[首轮资源](first-candidate-asset.json) · [首轮实际线记录](first-candidate-match-proxy.jsonl) · [最终资源](after-asset.json) · [匹配实际请求](after-match-proxy.jsonl) · [不同实际请求](after-different-proxy.jsonl) · [匹配时另一入口改动](after-match-concurrent-config.json) · [不同时另一入口改动](after-different-concurrent-config.json) · [真实接口、磁盘与次数检查](after-final-config.json) · [检查器](check-save-receipt.mjs) · [本地正文截断代理](candidate-ack-review-proxy.mjs) · [隔离项目检查](isolated-disk-check.json) · [最终启动](after-startup.json) · [服务关停](after-shutdown.json) · [匹配代理关停](after-match-proxy-shutdown.json) · [不同代理关停](after-different-proxy-shutdown.json) · [退出检查](owned-cleanup.json)
