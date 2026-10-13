# 删除 MySQL 转换能力

## Recall

用户最新要求「删除所有的msql转换逻辑」，按仓库实际唯一 MySQL transfer 能力执行；只使用单 agent。此前394为原 Research Studio 的209条 Sources 调查，发现旧物理 schema 准入失败，转入逻辑快照恢复研究。本轮用户改变范围，停止转换器修复及旧数据导入，删除该能力，不增加替代转换器或兼容接口。原用户数据库和私有快照均保持原值。

已读 AGENTS.md、394 Recall、02-data/task-control-plane 架构、MySQL transfer 模块、global 路由、Database 重建、schema-contract、专用创建身份验证器、所有引用该模块的测试、SDK（Software Development Kit，软件开发工具包）生成和文档/推送检查。全仓检索 mysql/msql、MysqlTransfer、mysqlSchema、rebuildSqlite、restoreCurrentTransferTriggers 及创建身份验证器调用点。没有委托。

## 问题深度和影响面

当前公开能力为三个 /global/db/mysql 路由：schema、export、import。唯一转换模块负责 MySQL Data Definition Language（DDL，数据定义语言）生成、JSON（JavaScript Object Notation，JavaScript 对象表示法）快照编码、预检、触发器暂停/恢复和重建 SQLite。生成的 OpenAPI、SDK 与中英 API（Application Programming Interface，应用程序接口）文档同样暴露这些入口。未发现独立 CLI 转换入口或产品界面控件。

394之前的未提交恢复顺序补丁曾用两个当前数据用例从失败改为通过；原279407行预检随后仍被 tool_part_progress 的运行中写入保护拒绝。此前测试未覆盖带已完成 Message/Tool 的完整 progress 历史。此处保留调查事实，用户已取消修复方向，不继续扩大暂停触发器范围，不能把局部通过称原数据或视觉验收。

转换器专用依赖还包括 task-creation-identity-validation.ts、restoreCurrentTransferTriggers、Database.rebuildSqlite 及它的 dropCurrentSchema/quoteIdentifier。全仓搜索显示重建 API 除转换器外仅服务测试 fixture 和 schema-contract 测试；应删除生产重建路径，测试通过已有 resetFiles/Client 建立当前库，漂移测试只在受测试根保护的 SQLite 上制造明确漂移。保留启动时严格 schema 准入、普通 SQLite reset、Session import/export、运行时 Task/Mission/调度 writer 的真实约束。permission/arity.ts 的 mysql 命令权限规则与本转换器无关，保留。

混合测试中的转换片段删掉，转换专用用例/新建的394转换测试删掉；保留正式 writer、恢复、终态、附件读取等正向合同，若需恢复测试使用真实 close/reopen。不新增「旧路由不存在」或字符串缺失断言。当前任务未发现调度运行异常；仅删除独立转换能力，不改变调度协议。公共破坏性影响为现有调用方无法再使用三条路由及 client.global.db.mysql。没有数据迁移、凭据使用、模型调用或界面变化，视觉验收不适用。

## 实施及验收

1. 保存相关文件当前差异，删除唯一转换实现及仅供转换的辅助实现，删除公开路由。
2. 精确清理测试引用；删除专用用例，保留并验证当前 SQLite/运行时正向行为。逐个审阅混合用例依赖，禁止整文件删除仍有价值的运行时检查。
3. 用现有 SDK 生成器及 API 文档生成器同步所有公开产物；更新当前架构、代码结构和涉及旧路径的说明。历史调查/发布记录保留并明确退役状态。
4. 跑受影响后端聚焦测试、类型检查、文档和 API 路由检查，审阅生成差异。无 UI（User Interface，用户界面）自动化或模型端到端验收。
5. 范围提交，保留其他任务修改；fresh fetch、merge upstream、复核完整待推送集合、正常 push。不发布版本/tag/Release。

## 结果

已删除唯一转换模块、专用创建身份验证器、触发器恢复器和生产 Database.rebuildSqlite/dropCurrentSchema；删除三条公开路由，正式生成器同步移除 SDK 的 Mysql/Db 类及 client.global.db、OpenAPI 和中英文 API 文档。当前架构和代码结构已同步。普通 SQLite 初始化/reset、当前 schema 准入、Session import/export 与命令权限规则保留。

删除转换专用用例和混合测试中的转换片段；附件验证改为真实关闭/重开，schema fixture 通过受测试根保护的正常 resetFiles/Client 创建库。首次10文件执行在最后一个 schema 用例报 EBUSY：旧测试保留 prepared query，旧原地重建未删除物理文件，改为真正文件 reset 后暴露其资源未释放。用例仍先验证 graceful close 和新连接，finally 再显式 finalize 原查询并清理。单独重跑14项全部通过；其余9文件均通过，最终94项不同检查通过。首次整轮退出1与重跑退出0分别保留，不把重跑重复项计入总数。

SDK build、服务端类型检查、API路由检查（345 operations）、docs:check、architecture-index 和范围 diff 检查通过。[实际输出及逐文件结果](../../artifacts/2026-10-14-remove-mysql-transfer/README.md)。真实后端合同覆盖当前 schema 初始化/漂移错误/显式 reset、附件、Global Task/Chat、Mission 创建与成员重放、Automation/Event 和 abandoned dispatch 恢复；不是模型或 UI 端到端。原 Research Studio 历史界面的视觉资格仍未达成，且原数据未改写。

本记录及修改将范围提交，并通过正常 hook 完成 upstream 合并/待推送集合复核和推送。没有版本发布。
