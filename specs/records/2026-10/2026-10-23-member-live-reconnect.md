# 成员真实流式输出期间重连

## Recall

547 延续用户自主查找和修复 Sources、侧栏 Rendering、功能体验的长期要求；最新单开发 agent 规则优先，不委托。546 已提交推送 eeba57491、fresh 0/0，真实修复完整快照没有通知成员读取；已完成 Task 的旧 16/4 到新 20/5 历史恢复通过，原 11 个正文和四个来源 owner 保持。上一轮是 progress，活跃流重连仍开放。

已读 546 Recall/结果、07-panel-reactivity 的目标/实时中间值/快照通知、ConnectionBadge/Banner、connection-projection、SSE reconnect、selected-task-recovery、conversation live buffer；搜索全部 startSSE/stopSSE 入口和成员指导入口。产品没有只重连事件流的按钮：Badge 为 span、Banner reload 整页、网络设置的 native restart 重启后端。389 已有私有 Node HTTP 原字节转发/物理连接中断工具及真实读取保留记录，本次沿该机制针对实际观察到的 Task SSE 连接。benchmark-debug-template 已重读，computer-use 已在持续任务应用；用户 UI 自动化禁令优先，不新增或运行 UI 测试、fixture、DOM 断言。

## 修改前分析与影响面

可观察目标是新增长正文/来源在同一成员面板中的连续性，不把首次解析当闪烁。直接触发点是浏览器 Task Server-Sent Events（SSE，服务器发送事件）连接意外结束；正常路径用已消费的 live sequence/epoch 重连，过期时真实 tail snapshot 恢复，546 再使成员读取最新内容。潜在缺口包括 replay 和在途 transcript read 交错、旧 live projection 覆盖新完整字段、来源重挂或阅读跳跃；目前尚无本边界的当前真实失败证据，禁止先补丁。

真实 Provider 请求由后端持有，浏览器事件流是独立下游读取。中断必须限定已观察到的一个 Task SSE socket，不能取消模型 reader、杀进程、改权限配置或用户网络。原始 HTTP 内容直接 pipe，控制命令只销毁该 socket，不伪造响应、事件或消息；没有 mock 服务器和产品旁路。private relay 不是生产实现，不进入发布包。字段/来源语义、schema 3、公共 API、版本与配置预期不变。

如出现调度、队列、唤醒、恢复、并发或终态异常，按共享机制横审 Task/Mission/Session 轮次、正常/终态、重试/重启、串并行和多项目；先用原请求、持久事实和真实运行分离前端读取恢复与后端执行。重连失败不由重启原服务或重发业务输入掩盖。若仅 UI 问题，也先全仓核对定义/调用/契约/测试/架构后再改。

## 固定方案与验收标准

