# Goal 错误与运行时 OpenAPI 合同

单 agent 第 458 轮，见 [Recall、根因与方案](../../records/2026-10/2026-10-20-goal-error-contract.md)。

- `before.log`：三个真实 Goal 冲突均返回正确的 `ContinuousGoalError`，原 OpenAPI 却以说明句作为错误名，三例全部失败。正式 SDK transaction 修正三处生成类型/说明，`sdk-build-final.log` 保留实际构建。
- `runtime-doc-before.json` / `runtime-before.log`：实际原开发服务 `/doc` 仅有 41 个接口，canonical 清单为 345；两个完整/并发运行时文档检查失败。根因为项目路由延迟挂载后，旧 handler 仍对外层 proxy 收集 metadata。
- `contracts-final.log`：修正 inventory 后完整 schema 比对发现，hono-openapi 1.1.2 改写共用 media.schema，导致后续转换缺少三个 component。`contracts-verified.log` 保留首版 clone 漏守卫 undefined response、返回 500 的中间错误；该中间实现没有交付。
- `runtime-verified.log`：最终两例/9 断言，完整原始 Server.openapi 文档逐字段相同，重复/并发生成均保留全部 definitions；同时有真实 Goal 错误响应。其余三个文件 30 例/89 断言见 `contracts-summary.log`；该摘要保留中间失败，不能单独当作全部成功。去重最终为四文件 32 例/98 断言。
- `http-contract-initial.ts`、`http-contract.log` / `.json`：首个 checker 将 Windows 分隔符直接比较的工具错误，真实空 Chat 保留，没有伪造数据。`http-contract-verified.json` 已完成真实 Goal 生命周期，但发现原 public/doc 缺失。
- `http-contract-final-initial.ts`、`http-contract-final.log` / `.json`：最终代码的首轮 checker 将既有 CLI（Command Line Interface，命令行界面）专属 `x-codeSamples` 展示扩展也当作运行时 schema 字段；逐字段调查确认仅有该扩展差异，components 完全一致。保留原失败，不修改产品为迁就 checker。
- `http-contract-final.ts`、`http-contract-final-verified.json` / `.log`：最终 14 个实际请求，使用新构建 SDK（Software Development Kit，软件开发工具包）进入真实开发 HTTP（Hypertext Transfer Protocol，超文本传输协议）/原 store，完成创建、暂停、继续、完成、保留读取及三种冲突。三个实际 `/doc`（含并发）均为 345 operations/315 schemas，全部 wire metadata 和 components 与生成 canonical 一致，仅正规掉明确由 CLI 追加的示例字段。
- `typecheck-verified.log` / `sdk-typecheck.log` / `module-index.log`：后端、SDK 类型通过；module 检查明确对实际暂存 index，1171 modules/5987 runtime edges、4 clean imports。默认 HEAD 观测未作为当前源码资格，没有绕 hook。
- `data-verification.json`：两个 scope 和全部 checker 结算后直接 readonly SQLite，schema 2、106 Project/143 Session；逐行比较 104/137 和 105/140 两份原身份、归属、目录，全部保留。没有用户数据库初始化、迁移或清空。
- `results.json` / `private-pair-retirement.json`：原 native 27893/6812 均 exit 0，公共 shutdown 200，physical/output/request/launcher 与 runtime 配对完整关闭。两轮完整 auth/models 独立证明 credential、catalog、实际 gpt-6.1-sol 流式预检；实际秘密扫描后精确退休两个 private 配对，无源凭据写入或准备脚本 exchange/refresh。

本轮 Goal 的完成由 operator 在真实合同检查后显式提交；没有新的自动 Goal 执行轮次，不能把 Provider 预检或生命周期请求当作完整自动续跑资格。UI（User Interface，用户界面）源码未改；用户要求内置浏览器调试后，实际接口仍报 Work 设置禁用，当前截图/视觉资格未达。原完整保存 10s/恢复 5s 性能目标仍未达，本轮不重定义该指标。

当前根因修复复用唯一 `Server.openapi()`，每次 inventory 仅复制生成器会修改的响应容器，原 schema resolver 与活跃路由保持归属；没有第二份文档缓存、兼容错误名或逐 schema 补丁。未发布版本、tag 或 Release，持续目标 active。
