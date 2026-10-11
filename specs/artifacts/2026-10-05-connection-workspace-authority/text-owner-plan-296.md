# 296 子侧栏正文与 Sources 阅读调查

## Recall

用户要求持续自主改善 UI/UX（用户界面与体验），重点是 Sources 展示及子侧栏反复 Rendering；最新要求只用单 agent，本轮只有 root。295 已推送 3b54cfe59，当前干净，复现的三次 ResizeObserver 通知来自 Virtua 行高测量，不能解释原子侧栏闪烁。目标仍未完成。

已读 295 Recall、07-panel 正文/子侧栏契约、SubagentConversationPanel、subagent-conversation、ConversationCard、ChatBubble、CardParts、SourceParts、TextPart、text-part-model、SideChatPanel 和相关 CSS。全相关路径检索 Sources、TextPart、消息分组、挂载条件：侧栏用稳定 targetKey，卡片主体用非 keyed 布尔 Show，Markdown 保留已接受 HTML；尚无持续重挂载的直接证据。CardParts 使用位置 Index，来源单项/多项采用不同分支，可能影响插入时身份，但目前仅为待验证假设，禁止据此打补丁。原 ResearchStudio 数据仍存在当前 schema 不接受的额外 index，当前 DDL 和架构没有其定义；本轮不变更数据库兼容合同、不删旧索引。

## 方案、影响与验收

先使用已完成真实 Task 153 的完整历史，在独立 dev `/ui` 实际查看已有 researcher 的正文、三个真实网页来源、展开工具及切换 Dock。它证明真实子侧栏历史交互，不等同于原 719 消息 ResearchStudio 或实时流式通过。不会创建 Task、成员、Provider 请求或移交 auth/models。

复用 292 当前 Task 的只读启动检查，重新核实 schema、终态恢复前沿、精确原进程出生与配对关闭，然后完整复制 90 表。新端口 18252、固定 900000 ms，目标保留 300000 ms 收尾。截图人工复核为唯一 UI 验收，不创建或运行 UI 自动化。若需诊断，再先补充具体记录字段与移除步骤；只在有证据后修改唯一实现，补齐触发、数据流根因、旧路径不足、调用点及风险。

服务结束关闭自己的页面、正常 shutdown、原 exec 实际 join、独立物理关闭和完整存储事实保管；不操作用户窗口或进程。任何真实调度异常按共享机制横向审计。同步文档索引并执行文档检查，自己的变更必须独立提交、fetch/merge、审核全部待推送提交后正常 push。原 goal 保持 active。

## 已复现问题与实施前分析

18252/tab43 的真实 researcher 第一个 webfetch 原文，05 截图读到中段，内部 top=3732、height=359、total=21934；关闭 Dock 后重新打开，06 截图返回标题，top=0，外层工具仍展开。来源链接本身正确打开了独立 tab44 的 W3C 原页，已截图并关闭。原窗口布局尺寸在这次标签返回后改变，未将宽度变化或标题换行当作故障；读位丢失是在同一后续尺寸下完成的关闭/打开操作。

直接触发是 Dock inactive 使 requestKey 为空，真实 transcript 子树退休。292 只将 Raw/Readable、展开及 JSON 节点选择存入 toolPayloadDisplays，滚动仍属于被销毁的 DOM（文档对象模型）；旧修复因此保住控件而没有保住阅读点。当前 ToolPayload 唯一三个入口为 InlineToolPart 的 input/metadata/output，均已有 canonical Session/Message/Part/slot key。不改变隐藏面板的请求生命周期，也不增加文本缓存。

实施只为 ToolPayload 的实际内容容器恢复独立读位，值进入同一有界 toolPayloadDisplays 记录。复用既有 animation-frame 调度，初始化在内容挂载后恢复；记录必须属于当前对话和同一 payload，隐藏或退休容器不得把零读位覆盖进其他对话。用户主动滚动优先，展开到全文不重置下次预览的阅读意图。SourceExcerpt 的现有恢复实现作为比较依据，不改其当前合同。纯 UI 行为不增加自动化测试；真实关闭/打开 Dock、工具折叠返回及跨会话返回截图验收，types/build 仅为辅助检查。原实时 Rendering 根因仍未知，此修复不得宣称解决原问题的全部现象。

## 本轮结果与继续方向

修复后正常18253/tab45的真实网页输出top=2160，在Dock返回、工具折叠、全文展开收起、跨对话返回并重选成员后保持。既有tester的长JSON输出 Raw top=1440、Readable top=57.333332分别恢复。见本轮README及真实截图；types57554/build48998实际0。两个实例已分别关闭自己的页面、sole shutdown、原87932/2958实际join0、独立closure与19表/47生命周期保管0。原目标保持active。

下一轮需要调查主进度卡Open指针激活：在可见按钮上点击后侧栏未打开，卡片位置改变；同一控件键盘Enter可以打开。当前没有事件时序证据，未做推断性补丁。持续Rendering仍未知；本轮没有增加文本owner诊断，也不将历史阅读通过写成实时闪烁通过。
