# 持续目标的实际使用与作用域体验

## Recall

用户要求持续自主深入体验UI（User Interface，用户界面）/UX（User Experience，用户体验）与功能、修复实际问题、真实页面截图复核、范围提交并正常推送；后续明确只使用一个agent，旧Goal中的三个Astra文字不再适用。此前Rendering已解决，不回到陈旧症状。用户另有Goal难发现与默认页布局反馈；当前已有+与/goal、副标题和唯一表单，不能重复造入口。OpenAI配对认证/完整模型目录与精确gpt-6.1-sol流式验收已有授权，不等于可无额度触发执行。

上一turn为progress：61aba46fefa5f7993fa2714c6b5cc4800983c384已正常push；2026-10-29T00:06:45.234Z fresh fetch/merge为0/0，48自有文件干净，176外部工作保持。779修复空选择吞Escape及设置section抢占，29原图人工复核、四实例各103724原行不变、schema9/92表、原输入与附件一致；四原exec/native/launcher0、公开shutdown200及物理/输出/请求结清，目录已退休，模型0/累计767。各旧scope已终结，不能复活或续期。

已读当前AGENTS、779 Recall与交付事实、continuous-goal/07-panel架构、ContinuousGoalControl状态与预算校验、App的Home/当前owner三个绑定、services/continuous-goal目录和authority投影、GoalDialogHost（交付项而非持续目标）、764默认入口与750预算暂停/恢复实测记录。750已实测Chat三轮Goal，不能把同一历史结果当本轮执行；Task/Mission/SideChat全矩阵并未因此通过。当前Home只提供Chat/Mission而非Task，Home Goal按当前合同创建Chat，不能凭界面命名混改契约。全仓已搜索公开入口、目标类型和历史决定，当前路径未发现UI自动化测试。

## 本轮分析与方案

当前没有新的已证产品根因。先以当前普通main-I1f_al31.js及已关闭779-after3完整数据独立启动38334/ui，实际检查既有Task/Mission上下文里的Goal入口、当前owner详情、目标表单/指南、预算校验与取消恢复，并与Home/普通Chat交互比较。观察操作是否留在原owner、字段与预算是否合理可见、反馈是否使用当前语言、键盘与滚动是否可继续。用真实目录/ID与持久事实判断作用域，不按标题推断身份。不提交新Goal或恢复已有Goal触发未声明模型调用。发现问题后补充可观察现象、触发、共享根因、旧路径遗漏、定义/调用/公共合同/数据/测试/文档/交付风险，再改生产代码。

本轮首次启动固定60分钟绝对物理截止、不续期，首scope预定10分钟正常shutdown；每阶段至少5分钟结清余量。初始Provider（模型服务）最大0、累计767，仅复制完整模型目录，无auth；资格与认证状态分开表述。若需要新实际执行，先补充固定请求预算与输入、配对认证/完整catalog、Provider可用/目标已投影/实际请求模型一致的三个预检和原reader终态判据，再启动全新scope，不能在0额度服务中暗增。真实服务使用项目开发serve /ui，不单起Vite，不操作用户18571/窗口/进程。

模型以外的业务和执行合同当前不改；UI发现只用实际交互、原图人工查看，类型/语言/build/checker只辅助，不新增或运行UI自动化/DOM（Document Object Model，文档对象模型）断言。非UI若变更，须聚焦正向真实合同。任何调度、队列、唤醒、恢复、并发或终态异常即审计全部生产入口、Task/Mission/Session执行轮次、正常/终态、重试/重启、串并行和多Project；不能以单场景或模型自述降级。

每scope公开shutdown、原exec join、native/launcher与physical/output/request完整结清、精确出生身份退休后才清退认证/目录；核对全部旧行/源库/schema9/integrity、原五输入与附件。合理新增运行事实和容量租约按现定义逐项解释，不以清库换通过。三索引、当前文档检查、范围提交、fresh fetch/merge审查全待推集合与正常hooks/push；无branch/worktree、tag/Release/PR。未实测项明确保留，持续Goal保持active。

