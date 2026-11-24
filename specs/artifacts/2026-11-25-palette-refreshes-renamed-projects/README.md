# 项目改名后全局查找的实际证据

基线 `main-BROy0g4u.js`，只使用隔离的两个项目。以下截图在真实桌面操作后留取并人工检查。

| 步骤 | 结果 |
| --- | --- |
| [改名前原查询](baseline-old-project-name-in-search.jpg) | `Cedar Logistics` 查到 `Cedar Logistics Forum` 和物理目录。 |
| [独立标签打开原项目菜单改名](baseline-peer-renames-project.jpg) | 项目已经叫 `Amber Dispatch Forum`。 |
| [搜索保持打开](baseline-open-search-keeps-old-project-name.jpg) | 侧栏已显示新名，结果仍保留旧名称。 |
| [手动换词后读到新名](baseline-new-query-loads-renamed-project.jpg) | 新查询命中，键盘实际打开相同项目。 |
| [断开消息流前](baseline-search-before-transport-loss.jpg) | 在真实项目首页打开搜索，记录原匹配。 |
| [改名后重连](baseline-search-stays-stale-after-reconnect.jpg) | 侧栏更新为 `Harbor Dispatch Forum`，搜索仍显示旧命中。 |

[正式项目和搜索响应](baseline-formal-search-after-rename.json)显示同一个项目和两次查找的结果。[断线期间的改名](baseline-reconnect-rename.json)保留服务写入回执。[真实连接和搜索请求](baseline-reconnect-transport.json)记录断开、被拒绝的重试和重连。
