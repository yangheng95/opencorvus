# 原生 Git 监管与目录注册批处理

对应[调查、Recall与实施前方案](../../records/2026-10/2026-10-20-native-git-cost.md)。[完整结果](results.json)保留精确请求、项目集合、原生退出和原检查门槛。

整体性能仍 **failed**，原cold≤10s、restore≤5s保持：

| 原生 scope | 完整项目数 | cold | restore | 保存中真实页面读取 |
| --- | ---: | ---: | ---: | ---: |
| final（注册批处理） | 73 | 19736.83ms | 5534.51ms | 16622ms / 200 |
| verified（最终源码） | 74 | 19611.17ms | 5280.90ms | 16401ms / 200 |

两个scope均由原frontend Config service→browser HostTransport→真实HTTP保存并完整恢复canonical，Ask保留；真正gpt-6.1-sol流式预检通过。没有缩小QA412的72→73→74项目/Session历史，没有新业务Goal或委托。正式441 UI仅真实交互截图，不运行UI自动化；本批无UI/schema源码改动。

原始失败正向见[before-contract.log](before-contract.log)；最终正向合同86例/166断言，按results.json的17文件清单去重，包含命名空间alias/ancestor顺序、冷项目并行、错误/取消/排空/退休/嵌套/跨root、物理比较、目录回收/promotion跨进程和Config peer/lifecycle。final-directory-contracts、final-config-contracts及accepted-contracts为最终回跑，原句柄均joined0。测试为局部合同，真实保存/恢复和页面资格单独记录。

最后的[reviewed-contracts.log](reviewed-contracts.log)确认queue声明与token acquire共享同一命名空间常量整理后的10个新合同；两文件在results.json中使用该最后回跑，不重复累计。

[原生分段](samples.json)与[自有Rust诊断副本分段](native-samples.json)只用于定位进程成本；诊断副本没有进入真实服务验收或交付。阶段累计有并发重叠，不能相加作墙钟。final与verified的cost摘要保留原同一HTTP请求归属；完整原dev.log、配置原件和Provider正文只保留在私有自有诊断目录。

- [final真实chat](live-chat.png)、[final首页](live-home.png)
- [最终真实chat](verified-chat.png)、[最终首页](verified-home.png)
- [只读自有数据库核对](database-readonly.json)：schema2、74项目。
- [私有授权对退休](private-pair-retirement.json)：两个原native launcher joined0、physical/output/request结算之后才删除auth/models；原授权源metadata未变。
