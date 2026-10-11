# 318 搜索文件名与结果边界

[实施前Recall与分析](../../artifacts/2026-10-05-connection-workspace-authority/search-framing-plan-318.md)。单agent，验证当前搜索工具的真实结果身份与内容。

本地搜索与文件枚举改为共享 JSON/NUL 协议，修复真实尾随空白丢失及文件名分隔歧义。17 项聚焦检查和后端类型检查通过；实际 gpt-6.1-sol 搜索/读取保留两个前导空格的路径，6 请求正常流式结束，真实 `/ui` 点击来源打开同一文件。[结果、截图、原失败记录与验收边界](../../artifacts/2026-10-05-connection-workspace-authority/search-framing-318/README.md)。搜索自身的 Sources 新功能留待后续，当前未宣称完成。
