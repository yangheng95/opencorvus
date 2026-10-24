# 来源与正文的顺序、分组身份调查

## Recall

573继续单agent自主迭代，不委托；用户要求真实体验、Sources呈现/成员Rendering闪烁优先、修复后实际验证并提交推送。旧Goal三个Astra文字被用户明确单agent要求覆盖。572为progress：694ab14a8已正常hook推送、fresh0/0，修复空闲加载辅助功能误报，Task/Chat/Mission、中英文、慢读中草稿、快速改选、首页Goal入口/表单/帮助均有15张人工查看实图。零Provider请求、无auth副本，完整schema5/90表/197241原行字段时间保持，原native/exec/launcher/物理输出请求闭合，复制模型目录退休；18571未操作。当前HEAD为该提交，开始仍171原无关删除、.bun/及packages/opencorvus/bun/未跟踪、无暂存。整体Goal active。

本批重读572 Recall、571与529/541来源/正文连续性记录，以及当前TextPart/text-part-model、Markdown worker/renderer、SubagentConversationPanel resource/live projection、CardParts全部三层分组、card-message-run/message-part、SourceParts、Session Part/source writer及processor的真实Provider source处理。已搜索定义、调用、排序、来源绑定、旧决定与相关非DOM服务测试。未运行/创建用户界面自动化测试。529曾把Index分组身份列为未证候选，571只证明正常追加一轮稳定，不能替代本批顺序/中间内容补齐调查。

## 修改前分析与未知

当前Rendering只在pending且HTML为空时出现；同一Markdown owner只要已有块就不会因pending直接清空，完成缓存按32项/4M字符容量保留。暂未观察到新的worker调度失败或队列异常，不能改缓存上限或隐藏提示来制造通过。若发现任何调度/队列/唤醒/恢复/并发/终态异常，将立即横审所有生产入口、Task/Mission/Session occurrence、正常终态、重试重启、串并行与多项目。

CardParts按消息、执行/正文、来源/普通Part三层Index位置复用。消息投影已有真实key，来源自身已有精确身份；但连续分组若在已有内容前补入、拆分或移除，位置会改变，子组件可能销毁或绑定另一事实。仅凭Index存在不能断言实际重建。当前生产Source写入使用真实独立Part ID、实际持久时间与Tool结果绑定，不能回写时间或人为制造早到/晚到来源。live投影对Message排序，而同Message Part投影暂按base与变更到达次序组合，需与实际公共转录/事件记录比对；尚未确认真实失序或组件所有者变化。

影响面涵盖Main/Side/成员Dock共享CardParts、协议到达与当前transcript read合并、正文/来源/Tool分组、折叠与阅读/引用身份。后端原Part/Message/Source身份及迁移不可改造来适应UI。纯UI修复只真实页面/截图；若证据指向非UI projector顺序合同，则须有聚焦正向实际状态测试、真实checker及网页验证，不能以fixture-only冒充端到端。

## 已核实根因与实施范围

实施前核查：关闭的572库包含2716条相关持久Bus发布、230个Session。原事件经实际bridge身份补全、生产重放压缩器、完整成员projector后，228个Session/736条消息中22条正文Part倒序；原B确有一条，两个原Part持久时间为1792664873120/3123，重放到达为3123/3120。另两个Session历史含已删除Message，bridge按明确缺失行错误拒绝，未计入通过，不猜造身份。原B24条消息，非2000条读取截断。22条均为text，不能声称已证明Sources或Rendering视觉根因。

直接触发是早创建Part的较晚快照取代早快照后，压缩队列保留原发布到达次序，符合Task重放和Session连接bootstrap共享契约。成员projectParts按持久base加到达顺序push，只有Message层排序；HTTP持久读按Part canonical key排序，两条路径因而不同。主树tree-writer已有insertSessionPartByOrderKey及hydrate排序，遗漏在独立成员投影。所有被查原Part均带合法canonical key，现存pending producer亦有明确part域键。

