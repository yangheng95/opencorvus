# 候选配置的 Provider 插件来源修复

单agent第455轮，见[Recall、根因、方案与实际结果](../../records/2026-10/2026-10-20-candidate-provider-plugins.md)。

- `before.log`：有效完整catalog下三个真实后端失败，分别为新增候选模型、原项目writer替换插件/模型、空选择仍读取旧模型改写。`before-fixture-error.log`是修正前遗漏必需本地Provider的夹具失败，不作为产品复现。
- `contracts-summary.log`：原九文件runner的实际用例/断言/结算摘要，68例、163断言、全部exit0；完整原日志保留自有scratch。八个新正向合同涵盖增/换/空选择、真实hook身份、loaded输入与已保存配置代际、跨Project/global、损坏插件替换及typed错误后的当前可用状态。`typecheck.log`原52307 joined0。
- `http-contract.json`、`http-contract.log`：当前后端开发服务的九个实际公共HTTP请求，真实file plugin与模型一起保存/替换、标准模型选择、完整原项目canonical恢复；全部200，读取api.id为gpt-6.1-sol。没有UI驱动或alias LLM调用。
- `canonical-write-candidate.json`：原前端config service → browser HostTransport → 当前公共HTTP → 完整canonical实际保存/恢复，原29877 joined0。这里是后端传输验收，不是浏览器/视觉验收。
- `candidate-reader-admission.json`、`candidate-reader-results.json`：原writer进入config.global.before之后的四个读取均200，原38870 joined0；最长11635.487ms，实际227 Provider/8133模型与gpt-6.1-sol保持。`global-cost.json`是两次原请求与项目inventory/重叠阶段摘要，不能把totalMs相加作CPU或墙钟。
- `http-contract.ts`、`config-write.ts`、`readers.mjs`是本次实际checker源码，绑定各自已结算的独立scope；复用需创建新scope，不能覆盖旧证据。网络读取使用收到实际字节后重置的无活动超时，所有已接受并发读取结算后才报告失败。
- `history-before.json`、`data-verification.json`：直接readonly SQLite，schema2、完整99项目/132 Session，逐一核对上一轮98个原Project ID和worktree全部保留。没有用户数据库初始化、迁移或清理。
- `results.json`、`physical-terminal-and-pair-cleanup.json`、`launcher-child-exit.json`：原18717开发服务授权配对的实际gpt-6.1-sol流式预检、公开shutdown200、原31489 launcher exit0以及native physical/output/request/runtime配对结算。
- `private-pair-retirement.json`：全部原句柄结算后，扫描实际敏感值并精确退休独立auth/models副本；源metadata未变化，未写源文件或exchange/refresh。完整模型正文、配置源和凭据不入仓。
- docs、architecture和API日志仅为补充。UI源码未改，当前浏览器被Work设置禁用，没有新截图或最新视觉资格，也没有UI自动化。

当前实现只有一个插件loader；候选传入明确ordered specifiers，原state记录真正加载的输入，精确匹配时复用原hook，候选不发布服务或运行时state。全局仍只用原内置hooks，无新cache、fallback、API或schema。

原保存10秒/恢复5秒指标仍失败：11478.692/11509.758ms，读取20秒通过；本轮交付来源正确性，不宣称提速或完整持续目标已完成。后续插件revision次序疑点尚须真实消费端复现，不以digest比较代替行为验收。
