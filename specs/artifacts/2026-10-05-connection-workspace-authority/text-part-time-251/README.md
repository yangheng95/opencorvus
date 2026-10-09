# 251 正文时间修复

自然完成正文现在保留实际 `text-start` 的开始时间，只在原插件完成和前缀队列闭合后追加结束时间。原代码在 `text-end` 把开始时间也改为当前时刻，导致真实长正文的持久时间跨度为零。正文仍由同一生产 SessionProcessor、SQLite 和 PartUpdated（片段更新事件）写入，没有改动历史数据、公开类型或界面时钟。

- [Recall、原事实、全部调用与修改前分析](../text-part-time-plan-251.md)。
- [真实检查及原失败](checks/README.md)。
- 原 249 的 [3295 字符正文持久时间](../completion-duration-249/live-01/live-canonical-metadata.json)保留为修改前证据，历史值没有回填。

当前正式后端运行器执行真实本地 TCP（Transmission Control Protocol，传输控制协议）Provider、生产 SDK（Software Development Kit，软件开发工具包）、流读取、处理器、持久化与事件；五项时间契约及直接相关回归共24项/108次断言通过。测试夹具最后补齐处理器异常时的 finally（必执行清理）屏障后，五项重新执行，43次断言、14.94s、exit0。长/短/重试成功/中止/双Project覆盖当前开始时间保持和事件一致性，后端类型、文档和架构检查为辅助验证。

第一轮验收的原始五个失败保留；工具链核对后再次失败为1pass/4fail，均是自然结束开始值覆盖。Bun匹配器会改写收到的对象字段，数值先复制再匹配；并发fixture（夹具）实际join（等待完成）两处理器后才让任一memoryProject清理全局Instance。没有静默删掉断言或将工具失败说成产品成功。

最新单agent要求继续适用，没有新Codex委托。这里是生产后端链路检查，不是新OpenAI远端验收或网页视觉验收；本轮无生产UI（User Interface，用户界面）改动、无UI自动化。实时原ResearchStudio子Dock全程Rendering仍未验证，新增应用子执行的范围问题仍待回复，持续目标未完成。
