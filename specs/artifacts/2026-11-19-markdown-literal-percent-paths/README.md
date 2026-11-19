# Markdown 路径中原样百分号的桌面证据

- `markdown-preview.png`、`binary-download-entry.png` 对应真实读取和下载对照。
- `baseline-literal-percent-error.png` 和 `baseline-uri-malformed.png` 显示编码图片成功、字面百分号图片在翻译路径时收到具名解码错误。
- `baseline-escaped-literal-23.png` 显示现有 `%2523` 在项目中打开字面 `%23` 文件。
- `baseline-raw-link-source.png`、`baseline-raw-link-forbidden.png` 和 `baseline-link-navigation.jsonl` 分别记录点击入口、真实 403 页面和相同请求的代理结果。
- `baseline-primary-file-reads.json` 核对三份目标文件确实可通过公开文件读取返回原文或精确原字节。

[根因及验收规格](../../records/2026-11/2026-11-19-markdown-literal-percent-paths.md)
