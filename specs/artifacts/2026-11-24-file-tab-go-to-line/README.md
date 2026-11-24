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
| [中文非文本文件](baseline-zh-binary-file-tab-available-actions.jpg) | 8 字节原文件可下载。 |

[实测焦点、当前内容与原生面板](baseline-desktop-focus.json)、[真实文件读回](baseline-file-proof.json)。

最终实际候选 `41622/ui/` 加载 `main-Bu_7pUpj.js`。下列截图均已本人复核。

| 最终构建 | 观察 |
| --- | --- |
| [英文文件标签打开唯一提示](candidate-en-file-tab-opens-one-prompt.jpg) | 重复快捷键仍只有一个原生输入，保存已输入的 97。 |
| [英文实际第 97 行](candidate-en-file-tab-actual-line-97.jpg) | 提交后正确源文件行有键盘焦点。 |
| [英文原文件查找](candidate-en-existing-file-find-reaches-line-124.jpg) | Ctrl+F 仍能匹配第 124 行实际文本。 |
| [中文原 Markdown 预览](candidate-zh-workshop-starts-in-preview.jpg) | 标签快捷键前显示同一实际文档的预览。 |
| [中文格式校验](candidate-zh-markdown-preserves-invalid-line-input.jpg) | 从文件标签打开原生输入，提交 `8:` 后值、格式提示及焦点保留。 |
| [中文实际 Markdown 第 8 行](candidate-zh-file-tab-reaches-source-heading-8.jpg) | 源文件实际 `## Shipping labels` 高亮。 |
| [中文 8 字节原文件](candidate-zh-binary-retains-download-only.jpg) | 非文本文件提供下载及只读状态。 |
| [中文切回文本后第 42 行](candidate-zh-returned-text-file-jumps-to-line-42.jpg) | 实际导航使用当前文本文件及准确行号。 |

[按键及当前原生面板](candidate-desktop-focus.json)、[最终真实文件读回](candidate-file-proof.json)。两组服务的实际原始文件和数据库读回一致。
