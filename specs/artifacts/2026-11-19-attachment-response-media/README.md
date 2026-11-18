# 原件响应媒体验收

第 324 批，2026-11-19，本人独立调查。见[根因、影响和实施前方案](../../records/2026-11/2026-11-19-attachment-response-media.md)。使用隔离本机流式参与者，无外部模型或凭据，不使用子 agent。

- [九种原件实际上传、响应头、字节和真实对话](baseline-runtime.json)
- [本人所见的基线真实页面](baseline-chat-originals.png)
- [真实地址栏打开 PNG 导致下载，原生下载面板](baseline-native-download.png)
- [实际下载的原名、长度及原字节一致性](baseline-direct-download.json)

PNG `.dat` 收到通用二进制响应而实际下载；带编码文本、SVG、Office、二进制、空文本和 JSON 亦由原名后缀错误改变媒体。消息缩略图已经正确，不替代原件响应验收。

候选已从已验证发布回执生成响应，删除后缀媒体猜测，原件名、长度、字节及缓存合同继续。18 项聚焦检查、159 断言、5 文件通过，其中新 HTTP 正向矩阵 16 种组合各读两次；后端类型、353 操作/26 组文档、6 规则/36 文件路由、20 文档架构检查通过。

- [九种候选实际上传与响应头、字节及真实对话](candidate-runtime.json)
- [本人所见：展开的中英文原文](candidate-text-original.png)
- [本人所见：100% 原图预览](candidate-picture-preview.png)
- [真实地址栏直接打开 PNG，完整内联显示](candidate-direct-picture.png)
- [真实地址栏打开 Latin-1 原件，Café 正确显示](candidate-direct-latin-text.png)
- [SVG 直接链接触发下载的原生面板](candidate-native-svg-download.png)
- [四次实际下载的原名、长度与逐字节一致性](candidate-browser-downloads.json)：正文文本 90、预览原图 11791、直接 SVG 346、直接 HTML 72 字节
- [基线最终只读持久库](baseline-persistence-final.json)、[候选最终只读持久库](candidate-persistence-final.json)
- [基线发布回执](baseline-published-metadata.json)、[候选发布回执](candidate-published-metadata.json)
- [4 次精确本机流式请求及完成](model-stream-events.json)、[验证及自有进程正常退出](final-validation-summary.json)

每张页面和原生面板截图均由本人实际查看，没有界面自动化断言。原生下载面板的内部临时标识与下载建议名分别记录，不能把它当作原名丢失。两库均 1 会话、2 消息、7 部件、2 文件部件、提示所有权 0；实际输入正常 stop。两自有 ACP 服务和模型退出 0，浏览器正常关闭，40136/40138/40140 已关闭。没有外部模型或凭据；部分 Office/PDF/音视频测试字节只验证传输，不声明原生解码。旧响应缓存和前端 SVG 派生选择留待各自合同处理。
