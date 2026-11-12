# 历史目录在资源管理器中的读取记录

## 已推送基线

真实 Windows Chrome 连接 `30b859296` 的隔离开发服务 `40060/ui/`。临时移走任务样本目录后，历史引用与原件保持。

- [规范存储目录入口](baseline-stored-origin.png)、[打开后的项目树](baseline-explorer-no-recovery.png)、[切回成员标签才显示错误](baseline-stored-error-only-in-agents.png)
- [本地目录入口](baseline-local-origin.png)、[打开后的项目树](baseline-local-explorer-no-recovery.png)、[切回后查看真实诊断](baseline-local-error-details.png)
- [浏览器实际的两次 404 和清单 200](baseline-desktop.json)

## 首个候选

- [自动根列表刷新前](candidate-before-periodic-refresh.png)、[刷新后](candidate-after-periodic-refresh.png) 和 [实际请求](early-candidate-desktop.json)

## 最终构建

真实 Windows Chrome 连接 `40062/ui/`，实际加载 `main-WipNTHGm.js`。

- [规范目录键盘入口](final-stored-keyboard-origin.png)、[后台刷新后保留 404](final-404-after-root-refresh.png)、[原位重试仍缺失](final-retry-still-missing.png) 和 [新请求诊断](final-retry-diagnostics.png)
- [从诊断回到重试](final-retry-ready.png)、[方向键聚焦恢复后的文件](final-retry-file-focus.png) 和 [实际文件内容](final-retry-file-content.png)
- [简中本地目录入口](final-chinese-keyboard-origin.png)、[本地目录 404](final-local-chinese-404.png) 和 [重试恢复](final-chinese-recovered.png)
- [目标仍在等待时的根树](final-parent-list-before-target.png)、[目标超时的恢复入口](final-held-request-result.png)、[目标已能读取但父列表尚未列出](final-listing-omitted-restored-directory.png) 和 [重试恢复真实目录行](final-listing-race-recovered.png)
- [目录请求进行中](final-search-directory-in-flight.png)、[迟到 404 后的实际手动搜索](final-search-focus-after-404.png)、[原会话的错误](final-scope-before-switch.png) 和 [独立会话的实际项目树](final-scope-independent-explorer.png)
- [真实请求、逐字节原件和全行数据库核对](final-runtime.json)

截图已逐张人工复核。
