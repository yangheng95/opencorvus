# 待发送附件生命周期实际证据

对应[调查](../../records/2026-10/2026-10-28-draft-attachment-lifecycle.md)。独立开发/ui真实操作，三张原始JPEG均人工查看。

- [01](01-live-pending-two-files.jpg)：真实文件选择后的PDF/JPEG、文件身份与草稿。
- [02](02-parallel-control-after-save.jpg)：原真实400后菜单5而滑块4；进入769修复。
- [03](03-pdf-retained-after-settings-and-rejected-save.jpg)：Settings往返、停留和失败保存后首次打开PDF。

早期生产日志记录AttachmentStore.sweep在13:07:38.890Z回收两个历史未提交拷贝，158703字节，符合实际保留旧mtime的复制实验。真实重新上传后PDF能正常首次读取并下载111015字节原件。768没有认证请求，没有修改GC或schema；成功配置保存的补充验证属于[769新旅程](../2026-10-28-run-control-save-journey/README.md)。

[运行结算](runtime.json)与[数据复核](data.json)记录真实对象，不能替代页面截图。源库保持，92表102427行相等，schema9。只验证记录所列旅程，不宣称跨会话/项目附件持久化。
