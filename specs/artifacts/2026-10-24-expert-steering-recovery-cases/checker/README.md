# 原生冻结工具分段诊断

从仓库根目录执行：

```powershell
bun run --cwd packages/opencorvus test ../../specs/artifacts/2026-10-24-expert-steering-recovery-cases/checker/native-package-timing.test.ts
```

这是非UI的原生实机诊断。官方runner建立全新隔离环境并准备当前Windows原生监督器；沿真实marketing-growth冻结工具、原生Task binding及两个Project进行8次串行和128次并行introspection。六个明确10秒空闲间隔属于诊断输入，没有周期采样或人为heartbeat。无模型、用户凭据、HTTP服务或用户进程操作；180秒是该诊断自有执行输入上界，生产处置仍为原5000毫秒绝对期限。

只读观测原生request、original Handle的物理/输出/请求Promise与原文件操作，内存记录后在完成或失败时写入`.tmp-product-iteration/expert-steering-recovery/native-package-timing-<timestamp>/observations.json`。包装文件调用保留原Promise；并行失败等待该轮全部原调用，最终加入全部原Handle结算，然后恢复观察器及数据库。检查器不产生或替换领域结果。

明确正向合同为136个真实schema/description与Task/Project调用归属。通过只证明该输入下的原生调用，不能代表真实模型业务验收，也不能排除既有超时。该文件是当前唯一可重复入口；三个私有历史变体的日志分别保留采样、无采样和空闲输入差异。
