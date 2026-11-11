# 工作台选中记录刷新范围的桌面证据

- [完整事件连接下的原草稿](02-socket-selected-draft-before-other-update.png)。另一项目真实 Chat 改名正常更新侧栏，截断随之触发的额外精确读取后，[原草稿的标题、请求和输入区失去当前数据](03-socket-foreign-update-disables-selected-draft.png)。原位显式重试[恢复同一份原请求](04-socket-selected-draft-read-retry.png)。
- [真实升级、另一项目变更、额外读取、原位重试和精确接口结果](baseline-socket-evidence.json)。[隔离数据库检查](profile-baseline-db-evidence.json)。
- 第 252 批补验，保留真实事件连接时，[阅读页归档前态](05-socket-archive-reader-before-restore.png)在回执截断后[恢复原草稿与焦点](06-socket-archive-reader-restored.png)，[另一项目的归档 Chat](07-socket-chat-archive-before-restore.png)也[从设置确认恢复](08-socket-chat-archive-restored.png)。
- 首轮候选的[远端改名](10-candidate-other-project-renamed-draft-stays-open.png)保留阅读页，[同页改名](11-first-candidate-local-rename-stale-reader.png)仍触发额外读取。[同页入口的真实读取证据](first-candidate-same-page-evidence.json)
- 最终候选的[原草稿](12-final-before-updates.png)在另一项目[远端更新](13-final-remote-update-keeps-draft.png)与[同页改名](14-final-local-update-keeps-draft.png)时保留，[实际输入](15-final-original-input-usable.png)仍可编辑。
- 当前草稿[自身更新](16-final-own-update-keeps-original-request.png)正常显示。下一次实际精确读取[中断](17-final-own-read-failure.png)后，从同一页面[重试恢复原请求和未发送文本](18-final-own-read-retried.png)。
- [最终实际事件、回执、浏览器读取与正式契约读回](final-selection-invalidation-evidence.json)，[最终 SQLite 检查](profile-final-db-evidence.json)。

截图由本人逐张查看。[根因、影响和方案](../../records/2026-11/2026-11-12-work-ledger-selection-invalidation.md)