1. before 使用全新隔离 scope，Source CLI 19097，原字节 relay 19099。完整复制闭合的 546-fixed-after 90 表/所有原行字段时间、canonical 配置与实际 PNG。来源有 2 次 Sol 原 EOF、正常 native/原 exec 0、四配对成员退休，准备时重新核验。用户数据库不参与。
2. 当前 OpenCorvus OpenAI OAuth 完整条目与相邻完整模型目录配对；分别验证认证可用、gpt-6.1-sol 投影和实际模型一致。单 scope 最多 20 次实际流式尝试；只有确证问题需修复复验时，after 19101/19103 最多 20 次，总上限 40。每 scope 20 分钟原生资源边界，启动/Provider 180 秒无活动界限；准备和 Node 正式诊断构建完成后才启动。至少保留五分钟收尾。
3. 同一原 Task tsk_g00VYlyopB00h7w27eIw、原 B ses_hHpC127wALpwIiSOX86d 继续一项有限真实责任：先原创约 2800 字中文阅读计划，只一次读取 RFC2606 原文，再按实际结果原创约 2800 字说明并包含表格与文本围栏。保留旧交付，不新建成员/helper/Task/Goal；模型不操作或自称验证 UI。由真实页面发送一次输入，处理该输入产生的真实权限提示，不追加诱导完成消息。
4. 内置浏览器打开自有 relay /ui，先记录原正文/五来源 owner、位置及日志。原 B 新正文已实际增长且原 Provider reader 活跃时，通过 relay 只断开已观察到的本 Task SSE 连接一次；新订阅正常透传，不设置重试阻挡或伪数据。手工保存断流前、恢复后继续增长、新来源和自然完成截图，DOM 仅只读解释身份/块数，无自动断言。
5. 实际 socket 记录证明旧连接中断和新连接及游标；Provider 原 reader 记录证明仍是同一真实请求并最终 EOF；公开 Task/member 端点与原数据库观察证明消息/来源增加和 Task 自然完成。把 checker 与页面 HTTP 请求区分，日志批次范围明确。模型过快已结束时不宣称活跃流覆盖，按实际情况调整下一次真实输入计划前先记录证据。
6. 仅有代码/数据/实际画面证实的根因才实施修复；必要非 UI 正向测试、固定实页复验。无新生产问题则交付本边界证据，不推测性改动。关闭自有页、relay 原 exec 及所有 socket/输出，再正常 shutdown 后端、join 原 exec/native/launcher/精确出生/输出/request；所有 reader EOF 后退休 runtime/private auth+models，核对完整原数据和源保持。
7. 三索引、必要架构、最小非秘密产物，docs/architecture/diff/实际值扫描；范围提交、fresh fetch/merge/全部待推审计、正常 hook/push。长期 Goal active，Session/Mission 独立边界保持后续范围。

## 首轮测量缺陷与复验调整

before 已真实发出一个原 Task 输入，原 B 继续同一 Session，完成 2721 字符前文、RFC2606 单次真实读取、3350 字符后文及新来源。未创建新成员。两次断流命令均在保护检查处结束，relay 没有收到 interrupt，不能将首轮作为重连通过。

第一检查晚于前文 EOF，保护正确。第二检查在 18:34:29 读到原 B 新消息仍未结束、后文已有 2916 字符，但审计文件的 index 7 仍是 reading/byteCount=0，因错误的实时计数假设拒绝。源码 `RealProviderAudit.onChunk` 只更新内存，磁盘只在 onBind/onSettlement 等边界发布；最终同一 index 7 的原 EOF 时间是 18:34:37.512，证明第二检查错失了实际活跃窗口。不是凭据、Provider 停止或 UI 异常。

按工具链故障必须修复并重跑原验收的要求，启用已预留的 after 19101/19103（上限仍 20，总 40），以正常闭合的 before 全量数据为源。只修改私有诊断：每 500ms 从同一个 audit 对象导出最小 reader pulse（真实更新时间、agentID、assistantMessageID、字节数、原终态），不改生产 observer、不改流内容。提前保存短调用的 interrupt 脚本；它核对足够新鲜的 pulse、原 B/base-researcher 的确切 assistant Message、真实未结束正文及已观察到的唯一 Task socket，再执行一次物理中断。最终再以同一原 reader 的 bound/EOF 时间夹住实际中断时间，不能仅凭过程中状态宣布通过。

after 使用一项新的有限真实责任、同一原 B、相同长文结构，唯一材料换成 RFC6761 原文，保留 first 的 RFC2606 与所有旧交付。这是同一恢复目标的工具修正复验，不是缩成静止任务或伪造消息。新的输入、请求计数、截图、原 reader 和资源关闭与 first 分开记录；不宣称此时已发现或修复新的生产问题。

## 实际结果

[七张人工查看的实图与原始事实摘要](../../artifacts/2026-10-23-member-live-reconnect/README.md)。本轮没有生产代码改动；修正的是私有验收工具对边界快照的误用，并成功重跑原活跃流目标。

