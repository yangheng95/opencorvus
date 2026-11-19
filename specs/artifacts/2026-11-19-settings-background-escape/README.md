# 设置页空白区域返回验收

## 基线

- [英文外观页点击正文空白之后](baseline-en-appearance-blank-before.png)
- [按下 Escape 后仍留在设置](baseline-en-escape-after-blank.png)
- [空设置搜索框的真实焦点](baseline-en-empty-search-focused.png)
- [从空设置搜索按 Escape 可返回原工作区](baseline-en-escape-from-search-workspace.png)
- [正常栏宽的中文通用页点空白后也无法用 Escape 返回](baseline-zh-escape-after-blank.png)
- [中文返回应用按钮能恢复原项目](baseline-zh-back-button-workspace.png)

本人操作 `40280/ui/` 的真实页面并逐图核对，页面视口为 1280×800，加载 `main-DY5usv8j.js`。真实项目接口确认工作区为隔离项目 `workspace-review`。

## 候选

- [英文外观页点击与基线相同的背景](candidate-en-appearance-blank-before.png)
- [Escape 恢复同一项目、草稿和设置触发点焦点](candidate-en-escape-restored-draft.png)
- [Enter 从侧栏重新打开设置并聚焦搜索](candidate-en-keyboard-reopen.png)
- [带查询搜索先清空并维持焦点和设置](candidate-en-search-cleared.png)
- [真实主题列表和原已选主题](candidate-en-theme-open.png)
- [第一次 Escape 收起列表并恢复主题触发点](candidate-en-theme-dismissed.png)
- [中文视图菜单按键后关闭，焦点和设置各归原处](candidate-zh-titlebar-escape.png)
- [点击中文设置背景后，Tab 直接到可见返回按钮](candidate-zh-tab-to-back.png)
- [中文通用区点击与基线相同的背景](candidate-zh-general-blank-before.png)
- [Escape 返回实际项目并保留未发送草稿](candidate-zh-escape-restored-draft.png)
- [原返回按钮也能恢复项目与草稿](candidate-zh-back-button-workspace.png)

本人操作 `40282/ui/` 的真实页面并逐图核对，页面视口同为 1280×800，加载 `main-bDZAXbRQ.js`。候选草稿仅用于隔离验收，结束前已清空。
