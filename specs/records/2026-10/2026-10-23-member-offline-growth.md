# 成员离线期间新增内容的恢复

## Recall

546 继续用户自主迭代、Sources 显示与侧栏 Rendering 根因修复、真实页面验收后提交推送的要求。最新单 agent 规则优先，不委托。545 已推送 4ed955d0f，fresh 0/0：静止 Task 同页重连保留 14 段正文、5 个 Source 和阅读位置，但实际页面没有新的成员 transcript 请求，独立跨 epoch checker 不代表页面已获取新内容。上一轮是 progress；长期 Goal 保持 active。

已读 AGENTS、545 Recall/完整结果、07-panel-reactivity 的成员刷新和 Task/Session 重连合同；全仓搜索 `subagentConversationTranscriptRevision`、`advanceLiveConversationAgentTranscriptSequence`、`hydrateConversationAgentView` 的定义、生产调用和相关纯服务测试；阅读 SubagentConversationPanel、conversation-agents、conversation、sse、selected-stream-cursor、events，以及 539 修复记录。现有 service/controller 测试是协议/投影合同，不是 DOM 或组件渲染；本批禁止创建或运行 UI 自动化测试。computer-use 和 benchmark-debug-template 已在本持续任务读取并应用。

## 修改前分析

可观察现象仍是用户报告的 Sources 阅读和反复 Rendering；此次先验证相邻但未覆盖的数据完整性边界。直接可疑触发点：重连通过完整 Task tail 恢复得到新的成员历史，而侧栏刷新键只含 sessionID 和 transcriptSequence。后者只由实时边界事件推动，hydrate 的记录没有这个字段；旧值和新值都可能为 0。侧栏 targetKey 因真实身份不变而正确保留，但可能因此一直呈现旧资源。当前只是代码推导，必须由真实页面与实际 HTTP 请求证实。

539 删除了中间流式快照引起的重复回读，正确边界须保留；不能通过 broad tree version、每个 delta 抓全文或重建组件来补洞。生产事实来源仍是后端 transcript、当前唯一活动投影与真实 hydration。潜在影响包括 Task 和 Session 成员、同 Session 新执行轮次、已有消息补全、终态与同目录/跨项目选择，需按真实控制流横向核对。尚未观察到新的调度或队列异常；若出现则立即按共享机制审计全部入口、恢复与终态。

接口、数据库 schema 3、消息内容、模型策略、执行调度与发布版本预期不变。修改前继续核对唯一数据流、测试与架构；若实页不能确证则不做猜测性生产改动。风险是把旧数据副本当新模型执行、把接口 checker 当 UI 恢复、把初始化 Rendering 当重复闪烁、把诊断日志漏采当稳定；所有证据分别标注。

## 固定验收方案

1. 使用两份已实际执行且闭合的完整历史来源：540-ui-after 是 541 实际输入来源（原 B 16 消息/4 来源），541-after 是同一原 Task/B 完成真实 Sol 新责任后的完整来源（20 消息/5 来源）。复制全部 90 表、所有原行/字段/时间、canonical 配置和原 PNG，不合成、删减或插入消息。540 来源曾因资源 deadline 退出 1，但其两次 reader 均原 EOF，物理/输出/request 与配对已闭合；保留该历史事实，不当成正常退出。541 来源 13 次 Sol 全部原 EOF、正常退出 0。实际复制时重新核验。
2. before/after 顺序使用 19093，同一自有页面保留旧 B 阅读状态，正常关闭 before 后再启动完整较新来源的 after。新旧内容确为原真实模型产出；本批不新增业务输入。每 scope 最多 4 次真实 Sol（用于当前 App 认证与完整模型目录的 preflight），每组 20 分钟原生资源上限，启动/preflight 180 秒无活动界限，至少保留 5 分钟收尾。
3. 使用 Node 正式诊断构建和 Source CLI 的 /ui，不启动独立前端服务器。只补低频正文/Source 生命周期观察。内置浏览器真实打开原 Task/B、记录旧来源和正文截图；断线后不 reload、导航或改变 authority，观察自然恢复。公开端点另行验证新旧完整身份和 epoch，HTTP 日志区分 checker 与实际页面请求。
4. 若确证遗漏，完成共享控制流和契约分析，落盘唯一修复方案后再改。沿已有资源 storage、targetKey、120ms 刷新控制器和生产 parse/merge，保留已有正文 owner。非 UI 服务行为增加聚焦正向合同，页面只真实交互/截图人工查看。若需要 fixed-before/fixed-after，则顺序使用 19095、复用同一对完整历史来源，每组最多 4 次；本批总上限 16，未需要不准备认证或启动。
5. 原 reader 全部结清后正常公开 shutdown、join 原 exec、核对 native/launcher/精确出生/输出/request，退休每组 runtime/private auth+models。原来源数据和用户 App 认证保持。四组最多 16 份配对成员，未启动组不计为已验。
6. 收敛最小非秘密证据、当前架构（仅改契约时）、三个索引；执行聚焦检查、docs/architecture、实际值扫描，范围提交、fresh fetch/merge/待推集合审计、正常 hook/push，继续长期 Goal。活动流重连不由这个已完成历史切换场景代替。

