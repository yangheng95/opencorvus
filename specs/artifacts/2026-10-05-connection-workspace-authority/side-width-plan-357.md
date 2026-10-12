# 357 来源窄侧栏阅读复核

## Recall

用户要求持续自主体验UI/UX（User Interface/User Experience，用户界面/体验）、修复Sources和Rendering问题；最新人工要求只用单agent，旧goal中的Astra并行要求已被覆盖。356为progress：4f6a38e8b已正常推送，Main来源宽窄读点修复和真实Main/Side各64来源、复制/行定位/返回完成；当前git仅有他人已授权CI记录改动，保留不动。整体目标继续active。

已重读356 Recall与结果、07-panel-reactivity，SourceParts完整实现/身份/文件标签与目录去重/复制/摘录、Main阅读位置、Side与Subagent的readingPosition入口、setupAutoScroll使用点；全仓SourceParts、msg-source样式、i18n和历史Sources决策搜索。相关测试目录仅列出transport/数据测试，尚未发现与本次renderer相关UI自动化，禁止运行或新增UI自动化测试。沿用已有benchmark-debug-template和computer-use真实页面流程；仓库明确要求人工视觉验收，不采用技能示例中的自动像素门槛。

## 调查边界与验收

先通过当前正式构建和356-live-02已合格闭合的完整历史，观察Side同名长文件名来源在窄/宽Dock中的阅读密度、行号、复制操作，以及真实拖动宽度时暂停读点。代码只表明Side和Subagent保存像素top；尚无本轮实际宽度复现，不预先宣布缺陷或修改。Main已有text/source语义锚点，可能共享提取器；若发生同类问题须分析全部三个renderer及共享滚动owner，不复制Main实现。此处是UI阅读状态；未观察到调度/队列异常，如发生立即按用户要求审计全生产Task/Mission/Session入口与轮次、正常终态、重试恢复、串并行和多项目。

使用自建side-width-357-before、18343/ui、固定原生600000ms资格窗口；源为C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-13/source-surfaces-356-live-02，原Session ses_-zUS8zzerzzqG425PLRl / Project prj_hEWVbkdkqzXiCqYcPTRJ。当前重新核对闭合、schema、完整90表、配置、恢复前沿、Message/Memory，再完整复制。无凭据、无模型请求、无伪造来源；保持原Project目录。只操作自己隔离页面/服务，不刷新或终止用户窗口。

首轮用真实UI展开Side64来源、滚动到中段、native拖动分隔条，保存截图并人工判断同一来源与offset；数字仅作只读DOM几何观察，禁止UI断言。按独立scope及时关闭页面、公共shutdown、join原handle到实际exit并存档。若发现问题先补根因、旧路径为何不足、全部调用/契约/数据/风险和具体实施方案，再修改。修复后新独立scope用正式构建复核原动作、会话/面板往返及普通正文回归；必要的子会话资格使用真实完整历史，不推断Side通过就等于child通过。

UI验收以截图和实际交互为准，typecheck/build/CSS/docs补充；没有非UI行为变化时不添加镜像测试。更新索引和文档检查，范围提交，fresh fetch/merge、审查完整待推送集合、正常push；当前CI记录不纳入。未验收项明确保留，不用局部通过结束长期目标。

## 已复现问题与实施

before自建页156：Side宽380→441→701px、标签两行变一行时，浏览器可见内容原生锚定保留第19条（乙20行）offset约−12.4px，scrollTop1244.8→1221.6→920.8。点击可见第20条（乙21行）打开File，Side在普通TabPanel中卸载；在File页缩至381px后返回Side，第一个来源变为第12条（乙13行），旧scrollTop920.8未改变。图01–03与06及before-side-positions是实际证据；04仍Loading不能当文件完成图，05显示真实文件乙21行在底部。原启动97625实际exit0，页面先关闭，原生600000ms内完整收尾；不存在新调度异常。

根因：Side rememberReadingPosition只保存top/following，重建controller以旧top恢复。隐藏期间浏览器没有可见几何可锚定，宽度重排后旧像素对应其他来源。Subagent虽然353保留Markdown owner，inactive会清理controller，恢复同样只有top/following，存在同一合同缺口（实际子会话尚待本轮验证）。Main350/356已具备text/source锚点；之前Side279只验证同宽往返，353保留子内容owner也不能改变像素位置的含义，因此这些旧修复未覆盖本例。

