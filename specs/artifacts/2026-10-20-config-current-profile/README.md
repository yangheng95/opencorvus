# 当前配置保存采样与完整模型投影

453单agent，见[方案、Recall、根因与实际边界](../../records/2026-10/2026-10-20-config-current-profile.md)。

当前生产目录不再在每个Project的配置验证中立即构造全部Model。唯一ModelsDev解析版本递归只读，Provider从该版本按首次读取生成自己的可变models，原公开转换仍即时且独立。环境凭据先找实际候选，只在DashScope分类影响结果时读取已投影模型URL，保留原声明key优先及多key语义。目录、Model字段、插件可变性与文件writer保持原单一来源。

- `profile-summary.json`：原95项目、修改前真实完整保存的CPU（处理器）采样。原请求窗口1410/1452样本，spawn自身515/504，完整Provider转换栈297/345。按epoch微秒关联原HTTP，self互斥、inclusive不作墙钟相加；原profile留在私有scope。
- `projection-read-diagnostic.json`：scratch透明ownKeys观察表明，首版按需构造仍被环境选择强制读取227个Provider，其中224个来自同一URL分类调用。消费者修复后在实际该进程环境读取8个，完整目录保留。该局部诊断不是性能或端到端资格，不以调用次数作为测试核心断言。
- `focused-contracts.log`为首版40例/132断言；`final-contracts.log`为当前源码82例/254断言、0skip。覆盖完整可变投影、真实生产插件/跨Project/global隔离、catalog发布代际、冻结序列化/clone与密封写入、环境key优先、模型价格/状态/刷新、凭据presence与空声明、全局候选和原保留身份合同。
- 类型检查初次发现readonly声明流向owned metadata writer的输入不匹配，按writer已有Zod.parse所有权修正并重跑；最终原24253 joined0。`typecheck-first.log`、`typecheck-final.log`保留。格式、docs、架构索引与OpenAPI日志为补充。
- `before-cost.json`是95项目带采样13.134/13.940s；`after-cost.json`是96项目首版无采样14.373/14.139s，未获收益。`final-cost.json`为完整消费者修复但OAuth预检失败的97项目scope，11.351/0.975s仅作配置诊断，不充当成功Provider验收。
- `verified-cost.json`、`verified-all-cost.json`、`results.json`：更新授权源后的98项目完整实际保存12.034/0.930s；原37098 checker与84304 native joined0。补测同一原服务10981.915/11440.776ms，原99070与80712均joined0，全部canonical值再次还原。实例默认上限4的正常闲置回收可使下一次验证重新进行冷身份/Git发现，不能保证0.93s稳定恢复。冷10s和复测恢复5s目标仍失败，没有固定提速比例声明。
- `verified-reader-results.json`首组读取先于writer进入候选，不冒充写锁期间进展。`repeat-reader-admission.json`绑定原candidate started及request ID；其后4个实际公共HTTP读取全部200，最长10468.149ms，完整模型接口227 Provider/8133模型、精确gpt-6.1-sol保持。`repeat-reader-results.json`为后端正向合同，不是浏览器或视觉验收。
- `before-home.png`、`before-chat.png`属于原18709/tab54；`after-home.png`、`after-chat.png`属于首版18711/tab55，均真实交互、截图人工复核。最新18715的浏览器创建被Work设置禁用，没有绕过或新截图。因此最终scope的网页/视觉验收明确未达成，旧截图不冒充最终源码验收。本轮UI源码未变化。
- 原18713实际401/token_revoked及源metadata更新在results中明确记录，原scope没有资格通过。新独立配对复制当前已授权source与完整models，18715实际预检credential usable/catalog projected/gpt-6.1-sol streaming=true成功；未exchange、refresh或改写源授权。所有四scope公开shutdown200，原native physical/output/request/launcher全部结算后退休runtime和两组private auth/models副本。`private-pair-retirement.json`记录源变化、当前metadata保持及实际敏感值扫描。
- `data-verification.json`是所有原句柄结算后直接readonly SQLite：schema2、完整98项目，无用户数据库初始化、迁移或清理。初查reader遗漏目录导致DirectoryRequiredError/400、private path分隔符guard失败均保留工具日志并实际修复重跑，不修改产品隔离合同。

不发布版本，不执行UI自动化，不操作用户18571或窗口/进程。保存性能和最新视觉验收仍有未满足项，持续goal保持active。
