# 右侧工具溢出选择的真实桌面焦点

在隔离的 OpenCorvus `/ui/` 打开审阅、真正的当前文件及资源管理器。以下为浏览器 1280×720 原图。

| 基线 | 原始截图 |
| --- | --- |
| 英文 100% 溢出菜单有审阅 | [截图](baseline-en-overflow-menu.jpg) |
| 回车激活审阅，焦点仍留在更多标签页 | [截图](baseline-en-overflow-return-focus.jpg) |
| 中文 160% 溢出菜单有资源管理器 | [截图](baseline-zh-overflow-menu.jpg) |
| 回车激活资源管理器后的菜单按钮焦点 | [截图](baseline-zh-explorer-activated-overflow-focus.jpg) |
| 从菜单返回后按 Ctrl+F 打开查找对话 | [截图](baseline-zh-find-after-overflow.jpg) |
| 显式聚焦选中的资源管理器再按 Ctrl+F，实际查询第 84 个文件 | [截图](baseline-zh-find-from-focused-explorer-tab.jpg) |
| 中文空栏打开资源管理器保留原行为 | [截图](baseline-zh-empty-dock-tool-opening.jpg) |

| 最终交互 | 原始截图 |
| --- | --- |
| 英文回车激活、向右键浏览与 Escape 取消 | [审阅标签](candidate-en-activated-review-focus.jpg) · [相邻工具](candidate-en-right-continues-tab-navigation.jpg) · [菜单归焦](candidate-en-escape-returns-to-menu-button.jpg) |
| 中文从溢出选择后直接使用 Ctrl+F | [键盘归焦](candidate-zh-keyboard-activated-explorer-focus.jpg) · [文件搜索](candidate-zh-find-directly-after-overflow.jpg) |
| 中文查找、浏览及阅读第 84 项 | [实际结果](candidate-zh-file-search-result-focus.jpg) · [磁盘正文](candidate-zh-real-file-084.jpg) |
| 中文鼠标选工具和中心会话查找 | [指针激活](candidate-zh-pointer-activation-focus.jpg) · [查找对话](candidate-zh-conversation-find-still-available.jpg) |
| 中文关闭工具与空栏重开 | [回到文件](candidate-zh-close-restores-file-tab.jpg) · [重新打开资源管理器](candidate-zh-empty-dock-tool-opening.jpg) |
