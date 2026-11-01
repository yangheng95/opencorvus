# /side 原稿交接与创建失败恢复

## Recall

用户要求持续单agent自主排查UI/UX（User Interface/User Experience，用户界面/体验）和功能、真实隔离页面截图/人工复核、范围提交及正常推送，不动正在使用的窗口。旧Goal中三个Astra已被后续单agent要求覆盖，不委托。上一轮865交付2f33192fba21392dc2b67e1ce62cf2ea6115a4f8，2026-11-01T09:38:40Z重新fetch（拉取）/merge（合并）后0/0，37任务文件干净，23项纯数据/传输测试55断言、17原图、6真实Sol流式请求及6份配对副本退休。最后复核09:39:59Z保留180无关状态，另一个会话继续改重型工作台记录/产物，只有实际冲突才等待。最新闭合源865-after2：schema（数据库结构）9/92表238803行，80项目、9Goal、111会话/784消息/2225 Part，模型累计1193。不能重开旧scope或延长其截止。

本轮开始git status保存.tmp-product-iteration/status-before866-private.txt；当前HEAD仍2f33192fb，180余无关状态随后增加，不改无关文件。前轮属于progress（已产生权威进展），不是等待或状态复述。本轮尚未修改产品。已读当前07-panel主输入/Side Chat/quotation（引用）/创建合同，ChatComposer的唯一localCommand和onSideChat分支、main.requestSideChat/全部调用/consumeRequest/工作区退休，SideChatPanel的加载/创建/失败/重试/销毁/提交，composer-draft唯一记录及revision（版本快照）操作，后台session.createSideChat/Session.fork的事务。全仓搜索SideChatRequest/requestSideChat/consumeRequest、模型/引用/附件相关入口；没有新增或运行UI自动化。

## 现象线索、触发与根因分析

主输入`/side 问题`目前await props.onSideChat后直接writeDraftText("")。main的回调只同步发布一个内存SideChatRequest并打开面板，不等待真实侧聊创建。SideChatPanel稍后才POST/session/:source/side-chat，成功后才把request.prompt写入新侧聊的现草稿记录。失败时只显示错误并保留临时request以供重试；源持久原稿已清空，关闭或重载会退休临时请求。因此“面板接到请求”被误当作“原稿交接完成”。865主发送的durable acceptance（持久接受）修复并未覆盖这个本地命令分支；该分支不向LLM（Large Language Model，大语言模型）发消息，而是把问题交给用户继续编辑，不能借主HTTP发送合同伪造接受消息。

影响面是唯一Main→Side命令交接、Side创建失败重试、关闭/重载/来源退休、已有Side与新Side选择、源原稿在失败后被改写。选中文字Ask in side chat和空白打开没有需要消费的主草稿，应保持其现引用/打开语义。Side正式发送/Stop、历史快照、引用原文、Message ID、接口和调度均不拟改变。Backend fork先准备原上下文，再把新Session及完整引用历史放在一个真实事务内；本问题尚无执行调度、队列、唤醒或终态异常证据。如发现这类事实，立即横向审计所有Task/Mission/Session入口、轮次、终态、重启/重试、串并行与多项目，不能据单用例归为局部。

需要真实复现确认：失败后主字段/侧字段是否为空、实际侧聊列表是否为空、重载后是否还可找回问题。代码和临时request只能作为线索，不先宣称永久丢失。公开API（Application Programming Interface，应用接口）/SDK（Software Development Kit，开发工具包）/数据库schema、持久字段和单一draft store（草稿存储）均拟保持。

## 隔离复现与实施方案

新单批75分钟绝对截止，实例before/38538、after/38539，共用截止；启动至少余10分钟、结清至少余5分钟。完整复制闭合QA（Quality Assurance，质量验收）源的所有旧业务行/真实namespace（命名空间）文件/项目Git与业务文件。按现授权配对复制认证及完整模型目录，预检真实注册/精确openai/gpt-6.1-sol；两实例首次额度0，侧聊原稿交接不需要模型执行，禁止发送侧聊草稿或增加运行中额度。后台内置页只操作本人新项目/正式创建的空白源Session，不访问用户18571，不刷新/重启/杀用户窗口。

