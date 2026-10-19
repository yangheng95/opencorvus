# 冷保存 CPU 剖析与异步命令查找

对应[Recall、根因与实施前方案](../../records/2026-10/2026-10-20-config-cold-cpu.md)。[完整结果](results.json)保留精确请求、项目数、检查与原生结算。

冷保存期间，三个同步 PATH 查找的文件探测占607/2494个互斥CPU自身采样。修改为同一锁定which库的Promise接口，保持环境、搜索顺序、缺失命令错误及原生完整结算；同步调用者仍使用原库同步接口，没有新缓存或查找算法。[采样摘要](profile-summary.json)使用原HTTP时间区间，不将不规则timeDelta或重叠inclusive数误算为CPU耗时。

| 原生验收 | 完整项目数 | 冷保存 | 恢复 | 保存中页面读取 |
| --- | ---: | ---: | ---: | ---: |
| before（CPU采样） | 75 | 20943.07ms | 5375.23ms | 17295ms / 200 |
| after（无采样） | 76 | 18065.63ms | 5345.65ms | 14649ms / 200 |

整体性能仍 **failed**：原10s/5s门槛未达到。采样与项目集合不同，不作为严格提速比较。真实frontend Config service→browser HostTransport→HTTP保存并完整恢复canonical，Ask保持；完整历史保留，schema仍2。两次实际gpt-6.1-sol流式预检通过；原进程/输出/请求与launcher均完整退出，私有凭据和模型目录成对退休，源授权metadata未变。

聚焦后端36例63断言通过，日志和类型检查在本目录；它们是局部合同，实际页面证据另列。原生spawn与Provider投影仍是后续热点。本批没有UI、schema或模型交互源码改动，没有UI自动化。

- [无采样首页截图](after-home.png)：实际保存中返回New chat，人工复核Goal入口与默认页布局。
- [无采样完成会话](after-chat.png)：真实OK、gpt-6.1-sol、Ask和Goal入口。
- [before阶段](before-cost.json)、[after阶段](after-cost.json)：累计跨度存在重叠，不能相加作墙钟。
- [只读数据核对](data-verification.json)、[私有授权对退休](private-pair-retirement.json)。

完整CPU文件、开发日志、Provider正文与配置快照仅存私有验收目录；归档前扫描实际凭据值。