- after 的同一标签 165 保持原 Task/B、URL 和 API authority，没有 reload 或切换成员。17 段已有正文、6 条已有来源先完整加载，再由真实页面提交一次 RFC6761 责任，原 B 完成该新增轮次。
- 18:47:53.572，relay 真实断开已观察到的 Task SSE 连接 58。当时原 B 的确切 Message `msg_g0VYo0qar00sYyGckQJ3` 正在输出；新鲜 pulse 来自 202ms 前的原 reader index 5，agentID=base-researcher，已有 554963 字节。数据库同一正文尚未结束、已有 1514 字符。后台 memory 请求没有被当成可见输出。
- 新连接 220 在 3062ms 后建立，实际 query 恢复 after_live=1350、after_live_epoch=1792694638566。原 reader 没有重建，继续读取到 959742 字节，并于 18:48:19.033 原 EOF，比物理断流晚 25461ms；真实网络 checker 以 bound/interruption/EOF 顺序和相同 assistantMessageID 验证这个窗口。
- 两张断流前后实图的同一正文 owner 31 从 883 字符/9 块增长到 2110 字符/17 块；完整前文最终 2662 字符。已有 owner 11–27 和六个 Source owner 2/4/6/8/10/12 保持。193 条去重低频生命周期记录按两个独立页面分别保存，after 有 104 条；断流窗口内实际记录到正文正常完成时 streaming=false、21 块、pending=false，没有把新内容首次解析当成旧正文闪烁。
- 后续一次真实 webfetch 返回 RFC6761，新来源自然出现。后文 3212 字符、表格和围栏完整可读；真实 Task completed。最终公开成员端点为 snapshot、epoch 1792694638566、sequence 4649、28 条消息/7 条来源；页面为 20 段正文/7 条来源。手工上滚到来源后，完成态阅读位置保持 top=32397。

before 的实际新来源 RFC2606、2721/3350 字符前后文与自然完成均保留，但两次保护检查没有执行网络中断，因此该 scope 不具备重连资格。其具体失败与 after 的成功证据分别记录，不以最终通过覆盖失败。

## 数据与资源结算

两次完整源分别为 90 表 193324/196578 行，运行后为 196578/199955 行。源数据库所有原行/字段/时间、字节数/mtime 及完整 canonical 配置保持，目标 schema 仍为 3、真实对象一致、integrity_check=ok。目标的七条原行变化属于同一实际项目：一条 project_context memory_chunk 的内容/令牌数/时间、其 memory_file 时间、root/orchestrator/原 B 三个 Session 的 time_updated，以及两条运行租约。实际 memory_chunk.file_id 指向 mem_h6r23eQkVxF8ppMaNuxh，所有相关 Session 和 memory_file 的 project_id 均为原 prj_hp1ir9XEheMHTOMlkSL8。原消息/来源和其他项目保留；用户数据库没有参与。

before 13 次、after 14 次，共 27/40 次实际 gpt-6.1-sol 流式请求，全部 HTTP 200、实际模型一致、原 reader EOF。数据库 logical Provider Activity 行数与物理模型 HTTP 请求数不同，分别记录，不混用。两后端公开 shutdown 200，原 exec 11177/26678、native/launcher 均 0；relay 原 exec 33353/87312 均 0，server closed、socket/stream 0、日志输出排空。全部在原 20 分钟资源边界前主动正常关闭，余量超过五分钟。8 份 runtime/private auth/models 配对成员退休，源当前 App 认证及完整模型目录保持。

## 交付与仍开放范围

正式 Node 私有诊断构建 exit 0（1m2s，main-DUIsFwRA.js），after 使用同一份准备资产。真实网络/Provider checker 通过、完整数据复核通过；没有新增或运行 UI 自动化测试，没有新生产契约，因此不编造额外单元测试。`bun run docs:check` 通过（345 ops、26 groups），`bun run check:architecture-index` 通过（20 篇当前文档），`git diff --check` 通过；14 个交付文件实际 access/refresh 值扫描匹配 0。范围提交并按 Git 合同正常推送。

本轮覆盖一次 Task 活跃流的同 epoch 游标恢复与后续来源/终态。活跃流跨进程 epoch、缓冲过期，以及 Session/Mission 的独立恢复仍未覆盖，不宣称所有 Rendering 闪烁已根治。长期 Goal active，继续单开发 agent。
