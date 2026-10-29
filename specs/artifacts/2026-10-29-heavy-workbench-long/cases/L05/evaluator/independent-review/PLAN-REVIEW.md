# L05 mini协议：独立实施前计划审查

结论：合作HTTP接收方与两个独立SQLite事务域的方向可达，能补旧H05只有本地事务的结构性缺口。原计划有两项必须先明确的mini自身问题，已在实现前向主方指出，当前Recall与public/PROTOCOL.draft.md已明确修正；可进入这个小协议的真实资格。没有P0不可达性。此处不批准完整L05、难度、小时或候选评分；实现的实际正确性另由后续自有冷复跑判断。

## 已读材料与范围

- specs/records/2026-10/2026-10-30-heavy-workbench-l05-qualification.md，含实施前修正段；当前cases/L05/public/PROTOCOL.draft.md。
- 旧cases/H05.md与九题独立H05升级报告；旧任务可由联合键+一次SQLite事务完成，两个系统旧标准通过不能回溯扣分。
- H05-v02-contract-draft.md、H05-upgrade-proposal.md明确搁置；其operation_id/revision/多币种/epoch是历史未实现设计，不是第二个当前协议。
- 当前mini首次执行三源已读，尚未在本计划阶段独立执行。主方40项/5.1895秒属于主方资格，不能当独立结果。

## 两项初始阻塞及修正

**P1-01：幂等判定与动态冲正校验次序。** 如果先按当前可冲正余额验证，再查已生效身份，post+100、reversal−100已经成功后，原reversal重发可能因余额已0误报超额。已成功身份必须先在严格静态schema后查找：同合法静态载荷返回原receipt，不同合法静态载荷冲突；只有新身份才做引用/累计约束。dependency_pending/超额拒绝不占effect身份，否则先到的冲正永远不能在post到达后成功。累计冲正的查询、比较和insert须在同一服务写事务，两个不同reversal并发不得都消耗同一剩余额度。

当前公开合同和已读apply路径明确静态→既有身份→动态校验，BEGIN IMMEDIATE包围检查/插入，已解决设计阻塞。需要真实资格证明全额重放、pending后同键成功、并发合计过额，而不只测A/R1−30一次。

**P1-02：未知ACK现场的构造。** 原“小脏现场A/E1已生效”与startup drop若未说明顺序，可能只在预先插入的已有效果上丢一个replay响应；这不能证明首次新effect提交跨边界。应由真实worker首次POST→服务effect/receipt/drop消费同事务commit→socket关闭不响应建立unknown，然后在已观察远端receipt但本地确认前握手终止自有worker，重启同键恢复。初始服务效果不能靠fixture直接插入后伪称首次HTTP未知。

当前公开合同和已读runner按真实首次POST建立，主方补充只持有/结束握手Popen句柄，方向可达且设计歧义已关闭。独立执行还须以服务SQL/request顺序和本地pending行验证，而非仅信stdout checkpoint。

## 当前协议边界足够明确的部分

1. effect身份为本服务数据库命名空间内的(tenant,event_id)，两个都是受限非空字符串；kind不可通过换载荷覆盖。传输尝试可多次，但不是新业务身份。reversal是另一个不可变effect，reverses为同租户post的event_id字符串。本mini没有业务revision或兼容旧operation_id的要求。
2. 静态JSON字段/类型/符号/金额界、bool、重复JSON键及多余字段都明确。receipt是服务首次分配后不变的对象，applied/replayed/found在外层；不能因HTTP状态改变重建receipt。
3. 独立HTTP/SQLite效果可作为模拟接收方的真实持久副作用；它不是实际银行支付。接收方的合作幂等和查询使恢复可达，并不是任意非合作外部系统的严格一次承诺。合法客户端可以GET对账，也可用原键POST重试；不能按“使用outbox/GET”关键词给分。
4. 并发客户端允许由SQLite串行写入；不要求并行commit。至少要有真实并发客户端/进程和逐身份效果/receipt事实，不能把顺序循环标作并发。
5. 原effect与drop消费一起持久，同DB重启重新给相同启动参数不能再武装同一fault；新DB可以有独立事实。跨租户是业务命名空间隔离，不是认证/授权安全测试；多实例用各自新DB/URL和本地库验证，不暗加跨接收方迁移要求。
6. worker本地entries/outbox与远端数据库不共享事务，必须区分本地accepted/pending、远端已生效、持久确认。小worker目前只接收harness已验证accepted events，不可据此声称其ingest是完整通用业务接受入口或能修复任意脏库。

## 证据与最小验收建议

- 核核心A/E1+100、B/E1+200、A/R1−30逐身份/载荷/receipt，对应A70/B200；不能只核总额，T/X额外协议探针须清楚与核心租户分开。
- 真实记录首次GET unknown、首次POST applied且dropped/consumed、后续GET原receipt、本地确认前pending、owned-PID实际终止和重启后稳定确认。故障有限且解除后有正常收敛机会。
- 双冲正并发允许任一合法winner，另一个明确reversal_exceeds_original；不规定某个线程永远胜出。全额冲正重放仍稳定，未知前置后的拒绝不占键。
- 已返回的服务业务决定/receipt、客户端是否读到响应和本地是否持久确认分开。requests的status不能伪称客户端已确认；服务无法证明写socket成功即客户端应用收到了响应。当前requests只对通过静态验证的业务POST/GET决策持久，422/未知路由需由HTTP采集记录或明确排除于这张表的完整性声明。
- 资格只证明自有进程范围：loopback端口0绑定、ready握手、准确Popen句柄、全终态和清理；不碰生产Task/用户服务。SQLite进程重启资格不延伸为断电/硬盘故障保证。
- 先标sent的错误只有在HTTP尚未生效前失败才容易暴露。若只测远端已commit后的两处故障，错误实现也可能偶然给对终态。主方随后已明确补一个调用前握手中断控制；未实际运行的换key等错误仍pending，不能靠正确见证通过宣称都能鉴别。

## 刻意不作为本mini前置的事项

不要求现在实现历史revision/多币种/原库迁移/旧写者epoch/完整journal修复/lease/监测或职业报告；这些属于将来的完整L05。也不要求在不合作接收方上实现不可能的跨库原子提交、无限故障下有限时间完成、真实资金或外部凭据。不能靠更多字段/等待把这个秒级资格包装为数小时case。

## 权威资料

HTTP的重试安全取决于请求语义，不能因使用POST就默认安全；本题的稳定键/receipt是明确的应用合作协议。[RFC9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

SQLite可并发读但写事务串行；IMMEDIATE可提前取得写事务，也可能BUSY。它提供本库原子边界，不把两个库变为共同事务。[SQLite transaction documentation](https://www.sqlite.org/lang_transaction.html)

本报告是设计与范围审查，未运行服务、模型、solver、Docker、GPU、UI或委托。后续实际冷复跑及错误对照另留原始收据。
