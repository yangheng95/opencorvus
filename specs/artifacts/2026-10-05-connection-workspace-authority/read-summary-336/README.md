# 336 读取工具摘要

[Recall与根因](../read-summary-plan-336.md)。已完成read的摘要使用真实结果title，范围/行数、原错误、展开后的完整输入保留；所有相关摘要共用同一函数。

## 真实页面人工复核

Root在开发模式 http://localhost:18312/ui 正常Work Chat操作；没有UI自动测试。基线采用335的[原始截图](../attachment-source-name-335/07-history-source-range.png)和本轮[只读canonical标题](before-canonical-titles.json)。

- [01 运行中已完成的读取](01-live-readable-summary.png)：PDF与Markdown摘要显示原名，普通文件和真实失败仍各自可辨。
- [02 展开原始Input](02-original-input-disclosure.png)：完整canonical URL、offset、limit可核查。
- [03 PDF来源](03-pdf-name-alignment.png)：摘要、Source和实际16页PDF预览名称一致。
- [04 文本来源与范围](04-markdown-range-alignment.png)：24-25行高亮；悬浮提示当时遮挡部分摘要。
- [05 清除悬浮提示](05-readable-source-context.png)：完整摘要与Sources可读，文本范围和只读预览保留。
- [06 实际错误](06-actual-error-details.png)：摘要/原详情保留真实失败；正文反斜杠转义问题明确未修复，作为下一批入口。
- [07 历史回看](07-history-readable-summary.png)：离开后返回的实际历史仍按原名显示，并正确打开引用行。

## 事实与边界

[canonical请求/结果/来源](live-01/canonical-current-conversations.json)保留4次真实read、3个completed标题及1个指定缺失文件错误。[后端事实检查](checks/actual-backend.json)验证两个canonical附件原件字节、范围、请求归属、实际失败，以及8次gpt-6.1-sol流式请求HTTP200/EOF。

[验证句柄](checks/validation.json)：类型63118、构建60398、启动18559均实际exit0，docs通过，服务bundle为main-DxxueFc7.js。端口/进程/输出/请求及配对复制清理回执在live-01；119页已关闭。日志/Provider/定时监督证据无损gzip归档，34份文本/解压扫描0凭据匹配，私有原件保留。

错误正文把`\.`解释为Markdown转义，导致Windows路径显示失真，当前未达成修复；完整诊断仍保留正确原值。PDF的@1+2000是模型实际请求范围，不代表读取了2000行。当前纯UI更改未改模型输入、工具结果、后端协议、来源身份或子会话调度；没有以此主对话验收宣称全部子会话矩阵通过。