全仓setupAutoScroll仅Main/Side/Subagent三个入口；ConversationReadingPosition和SubagentReadingPosition、SourceEntry原身份、quotation Markdown block、TabPanel生命周期、现有onRestoreSettled/resolveTop及authority/source/session边界已检索。提出一个共享的无状态conversation-reading-anchor模块，把Main现有capture/owner/element/resolveTop原实现移入；Main继续既有虚拟化/history pin控制，Side/child只把同样锚点存入各自已有有界阅读Map并交给唯一setupAutoScroll.resolveTop。移除Main私有实现与子会话重复位置type，不保留双源。不存在服务端、持久化schema、工具、消息、Source顺序/复制或调度变更。

恢复期间onScroll不能把中间几何覆盖原锚点，Side/child各现有reader记录恢复标志；onRestoreSettled或原控制器的用户输入取消恢复后才再次采集。普通无语义锚点区域保留已公开的数字位置合同，不是缺失来源的替代生成。风险包括异步历史未渲染、来源折叠、正文分块尚未准备、authority/source切换、cleanup回调串写；恢复函数对真实目标不可见返回null等待原控制器，所有现有身份/active边界保留。实际验收必须覆盖Side来源hidden-resize往返、正文和Main提取后回归，并对原真实child做同类完整历史复核；未完成不得宣称child通过。阅读密度另属产品设计观察，当前先修实际跳位，不盲目合并不同来源。

准备阶段两次启动在参数/完整副本准入前被拒绝，未产生Native进程。初次PowerShell包装误用native LASTEXITCODE判断正常返回的ps1，跳过copy；已改为ErrorActionPreference=Stop和明确全部启动参数，完成90表真实copy后才启动。原失败日志保留，不冒充成功运行。

## 实际完成结果

正式main-Cf1X2t4t.js经过after/18344/页157和child/18345/页158两个独立600000ms历史scope人工复核：Side同一第19条来源701px/-10.05→隐藏/File缩窄→381px/-10.01；Side正文同段701px/70.16→隐藏→381px/70.10。一次窄29.30→宽34.16为真实内容最大scrollTop2348处的5px夹取，保留为边界观察；随后明确用户上滚接管并用70px读点复核，不把夹取样本宣称精确恢复。Main第45条942.2px/-7.40→560.2px/-7.29→942.2px/-7.40，实际甲20行文件选区正确。

child使用348真实已完成Task tsk_g00VXpiXcz00KjYqx3vV、原child ses_ho9Gh33iZxyYclSMkLkj、原项目和全90表。当前schema/config/recovery/Task/Message/Memory和原物理资格再次全部检查后完整copy；仅阅读已有成员，没有创建开发子agent或发起新的派遣。第28条来源701px双列/-2.075→隐藏/File缩至301px单列/-2.063，成员列表中改回701px再返回仍同条/-2.075；普通正文原Message msg_g0VXpiqni00xqhluBfMz的第9个全局可见采样块宽701px/-83.16→列表隐藏→381px/-83.44。锚点是段落及相对偏移，不承诺重排后同一字符行。

27张真实截图已逐张呈现。before原97625、after38913、child82786均实际exit0，Native分别159633/237639/221745ms后正常exited，页面均先关，Host/Native/端口/输出/request闭合。读历史未复制auth/models，不能宣称新的Provider验收。check-runtime.ts实际readonly SQLite证明前后各11 Message/192 Source（Main64、Side继承64及新64），child13 Message/66 Source完整匹配各自原值；正式UI asset HTTP200和当前Native结算一起记录。初版checker错误预期无凭据历史的Provider审计含requests数组，已保留available:false完整原合同并重跑通过，原失败日志归档。

类型6105、build25283、CSS及真实runtime checker全部exit0；docs/check、提交与正常上游同步见最终记录。未新增/运行UI自动化测试。此轮没有完成同文件重复标签密度重设计、SourceExcerpt内层、原Research Studio大历史或新的实时流式样本；这些不是当前隐藏宽度读点修复的完成证据，持续goal保持active。
