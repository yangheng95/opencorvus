# 真实后端检查与原失败

这些检查验证后端数据及协议，没有 UI（User Interface，用户界面）自动化、组件、DOM（Document Object Model，文档对象模型）、快照、浏览器夹具或截图断言。真实 OpenAI 验收和人工照片另见 review-01，不能由本地 HTTP Provider 替代。

| 原运行 | 实际结果 | 解释 |
|---|---|---|
| before-checker | 1 | 接受 text-start/delta 后没有完整持久前缀，1500ms 语义无进展失败 |
| after-checker-01 | 0 | 原 checker 通过，late Session 连接获得前缀，同 Part 最终正文和原 delta 完整 |
| after-checker-02/03 | 1 | 扩展夹具不合格：ReadableStream.error 被客户端当正常 EOF；先完成项目的全局 disposal 中止另一项目 |
| after-checker-04 | 0 | 改为真实 Node HTTP socket 断开，两个项目都完成后再清理；5 项、19 次正向断言 |
| after-checker-05 | 0 | 完整性时间 guard 落地后的最终源码再次跑同 5 项真实后端契约，全部通过 |
| regression-01 | 0 | 6 项活动重试、10 项 producer/Tool 输入边界、10 项会话连接及跨项目事件，共 26 项 |
| types | 2 | TextPart.time 可选，失败收敛需要显式验证开始时间 |
| types-02 | 0 | 加入完整性错误契约后，后端类型检查通过 |

原夹具失败依据实际 assistant error 与 Instance.disposeAll 调用排除，未通过生产补丁迎合测试。日志是实际运行的脱敏副本，仅规范换行；原件保留在忽略目录。新检查使用生产 Provider SDK、流式 reader、processor、MessageStore 和真实会话事件入口，不替换 LLM 函数。1500ms 由真实 Part/delta 接受事件重置，总 30s 仅作安全期限。
