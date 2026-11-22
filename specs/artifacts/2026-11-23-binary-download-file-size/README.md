# 不可预览文件的字节数实页截图

Windows 桌面浏览器连接专用本机开发页面。本人逐张查看原始截图。[方案与结果](../../records/2026-11/2026-11-23-binary-download-file-size.md)

| 原图 | 实际结果 |
| --- | --- |
| [01 普通二进制](01-baseline-binary-download-no-size.jpg) | 原件 4096 字节，画面只显示通用下载提示和已聚焦的唯一按钮。 |
| [02 零字节原件](02-baseline-empty-binary-same-hint.jpg) | 原件精确为零字节，画面与普通文件相同。 |
| [03 中文内容识别](03-baseline-zh-binary-content-no-size.jpg) | 非文本内容的只读下载提示与按钮本地化，未呈现五字节。 |
| [04 英文 4096 字节](04-candidate-en-exact-binary-size.jpg) | 常规二进制显示 `4,096 bytes`，原下载按钮取得焦点。 |
| [05 英文零字节](05-candidate-en-zero-byte-size.jpg) | 空二进制显示 `0 bytes`。 |
| [06 中文零字节](06-candidate-zh-locale-updates-zero-size.jpg) | 切换语言后同一文件的单位即时变为「字节」。 |
| [07 中文五字节](07-candidate-zh-detected-binary-size.jpg) | 内容识别为二进制的原文件显示「5字节」并聚焦下载。 |
| [08 普通文本](08-candidate-zh-editable-text-regression.jpg) | 切到有效源文本后，可编辑正文和原焦点正确。 |
| [09 回到初始文件](09-candidate-zh-reopen-large-binary.jpg) | 重新打开常规二进制，正确显示「4,096字节」。 |