只修改成员projectParts合并后数组，使用既有compareTimelineOrderKeys恢复canonical顺序；保留快照覆盖、字段增量、移除、完成封存、Tool终态和Message/session隔离规则。不改协议、压缩器、Source事实、Markdown队列、CardParts分组、数据库或迁移。新增纯状态正向测试覆盖生产压缩器后的新消息、持久partial加较早Part、完成封存，另用同一真实历史重跑完整checker。真实UI只读验收原Task/B、Sources阅读与切换。本批不需模型，认证不复制、Provider预算0；当前热认证授权保留给必要的后续执行。没有观察到执行调度/并发/终态异常，队列保留真实到达顺序本身正确，不改执行调度机制。

## 本批结果与限制

573已实施唯一成员Part排序修复。原始真实历史的完整生产checker由22倒序降至0，228个可投影Session/736条消息范围相同，两条明确缺失行错误原样报告。进一步读取原Message角色确认22条全部为user输入，原B为orchestrator派发上下文，不能据此声称assistant正文Rendering根因已确定。

自有原生开发CLI的真实Task和Session子会话接口均200，各24消息/77Part/6个source-url，原两Part顺序一致；原PNG公开接口200/643字节且与不可变原件相同。`/ui`实际交付标准Node构建main-DhqY_xIg.js；手动打开原Task、B成员，滚动阅读W3C原计划/来源/后文与表格，展开和收起工具结果，并逐张人工查看4张实图，见[验收产物](../../artifacts/2026-10-24-source-render-order/README.md)。没有新模型流或断网重连；未复现Rendering闪烁，不把本批投影修复扩大为整体完成。

聚焦非UI验证：`bun test ./packages/overlay/test/subagent-conversation-service.test.ts ./packages/overlay/test/subagent-live-part-order.test.ts`为32pass/70expect；`bun run --cwd packages/overlay typecheck`通过；Node实际构建57.29秒通过，副本SQLite文件大小/mtime保持；`bun run docs:check`通过。首次测试路径缺少`./`而误选临时重复工程，精确文件路径已重跑；首次构建在自有home保护处终止，正确隔离环境重跑通过；首次checker用了不存在的sources类型，按真实Source三类型修正并重跑两个公共接口。首次失败与修正均未掩盖为通过。

完整90表/197241原行字段时间和schema5保留，原行差异0、Provider活动490保持；源库bytes/mtime、canonical及原模型目录字节/mtime保持。没有auth副本、Provider预算/实际请求均0。原exec37264已join退出0，native和launcher退出0，shutdown200距固定deadline940970毫秒，物理/输出/请求清理和出生链完整，复制的完整模型目录已清退。用户18571服务未操作，整体Goal继续active。提交推送证据以实际Git交付为准。

## 调查与验收方案

1. 只读已完全关闭572完整副本与真实protocol_event/Session/Part事实，查清字段定义、成员消息数量、真实来源/文本的事件顺序、公共canonical顺序和分组身份变化。先使用生产projector与真实历史，不篡改数据库、不构造来源、不会把静态字符串或DOM断言当验收。没有实际顺序问题就排除本候选，不为改动而替换Index。
2. 如确认失序/身份变化，补齐直接触发、数据/控制流、旧路径遗漏、全部调用/共享合同/持久化与测试文档风险后再修唯一实现。事件重放只能证明投影合同；必须另外启动自有当前开发CLI的/ui，手动看与目标绑定截图，观察真实历史读取、原成员/来源和必要的有界活跃更新。不能用模型自述代替视觉证据。
3. 需要真实Provider时完整auth/models配对，分别证明usable/projected/actual gpt-6.1-sol，流式且预算/原reader终态保留；若只读验收则不使用凭据或模型。所有native scope固定20分钟、180秒启动无活动、至少五分钟主动收尾，不因观察超时重启或扩预算。仅自有服务/新页，不操作18571、真实用户数据库或用户窗口。
4. 完整90表/源行字段时间/schema对象/canonical/源库bytesmtime和资产身份保持。实页完成后正常shutdown、join原exec/native/launcher/物理输出请求/出生链，全部实际reader结算后清退自有凭据/模型目录；取消不能充作EOF。相关检查、三索引/目录README、范围提交、fetch/merge上游/完整待推集合/正常hook push/fresh一致。未达指标如实保留，整体Goal继续active。
