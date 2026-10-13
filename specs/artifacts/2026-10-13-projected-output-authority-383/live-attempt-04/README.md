# Attempt04：真实package工具大结果与read接续成功

2026-10-13，Task `tsk_g00VXusvo400gWdUSw6w`通过正常CLI创建并真实completed。默认Base不变，Task显式选`projected-report-383`，实际模型GPT-6.1 Sol。

- [规范checker结果](live-check.json)：两次带真实OpenAI itemId的能力搜索completed；实际package工具完整保存96717字节，目录精确属于当前project/Task/Session；模型自然read首尾后答对`ORCHID-383-ALPHA`与`2100`并完成Task。
- [规范持久化原文](live-canonical.json.gz)、[实际Provider审计](live-provider-audit.json.gz)：11请求全部目标模型、流式HTTP200/EOF。
- [实际保存全文](actual-tool-output.txt.gz)与[公开预期原文](expected-public-report.txt.gz)：checker逐字节比较通过。[checker源](check-live.ts)原执行命令为`bun .tmp-projected-output-authority-383/check-live.ts live-attempt-04`，exit0。
- [完成态与自然答复](task-completed-answer.png)、[截断提示和完整保存路径](projected-output-recovery-head.png)、[首部read](read-report-head.png)、[末尾read](read-report-tail.png)：主agent实际交互截图并人工查看，本子任务亦逐张查看。临时`projected-output-recovery.png`只是中段滚动样本，不作为恢复提示头部图归档。
- [正常物理收尾](provider-live__projected-output-authority-383-live-04-physical-terminal-and-pair-cleanup.json)、[实际句柄join](owner-handle-joins.json)及[独立复查](independent-closure.json)：原owner退出、输出/请求排空、端口释放，auth/models副本成对清理，早于原16:39:15.173截止。
- [明确归档清单与凭据扫描](credential-scan.json)：30项文本/压缩证据，已知凭据匹配0；另附上述4张已人工查看截图。未复制runtime、数据库、binary或授权文件。

本次只证明Task scheduler使用package工具的大结果保存与read接续，以及同一真实调用链的请求metadata修复。package/default MCP已由此前正式HTTP后台测试覆盖，未外推其真实模型验收；本轮也没有派发worker或Mission。前三轮失败继续独立保留。
