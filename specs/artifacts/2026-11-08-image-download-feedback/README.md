# 图片原件下载失败反馈证据

对应[方案与结果](../../records/2026-11/2026-11-08-image-download-feedback.md)。使用自有隔离项目和SVG，不使用用户附件、消息或凭据。

- 01/02：真实可读全图、原件暂存后点击Download的原页面。before-server-download.jsonl中同request ID的实际404与overlay:ui日志确认动作已执行；browser-errors为空不作为失败根因。
- 03/04/05：英文失败、完整原诊断、持续失败后更新及实际50%缩放。after-repeated-failure.json记录真实键盘重试后的焦点与新request ID。
- 06/07：第二图身份和重开原图的真实正常呈现；08/09：中文浅色失败、详细信息及键盘可达。
- 10/11：恢复精确原件后同窗口Retry真实下载成功、焦点交回Header Download，再Escape返回原缩略图。
- after-restored.json和after-download-receipt.json记录原GET200、567原SVG字节、sidecar保持和下载完整字节一致。after-success-focus.json和after-escape-focus.json是实际交互后的只读观察，不是UI自动化测试。

全部11截图来自真实开发/ui桌面1280×720页面并已人工查看。after-server-download.jsonl保留相关实际请求；本人服务、标签和暂存均已结清。未覆盖全图预载失败、原生桌面宿主或并发权限轮换，不将代码核对/服务夹具冒称这些实页验收。
