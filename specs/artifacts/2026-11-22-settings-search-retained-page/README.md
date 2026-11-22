# 设置搜索保留页的桌面验收

2026-11-22 人工操作隔离 OpenCorvus 开发服务和桌面浏览器。项目路径为专用的 `settings-review`，页面通过 `/ui/` 进入。截图为浏览器原始画面。

| 基线画面 | 观察 |
| --- | --- |
| [搜索 proxy](baseline-en-proxy.jpg) | General 和实际命中的 Network 都在 Application 分组，General 只有原选中状态。 |
| [按下方向键](baseline-en-keyboard-target.jpg) | 焦点直接到 Network，右侧仍为 General。 |
| [无匹配](baseline-en-no-matches.jpg) | 无匹配消息下面仍显示 Network，行内没有解释。 |

| 候选画面 | 人工复核结果 |
| --- | --- |
| [英文当前页](candidate-en-retained.jpg) | General 行标明 Outside search results，Network 为常规结果。 |
| [英文方向键](candidate-en-keyboard-focus.jpg) | ↓ 给 Network 焦点，右侧仍为 General。 |
| [英文打开匹配](candidate-en-matched.jpg) | Enter 打开 Network，已匹配的当前行保留常规选中样式。 |
| [英文零结果](candidate-en-no-matches.jpg) | 无匹配信息可见，↑ 留在搜索框，Network 仍打开。 |
| [英文清空](candidate-en-cleared.jpg) | Escape 恢复完整分组及搜索焦点，Network 仍打开。 |
| [最窄侧栏中的 About](candidate-en-narrow-about.jpg) | 产品信息选项也显示说明，两行文字完整可见。 |
| [中文当前页](candidate-zh-retained.jpg) | 「外观」保留并显示「不在搜索结果中」。 |
| [中文方向键](candidate-zh-keyboard-focus.jpg) | ↑ 给「网络」焦点，右侧仍为「外观」。 |
| [中文打开匹配](candidate-zh-matched.jpg) | 鼠标点击「网络」打开该页，匹配行保持常规选中样式。 |
| [中文清空](candidate-zh-cleared.jpg) | 清除按钮恢复完整分组和输入焦点，「网络」仍打开。 |
