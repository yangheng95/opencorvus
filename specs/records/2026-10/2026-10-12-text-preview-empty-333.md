# 333 空文本来源与附件预览

[Recall与修改前分析](../../artifacts/2026-10-05-connection-workspace-authority/text-preview-empty-plan-333.md)。验证合法0字节文本的真实加载和显示边界，单agent执行。

确认原TextPreview把空字符串误判为未加载，导致0字节附件预览一直显示Loading text。改为依据既有资源ready状态呈现原始正文，使用原只读编辑器，未修改附件或后端协议。

修改前后两轮真实开发模式页面，各完成7次gpt-6.1-sol流式请求，均200/EOF。正常模型实际读取空文件并发布两份canonical附件预览；root人工查看6张截图，确认空预览、普通中文正文、只读、展开/返回、实际0字节下载及刷新后重开来源。两轮原启动句柄均exit0，全部自有资源与复制凭据/模型配对已收拢。

类型、构建和真实输入接口checker通过；没有新增或运行UI自动化。完整证据、校验和边界见[333 README](../../artifacts/2026-10-05-connection-workspace-authority/text-preview-empty-333/README.md)。
