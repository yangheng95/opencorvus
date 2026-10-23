# 首页启动与项目归属复核

## Recall

561继续单agent自主迭代，后续单agent要求覆盖旧Goal中的Astra，不委托。560为progress：51d6fa609已正常push，fresh0/0；共享恢复的全局流重复重建根因已修复，真实单页连接3→1，Sources原位保持，12合同83断言、20实图及四次实际gpt-6.1-sol流式200/原reader EOF。六服务原exec/native/launcher均正常退出0，复制auth/models退休；所有原数据保持。原生restart、其余实际流式入口和默认首页的项目语义仍未完成。整体Goal保持active。

用户原要求“完全看不到goal怎么用的，而且默认页布局很怪”。已读后续原始决策（goal-composer-menu Recall）：“这个goal要像codex一样命令启动或者塞进+中，放到UI上等于是脱裤子放屁”。因此保留唯一加号菜单和现有表单，不恢复旧首页Goal卡片/创建条。当前热认证允许隔离使用OpenCorvus的完整OpenAI条目和完整相邻模型目录，目标必须是gpt-6.1-sol、所有请求流式，秘密不入日志/spec/提交。

开始工作区172删除、115修改、10未跟踪，唯一外部暂存engine-evidence.ts；HEAD51d6fa609。所有无关改动保留，不创建branch/worktree。并行未提交迁移4也保留，不混入本轮。闭合560-fixed-after是schema4隔离数据源，用户数据库不参与；只操作新自有服务及临时浏览页。

## 已读、全仓搜索与分析边界

已读当前continuous-goal架构User controls、07-panel的global launcher和静态publication合同、07-panel-reactivity；560 Recall/事实及goal-composer-menu、goal-entry-workspace-review、goal-home-copy-layout、home-settings-scope历史。代码覆盖App首页/Goal挂载、ContinuousGoalControl、ChatComposer加号、Conversation首页portal/标题/CSS、main.openGlobalComposer/launcherHomeActive、workspace.enterDirectoryFreeWorkspace/openGlobalChatLauncher/resolveGlobalComposerProject/resolveGlobalComposerSubmissionContext、createGlobalConversationSession和project-directory真实标签函数。全仓搜索相关定义及调用，未修改接口。所遇workspace/项目合同测试只作线索，不运行UI自动化，不新增任何DOM/组件/文案/截图断言。

可观察线索：559/560根URL曾显示“在匿名项目中开始工作”，明确New Chat后实际创建新的dated UUID Project。不能拿根URL的旧Task恢复当错误，也不能拿两个不同导航owner的截图判定归属错误。当前首页标题取selectedSessionDirectory或settings.directory；全局New Chat的唯一生命周期清空runtime/settings目录，真实提交用global/chat或global/work原子创建Project/Session。若目录已选择，resolveGlobalComposerProject明确复用该目录。是否存在同一owner标题与发送实际归属矛盾、首次加载布局或Goal菜单问题，需要新真实页证据，当前根因未知。

本轮先观察，不预设UI补丁。数据/控制路径、公共契约、调度/队列/终态当前没有新异常；若实际恢复/提交异常则立即横审所有Task/Mission/Session入口、轮次、重试重启、串并行及多项目，不用单例/模型行为解释。若只是正确的显式Project标题则保留；若证据支持修复，先补齐触发点、真实样式/来源、旧路径未治原因、调用与测试/文档/交付/风险，再改唯一实现。没有UI产品改动也可以交付明确新运行证据，但不能虚构“修复”。

## 实施前方案

从完全闭合560-fixed-after的完整90表数据复制新before，继承源schema4并逐行/源字节mtime/canonical核对。正式完整Node UI publication使用560已资格化main-HBKlRKaR.js；同源CLI `/ui`，随机空闲端口，20分钟原生边界、180秒启动无活动、至少五分钟收尾。复制/核对完整OpenAI认证与models，分别验证凭据、目录投影、api.id及真实流式预检，总模型预算6，先保留足够后续验收额度。

新自有页分别检查明确全局launcher、选定Project后的空首页与New Chat切换，实际点击加号→持续目标→帮助/取消，保留原输入草稿并截图人工查看；必要时在真实全局页发送有限Sol文字，核对原创建请求/返回Session/Project与标题，不发隐藏消息。所有提示仅限此隔离测试，不启动子agent或无限目标。首页无问题则如实记录，沿证据选择下一步；有实际产品改动时正式build及新独立publication后再截图，不以typecheck/build代替视觉。

每个scope正常公开shutdown、等待原始exec/native/launcher/物理/输出/请求闭合、Provider原reader EOF、复制凭据/目录退休及全源/目标数据检查。新spec/artifact和四索引同步，当前文档及聚焦正向检查、必要类型/build；精确范围commit，保留其他暂存blob，fetch/merge upstream、完整待推集合审查、正常hooks push及fresh0/0。保持整体Goal active。

## Before实际体验与实施收敛

