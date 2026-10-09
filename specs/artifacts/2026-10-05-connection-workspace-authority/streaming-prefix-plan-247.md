# 247 共享流式正文的持久前缀

## Recall

用户持续自主迭代UI/功能、修Sources与Rendering，最新只root单agent；141dfa87c已正常push，当前clean。246为progress：两次真实Sol partial→Side DOM卸载→同SID/Message返回，649/851可见字符降为13并丢前半段；after运行中canonical TextPart=0，natural text-end才恢复3524正文。233字符旧提交残留已独立修复并真实复测正常，不能当作正文恢复修好。两个原Native/fore0/各9 EOF、paired完整退役，243期限失败原样保留。

本轮应用benchmark-debug-template的根因→真实路径→复测闭环；用户的UI仅人工截图/禁止UI自动化优先。已读246 Recall/实际截图与running readonly DB、SessionProcessor所有text/tool/reasoning/attempt/terminal分支、Session.updatePart/Delta单写者、协议桥/ProtocolStore Task有限replay、Session snapshot/Task child/Mission读路径、Side/Main/subagent UI projection、CLI（Command Line Interface，命令行界面）与ACP（Agent Client Protocol，agent客户端协议）delta消费者、聚焦processor/retry测试与真实controlled HTTP fixture。旧注释所称engine/session-hooks delta生产caller不存在，当前实际只有processor text和reasoning两处，修正注释而不恢复旧路径。

## 根因、共享横审和影响

currentText是唯一运行累加器；text-start持久空Part，delta仅Bus/ephemeral Protocol；会话SSE（Server-Sent Events，服务端事件）订阅之后读canonical snapshot，无法取得订阅前未保存字符。Side新连接清live overlay因此只接新delta，Main session.connected和初次子侧栏/普通Mission同样暴露共同缺口；bounded Task replay不是完整长期文本事实。final text-end保存解释终态恢复。196完成Markdown cache不修生产数据前缀，246草稿request ownership不改text生产。

正常、投影Task、permission continuation的loop1895/4822与compaction903共用同processor。实际delta bridge按Session/Message/Part/Project唯一身份路由，CLI JSON text_delta与ACP agent_message_chunk依赖当前delta，必须保留。reasoning不进入UI正文且维持现200ms增量。原normal全Part写、retry先等flush再移除或保留attempt parts、终态Info immutable fence、错误/中止后的部分正文、恢复后无物理owner和多Project并发均属于同改动影响面，不能局部只补Side。源码/原持久化事实与真实Native0没有发现队列/唤醒/调度终态故障，本轮针对共有生产/恢复的文本契约，不改变调度或教模型流程。

当前Tool input已有单timer/单in-flight/单dirty trailing的200ms发布队列，retry/stream结束/error均join。将这同一个队列扩展到currentText的canonical prefix，取现Session.updatePartWithSignal单写者并继续原text delta，避免每token事务压力和第二正文cache。无新registry、消息、Source、replay store、API schema、SDK或配置面。200ms是调度cadence，publication背压可以额外延迟下一checkpoint，不承诺绝对200ms持久延迟；结束/错误必须保存当前最后原始文字。接收方已有同Part full-snapshot覆盖旧delta的当前契约，不加字符串猜测或第二renderer。

