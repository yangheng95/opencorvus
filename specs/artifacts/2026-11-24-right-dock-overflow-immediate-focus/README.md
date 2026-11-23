# 溢出菜单切换和紧接查找的真实桌面截图

隔离的 OpenCorvus 开发服务 `/ui/`，真实保存文件变化和真实磁盘文件。原始浏览器截图为 1280×720。

| 简体中文 160% 基线 | 原始截图 |
| --- | --- |
| 鼠标选资源管理器后紧接 Ctrl+F，实际打开会话查找 | [截图](baseline-zh-pointer-then-find.jpg) |
| 等待真实资源管理器标签获焦后的正确文件查找 | [截图](baseline-zh-find-after-focus-observed.jpg) |
| 鼠标暂切到已保存的文本文件后紧接 Ctrl+F，仍打开会话查找 | [截图](baseline-zh-pointer-then-file-find.jpg) |

| 最终交互 | 原始截图 |
| --- | --- |
| 英文回车打开审阅，鼠标切换后立即在文件中查找 | [审阅焦点](candidate-en-keyboard-review-focus.jpg) · [直接查找文本](candidate-en-pointer-then-file-find.jpg) |
| 中文 160% 鼠标切换后即时定位搜索或正文查找 | [资源管理器搜索](candidate-zh-pointer-then-explorer-find.jpg) · [实搜结果](candidate-zh-actual-explorer-result.jpg) · [文件正文](candidate-zh-pointer-then-file-find.jpg) |
| 中文 Escape 取消、回车切换及读取第 84 项 | [取消归焦](candidate-zh-escape-returns-to-overflow.jpg) · [键盘查找](candidate-zh-keyboard-explorer-find.jpg) · [磁盘正文](candidate-zh-real-file-084.jpg) |
| 中文从中心显式查找，关闭文件后回到审阅标签 | [会话查找](candidate-zh-conversation-focus-finds-conversation.jpg) · [关闭后归焦](candidate-zh-close-returns-to-review.jpg) |
