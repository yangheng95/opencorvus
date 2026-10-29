# 当前无总token额度注册合同：最终局部复核

审查者：`/root/benchmark_review`。范围仅注册解析器、其4项非UI测试、薄启动器本轮差异与Recall“当前注册资源政策收敛”。未改仓库、未再次委托、未读取凭据、未启动launcher/服务/模型。此前`registration-review/`原件保留，本目录为新的独立审查身份。

## 阶段结论

**本轮最终无截断资源政策在所审范围可认可，未发现实质阻断。** 当前单一schema要求`budget.total_model_tokens`显式为null；数字/缺失映射到明确字段错误。launcher原总token阈值取消分支已实际删除，未留下兼容开关。没有把旧capped历史注册改写成当前协议。

## 源码核对

- `z.null()`无optional/default/coerce；根对象及budget的passthrough仍保留来源、occurrence、policy和额外元数据。旧H05无截断归档与新L01仍走同一解析入口。
- 与前次审查快照逐段对照，删除了周期阈值用量查询/达到阈值取消/预算取消收据整条执行分支。当前循环只等待自有stop文件，不新增token或总墙钟终止。
- `measureCaseUsage`仍使用sessionBelongsToTask，将Case Session谱系与独立preflight/无归属用量分开；dispose仍读取真实ProviderUsageEventTable并写完整usage.json、Case事件IDs与计量口径，随后关闭数据库。tokenBudgetScope保留的是归属元数据。
- Provider.getModel的精确投影断言、native流式审计插件链、audit.preflight和真实activity/inactivityMs参数均保留。审查没有运行这些服务链，因此这里只确认本轮源变更保留了路径，不认证实际流式请求已经发生。
- 单一listener、stop文件退出、catch/finally、settleEvolutionRuntimeBeforeCredentials、owned-runtime dispose和成对凭据删除路径均保留。结果仍写server-result.json。没有改Task调度/消息/队列/工具或引入另一运行对象。
- stop文件由既有外部执行观察在Task结束后处理；本轮未实际运行，不能仅凭outcome文本认证自然终态或清理端到端已完成。

## 实际复跑

精确命令、UTC开始时间、耗时、退出码及原始stdout/stderr在`executions.json`及同名文件：

1. 指定注册测试：**4 pass、0 fail、5 expect**。包括真实归档H05、当前L01 profile、缺失额度字段、正整数额度映射到null政策字段错误。
2. 独立纯解析探针：嵌套元数据和null完整保留，显式inactivitySeconds=1234不变；正整数17映射到invalid_type及`budget.total_model_tokens`精确路径。未导入launcher。
3. 三目标文件TypeScript5.8.2 noEmit/strictNullChecks定向检查：退出0。
4. 三目标文件Prettier --check：退出0。

Bun从自有目录读取空preload配置，只运行指定非UI测试；未触发全仓测试预载。`source-snapshot/`和`*.from-draft.diff`保留所审版本与前稿差异。字节身份仅用于标记所审对象，功能结论来自真实测试与人工差异核对。

## 保留边界

本次认可的是当前注册政策和局部工具变更，不是L01科学阈值冻结、完整Provider预检、自然Task长跑、用量完整性或cleanup实际验收。没有候选成绩或成熟benchmark认证。
