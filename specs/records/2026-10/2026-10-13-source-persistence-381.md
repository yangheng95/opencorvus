# 381 Sources 并发持久化

按 [Recall 与共享机制调查](../../artifacts/2026-10-05-connection-workspace-authority/source-persistence-plan-381.md) 单 agent 实施。真实数据库确认：交叠批次和不同 recovered Tool completion 都能重复写相同来源；已存在来源还会掩盖错误的消息归属配对。

Source 查重及批次写入现在共用现有 SQLite immediateTransaction。读取限定真实 Session/Message 和 Source 类型，复用规范 Part 校验；写入、时间线顺序与提交后事件沿用 Session canonical writer。没有 schema、身份协议或 Tool 成功事实变更。

后台改前4合同1pass/3fail；改后8合同19断言通过，包含真实 processor 入口、重放、独立消息/项目、归属错误、完整批次事件与终态错误。类型85222、文档和架构检查通过。真实页面初始两次抓取及来源呈现完成；追加同一步双调用验收触发原固定12请求上限，实际只再完成一次抓取，完整端到端未达成。原launcher62148 exit1，不能改写为通过；Native 310253ms 正常退出、物理/output/request/port及凭据配对收尾完成。

五张实际截图逐张人工复核，来源展开、会话重载与点击打开官网证据见 [验收目录](../../artifacts/2026-10-05-connection-workspace-authority/source-persistence-381/README.md)。Tool outcome 与 display/Source 分步提交的完整恢复边界仍待调查，未将本轮结果解释为全链恢复已修复。
