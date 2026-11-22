# 设置搜索保留页的桌面验收

2026-11-22 人工操作隔离 OpenCorvus 开发服务和桌面浏览器。项目路径为专用的 `settings-review`，页面通过 `/ui/` 进入。截图为浏览器原始画面。

| 基线画面 | 观察 |
| --- | --- |
| [搜索 proxy](baseline-en-proxy.jpg) | General 和实际命中的 Network 都在 Application 分组，General 只有原选中状态。 |
| [按下方向键](baseline-en-keyboard-target.jpg) | 焦点直接到 Network，右侧仍为 General。 |
| [无匹配](baseline-en-no-matches.jpg) | 无匹配消息下面仍显示 Network，行内没有解释。 |
