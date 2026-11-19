# 首份多步任务草稿的桌面验收

## 基线

- [独立零记录工作台和空状态创建入口](baseline-empty-cta-original.png)
- [取消后原空状态创建按钮](baseline-empty-cancel-return.png)
- [从空状态打开的真实首份草稿，保存模式明确](baseline-empty-first-draft-form.png)
- [关闭过程结束后的成功回执和 Backlog 卡片](baseline-empty-saved-stable.png)
- [保存后按 Tab 落到 Backlog 导航](baseline-empty-tab-skips-receipt.png)
- [逆向两次才得到打开按钮焦点](baseline-empty-receipt-reached-by-reverse-tab.png)
- [从已有回执打开的原草稿与原始请求](baseline-empty-exact-draft-opened.png)

本人在 `40288/ui/` 实际操作并逐图复核，页面视口 1280×800，资源为 `main-bDZAXbRQ.js`。真实接口独立确认记录从空列表变为一个未启动的确切草稿。

## 候选

- [英文从空态进入创建，取消后回原按钮](candidate-en-empty-cancel-return.png)
- [首份草稿保存后，下一次 Tab 到回执关闭按钮](candidate-en-receipt-next-tab.png)
- [Shift+Tab 回到回执打开按钮](candidate-en-open-receipt-focus.png)
- [从回执打开确切的英文草稿与原始请求](candidate-en-exact-draft-opened.png)
- [顶部取消归还焦点，项目、查询和看板保持](candidate-en-header-cancel-filters.png)
- [顶部保存第二份草稿后的原筛选和确切回执](candidate-en-header-saved-filters.png)
- [顶部保存后的焦点能用 Enter 重新打开创建](candidate-en-header-saved-return-reopen.png)
- [键盘聚焦中文保存草稿](candidate-zh-keyboard-save.png)
- [中文首稿保存后直接聚焦打开多步任务](candidate-zh-first-save-direct-focus.png)
- [再按 Enter 打开确切原草稿与中文请求](candidate-zh-exact-draft-opened.png)

本人在 `40286/ui/` 与 `40290/ui/` 操作真实页面并逐图复核，页面视口 1280×800，资源为 `main-BUnPTamh.js`。真实接口分别回读两条英文草稿与一条中文草稿。
