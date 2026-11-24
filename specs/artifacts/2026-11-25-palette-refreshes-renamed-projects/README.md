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

候选 `main-B4MDHDJ-.js` 的桌面查找通过独立中转连接真实服务，操作页直连同一个服务。

| 步骤 | 结果 |
| --- | --- |
| [新词改名前](candidate-new-query-before-project-rename.jpg) | `Granite Transfer Forum` 尚无匹配。 |
| [旧词在收到项目改名后](candidate-old-query-releases-renamed-project.jpg) | `Harbor Dispatch Forum` 自动退出搜索。 |
| [新词在收到项目改名后](candidate-new-query-includes-renamed-project.jpg) | 原查询自动显示 `Granite Transfer Forum` 及关联会话。 |
| [快捷键打开原项目](candidate-keyboard-opens-renamed-project.jpg) | 显示新名的同一个项目首页。 |
| [已翻页的原位置](candidate-deep-search-before-project-rename.jpg)及[改名后的同位置](candidate-project-event-retains-deep-search.jpg) | 14 条划分为两页，第二页活动项和焦点保留。 |
| [断开期间](candidate-search-while-transport-held.jpg)及[重连后](candidate-reconnect-discovers-project.jpg) | 保留相同输入，恢复后查到 `Copper Freight Board`。 |
| [原会话标题刷新](candidate-session-event-still-refreshes.jpg) | `West audit preparation handoff` 保持原会话身份、项目与输入焦点。 |

[浏览器观察值](candidate-desktop-state.json)、[实际请求与连接](candidate-query-traffic.json)、[断线改名](candidate-reconnect-rename.json)、[会话改名](candidate-conversation-rename.json)、[正式搜索读回](candidate-final-real-search.json)与[持久数据核对](candidate-persistent-results.json)分别记录候选的身份和可观察结果。
