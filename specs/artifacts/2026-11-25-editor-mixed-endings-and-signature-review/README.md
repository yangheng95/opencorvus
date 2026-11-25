# 文本原字节核验的证据

## 原字节与正式读取

- [明确原件及预期草稿](source-input.json)，[最初正式内容与磁盘](file-read-create.json)，[下载前项目基线](file-read-baseline.json)。
- [实际下载与同时仍保留的原项目文件](file-read-download.json)，[保存和重开后的实际内容](file-read-saved.json)。
- 原件 112 字节、实际下载及保存稿 139 字节。三者保持 UTF-8 签名；原三边界 CRLF/LF/CR 保留，新边界为首分隔符 CRLF。检查比较全部实际字节，未用可变源码摘要或自行重算的校验和代替功能。

## 本人实际交互与截图

- [原四行](desktop-original-four-lines.png)，[实际删除 LF 合并行](desktop-deleted-lf-boundary.png)，[撤销恢复四行与清洁状态](desktop-undo-restored-clean-four-lines.png)。
- [真实中文未保存草稿](desktop-unsaved-chinese-draft.png)，[Chrome 实际下载完成](desktop-draft-download-complete.png)。
- [页面保存后清洁状态](desktop-saved-clean-five-lines.png)，[关闭后重开的五行](desktop-reopened-clean-five-lines.png)，[中文重开状态与原文](desktop-reopened-clean-five-lines-zh.png)。

八张截图均本人查看。文本和字节比较证明实际内容，网页操作与视觉结论来自原生交互及人工截图，不作为模型端到端。
