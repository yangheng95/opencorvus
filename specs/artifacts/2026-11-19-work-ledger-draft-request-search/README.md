# 按草稿请求搜索的桌面验收

## 基线

- [全局查找按北区两个现有请求的共有词返回零项](baseline-request-query-empty.png)
- [三条同标题草稿显示各自的原请求](baseline-title-shows-saved-requests.png)
- [归档查询未找到已实际归档草稿的原请求](baseline-archive-request-empty.png)

本人在 `40316/ui/` 实际操作并逐图复核，视口 1280×800，入口 `main-CzlgD35T.js`。 [四条实际草稿和查询回执](baseline-request-search-receipts.json)

## 候选

- [英文按共同请求短语找到两个项目的草稿](candidate-en-request-matches-two-projects.png)
- [按 Enter 打开正确的联查项目和完整请求](candidate-en-opens-peer-draft.png)
- [中文含三个字面符号的短语精确匹配主项目](candidate-zh-literal-request-match.png)
- [按快捷键打开主项目原始草稿](candidate-zh-opens-primary-draft.png)
- [中文归档搜索提示](candidate-zh-archive-search-hint.png)
- [中文界面以归档请求短语找到 Historical Review](candidate-zh-archived-request-match.png)
- [打开原始归档会话，只读查看完整请求](candidate-zh-opens-archived-original.png)
- [英文归档搜索提示](candidate-en-archive-search-hint.png)
- [英文按原标题仍找到相同归档行](candidate-en-archive-original-title.png)

本人在 `40318/ui/` 用鼠标和键盘操作并逐图复核，视口 1280×800，入口 `main-VddIzLo0.js`。 [候选公开查询与会话回执](candidate-request-search-receipts.json) · [真实命令行回执](candidate-cli-search-receipts.json)
