# 331 图片解码失败可见性

[Recall 和实施前分析](../../artifacts/2026-10-05-connection-workspace-authority/image-failure-plan-331.md)。单agent检查共享图片预览在解码失败时的说明、交互与恢复。

真实失败图片complete=true、固有0×0、布局131×20；原全屏仍缩放且复制提示clipboard blocked。共享组件现在呈现真实解码失败，只让成功图片使用尺寸操作，复制准确提示图片不可用。英文/中文失败、原PNG恢复、100→125%均真实截图人工查看。[完整证据](../../artifacts/2026-10-05-connection-workspace-authority/image-failure-331/README.md)。

类型/构建实际0，语言目录结构通过；普通会话5次Sol流式EOF，原图与页面偏好恢复，自己页面及原65956/Native75928/Host73172/18302/输出请求/auth-models成对清理。无UI自动化；未宣称全部消费者和图片格式矩阵完成，goal active。
