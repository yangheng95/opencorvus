# 记忆输入的真实来源与首次登记

[调查、Recall 与方案](../../records/2026-10/2026-10-24-memory-input-provenance.md)，[真实数据、请求与进程证据](evidence.json)。562只有一个开发 agent，使用隔离 source CLI（命令行入口）的 `/ui/` 和内置浏览器手动操作。全部图片实际呈现并人工查看；没有用户界面自动化测试。

普通 fork 和 Side chat 共用历史复制与 canonical Message（规范消息）持久事务。复制保留的用户输入标记被错误认作新输入；Organizer（记忆整理器）消费后，同一 Message 的再次持久化还会重新登记。修复沿既有 `copySources` 分类为 `copied_context`，并用同一事务已读取的首次创建事实决定登记。原历史、来源标记、真实新输入和既有待办保留；数据格式和 schema 不变。

## 图片资格

| 图片 | 实际观察 |
| --- | --- |
| [01](01-before-side.png) | 修改前 Side 连接中间态，不能代表正常就绪。 |
| [02](02-before-reference-history.png) | 修改前已就绪，展开两条真实引用历史；只创建 Side 就让记忆修订从 1 增至 2，完整 Markdown 字符串保持相同。 |
| [03](03-after-reference-history.png) | 修改后新建 Side chat 2，原引用消息可见、来源保留、侧聊就绪。记忆仍为修订 2，实际请求数保持 2。 |
| [04](04-after-reply-outside-viewport.png) | 真实发送后的中间态：引用历史展开，回复位于视口下方。保留此现象，不能凭文档对象模型中的回复认定视觉通过。 |
| [05](05-after-visible-reply.png) | 重新打开同一 Side chat 2，引用历史折叠；真实新问题与回复“新的侧聊输入正常。”实际可见。 |

修改后不是只看模型调用数：canonical 历史副本同时保留 `copySources` 与人类输入标记；新问题具有独立 Message `msg_bbf9a433-a000-486e-9fe9-57891d886ac3`。新问题随后得到实际 Sol 回复和正常记忆整理，文档从修订 2 更新到 3，最终待办正常消费。各阶段身份、计数及 Provider 原 reader（读取流）EOF（End Of File，读完）均在 evidence 中。

## 运行和数据

| scope | 原 exec | 实际模型请求 | 关闭预留 | 结算 |
| --- | ---: | ---: | ---: | --- |
| before 原型失败 | 直接完成 | 0 | 启动被拒绝 | 未发布 schema 4 原型缺少正式迁移 4 的第二个索引；一致性检查拒绝，未建立监听。 |
| before-canonical | 32901 | 3 | 1,034,039 ms | 公开 shutdown 200，原 exec/native/launcher 均退出 0。 |
| after | 58710 | 4 | 536,304 ms | 公开 shutdown 200，原 exec/native/launcher 均退出 0。 |

正式 before 从已闭合 schema 3 完整数据启动，真实生产迁移 3→4，唯一新增声明的 `bus_publication_outbox_message_move_idx` 与 `bus_publication_outbox_part_removal_idx`；after 4→4 对象相同。本轮没有编辑迁移，也没有给旧原型补兼容路径。

每个正式服务有 20 分钟原生边界、180 秒启动无活动和至少 5 分钟收尾。按用户热认证授权，完整 OpenAI 条目和完整相邻模型目录配对复制，分别验证凭据、模型投影及实际 gpt-6.1-sol 请求。正式服务共 7 次请求，全部流式 200、原 Provider source reader EOF；批次上限 12。三个 scope 的 auth/catalog 副本各退休一份，实际物理进程、输出、请求清理均结算。源模型目录完整内容、9,155,406 字节和修改时间保持。

原始请求观察：[before](before-canonical-requests.jsonl)、[after](after-requests.jsonl)。仅身份、路径、时刻和取消状态，不含认证、票据或请求正文。

三个源的 90 表原 174,227 / 172,483 / 173,306 行、所有字段/时间、数据库字节/修改时间和完整配置保持。正式 target 的原行差异仅本项目记忆 chunk、memory file 时间和两条容量租约，其他旧 Task/Mission/Session/Goal 字段保持；新的 Side、真实输入、回复及运行事件为正常新增。SQLite 完整性为 ok。没有以目标所有行零变化冒充保留数据，也没有接触用户数据库。

## 检查与边界

旧实现先复现两个真实失败，第三个事务重试合同通过，见 [校正旧实现](baseline.log)。[修复合同](fixed.log)验证 fork/Side 来源、新输入、两项目隔离、消费后重放、改名和事务回滚。另保留 [记忆入口合同](related-memory.log)、[Task/交互入口](additional-input.log)、[真实 fork 原子事务](fork-atomic.log)：12 个聚焦合同、88 断言通过。日志展示副本统一行尾空白，原始输出留存私有验收目录。它们使用 SQLite 和当前事务/入口；局部 provider fixture 不作为网页或真实 Provider 验收。

前端源码没有改变，沿用上轮完整 `main-DXPgQK57.js`，未无目标重建。后端类型检查通过。文档和正常推送 hooks 按交付执行，不能替代上述实页资格。

发送后阅读位置的现象仍需单独调查：本轮没有修改滚动代码，不宣称其已修复。原生重启与其他流式入口专项继续保留，整体 Goal active。
