# 项目文件原件下载

605使用真实开发CLI的/ui人工交互与截图复核；没有UI自动化测试。

- `01-zip-before.png`：当前压缩包仅显示不可编辑。
- `02-zip-download-en.png`：英文原件下载入口，实际保存中文文件名。
- `03-original-download-error.png`、`04-error-detail-bottom.png`：实际404，完整原始诊断可滚动。
- `05-download-error-zh.png`：同一错误切换语言后立即显示中文。
- `06-recovered-download-zh.png`：恢复原件后，原页面直接重试成功。
- `07-text-draft-retained.png`：文本仍导出当前未保存草稿。
- `08-final-protocol-download.png`：最终二进制协议再次真实页面下载。

[实际浏览器下载的ZIP](downloaded-original.zip)共259字节，与源原件完全一致。标准ZIP reader已打开其中“交付记录.txt”，内容与原113字节文本一致。PDF原件与当前草稿下载也逐字节通过。四个自有服务和三个自有标签全部关闭；22个不同后端正向用例、默认SDK对ZIP/TXT/JSON/空文件的真实HTTP及OpenAPI证据见[evidence.json](evidence.json)，完整范围与限制见[规格](../../records/2026-10/2026-10-26-binary-file-download.md)。
