# 长草稿会话首次阅读位置的真实桌面截图

基线由 `40736/ui/` 提供，加载 `main-D4hBYR-a.js`。本人从实际操作中的隔离浏览器保存并查看下列原图。

- [英文 160% 从回执进入时主层滚到底，标题被裁](01-baseline-en-160-long-request-opens-at-bottom.jpg)
- [用户向上滚动后可见原标题及第 01 项](02-baseline-en-160-manual-outer-top-shows-title-and-first-line.jpg)
- [聚焦已保存请求并按 End 可看到第 24 项](03-baseline-en-160-native-request-end-shows-final-line.jpg)
- [英文 160% 短草稿能完整显示](04-baseline-en-160-short-request-fits-at-current-position.jpg)
- [简体中文 160% 从侧栏选择仍从第 03 项附近呈现](05-baseline-zh-160-sidebar-reopens-below-title.jpg)
- [同一选择由看板返回后展示请求首行，外层仍有位移](06-baseline-zh-160-same-selection-returns-with-native-request-position-reset.jpg)

候选由 `40738/ui/` 提供，加载 `main-CwvxsPDX.js`。以下九张原图均已人工复核。

- [英文 160% 从回执打开可见原标题及第 01 项](07-candidate-en-160-receipt-opens-at-title-and-first-line.jpg)
- [原请求区按 End 可读到第 24 项](08-candidate-en-160-native-end-shows-request-tail.jpg)
- [Tab 把看板返回按钮带入视口并获得焦点](09-candidate-en-160-tab-reaches-missions-action.jpg)
- [短草稿完整显示标题、正文和动作](10-candidate-en-160-short-context-fully-visible.jpg)
- [简体中文 160% 从项目侧栏选择时标题和原文开头可见](11-candidate-zh-160-sidebar-opens-at-title-and-first-line.jpg)
- [从同一确切会话地址冷打开也显示原标题和第 01 项](12-candidate-zh-160-cold-url-starts-at-original-heading.jpg)
- [归档状态和恢复按钮与原请求开头同屏](13-candidate-zh-160-archived-context-starts-at-title.jpg)
- [恢复同一草稿后标题与请求首行仍可读](14-candidate-zh-160-restored-draft-keeps-reading-start.jpg)
- [普通新对话可使用原输入区](15-candidate-zh-160-new-conversation-input-works.jpg)
