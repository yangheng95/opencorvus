# 双页面文件冲突恢复证据

对应[方案与结果](../../records/2026-10/2026-10-31-file-conflict-recovery.md)。真实隔离开发serve /ui、两个自有页面编辑同一本轮新QA文件；只操作实际文件，不制造修订/冲突响应。截图随实际流程保存并本人呈现查看，不新增或运行UI自动化。

## 实际截图

| 文件 | 人工观察 |
| --- | --- |
| 01-initial-file-saved.png | 初次工具typeText省略空行，随后fill并真实保存精确A83字节；不当成产品bug |
| 02-second-page-saved-disk-version.png | 第二页面实际保存B |
| 03-original-conflict-preserves-draft.png | 基线正确409、D草稿保留 |
| 04-original-read-only-comparison.png | 基线比较B/D只有刷新、关闭 |
| 05-merged-draft-still-needs-recovery.png | 已手工合并M仍无法从旧基准保存 |
| 06-explicit-reviewed-disk-base-action.png | 首候选英文采用动作与说明 |
| 07-displayed-disk-snapshot-stays-explicit.png | 另一页保存C后当前比较仍诚实显示B |
| 08-stale-adopted-snapshot-conflicts.png | 采用旧B后实际保存409保护C |
| 09-reviewed-current-base-saves-merged-file.png | 采用C后显式保存MC155 |
| 10-other-page-loads-merged-result.png | 另页真实Reload最终结果 |
| 11-final-adoption-keeps-draft-and-feedback.png | 最终采用后草稿与原失败保持；关闭即时过渡不是稳定焦点证据 |
| 12-final-focus-returned.png | 关闭稳定后焦点返回原失败Feedback比较按钮 |
| 13-final-unsaved-save-conflict.png | 中文未保存决定内Save409保护C |
| 14-chinese-reviewed-base-in-nested-dialog.png | 中文嵌套比较C/M及明确采用动作 |
| 15-adoption-returns-unsaved-decision.png | 采用仅关闭子比较，父决定与其Compare焦点保留 |
| 16-final-chinese-merged-save.png | 手工合并MC后显式保存155字节 |
| 17-saved-disk-and-draft-agree.png | 磁盘/草稿真实显示文本没有差异 |
| 18-saved-base-and-disk-agree.png | 保存后的基准/磁盘真实显示文本没有差异 |

## 字节与结清回执

| 真实样本 | 来源/字节 |
| --- | --- |
| before-merged-draft.md | 基线页面实际下载M，131 |
| before-disk-version.md | 基线实际磁盘B，116 |
| after-merged-download.md | 首候选页面实际下载MC，155 |
| after-disk-version.md | 首候选实际磁盘MC，155 |
| final-kept-draft.md | 最终采用C并取消离开后实际下载M，131 |
| final-merged-download.md | 最终显式保存后实际下载MC，155 |

[writes-qualified.json](writes-qualified.json)记录11次候选真实条件写入的目标、文本与原读取修订的绑定；[events-qualified.json](events-qualified.json)逐一核对13次真实文件事件、81成功投递及12实际scheduler接受。最后实例首次创建早于项目执行运行时初始化，身份路由当时两名已注册订阅者均成功；没有用固定订阅者数或虚构接受补齐记录。[qualified.json](qualified.json)汇总完整原数据、HTTP（超文本传输协议）回读与三实例物理/输出/请求结清、配对副本退休。

截图是实际页面和人工复核记录，不是快照断言。只验收隔离Web桌面；Tauri窗口、只读/非文本、跨项目与慢读取退休未在本轮重测，无新模型请求。用户18571和真实数据库未操作。首次即时焦点观察被后续稳定观察纠正，不能宣布为持久焦点故障修复。全部限制及检查器两次错误假设见对应方案。
