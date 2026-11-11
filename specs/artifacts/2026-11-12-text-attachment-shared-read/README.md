# 文本附件预览和原件读取的桌面证据

- [实际上传及原草稿](01-baseline-draft-with-original-attachment.png)。关闭在途预览后，[原附件入口恢复焦点](03-baseline-close-returns-to-draft.png)，真实读仍在放行后送达。
- 另一份附件[实际加载](04-baseline-second-preview-read-held.png)。截断一次真实读取，窗口出现[两份失败提示和两个重试](05-baseline-attachment-duplicate-read-failure.png)。
- [正文重试已成功，下载仍报错](06-baseline-preview-recovered-download-still-failed.png)，需再执行[独立下载重试](07-baseline-separate-download-retry.png)。
- [真实读取和原字节核对](baseline-text-attachment-read-evidence.json)。
- 英文候选保留[草稿和原附件](08-candidate-en-original-draft.png)，经过[正在加载](09-candidate-en-first-read-pending.png)、[一处失败和重试](10-candidate-en-single-attachment-error.png)、[重试中](11-candidate-en-retry-pending.png)进入[原文及下载同屏](12-candidate-en-retry-restores-text-and-download.png)，关闭后[回到原草稿和附件](13-candidate-en-close-returns-to-original-draft.png)。
- 中文候选在[原附件加载](14-candidate-zh-first-read-pending.png)失败后显示[一处反馈](15-candidate-zh-single-attachment-error.png)和[实际诊断](16-candidate-zh-original-error-details.png)，[键盘重试期间](17-candidate-zh-keyboard-retry-pending.png)保留焦点和诊断，[正文及下载同时恢复](18-candidate-zh-retry-restores-text-and-download.png)，再[回到原草稿](19-candidate-zh-close-returns-to-original-draft.png)。
- [中文编码说明与原文件下载](20-candidate-zh-encoding-error-with-original-download.png)。[候选接口回执和逐字节核对](candidate-text-attachment-read-evidence.json)。

桌面截图由本人复核。[根因、影响及方案](../../records/2026-11/2026-11-12-text-attachment-shared-read.md)
