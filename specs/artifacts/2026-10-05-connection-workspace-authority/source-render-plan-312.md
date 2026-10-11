# 312 来源侧栏 Rendering 调查

## Recall

用户持续要求深入体验并修复 Sources 显示及子侧栏反复 Rendering 闪烁，最新明确单 agent。311 已实际提交并推送 a0a4f9b3c5dc40c915e46a70169cdfab6ca8bfd7，HEAD/upstream/remote 相同且干净，属于 progress；四轮自有服务和页面全部结束。持续 goal active，不执行旧目标的委托措辞。

当前源码已读 TextPart、text-part-model、markdown-render/worker、CardParts、Card/ChatBubble/ConversationCard、SubagentConversationPanel 及 subagent-conversation 的实时事件和补全合并路径，当前07-panel。全仓查 TextPart/StaticTextPart/createMarkdownRenderer 调用及 Rendering 状态；实际 Solid 1.9.14 的 Switch/Match 非 keyed 分支按真假等价，不因 text 每个 token 改变而必然重建，已排除这个猜测。未运行 UI 自动化测试。

## 现象、候选原因与边界

用户原截图是旧 Research Studio 子侧栏，每段文字和工具来源之间可见 Rendering。当前版本仍有该初始状态，但现有 model 保留已接收 HTML，只有 pending 且 frozenHtml 为空才显示。来源和非来源连续分组用嵌套 Index；来源稍后插入若把已出现正文切到新组，可能造成组件重建。此为候选，尚无当前真实页面/事件时序证明，禁止据此修改生产代码。

Subagent live projection 接收所有 message.part.updated（包含来源），补全也按真实顺序键合并，所以“来源只靠慢请求补全”不能直接当根因。共享 Markdown worker 的排队/合并、当前输入身份及其消息/来源顺序均需实证；发现排队或恢复异常时立即横审主/侧/子会话、文档调用、正常/终态、重试与重启、串并行和项目隔离，不能先定为 Research Studio 特例。

下一步：当前正常构建下启动独立 /ui18281、NativeService 固定600000ms/20请求，已授权auth和完整models配对，先分别验证usable/projected/实际gpt-6.1-sol流式。只进入自己的现有预检会话和 Side chat，不创建产品成员、子 agent 或新工作树。真实模型按顺序输出数段文字、获取公开网页来源、继续正文、读取隔离项目README、继续长正文。手动查看多个阶段截图、展开来源及滚动；只观察真实状态，不注入来源/消息、不替换worker、不构造浏览器fixture、不做DOM或截图断言。

没有真实复现则记录观测范围和未知项，继续调查，不将若干截图冒充全部帧或原Research Studio live验收。若确认根因，先补齐调用/数据/测试/文档影响分析再修复。数据/队列契约测试与页面视觉资格严格分开，UI只能实际交互和人工看图。关闭自己的页和服务，原执行器actual join、独立Host/Native/port/pair清理、所有检查器结束后保管本轮生成文件。证据与月/根索引同步，文档检查、范围提交、fetch/merge及正常push。

## 本轮结果

真实两来源与4938字符原始正文完成，观察帧保留先前正文和读位，未复现反复Rendering。实际持久化时间线的两条来源均先于下一段正文创建，不支持本样本的迟到分组触发。无生产代码修改；下一轮应针对Subagent专有合并路径，而非据普通Side合格推断原问题完成。[完整证据与边界](source-render-312/README.md)。原33375已实际exit0，页81/Native66148/Host19412/端口/配对凭据均退休，goal active。
