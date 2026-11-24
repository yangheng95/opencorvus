# 从文件标签跳行的桌面证据

基线为隔离 Windows 1280 × 720 桌面 `41620/ui/`，`main-BRLloceo.js`。

| 基线原图 | 观察 |
| --- | --- |
| [英文文件标签](baseline-en-file-tab-jump-keeps-tab-focus.jpg) | 真实 Ctrl+Alt+G 后，文件标签保持焦点，正文保持第 1 行。 |
| [英文工具栏](baseline-en-toolbar-opens-one-native-prompt.jpg) | 同一快捷键从工具栏打开一个原生跳行输入。 |
| [英文第 97 行](baseline-en-toolbar-actual-line-97.jpg) | 原生提交将准确的第 97 行带到视口。 |
| [中文文件标签](baseline-zh-file-tab-jump-has-no-prompt.jpg) | 在 160% 的已选文件标签同样不打开输入。 |
| [中文第 42 行](baseline-zh-toolbar-actual-line-42.jpg) | 原工具栏仍可按同一键跳到真实第 42 行。 |
| [中文 Markdown 预览](baseline-zh-markdown-file-tab-stays-in-preview.jpg) | 从文件标签按键后源码尚未打开。 |
| [中文 Markdown 源码](baseline-zh-markdown-source-heading-line-8.jpg) | 从正文同键成功高亮第 8 行的真实标题。 |

[实测焦点、当前内容与原生面板](baseline-desktop-focus.json)。
