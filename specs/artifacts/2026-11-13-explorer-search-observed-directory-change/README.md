# 外部移动后文件搜索的真实桌面记录

## 已推送基线

Windows Chrome 连接 `f11ddcdd8` 的隔离开发服务 `40068/ui/`，实际加载 `main-D25M82Rn.js`。

- [初始实际两项](baseline-both-current-results.png)、[返回项目后仍是旧搜索](baseline-stale-search-after-return.png) 和 [真实后台根列表之后](baseline-stale-after-actual-root-refresh.png)
- [键盘聚焦旧行](baseline-stale-row-focus.png)、[实际编辑器 404](baseline-missing-editor.png) 和 [切回后仍显示旧路径](baseline-explorer-still-stale-after-404.png)
- [手动刷新取得正确结果](baseline-manual-refresh-correct-results.png)
- [浏览器真实请求和手势](baseline-desktop.json) 和 [真实接口读取的文件名](baseline-direct-after-rename.json)

## 首个候选

- [原行持有焦点](candidate-focused-before-external-move.png)、[后台读取已更新结果](candidate-after-observed-rename.png)、[旧行退役后的方向键](candidate-arrow-after-retirement.png) 和 [原生焦点诊断](candidate-focus-diagnostic.json)

## 最终构建

真实 Windows Chrome 连接隔离开发服务 `40070/ui/`，实际加载 `main-4dLVDa0b.js`。

- [外部改名前的聚焦行](final-focused-before-rename.png)、[移除后搜索框持焦](final-focus-returns-to-search.png)、[方向键进入实际剩余项](final-arrow-selects-surviving-row.png)、[恢复后邻近行持焦](final-restored-keeps-neighbor-focus.png) 和 [目录不变的后台轮次](final-unchanged-background-round.png)
- [后发输入的当前结果](final-new-input-owns-accepted-results.png)、[改名文件原文](final-relocated-original-content.png)、[在途读取时关闭](final-after-close-while-root-pending.png) 和 [重开的当前目录](final-reopened-current-directory.png)
- [简中已展开的空目录](final-chinese-expanded-branch.png)、[真实初始空查询](final-chinese-accepted-empty.png)、[一次查询的两项结果](final-chinese-two-results-from-one-query.png)、[方向键进入新增项](final-chinese-keyboard-after-additions.png)、[空结果和恢复焦点](final-chinese-focus-to-empty-query.png) 和 [手动刷新](final-chinese-explicit-refresh.png)
- [真实请求顺序、原文件和隔离数据库](final-runtime.json)

截图已逐张人工复核。
