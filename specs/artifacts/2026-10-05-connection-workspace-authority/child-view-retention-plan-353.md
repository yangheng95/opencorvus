# 353 同目标子会话保留呈现内容

## 当前恢复点

正式改动已在SubagentConversationPanel、inspector.css和架构07。历史诊断页146已关闭，原启动66890 actual0，全部Host/Native/端口/输出/请求已闭合；同一37正文在Dock/成员列表/Add菜单来回保持owner，读位1296/R06保持。真实跨Session切换才dispose37，返回重新取同目标并恢复1296。临时text-part-model诊断patch核对完整相同后已reverse，生产该文件diff为0。诊断构建63907/types27399、正式构建52430/types55660、CSS检查均actual0；正式asset main-sRwPZ07h.js。

live-01已经结束：原启动67543 actual exit1（Task资格失败），观察器81908 actual exit0并捕获14:14:55.847Z的task.failed。页147已关闭，Native44056/Host68428在14:15:01.447Z正常物理退出、Native exit0，完整output/request和auth+models配对清理闭合；原始failed.json仍保留初始父owner待清理事实，不能覆盖为成功。RunRoot C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-12/child-view-retention-353-live-01，Task tsk_g00VXqO7wS00Jmf0HdZh，project prj_hlWbZXzl9PZEG6Fs17DG，worker ses_h9aQ1aKN0qHWqIOhZfo7，request c0306f61-3dec-4c30-a6fa-3230a75b0bf4。没有活动运行或页面，不重建同一次运行。62/64实际请求，exhausted=false；本次失败不是预算或凭据问题。

最终研究员37段正文5499字符，36次webfetch/Source顺序和36题标题逐一验证，42个公开text流均对应持久化trimEnd。共有5条worker及1条orchestrator实际API错误；最后一条是负责人接续收尾时的结构化service_unavailable_error/server_is_overloaded，isRetryable=false。它造成Task.failed，负责人未读完全部36段原文；这两个原要求仍未满足。不能用HTTP200/EOF、研究员完成或Native正常退出替代Task成功。

正式图09—12均处在实际worker reader窗口；10在R03/top792、height4289时隐藏，约65秒后11仍top792、height5986且补入R21；12 End following=true可见R24及过载。13在Native退出后拍摄、明确标记离线，不算在线资格。全部13图片和动作时间已落盘。历史诊断459记录，首批child owner9—45直到真实source切换才退休；Dock/列表/menu期间保留。实际检查入口checks/actual-evidence.json。剩余完整脱敏压缩、docs、范围commit及push；后续重点核对过载的可重试契约和历史错误在已完成child中的显示语义，不把最后一条错误文本当成全局根因。

## Recall

用户持续要求自主迭代UI（User Interface，用户界面）/UX（User Experience，用户体验）、Sources与子Dock Rendering问题；最新只用单agent，覆盖旧goal多agent措辞。352为progress，66928db44a0917bf82683cb5022eddf5f98ad791已推送，787实际生命周期记录和7张实景证明：关闭Dock、进入成员列表均dispose37正文；返回按32份完成缓存命中之外重新排队。暖返回截图已是正文，模型等待不能等同可见闪烁时长。352全部临时诊断已精确移除，页面/进程/原句柄正常闭合。

开始有外部CI与多份后端测试改动，全部保留。已重读352 Recall/实证、SubagentConversationPanel、main唯一调用、RightDock挂载合同、共享Markdown/scroll及架构07，检索目标定义/调用/同语义实现。SubagentScroll只有局部一个调用；服务测试subagent-conversation-service覆盖API/有序投影而非DOM或组件，不作为UI验收，不改动它。当前路径未发现UI自动化测试。

## 根因与完整影响

requestKey把active可见性当成目标身份，inactive时null既禁用请求又令displayedConversation/Show清空，整个文本owner随之销毁。外层已forceMount仅保住数字读位Map。All agents的外层Show另有同样卸载。旧完成缓存只保32份/4000000代码单元，37份真实正文下轮流逐出；旧缓存与读位修复未拆开显示生命周期和请求生命周期。

目标身份仍由唯一subagentConversationTargetKey生成，包含authority/source/session/directory；active和成员列表仅决定是否读取。保留同目标已有呈现，不新增历史DOM集合、消息、Source、数据cache或fallback。来源/Session/API authority变化仍让旧值不匹配而退休。隐藏时原resource停止fetch、原AbortController取消在途读取、live入口忽略新事件、refresh controller原target置空；重新激活沿原游标补读。当前live投影仅随真实目标变化重置，避免隐藏时回退到旧HTTP基线。

滚动controller的生命周期改随可见活动effect，cleanup原controller后恢复时从既有32项Map读最近位置。Map仍只接受可见、active观察，并使用controller.readingPosition保留尚未完成的恢复意图，避免读取被隐藏布局压成0的物理scrollTop。没有第二套滚动/手势/计时器。成员列表只隐藏现有selector和selected-agent两层，显式[hidden]样式确保不被display:flex覆盖，列表仍沿原Show。真实目标更换仍keyed退休。

纯UI生命周期改动，涉及SubagentConversationPanel、inspector.css及架构07；没有API、数据库、模型、配置、工具契约或任务状态机变化。正常/加载/错误/重试均沿现有resource；不吞异常。共享worker/cache、主/Side读位保持不动。若发现调度/恢复/队列或终态异常，按全部Task/Mission/Session入口、执行轮次、重试重启、串并行及项目隔离横审，不把单一child降级为局部异常。

依据：[Solid resource](https://docs.solidjs.com/reference/basic-reactivity/create-resource)禁用空source而保留原value机制，[effect cleanup](https://docs.solidjs.com/reference/lifecycle/on-cleanup)在刷新与退休时执行，[HTML hidden](https://html.spec.whatwg.org/multipage/interaction.html#the-hidden-attribute)负责不可见内容的呈现语义。复用当前primitive，不引新依赖。

## 实施与验收

先实现正式机制，复用352同一临时text-part-model诊断并保留原patch，以相同349完整90表历史独立复制验证。fresh child-view-retention-353-history-01、18333/ui、600000ms固定窗口，无auth/models、新模型或Task重启。比较Dock、All agents、Add菜单、早期阅读、跨Session返回的真实生命周期及截图；日志仅说明owner和渲染请求，人工画面才是视觉证据。原exact Host/Native/端口、schema/config/recovery/lease/Task/Message/Memory前沿仍先重新检查，逐表完整内容相等，不构造假历史。

诊断移除后构建正式UI，再用fresh child-view-retention-353-live-01、18334/ui真实gpt-6.1-sol流式Task覆盖隐藏期间产生新正文/Source和重新显示补读。使用349相同36题独立webfetch及正常可见正文，唯一产品研究员是被测功能，不委派开发agent。授权auth与完整models配对，分别预检usable/projected/实际模型；累计64请求、原Task openedAt+900000ms、180000ms活动、Native1500000ms，均不续期。先准备创建、观察和收尾脚本；只操作自己的页面，未知创建按同request-id恢复。不能把静态历史通过替代流中验收。

不新增或运行UI自动化测试。所有截图实际呈现并人工查看；只读几何/真实API日志辅助解释，不做UI断言。类型、前端构建、CSS与docs只作补充。分别取得原启动、观察和创建器实际exit及模型/Task/Native/output/request/配对闭合，精确归档自己的生成文件，脱敏留证。任何未完成范围如实列出，不宣布全局原Research Studio问题已通过。根/月/目录索引、范围commit、fresh fetch/merge、完整待推送集合审查、正常push，goal保持active。