source CLI61856原exec16649，启动前完整OpenAI OAuth/模型投影及gpt-6.1-sol流式预检已通过。明确全局launcher页217实际呈现What shall we work on?，标题/输入/建议同列，没有匿名项目归属。加号→Continuous goal正常打开唯一表单，预填HOME561未发草稿；About goals关闭回首页后草稿保持。01—04截图人工查看。帮助的访问树把列表原生语义和CSS计数各输出一次，但04实图只有单个编号，不判断成视觉重复编号问题。

实图03首页确认按钮是Start goal，04帮助第二步却说choose Create goal；中文同一说明也硬写“创建目标”，而首页实际key为continuous_goal.start。直接触发是首页打开About goals；根因为guide.define.body把某一个owner的按钮名硬编码到共享帮助，首页/已有owner的footer已经按props.home区分。旧入口移动只更新guide.start.body的加号说明，未把第二步确认指令绑定到实际表单。GoalGuideSteps只有当前同一组件内一个使用点，Home/主会话/Side都共享它；本轮不增入口、表单、状态、消息或业务配置。

修改方案是给已有GuideSteps传入本owner当前确认按钮的本地化label，中英文guide.define.body都插值该label。只改当前组件和两locale键，其他文案/布局/公开API/数据/执行/迁移/权限不变，无非UI新行为。风险为首页/已有owner/Side帮助标签选错或语言参数漏传，须新正式build、独立publication后的中英文Home及已有owner帮助真实截图，并保留草稿/取消流程。纯UI文案不新增/运行自动化测试；语言参数检查、类型/build只作补充。

## 实际发送、排除项与新publication

明确全局首页实际发送有限验收文字，POST /global/work于21:49:21.890到达，返回/选中Session ses_-zUR5OmbOzzRR2yKQtE2、Project prj_hNGT4wsmwC7GHqHckukD、该before runtime下dated UUID目录88c6df47-400b-4d06-bf40-644cde205cb8；原模型可见回复“首页新对话归属正常。”，05图实际查看。readonly SQLite及真实GET /work-ledger都只有一份该Session及明确目录；不能用模型回复本身证明归属。随后新对话中文首页06仍为“今天想做点什么？”，全局标题没有沿用匿名Project。

访问树两个相同标题的初步线索被进一步证据排除：真实DOM一个是项目组y221.5的当前行，另一个是Recents独立section中y1070.4、视口外的最近投影，没有第二个Project祖先。截图中旧Project的相似短标题实际为560另一原Session。已核对实际row identity、祖先挂载、矩形、canonical API及DB；没有分组串写、并发恢复或调度/持久化异常，不修改WorkLedger、reconcile或共享列表。对用户的初步判断已及时更正，保留私有观察而不包装成修复。

before原exec16649/native17200/73084正常公开shutdown200及原exec/native/launcher退出0、physical/output/request完成，余644959ms。四次实际gpt-6.1-sol请求streaming200且原reader EOF；包含预检和有限发送原链，不能把调用数猜成单一用户消息数。最大6，未耗尽。90表172483原行保持，目标仅两条运行容量租约lease/owner/acquired/expires变化，Provider活动425→427；源bytes/mtime/canonical/schema4对象/integrity保持，auth/catalog各退休1。中文07帮助旧指令也已实图查看。

新Node构建原exec32346已完成0，入口main-p5w1SQyE.js。后续重复读取该已完成句柄得到Unknown process id，不是构建失败，也不重启构建。after使用新独立完整publication和闭合before完整数据，同61856、20分钟/180秒/五分钟边界；复制完整认证/模型目录并验证未过期OAuth及目标模型投影，但本scope仅UI复核、不发业务输入且model request cap0，不再次发Provider预检。实际Provider资格来自before四原请求，全批总预算6、剩余2退休，不借此扩大调用。

## 中间复核纠正与最终修复决定

新after页218的08中文首页表单、09帮助与取消草稿均实际查看，首页指令正确。随后10已有Chat表单实图仍显示“开始执行目标”，不能沿用前文“footer按home区分创建按钮”的错误推断。重新逐行读取footer确认mode=create统一使用continuous_goal.start，home只区分归属/介绍/提交链；早期摘录未读完整条件导致拟定参数错误。当前中间GuideSteps在已有owner会选旧continuous_goal.create，因此该publication不具备最终交付资格；保留图片与失败事实，不冒充全部通过。

根因现已收敛为旧帮助与新统一启动动作脱节，影响Home/已有Chat/Task/Mission/Side所有create表单。最终方案用本组件一个CREATE_ACTION_LABEL_KEY同时供create footer与GuideSteps插值，删除不必要的按owner分支/新增props。全仓精确键搜索只剩两locale中已废弃continuous_goal.create和本次错误引用，当前表单标题/其他key不同；删除这两条废弃文案仅移除旧标签，不影响接口/状态/工具或历史内容，也不保留“创建目标”作第二事实。新正式build后再启动独立verified publication，重新查看首页与已有owner的中英文帮助/按钮。当前after需正常关闭、结算及退役后复制完整数据，verified保持0模型、完整auth/catalog核对、同一资源边界和五分钟收尾。

