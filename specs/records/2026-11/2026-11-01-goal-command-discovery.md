# Goal 操作搜索与表单发现性

## Recall

用户要求持续单 agent 自主排查UI/UX（User Interface/User Experience，用户界面/体验）和功能，实际隔离页面验证并提交推送，不动用户窗口。旧Goal多Astra目标已被后续单agent要求覆盖。上一轮是progress（已改变权威状态）：2441c326b5d459c4004f130d0d9e9d10814b95db已在origin/main，2026-11-01T11:04:03Z重新fetch（拉取）/普通merge（合并）后0/0，本轮27文件干净、保留176无关状态。17数据测试20断言、14实页原图，正常/失败双击、手动重试、新稿、空命令、明确新建及reload（重载）已验；两个原服务0/物理结清、4配对副本退休，模型请求0、累计1193。最新闭合源867-after：schema（数据库结构）9/92表239584行，84项目124会话784消息2225 Part，217真实附件、9Goal；不重开旧scope（作用域）或延长旧截止。

本轮初始git status保存.tmp-product-iteration/status-before868-private.txt，HEAD2441c326b。用户还强调Goal不知怎么用、默认布局和自主找问题；本轮转向首页、全局搜索及Goal表单实际操作，不再围绕已修好的Rendering。已读当前07-panel、continuous-goal、App首页/选中对话的ContinuousGoalControl及CommandPalette绑定；读取CommandPalette全部命令源/局部匹配/真实Work Ledger搜索/聚焦回交，ContinuousGoalControl的owner/authority/epoch、表单原稿、help往返、创建及现预算/暂停/恢复标签，GoalDialogHost的另一Task交付目标概念及ConversationSearch/同一text-search实现。全仓源码/规格搜索，未新增或运行UI自动化。尚未修改产品，缺口先实测。

## 线索与影响分析

全局搜索的唯一goal:open项：label使用当前语言continuous_goal.open；hint为“设定持续目标，或查看当前对话的目标。”；keywords固定“goal continuous objective budget”。commandMatches按当前label/hint/keywords执行原有matchesSearchTerms。中文用户按表单真实操作“预算、令牌、轮次、暂停、恢复”寻找Goal时，这些本地化标签均未进入该命令搜索字段。英文budget恰可被找到并不能证明中文发现性。直接触发是中文语义查询；可能根因是局部命令没有消费其既有控件标签。当前只是代码线索，需真实UI（User Interface，用户界面）搜索结果确认，不先声称功能失败。

全局工作台实体由真实Work Ledger分页供给，与局部命令筛选是不同事实。不能伪造Goal为新Session搜索结果，也不能更改后台查询/路由绕开。影响面包括Home与现对话两种Goal入口、语言切换、英文技术词查询、查询多词、键盘选中/关闭聚焦、Goal创建表单与帮助返回/草稿保留；非当前conversation的禁用或不可见入口不能强行出现。已有Goal状态、预算更新/暂停/恢复的真实控制合同、Task交付目标、Session/Mission执行调度不拟改变。若发现共享调度/队列/恢复/并发/终态异常，按AGENTS要求横向审计完整Task/Mission/Session生产入口、轮次、终态、重试/重启、串并行和项目隔离，不能据单个UI用例归因。

## 方案与验收

75分钟共同绝对截止，before38542、after38543，至少余10分钟启动、余5分钟结清；不延长/重开。完整复制闭合源旧业务行、真实附件namespace（命名空间）、旧项目业务文件/Git，源只读；9Goal完整公开事实与全部结构对象前后比较。按现授权配对复制认证及完整模型目录，分别预检真实注册和精确openai/gpt-6.1-sol投影。首次额度0且不增加，本轮只导航/编辑未提交表单，不点击开始目标/模型发送，不以预检冒称远端模型运行。只用本人隐藏IAB（In-App Browser，应用内浏览器）新tab、完整开发服务/ui，不操作用户18571，不启动独立Vite。

先在真实首页和全局搜索查询实际中文预算/暂停等操作，保存目标区域原图并实际查看；同时检验默认布局、Goal打开、表单输入、预算选项、help往返、取消/重开和焦点交回。若确认命令缺失，优先让现goal命令的搜索元数据直接引用当前控件的本地化标签，而不是新增语义路由、隐藏工具、LLM（Large Language Model，大语言模型）关键词流程、第二命令目录或平行状态。具体字段与现有说明是否调整，在实测与全仓使用审查后记录实施决定。所有新增可见文案必须英/中同步。后台API（Application Programming Interface，应用接口）/SDK（Software Development Kit，开发工具包）/schema/持久格式不拟改变。

UI只真实页面交互、原图与人工复核，不写/运行DOM（Document Object Model，文档对象模型）、组件、源码文案、快照、Playwright测试或像素断言。纯UI搜索元数据不添加镜像实现测试；若触及非UI合同须聚焦正向测试。检查类型、i18n（Internationalization，国际化）、普通前端构建和当前docs:check，但不替代视觉验证。正常shutdown200、原exec/native/launcher0、physical/output/request及出生身份结清，全部配对副本退休。同步三个索引、范围提交，每次push前fresh fetch/普通merge/全部待推提交审查、正常hook及远端回读，持续Goal保持active。不能把发现性修复说成完整Goal执行/暂停模型链路重新通过。

