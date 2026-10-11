# 322 已结算worker的早段正文读取

[实施前Recall、根因、权限和验收方案](../../artifacts/2026-10-05-connection-workspace-authority/worker-narration-plan-322.md)。单agent，修复实际分段可见正文无法核对而导致重写的问题。

结果：`read_agent_message`用同一Part目录公开已结算worker该输入轮次的可见前段正文，`evidence_reads.field=text`沿原Message/Part身份分块读取。来源仍绑定真实终态final，保留所有Task/Project/Session/dispatch/accepted input/agent权限与预算；其他actor、推理内容和其他输入轮次通过明确数据契约隔离。旧Tool专属目录字段已替换，调用方、架构和聚焦用例同步。

[真实验收和人工截图](../../artifacts/2026-10-05-connection-workspace-authority/worker-narration-322/README.md)：Task `tsk_g00VXmjqDl00GCczWitJ` 一次派发、一个研究员输入轮次；负责人真实读取487字符开场和3037字符前段正文，再核对工具证据，3分9秒完成。10次GPT-6.1 Sol流式请求均状态200且正常读到末尾。与321相同分段任务要求下，本轮通过新正文读取能力完成，前后耗时只作观察，不作为可推广性能结论。

Sources展开后，第4–6节继续生成时截图中的阅读位置保持；真实点击文件第4行、加载完成的选中行、返回后展开状态及网页来源标题均人工确认。首次点击仍跟随后文的失败画面完整保留，未计为通过。没有UI自动化、截图差异测试或全时段零闪烁断言；本轮未修改前端。

验证：7个聚焦后端文件36 pass、597 expect、0 fail（147.27秒）；核心包typecheck exit0；docs:check 345 ops/25 groups；architecture-index 18文档。原测试夹具缺少物理终态并使用过期Session种类，已按现有生产合同修复；补控制Part时先后顺序错误和一次工作目录错误也保留为检查器修复证据，不冒充产品bug。最终全部原聚焦验收重跑通过。

原执行器19409、事件观察器25279、检查执行器58058均已实际join并exit0。Native43208/Host75784物理退出，18292释放，复制auth/models配对清理，独立tab92关闭。没有重启或刷新用户窗口。完成范围提交和常规上游同步；goal保持active，继续单agent调查下一项有真实证据的问题。

推送检查补全：首轮pre-push的OpenAPI一致性检查发现Panel共享schema尚未同步。已通过现有SDK事务生成补齐openapi.json和两份生成类型/客户端中的field=text及目录说明；生成含TypeScript编译通过，api:routes-check的6条规则/34个文件通过，文档生成后无内容差异。未更改或绕过检查器，原阻止日志保留。
