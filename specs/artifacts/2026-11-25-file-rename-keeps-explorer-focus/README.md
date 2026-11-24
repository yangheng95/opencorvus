# 重命名已打开文件的桌面证据

基线由实际隔离服务提供 `main-0X-FWmIt.js`。同一临时 Git 项目中两个空白会话使用真实资源管理器与文件编辑器。屏幕截图由本人复核。

| 实际操作 | 可见状态 |
| --- | --- |
| [大小写改名发起页](baseline-operator-renamed.jpg) | 资源管理器内提交后，已开编辑器被意外选中。路径确为 `notes/Checklist.txt`。 |
| [同伴重新打开新拼写](baseline-observer-reopened-exact-spelling.jpg) | 旧大小写路径仍可打开所在目录，从实际新行重开后显示新拼写和原正文。 |
| [对已打开的文件作普通改名](baseline-existing-editor-rename-shifts-tab.jpg) | 改名成功，原 Explorer 操作被切到编辑器并取得文本焦点。 |
| [对未打开的对照做普通改名](baseline-unopened-file-rename-keeps-focus.jpg) | 显示原成功回执，准确新行被选中并持焦。 |

[真实接口和磁盘证据](baseline-file-receipt.json)记录两份正文、确切目录项目、原始读取请求和实际 Git 状态。原文件内容与对照文件分别属于其真实新路径。没有删除文件或请求模型。

## 候选验收证据

| 实际操作 | 桌面观察 |
| --- | --- |
| 已打开文件只改大小写 | [仍在 Explorer，命中新行](verified-case-only-stays-in-explorer.jpg)，方向键移到兄弟后返回，用 [Enter 显式打开实际路径](verified-case-only-explicit-open.jpg)。 |
| 草稿存在时在文件树提交改名 | [原先的未保存确认](verified-rename-draft-decision.jpg)及[取消后保留原草稿](verified-cancel-retains-draft.jpg)。 |
| 保存原草稿并继续改名 | [原始忙碌诊断](verified-saved-rename-original-diagnostic.jpg)及[原表单重试成功保持树焦点](verified-saved-rename-stays-in-explorer.jpg)。第一次保存已提交，第一次改名未到达服务。 |
| 已打开子文件的父目录实际改名 | [选中且聚焦准确新目录](verified-parent-rename-keeps-explorer.jpg)及[显式切到编辑器后读回新路径与保存的正文](verified-editor-retargeted-to-child.jpg)。 |

[真实传输](verified-transport.jsonl)记录正式读取、大小写改名、保存与重试、父目录改名各自的状态及请求身份。[最终文件回执](verified-file-receipt.json)对照两份原文、真实路径及 Git 工作树。[隔离数据库读出](verified-isolation.json)确认会话及模型活动计数。
