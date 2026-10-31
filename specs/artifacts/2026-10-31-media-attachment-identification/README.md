# 音视频附件辨识实测证据

对应[实施前方案与Recall](../../records/2026-10/2026-10-31-media-attachment-identification.md)。仅收录本轮真实页面截图和脱敏验证回执，不收录凭据、私有模型目录或伪造消息。

26张均为真实开发页面交互后截图，已逐张人工查看；没有UI自动化断言或截图差异测试。

- 01—06：修复前选择入口、六真实草稿附件、实际音视频播放及原图预览。未发送的草稿不是持久消息。
- 07—12：真实发送六FilePart、两个completed图片读取、正确图片Sources；10复现四播放器缺少可见文件名。
- [13](13-final-image-labels.png)、[14](14-final-visible-media-names.png)、[15](15-final-labeled-players.png)、[17](17-final-audio-labels.png)：最终历史图片及播放器的真实视口；15显示视频名，17显示两音频名及第二视频名。
- [16](16-final-red-video-playing.png)、[18](18-final-first-audio-playing.png)、[19](19-final-second-audio-playing.png)、[20](20-final-blue-video.png)、[21](21-final-blue-video-playing.png)：四个原生播放器实际播放。只覆盖本次WAV和H.264 MP4。
- [22](22-final-first-original-image.png)、[23](23-final-second-original-image.png)：同名两图片实际预览；分别点击下载，原名保持capture.png。
- [24](24-final-chinese-media.png)、[25](25-final-reopened-image-source.png)、[26](26-final-reopened-labeled-media.png)：中文、重开后Sources及持久媒体标签。
- [verification.json](verification.json)：三scope的实际请求、数据保护、退出与六份浏览器下载原件匹配结果。最终只读复核零新请求，整批八请求均为gpt-6.1-sol流式。

原文件内容、认证副本、完整数据库及详细请求记录仅留自有私有验证目录；未把它们写入此产物或提交。音视频只验播放与元数据，不宣称模型解码。
