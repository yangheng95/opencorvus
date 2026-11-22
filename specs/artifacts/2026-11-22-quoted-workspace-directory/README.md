# 浏览器目录输入的双引号验收

2026-11-22 独立 OpenCorvus 开发服务，使用本批创建的 `quoted folder` 项目。

| 基线场景 | 人工观察 |
| --- | --- |
| [双引号输入错误](baseline-quoted-rejected.jpg) | 同一存在目录被前端提示不是服务端绝对路径。 |
| [普通路径打开项目](baseline-plain-selected.jpg) | 去掉外层引号后实际进入目标。 |
| [实际目标文件树](baseline-plain-file-tree.jpg) | 右栏显示目标完整路径和该项目独有的文件。 |

| 候选场景 | 人工观察 |
| --- | --- |
| [带引号的文件输入](candidate-en-file-error.jpg) | 服务返回原「不是目录」提示，浏览器保留当前工作区和输入。 |
| [改为目录](candidate-en-quoted-input.jpg) | 修正路径后焦点仍在输入框，引号仍可见。 |
| [英文目标工作台](candidate-en-selected.jpg) | Enter 打开 `quoted folder`。 |
| [英文目标文件树](candidate-en-file-tree.jpg) | 目标完整路径与独有文件可见。 |
| [普通路径返回原项目](candidate-en-plain-return.jpg) | 使用项目列表入口及鼠标，恢复 `explorer-review` 文件树。 |
| [中文目录对话框](candidate-zh-quoted-input.jpg) | 保留完整双引号输入和中文操作。 |
| [中文目标文件树](candidate-zh-file-tree.jpg) | 鼠标确认后显示相同目标和独有文件。 |
| [中文目标文件正文](candidate-zh-note.jpg) | 打开预览即可看到实际文件的原始文字。 |

[打开前回执](candidate-before-workspace.json)和[打开后回执](candidate-after-workspace.json)记录真实目录检查、项目注册及独有文件读取。