通过真实公开API建立本人新项目的空白Conversation source，实际页面`/ui/`进入该源。为了触发真实创建事务拒绝，只在自有隔离副本新增一个限本人新project_id及sourceSessionID的诊断SQLite trigger（触发器），匹配NEW.metadata.sideChat.sourceSessionID后RAISE(ABORT)。先验证DB（Database，数据库）路径完全位于本实例、源Session/Project匹配、旧源库为闭合只读来源；不写源库，不修改路由、请求或响应，不mock（模拟）HTTP。验证真实500及正式Side列表/用户消息事实，随后精确删除这个临时诊断触发器。最终逐对象比较sqlite_master、schema9/92及旧行，确保故障注入没有遗留结构变更。若该故障方案不可实际生效，先修复诊断路径再验收，不以mock替代。

在真实现象确认后，拟沿已有ComposerDraftRevision引用请求发起时的唯一源记录。主`/side`分支不再立即删除原稿；main只把该revision附到现SideChatRequest。Side创建正式成功、把原问题写入新侧聊现记录之后，才调用现clearComposerDraftRevision消费仍未改写的源稿。Main文本本来就订阅同一store，随真实记录清理更新，不增加接受bool、第二草稿、回调总线、隐藏消息或持久格式。源稿变化保留新作者输入，旧问题仍进入请求明确创建的新侧聊；请求/面板/source/authority退休沿已有generation，旧成功不能清另一来源。选中文本/无问题打开不携带源revision，原行为保持。

需要审查的边界：失败时源/目标当前记录、重试沿原request、关闭或reload的持久作者输入、一个失败后另写新输入再点Side重试、新创建真实Session已有回执但页面退休时的归属。没有新通用数据接口/格式时不为纯UI逻辑添加自动化测试；已有revision数据合同跑聚焦正向测试，UI只能真实操作/原图/人工复核，不写/运行源码文案、DOM（Document Object Model，文档对象模型）、组件、快照、Playwright测试或像素断言。

验收覆盖before失败/重载、after失败保留/重载后手动交接、成功后源稿清理与Side问题可编辑、失败后源稿改写再重试时两份真实意图各归其scope（作用域），英文/中文控件和反馈；不把未执行的Side真实模型/Stop矩阵说成通过。检查9Goal公开事实、源库全部旧行、完整附件及旧项目业务文件/Git；正常shutdown200、原exec/native/launcher0、物理/输出/请求/出生身份结清及全部配对副本退役。同步三索引并跑当前docs:check，独立范围提交、fresh fetch/普通merge、完整待推集合、正常hook/push及远端回读，持续Goal保持active。

## 基线事实与实施决定

本人111后台页、before/38538、冻结main-D2WqW_LM.js，源ses_-zUQHgLMGzzzC25WwNKA及项目prj_hGq5B7R8t2YtVXDGFYpB均本轮正式创建。01原`/side`问题；实际点击Send后POST side-chat返回500，02主字段为空、侧字段无可编辑问题，正式Side列表0、源消息0、Provider0。03原请求诊断；精确DROP本人诊断trigger之后正常reload，04主输入仍为空，正式Side列表仍0。这证明没有持久目标可承接问题，原稿只剩临时request而已，关闭/重载确实丢失。基线本人页已关闭，公开shutdown200、原exec/native/launcher0与配对副本退休，未动用户窗口。

准备工具曾有两个问题：泛化前缀替换把服务模板复制提前，第一份serve.ts已复制但随后targetProject尚未初始化；恢复时该已存在模板使独占写保护中断。均在服务/凭据启动前发生。已保留失败脚本/终止结果，恢复同一自有副本前逐表核对已有DB与备份、源计数，补全模板前逐字节核对已存在的serve.ts，没有删除或重置数据库、重开scope或延长期限。后续正式创建源接口实际201，原脚本错按200，且把UI的sessionKind=conversation误当持久kind；已查到API/持久身份为assistant、UI呈现类别为conversation。修正诊断断言并正式读取唯一已创建源200，未重复创建，不误报凭据/模型问题。

最终采用现consumeRequest作为交接确认点：SidePanel只在新Session正式创建且目标草稿已写入，或空`/side`打开已有侧聊后调用它。主输入把请求发起时captureComposerDraftRevision附到现SideChatRequest，主分支删除提前清稿；main.consumeRequest先用现clearComposerDraftRevision消费仍匹配的源稿，再按原精确request引用退休临时请求。这样也覆盖空`/side`，无需Promise确认总线或额外状态。失败/销毁沿已有owner不消费，修改后的源稿不能被旧请求删除；选文和普通打开不携带sourceDraft。仅3个UI/入口文件及复用数据合同，接口/SDK/schema/持久格式不变；不修改Side发送/Stop或后端fork事务。

