# 按发布媒体显示图片验收

第 325 批，2026-11-19，本人独立调查。见[根因、影响及实施前规格](../../records/2026-11/2026-11-19-attachment-image-display.md)。仅隔离本机流式参与者，不使用外部模型、凭据或子 agent。

- [真实公开上传、原件及派生输出、真实会话](baseline-runtime.json)
- [本人所见：三个正常缩略图](baseline-three-thumbnails.png)
- [本人所见：SVG `.dat` 完整预览失败](baseline-svg-dat-full-failed.png)
- [本人所见：SVG `.png` 完整预览失败](baseline-svg-png-full-failed.png)

原字节/媒体回执正确，两个服务端图像规格均实际 200 且可解码，前两件的完整预览因后缀选择原件而失败。实际对话正常 stop，基线服务正常退出 0。候选尚未实施和验收。
