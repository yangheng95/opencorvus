# 候选配置的真实 Skill 目录

对应[调查与方案](../../records/2026-10/2026-10-20-candidate-skill-catalog.md)。官方隔离runner的真实文件/Project/Config合同，及保留完整71→72项目历史的原生开发服务保存与恢复。正式441 UI只做真实交互和截图人工复核，没有UI自动化。

结果见[results.json](results.json)；完整配置原件、项目配置原始字节和凭据均留在私有自有诊断目录，不提交。只归档安全的请求、阶段、状态和原生结算。原性能门槛保持cold≤10s、restore≤5s、page read≤20s。

- 最终正向合同55例/172断言通过：7例新合同、47例相关合同、1例真实多Skill跨进程kill/recovery；backend typecheck通过。before及before-candidate日志保留实际失败证据，其中最初sole-removal夹具比较时机问题见调查说明。
- 原完整71→72项目保存/恢复：before 23357.33/5512.04ms，after 26534.51/5201.60ms。整体性能仍failed，没有提高门槛或宣称提速。阶段摘要见[before-cost.json](before-cost.json)、[after-cost.json](after-cost.json)。
- after真实保存中页面GET为12935ms、200，page read通过；before的GET时间未在dev.log替换前归档，仍unknown。
- 真实HTTP新增Project Skill与引用、后续global保存及完整恢复通过；两个自有服务公开关闭、原生物理结算与launcher exit0后，恢复Project原始字节并退休私有凭据对。原授权源metadata不变。自有QA库只读核对schema2、72项目。
- [after首页](after-home.png)、[after实际chat](after-chat.png)为人工页面截图。442无UI/schema源码改动；正式441 UI的Goal入口与精简布局保留。
