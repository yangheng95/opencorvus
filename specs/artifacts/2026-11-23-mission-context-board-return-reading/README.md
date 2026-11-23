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

第三候选由 `40750/ui/` 提供，加载 `main--8moE9Tu.js`。

- [英文 160% 切到看板前第 24 项完整可见](15-verified-en-160-tail-before-board.jpg)
- [修正读取后同一卡片仍返回末行，外层净空测量导致末行部分落在输入区边缘](16-verified-en-160-same-card-returns-to-saved-request-tail.jpg)

最终由 `40754/ui/` 提供，加载 `main-DwezpmBy.js`。真实精确读取由 `40756` 观察。

- [英文 160% 切换前的第 24 项及键盘焦点](17-complete-en-160-request-tail-before-board.jpg)
- [Tab 进入可见的看板创建动作](18-complete-en-160-board-keyboard-focus-stays-visible.jpg)
- [同一卡片返回，继续阅读第 24 项和原外层位置](19-complete-en-160-same-card-keeps-full-tail-and-outer-position.jpg)
- [简体中文 160% 往返前阅读第 07 至 12 项](20-complete-zh-160-request-middle-before-board.jpg)
- [经对话导航回到同一请求中段](21-complete-zh-160-chats-reveals-same-request-middle.jpg)
- [搜索与取消编辑后从同一卡片返回原中段](22-complete-zh-160-same-card-after-filter-and-edit-cancel.jpg)
- [真实切换到另一草稿，显示它的确切短请求](23-complete-zh-160-real-switch-shows-exact-short-draft.jpg)
- [真实切换回来时从第 01 项开始](24-complete-zh-160-real-reselection-opens-at-first-line.jpg)
- [隔离归档草稿能按同一地址读取并提供恢复动作](25-complete-zh-160-archived-current-source-can-be-restored.jpg)
- [恢复保留原请求并把输入焦点归给现有输入区](26-complete-zh-160-restored-same-request-and-composer-focus.jpg)