## 已证实的基线与实施决定

本人隐藏tab115、before38542、main-DS0BafsL.js。初始AX（Accessibility，可访问性）出现短暂Home，随后当前已持久化选择恢复到本人旧Task793，01如实保存为restored-default-view；没有把它说成首页布局故障。通过真实palette“New chat”进入稳定Home，02布局/Goal入口正常。Home搜索budget有1个Open goal（03）；真实选择中文界面后搜索“预算”和“暂停”均显示无结果（04–05），而同页goal技术词能找到该命令。实际选中它可打开创建表单，06–07明确存在令牌预算/自动轮次预算及暂停说明，证实搜索元数据遗漏实际本地化能力，未发生模型执行故障。关闭后焦点回到原搜索按钮；本人页已关闭、shutdown200、原exec/native/launcher0及物理结清，配对副本退休，9Goal完整公开事实保持，模型0。

实施决定：只扩充现goal:open唯一命令的keywords，使其直接消费现continuous_goal.token_budget/turn_budget/pause/resume当前语言标签，保留原goal/continuous/objective/budget技术词查询。仍用现matchesSearchTerms匹配，不新增别名目录、后台搜索路由、第二命令、状态或自动行为。同步英/中cmdk.goal_hint，说明设置目标/预算以及已有目标暂停/恢复，结果提示与可用表单一致。07-panel补搜索标签来源合同；非UI工具/存储/控制/执行合同不变。候选需真实查询中英文预算、暂停、令牌/轮次及多词，选中结果进入同一个Goal表单，实际填写未提交目标/预算、help往返和关闭重开，确认草稿/焦点保留。无新UI自动化测试，依类型/i18n/构建与实页截图验证。

## 候选实页与结清

after38543、main-CaRI8MD9.js，本人隐藏tab116，直接使用已在before真实观察到的launcher=chat&productPillar=work地址进入Home。主输入填写独立原稿，英文token pause可找到Goal；真实切换中文后预算/暂停/令牌轮次多词/恢复均有同一Goal结果（08–12）。恢复查询随后也返回两个真实工作记录，不能用即时本地结果截图宣称查询永久只有一项。Down+Enter实际选择了已经活动的Goal之后的工作记录；实际source/URL核对后通过New chat返回Home，原主稿保留，再查令牌轮次、读取活动项确为Goal后直接Enter，正确打开原表单且预填主稿。这是手动验证选项的修正，不是产品导航异常。

未提交表单改写目标并填4000令牌/3自动轮次，实际查看使用说明、返回、关闭及重新打开，目标和预算都保留，原主输入也保持；第一次关闭后焦点回主textarea，第二次由Home按钮打开/关闭则回该按钮（13–17）。所有17原图实际保存/查看，没运行UI自动化、源码文案/DOM/组件/快照/Playwright测试或像素比较。类型检查、i18n2688键和普通前端构建0；没有非UI合同改动，不以自动测试镜像这次UI元数据。

两个本人tab已关闭，公开shutdown200、原exec/native/launcher0、physicalCompletion/outputDrainComplete/requestCleanupComplete及出生身份链全结清，配对认证/完整catalog共4副本退休。源auth元数据和模型catalog字节/元数据保持；首次额度0未增加、实际模型0、累计1193，75分钟截止未改，退休余量4263147/3769540毫秒。全部239584/239589旧行逐字段保持，当前239589/239592；项目85/86，session124/message784/part2225保持，schema9/92表及全部非内部结构对象相等，真实附件217、旧84/85项目业务文件及Git保持，零文件系统排除/过期容量槽复用，9Goal完整公开事实相同。navigation-facts记录真实非GET到达：流式transport建立、/log和/shutdown，不能仅按POST命名就声称Goal被创建或修改。

日志复核的未决事项：before11:10:42与after11:18:47在恢复/切换旧对话时均有window.error，原文“ResizeObserver loop completed with undelivered notifications.”，日志按debug记录。根因和可观察布局影响仍未知，不能从最终错误名称判因、称为偶发或用本次命令成功降级；原时间/文本见navigation-facts。当前搜索改动未触及布局观察器且两个版本均有证据，先独立交付本次已验修复，下一轮立即读共享输入/布局/错误记录定义及全部调用点，再判断并修根因，不宣称整体界面无问题或console clean。未执行新的Goal模型/暂停运行矩阵、未证明表单跨reload或authority切换保留。本持续Goal保持active。

```text
node .tmp-product-iteration/goal-discovery-868/run.mjs types-after bun run --cwd packages/overlay typecheck
node .tmp-product-iteration/goal-discovery-868/run.mjs i18n-after bun run --cwd packages/overlay check:i18n
node .tmp-product-iteration/goal-discovery-868/run.mjs ui-build-after bun run --cwd packages/overlay build
```