## 最终首页/会话通过与侧聊验收预算修正

最终构建原4521完成0、main-DXPgQK57.js；verified原exec21586/native96088/72712。12—19八张最终实图已人工查看，中文/英文Home和已有Chat的create按钮均分别为“开始执行目标”/Start goal，帮助第二步对应，取消后HOME561_VERIFIED草稿保持并已清理。没有提交任何Goal，也没有用前一中间publication替代该资格。

扩展打开侧聊发现“Side chat needs attention”，20图实际展开原详情为E2E_REQUEST_BUDGET_EXHAUSTED，streamRequest明确agentID=memcy、gpt-6.1-sol。当前零请求checker把打开Side的真实上下文摘要也拦住，audit max0/exhausted=true/实际请求0；它不是认证/模型目录错误，也不是凭最后状态判产品故障。原计划“UI操作没有模型请求”对这个入口不成立。修复私有验收模型预算并重跑真实路径，不能只记录或改产品避开摘要。

先正常关闭verified并结算原链、源/目标变化及auth/catalog。其退休记录明确保留预算边界触发，不把exhausted写成false或称为侧聊通过。随后从闭合完整数据准备独立side-verified，同一最终完整publication，完整auth/catalog与精确模型投影，允许最多4次模型请求；全批最大8（此前实际4），其他时限/五分钟收尾不变。此为新增侧聊专项的显式计划修订，原未用2不视为已执行；不增加产品预算、接口或隐藏消息。用新Side实例走原初始化摘要，再检查侧聊加号Goal表单/帮助；所有真实Provider reader必须EOF，失败则追真实输入/输出而不修改产品迁就checker。

## 最终资格、共享来源发现与交付边界

side-verified首个私有launcher以exit1终止于可执行文件路径拼接错误，原生服务尚未创建。保留其admission，修正launcher指向真实已冻结bundle后重跑；不是因观察超时重启。实际原exec47383正常启动，页220通过原Session定位，显式New side chat创建Side chat 2，21目标表单、22帮助和23正常就绪实图均人工查看，独立owner明确、Start goal一致。没有向侧聊发送消息或提交Goal。该scope实际2次memory helper模型调用均gpt-6.1-sol、streaming200、原reader EOF，未耗尽；全批实际6、上限8。没有以0预算失败作侧聊最终通过。

四scope都公开shutdown200、原始exec/native/launcher退出0及physical/output/request完成；关闭预算分别644959/1008133/884437/1013009ms，auth/catalog各退休1。源90表原行、源字节mtime/canonical和schema4对象/integrity全部保持。目标before仅两条运行容量租约变化；after原173476行全字段保持；verified原173478行中一个memory_chunk内容/时间、memory_file时间和一个租约变化；side-verified原173854行有同Project记忆文档/令牌数/时间及一个租约变化，另一个user_message待整理file/chunk被实际Organizer消费。通过其primary identity及原canonical Message仍存在核对，不能把消费pending副本报告为原消息丢失或所有target行零变化。原Task/Mission/Session/Goal字段保持，Provider活动425→427后保持。目标记忆变化与只读源分别报告。

继续追到共享入口：Session.fork对普通fork和side-chat统一复制Message extra、创建copySources新身份，再经persistMessageBundleRows唯一sink调用ProjectMemory.captureMessageInTransaction。provenance当前只读role=user及extra.project_memory_user_input，不区分复制来源；真实被消费memory待办message:msg_g0VYuevVC00mpBLGbz2y仍有原canonical user Message，且同时具有copySources与保留的输入标记。2次真实memory请求分别绑定旧复制Side和新Side，说明零模型预算失败同时暴露了“引用复制再次登记为新用户输入”的共享源身份问题，不能仅归为一个Side实例或模型行为。

已立即横向搜索全部生产标记入口control.message、task-api、session command/shell、session wake、public session route及唯一capture sink，普通fork与side共用copy，compaction evidence reader另有原来源投影；自动/手动/工具/重启Organizer共用durable OrganizationRequested订阅和当前pending prefix提交。当前未修改后端，不用UI隐藏错误或跳过真实记忆处理。下一批优先完整审计复制/移动/交接、原生新输入与历史引用、重放/失败恢复、Task/Mission/Session轮次和多Project隔离，修共享来源分类并做聚焦正向合同与实际侧聊重跑。本批交付限定为已完成的Goal引导修复和首页/新会话归属资格，不能宣称该新后端根因已修复。

最终正式UI为main-DXPgQK57.js，12—19及21—23是最终视觉资格；08—11为中间构建，11明确未通过；20为已修正验收预算的失败证据。两locale键/参数检查通过2535 keys；本轮纯UI修改不新增/运行UI自动化或为文案写静态断言。当前架构与四索引、23图/原请求/非秘密canonical身份事实同步。精确提交后正常上游同步及hooks推送；整体Goal active，单agent继续处理共享记忆来源问题。
