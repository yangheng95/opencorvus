# 349 连续网页Sources与长子会话实测

[Recall及方案](../child-history-plan-349.md)。单一开发agent，唯一隔离产品研究员，真实Task `tsk_g00VXpnbRn00L81V59Oh`、worker `ses_huwYlKst4LVMvtJUgEta`，当前实际构建`main-enuOTKXR.js`。本轮没有生产代码修改，结果用于收窄下一轮调查。

## 新覆盖范围

以[36个独立问题](review-items.json)触发36次真实顺序webfetch，四个公开MDN页面各9次，每次读取后直接写一段可见正文。实际37个独立assistant Text Part、5682字符，含36题与开场，超过已完成Markdown缓存32份的数量边界。它不是把36个Source误当成36个正文。

负责人实际取得全部36段完整原文，后端检查逐段与规范存储原值相等：短段由分页inventory完整携带，较长段由field=text读取，最终段由selected message读取。不是拿preview标签或模型“已核对”的自述当证明。每次实际URL、工具完成输出、Source和公开事件也逐条对应。

## 13张人工查看的真实截图

| 截图 | 观察范围 |
| --- | --- |
| [01](01-early-sources-reading.png) | 早期来源与正文，实际复制完整URL并显示反馈 |
| [02](02-early-region-after-nine-sources.png) | 更多来源进入后，初始正文仍留在阅读区 |
| [03](03-middle-reading-anchor.png) | 将阅读点放在R05/R06和表格附近 |
| [04](04-middle-region-after-24-sources.png) | 24次来源后，旧正文与表格仍稳定 |
| [05](05-over-32-parts-before-return.png) | 实际35份worker正文已进入事件流，worker仍在输出，旧区域保持 |
| [06](06-first-return-over-cache-boundary.png) | 关闭重开后子侧栏保持R05/R06；此时worker已结束，负责人正在新一轮输出 |
| [07](07-agent-list-return.png) | All agents列表返回，子侧栏继续保持旧段落 |
| [08](08-completed-main-before-dock-toggle.png)、[09](09-completed-main-dock-closed.png)、[10](10-completed-main-dock-reopened.png) | 完成态主会话基线、关闭与开关重开，语义位置保持 |
| [11](11-completed-main-open-member.png) | 完成态通过成员卡片Open重开，同样保持主会话区域 |
| [12](12-original-mdn-target.png)、[13](13-return-from-original-source.png) | 点击来源实际打开准确MDN原网页，关闭自有外页后返回旧子会话段落 |

[人工几何观察](manual-reading-observations.json)不是UI断言。子侧栏top约1137.6、following=false，内容高度4637→6343→9117→9796期间、首次重开和成员列表返回都留在R05/R06。仅这些观察帧没有Rendering覆盖旧正文；没有全帧录像、数百长段正文或原Research Studio旧schema验收，不能宣称原问题全局解决。

## 主会话的新线索，未修复

05的主会话显示早期orchestrator说明和研究员进度卡，06/07却显示更早的用户长消息R20—R25。这个变化是真实截图差异，不是仅从scrollTop猜测。后续08—11在completed状态复做相同开关/成员入口时，orchestrator文本顶端约60.6→60.5→59.8px，语义位置保持，因此“侧栏宽度变化必然跳位”已被排除，不能据此给所有宽度变化加恢复补丁。

[真实阶段关联](checks/return-phase-association.json)表明：worker最后EOF为11:44:38.846Z；06截图11:44:43.958Z，负责人新reader已在11:44:42.538Z开始。05才是worker真实输出中的截图。下一轮应调查worker完成、负责人恢复、主会话投影/虚拟列表变化与Dock重开组合，而不是再次重复completed开关或盲目扩大Markdown缓存。

已读Conversation的saved reading anchor、treeEpoch preserve/重新绑定、Virtualizer的generation与focused-item保留，以及通用auto-scroll。现有保存以message/textIndex/offset定位，Dock开关没有单独重绑reader；但尚无本轮DOM owner或精确写scrollTop者的证据。Task与worker正常完成、负责人正常继续没有被判成调度异常，也没有修改队列或恢复策略。若后续证据建立共享调度/渲染队列异常，必须执行AGENTS的横向审计。

## 数据链路与收尾

[实际后端检查](checks/actual-qualification.json)通过：36段完整读取、36次webfetch与Sources、40个text流最终值与canonical的trimEnd合同相等。Task448813ms完成，47次授权openai/gpt-6.1-sol均流式HTTP200/EOF；凭据usable、完整catalog projected、实际模型分别核对。公开流4943事件，压缩379158字节、解压7317588字节。

创建器actual exit0，观察器69669 actual exit0，原启动15819 actual exit0；自己的138和139页面关闭，精确Native77744/Host14344/18326、输出、请求与复制auth/models配对均闭合，Native773412ms。所有固定原边界保留。125份监督原始文本完整打包；大JSON和日志使用[归档清单](checks/archive-receipt.json)中的精确gzip路径，脚本运行次序为archive→analyze→finalize，私有原件保留。53份文本及解压内容凭据扫描0。压缩一致性仅验证真实归档，不作源码哈希验收。

中途计数器最初按agent而非assistant role筛Parts，包含了一份真实委托输入；修正为精确role后重新检查，原记录及scope更正保留，最终37份与5682字符均来自规范assistant消息。没有新增、运行UI自动化测试，也没有用DOM文本/类型/构建代替视觉验收。
