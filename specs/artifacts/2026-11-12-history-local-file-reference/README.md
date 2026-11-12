# 历史本地文本文件引用的桌面证据

基线使用 `40034/ui/` 和一份隔离的旧会话数据库备份。已经存储的图片与元数据按目标数据库的规范命名空间复制。未提交新会话输入。

- [真实旧文本引用展开失败，同一历史中的显式图片正常](baseline-old-local-file-fails.png)
- [旧会话的公开文件部件及成功的绝对来源读取](baseline-runtime.json)

## 候选验收

- [英文打开带空格文件名，工作台只读](candidate-read-file-en.png)
- [刷新显示磁盘新行，历史原文保留](candidate-current-history-zh.png)
- [中文 Tab 到阅读按钮，焦点可见](candidate-current-file-keyboard-focus-zh.png)
- [Enter 打开另一条历史引用](candidate-read-reference-zh.png)
- [真实缺失文件的中文状态](candidate-missing-current-file-zh.png)
- [恢复原件后从工作台重试](candidate-reference-retry-zh.png)
- [从资源管理器读取普通项目文件](candidate-project-file-zh.png)
- [同一旧会话中显式存储图片的全图预览](candidate-stored-image-preview-zh.png)
- [公开旧会话与真实文件内容](candidate-runtime.json)、[浏览器请求、精确下载及数据库核对](candidate-verification.json)

所有桌面截图均逐张人工复核。
