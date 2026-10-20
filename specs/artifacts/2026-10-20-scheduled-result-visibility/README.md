# 调度结果的实际可见入口与历史身份

单开发agent，两个自有原生开发服务18785/18787，当前正式前端来自467；本轮只有后端、数据迁移及其聚焦测试改动。没有操作原用户18571服务，没有UI自动化测试。

| 实际截图 | 人工复核 |
| --- | --- |
| [迁移后列表、正文修复前](migrated-result-listed-before-body-fix.png) | 旧结果已经列出，点击时正文接口500；这张图不能证明打开成功。 |
| [新事件结果](new-event-result.png) | 实际OS HEAD事件、生产wake、流式Sol完成EVENT470READY；从列表打开正文。 |
| [项目定时结果](new-automation-result.png) | 公开manual run完成AUTOMATION470READY；列表使用原定义名，打开Work正文。 |
| [旧结果打开](migrated-original-result-opened.png) | 原EVENT468READY及真实coding参与者完整保留。 |
| [原Task Goal](original-task-goal.png) | Completed、目标原文、真实结果及193,569/240,000 tokens、1/2 turns显示正常。 |
| [同会话后续输入](original-coding-and-new-work.png) | 页面发送有限新输入后，同一Session保留旧coding并新增work的MIGRATED470WORKREADY。 |
| [刷新恢复](restored-original-and-followup.png) | 自有页面刷新后，两次执行的真实参与者与正文完整恢复。 |
| [原成员父会话](original-parent-work.png) | 既有主区Markdown表、来源链接和普通成员入口仍可读。 |
| [原成员Sources](original-member-sources.png) | 实际打开原成员侧栏并滚动至原read，README.md L2–3及复制入口与原说明保持。 |

九张1280×720真实截图全部人工查看。旧结果第一次打开失败的根因有原生请求日志：overlayMeta用当前Work metadata校验旧coding输入。修复统一执行身份解析器，从每次持久化输入解析历史参与者；当前surface只决定后续输入与Session级通知。没有改写旧消息或新增UI旁路。当前静态截图不能排除所有瞬时Rendering；469的实际流中采样另有独立记录，不把本轮误报为新的闪烁修复。

[实际结果与保留核验](results.json)：正式迁移器把自有版本2升至3；完整生产备份中的原Session、Message、Part、调度定义/fire/run/receipt和Permission账本逐行、rowid与原数据图一致。当前135 Project/183 Session/schema3；原133/179的所有身份、目录和归属保持，所有原Message/Part等行保留。原旧结果只增加conversation metadata；实际新输入随后按现有prompt/run.ts更新该Session的工具开关Ruleset及更新时间，已依据真实输入逐项核对，不能误称为迁移改写权限。

新Event为oneShot，真实写回HEAD原字节触发一次，原文件内容保持；项目Automation先暂停再公开manual run，保留真实结果且仍暂停。两者都不是模型桩或合成消息。旧会话的后续输入从真实页面发送，assistant正常finish stop，公开conversation hydration同时返回旧coding与新work身份。

七份相关测试共66例、331断言通过；包含迁移备份/回滚/当前错误、权限版本链、schema物理锁与恢复、Event/Automation合同，以及执行身份重试、终止与重新打开。后端类型检查、内存迁移检查通过。最初两个创建身份用例失败、迁移fixture必填遗漏、迁移期间索引提示不成立及旧actor的实际500都保留在调查记录；没有用checker故障掩盖结果。

[原生结算](native-settlement.json)：两个原始launcher29468/65486均exit0，分别公开shutdown200，physical/output/request/launcher完整收尾；实际共8/整批最多10个gpt-6.1-sol请求，全部200、stream、source-reader EOF。第二scope在第一scope结算为4后固定预算6，没有延长原scope。[复制对退休](private-pair-retirement.json)：两次runtime完整auth/models对在原生结算后清理，私有完整对在实际秘密值扫描后退休，源凭据metadata不变，没有refresh/exchange。自有tab21/22均已关闭。

本轮版本3是追加的持久化身份语义迁移，目标DDL与不可改写版本2相同；原版本1/2未改写。构建检查仍使用内存SQLite，本轮实际升级来自明确启动的自有应用服务。配置性能和未采样Rendering场景继续作为未完成范围，整体迭代目标保持active。