## 实页结果与共享依赖分析

图01–07来自实际741 Mission及其已完成订单Task：/goal可在当前模型不可用时打开正确Mission/Task表单；空目标与零轮预算使用当前语言的原生校验并归还准确字段，折叠无效预算后提交会展开并聚焦，切换Task清理前一Mission草稿。仅无效表单提交，没有新Goal或模型请求。图08/09：从Task打开Side chat，GET列表成功但自动POST首个侧聊返回400 ProviderModelNotFoundError(openai/gpt-6.1-sol)，显示attention且没有输入区。完整catalog存在，但初始scope按计划无认证，因此当前执行模型不连接；不是把目录缺失误作凭据问题。首次找原生组合无障碍名的DOM locator未命中，改用新AX索引成功，不算产品缺陷。

直接触发是首次侧聊列表为空后的createSideChat，不是列表读取。共享控制流根因在project-route-context：GET /session/:id/side-chat为identity，POST仍为runtime，server在handler之前调用InstanceBootstrap解析模型，早于Session.fork的历史复制事务。Session.prepareNext只准备身份与时间；side分支复制EffectiveConfig.overlay（只读取根Session存储overlay、做结构解析）与permission、完成历史/工具/交互产物，不调用模型或选择新模型。fork与side-chat使用同一原子复制primitive；普通POST /session/:id/fork也被同一runtime分类挡住。原750/Goal元数据修复不覆盖这些复制操作；现07-panel明确保留“creation can block”是旧runtime分类合同，既有cold side-history测试也明确期望POST400，不能假装它已经允许无模型复制。

全仓已核对Session.fork定义及HTTP普通fork、side-chat、CLI/ACP与panel工具调用，route context及其测试、Instance身份上下文、active-project-session、Session lineage/deletion与fork权限检查、EffectiveConfig.overlay、SideChatPanel列表/创建/连接和传输服务、当前架构及非UI side-chat/fork原子复制与产物测试。当前观察没有调度、队列、恢复或终态异常；复制没有执行轮次或自动消息权威，现Mission blocked/Task completed保持原事实。现测试均服务端/数据或传输合同，不是UI自动化。

## 实施前决定与验收

将普通fork和side-chat的POST统一归为现identity metadata mutation。保留唯一Session.fork事务、完成历史边界、消息/Part与交互产物重映射、源配置/权限原值，以及Project目录、嵌套/归档、Task/Mission身份与删除准入检查。没有另一复制路径、fallback、占位模型、Provider白名单或延迟伪成功。发送和真正Goal续跑仍走原独立执行初始化。此为现行合同的明确能力改进：无当前执行模型也能准备/阅读独立侧聊及普通副本，配置完成后才发送。同步改写上述旧文档句与过期400测试为正向200、完整复制、配置保留、原源保留及错误作用域404；普通fork同样真实路由验证，不能仅靠分类字符串测试。

首次扩展cold测试仍沿旧side-only夹具使用无Task绑定的synthetic kind=root，并新增普通fork。POST复制与side读取已200，普通root子副本读取500。追加准确响应断言及临时Log诊断后，原错误明确来自message-bridge overlayMeta：child session has kind=root，只有Task.session_id可为root。不是调度或模型失败。旧夹具仅验证把root历史转成独立assistant侧聊，不能当作有效普通Chat fork来源；将这个新增双操作冷启动用例的来源修正为真实assistant类型，保留root/mission侧聊的已有参数化测试，并另外运行真实Task绑定fork的409合同。临时Log导入/初始化已删除，三个失败回执保留，不靠修改生产root协议迎合夹具。普通OpenAPI/SDK生成已使用当前官方build入口通过，仅两个说明各自产生对应变更。

