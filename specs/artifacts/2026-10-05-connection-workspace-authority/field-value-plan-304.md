# 304 自包含流式字段值

## Recall

用户持续要求自主改善 UI/UX（用户界面与体验）、Sources 和 Rendering，最新人工约束是仅单 agent，root 独立工作。起始 c25ff58b8 已推送、git 干净。303 用完整 9714 条真实输入确认：HTTP（Hypertext Transfer Protocol，超文本传输协议）返回 4675 字符和 live 游标 3363，随后 3364–3366 只有“宣称背景”，缺失未落盘的 7 字符，直到完整 Part 3367 才恢复。错误投影进入 renderer revision 3；本次实际画面保持旧正确前缀后接受 revision 4，不能夸大为已经证明原截图所有肉眼闪烁。303 临时诊断全部撤除，三个服务/页面与原 exec 均闭合，正常构建已经复核。

## 根因与公共语义

已读 303 Recall、原始因果链、Message.Event.PartDelta、Session.updatePartDelta、SessionProcessor 的 text/reasoning 累加与 200ms checkpoint、ProtocolStore、Task/Session conversation 路由、conversation transport、主 writer、子侧栏/Side Chat projection、agent activity、CLI（Command Line Interface，命令行界面）、ACP（Agent Client Protocol，代理客户端协议）入口及当前架构。全仓定义/调用检索保留在本轮私有 delta-search.txt；没有委托。

当前 lastLiveSequence 明确包含尚未落盘的 text/reasoning 活动，Inspect 用它判断实际生成是否推进（inspect-benchmark 架构）。不能把它改成持久化游标，否则会改变另一个公共契约。根因是消费者将“当前持久化前缀”与“订阅后才收到的追加片段”当作连续字符串，而二者没有连续性保证。新增私有影子正文、最长字符串、按关键词修补、忽略 delta 或推迟显示均不能满足目标。

## 当前实现方案

将现有真实 message.part.delta 事件扩展为自包含字段更新：保留原始 delta 片段，并要求 value 为同一生产者当前字段的完整值。两个值来自现有 currentText / reasoningMap 累加器；不另建内容仓库、不合成 Message、不增加 Provider 调用。增量 field 当前唯一生产值是 text，Part 类型只允许 text/reasoning；统一使用 Message.Event.PartDelta 的 schema 作为 Session 写入参数，删除重复 schema。

主会话 writer、子侧栏/Side Chat projection 与 agent activity 直接应用 value。writer 的现有 50ms 合并只保留每个字段最后一个真实事件，删除“拼接片段再造事件”的旧路径。子侧栏移除 anchors/deltas 及字符串重叠猜测，完整 Part 更新清理字段覆盖，后续字段 value 为当前来源。CLI/ACP 继续按原始 delta 输出连续流，单条事件仍由同一真实参与者产生。缺少当前必需字段应明确报错，不保留旧格式 fallback。

Task replay 与 Session bootstrap 的共享归并保留最新完整 Part 和每个字段最新 value 事件，正常订阅仍接收每个实际事件；序列/epoch（进程轮次）、终态退休及过期语义维持。这样“设置 `”之后收到的下一个真实事件就携带“设置 `none` 就宣”，不依赖已经错过的片段。自然最终重写由原完整 Part 保持权威。

reasoning 在当前 Web transport 中被明确省略（projectConversationTransportPart 与 event disposition）；仍为其生产事件提供一致 value，保证非 UI 消费者及活动游标契约。已废弃的 tool/raw delta 分支不符合当前 DeltaPartType；真实 Tool 输入使用完整 pending Part，删除该触及范围内的旧分支，不扩大其他清理。

## 影响与验证

实施前复核更正：现有 DeltaPartType schema 仍包含 tool，虽然全仓生产调用仅 text/reasoning；不是已经限定两种类型。本轮同步收紧 schema 为这两种真实生产类型和 text 字段，并删除对应 tool/raw 消费死分支。SDK 生成器实际位于 packages/opencorvus/script/generate-openapi.ts，由 SDK build 切换 cwd 调用；它使用隔离 test runtime，finally 删除自身 runtime。先前 summary 对两处位置/定义的描述不准确，以实际源码为准。

公共事件 schema、SDK（Software Development Kit，软件开发工具包）生成物及接口文档同步更新。检索到的相关测试主要是 HTTP/消息身份/数据服务契约；不新增或运行 DOM（Document Object Model，文档对象模型）、组件渲染、源码文案、截图或浏览器 fixture 自动化测试。失效数据夹具按当前 value 契约更新，后端聚焦正向测试覆盖：真实 HTTP Provider 全字段值、迟到 Task/Session 订阅修复未落盘间隙、正常流、短终稿、取消/重试、并行项目、replay 保留/终态/epoch 与 Inspector 活动游标。

风险是事件体增大，尤其长正文；不复制 Tool 全输出或附加元数据，只传现有字段值，缓存按字段归并。实际 gpt-6.1-sol 长正文验收记录体量、完成时间与真实页面响应，不能仅以类型或 build 通过代替。使用开发服务 /ui、授权凭据与完整目录、独立模型预检、固定预算/时限及成对清理。人工在生成期间切换项目和关闭/重开子侧栏；必要的低负载诊断在正常构建复核前全部移除，保留原始失败。

必须横向核对 Task、Standalone Session、Mission、Side Chat、主会话/子侧栏、首次读取/重连/重启、串并行与项目隔离；同一 value 契约不依赖 Task 专用条件。全部修改完成针对性验证、文档索引/检查、范围提交、fetch/merge、完整待推送审阅和正常 push。持续 goal 不标完成。
