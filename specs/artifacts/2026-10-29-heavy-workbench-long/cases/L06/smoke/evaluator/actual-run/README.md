# S06真实原生运行与清洁复跑

此目录只证明微型执行管线，**不计入十个重型任务，不给难度分，不证明小时级有效工作**。公开输入与小合同先冻结，实际运行后封存源码及原始计划，再在仅含源码和冻结输入的新目录复跑。

- 原始运行根：`D:/opencorvus-benchmark-runs/smoke-S06-20261029-24ff4844`，Task `tsk_g00VZR9KuE00aKSMSF10`。原生生命周期自然completed，650.922秒；Inspect解析结果为success/1样本完成，其accuracy只表示生命周期。
- 实际执行模式：Task/code，`builtin/base`版本2026.10.14.1，Provider模型`openai/gpt-6.1-sol`。实际有orchestrator和一个base-tester，不能写成单agent作答。预检、模型目录完整投影与73次真实请求均有元数据；全部streaming/HTTP200/observed/eof。293是递增审计快照数，不能写成请求数。
- `sealed/`保存候选终态源码、说明和原始两份结果；`clean-replay/`来自新目录实际运行。`evaluator/main-smoke-assessment.json`记录两次执行、四次独立业务checker及真实耗时，合计0.8182369秒；两例重算成本4.5/5.5。独立agent的另一次复跑及最终四条件判定另存，不由候选自述代签。
- 候选独立仓终态HEAD为40487f33083e90d32816eec86368b13c2232b35b，status空。运行主仓注册HEAD为9c54d33aafcdbd330631ef2d3391de3f45960c86，同时存在其他任务未提交改动；文件清单保存于runtime-source-worktree.json，HEAD不代表完整可重建runtime源码，comparable=false。
- `evidence/usage.json`是内部provider_usage_event原件：总记录4,966,437 tokens，含cache_read 4,587,776、input 358,609、output 17,766、reasoning计数2,286。Task lineage 4,933,220，其余预检33,217。记录cost为0不能证明外部账单免费，未取得真实货币账单。
- `evidence/server-result.json`确认仅在Task终态后停止本次自有listener，runtimeDisposed/credentialsRemoved为true；原凭据源没有改动。六个昂贵实验仍暂停。Inspect stdout保留Windows可选control surface的AF_UNIX warning，实际样本成功；没有把可选控制面写成已修复。

归档采用显式文件清单：不包含runtime、auth、models、完整session/隐藏推理或原始launcher日志。Provider原件仅为请求/响应reader元数据；原始Inspect `.eval`仍保留在外部运行根，仓库保存真实解析收据和`inspect-originals.zip`内未经修改的原stdout/stderr。少于1秒的业务复跑与约11分钟原生流程分别计量，不能用后者充当问题的数学难度或有用训练时长。
