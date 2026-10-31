# 批量附件上限反馈实测

对应[实施前方案与Recall](../../records/2026-10/2026-10-31-attachment-limit-feedback.md)。只收录真实页面截图和脱敏回执，私有数据库、原始认证与完整模型目录不提交。

十七张截图均已实际呈现并人工查看；没有UI自动化测试或截图差异断言。

- [01](01-before-held-uploads.png)、[02](02-before-late-limit-dialog.png)：首批真实十一文件输入与旧批次在新空白页的延迟提示。首次六连接被诊断占满，不作为新草稿保留资格。
- [03](03-before-single-pending.png)、[04](04-before-new-draft.png)、[05](05-before-late-dialog-over-new-draft.png)、[06](06-before-draft-after-dismiss.png)：仅一个待完成请求的对照，新输入可用、旧Dialog打断、关闭后原草稿保留。
- [07](07-after-immediate-limit.png)、[08](08-after-one-pending.png)、[09](09-after-completed-old-batch-new-draft.png)：修复后全局输入即时上限反馈、原项目仍在上传、实际新草稿继续。
- [10](10-after-established-immediate-limit.png)、[11](11-after-established-batch-new-draft.png)：重复同一九加二、单请求待完成场景，提示属于原输入，新草稿及输入焦点继续。
- [12](12-after-ten-files-chinese.png)、[13](13-after-chinese-full-limit.png)、[14](14-after-capacity-restored.png)、[15](15-after-reselected-ten-files.png)、[16](16-after-reselected-original.png)：中文满额、移除恢复、重选补满及第十一份原件内容。
- [17](17-after-new-draft-restored.png)：原项目往返后全局草稿继续保留。
- [verification.json](verification.json)：真实20/31次上传、零模型调用、原件字节、旧数据与物理退出摘要。只实测本轮浏览器流程，不外推所有原生窗口occlusion时序。
