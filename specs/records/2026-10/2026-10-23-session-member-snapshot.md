# Session 成员快照与新轮次恢复

## Recall

548 继续用户自主排查 Sources、侧栏 Rendering、默认体验与功能完成度，实际验证后提交推送的长期要求。最新单开发 agent 指令优先，不委托。547 已推送 4e31f855a，fresh 0/0：真实 Task 活跃流同 epoch 断开后 3.062 秒恢复，原可见 reader 再运行 25.461 秒后 EOF，原组件保持；修正私有审计快照误用，27 次 Sol 和四进程完整闭合。上一轮是 progress，普通 Session/Mission 独立恢复仍未覆盖。

已读 547 Recall/结果、535 普通成员恢复完整记录、07-panel-reactivity；检索并阅读 Session conversation/events 路由、sessionConversationTailProjection、execution lifecycle 回放、SessionConversationConnectionSnapshot schema、mergeSessionConnectionSnapshot、tree-writer commit、conversation-agents 生命周期/目标合并与 subagent 选择。也核对 workspace-location 当前 URL 合同。当前相关测试为后端协议或纯投影合同；不创建/运行 UI 自动化测试。computer-use、benchmark-debug-template 已在持续任务使用，用户真实页面和人工截图要求优先。

## 修改前分析

Session 重连提交全文快照后回放各可见 input 的最新真实生命周期事件。正文由 tree-writer 更新，546 的成员通知使已选侧栏读取全文；但 reconnect 没有调用初次 hydration 的 hydrateConversationAgentView，也没有 history 路径的 attachConversationAgentViewTargets。生命周期事件可以创建新执行轮次，但新记录最初只有 input ID、空 activity/target，时间来自观察到的事件。当前可能存在正文已更新而成员摘要/导航/计时未同步的缺口，尚须实页证实，不能仅凭缺少某函数判定根因。

旧 546 修复了全文读取失效通知，不等于已验证 Session 新轮次元数据。共享影响范围包括普通会话与 Mission 的 Session SSE、Task 的完整 hydration、同 Session 多 input、历史/实时交错、正常/终态/重启和多项目隔离。需区分前端投影恢复与后端执行调度；如出现后者异常，按全仓规则横审全部入口和持久事实，不能称为偶发。本批不主动制造新执行轮次，先用已真实执行的完整历史对照。

schema 3、Provider 策略和版本预期不改。若发现需要改变公开 snapshot 字段，先全仓核对定义、生产调用、SDK/API 文档和正向协议测试，再落盘唯一修复方案；禁止 fallback 或同时保留两套事实源。若只需 UI 投影修复，使用既有 canonical writer/agent primitive，不用宽泛 tree version、状态启发式或额外定时器。

## 固定方案

