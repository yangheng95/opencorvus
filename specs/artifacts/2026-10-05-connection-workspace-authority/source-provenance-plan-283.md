# 283 长章节来源的域名可见性

## Recall

用户要求持续自主改进 Sources、侧栏 Rendering 和整体体验；最新明确只用单 agent，覆盖旧 goal 的多 agent 文案。本轮仅 root。上一轮4485b0f39已提交推送且工作区干净，真实修复Tooltip焦点滚动关闭与外层拦截点击。原Research Studio历史schema不符合当前公开契约，不能重写旧DB或把普通Side当原子侧栏验收。

已读AGENTS、benchmark-debug-template技能、272/282 Recall及实际结果、102原始调查、当前07-panel、TextPart/model/worker/service、SubagentConversationPanel与CardParts。当前Rendering仅在pending且没有已接受HTML时显示，隐藏子面板会退还当前正文owner；尚无新实际证据支持再改渲染机制。继续跟进原范围，不新增猜测补丁。本轮从已呈现的282/live-04/02-first-return.png发现来源域名在长章节下消失，优先修复这个真实可见问题。

## 根因与影响分析

SourceParts.location在281为区分同页章节改为hash在前、host在后。现有共享location样式只显示两行；长text fragment占满两行后，网站身份被截掉。282完整截图已经显示该前态，短章节正常。208让域名可见的契约因此被281章节顺序破坏；Tooltip完整网址可访问不能替代常驻来源辨认。

全仓搜索source_open_web、msg-source-chip__location、hash/host、decodeURI和相关Source调用，唯一可见位置生成器在SourceParts，CardParts的Main/Side/子会话共同消费。修复只调整现有位置串为host在前、hash在后，保留两行上限、原章节字符、完整Tooltip及锚点href。可访问名称消费同一位置串，无额外状态、缓存、字段、接口或第二实现。域名正常优先显示，长章节余量继续截断并可聚焦查看完整地址。文件/文档分支、来源身份、URL canonicalization、Provider、调度/队列/终态均不改；没有当前调度异常，不把UI渲染误报为后台调度根因。

纯UI改动不新增/运行UI自动化或镜像后端测试。检索到的overlay服务/记录测试未运行；当前目标路径未找到组件/快照测试。不会扩大为URL解码或历史内容重写。

## 实施与真实验收

先落盘本方案和索引，再修改唯一位置串及07-panel顺序契约，正常overlay类型与build:vite。使用新R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/source-provenance-283-live-01，E=source-provenance-283/live-01，正常dev/ui18230，沿用成熟NativeService固定600000ms/12累计请求。授权auth与完整models配对，分别检查凭据usable、模型projected和实际gpt-6.1-sol streaming；原282同一真实三地址请求，不创建Task、成员或委托。

Root在真实桌面页面查看三来源，短章节仍有区分、长章节域名在截断之前可见；原生键盘提示与鼠标真实章节导航继续有效。截图和人工复核为唯一UI验收，不把DOM记录或类型检查当视觉通过。原子侧栏Rendering、所有宽度和URL极端组合仍独立未验。

关闭自己页面、唯一shutdown并actual join原前台；独立核对精确出生/物理输出请求/端口/auth-models退休，所有观察器结束后保管自己五个Native产物，目标提前四分钟收尾，不因观察超时重启或延期。公开证据脱敏，当前文档/架构检查、范围提交、fetch/merge上游、完整待推送审查后正常push。持续goal active。

## 实际完成情况

当前main-BfOrDdlz.js真实三来源、网站/章节显示、键盘完整提示、普通鼠标章节导航、返回焦点和Escape通过Root人工截图。7Provider EOF/3fetch completed/3原URL一致；原前台19994 actual0，独立收尾剩481014ms，全部自有页面关闭、凭据对退休及五自产物保管完成。build79534/typecheck56501 actual0；完整结果、一次编排提前退出及正确补齐的原事实见[source-provenance-283/README.md](source-provenance-283/README.md)。仅本轮Source范围有资格，原子侧栏Rendering继续未验；待范围提交/正常push后下一轮。
