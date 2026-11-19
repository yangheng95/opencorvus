# 已选专家团名称的桌面验收

## 基线

- [实际英文首屏只有选中计数，显示的两项均未勾选](baseline-en-count-only.png)
- [滚动到已选的 Dynamic，计数仍为 1](baseline-en-scrolled-to-dynamic.png)
- [实际勾选 Research Studio 后状态只报告计数 2](baseline-en-count-after-toggle.png)

本人在 `40292/ui/` 的隔离 Windows 桌面操作并逐图复核，视口 1280×800，资源为 `main-BUnPTamh.js`。

## 候选

- [英文首屏即时显示选中的 Dynamic](candidate-en-default-first-screen.png)
- [追加 Base 后按选择顺序显示两项](candidate-en-two-names.png)
- [真实零匹配搜索保留两个已选名称](candidate-en-empty-search-retains-names.png)
- [取消 Dynamic 后只显示 Base 已选](candidate-en-removed-dynamic.png)
- [取消两者后显示零项](candidate-en-zero-selected.png)
- [清除查询仍保留作者的零项选择](candidate-en-clear-keeps-zero.png)
- [切换工作类型后显示当前上下文的默认团队](candidate-en-code-scope-default.png)
- [简体中文在立即开始模式可查看相同名称](candidate-zh-start-mode-selection.png)
- [先存草稿模式中的三个完整名称](candidate-zh-three-selected.png)
- [中文完整显示五个名称，底部操作可达](candidate-zh-five-selected.png)
- [准备保存的三个确切专家团](candidate-zh-save-selection.png)
- [保存前实际草稿和已选列表](candidate-zh-authored-before-save.png)
- [实际保存回执与待规划草稿](candidate-zh-draft-receipt.png)

本人在 `40294/ui/` 操作并逐张核对，视口同为 1280×800，加载 `main-zA6pe0jI.js`。[基线目录与查询回执](baseline-squad-catalog.json) · [候选草稿正式接口的会话和持有标识](candidate-draft-receipt.json)
