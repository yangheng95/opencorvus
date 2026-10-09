# 245 Sources摘录缺字的实际数据边界

## Recall

用户要求持续自主迭代UI/功能、重点Sources显示及侧栏Rendering，最新只允许root单agent。244 adc18870f已正常推送，工作区干净；真实流式期间Source摘录图与canonical-source-prose中MDN元素名称呈空白，但title保留`<details>`。244 Native/foreground0、pair已清理且全退役，本轮不重启该scope、不使用user18107/IAB23、不创建branch/worktree/agent。上一goal turn为progress：生产显示修复、真实页面及正常闭合/提交推送均有证据。

本轮先追查摘录输入，不在界面猜测补标签或重写历史。目标确认完整来源事实与真实工具输出对应、当前唯一解析器是否忠实保留实际transport Highlights、远端本次真实返回是否本身缺字。由此决定本地修复范围，再进入Rendering的剩余实际视觉复核。没有生产修改，也不新增/运行UI自动化。

已读244 Recall/Source照片/完整canonical、SourceParts、message schema、urlSource、websearch-service、websearch Tool、exa-mcp、HTTP body owner/reader、source-persistence/processor、07-panel、TextPart/model/worker/renderer以及195/196历史调查。全仓相关定义和调用：webSearchSources→urlSource→当前Message.SourcePayload→persistMessageSources→SourceParts；snippet只是trim/min1 string，无格式字段。Exa Highlights解析只trim，HTML/text在MCP文本块join后直接substring/正则截取；readHttpResponseBody只聚合真实字节与EOF。SourceExcerptBody唯一`{source.snippet}`纯text显示，无HTML parser/innerHTML。搜索CLI曾因Windows路径通配符/猜测文件名失败，已改实际存在目录/文件读取，不能当作产品失败。检索发现overlay-ui-frozen-source.test是HTTP静态bundle serving/不可变资源身份协议检查，未操作浏览器、DOM或组件，不属于UI自动化；本轮不运行它或任何UI测试。

## 修改前分析与影响

可观察现象：244的search三条Source snippet标题/inline code缺`details`/`summary`文字，而Source title和实际webfetch结论正常。canonical原数据已经缺字，纯text reader未丢canonical内容。直接触发为展开MDN search snippet，不是Renderer pending；Source region读出的1700字符包含原Markdown标记和空code span，不能以标题推回全部正文事实。

根因证据边界：代码排除当前local parser/serializer/UI主动strip tags，远端原244HTTP正文未在该验收保留，不能把一次新的请求称为244原响应。本轮只读原实际Tool结果（当前production输出resolver）核对与canonical来源一致，再用独立公共Exa真实HTTP/SSE（Server-Sent Events，服务端事件）search请求及当前production parser核对新响应。无LLM请求或凭据复制；新查询内容来自244实际tool输入，公共请求不发送凭据，25秒单请求deadline，不循环重试或扩展；完整transport只保留ignored私有目录，公开报告只保留结果身份/长度/对应关系与少量诊断说明。

旧路径未根治原因：176/177阅读区域、235内滚动、239/241历史归属、244composer显示均不改producer文本；原Snippet是当前canonical事实不能用这些UI修复重建缺字。协议/SDK/API/事实表/Source identity/Tool结果/Provider配置不改。Task/Mission/Session调度与恢复未发现新异常，本轮数据边界调查不假称共享调度验收。风险：远端查询结果可变；新Exa响应只能证明当前上游行为，原244缺字只能在实际持久化Tool边界定位。无新format field时不可把任意snippet强行解释成Markdown或HTML来掩盖事实。

## 执行与剩余验收

先运行一次只读事实observer与一次公共真实response observer，分别保留实际工具输入/输出身份和新response/plain parser等价证据。helper错误保留并修工具后重跑相同必要契约；不把静态codec/来源文字检查冒充UI验收。Source照片使用244已经亲自查看的实际场景，本轮不宣称新UI视觉交付。

Current Rendering仍需实际在运行Side/子侧栏的卸载返回帧复核，196只缓存完成文档而streaming重建范围未证明；不得因本轮数据调查宣称Rendering全修复。完成证据后同步root/month/artifact目录README，docs/architecture检查，范围commit、fetch/merge完整待推送审查和普通push，goal保持active。

## 当前实际结果

observer实际0。原244 search输入是`site:developer.mozilla.org zh-CN HTML details 元素`/3结果，current production resolver读取completed原per_hhkMJMOyzNtKVlxW4Hpr的7730字符输出；canonical三snippet1700/1400/4142字符分别在原Tool output偏移170/2040/3588完整出现，空inline-code span13/22/20。实际原HTTP未保存，不能把原工具文本称为原raw HTTP。

一次不带凭据的新公共Exa请求在2026-10-09T17:24:12.923Z→17:24:14.928Z完成，HTTP200/text-event-stream、12054真实字节、7815字符文本、3结果。当前production parser的三个snippet完整出现在remote文本偏移189/2083/3673，空span同为13/22/20。这证明新响应在解析前已有这些空位，而本地当前解析、存储与纯text显示未造成此缺字；原244在Tool/Source边界已同样缺字，原上游HTTP仍未直接保存。新结果可变，不把这一次观察泛化为全部Source或全部Exa查询。

没有生产修复：不得以文档主题关键词补写canonical来源、猜测重新获取或强制把无格式契约的snippet转为HTML/Markdown。后续Rendering以真实运行/卸载/回到同一消息的帧和生命周期观察为准，Source原事实保留。本轮无LLM请求、新服务、auth/models副本或UI操作；完整raw仅ignored私有目录，公开结构化证据没有完整remote文档复制。
