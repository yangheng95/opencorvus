# 文件规则坐标与动态语言反馈证据

对应[方案与 Recall](../../records/2026-10/2026-10-13-file-metadata-feedback.md)。所有服务、项目、文件和页面由本批新建，只有普通HTTP接口和真实桌面动作；没有UI自动化、模型消息注入、Provider请求或凭据复制。

- `before/01-success-stale-locale.png`、`02-unlocalized-conflict.png`、`03-published-copy-receipt-failed.png`：当前中文页面的旧英文提示、长错误与已发布却500的真实前态，逐张人工查看。
- `before/physical-and-parent-list.json`：完整物理输入/副本/冲突目标及准确父目录500；`probe-malformed-query.json`保留第一条工具query错误400，不能当产品缺陷。
- `after/01-success-current-locale.png`、`02-conflict-details-zh.png`、`03-conflict-diagnostic-end.png`、`04-conflict-current-locale-en.png`：同一动作事实即时切语言、原409诊断完整展开及滚到末尾，列表仍可见。
- `after/05-parent-copy-success.png`、`06-opened-parent-moved-file.png`、`07-upload-current-locale-zh.png`：真实父worktree复制/打开文件移动/普通文件选择器上传与当前语言数量。
- `after/actual-files-and-api.json`：同一18442生产服务11请求与8文件完整字节、正确ignored域及原项目相对身份。
- `failure/01-nested-directory-failure.png`至`06-manual-refresh-success.png`：实际本人目录移动、规则读取EISDIR、根/嵌套反馈布局、原详情与真实恢复。图05是周期自动恢复，旧Retry数字索引失败，未计手动Retry成功；图06才是新的真实手动菜单刷新成功。
- `failure/actual-recovery-api.json`：实际恢复成员、内容和工具时序失败边界；输入/精确scope内移动事实独立保存。
- `ignore-contract/`：完整只读矩阵、8项旧态失败、12项首版成功、独立发现的第13项链接根容器失败及最终13项79断言通过；同最终源码26邻近回归351断言和后端类型/格式日志。
- `validation/`：正式私有UI构建、独立最终类型、真实同服务checker与文档检查；`ui-*-transcribed`如实标注原工具输出转录，不假称原stdout文件。
- `runtime/`与各`*-launch-owner/launcher-joined`：before02、首个未体验after、最终after02和额外failure的独立实例、固定900秒上限、普通shutdown、物理/输出/请求收尾。首个launcher在process.Start前因证据目录缺失失败，没有Host/Target，原错误单独保留。
- `reviewed-scripts/`：实际使用的私有launcher/Host/checker完整原字节gzip快照，依赖当时绝对scratch目录，不是artifact目录通用运行器。

gzip解压与原字节逐项比较只验证归档保真，不以摘要替代功能正确性。所有16张截图实际呈现并人工查看；POSIX、真实EACCES/设备故障、双失败错误合并、部分上传/搜索分支和共享弹窗locale仍未验，不扩称完成。
