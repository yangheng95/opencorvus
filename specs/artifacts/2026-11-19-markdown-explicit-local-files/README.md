# Markdown 显式相对文件链接证据

## 基线

- [指南的三个相对链接](baseline-guide-file-links.png)
- [文件树打开实际压缩包](baseline-archive-from-tree.png)及[点击同一归档链接时的接口错误](baseline-archive-route-error.png)
- [文件树打开许可证纯文本](baseline-license-from-tree.png)及[点击同一许可证链接时的接口错误](baseline-license-route-error.png)
- [点击普通 Markdown 链接后仍在文件工作台](baseline-reference-link.png)

上述截图来自隔离 Windows Chrome 实际操作，已经人工查看。服务端点 `40244` 对两个浏览器错误地址均返回 400 `DirectoryRequiredError`；有明确目录的压缩包、许可证及 Markdown 文件读取均是 200。原件下载返回 200，`Content-Disposition` 为 `attachment; filename*=UTF-8''release%20bundle.zip`。实际下载的 174 字节与磁盘归档逐字节相同，其中包含 `review.txt`。
