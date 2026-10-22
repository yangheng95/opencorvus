# 实时流重试状态连续性

## Recall

551延续用户单agent自主排查Sources、Rendering、Goal及布局、实际体验后提交推送的授权。使用OpenCorvus已热认证的OpenAI及相邻完整models.json，目标gpt-6.1-sol；不委托，不操作用户现有进程或数据库。550的f10804d2a已正常推送并fresh fetch确认0/0；原两处未跟踪缓存保留。所有550自有服务、转发器与页面已经闭合，Goal仍active。

已读550Recall/证据、sse.ts完整选中流控制、messages状态定义、ConnectionBanner/Badge及共享presentation、selected-task-recovery、connection-projection、所有startSSE/stopSSE生产调用点、selected-task-stream-live-replay-reopen服务测试、当前07-panel合同。全仓搜索状态生产与消费、重连/关闭/重试入口及相关测试。相关测试为传输服务合同，无DOM或组件测试；不新增或运行UI自动化。延续computer-use及benchmark-debug-template的真实页面、截图人工复核方式。

## 现象、根因候选和影响面

550真实日志在后端online时每3秒出现reconnecting→idle→reconnecting。startSSE调用公开stopSSE，后者既释放旧handle/timer/generation又发布idle；随后startSSE发布目标状态。ConnectionBanner看到idle时问题消失，清除5000ms宽限计时；下次reconnecting重新计时。持续快速重试可能永远到不了提示时间。550只统一状态投影/保留已显示提示的类别变化，没有改变这个上游状态序列。尚未独立实页证明持续断流的可见结果，必须先复现再确认。

共性范围：Task、普通Session、Mission共用startSSE；所有选中流的onError/onClose/watchdog以及Task live replay恢复都会经过它。Task按persisted sequence/live epoch恢复，Session和Mission用完整session.connected快照；本次不改事件、快照、游标、数据或任务执行轮次。正常选择、项目/authority切换、删除/归档、workspace清空、init清理显式调用stopSSE，仍必须发布idle并退休旧generation。独立Work Ledger、side-chat、artifact流拥有独立handle，不生产选中流状态。本次范围不涉及后端调度、队列、唤醒、模型执行或schema；无需数据迁移。

拟修正：若实页复现成立，将现有资源释放体提为私有函数，只负责原定时器、generation、activity及handle释放；startSSE释放后直接发布本次connecting/reconnecting，公开stopSSE释放后发布idle。不增加shadow state、fallback、UI特殊延时或变更重试间隔。旧handle在关闭前已失去generation/handle所有权，保留旧回调隔离。风险为显式停止状态和新选择状态遗漏，聚焦正向服务测试覆盖Task/Session/Mission完整序列、重试与最终停止。

## 实际验收计划

两个独立scope before/after，共用已经闭合549-fixed-after完整90表真实历史及原canonical，保留所有字段/时间；分别使用当前App认证+完整catalog、各2次Sol流式preflight（单scope上限4，批次上限8）。使用原生20分钟资源边界/180秒无活动界限，至少预留5分钟关闭。先构建，再复制凭据/启动Source CLI；仅使用自有/ui页面。

before复用550已验收UI资产。私有Node转发器只对实际已选parent Session的GET events物理断开连接，期间每次相同路径重连也断开，最大120秒自动解除；健康和其他请求原字节转发。不伪造响应、模型消息或UI状态。查看超过5000ms且经历多次重试的角标/提示、正文和Sources，再释放到真实connected。after同边界重新截图复核；可通过实际设置切换中文核对恢复文案。只读诊断记录原状态和正文/来源owner，不能替代截图。

聚焦传输服务正向测试、overlay typecheck、当前文档检查和正常hook；关闭所有页面/转发器/服务并join原exec、核验native/output/request闭合，退休配对凭据与catalog；检查源原数据和目标原行；仅发布最小非秘密证据。完成后提交，fresh fetch/merge/audit完整待推集合，正常push并再次fetch确认。

## 修改前实页证据

before页174：图01在线，打开真实历史成员后35正文/11来源已呈现；图02在持续断流与多次3秒重试后，角标Connecting但banner为空，健康GET仍返回200。原35正文/11来源及64017阅读位置保持。实际CN550诊断与Node物理网络日志支持同一idle→reconnecting触发链。确认候选后按原方案分离资源释放与公开停止语义，新增三种选中源的连续重试正向服务合同，最终停止仍idle。

## 最终实页结果与结算

[七张实图及证据](../../artifacts/2026-10-23-stream-retry-status/README.md)。before物理断流14.083秒、4个独立重试实例，原状态每3秒idle→reconnecting，图02没有banner。after页175物理断流49.066秒、16个独立重试实例且5次实际health200；图05英文、图06通过真实Settings切中文后的黄色提示均可读，状态持续reconnecting，原宽限期能够完成。真实恢复后图07为在线且提示关闭；没有UI状态注入或人工响应。

两页各自35段正文/11来源的原绑定保持。before全程成员64017；after先64017，真实手工上滚两页到62577后恢复仍保持。没有反复Rendering重建的本次观察；不以此排除未覆盖的ResizeObserver、活跃内容增长或独立Mission/Task页面问题。

两个服务各2次当前App OAuth/完整catalog/gpt-6.1-sol流式preflight，共4/8次200/原reader EOF。原exec48894、96542公开shutdown200后原生/launcher/原exec0及输出/request完整闭合，均保留超过五分钟资源收尾余量。两relay69533、40831原exec0，server/socket/upstream/pending/request闭合、输出排空；108/110次原样转发仅注册11/10物理socket清理监听器，各close listener总数3，无新告警输出。页174/175已关闭，8份复制auth+models已退休，源App条目、完整catalog和mtime保持。

两个scope均从闭合549源复制90表165802原行，源全部字段/时间/字节/mtime及canonical原样；目标schema3、实际对象、integrity一致，原行仅两条运行容量租约变更。没有触及真实用户数据库。准备步骤只复制原历史，不执行迁移；前端构建与服务运行隔离。

聚焦服务测试7pass/0fail/24个正向期望，3种source分别经历两次实际业务重试计时器并最终connected→idle。overlay类型检查通过；Node正式诊断build59.15秒；docs:check345ops/26groups、architecture-index20篇及diff通过。没有新增/执行UI自动化，typecheck/build不是视觉验收。仅资源释放函数从stop中拆出，公开API/协议/schema/版本不变；没有发布。

Goal仍active，继续单agent。当前代码已修复真实选中流状态根因；Task/Mission本批只完成共享服务正向合同，未把Session截图称作其独立实页。下一批继续用户优先的Sources和侧栏阅读稳定性，尤其尚未独立验收的布局变化触发渲染。