随后完整side检查的源“未改写”判断把/conversation树投影误当单Session物理消息；普通fork建立真实parent边后，该树按原合同包含两个子副本消息，故比原2条多2条。复制本身及两份正文/身份已通过。将源保留检查改为现GET /session/:id/message的精确Session读取，不改树投影，不把观察范围错误当持久数据损坏。此失败也保留，最终继续重跑原完整side checker。

## 修复后实页与配对模型验收计划

38335普通main-BO7BfSY_.js、无auth/0额度：同Task打开Side chat成功并出现输入区和自己的Goal表单；Task实际root Session无物理Message，所以如实显示没有完成历史，而非伪造worker副本。另从真实Chat759打开侧聊，完成复制8条历史并实际展开，原User/Chat/停止原因与回复可见；独立Goal明确标为Side chat 1，中文表单和空目标校验均实际查看。只读SQL证实两份source/side身份、Task源0消息与Chat源8消息。原截图1119宽而DOM1280的既有捕获差异仍在，右Dock部分被裁切；未据此改CSS或称完整Dock视觉通过，完整Goal模态区域可见。尝试的playwright.screenshot区域API不存在，未生成该原图；没有调用未文档化viewport写入，当前无临时viewport修改。14张有效原图已人工查看，英文已恢复。第二scope公开200、原3712/native/launcher0与三项/出生身份退休，目录清退。

继续在全新38336、同一原始绝对截止内，用官方stageDiagnosticProvider配对复制已有OpenAI OAuth（开放授权）与完整models目录，固定总8次请求（含真实流式资格预检），累计基数767；不续额度或刷新源凭据。启动先分别验证注册凭据、完整目录精确投影openai/gpt-6.1-sol、真实请求gpt-6.1-sol/stream=true/200及持久回复；资格通过才操作UI。保留物理fetch与原reader EOF（End of File，流读取结束）证据，不记录凭据；每次实际请求都进同一计数。自有页就绪后15分钟预定正常shutdown，仍至少保留原截止5分钟收拢。

补充影响复核发现当前SideChatSourceError已在canonical fork检查嵌套/归档来源并由error-handler映射400，但side-chat路由仅声明BAD_REQUEST_SCHEMA，普通fork还可通过purpose触达同一错误却没有400说明。实际复制从runtime迁到identity后，来源边界必须准确呈现在OpenAPI，不能只改SDK文字。决定在同一路由定义中复用BAD_REQUEST_SCHEMA与SideChatSourceError.Schema组成一份400联合声明，供两个复制入口使用，保持实际错误体不变；官方再生OpenAPI/SDK及API文档。现cold真实路由测试补上missing-model下nested/archived的400、规范name/reason与准确sourceID，拒绝范围通过真实错误合同验证，不写“不创建”等负向断言。

在刚复制的Chat侧聊创建一个两轮文字目标，初始自动轮次1：第一轮只交付“阶段一：已检查目标归属”且保持未完成；第二轮交付“阶段二：侧聊目标已完成”，确认真实两项回复后完成目标。不读写文件、执行命令、联网、创建Task或委派，源Task/Mission不参与。实页观察第一轮预算耗尽，再经普通详情提高至2但保存paused；明确Resume后验证第二阶段与complete、同一Goal/SideSession身份、真实controller作者、usage/turnsAccepted=2。调用工具与执行判断沿模型当前prompt和真实数据流，不添加host流程选择。必要时用中文检查同一详情和完成摘要。目标新建与状态是实际操作员验收输入，不合成隐藏Message。原有业务行保持，容量租约如按合同变化逐行解释。没有完成的阶段不得称通过；本轮最终必提交当前修复与诚实证据。

## 实际模型结果与最终数据

