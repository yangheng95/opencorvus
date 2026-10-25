# 当前产品完整操作体验

604使用独立开发CLI的/ui真实页面；截图逐张人工查看，没有UI自动化测试。Goal的命令/加号入口保持既定设计。

- `01-home-baseline.png`：当前首页真实基线。
- `02-pdf-before.png`：原PDF可预览，文件头缺少下载动作。
- `03-pdf-download.png`：修后PDF原件直接下载，窄Dock可操作。
- `04-image-download-zh.png`：中文图片预览及下载。
- `05-text-draft-download-zh.png`：当前未保存草稿仍可下载。

PDF/PNG/干净文本实际下载与原文件逐字节一致；草稿实际下载等于原文本加当时输入，原磁盘文件仍113字节。两个服务、原调用和自有标签全部结清。详见[evidence.json](evidence.json)及[调查方案](../../records/2026-10/2026-10-26-current-product-experience.md)。未知二进制没有完整载荷时仍不提供下载，需另行设计原始文件合同。
