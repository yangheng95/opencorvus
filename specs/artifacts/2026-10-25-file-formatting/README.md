# 文件格式化与最终保存事实

对应[实施记录](../../records/2026-10/2026-10-25-file-formatting.md)。601使用独立新项目、独立数据库和开发CLI的`http://localhost:54109/ui/`；普通Node生产UI与600相同，前端源码未改。本轮没有模型调用、凭据复制或合成消息。通过公开Session API建立空Work Chat，仅为打开实际文件工作区；不是模型端到端验收。

- [01-draft.png](01-draft.png)：真实编辑器输入`const x={a:1}`，出现未保存标记。
- [02-first-save.png](02-first-save.png)：第一次保存后正文实际格式化为`const x = { a: 1 }`，草稿标记清除。
- [03-second-save.png](03-second-save.png)：同一编辑器继续编辑、第二次保存成功，正文为`const next = { b: 2 }`。
- [evidence.json](evidence.json)：真实格式化前后probe、聚焦后端检查、页面操作、最终HTTP正文及原服务结清证据。

以上截图由本agent逐张人工查看，1280×720原始页面截图未裁切/编辑，不是截图测试或像素断言。文件正文与控件完整可见；该页空Chat没有模型消息，不能用于评估对话正文密度。UI截图不能替代后端与跨进程证据，后端测试也不能替代本次实际页面交互。
