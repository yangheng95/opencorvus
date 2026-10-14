# Sources阅读迭代证据

[Recall、修改前分析、实际结果及边界](../../records/2026-10/2026-10-14-sources-reading-iteration.md)。全程一个开发agent；本轮生产改动是将既有URL的两行辅助caption规则共享给文件目录，完整Source身份/路径/行列数据保持。

before使用与当前Sources源码一致的420正式UI，after为本轮修改后的Node正式构建，均由真实开发服务/ui提供。相同真实Source、406.79px文字区域中，目录由3行/48.59px变2行/32.40px；观察尺寸仅辅助人工视觉，未运行UI自动化测试。

| 原图 | 真实操作与结果 |
| --- | --- |
| [01](before/01-collapsed.jpg) | 生产search_code实际生成两个来源，默认宽度折叠态 |
| [02](before/02-editor-source.jpg) | 第二来源实际打开文件，第3行高亮；完整Tooltip可读 |
| [03](before/03-narrow-expanded.jpg) | 文件工作区自然缩窄正文，目录占三行 |
| [04](after/04-narrow-expanded.jpg) | 修后同一来源与文件位置；Tooltip仍保留完整信息 |
| [05](after/05-narrow-clean.jpg) | 清晰窄正文，目录收敛两行，第二来源/正文保留 |
| [06](after/06-keyboard-expanded.jpg) | 底部收起后空格再次展开，原生焦点/第二来源保留 |
| [07](after/07-copy-feedback.jpg) | 实际复制出现check/Copied反馈；不作为完整粘贴验收 |

facts/final.json.gz只包含已有单主会话的canonical只读数据、真实消息/Tool/Source与原始输出。facts/material.json.gz是实际文件位置和内容，未伪造Source、消息或DOM。facts/provider-summary.json.gz与native最新审计保留7条实际Sol流，全部HTTP200/settled/eof；after只读复验同一已持久Source，不另发业务输入。当前数据库版本2，未清库或改schema。

各before/after native原件、launch/settle/shutdown脚本、公开shutdown及physical-terminal-and-pair-cleanup保留真实生命周期；两启动句柄均exit0，配对凭据在物理退场后退休，页面关闭。checks保存正式build（含原警告）、docs/architecture检查及归档脚本；不含auth/models、数据库或二进制。

**未完成项：完整剪贴板粘贴链。** 实际复制反馈成功，但工具的虚拟剪贴板没有收到页面内容，Control+V两接口均报无数据，readText也为空；产品菜单未暴露Paste。没有向虚拟剪贴板写入期望值伪造通过，也未用shell操作系统剪贴板。after/interaction-boundaries.json.gz明确是工具观察的人工转录，不是后端原始导出。URL来源未新做真实网页验收，其既有规则原样共享；本轮视觉结论限定文件Sources。
