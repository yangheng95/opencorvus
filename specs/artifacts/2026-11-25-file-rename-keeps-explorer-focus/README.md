# 重命名已打开文件的桌面证据

基线由实际隔离服务提供 `main-0X-FWmIt.js`。同一临时 Git 项目中两个空白会话使用真实资源管理器与文件编辑器。屏幕截图由本人复核。

| 实际操作 | 可见状态 |
| --- | --- |
| [大小写改名发起页](baseline-operator-renamed.jpg) | 资源管理器内提交后，已开编辑器被意外选中。路径确为 `notes/Checklist.txt`。 |
| [同伴重新打开新拼写](baseline-observer-reopened-exact-spelling.jpg) | 旧大小写路径仍可打开所在目录，从实际新行重开后显示新拼写和原正文。 |
| [对已打开的文件作普通改名](baseline-existing-editor-rename-shifts-tab.jpg) | 改名成功，原 Explorer 操作被切到编辑器并取得文本焦点。 |
| [对未打开的对照做普通改名](baseline-unopened-file-rename-keeps-focus.jpg) | 显示原成功回执，准确新行被选中并持焦。 |

[真实接口和磁盘证据](baseline-file-receipt.json)记录两份正文、确切目录项目、原始读取请求和实际 Git 状态。原文件内容与对照文件分别属于其真实新路径。没有删除文件或请求模型。