权威资料核对：[SQLite WAL concurrency](https://sqlite.org/wal.html)说明同一WAL只有一个writer；[HTML SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)定义连接/event framing，不提供本项目缺失历史的自动恢复。沿现200ms队列控制写放大是基于当前源码/历史锁竞争的工程决定；不改SQLite PRAGMA，不把application Part checkpoint混称SQLite WAL checkpoint。更高并发性能需要真实证据。

## 实施准入

先建立聚焦positive backend benchmark，使用真实本地HTTP OpenAI-compatible流式Provider、当前LLM/processor/MessageStore及公开Session事件路由，prefix发出后让producer暂时停在语义边界；在自然EOF之前读取同Part的完整持久prefix/重连snapshot，随后放行suffix/EOF验证最终完整输出。无LLM function mock、UI/DOM/组件/文案/截图断言，不把本地Provider当真实Sol。phase receipts/Bus真实接受事件为inactivity计时来源，测试checker挂起仅在明确无进展时失败；总测试框架期限只作安全边界，不当功能通过标准。先保留现before失败，再实施/跑同一checker。

实现保持currentText唯一内容累加器；把toolInputFlush timer/op/error/dirty与对应函数整体改名为streamedPart发布队列。flush先以现currentText实际完整Part保存，再沿现pending Tool input snapshot发布，200ms原cadence不变。text-delta原增量仍按原顺序自然产生，同时标记该队列dirty；text-end先settle队列再做现plugin complete/final Part，避免旧异步prefix覆盖final结果。retry现settle退役队列后依原attempt事实删除或保留part；最终error/中止保留最后currentText并标记end，再沿现错误Info完成路径，不能假调用text-complete plugin或合成成功。已有Tool input错误聚合说明扩成streamed Part，没有新吞错路径。

focused正向契约覆盖：prefix/late subscriber与final输出、UTF-16字符、短自然结束、串行与多Session/多Project同时运行、网络/idle retry及原Part身份、abort/error部分正文；改动触及的旧负向/过期测试按现契约处理，禁止扩大到无目标全bun test。全Model请求streaming，原声明/调用一致；类型检查/架构/文档是辅助。

真实Sol后验仍需paired完整auth/models与usable/projected/actualmodel/stream预检；准备closure/archive/facts/piles/profile后新247 scope `/ui`，root人工Main Sources→Side长回复partial→确实DOM卸载→同SID/Message返回/完整前缀/末尾与输入。原246失败保持，不以新的普通Native0或测试分数覆盖。全部frames、原research子agent Dock/重启/高并发等未验证项如实列出，若新异常继续共享审计。

## 交付

preimage/diff审查、实际before/after checker和必要类型、真实页面及正常Native/foreground/physical/output/request/pair0，及时退役无scope扩展；root/month/相关README/current architecture/docs检查、范围commit、fetch/merge完整待推送审查和普通push。user18107/IAB23不碰，无agent/branch/worktree/release。goal保持active直到用户停止。

## 当前执行事实

新真实HTTP/SDK/processor checker before实际1：接受过text-start/delta后1500ms无canonical prefix publication；原246 running DB0为独立真实Sol同现象。沿原single200ms队列实现checkpoint、text-end先join、失败/abort收敛保留最后partial，原delta声明/消息不改。after01原同一checker实际0，6正向断言包括late Session SSE prefix与最终同Part/delta输出。

扩展after02/03原失败保留：Bun ReadableStream.controller.error在该fixture对客户端呈正常EOF/finish other，不是真实断开网络的有效fixture；并发fixture先完成项目的memoryProject.dispose调用Instance.disposeAll，造成另一项目进入global disposal并终止，current Message.error明确记录这条原因。修checker而不改production恢复为迎合测试：按既有http-response-body checker的Node HTTP/socket生命周期创建owned Peer，真实response.destroy触发一次网络重试；两个项目processor都完成才允许fixture global disposal。after04五项实际0（19断言/14.55s），原失败都在private logs，后续公开说明不得包装为production bug修复。

尚待聚焦相关回归/类型和真实Sol页面；200ms窗口/高并发吞吐/完整重启/original research子侧栏与全Rendering帧并未由这5契约证明。普通/Task/Mission共享唯一producer仍必须依据代码及真实行为分层限定，不以测试分数替代图片。

聚焦regression01实际0：6项processor activity retry、10项producer边界/pending Tool input/慢发布与abort、10项Session连接snapshot/两Project事件隔离，共26正向契约；与新5项共31。本轮没有UI自动化。types初次失败只因TextPart.time可选，当前stream constructor必有start仍需严格DataIntegrityguard；添加显式缺start报错后types02实际0。不用时间fallback，不重复200ms内容writer。Prettier本地.cmd不存在，已用现bun x --no-install formatter对唯一新test文件实际0；原工具诊断保留，不当产品失败。

真实247 live-01准入：完整paired/catalog与preflight，port18181、same native600000ms/12累计预算，R2026-10-10/streaming-prefix-247-live-01，current frontend仍246 main-D_-2LIPy.js（本轮只有backend变更）。全部closure/archive/facts/piles/profile已准备。人工Main短Sources→Side同12段长题→partial→关闭/重开，取得同Part真实完整prefix及running SQLite标量；native正常完成后立刻闭合。Backend缓存或代码检查不能替代UI照片，原246失败维持。

live-01 原始事实：Main ses_-zUSQ4siuzztyb6kc3Rw，4真实Source URL；Side ses_-zUSQ4jntzz0PCgcr2Pp、Assistant msg_g0VXZvKdk001hjzTYaPE，before-close running 1509显示字符/1冻结块，18:29:19.837确实DOM卸载。root恢复上下文后的reopen于18:33:07.824，实际模型已在18:30:00.252完成，3742 canonical字符/3465显示字符，不能作为运行中前缀恢复证据；running SQLite observer同样发生于terminal，只证明完整终态。原资料不改名包装。Own88已close、sole shutdown、原fore91189真实0，9/12 Sol200/stream/EOF，independent closure0、12062新日志/unknown0、paired完整退役、所有observers终态后5个精确pile归档。原246运行数据0和真实before缺前缀仍保留。

补验先准备完整review独立scope与closure/archive/facts/piles/observer，再启动port18182、R2026-10-10/streaming-prefix-247-review-01、E streaming-prefix-247/review-01，NativeService同固定600000ms/12累计预算。沿相同Main短题+Side12段长题，只在确认partial/Working后立刻关闭整Dock、立即重开/截图/查询running SQLite；不在此期间执行长分析、广泛文档读取或改源码。终态截图及空输入后立即close/shutdown/join，再做离线事实复核，不扩展原live-01期限、不重启它、不将terminal截图称streaming。

review-01 已真实完成：Main ses_-zUSQ30uWzzyuVGJJX76、Source4；Side ses_-zUSQ2vIdzzqzoeGu5Wb 继承4消息/来源，User msg_af017532-bce8-4103-b8a3-a9a5c439133d 为233字符、Assistant msg_g0VXZx9p000xAB6TdTEq、TextPart prt_g0VXZxAwy00f9cCyK9qi。18:36:28.730 UTC before Working1277显示字符，整Dock确实卸载后18:36:40.333返回仍Working1879字符且前文完整；18:36:46.906原只读DB保存同Part2202字符、Message尚无completed；18:36:54.474开头真实照片仍Working。Source reader最后字节18:36:59.434、EOF.579、Message完成.669，最终3218原始字符。18:37:09.776第一段照片实际已terminal，不能称running；Source照片同样terminal。结束输入空/可用72px、reading388px。

Own89关闭后sole shutdown，原fore42251实际join0；Target75892/Host44676、Native18:38:05.995早于固定deadline、实际0、9/12Sol200/stream/EOF；独立closure0、8003新日志/unknown0、paired完整退役、所有observers终态后5个精确pile归档。两次原scope未延长/重启，user18107/IAB23未操作。Source/正文照片均实际呈现root人工看过，本轮无UI自动化。公开checks保留before/夹具失败/types失败与最后成功；root/month/证据README同步。原Research子Dock/完整重启/高并发/全Rendering帧仍未资格化，活动列表raw Markdown尾部后续迭代；本轮仅shared canonical正文恢复，goal继续active。待完成最终文档/差异/提交/上游合并与push。

最终辅助检查：`bun run docs:check` 实际0（345 ops/25 groups），`bun run check:architecture-index` 实际0（18 current documents/links），unstaged `git diff --check` 实际0。只提交本轮2个生产文件/新增backend test/架构与索引/247方案记录及原事实；scope限定后再检查staged diff，普通fetch/merge origin/main、完整待推送集合审查和保留hook的push。实际Git交付结果以提交和远端回读为准，不提前在规格里声称push成功。

在最终 guard 的当前源码上复跑聚焦5项，after-checker-05 实际0，原运行59166已join0；原04/05重复验证不虚增31项独立契约数量。最终差异复查还发现现有natural text-end会把原time.start改写成完成时刻，live-01 final start/end同值印证这条旧行为；该问题涉及时间契约与显示消费者，留给下一独立分析，247保持本轮可审查的正文前缀修复范围，不能无分析顺手修改。
