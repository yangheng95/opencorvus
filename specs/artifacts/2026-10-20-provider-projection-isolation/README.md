# Provider 目录与项目投影的数据隔离

对应[Recall、复现、根因与实施前方案](../../records/2026-10/2026-10-20-provider-projection-isolation.md)。[完整结果](results.json)保留检查、请求及原生完整结算。

生产插件定制一个项目的Provider时，env、headers、深层options和interleaved对象曾直接借用共享ModelsDev声明，污染另一项目和全局目录。原两个正向用例均失败，修复唯一转换边界后均通过：本项目保留明确定制值，源声明、另一Project和global保留各自原值。没有新目录、缓存或冻结插件数据。

- [原始失败](before-contract.log)、[修复后合同](after-contracts.log)、[Provider生命周期/runtime函数合同](provider-contracts.log)：共16例25断言。
- [类型检查](typecheck.log)通过；后端合同使用真实目录文件、生产file URL插件加载和两个实际Instance，未mock该数据流。
- [实际模型会话](after-chat.png)、[恢复后首页](after-home.png)：真实gpt-6.1-sol流式预检、OK、Ask与Goal入口；人工视觉复核，无UI自动化。

全77项目、初始loaded2，真实frontend Config service→HostTransport→HTTP，冷保存19505.16ms、恢复5469.55ms，canonical完整恢复；保存中真实GET16241ms/200。原10s/5s性能门槛仍 **failed**，本轮功能隔离修复通过，不宣称性能改善。schema仍2、77项目历史保留。原生服务与checker均完整退出，临时auth/models对已退休，原授权源metadata未变。

首次scratch信号读取在计时/保存前EBUSY，原服务未收到PATCH，canonical完整未变；[故障前置事实](signal-failure.json)与[原错误](write-after.log)保留。改用现有durable atomic primitive发布全新信号，在同一个已验证仍live的原服务重跑原验收，未重启或遮蔽产品错误。

完整开发日志、配置与Provider正文仅存私有目录；归档前扫描实际凭据值。阶段累计跨度存在重叠，不能相加作墙钟。