## 修复前实际证据与唯一实施方案

before 已真实返回 16 消息/4 来源，页面 11 个正文 owner、4 个 Source；正常关闭后同一标签 162 留在旧结尾 LIVE539C_AFTER_END。after 自然恢复 Online，主对话已加载 LIVE541 的原真实历史，18:02:08 的 Task conversation 请求完成 200；侧栏仍为 11 段/4 来源和旧结尾。18:02:23 独立 checker 返回 20 消息/5 来源。手动 All agents 再打开同一个 B 后，页面立即显示 LIVE541_AFTER_END、14 段/5 来源，旧 owner 保留而新内容追加。由真实截图、公开返回和 HTTP 请求区分证明侧栏丢失了快照刷新边界。

根因：`hydrateConversation`、Task `mergeLatestConversationTail`、Session `mergeSessionConnectionSnapshot` 都提交真实完整读取，但只更新主投影；现有成员通知总线仅传 live Message/Part 事件。侧栏的稳定 targetKey 正确保留了资源，刷新 controller 仅观察实时 transcriptSequence，因没有新的 live 边界而保持旧资源。539 的流式中间值抑制不是本次错误，应完整保留。

横向审计：Task 初次 hydration、epoch/回放失效恢复均进入上述完整读取；Session（包含 Mission）连接快照进入同一 Session 分支。前置 authority、selection/replay epoch 检查负责旧请求隔离。成员 dock 的唯一来源是当前 boardStore selectedSource，Side Chat 独立流不写这个成员目标。执行轮次更换、running/completed/error 不决定完整 snapshot 是否包含新内容，不能用状态触发刷新。串并行和多项目方面沿同一个 controller 保留单定时器、单在途读取及一次尾随刷新，并以现有目标（source/session/directory/authority）隔离；不更改调度、队列、唤醒或后端终态。原来源的历史 deadline 失败已闭合，与本次 UI 完整读取后的旧资源有不同持久事实。

唯一方案：把现有成员通知总线显式区分真实 live 事件和已提交的 source snapshot。三个完整读取成功提交后发布 source snapshot 通知；侧栏只为当前 source 的活跃目标调用既有刷新 controller 的 invalidate，沿当前资源进行一次合并读取。新增 invalidate 复用现有 pending/inFlight/timer/generation，不添加计数器、缓存、轮询、协议消息或第二渲染来源；读取未就绪时由原 ready 观察继续驱动。替换旧 listener/publisher 名称并同步全部调用，不留旧接口。组件 targetKey 与正文 owner 不改变。

纯服务正向测试覆盖同一通知总线的 live/Task/Session 事实、初始读取期间的快照失效与同 revision 再读取、在途刷新后的合并尾随。真实 fixed 同页新旧完整历史复验，并记录初始 11 个正文和 4 个 Source 的 owner 是否连续、新内容是否自动出现；不以静态或 DOM 断言代替。Session 离线新增内容的实际页面仍单独列为未覆盖，不把共享代码审计冒充实测。

