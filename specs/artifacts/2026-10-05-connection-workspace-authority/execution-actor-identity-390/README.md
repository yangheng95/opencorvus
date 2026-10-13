# 390 执行轮次身份

[Recall、共享影响分析与方案](../execution-actor-identity-plan-390.md) · [月度记录](../../../records/2026-10/2026-10-13-execution-actor-identity-390.md)

实际输入身份现在同时用于消息、生命周期和Task执行读取，修复work成员被assistant容器类型覆盖。修前4项失败，最终身份/Task正向检查9项通过，相关会话/Mission另外17项通过。首次扩展测试漏用完整生产投影的失败及首次配置类型检查失败均原样保留。

- [01 读取中](01-streaming.png)：正式UI，工具完成后紧凑Sources入口出现。
- [02 未刷新最终dock](02-final-live.png)：成员最终正文和Sources完整可见。
- [03 未刷新父进展](03-preview-live.png)：父进展已经包含最终正文，与成员dock一致。
- [04 真实来源定位](04-source-range.png)：文件第2—3行被选中。
- [05 刷新重开](05-reopened.png)：来源和最终正文保留；父进展多出英文交接输入，作为下一轮独立问题保留。
- [运行核验](runtime-review.json)：实际Message、Tool、Source、HTTP/SSE、7次Sol流式请求及Native闭合。
- `checks/` 保存完整脱敏原日志、原失败、运行脚本、公共投影和协议回放；压缩后逐字节还原比对仅检查归档完整性，不作为功能验收。

界面只用实际交互、截图、人工复核。没有UI自动化、截图断言或模拟业务事件。当前后端配389-final正式UI，单个session-local成员为被测产品功能，没有开发子agent。用户原Research Studio长历史不在此次有界验收中。
