# 203 子侧栏真实历史的启动前沿只读调查

## Recall

用户要求自主持续改进 UI（User Interface，用户界面）、Sources 与子 agent 侧栏 Rendering，最新指示只使用单 agent。当前源码 17cc7cfb，交付 HEAD 6da1d8e6；200 已完成主聊天长正文真实返回与原运行器整体退出 0，不能代替子侧栏视觉验收。201 原153闭合历史只读普查：2 Projects、1 Task、5 Sessions、90张表；202 实际当前 Task reducer（归约器）读取 completed/epoch1，当前结构无漂移，139发布的全部三阶段、1001投递及17 Provider/14工具请求均有匹配终态。202 首次导入隔离错误和第二次 Drizzle 客户端绑定错误原样保留，显式 client 修复后真实结果文件已生成。

本轮不委托。原153运行器不重跑、不重置；不启动 clone（副本）、服务、模型或 Task；174启动资格仍 HELD（待满足）。新鲜校验原 Host/Target 原生身份死亡、端口无监听、auth/models 成对不存在后，只读 SQLite BEGIN/ROLLBACK，输出安全标量和身份，不输出凭据、消息正文、工具参数、错误内容或 memory 文本。

## 现象、根因与影响

待复现现象是子侧栏 Sources 的显示质量与已完成正文反复 Rendering。共享正文 renderer（渲染器）修复已在主聊天通过，子侧栏尚无当前真实截图。直接触发预计为折叠、切换、虚拟卸载后的重挂载，仍需真实交互确认。当前准备瓶颈是普通生产启动会恢复控制、权限、消息与项目记忆，已完成 Task 单独不能证明历史全库可安全展示。

已读：project/bootstrap.ts 全部初始化/恢复阶段；control-lease.ts 当前租约 winner（胜出项）的 time_activated/id 排序和 expires_at；durable-execution-capacity.ts 的当前槽位过期判断；session/control.ts 全事件投影；permission/authority.ts reconcileInterruptedAttempts 的 attempt/outcome_slot 关系；task-root-ingress-disposition.ts 身份记录和未处置前沿；task-root-ingress-reducer.ts 终态顺序；memory/project-memory.ts 文档 envelope（封套）、pending user_message、readInTransaction。注意该 memory 读取函数在文档缺失时写入初始化，因此本次不用它读取未知来源；只读关系查询安全字段。

全仓搜索覆盖上述定义、bootstrap 调用点、Task 根输入扫描、消息/Provider/工具事实存储。调度、事件、协议 inbox、会话 prompt owner、项目维护等表201计数为0，但配置、文件和生产语义仍需核查，不将计数冒充启动资格。无产品接口、消息协议、模型、路由、配置或公共契约修改；不运行或新增 UI 自动化测试。完整共享调度异常审计仅在发现实际异常时展开，当前是预启动调查而非异常归因。

## 本轮执行与验收

1. 新鲜只读准入 guard（护栏），继承201不可变原生闭合绑定，并记录 UTC（Coordinated Universal Time，协调世界时）。
2. 原库全部控制租约目标的当前 winner 和 grants（授予记录）、所有 capacity（容量）槽位、SessionControl 全事件身份；不修改状态。
3. 原库全部 ingress（输入轮次）及匹配处置记录、权限执行 start/outcome/result、Git checkpoint 请求/结果；记录身份和安全分类。
4. 全部消息的角色/完成/finish/错误类型/父消息身份、part 类型计数和 Sources 所属 session/message/part；不输出正文或 URL 查询内容。
5. 两项目 memory kind/count/envelope 元数据、残余启动前沿；若真实 pending 存在，保持启动 HELD，继续调查生产消费入口，禁止删改或关闭能力使其通过。

实际只读结果和原错误归档、三层索引更新、docs:check、范围提交/上游 merge（合并）/正常 push（推送）。这不是 UI 视觉验收，也不是全库静默启动证明。原生父工具 join（汇合）、文件配置、复制一致性及唯一原生绝对 deadline（截止时间）传递仍待完成。