配对预检00:37:43.350Z完成：凭据usable、完整catalog projected，实际gpt-6.1-sol流式回复。原侧聊ses_-zUQbV4uvzzifa3LboUg创建Goal pev_g0VZOWogg00bOKmt616O。第一轮真实回复阶段一，budget_limited/41,127 Token/1轮；普通详情额度1→2、未勾恢复，保存paused且usage不变。随后明确Resume，第二轮真实回复阶段二、get_continuous_goal核对原身份、update_continuous_goal记录complete证据，最终正常回复后complete/124,421/2，原Goal ID保持。原主Chat仍Not running，Task/Mission原事实保持。

23张原图均人工查看，完整英文/中文完成详情与下一目标草稿指南往返/取消通过。后段原图自然变化至1280×720及约1094×1244，最后只读DOM为1093×1244；未写viewport或操作用户窗口，不预判捕获差异根因。Goal模态与后段完整Dock均实际呈现。总6次模型请求=资格预检2+Goal过程4，全部指定模型/stream=true/200/原reader settled eof；Goal三个原关联usage逐项相加124,421，最后一次回复在complete后开始而未归入Goal，符合请求开始时归属合同。只观察API、SQL和原流事实，不以模型“未改主任务”自述作证。

三实例均公开shutdown200、原19593/3712/83801 join0，native/launcher0，physicalCompletion/outputDrainComplete/requestCleanupComplete=true，精确出生身份链dead_or_reused；第三实例结清距同一最初截止1459886ms。自有auth/catalog已退休，源catalog字节及metadata、源auth metadata保持。最大8次剩余2次额度退休，累计773。

三库92表/schema9/integrity ok。基线原103724行全部精确；无认证实例全部103724原行精确，新增侧聊/复制事实后104444；模型实例104444原行中104441精确，最终106258。逐行差异只两个原已过期runtime_execution_capacity_lease slot按原resource/slot被实际PID82316获取与释放，以及本批SideSession的time_updated和summary 0/0/0。前者是原物理容量writer合同，后者来自Session loop/touch与SessionSummary→setSummary；没有旧Task/Mission/Message/权限/metadata改写。全部源库逐行匹配pre-copy，原五输入字节/mtime和三个13附件namespace保持。

聚焦检查结果：route context14项/14断言、完整side7项/55断言、追加冷启动nested/archived合同1项/21断言、真实Task root/worker复制冲突4项/28断言、原子完整复制与交互产物2项/9断言均通过；后端类型与普通构建/renderer检查通过，官方SDK/OpenAPI最终生成通过。一次artifact命令在PowerShell中未引用正则alternation被当管道，原checker日志未创建；确认后采用引用参数的新label重跑，原选中用例完成。仅删除本轮formatter导致的无关排版差异，并以精确内容复核保留本轮语义修改。最终文档/正常hooks与push回执在交付时核对。

本轮产品变化为复制操作的身份准入和规范错误声明，前端交互/本地化沿现组件；未新增UI自动化、模型旁路、schema升级或清空数据。未穷举所有owner、原生窗口、运行中取消及重启恢复；普通fork网页入口未实际操作，其真实HTTP合同已通过。另有后续线索：UI生成的暂停reason保存为当时语言的prose，跨语言呈现是否需要稳定原因身份尚未实页验证，不能直接按关键词翻译原始用户/模型reason。持续单agent迭代保持active，不将本批完成当作整体完成。

风险包括身份上下文是否足够覆盖配置/产物/复制、跨Project越权、Task或Mission普通fork错误被放过、未来发送模型未配置时错误边界、正常已配置复制的回归。用原side-chat真实路由与原子fork/交互产物聚焦checker覆盖；模型不可用的错误响应继续保留当前发送/config合同。本批不变更HTTP形状、SDK、schema9/迁移、工具提示或消息内容。API文档补充复制独立于模型可用性，不改操作身份。新普通构建+独立38335实际从同Task打开Side chat，查看继承历史/输入区、目标入口与中英文；实际新目标运行若执行，另先声明配对资格和固定额度。基线公开shutdown200、原19593/native/launcher0和三项/出生身份退休后已清退目录，不复活。
