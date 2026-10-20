# 配置读取写回的共享所有权

单 agent 第 457 轮，见 [Recall、方案及根因](../../records/2026-10/2026-10-20-config-read-write-ownership.md)。

- `before.log`：Project/global × schema/旧权限四个真实 peer writer 场景全部失败；peer 已提交的 `ask` 和新字段被旧快照覆盖。`after-first.log` 保留首次四例修复通过结果。
- `focused-summary.log` 与 `verified-contracts-summary.log`：九个不同后端文件共 117 例、271 断言；最终 ownership 11 例替代首次 10 例，原错误诊断 24 例额外加入。覆盖精确 snapshot、跨进程及多项目、同文件 callback、并行 Project/global、MCP（Model Context Protocol，模型上下文协议）、注释/引用、unquoted env、权限事实/恢复/终态及原候选插件。完整 runner 原日志保留在自有 scratch；没有 UI 自动化。
- `final-contracts.log`：迁移准备提前展开引用造成四个 writer 诊断列号回归，保留 20 pass/4 fail；最终按原 literal writer 与 expanded reader 契约修复，原断言未改。`typecheck-verified.log` 为最终类型检查。
- `http-contract.log` / `.json` / `http-contract-initial.ts`：初版 checker 错读实际 HTTP 400 响应形状的失败，源已完整恢复。`http-contract-verified.json` 是首个服务修正后的六请求；`http-contract-final-verified.json` 是最终 `18727` 六个真实请求，验证完整原文读取、候选错误后的源保留、version 1 权限迁移、当前提交与完整恢复。
- `http-contract-verified.ts`、`config-write-verified.ts` 与 `readers-verified.mjs` 是最终已结算 scope 的实际 checker，复用必须创建新 scope。生产 browser HostTransport 只是 API（Application Programming Interface，应用程序接口）传输，不能作为网页或视觉验收。
- `canonical-write-verified.json`、`candidate-verified-reader-admission.json`、`candidate-verified-reader-results.json`：最终原 writer 73658 / reader 7718 均结算 0。完整 104 项目保存 12798.661ms、恢复 12560.433ms，仍未达到 10s/5s；四个实际读取均 200，最长 12968.422ms，20s 目标通过。没有缩减历史、改变缓存上限或放宽指标。
- `global-cost.json` 仅关联最终两个性能写入；重叠 span 的 totalMs 不能相加解释为 CPU 或墙钟时间。
- `data-verification.json`：全部物理/输出/请求/launcher 与 checker 结算后直接 readonly SQLite，schema 2，104 Project/137 Session；逐一比较三个开始前 101/134、102/135、103/136 的全部身份、归属与目录，完整保留。没有用户数据库初始化、升级或清空。
- `results.json` / `private-pair-retirement.json`：三个自有 native scope 均 shutdown 200、launcher exit 0、physical/output/request 与 runtime 授权对关闭；其中第二个仅完成 preflight，不冒充最终功能验收。三组 auth 与完整相邻 models 配对分别证明凭据可用、目录投影和实际 `gpt-6.1-sol` 流式请求。实际敏感值扫描通过后精确退休三个 private 配对，没有源凭据写入、准备脚本 exchange 或 refresh。

普通读取不再补写 schema；旧权限映射和审计 version 1 保留，经同一个文件 owner 重读当前字节后迁移。所有 writer 在域 callback 前准备自身目标，reader 只复用活跃的 exact-file 准备；既有 source revision 检查继续负责稳定 generation。

剩余：原全量保存性能与最新视觉资格仍未达成。UI 源码未改，Work 浏览器访问仍禁用。没有更新版本、发布 tag 或 Release，持续目标保持 active。
