# 全图读取与原位恢复证据

对应[方案与结果](../../records/2026-11/2026-11-08-image-preview-read-owner.md)。复用[自有PNG](../2026-11-08-media-preview-retry/media-recovery.png)与[自有SVG](../2026-11-08-image-download-feedback/original-preview.svg)，零消息/零模型请求。

- 01/02/03：有效缩略图、暂存原件后首次全图点击仍在首页、恢复后旧路径可正常打开。before-open-log.jsonl确认该点击真实404及同ID的旧日志。
- 04/05：after立即打开同Host的稳定错误与英文详情；06/07：中文浅色和内部滚动到原Not found响应。after-repeated-failure.json记录键盘重试仍失败时的新编号与焦点。
- 08：保持原窗口恢复PNG并用Retry成功，真实794×1123，焦点回Header Download。09/10：实际拖动与50%缩放；11：Escape回原缩略图；12：SVG全图正常640×320。
- before-restored.json、after-restored.json、after-png-download.json、after-svg-download.json记录实际原URL/原件下载字节；两次PNG暂存均归位。after-retry-success.json、after-escape-focus.json、after-svg-loaded.json及after-pan.json是实际交互后的只读观测，不是UI自动化测试。

12截图均来自真实开发/ui桌面1280×720页面并已人工查看。31项/105断言为纯服务正向合同，编译/语言/构建不替代视觉。图库无真实记录故只做源码审计；原生解码失败及实页权限轮换未覆盖，不外推。本人服务、标签和下载已结清。
