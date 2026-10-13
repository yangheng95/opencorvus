# 389 成员刷新失败调查

[Recall与修前方案](../child-refresh-retention-plan-389.md)。单agent完成调查、实现和实际截图复核。产品内每scope只有一个被测只读委派成员，没有开发agent委托。

## 修复与视觉证据

SubagentConversationPanel现在让resource和呈现读取同一storage signal；原resource独占写入、保留error/loading/refetch。真实读取失败由局部Feedback呈现，已有完整targetKey匹配的正文和Source保持；初次失败明确提示重试。错误详情是有名称的可聚焦滚动region，沿现有诊断高度上限，完整内容可读而不占满侧栏。没有缓存扩容、消息合成、Provider或Source协议修改。

- 修前：[成功基线](before-initial.png)、[读取失败](before-failure.png)、[导航恢复](before-recovered.png)、[来源行定位](before-source-open.png)。读取失败实际退休child owner，错误重新抛出而局部提示未呈现；旧画面残留不表示组件健康。
- 第一轮修后：[错误及保留内容](after-failure.png)、[中文提示](after-failure-zh.png)、[明确重试](after-retry.png)、[Source打开](after-source-open.png)。[首次读取错误](after-first-load-failure.png)及[其重试](after-first-load-retry.png)由重新加载自有页面产生，避免已有资源值掩盖首次失败。
- 视觉返工：[详情溢出](after-details-overflow.png)占满侧栏，判为失败并保留。正式修正后[键盘详情末尾与仍可见的Sources](final-details-keyboard.png)：Tab实际聚焦region，End滚到完整错误末尾；[重试](final-retry.png)和[来源2—3行高亮](final-source-open.png)再次实页确认。正式bundle为main-hq8_CedM.js，无观察插件。

主agent逐图查看，未新增或运行UI/DOM/组件/源码文案/截图断言。before/after私有构建只添加被动日志，[观察汇总](observations.json)解释生命周期与另一项身份异常，不作为视觉自动验收。正式截图来自正常压缩构建。

## 运行与原始失败

[后台规范checker](runtime-review.json)核对真实delegate/read、child消息、Source绑定/范围、实际文件内容、GET中断与真实200恢复，独立核对Provider、Native及成对凭据收尾。before7、after7、final9次请求均实际gpt-6.1-sol、stream=true；HTTP200/EOF只表示传输结束，**不等于每条模型消息成功**。

final首条请求产生[真实服务过载](final-provider-error.png)，规范Message msg_g0VXw5bQC00gEr0LP7Tc仍finish=error/UnknownError。root在同一原Native预算内发送一条新的真实用户恢复输入，随后才完成成员记录和最终视觉。checker逐字段确认原失败Message保持，不能将final称为首次通过，也未修改模型重试策略。

三个原Native launcher48665/82346/67436及proxy5062/61794/3660均join exit0。本轮Target依次83024/77104/84648，Host84800/87316/86960。原Job、输出、request、精确进程与端口18413—18418完成后才清理复制auth/models；三个代理最终sockets0，页面8/9/10已关闭。固定600000ms Native上限与20次累计请求预算均未延长。

## 仍需解决

真实成员流式期间的共享身份异常尚未修复：同一child、同一inputMessageID的消息事件声明work，生命周期事件声明assistant，后续消息没有进入该轮messageIDs，产生多次missing canonical session。它发生在诊断断网之前；此轮观测只有初始hydrate，没有merge，因此排除本次旧快照覆盖猜测。Message bridge与lifecycle的共同持久身份来源需继续横审Coding/Chat/Work、Side Chat、无conversation metadata的Session、Task/Mission各轮次、恢复和项目隔离。不能通过客户端忽略异常、扩大查找或改标签解决。

本轮完成读取失败和详情布局的实现与上述实页验收。两个不同成员间切换未新增实页用例，完整targetKey检查与keyed退休路径保留；初次加载与整个页面重建已覆盖。原Research Studio全部Rendering闪烁、完整成员流式功能或所有Task/Mission场景仍未取得本轮资格。采用benchmark-debug-template的先分析/实证流程，UI人工复核按仓库约束执行，无发布。

最终typecheck、正式build、两locale目录结构、CSS token、docs:check与check:architecture-index均通过。416份完整归档解压字节核对通过，420份完整文本/归档凭据扫描为0。归档完整性与静态检查只支持各自合同，不代替上述视觉或模型消息结论。
