# SQLite 周期回写验收

见[完整 Recall、根因与实施记录](../../records/2026-10/2026-10-14-sqlite-checkpoint.md)。旧库清理与版本1迁移基线是此前已完成交付；本批没有重置用户数据、改变 schema 或增加迁移版本。

当前实现把 PASSIVE 回写放到短生命周期数据库线程，复用 RuntimeExecutionSettlement 结算原线程；Bus 恢复查询直接依据三类规范回执筛选未完成 publication。最终 Native 开发服务的 38 消息复制为 **3388ms**，完整 **263 个 publication / 789 份 phase receipt** 在 **3674ms** 结算，70次健康请求最大352ms，结算后继续观察超过5秒。

| 实际候选 | 复制请求 ms | 全回执 ms | 健康请求最大 ms |
| --- | ---: | ---: | ---: |
| 同线程周期回写首轮 | 10428 | 10537 | 1912 |
| 同线程周期回写采样 | 6203 | 6307 | 1040 |
| 加入共享恢复 SQL 筛选 | 5498 | 5603 | 1195 |
| 工作线程首轮 | 6353 | 6418 | 658 |
| 工作线程独立服务采样 | 4002 | 4108 | 457 |
| 同服务重复复制 | 2901 | 3005 | 476 |
| 接入运行时结算后最终服务 | 3388 | 3674 | 352 |

前三轮方案不作为性能达标交付；工作线程首轮6353ms的波动保留，不能宣称每次复制都在5秒内。真实UI创建的Side18另有服务端3701ms记录，它不等于完整UI呈现耗时。[完整指标](performance-summary.json)与每轮copy-settlement记录保留尾部观测。

本批正式12文件74项/287断言通过，随后新增真实损坏文件错误合同和运行时结算、回滚、新访问合同；最终聚焦回归24项/56断言通过。本批共覆盖93个不同的非UI测试案例，未运行UI自动化。较早直接bun test绕过官方隔离运行器造成的两个5秒超时、以及整个SHM文件读取触及Windows锁区域的观察器失败日志均保留；修正后使用package声明的bun run test，未放宽产品5秒指标。

- [最终生命周期回归](runtime-owner-final-tests.log)、[后台12文件回归](worker-full-tests.log)、[主库损坏错误合同](worker-failure-contract.log)、[初始迁移与共享合同](official-tests.log)。
- [编译后的实际工作线程](compiled-worker-probe.json)：1354页回写，复制主文件可读精确1200行，线程真实exit0。
- [运行时修正前后真实Provider与物理退出](native-provider-and-cleanup.json)：6个独立Native occurrence，20条gpt-6.1-sol流全部HTTP200/EOF；每轮分别证明凭据可用、模型目录投影、实际请求模型，并在原进程、输出及请求结束后退休auth/models副本。含凭据值的文件未归档。
- [最终目标的无时间过滤全量核查](runtime-owner-canonical-closure.json)：38消息、36个真实source-file、完整263/789回执。历史来源来自同一144行README，本批副本不算新文献或新模型阅读。
- [采样分析](worker-profile-analysis.json)：4秒窗口498样本，Bus批事务栈约2275ms，内部SQL回调约1940ms；父子栈不能相加。原子源复制栈约516ms。剩余波动仍需后续长时间负载调查。

真实中文`/ui/`使用独立构建并人工查看截图：

- [主区原读位](03-worker-main-before.jpg)。
- [已有侧聊38条参考历史](04-worker-side-reference.jpg)。
- [真实新建Side18后的来源与主区读位](06-worker-created-sources.jpg)：主区仍在R03段，侧栏README.md第5–8行与R02正文可见。

一次早先AX索引复制操作得到9–12，而当前来源按钮显示5–8；按当前侧栏完整按钮名称重新定位操作后，复制和真实粘贴均为5–8，草稿清空且未发送。首次操作差异根因尚未确认，不能据此宣称稳定存在或已修复产品错误。初次历史标题搜索无结果、展开项目后可见，也列为待调查范围。

本批不证明全部Sources/成员Rendering问题结束，不提供掉电零损失、硬性WAL大小上限或其他平台编译资格。当前验证平台是Windows/Bun1.4.0。所有自有页面和服务已关闭，持续迭代目标保持进行中。
