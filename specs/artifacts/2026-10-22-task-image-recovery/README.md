# Task 图片处理与中断恢复证据

见[Recall、根因与验收](../../records/2026-10/2026-10-22-task-image-recovery.md)及[最小真实证据](evidence.json)。

修复：带已知epoch的snapshot0必须检查Task live retention floor。真实before漏旧终态；扩充纯后端测试4失败，修复后Bun1.4.0/1.4.3各8通过。after原0等待58534ms返回snapshot，实际SSE过期事件自然EOF，保留窗口内非空delta4752→5380，同正文Part3345→3731，两原Source保持。

两个既存原Task均自然完成，29/64次实际Sol流全部200/原EOF、目标API模型一致，Prompt owner归零；两个原服务正常shutdown/原exec exit0/物理输出请求结清，8份配对凭据退休。90表源原数据保持，目标正常记忆/恢复变化分别17/11项，不宣称目标原行完全不变。

12实图人工查看，7张精选：

- [before来源与原中断错误](before-source.png)
- [after实际流式正文](after-streaming-body.png)
- [after实际表格](after-table.png)
- [after两原来源](after-sources.png)
- [第二来源复制反馈](after-source-copy.png)
- [原两成员与Task完成](after-completed-members.png)
- [切换A后两arXiv来源](after-a-sources.png)

本次没有新Source追加；after原消息基线已终态，不冒称重新执行同一终态转换。手工帧未见Rendering反复占位，缺少连续owner观测，其他触发面仍开放。表格窄列折行和旧中断证据类型选择留待后续根因调查。不保留UI自动化测试、凭据、完整原始会话或模型请求输入。
