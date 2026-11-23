# 设置导航让键盘焦点随标签列表滚动

## Recall

- 用户要求本人独立持续按批迭代，先调查并落盘根因和影响，再实改、真实桌面交互、逐张复核截图、聚焦正向检查、提交、合并上游和普通推送。第 437 批 `56759bdeb` 已推送，本批起始 192 条工作区状态，包含原来 177 条及其他工作新增的 15 条版本文件。本批仅设置导航布局，不使用凭据或 GPT-6.1 Sol，不修改版本文件。
- 已读 `AGENTS.md`、[当前界面架构](../../current/architecture/07-panel.md)、[设置搜索焦点](2026-11-23-settings-search-dismiss-navigation-tooltip.md)、[设置窄栏标题](2026-11-23-settings-section-header-readable-scope.md)、`ConfigDialogHost`、共享 `Tabs`、Kobalte TabsList 和 `createSelectableCollection` 的键盘及滚动所有权。全仓查 `configSidebar`、`config-sidebar`、`settings-dialog-tablist`、共享 `rail` 布局、设置滚动、焦点轮廓和公开工具测试。触及路径未找到界面自动化测试。
- W3C（万维网联盟）页签实践规定 Home 和 End 在支持时移动到头和尾，手动激活用 Enter 或 Space。实际收到焦点的控件需要保持可见。 [标签模式](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) [键盘焦点可见性](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

## 根因及影响

1. 隔离开发页 `40676/ui/` 加载 `main-BXpIDKhP.js`。1280×720 英文 150%、默认设置侧栏 324 像素。实际打开设置，焦点从搜索用 Tab 到 General，再按 End 已到 About，但 About 顶部在 y996，完全在屏幕下方。设置 `nav` 高 666、滚动总高 1002、位置 0。内部可访问 TabList 高 844、客户端同高、位置 0，没有自己的滚动空间。 [基线实拍](../../artifacts/2026-11-23-settings-tablist-scroll-owner/README.md)
2. 滚轮能将外层 `nav` 滚到 335.3，About 到 y660；此时返回按钮 y−263，搜索框 y−209。按 Enter 实际打开 About，按 Home 焦点移动到 General，General 仍在 y−112，已打开页面继续为 About。用户既失去两项主控件的视觉入口，也无法沿既有键盘链读到焦点。上一批只让搜索获得实际焦点时不被提示盖住，未改变这个布局。
3. `settings.css` 将 `overflow-y:auto` 设置在外层导航，内层 `.config-sidebar .oc-tabs` 保持固有高度。共享 `Tabs` 使用 Kobalte 手动激活；Kobalte 允许焦点在移到新页签时使用 `preventScroll`，再把自己 `ref` 的 TabList 作为默认滚动所有者，按聚焦的 key 在该容器里滚动。实际可滚动的元素和键盘所有者分离，造成上述两条路径。无需加按键拦截、手动 `scrollIntoView` 或双层滚动。
4. 范围仅设置侧栏布局、现标签列表的键盘与指针显示、焦点轮廓和搜索／返回的可用位置。标签选择、搜索匹配、手动激活、选中身份、右侧内容滚动、分隔条尺寸和宽度保存、其他页签实例、连接、发布、数据库、Task（任务）、Mission（多步任务）、Session（会话）运行与队列不涉及。所有基线动作只是导航，没有执行异常。需要复核列表独立缩小时标题、窄栏、不匹配状态、缩放和真实宽度是否可用。

## 实施和验收

- 外层保留原测宽、尺标、边距和背景，设为裁剪容器。给现 Settings TabList 可压缩高度与本地纵向滚动，顶部的“返回应用”和搜索不参与列表滚动。标签前景焦点轮廓使用已有令牌内收，以免在列表边界裁剪。沿用共享控件、标签顺序和页面激活，不新增状态、布局测量或事件监听。
- 用同一真实开发页面从搜索 Tab 进入正常列表，分别在英文 150% 和简体中文高缩放窄栏复核 End、Home、Enter、鼠标滚轮、实际搜索和返回。核对上下端仍可完整看到焦点，整个过程中搜索与返回都可见，实际标签列表是唯一滚动所有者，右侧内容及原手动激活没有受影响。普通 100% 与真实过滤路径进行旁证。人工复核截图并运行聚焦非界面搜索、菜单检查、类型、国际化、样式、构建及文档。核对真实正式接口与项目数据，自有实例关停后提交、同步上游和普通推送。
