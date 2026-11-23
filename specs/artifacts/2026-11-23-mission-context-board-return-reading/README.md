# 同一草稿返回阅读位置的真实桌面截图

基线由 `40742/ui/` 提供，加载 `main-CwvxsPDX.js`。以下截图从本人实际操作的隔离桌面页面取得并人工查看。

- [英文 160% 通过 End 到第 24 项](01-baseline-en-160-operator-reading-checkpoint-24.jpg)
- [焦点离开请求区进入看板按钮，末行仍可读](02-baseline-en-160-tail-persists-when-focus-leaves-request.jpg)
- [从看板同一卡片回来后位置重置](03-baseline-en-160-board-same-card-returns-to-request-start.jpg)
- [通过 Tasks 和 Chats 往返也丢失末段位置](04-baseline-en-160-chats-reveal-also-loses-request-tail.jpg)
- [简体中文 160% 阅读保存请求中段](05-baseline-zh-160-request-middle-before-board.jpg)
- [点击同一卡片后中段跳回首行](06-baseline-zh-160-board-card-loses-reading-middle.jpg)

首个候选由 `40744/ui/` 提供，加载 `main-B0oLlC7t.js`。下列原图记录第一种布局尝试的实际结果。

- [英文 160% 候选切换看板前的末段](07-candidate-en-160-request-tail-before-board.jpg)
- [活动看板独占主区域，焦点处于看板标题](08-candidate-en-160-board-occupies-workspace-with-conversation-inactive.jpg)
- [绝对定位候选仍回到了首行](09-first-candidate-en-160-return-still-resets-reading.jpg)

第二候选由 `40746/ui/` 提供，加载 `main-gTLCsrmz.js`。诊断转发端 `40748` 只暂缓交付同一精确工作记录的真实响应。

- [固定网格候选切换前的末段](10-second-candidate-en-160-tail-before-board.jpg)
- [暂隐会话期间 Tab 正常进入看板创建按钮](11-second-candidate-en-160-board-tab-reaches-visible-create-action.jpg)
- [相同尺寸与定位类型下仍丢失阅读位置](12-second-candidate-en-160-box-stable-but-reading-resets.jpg)
- [第二次正式 200 待交付时原请求区已卸载，返回显示正在加载](13-second-candidate-held-selected-read-removes-request-context.jpg)
- [交付同一正式响应后，阅读内容从首行重新挂载](14-second-candidate-delivered-read-remounts-at-first-line.jpg)