1. before/after 使用同一自有端口 19105，按顺序完整复制已闭合的 source-reconnect-history-535-before/after 两份 90 表历史。原 parent 为 ses_-zUS0X33CzzWEKMgCk98，member 为 ses_-zUS0WzzQzzDOGrIbYwN，project prj_hSQinOa1MIVoNEeARpn5；真实目录为 C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/project。parent metadata 的 experience=work、surface=right-sidebar，kind=assistant、无 parent；member 是其真实 assistant 子会话。旧数据 root12/member36，新数据 root12/member39，新增来自 535 一次真实 Sol/W3C Disclosure 阅读，不合成或删改消息。
2. 准备时核对 source 的原生/输出/request/launcher/精确出生闭合、2/5 次原 Sol EOF、runtime/private 成对退休；只读 serialize 全部原行字段时间、完整 canonical，inventory 并配对目标实际引用的已发布附件，保留原真实文件身份。新 scope 使用当前 OpenCorvus OAuth 完整条目及相邻完整模型目录；各最大 4 次 Sol，仅独立 preflight，无新业务输入、无新成员或委派。20 分钟原生资源边界、180 秒启动/预检无活动界限，保留五分钟收尾余量。
3. 启动 Source CLI /ui 与 Node 正式私有低频诊断构建，不独立启动 Vite。观测原成员 Part/body/Source 生命周期与已存在的 selectedRecord/target/resource 元数据，不改渲染或状态算法。自有内置浏览器打开 parent 的 conversation/work/原 directory URL，手工打开 member 并记录旧 Source、正文、摘要和时间。
4. before 原 reader 全部 EOF 后正常公开 shutdown、join 原 exec、物理结算/配对退休，原页面保持 Offline；after 在相同 URL 启动较新完整历史，页面不 reload、不换成员、不改 authority，自然恢复。记录 Session.connected 与生命周期的实际数据、成员完整端点和页面请求（checker 独立标注）、source/正文/摘要/导航/时间及组件身份。先观察成功或失败事实，再决定修改。
5. 如确证问题，补全根因、公共契约和唯一方案后修复，并使用 fixed-before/fixed-after 两份同样历史在 19107 顺序复验；各最大 4 次、总上限 16，未需要前不准备凭据或启动。生产非 UI 变更加聚焦正向合同，UI 只实际交互/截图人工复核；不借 Task 已通过证据代替 Session。
6. 所有自有页、服务、原 exec/native/输出/request 完整结算，配对文件退休，源全数据/配置/字节/mtime 保持。最小非秘密产物、三索引、必要当前架构、docs/API/SDK 检查按实际修改执行；范围提交、fresh fetch/merge/待推全集审计、正常 hook/push。长期 Goal active，Mission 实页资格单独说明。

## 实际缺陷与实施方案

before/after 两次 current Sol 预检各2次，均200/EOF。真实内置浏览器166保持同一父会话、成员、URL，旧32正文/10来源自然恢复到35/11。19:26:54.304 首次 Session.connected 后选中最新 input msg_g0VYlVhdH009nBNe7inj，但记录只有该一条 messageID、空 target/activity，startedAt=1792658339899（最后状态时间）。独立真实 conversation 端点同一 input 为三条消息、四条 activity、target msg_g0VYlVvNx00Uq6gDAjqh，firstObservedAt=1792657863102。19:27:02.928 后续完整 hydration 补齐，故缺陷窗口为8.624秒，不能表述为永久丢失。首张重连图同时出现模型配置临时不可用提示，后续配置读取恢复；这不属于认证失败，原模型预检正常。Sources 与旧正文 owner 本轮继续保持。

根因是 Session 连接快照仅包含 transcript/view/history/interactions，后续 lifecycle replay 以终态或 idle 事件单独创建新 occurrence；applyLiveConversationAgentSessionStatus 的真实职责是增量状态，无法从该事件恢复完整活动、消息、开始时间与导航目标。Task hydration 已有完整 agentView，普通 Session/Mission 首次 hydration 也有；只有 Session SSE snapshot 缺少同一投影。546 更新的是成员全文失效通知，不能补齐这套摘要契约；后续连接监控触发整页数据加载使缺陷被暂时掩盖。

实施唯一方案：把现有 sessionConversationTailProjection 的返回扩为同一次读取产生的 agentView，复用原 GET hydration 对 selectedTaskID、Task occurrences、Todo 和 lifecycle 的同一组合逻辑；GET与SSE共同使用，删除GET原地重复投影。公开 SessionConversationConnectionSnapshot 必填 agentView，更新 SDK/OpenAPI 正式生成产物。前端在任何写入前校验它，在原 batch/deferred writer 中与正文一起 hydrateConversationAgentView，然后维持真实后续 lifecycle replay 与546全文通知。没有新后备读取、定时器、状态猜测、持久schema或兼容层。

共享审计覆盖普通 Session/Mission 唯一 events 路由、right-sidebar selectedTask 绑定及 Task occurrence 来源；后台执行调度未发生新输入或恢复，日志 recovery 全部0；原 Session 新轮次只由535完整已闭合持久事实提供，未发现本轮调度异常。后端测试使用真实路由/ProtocolStore/数据库，正向验证连接与conversation一致的成员messageIDs/activity/目标/时间、buffered lifecycle交错、分页和跨项目边界；原有后端相关合同照常执行，UI只实页。修复后的完整历史对照使用19107，重新人工查看来源与正文，低频记录证明第一次新input即完整而不是等第二次hydration。

