# 附件明确媒体类型的桌面验收

第 322 批，2026-11-19，本人独立完成。见[根因、影响与方案](../../records/2026-11/2026-11-19-file-part-declared-media-type.md)。使用隔离本机流式参与者，不代表外部模型验收。

- [五份真实规范原件、实际输入与正常结束的公开历史](baseline-runtime.json)
- [本人所见错误图片、音频预览及正常 PNG 对照](baseline-declared-types.png)
- [本人展开文本后所见 PDF 读取错误](baseline-pdf-type-error.png)

三份原始文本各 70 字节，通用二进制为 5 字节，PNG 为 100 字节；五份公开下载均 200 且与源文件一致。原名后缀不能替代明确类型。首次隔离工具编码及非规范输入错误另见规格记录，不混入本缺陷证据。

候选实际验收：

- [候选规范原件、真实消息和正常完成](candidate-runtime.json)
- [五次浏览器下载的原名、字节数和源字节核对](browser-downloads.json)
- [完整候选布局与正确的二进制下载入口](candidate-declared-types.png)
- [PNG 原名的文本正文](candidate-png-named-text.png)
- [MP3 原名的文本正文](candidate-mp3-named-text.png)
- [PDF 原名的文本正文](candidate-pdf-named-text.png)
- [真实 PNG 对照的全图与 100% 原尺寸](candidate-real-png-preview.png)
- [通过真实菜单切换后的中文正文及下载](candidate-text-zh.png)
- [重开页面后中文历史的实际文本读取](candidate-reopened-text-zh.png)
- [基线只读持久事实，包含已明确记录的首次工具输入错误](baseline-persistence.json)
- [候选正常退出后的只读持久事实](candidate-persistence.json)
- [真实模型流式请求及完成记录](model-stream-events.json)
- [验收汇总](final-summary.json)

七张候选截图由本人逐张查看。三份文本各 70 字节，二进制 5 字节，PNG 100 字节，五次真实下载均保持原名且与源字节一致。前端类型、两个语言、样式、构建、渲染器表面、文档和架构索引检查通过；未运行或新增 UI 自动化。所有自有服务和专用浏览器已正常退出，无外部模型或凭据调用。
