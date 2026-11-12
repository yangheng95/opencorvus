# 新增 MCP 表单的真实桌面与回执

本人在隔离有头 Chrome 中通过真实指针和键盘操作开发服务的 `/ui/`，人工查看截图。透传只延迟向桌面交付的完整响应。项目定义及本地 MCP（Model Context Protocol，模型上下文协议）连接由实际应用和标准输入输出协议进程执行。

## 基线

- [提交按钮焦点](02-baseline-mcp-submit-focused.png)
- [第一份已发出，提交按钮失焦](03-baseline-mcp-pending.png)
- [仍在等回执时的第二份草稿](04-baseline-mcp-edited-during-save.png)
- [收到完整回执后表单关闭](05-baseline-mcp-draft-erased.png)
- [重新打开，第二份草稿已丢失](06-baseline-mcp-reopened-empty.png)
- [真实回执、两项目的状态及持久配置](baseline-first-mcp-draft-evidence.json)

## 最终构建

- [第一份提交前的键盘焦点](11-final-mcp-submit-focused.png)
- [重复回车后仍聚焦忙时按钮](12-final-mcp-pending-focus.png)
- [回执在途时编辑第二份](13-final-mcp-later-edit.png)
- [英文回执、焦点和保留的参数](14-final-mcp-later-draft-retained.png)
- [在同一表单切简体中文](15-final-mcp-later-draft-chinese.png)
- [明确提交第二份后的实际连接](16-final-mcp-second-submitted.png)
- [另一项目的连接回执在途](17-final-mcp-alternate-pending.png)
- [原项目新草稿在放行前](18-final-mcp-new-project-draft-before-receipt.png)
- [原项目新草稿在放行后](19-final-mcp-new-project-draft-after-receipt.png)
- [另一项目自己的连接状态](20-final-mcp-alternate-persisted.png)
- [首条确认时的正式状态和配置](final-first-mcp-draft-evidence.json)
- [四笔真实回执及两项目最终状态、配置和进程](final-complete-mcp-draft-evidence.json)
- [隔离数据库及任务、模型活动核对](final-storage-evidence.json)
- [隔离服务关停回执](final-stopped.json)
