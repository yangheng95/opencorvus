# 全局搜索草稿请求的桌面验收

## 基线

- [同项目的两条 Quarterly Review 仅靠快捷键序号可分](baseline-indistinguishable-search-results.png)
- [第一项实际打开南区付款草稿](baseline-first-opens-south.png)
- [第二项实际打开北区库存草稿](baseline-second-opens-north.png)

本人在 `40308/ui/` 操作并逐图复核，页面视口 1280×800，入口 `main-vn79wV_1.js`。 [正式工作记录的两个请求与会话身份](baseline-ledger-receipts.json)

## 候选

- [英文最近工作中的三个原请求和原建议命令](candidate-en-recent-work.png)
- [英文同名结果各显示自己的草稿请求](candidate-en-distinct-requests.png)
- [方向键高亮涵盖北区草稿标题、请求和目录](candidate-en-north-highlight.png)
- [按 Enter 打开北区草稿](candidate-en-opens-north.png)
- [按 Ctrl+1 打开南区草稿](candidate-en-opens-south.png)
- [唯一标题结果使用自己的草稿请求](candidate-en-unique-result.png)
- [中文草稿标签和原始英文请求](candidate-zh-distinct-requests.png)
- [从中文多步任务列表保存北区新请求](candidate-zh-updated-board.png)
- [同一标题重新搜索显示新请求，预览限制两行](candidate-zh-edited-request-in-search.png)
- [点击新请求预览打开原身份和完整多行正文](candidate-zh-opens-full-request.png)

本人在 `40310/ui/` 使用键盘和鼠标操作并逐图复核，页面视口 1280×800，入口 `main-CYCLy1Fu.js`。 [编辑前的正式回执](candidate-ledger-before-edit.json) · [编辑后的正式回执](candidate-ledger-after-edit.json)
