# 目录读取的实际入场顺序

449 单 agent 证据，见[方案与 Recall](../../records/2026-10/2026-10-20-catalog-reader-admission.md)。

- `results.json`：两次完整历史原生服务、实际 gpt-6.1-sol 流式预检、全部并发 GET、原请求 ID 对应的 catalog 准入时间、canonical 完整恢复和物理/输出/请求/launcher 结算。
- 修改前能力 reader 在 23:18:29.919Z 排队，后来的第二个 writer 在 41.377Z 先取得 owner，reader 直到 57.296Z 才进入。修改后旧 reader 在 23:42:30.596Z 进入，第二个 writer 在 30.666Z 才取得 owner。两次各 41 个真实并发 GET 均纳入统计；最长等待由 27387ms 降至 17355ms，修改后全部 HTTP 200 且 ≤20s。
- `before-admission-contract.log`：原文件竞争中第 12 个请求先执行的真实失败；`before-trace-contract.log`：原 health 响应已有 request ID，但缺少对应诊断事件的失败。其他合同日志按文件取最终结果，共 44 个正向后端用例、176 断言，覆盖物理 alias、重入、失败推进、不同 subject、真实 crash/restart、Workspace/Project/Skill、安装 receipt 和 SDK 生成。
- `before-cost.json`、`after-cost.json`：完整阶段汇总。冷保存 15.079s→16.790s，恢复 16.002s→17.368s，原 10s/5s 门槛仍未通过；本轮修复队列插队，不把页面等待改善宣称为保存性能达标。
- `after-home.png`、`after-chat.png`、`after-goal-dialog.png`：实际页面交互和人工视觉复核，Goal 首页/会话入口、创建说明、真实 OK、模型与 Ask 可见。没有 UI 自动化测试；没有创建额外目标。
- 类型、格式、文档、架构索引和 OpenAPI 路由检查日志保留。两个只读数据库结果为 86→87 Projects、schema 2；增长来自真实模型预检新会话，全部旧历史保留。
- `private-pair-retirement.json`：所有原生服务与原检查句柄结算后，临时 auth/models 完整配对退休；源授权 metadata 保持，归档文本扫描实际敏感值。

本地先进先出不承诺跨后端全局公平。POSIX crash signal 分支未在 Windows 上验证。原保存性能门槛仍未满足，持续迭代目标保持 active。
