# 304 完整流式字段与 Sources 实际验收

## Recall

承接 [303 缺字输入链](../return-input-303/README.md) 和 [实施前方案](../field-value-plan-304.md)。用户要求继续自主改善 Sources、侧栏 Rendering 与产品体验，最新人工约束仅单 agent；本轮无开发委托。起始 c25ff58b8，工作区干净。

## 修复与共享范围

真实生产者现有 text/reasoning 累加器为每条 PartDelta 提供必需的完整 `value`；原始 `delta` 仍供 CLI/ACP 连续输出。主 writer、子侧栏、Side Chat、agent activity 赋值完整字段，删除片段合成及前缀重叠猜测。公共 schema 收紧至真实 text/reasoning 和 text 字段，并与 Session 输入、SDK/OpenAPI 同步。旧 tool/raw 分支已没有生产调用，删除后工具输入仍由当前完整 pending Part 路径负责。

共享 Session bootstrap / Task replay 保留最新完整 Part 及其后每字段最后一个真实事件，实时订阅保留实际事件。Task/Mission/Standalone/Side Chat 均沿用共同消息生产链；未修改调度、执行轮次、重试归属、任务终态、活动游标或 Provider 调用方式。跨项目、终态退休/重开、重连及新 epoch 用已有聚焦契约验收；未宣称本轮重启真实长任务覆盖所有业务组合。

## 检查与失败保留

后端 46 项：streaming-text-prefix 6、task-live-replay-retention 8、inspect-task-live-observation 2、conversation-transport-projection 13、session-event-connection-snapshot 11、processor-llm-activity-retry 6。真实本地 HTTP Provider 经生产 SDK/processor/message writer/SSE 路由验证未落盘片段错过后收到完整值，以及短完成、取消、重试、并行项目。

纯数据/身份/transport 服务检查 33 项：subagent-conversation-service 25、conversation-agent-live-activity 8。它们不创建 DOM 或渲染组件，不能替代下方人工页面验收。未新增或运行 UI 自动化测试。SDK 生成、后端和前端 typecheck、正常前端 build 通过，正常产物 main-1LYwgkry.js。

首次新增迟到订阅测试漏启生产 message bridge，等待不存在的传输消息并连带 afterEach 挂起。原 exec 26840 保留失败，精确关联 runner 70932 与 supervisor request 9efa269f-4af8-4216-93fc-976ce42da8bf 后通过其 cancel 文件收敛；CIM 创建时间精度比原生身份少三 ticks，首次严格比较拒绝，校验原命令和微秒一致后才写入。原进程最终 exit 1 已实际 join。修复测试启动并增加自己的 5 秒流关闭时限后，exec 64529 的 6 项通过，exec 7177 的另外 17 项通过；失败未改写为通过。

## 真实运行和画面

Task `tsk_g00VXkxIje00dDgoyv5N`、Project `prj_htf0WlhIOdQiKjFsOL9f`，服务 18267，正常开发服务 `/ui`。这是产品子会话功能验收，不是开发工作委托。凭据与完整模型目录分别预检，12 次实际 gpt-6.1-sol 请求全部流式、HTTP 200、源读取结束。任务自然完成 4m4s。

人工使用独立标签 64：生成中打开侧栏、关闭/重开、上翻 Sources、切换预检项目并返回、再次打开研究员正文、滚动查看代码与正文。截图已实际查看：

- [初始来源](01-source-running.png)：标题与域名直接可读。
- [重新打开后的正文](02-reopened-stream.png)：正文继续生成。
- [三条 Sources](03-three-sources-reading.png)：紧凑间距，第三条长标题自然换行。
- [跨项目返回](04-returned-active.png)：仍 Running，Sources 阅读位置恢复；此帧真实鼠标 tooltip 遮挡首条，不能作为无遮挡截图。
- [继续增长的正文/代码](05-active-body.png)：已返回后仍显示完整代码区及第九节。
- [点击来源的真实目标](06-source-destination.png)：Sources 链接打开 MDN ResizeObserver，标签 65 随后关闭。
- [完成后 Sources](07-completed-sources.png)：Completed 状态及来源保留；来源目标打开后浏览器返回画面比最初窄，不能称为相同 viewport 对比。

真实页面观察没有出现空白 Rendering 替换已有正文；这不是逐帧性能证明，也不把有限观察宣称为所有闪烁均已排除。

## 数据与风险

[公共流观察](live-field-observation.json) 收到 5551 个 Task 事件、4832 个文字字段更新。最长正文 Part `prt_g0VXkxVON00LC1KahQmK`，4529 个字段值连续，最终 7738 字符与持久化正文完全一致。两段前言的最后 value 含一个换行，当前 processor 的真实 text-end trimEnd 将其删除，所以原始精确比较为 false；这是已有自然最终重写，不是字段丢失。详见 [原始比较](field-values-canonical-comparison.json) 和 canonical-current-conversations.json，未修改原始观察以制造一致。

已发现明确成本：实际接收 53,141,140 字节，其中完整 value 累计 41,749,950 字节，原始片段只有 19,525 字节。完整值消除恢复歧义，但当前按每片段发送会随正文长度产生重复传输；下一轮必须继续优化共享发送节奏/传输，保持完整恢复和原始参与者事件，不增加旧协议 fallback。本轮不宣称性能问题已完成。

原 live exec 25887 exit 0 已 join，Native 75984、Host 52996 精确出生身份及物理结束验证通过，端口关闭，复制的 auth/models 成对清除。独立 closure-readback.json 和原始 join 收据保留。runtime 日志先按当前 Native 出生时间筛选并脱敏，再无损压缩；私有原件保留，实际 credential scan 为零。未提交凭据、未发布版本。
