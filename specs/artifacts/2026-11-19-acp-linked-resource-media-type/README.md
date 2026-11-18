# ACP 资源链接媒体类型的 Windows 验收

## 基线 `d55713e8c`

- [链接物化失败后的实际空会话](baseline-web-session.png)
- [真实资源链接、成功图片对照和公开消息](baseline-runtime.json) · [两个实际请求的二进制读取错误](baseline-errors.json)

截图来自隔离开发页面，已人工复核。

## 候选

- [真实对话中的图片及回复](candidate-web-reply.png) · [原图预览及明确名称](candidate-web-image-preview.png)
- [原生协议、公开历史、规范原件及重载](candidate-runtime.json) · [实际模型图像输入](model-image-inputs.json) · [真实浏览器请求和下载](candidate-web.json)

候选截图已逐张人工复核。浏览器下载 `Inspection capture.png` 的 100 字节与无扩展名原文件逐字节一致，回放图像使用持久用户消息身份。
