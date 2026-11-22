# 不可预览文件的字节数实页截图

Windows 桌面浏览器连接专用本机开发页面。本人逐张查看原始截图。[方案与结果](../../records/2026-11/2026-11-23-binary-download-file-size.md)

| 原图 | 实际结果 |
| --- | --- |
| [01 普通二进制](01-baseline-binary-download-no-size.jpg) | 原件 4096 字节，画面只显示通用下载提示和已聚焦的唯一按钮。 |
| [02 零字节原件](02-baseline-empty-binary-same-hint.jpg) | 原件精确为零字节，画面与普通文件相同。 |
| [03 中文内容识别](03-baseline-zh-binary-content-no-size.jpg) | 非文本内容的只读下载提示与按钮本地化，未呈现五字节。 |
