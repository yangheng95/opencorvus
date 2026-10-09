# 231 共享文本真实流式验收

## Recall

用户要求持续自主体验修复UI（User Interface，用户界面）/UX（User Experience，用户体验）/功能，重点Sources与子侧栏反复Rendering；最新只使用单agent，禁止委托。已有OpenAI auth及相邻完整models复制、真实gpt-6.1-sol验收已授权。bd524d0e上一轮已推送，起始工作区干净，前轮为进展。用户IAB（In-App Browser，应用内浏览器）23/18107不动，不新建branch/worktree或发布。

已读230 Recall/结果、102原根因方案、07-panel共享Markdown/子侧栏合同、TextPart/model/worker/render service、ConversationCard/ChatBubble/CardParts、SubagentConversationPanel刷新和投影路径。Rendering唯一呈现位于TextPart；102已按真实input去重并限定初始pending，ConversationCard按branch而非projection object保留owner。当前没有新的重复闪烁帧证据，不根据原附件、名字或单次loading断言根因，不删除真实loading/error遮蔽问题。

指标：一次新的普通Chat自然流式回复中，完整段落/表格/代码/真实Source按原顺序可读；实际观察初始、多次追加、terminal转换并人工查看截图。阅读已显示段落时位置稳定、真实Scroll to bottom恢复；最终Source直接打开原文件正文。未观察帧、live子侧栏（本轮不启动子agent）、Tauri GUI（Graphical User Interface，图形用户界面）和全主题/语言矩阵保持未知。DOM（Document Object Model，文档对象模型）诊断、HTTP（Hypertext Transfer Protocol，超文本传输协议）200、类型不是视觉验收。

## 修改前深度和影响

现象：230历史直接引用改善有证据，新的append尚未资格。触发点为实际Provider delta、text→tool/terminal、Transcript刷新和locale generation。数据流为canonical Message/Part→保持branch的ConversationCard→CardParts稳定位置→同owner text-part-model→唯一worker/动画帧mount。仅初始尚无accepted HTML/live tail显示Rendering；equal text/mode/locale/localeSeq在revision/pending前返回。worker/html缓存键含真实copy label/icon/link输入，现有稳定内容没有在每个delta主动清空。102根治当时冗余equal-input和已接受内容旁pending；新重挂载/虚拟驱逐是否存在未知。

当前根因未知，不准入生产修改。共享影响为Main/Side chat/子侧栏与StaticTextPart/文档同一renderer，SourceParts231不改，保留230身份与动作。API/Provider/model/持久化/调度/队列/恢复/权限/错误合同不改；无新调度异常，如观察到立即按全部Task/Mission/Session生产入口共性横审。UI不新增/运行自动化测试，触及路径相关现存UI自动化测试应删除不运行；非UI修复若实施必须先补完整影响和聚焦正向测试。文档/spec交付与正常提交推送包括失败事实。

## 当前验收方案

EOF（End Of File，流结束）资格为真实response reader已读取完整流并终态settled，不能用HTTP200或首token替代。

先准备关闭/脱敏归档/精确birth文件归档，再fresh NativeService：R=C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-09/render-stream-231-live-01，18159，B/render-stream-231/live-01。成熟live-sol-launch.ps1/live-sol-cli-owned.ts、builtin Base、累计12个Provider请求含真实预检与memory，固定600000ms，不延长或重启原scope。stageDiagnosticProvider复制授权已有OpenAI entry与完整相邻models；分别复核credential usable、catalog projected、actual gpt-6.1-sol streaming200/EOF后才发送新UI请求。凭据不入prompt/log/spec/Git，唯一内存redactor脱敏。

正常开发serve `/ui`、当前main-DuXM4N1d.js实际200，只发一次新普通Chat：只read本scope正常生成的README.md，依据真实标题提供Markdown Sources体验评审建议，含分段、表格、代码例和原文件引用，禁止写文件/外部浏览/委托。真实operator→model/tool自然产生回复和Source，不造SQL/messages/source/fixture；人工分次查看追加/terminal，不用UI断言、截屏循环/基线/浏览器测试。

