# 251 原运行结果

全部命令通过 packages/opencorvus 当前声明的正式运行器选择具体后端文件，没有执行全量或UI（User Interface，用户界面）测试。

公共日志仅统一换行和行尾空白，完整原始日志私有保存，原失败/出口/数值与事实没有修改。新增本轮记录/索引后的[最终文档](docs-final.log)和[最终架构](architecture-final.log)检查再次实际0。

| 阶段 | 实际结果 | 证据 |
| --- | --- | --- |
| 修改前首次正式时间检查 | exit1，0pass/5fail，23次断言，14.75s；包含matcher和并发夹具清理故障 | [原日志](before-initial.log) |
| 工具链修复后、生产修改前 | exit1，1pass/4fail，26次断言，14.72s；中止通过，四个自然结束场景开始时间覆盖 | [原日志](before-reviewed.log) |
| 当前时间与相关回归 | 四文件分别5/10/6/3pass，全部exit0，共24项/108次断言 | [原日志](after-and-regressions.log) |
| 最后夹具异常清理补齐后的原五项 | exit0，5pass/43次断言，14.94s | [原日志](after-final.log) |
| 当前后端类型检查 | node/tsc --noEmit，原foreground（前台命令）6450实际exit0 | [原日志](typecheck.log) |
| 文档与架构 | docs:check 345ops/25groups，architecture-index 18篇，原命令各exit0 | [文档](docs-check.log) / [架构](architecture-index.log) |

原正式检查命令是在 packages/opencorvus 运行 `bun run test test/session/streaming-text-prefix.test.ts`；相关回归同时明确选择 `processor-producer-boundary.test.ts`、`processor-llm-activity-retry.test.ts`、`task-root-multistep-assistant.test.ts`。最后同一五项实际命令7118 join0。四文件检查原foreground87586 join0，没有用状态计数推断命令结果。

[实际Bun探测](matcher-probe.log)的最小输入为 `{time:{start:7,end:19}}`，执行 `expect(value).toMatchObject({time:{end:expect.any(Number)}})` 后，原对象end的typeof（类型）是object。测试时间检查现在在任何内容matcher前复制真实数字，比较持久Part、开始事件与完成事件的明确值，再执行既有正文匹配。只证明当前Bun1.3.14行为，不推断其他版本，也没有依赖升级或生产数据补丁。

五项本地Provider服务是实际TCP/HTTP（Hypertext Transfer Protocol，超文本传输协议）与流式响应，经生产SDK/processor/SQLite/Bus/Session SSE（Server-Sent Events，服务器推送事件）路径处理；属于后端真实运行检查。没有真实OpenAI凭据、新外部模型调用、网页/DOM（Document Object Model，文档对象模型）自动化或新视觉截图，不能将该检查冒充远端Sol和原ResearchStudio全帧验收。