### 首次修复复验发现的共享来源契约遗漏

fixed-before 原生64788已正常0闭合、2次Sol EOF、四份配对退休，未启动fixed-after。真实历史来源使 SessionConnectedEvent.parse 拒绝 agentView.activity 的 source-file/source-url；独立协议读取HTTP200后立即EOF，原stderr给出invalid discriminator，不能把初次GET可见画面当重连通过。共享 transport-protocol 的 ConversationAgentActivityItem/projectConversationAgentActivityPart 已产生source-url/source-document/source-file，而 engine/model 的 TaskConversationAgentActivityItem只列text/tool/patch/file/part-error。旧GET不运行该Zod.parse，生成契约一直落后于真实投影。本轮新增严格快照暴露既有缺口。

修正共享Activity schema，复用 Message 三种既有 SourcePayload 的字段和校验，加上真实activity身份；不删来源、不绕过parse，也不新增可选agentView。两种root的后端真实持久化测试增加三种来源及其公开输出，正式重生成SDK/OpenAPI。追加 verified-before/verified-after 两份全新scope19107，沿原535历史与正式构建，继续总16次上限（原两scope4次、失败fixed-before2次、复验预计4次），保留失败证据。private读取器EOF判断没有被改为忽略，该失败是实际产品契约错误。

## 最终实页结果与结算

[七张人工查看的实图及原始身份记录](../../artifacts/2026-10-23-session-member-snapshot/README.md)。最终页168保持同一个父会话、成员、URL和authority，断线后不刷新、不切换成员。19:38:52.767 第一次恢复新input即完整：3条messageIDs、4项activity、target=msg_g0VYlVvNx00Uq6gDAjqh、startedAt=1792657863102；19:39:01.712 后续完整加载保留这些事实。相较首轮19:26:54.304至19:27:02.928的8.624秒不完整窗口，当前第一次快照即收敛。公开SSE/HTTP独立checker确认两种完整agentView逐值相同；不把checker读取当页面请求。

画面32正文/10来源→35/11，原body owner21–52、原十个Source owner保持，新body53–55与Source26自然追加；来源标题、域名、正文与摘要可读。不同日志批次按原timestamp+message去重，原/失败/最终页分别177/160/177条低频记录。页面末尾时间从错误末次状态04:38 PM变为真实开始04:31 PM；后续完整加载没有改回。第一次修复的页面只成功GET读取，事件流因来源schema拒绝，未冒充通过。

五个服务原exec 44125、74426、64788、17870、65279均已正常0退出，native/launcher/精确出生/output/request结算完整，公开shutdown全部200；每个均保留超过五分钟资源余量。10次真实Sol请求（各2）全部200/EOF，20份runtime/private auth+models退休，当前App原始entry、完整catalog和mtime保留。没有新的业务输入或新成员。源全90表、原字段/时间/canonical/文件字节mtime保持，目标schema3及实际对象一致、integrity=ok，原行变化仅两条运行租约。fixed-after未启动、未复制凭据。

验证：含Source的真实Session/Mission路由13项通过，侧聊与成员纯传输/服务41项通过，SDK正式生成、api:routes-check、根typecheck（8/8）、docs:check（345ops/26groups）、architecture-index（20篇）通过；三次Node正式诊断build分别55.30s/56.41s/54.79s，最终以第三份同资产验收。初次测试曾因默认5秒冷启动超时及新增测试创建顺序/缺少Mission身份/缺少topLevelExecutionIDs失败，已按真实创建契约修复，使用30秒单用例资源上限重跑通过；没有改生产规则去迁就测试。未新增/运行UI自动化测试。

本批没有数据库迁移、版本更新或发布。Mission只有真实后端合同，尚无独立实页历史对照；恢复过程中短暂模型配置提示和ResizeObserver通知仍需下一批调查，不能宣称全部体验问题已解决。长期Goal active，继续单agent。