交互完成立即关自己的页面，sole public shutdown、原foreground/Native实际0、physical/output/request/pair及独立birth/port；实际累计Provider model/stream/status/EOF与canonical Session/message/part/source/tool脱敏归档。NativeService不冒充Task lifecycle。全部observer结束才按精确target birth与绝对workspace边界单独归档自己5个Bun文件。失败保留first error/actual code，不延长或伪造green。

实证决定下一步；未复现不做猜测补丁，仅提交证据。若需实现，先补分析/方案、关闭当前scope、精确preimage，再修改/类型/build/docs和新的独立after真页面。同步spec/root/月/B索引，当前docs:check、范围commit、fetch/merge upstream、完整待推送集合复核及正常hooks/push，持续单agentgoal active。

## 实际结果

fresh scope occurrence=render-stream-231-live-01-ec6f40fd-ecfd-44b5-988b-a41afa354d88，host62996/target69788，target birth win32:639271324332603055；ready/preflight/authority分别证明credential usable、完整catalog投影和actual gpt-6.1-sol stream。current bundle200。UI65实际Code/Chat发送一次真实请求，新Session ses_-zUSSQjEPzzcHPHmHT48、Project prj_hiXMQlf8gddMQG4rcDHg，唯一read自然产生source-file prt_g0VXXZIDk00UgY4fqQr8 / msg_g0VXXZH1w00UkYZ3y472，原46bytes README完整一行无range，不伪称1–12。自然长回复prt_g0VXXZJv700r7LkwqkQd实际2712chars，模型意见明确与原README内容分开，不将模型建议作为功能已实现证据。

实际查看初始processing空页、read/Source、running时完整段落/首张表格与活动尾部、向上阅读、后续追加和terminal转换、Scroll to bottom按Enter、末段/第二代码区、原Source按Enter→File实际原标题正文、关闭dock后第一代码段。9张截图均实际呈现并人工查看。08:49:51.213Z还running，08:50:13.810Z已terminal，两次截图停留同一节2/表格；辅助只读geometry为top540→540、height2440→2703、client635，呈现文本2111→2533。geometry只是解释实际截图，不作UI断言或视觉替代。

所观察追加/terminal/Source键盘/阅读转换正常，本轮没有复现重复Rendering；不推导全部帧、live子侧栏、>80消息虚拟驱逐、locale切换或Tauri GUI全部通过。无生产补丁，避免未经实证改动真实loading/error。同名检索找到subagent-session-records.test.ts和subagent-conversation-service.test.ts，读取imports及目标关键字后是纯投影/transport服务测试，无组件/DOM/browser/UI文案断言，保留且未运行。

UI65关闭后立即sole shutdown；08:52:13.326Z Native reason=exited、actual0，原foreground48529 actual0，qualified NativeService记录5个请求全部gpt-6.1-sol/streamingtrue/200/reader settled+EOF。2个为预检chat/memory，3个为新UI read/reply/memory，长回复370实际chunks；累计12预算未耗尽。独立精确birth/端口/pair全部关闭，复制auth/models在physical/output/request之后清理。完整canonical原Source/prose/tool与脱敏运行/请求、真实配置/目录事实归档。

归档工具问题保留于toolchain-repair.md：已完成实时脱敏归档后误调用历史copy归档器，其要求本NativeService不存在的launch-arguments.json，在写独立closure后退出1；当前实时归档器不作此历史契约，保留原错误和partial receipt，真实NativeService closure原生合同重新检查实际0。补充canonical查询最初错误假设provider_activity_request含session_id；读取现行session.sql.ts定义后改为assistant_message_id→message真实join，原错误日志保留、原完整查询重跑0。没有因工具失败弱化Native或视觉验收，未制造缺少的历史launch事实。

docs:check实际0（345 ops/25 groups），全部observer/检查器终态后，09:03:28.8633531Z只归档精确target birth的5个Bun生成文件，原terminal=exited/0保留。范围提交、upstream同步与正常push随后完成；长期goal单agentactive，新stream子侧栏和全调用者尚未满足，不宣称原用户全部问题完成。
