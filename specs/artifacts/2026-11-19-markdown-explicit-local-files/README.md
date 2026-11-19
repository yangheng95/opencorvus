# Markdown 显式相对文件链接证据

## 基线

- [指南的三个相对链接](baseline-guide-file-links.png)
- [文件树打开实际压缩包](baseline-archive-from-tree.png)及[点击同一归档链接时的接口错误](baseline-archive-route-error.png)
- [文件树打开许可证纯文本](baseline-license-from-tree.png)及[点击同一许可证链接时的接口错误](baseline-license-route-error.png)
- [点击普通 Markdown 链接后仍在文件工作台](baseline-reference-link.png)

上述截图来自隔离 Windows Chrome 实际操作，已经人工查看。服务端点 `40244` 对两个浏览器错误地址均返回 400 `DirectoryRequiredError`；有明确目录的压缩包、许可证及 Markdown 文件读取均是 200。原件下载返回 200，`Content-Disposition` 为 `attachment; filename*=UTF-8''release%20bundle.zip`。实际下载的 174 字节与磁盘归档逐字节相同，其中包含 `review.txt`。

## 候选

- [英文归档和下载入口](candidate-archive-link-en.png)、[英文许可证](candidate-license-link-en.png)、[英文 Markdown 参考](candidate-reference-link-en.png)
- [简体中文界面中的原指南](candidate-guide-links-zh.png)、[归档只读状态和下载](candidate-archive-link-zh.png)、[许可证正文和纯文本状态](candidate-license-link-zh.png)、[参考文件预览](candidate-reference-link-zh.png)

候选 `40246/ui/` 返回 `main-XdB3Fr2U.js`。六次实际导航都保留 `/ui/`，显示对应真实文件。两次浏览器下载来自各语言的同一中央操作，建议名称均为 `release bundle.zip`，各 174 字节逐字节等于同一隔离原件。两份归档均包含 `review.txt`，其内容为 `A genuine isolated archive for the Markdown file link.`。四份候选输入与各基线原件相同。启动进程 31272 与 19036 经各自正常退出接口应答 200 后以 0 退出，端口 `40244` 和 `40246` 均已关闭。