两组原服务已正常关闭：exec 48124/2121、native/launcher 均 0，4 次本批实际 Sol 请求均 200/原 EOF，8 份 auth/models 副本退休。初次准备脚本误读不存在的 engine_task.status，已按实际 schema 去掉该错误检查并重跑；Task 状态由真实 board 接口验证。初次重连的模型配置提示随后自然恢复，不把启动中的截图当成持续故障。

## 修复与实际复验

实现按上述唯一方案完成：现有一个更新总线承载 live 和 snapshot 两种内部读事实，三处完整读取完成后通知；当前成员沿同一刷新 controller 的 invalidate 合并回读。没有新增消息、序号事实源或轮询。已有 source/session/directory/authority 目标身份、资源 storage、实时中间值抑制和正向错误契约保留。当前架构 07 已同步。

[七张人工查看的截图与实际证据](../../artifacts/2026-10-23-member-offline-growth/README.md)。fixed 使用新的自有页 163 和端口 19095，重连期间没有刷新页面、切换成员或修改 URL。旧 B 仍为 16 条消息/4 来源、11 段正文。新服务恢复后，实际页面在 18:10:47.448 完成主 Task conversation，随后 18:10:47.973 完成成员 GET；独立 checker 到 18:11:52 才发出。因此新增内容来自页面自己的恢复路径。

页面自动显示 LIVE541_AFTER_END，正文变为 14 段，来源变为 5 条；上滚可实际读到 ReConcile 的标题、域名和新增长正文。已有正文 owner 11–21 及其块数保持，四个 Source owner 2/4/6/8 保持；只有三段新正文 owner 37–39 和新 Source owner 10 首次挂载。原正文没有在本次记录中退回零块。原最后一段因历史生命周期回放出现 streaming true/false 两次观察，但 21 个正文块始终保留，不能将其称为卸载闪烁。新正文约 75–109ms 出现首批 HTML 是正常首次解析。原本停在结尾的自动跟随从 top=17610 移到新增结尾 22067；之后手动上滚至 19907 查看新来源。

四份来源均为完整 90 表：before/fixed-before 各自读取原 189582 行，after/fixed-after 各自读取原 192812 行。分别自然增加到 190018、193276、190018、193324 行；所有原业务行/字段/时间保留，仅目标的两条运行租约自然更新，源数据库字节数/mtime、schema 3、真实对象与 canonical 配置保持。fixed-after 公开附件返回 200、image/png、原 643 字节一致。本批没有触及用户数据库。

四个原服务 exec 48124、2121、43309、81418 均 join exit 0，公开 shutdown 200、native/launcher 0、物理/输出/request 清理完成，精确进程身份已结束。每组 2 次当前 App 认证的 Sol 流式请求，共 8 次，全部实际模型一致、HTTP 200、原 EOF；16 份 runtime/private auth 和 models 配对成员退休，原认证与完整模型目录保持。历史 541 的业务调用不重复算成本批执行。

## 验证与交付范围

- `bun test ./packages/overlay/test/subagent-conversation-service.test.ts`：28 pass、66 个正向断言。首次命令缺 `./`，Bun 把路径当过滤器额外搜到 tmp/gallery-project 的同名副本，那里缺少 Tauri 依赖；已改为精确文件重跑原验收，不改无关副本、不把那次失败算通过。
- `bun run --cwd packages/overlay typecheck`：exit 0。两次 Node 正式私有诊断构建 exit 0，53.75/57.58 秒；构建资产分别 main-D8VOFJfi.js 和 main-CZaeEkDv.js。没有 UI 自动化测试，实际页面/截图承担视觉验收。
- `bun run docs:check` 通过（345 ops、26 groups），`bun run check:architecture-index` 通过（20 篇当前文档），`git diff --check` 通过；20 个交付文件实际 access/refresh 值扫描匹配 0。正常提交推送按仓库合同收尾。没有数据库或公开 OpenAPI 变化，不调整版本和发布。

已确证并修复已完成 Task 成员离线新增内容的恢复缺口，同时保留已有正文/Source owner。活跃流重连、Session/Mission 离线增长仍须独立实页验收；不将本次结果扩大为用户所有 Rendering 闪烁均已根治。长期 Goal active，继续单 agent。
