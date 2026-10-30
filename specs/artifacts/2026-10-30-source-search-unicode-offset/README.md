# 来源搜索 Unicode 位置回归

[完整分析与方案](../../records/2026-10/2026-10-30-source-search-unicode-offset.md)。此批是纯数据算法修复，没有 UI 改动、UI 自动化或新的视觉验收；此前[原来源实页证据](../2026-10-30-source-conversation-find/README.md)仍按其原版本保留。

旧生产检索函数对含12个 `İ` 的原来源内 `needle` 命中，实际返回了下一个来源的 ID 和 `report.txt second target` 预览；[旧checker输出](tests-before.log)保留这个明确反例。修复统一转换后位置的单位，新正向用例验证原来源内部及前一来源发生长度扩展时的正确来源身份和预览。

[检查回执](validation.json)记录聚焦23项/49断言、类型和构建结果。[真实原快照回归](real-source-regression.json)重新读取前一批实际HTTP保存的完整file/web/Task原件，再进入当前生产解析和检索，3/4/68消息的来源命中与原正确结果相同。这是离线真实数据回归，不是新HTTP请求或端到端运行。

Provider请求0，没有新服务或认证/模型目录副本，用户进程和数据库未操作。
