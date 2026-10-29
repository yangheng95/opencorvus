# H05 无token截断的开发继续运行

用户没有限制本次任务token额度。前三轮使用本agent自设上限提前取消，不能回答H05能否完成。本轮撤去token/CPU/内存/输出总量终止条件，只保留现有Inspect按真实活动续期的600秒无活动检测，资源仅报告。

运行注册见[registration.json](registration.json)。公开委托只替换资源段落，`task.json`资源字段同步为null；全部业务要求、输出路径、结果结构、四份输入保持冻结H05原内容。新项目不包含评分器、oracle或之前交付。源码运行身份是注册时实际共享checkout，未建立不可变镜像，仍为`comparable=false`。

实际路径：Inspect原输入→公共Task→OpenCorvus生产编排/开发执行者→目标`gpt-6.1-sol`流式Provider→模型实际工作物。Task为`tsk_g00VZOYBUC00Kv0WzDFa`。真实流式预检成功；独立会话父链重算到1,177,164词元时Task仍active/running=1，见[越过旧阈值的正向运行观察](uncapped-runtime-observation.json)。独立agent已确认实际注册、Inspect dataset、持久化request和预算均采用新条件；调用次数限制也是null。

## 实际结果

**Task自然完成，独立清洁复跑与本题开发业务验收通过。** 北京时间2026-10-29 08:45:31.596–09:19:44.847，Task耗时34分13.251秒，Inspect整体34分25秒，生命周期`task_completed=1`。最终公共状态为completed/inactive、running=0；自有实例正常退出并结清，配对凭据副本已删除。见[最终状态](task-status.json)、[收尾回执](server-result.json)与[汇总](summary.json)。

本题193条已结算用量、20,901,186总词元，其中大部分为缓存输入；独立预检33,190已分开，无归属0。按耐久Session父链独立SQL重算的usage ID集合与启动器完全一致，见[用量归属](case-accounting.json)。实例195次真实请求均为精确目标模型、流式、HTTP 200及正常流结束，与195条用量相符，见[Provider审计](provider-audit-final.json)。这些是用量事实，不是实际账单；真实费用未知。总量没有触发取消。

## 原交付与独立复跑

- [模型原发布包](original-delivery.zip)保留当时140项文件；[候选提交完整归档](candidate-checkpoint.zip)绑定`0959146ce2660adf3455c3a26db54b2e1f7ef6fc`。便于阅读的原件在[源码](submission/service.py)、[复跑程序](submission/reproduce.py)、[事故报告](submission/incident.md)、[恢复手册](submission/runbook.md)。没有由评估者代写业务答案。
- 主评估者仅从该提交提取三份源码，另复制冻结四输入；不提供旧结果/SQLite。实际新目录复跑21.649秒退出0，50个子进程命令、18个逐身份比较场景，见[真实调用](replay-execution.json)与[新生成结果完整包](evaluator-clean-output.zip)。主评估者另按raw CSV独立分组并直接只读查询9个新库，720个联合身份、三租户各52,680均一致；四个不同进程共入账720，重复2,572，见[独立数据库核验](independent-database-check.json)。
- 独立外部agent另用同样三份源码与四输入，在自己的新目录实际复跑19.706秒退出0，再独立分组与查库。逐16叶非盲开发评审80/80，真实诊断checker20/20，合计**100开发业务点**，见[原始独立评审](reviewer-assessment.json)、[独立执行](reviewer-replay/execution.json)、[独立观察](reviewer-replay/independent-observations.json)与[其新生成结果](reviewer-clean-output.zip)。最终状态、用量、收尾与源码身份经[最终独立复核](reviewer-final-assessment.json)确认，原80/80业务评分继续适用。这是单个非盲agent的开发评审，不能当职业专家盲评或正式benchmark资格。
- OpenCorvus内部两位测试代理也分别实际复跑、查库并增加外部中断/真实SQL失败/屏障同步并发实验，原[第一报告](review-a/report.md)、[第二报告](review-b/report.md)及各自原始证据包保留。报告明确区分人类签字、作者自检和代理审查。第二报告还保留其检查器误用immutable忽略WAL的失败与修正，不能包装成产品故障或丢弃失败。
- 任务最终提交为`0666fb641747b8bc9bafc23c46f698393b6ba443`。三份执行源码与已独立复跑的提交逐字节相同；两份报告只有CRLF换行区别，文本相同，见[最终身份核对](final-submission-identity.json)。这些身份事实不替代实际功能验收。真实可见自然消息及工具输入/输出在[对话归档](task-visible-transcript.zip)，不包含秘密推理正文；同目录原始Inspect `.eval`保留生命周期记录。

## 结果边界

已验证的是本题单机离线样例的身份、事务、重启、并发、乱序、重建、监控和CLI切换恢复。停写路由不是在途写入栅栏：已经读取可写配置的进程仍可能提交。两份报告已将真实部署的停写排空/写入栅栏列为额外条件；没有声称在线多节点切换、断电/磁盘损坏或备份介质恢复通过。10%是本次可执行演练告警阈值，未经真实业务服务水平校准。

本轮`blind=false`、`formalBenchmarkQualified=false`、`comparable=false`；未取得操作系统安全隔离、职业专家盲评/评分器校准或完整套件比较资格。不运行正式grade CLI来伪填原100万/盲评条件。前三轮原始记录仍保持在原目录；本轮是用户纠正后的不同资源条件，不混算或挑最好成绩。
