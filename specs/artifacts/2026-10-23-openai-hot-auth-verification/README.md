# OpenCorvus 热认证实际请求证据

[方案与结果](../../records/2026-10/2026-10-23-openai-hot-auth-verification.md) · [非秘密资格与原终态](evidence.json)

- 来源是用户刚在OpenCorvus保存的OpenAI OAuth完整条目与相邻完整模型目录，没有Codex转换。
- 正式聊天接口创建真实隔离Chat，持久化助手回复为`OK`。两次实际请求均为gpt-6.1-sol、流式HTTP200，原reader正常EOF。
- 公开shutdown200，原exec63762/native/launcher均exit0，物理、输出、request与精确出生结清；四份临时auth/models退休，原来源保持。
- 固定上限4，实际2。未启动浏览器、业务Goal、Task或Mission，不提供新UI或跨轮执行资格；542失败记录保持。
- evidence只含选取的非秘密事实与工具更正说明；实际凭据值扫描匹配0，不包含完整请求、凭据或数据库。
