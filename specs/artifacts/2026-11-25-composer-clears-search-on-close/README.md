# 主输入区模型选择器重开证据

## 基线

- [键盘选择后旧搜索仍生效](baseline-reopen-after-keyboard-selection.png)，[鼠标选择后旧搜索仍生效](baseline-reopen-after-mouse-selection.png)。
- [服务商设置返回后只显示旧结果](baseline-reopen-after-provider-settings.png)，[点击模型按钮关闭后会恢复全部模型](baseline-reopen-after-trigger-dismissal.png)。
- [交互前的配置](baseline-initial-selection.json)、[交互后的配置](baseline-persisted-selection.json)、[真实会话的消息计数](baseline-empty-conversation.json)。

## 修复后

- [键盘选择后显示三条模型](candidate-reopen-after-keyboard-selection.png)，[鼠标选择后显示三条模型](candidate-reopen-after-mouse-selection.png)。
- [从服务商设置返回显示三条模型](candidate-reopen-after-provider-settings.png)，[点击模型按钮关闭后显示三条模型](candidate-reopen-after-trigger-dismissal.png)。
- [初始读取](candidate-initial-selection.json)、[键盘选择回执](candidate-keyboard-selection.json)、[鼠标选择并返回设置后的回执](candidate-mouse-selection.json)和[消息及模型请求计数](candidate-no-inference.json)。