## 最终实页与完整结清

after/38539、本人112后台页（已关闭）、冻结main-DJUBbXEj.js；新源ses_-zUQHdnFzzz3BwfFrMBQ及项目prj_hKDmkeobBE6Q4IHKpyEx。重复相同原稿和真实事务500，05主输入保留、正式侧聊0/源消息0/Provider0。恢复触发器后实际reload，06同一原问题仍可编辑。通过现设置切换中文，直接从保留输入重试，正式创建侧聊1，07目标字段为原问题、主字段才空，未发送给模型。

再次用相同source的诊断触发器拒绝第二份原问题的创建，08中文反馈、主原稿保留、侧聊仍1。明确把主输入改为“新的独立主输入866…”后撤销触发器，点击Side原请求“重试”，09–10新主输入保持，第二份原问题进入新侧聊2。实际重载、普通侧聊按钮重新打开，11两份稿仍完整可编辑，证明数据归属与持久保留。随后测试者明确把新主输入替换成空`/side`，12只打开既有侧聊并消费命令；正式侧聊仍2，不把主动替换说成清稿回归。

正式API（接口）在原失败、恢复、创建和重载节点读取：before sideCount=0/0/0；after=0/1/1/2/2。实际创建POST before1、after4，与真实两次候选失败/两次成功一致；普通打开及空命令保持原两个Side Session ID。源及所有侧聊的公开消息数组均空，Provider请求0，问题是客户端草稿，未合成参与者消息或模拟模型回复。三次原服务器日志requestID及data.error.message明确命中诊断SQLiteError，不拿最后一个HTTP标题冒充存储根因；见storage-errors.json。

16项聚焦纯数据正向测试19断言（原14项及2项源/目标原稿交接状态合同），类型检查、i18n（Internationalization，国际化）2688键及普通前端构建均0。未写/运行UI自动化、组件/DOM/源码文案/快照/Playwright测试或全量bun test。实际命令：

```text
node .tmp-product-iteration/side-chat-draft-handoff-866/run.mjs unit-drafts-after bun run --cwd packages/overlay script/run-unit-tests.ts test/composer-draft.test.ts
node .tmp-product-iteration/side-chat-draft-handoff-866/run.mjs types-after bun run --cwd packages/overlay typecheck
node .tmp-product-iteration/side-chat-draft-handoff-866/run.mjs i18n-after bun run --cwd packages/overlay check:i18n
node .tmp-product-iteration/side-chat-draft-handoff-866/run.mjs ui-build-after bun run --cwd packages/overlay build
```

before/after两实例公开shutdown200、原exec/native/launcher0，physicalCompletion/outputDrainComplete/requestCleanupComplete与出生身份全部结清，4份配对认证/完整catalog副本退休；源catalog字节/元数据及auth元数据保持，未读取或输出秘密内容。额度首次与实际均0、未执行Side LLM（大语言模型）发送或Stop，累计1193保持，不能把配置预检说成新一轮远端模型验证。共同75分钟截止未改，退休余量4074058/3272713毫秒。

schema9/92表保留，两个实例所有非内部sqlite_master对象逐项相等，临时诊断触发器均撤销；原238803/238861行逐字段保持，当前238861/239041行，旧源库行及结构未写。完整真实namespace各217项、旧80/81项目业务文件与Git事实保持，零文件系统排除/容量槽位复用，九个Goal完整公开事实前后相同；新项目内部.opencorvus配置是正式应用产物，不冒称为受保护旧业务文件。原资格/节点/物理证据聚合在verification.json和formal-side-facts.json。

覆盖边界：选文/引用入口已全仓审查，未宣称本轮真实引用历史或模型执行；Side正式发送/Stop沿当前合同，未额外运行。没有公开API/SDK/schema/持久字段变更，也没有观察到执行队列或终态异常。本轮期间另一已授权会话提交394c7ee04的月结benchmark修复，只涉及其spec/artifact及索引，与本轮UI/数据路径不冲突。交付必须以当前HEAD为基线保留该提交和最新无关改动，不回退到旧2f331；root索引只暂存本轮新增行，正常fetch/普通merge、完整待推集合审查与push回读后另据工具证据确认。本持续Goal保持active。
