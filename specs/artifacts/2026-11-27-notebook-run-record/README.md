# 笔记本源码与标准流真实交付证据

对应[Recall、根因及最终验收](../../records/2026-11/2026-11-27-notebook-run-record.md)。

- `verification.json`：15次精确Sol流式请求、两次服务生命周期/原句柄证据限制、检查与截图分类。13张截图均人工查看，8张最终候选；三个查询输入阶段帧不冒充源码命中。
- `publication-facts.json`、`execution-attempts.json`、`successful-execution.json`：实际Python失败/成功的源段、独立stdout/stderr及退出码，完整7650字节源码身份和5/35.60汇总。原失败及来源校正历史保留。
- `api-artifact*.json`、`before-source-identity.json`、`source-diff.txt`：旧“和”与原“或”的确切read/publisher差异，校正产物五单元和实际输出；不是摘要/换行检查替代行为。
- `before/after-notebook-facts.json`、`before/after-production-export.ipynb`：原14762字节导出将显式标准流降为display_data；现14674字节保留stream/name/text及全部单元/source/count/id。Jupyter具名流合同checker，不宣称完整nbformat包/schema验证；官方Raw链接被阻止后未绕过。
- `native-downloads.zip`及同名独立文件：真实修改前下载、候选中文浅色/英语深色下载及原生Copy。候选三个文件字节等于现生产导出；ZIP逐成员与实际下载原件比较。
- `after-notebook-source-native-match.png`、`after-notebook-source-call.png`：真实原生键盘查找118行定义和Next到159行调用；`after-notebook-run-count.png`为存档[ ]/执行[1]。`after-notebook-run-streams.png`与英语深色对应图为完整JSON、红色stderr和来源汇总，`english-readonly`图为英语说明及原中文正文。
- `facts-run78/79.json`：原23文件、2196旧行、样本Git及SQLite保全。run79原67249明确join退出0；run78原90474最终输出丢失、句柄退役，独立进程/runtime退出0和请求排空/副本退役核对，不伪称观察到join。

不保存完整会话export、推理、完整数据库或配对凭据/模型目录；没有UI自动化、Task/Mission分派、发布或标签。
