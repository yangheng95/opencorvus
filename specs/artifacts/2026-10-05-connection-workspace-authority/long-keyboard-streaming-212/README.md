# 212 长真实两回合：End 虚拟重测量失败

## Recall 与范围

沿用用户持续单 agent 自主体验、Sources/Rendering 改善及真实 GPT-6.1 Sol 授权。实施前[方案](../long-keyboard-streaming-plan-212.md)，原源码6e57d04d，隔离开发模式18132/ui，两段原始自然输入保留在live-01。完整凭据/模型目录配对，实际 preflight 分别证明 usable/projected/gpt-6.1-sol streaming；没有委托。UI（User Interface，用户界面）仅真实交互、截图及人工复核，没有运行 UI 自动化测试。

## 实际问题与深度

同一 ses_-zUSUvZPHzz4siKsGM2h 第一段长回答 Sources 回读随输出增长保持暂停，单卡 CtrlEnd 最终5190/height5825/client635/followtrue。第二段 Sources 视口暂停时最后卡未挂载，CtrlEnd 根据旧height6405导航。挂载后的[原失败](live-01/second-stream-control-end-b.json)是 height9159/client635/top5769.333/followfalse，第二段4091字符；[原截图](live-01/second-stream-control-end-b.jpg)显示第二段开头，而不是尾部。相同已完成scope的[到底按钮](live-01/second-explicit-bottom-after-failure.json)到8523.333/followtrue。

共享控制器只记短暂 down 意图，等浏览器到达当前几何底部才恢复 caller tracking；虚拟测量改变 maximum 后原旧目标不再是底部，而暂停状态正确禁止 ResizeObserver 自动 pin。211只修 modifier 识别，没有覆盖这一时序。213方案完整替换回调语义，由明确End先请求跟随，再让既有测量/帧调度收敛真实尾部；不是延长输入计时器。影响 Main、Side Chat、子面板三个共享消费者，不改模型流程或后端调度。

## 原资格结果与共享重试审计

原父工具29457退出1：OWNED_PROVIDER_REQUEST_INVALID。9次实际请求都为gpt-6.1-sol/streaming，其中8次200/settled EOF（End of File，流结束），一次503/http_error。不能把回答完成或 Native0改写成严格Provider资格通过。

真实处理器2026-10-08T22:33:31.353Z记录act_g0VXV4QxR00DKf9j5cYH的server_5xx attempt1/backoff2135.970ms，随后相同activityID/attempt的200继续并完成；503早期输入上下文不足，精确关联边界保留未知。全仓已审阅共享llm/activity分类/预算、session/processor清理重试及title/memory/vcs等collectLLMText入口，SDK（Software Development Kit，软件开发工具包）maxRetries由当前调用输入决定；当前实际证据没有显示调度/队列/恢复/终态异常。未弱化checker（检查器），未推测新增Provider修复。

## 闭合与限制

原Native在2026-10-08T22:41:39.564Z exited0，physical/output/request完整，早于固定600000ms；唯一public shutdown、原父工具1及独立出生身份/端口/凭据pair闭合均保留在live-01。自己页面27关闭，用户页面23保持。红acted当前19914日志行/unknown0、真实6消息/2 Source canonical记录来自只读原库；原私有runtime保留，凭据内容不归档。

第一段所谓first-stream-before-control-end实际已Not running，不宣称流式End通过。第二段失败时也已完成，不能用标签命名反推执行时序。原503资格失败及原UI失败永久保留，213新scope另行验收。
