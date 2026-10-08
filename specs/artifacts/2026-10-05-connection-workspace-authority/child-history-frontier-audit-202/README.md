# 202 当前合同下的原153历史事实

## Recall

单 agent，依[202方案](../child-history-frontier-audit-plan-202.md)在新鲜原生死亡/端口/成对凭据准入后读取原全库。显式 readonly（只读）SQLite 客户端传入生产 Task 生命周期归约器，不调用全局 Database.use、Instance 或 bootstrap（启动初始化）。使用本轮独立应用/测试路径。

`result.json` 是实际当前 `findSchemaDrift`（结构合同检查）与 `taskLifecycleProjectionInTransaction` 结果：结构无漂移；唯一 Task 为 completed/epoch1，opened `pev_g0VXRkMYy000N2amTfW0`，terminal `pev_g0VXRlJUn00LNIxnTZ2w`。139次发布各有 exact/wildcard/global 三阶段终态；1001条投递按 occurrence/phase/subscriber 对应 succeeded/ignored 终态。17 Provider 请求和14工具请求分别按 request_id/request_part_id 匹配终态。仅输出安全分类、身份和时间。

保留 `first-import-isolation-error.log`：首次遗漏测试进程根路径，触发 INVALID_OPENCORVUS_TEST_RUNTIME；按当前 runtime-paths 合同补齐，未绕过隔离。保留 `second-client-binding-error.log` 和 `before-explicit-client.ts.txt`：CJS（CommonJS，模块格式）Drizzle 的 `drizzle(sqlite)` 客户端识别失败，读取另一空连接出现 no such table: protocol_event。直接原库有60事件，不能把这个工具绑定错误当作历史库缺表。改为 `drizzle({client:sqlite})` 并验证 `$client === sqlite` 后实际结果完整生成；成功执行的独立进程退出码未另存，不补造退出0。末次 stderr 原文件为空；当前只读源归档 `source.ts.txt`。

这只证明结构、生命周期和匹配终态子集。控制、记忆、文件配置、原父工具汇合、复制一致性与原生有限截止仍需独立确认；不启动服务，不构造 UI（User Interface，用户界面）夹具，不宣称侧栏视觉通过。下一份是[203结果](../child-history-startup-frontiers-203/README.md)。
