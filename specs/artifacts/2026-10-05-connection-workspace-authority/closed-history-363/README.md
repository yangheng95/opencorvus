# 363 折叠历史与来源读点

[Recall与方案](../closed-history-plan-363.md) · [实际运行检查](checks/runtime-qualification.json)。单agent修复共享阅读锚点误选折叠参考历史的问题，实际Main、Side与已有成员侧栏复核完成。长期迭代目标继续active。

## 根因与修复

原Side在380px阅读当前来源1，其视口偏移15.3875px；切到文件页、缩至281px后返回，偏移变为39.0375px，稳定后仍下移23.65px。[原读点](02-current-source-top.png)、[错误恢复](04-return-narrow-first-source.png)、[稳定后](05-settled-narrow-reading.png)。当前Source属于真实msg_g0VXr0t7800mDnbQL22P；原capture首先遇到的却是closed Reference history内msg_g0VXr0mzY01832d0dpL5正文。不可见正文的偏移51.925→52.0625px被保留，而可见来源被移动。02/04 JSON保留全部候选、details祖先及矩形，未把非零几何等同可见。

[HTML标准](https://html.spec.whatwg.org/multipage/rendering.html#the-details-and-summary-elements)说明关闭details的内容槽使用content-visibility:hidden，其布局查询仍有可观察结果。旧实现只检查height和视口范围，遗漏了原生折叠语义。357解决的是内容身份替代纯像素，241保存外层展开状态，均没有这个可见性判据。

conversation-reading-anchor.ts增加唯一私有readingRect，在capture候选/正文块与resolve目标中排除closed details非summary内容子树。原summary和open内容仍使用既有几何，Source/Message/block身份、Map、scroll owner和临时目标未准备的null等待合同保持；没有新状态、滚动写入者或服务端/消息改动。

## 实际复核

| 表面与操作 | 原内容与实测视口偏移 |
| --- | --- |
| Side当前来源1，380→File隐藏→281 | [06](06-fixed-current-source-top.png)→[08](08-fixed-return-narrow-first-source.png)，15.3875→15.0375px。真实原失败步骤重新执行。 |
| Reference history打开并展开原64来源，281→File→381 | [10](10-inherited-sources-reading.png)→[11](11-inherited-source-wide-return.png)，同一继承来源1 −1.175→−0.825px。 |
| 再次折叠history并关闭/重开Dock | [12](12-current-after-history-fold.png)→[13](13-current-dock-reopen.png)，当前来源1 offset37.7875/scrollTop360保持，隐藏内部来源仍保留其展开状态。 |
| Main来源，560.2→942.2 | [15](15-main-source-before.png)→[16](16-main-source-wide.png)，同一来源1 25.25→25.60px。 |
| Main普通正文，560.2→500.2 | [19](19-main-prose-narrow.png)→[20](20-main-prose-resized.png)，msg_g0VXr050D00YReL7dCiK为唯一可见候选，段落offset−81.15px保持，following=false。 |
| 已有成员来源，380→File隐藏→281 | [21](21-child-source-before.png)→[23](23-child-source-return-narrow.png)，同一原来源1 offset1.9375px保持；[22](22-child-file-narrow.png)确认乙文件真实第2行。 |
| 已有成员正文，281→列表隐藏→381 | [24](24-child-prose-paused.png)→[25](25-child-prose-wide-return.png)，msg_g0VXpiqni00xqhluBfMz同段−26.3125→−26.45px。 |

全部25张编号截图均由root实际查看。02/06/10/12/21的悬浮提示遮到中部，首个目标仍清楚；返回图复核目标完整身份/位置。01初版观察的重复对象被工具序列化为Circular，保留原值且不作firstVisible依据；02起修正为只存单份候选。14仅来源定位中间帧，17在底部夹取、18还有Source可见，不用它们冒充明确文字锚点回归；19/20才满足该边界。观察的firstCandidate字段仍按原DOM顺序罗列隐藏几何，描述原布局，**不是修复后内部已选择的anchor**；修复是否有效由真实返回位置与代码控制流共同证明。

## 完整历史、检查和收尾

before/after来自原356-live-02真实完成会话，分别重新以当前schema/config/recovery/Memory/物理终态准入并完整复制90表。child来自原348-live-01已完成Task tsk_g00VXpiXcz00KjYqx3vV及child ses_ho9Gh33iZxyYclSMkLkj，也完整准入/复制。没有新建开发agent、成员派遣、Task重启或Provider请求；历史副本不带auth/models，页面Model configuration unavailable是该只读副本的真实状态。

| scope | 原启动handle/exit | Native耗时 | 实际HTTP200前端 |
| --- | --- | --- | --- |
| before /18361/页179 | 26239/0 | 188244ms | main-Fa0QkExU.js |
| after /18362/页180 | 96378/0 | 410460ms | main-DuDwFuGN.js |
| child /18363/页181 | 31168/0 | 233220ms | main-DuDwFuGN.js |

三个固定600000ms独立scope均先关自有页面，再公共shutdown并实际join；Host/Native、输出/request、端口及无凭据状态均有回执。精确本轮Bun pile在原进程闭合后逐文件核对路径/出生再归档。实际runtime checker直接比较原完整Message/Source：before/after各11 Message/192 Source，child13 Message/66 Source逐值相同，同时核对实际服务asset HTTP200/Native终态；这是运行与数据完整性检查，不是UI自动化或源码摘要验收。

before build8457、after build91635、typecheck4302均实际exit0。docs:check/architecture-index采用当前package脚本；不增加或运行UI自动化测试。after-frontier脚本一处process root路径遗漏先被真实隔离检查拒绝，修正后原checker/准入/完整copy通过；runtime checker首次误用前一批asset名，依据本轮build日志与真实HTTP纠正后重跑通过，两个失败日志均保留。一次观察JS括号错误发生于输入执行前，不称产品故障。

其他浏览器、极端嵌套披露和原Research Studio全部工作流未穷尽；本轮未重新执行流式Provider验收，362独立记录当前流式交叠范围。359跨网站首次复制异常仍未知。静态类型、模型自述、hash或工具绿色结果都没有代替实际截图。
