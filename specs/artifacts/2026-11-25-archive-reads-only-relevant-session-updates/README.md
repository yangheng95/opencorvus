# 归档页的会话更新读取证据

真实浏览器分别打开独立归档观察页及操作页。两条会话及项目均为本批自建。

- [原归档行可用](baseline-archive-row-ready.jpg)。
- [另一页实际更名活动会话](baseline-author-renames-only-active-chat.jpg)。原会话仍属于活动列表。
- [观察页的归档行被无关读取挂起](baseline-ordinary-rename-busies-archive.jpg)。实际字段为 `aria-busy=true`，原按钮被禁用，焦点落在页面主体。
- [实际改名与读取响应](baseline-archive-refresh-receipts.json)和[真实会话与归档列表回读](baseline-archive-and-session-reads.json)记录相同项目的两条会话及不变的归档行。

## 当前实现

- [活动会话更名后原归档行保持键盘焦点](candidate-active-rename-keeps-archive-focus.jpg)。按 Enter [打开原归档会话](candidate-opens-exact-archive-with-keyboard.jpg)。
- [归档标题变更前的空搜索](candidate-empty-query-before-archived-rename.jpg)和[相同搜索显示实际新标题](candidate-archived-rename-appears-in-existing-search.jpg)。
- [另一页恢复后相同搜索回到空态](candidate-archived-restore-updates-existing-search.jpg)，筛选内容和焦点保留。
- [现场事件、归档请求和最终回读](candidate-archive-refresh-receipts.json)记录三个变更的投影，及恢复前后同一项目、同一会话的请求结果。
