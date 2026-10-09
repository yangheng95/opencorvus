# 243 Side真实正文部分帧与固定期限失败

[Recall](../side-render-live-plan-243.md)。root单agent，当前10fdb8e8e/main-Doi0GY4K.js。新独立R2026-10-10/side-render-live-243-live-01、Native18177/own84；授权auth/OpenAI entry与完整models成对，usable/projected及实际gpt-6.1-sol/stream200/reader EOF分别记录。原243不延期/重启/恢复预算。

## 已取得的真实UI证据

[Main资料](live-01/main-source-ready.jpg)：MDN details简短结论285字符，search3+fetch1共4真实Source。新Side ses_-zUSQd2BwzzZFB371NBg继承4消息/4 Source，两个新请求生成2191字符（六段/表/JS）和2006字符（4数据行/八节/JS）。原Source共8和Tool4包含继承副本，不算新独立检索。

[第一个Side请求接受](live-01/side-request-accepted.jpg)真实User bubble与Working已出现；[名为early的图](live-01/side-body-early.jpg)16:15:59实际在该回复Source reader EOF16:15:52之后，属于终态代码区域，不作为流式中段。

[第二个Side请求接受](live-01/side-followup-accepted.jpg)16:18:52；[实际部分正文](live-01/side-followup-partial.jpg)16:19:23.513，早于Source reader最后字节16:19:36.070。Working/Stop仍存在，AX记录表头+4数据行、八节中只到第六节未完成raw tail；亲自看截图中的第5节已格式化、第6节正在追加。这一语义阶段没有被Rendering占位替换，不扩大为全帧结论。该截图的表格在当前屏幕上方，AX只能证明当前结构，尚未亲自看到表格全区的布局。

新体验问题线索：[接受图](live-01/side-request-accepted.jpg)及真实partial图中的已接受请求仍留在禁用composer，和唯一真实User bubble重复呈现，侵占侧栏阅读高度。SideChatPanel.send等待同步/message HTTP完整LLM结果后才按同quotedPrompt清理draft；disabled绑定sending，当前display未使用既有canonical User Message的接受事实。现composer-draft唯一store同时保留text/quotation/submission messageID以支持失败重试与reload，所以后续修复不能提前删除这些事实；先完整分析UI派生/全调用/quoted编辑/错误与选择所有权，再独立方案处理。不是注入重复Message，也未在本轮改生产实现。

## 原失败和完整闭合

[名为reading-during-stream的后图](live-01/side-followup-reading-during-stream.jpg)16:20:46已Offline/Side needs attention，晚于固定期限16:20:28.824与Native16:20:28.945，不能当在线阅读保持或终态视觉通过。根因是root在验收期间未及时关闭自有服务，达到已预设600000ms的诊断Native deadline；不是把固定安全边界归为生产Task调度异常。Original Native38092/Host74124 terminal deadline_exceeded/exit1，原fore54704 exit1 OWNED_QUALIFICATION_BOUNDARY_REACHED完整保留，normal NativeService资格未达成。

Provider审计实际11/12、exhaustedfalse，全部gpt-6.1-sol streaming200/reader settled EOF；两个Side请求finish stop/无Message error，均在固定期限前完成。Provider通过与原Native1分别报告。后续sole shutdown只完成加入原settlement与auth/models副本清理，不转换Native1；独立retired-closure-readback保存exactbirth/port/pair/physical/output/request以及failed资格。当前物理资源已经退役、自己的Page关闭，user IAB23/18107未操作。

完整脱敏archive/facts实际0，15611新canonical日志unknown0；当前Tool outcome metadata用production completedToolOutcomeOutput/drizzle正确读取deferred/inline输出。所有运行观察器完成后按exactbirth/absolute bounds归档自身五个Bun文件。actual-frame-provider-timeline.json以真实截图文件时间、原reader首末字节及Native期限区分各阶段。

本轮英文浅色桌面限定partial帧，未完成全帧Rendering/在线向上阅读/完整表格区域视觉/正常Native0。目标保持active，下一项处理已证实的accepted prompt重复占位及继续视觉复核；不声称总体通过，不修改旧scope期限或历史失败。
公开AX诊断文本只规范化reporter行尾空格，原AX完整文本留私有；原图/时间/Message内容不改。首次cached diff检查因五行尾空格拒绝，修正格式后重跑，不绕过hook。首次误续执行的push没有待推送commit，返回Everything up-to-date；此记录当时尚未提交，不能算该次已交付。
