# Unicode 空白下载边界证据

对应[方案与结果](../../records/2026-11/2026-11-08-download-filename-whitespace.md)。

- [真实前态文件页](01-before-original-file.jpg)：首NBSP独立文件，原正文IDENTITY_LEADING_NBSP；已人工查看。
- [真实前态下载](before-download.json)：实际落盘report.txt，首NBSP丢失，正文仍为该独立文件。

- [未通过的第一版实页](02-after-leading-nbsp.jpg)：原正文正确，实际下载却是_report.txt；不是最终修复证据。
- [两种真实下载结果](attempted-download.json)：Blob下载和完整Unicode Content-Disposition原件响应均被实际浏览器改名，原正文保持。

第一版43项纯数据测试通过，但真实下载否证原名保留方案；相关helper、候选测试和架构改动已精确撤回。恢复后的原32项/36次断言通过，本批仅交付调查结论，不声称修复。完整原名落盘及伴随引用对齐仍未达成。

全新隔离profile，无凭据/模型调用。两个本人服务正常shutdown200、原启动句柄退出0；只移动本次事件和原正文确认的三个自有下载到私有临时目录。
