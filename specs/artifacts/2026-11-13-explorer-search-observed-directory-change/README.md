# 外部移动后文件搜索的真实桌面记录

## 已推送基线

Windows Chrome 连接 `f11ddcdd8` 的隔离开发服务 `40068/ui/`，实际加载 `main-D25M82Rn.js`。

- [初始实际两项](baseline-both-current-results.png)、[返回项目后仍是旧搜索](baseline-stale-search-after-return.png) 和 [真实后台根列表之后](baseline-stale-after-actual-root-refresh.png)
- [键盘聚焦旧行](baseline-stale-row-focus.png)、[实际编辑器 404](baseline-missing-editor.png) 和 [切回后仍显示旧路径](baseline-explorer-still-stale-after-404.png)
- [手动刷新取得正确结果](baseline-manual-refresh-correct-results.png)
- [浏览器真实请求和手势](baseline-desktop.json) 和 [真实接口读取的文件名](baseline-direct-after-rename.json)

截图已逐张人工复核。
