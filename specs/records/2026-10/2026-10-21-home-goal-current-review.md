# 当前首页与持续目标体验复核

## Recall

506持续单开发agent，不委托。用户要求自主迭代、Sources和成员Rendering（渲染中）优先，并反馈“完全看不到goal怎么用、默认页布局很怪”，明确授权内置浏览器调试。上一批768de5c2975a752355ed905637969f1e73fe230b已正常推送，fresh fetch后HEAD=origin/main、0/0；12项后端合同、中英文真实取消历史页面通过。长期Goal保持active，旧并行Astra目标描述被后续人工单agent要求覆盖。开始工作区仅原.bun/与packages/opencorvus/bun/未跟踪，保留不纳入提交。

已读AGENTS、500持续目标/交付区分、496入口实测、505权限终止Recall与完整结算、当前continuous-goal与07-panel索引、Overlay的App/ContinuousGoalControl入口搜索、当前脚本、505成熟零模型隔离运行器。已应用computer-use与benchmark-debug-template技能。当前没有委托反馈。检索到的Overlay测试清单主要为服务/数据合同，不运行任何UI（User Interface，用户界面）自动化；若具体读取发现DOM（Document Object Model，文档对象模型）或源码文案测试，依规则删除。

## 修改前调查与未知项

500已经将首页持续目标放到同一输入框之后、快捷建议之前，去掉整块背景和边框，并将交付成果与持续执行授权区分。496实测入口存在、创建取消保留草稿，不能把用户反馈直接等同“代码缺少Goal”。当前页面是否仍有层级、说明、默认布局或弹窗可用性问题，需要本轮真实截图；旧图不能替代本轮页面。先读唯一App首页、ContinuousGoalControl、样式与双语资源的实际控制流，再实页定位直接触发和旧修复遗漏处。证据不足不先改产品、不新增平行Goal入口。

现有公开合同：首页表单明确确认后才创建真实会话；取消保留原草稿/附件/作用域；已有会话顶部控制与首页共用唯一持续目标表单/服务；预算可选，未指定意味着不设该限制；所有产品文案及无障碍名称接当前语言，模型/用户原文保留。此轮无执行/调度改动计划；若发现调度、队列、恢复、终态异常，立即横审Task/Mission/Session全部入口/执行轮次/重试/串并行/多项目，不降级为文案问题。

## 实施前计划

1. 仅从已完整关闭的505-after隔离数据只读serialize到新home-goal-current-506-before，原90表全部行/字段/rowid或主键、schema3/integrity、完整五键canonical与源文件bytes/mtime核对。使用现有正式505-after前端和Source CLI（Command Line Interface，命令行接口）开发/ui；独立端口18917、原生20分钟资源边界与180秒启动无活动超时。零模型预算0，不复制auth/models，不创建消息、Goal或Task；用户18571与真实库不操作。
2. 内置浏览器2自有隐藏页，实际查看全局首页、持续目标指南、创建/取消、已有会话控件、语言切换及默认布局。记录每张截图真实区域和人工结论。只用真实交互/截图验收，不写/运行UI测试，不用类型/构建替代视觉。
3. 如发现可修复问题，先补本规格：现象/直接触发、数据或控制流根因、旧路径遗漏、全仓定义/调用/同语义/契约/数据/风险；再修改唯一当前实现及所需语言资源。无schema/迁移或后端执行语义变化预期，不引入后备、隐藏或伪消息。
4. before公开shutdown200、原exec/native/output/request/launcher/精确出生身份完整结算并关闭自有页后才改源码。若改UI，正式Node/Vite构建新独立after bundle；从关闭before完整数据复制新after18919，实际同场景中英文截图复核。若无产品问题，如实记录，不强造改动。
5. 按实际改动执行类型、国际化、CSS（Cascading Style Sheets，层叠样式表）、文档等正式检查；不无目标全量测试。必要非UI改动提供聚焦正向合同。所有自有资源完整结算，零Provider实际调用、原全部数据/源文件/schema保持；只归档非秘密证据，私有完整数据库/行JSON不提交。
6. 三spec索引同步，所有本轮修改范围提交；fetch/merge upstream、完整待推集合复核、正常hooks/push/fresh相等。无额外分支/工作树/发布/标签/PR。保留并发成员/重连/连续帧、Main虚拟挂载精确原因、149目录完整配置10秒保存/5秒恢复、Rust父依赖告警未达项；单agent继续。

## Before实际页面及追加修复分析（生产修改前）

18917原11546、内置浏览器83已真实进入全局新对话首页。01英文首页、02指南、03创建表单、04中文多行草稿、05同草稿进入目标表单、06关闭后原草稿，六张均人工查看。入口/指南/表单/确认按钮可见，取消保留原草稿；本批不凭旧反馈强造首页布局改动，也未确认创建Goal或发送输入。

继续阅读原501已取消Task，07实际显示Task顶端和审批均已取消，但唯一失败工具汇总为“1个失败”；08展开后、09滚到末尾工具实际显示“出错”和红色错误框。这是已确认的呈现语义矛盾。原闭合数据只读查询表明失败只有一个：prt_g0VYeNHpt00RNOnwctXO/manage_task，failure.kind与name精确MessageAbortedError，classification为llm-activity，originSite=session.processor.catch，data含原task.cancel/user/api/requestID/causationEventID；不是根据reason文字推断。实际源没有其它失败类型或混合失败组，不能声明那些历史已实页覆盖。

代码根因：Message.AbortedError及Message.fromError是既有取消错误契约，processor convergeOpenToolParts沿唯一toolFailureCauseFromMessageError把它写进ToolFailureCause。传输/持久state.status=error是未完成工具的真实错误结果契约，应该保留。Overlay tree-writer已经把同类型assistant投影为terminalReason aborted、非错误卡片；但utils/tool的共享toolFailurePresentation只取message/diagnostic，describeToolCall只读error状态，CardParts ExecutionEventRun把所有error都计为失败，InlineToolPart也将其一律显示error Feedback。505修复的是权限历史投影，没有修改工具呈现，所以未根治该独立丢失点。

已全仓搜索toolFailurePresentation/describeToolCall/describeToolPart/normalizeToolStatus/ToolDisplayModel/MessageAbortedError及相关测试、当前架构：当前呈现由Main和成员共用CardParts/InlineToolPart；dialog旧会话chip也用同描述器但没有状态标签或Feedback。触及工具工具函数及组件没有对应UI自动化测试，不新增/运行。真实后端持久工具失败、传输schema、取消来源和状态/时间不变，不改调度/恢复/执行轮次；当前Task已正确终态，未发现新的执行异常，不以此UI修复重放或猜测取消链。

具体方案：在唯一现有toolFailurePresentation解析成功的类型中派生cancelled，只接受kind/name均为MessageAbortedError，不匹配文案或推断Task总体状态。describeToolCall将该派生事实提供给现有工具显示模型，status仍保留error；只有error且明确取消时statusLabel为现有本地化“已取消”。同一CardParts汇总将其计为取消、其它error仍计失败，取消不会显示完成勾。InlineToolPart同一原错误正文/完整诊断使用neutral Feedback及取消标题，普通失败沿原error Feedback。只新增英中文取消计数词条，复用已有单项状态词条，无新状态持久源、错误消音、后备或隐藏消息。

before完整关闭后修改这几个UI文件及07-panel呈现合同。after按原独立18919方案用正式新前端、同原数据和0模型守卫，真实英文/中文复核汇总、展开单项、原原因及完整diagnostic、既有已成功工具和原审批。纯UI不写UI测试，类型/国际化/正式build仅补充；未具备普通真实失败/混合组历史样本时如实保留视觉覆盖限制。全部90表原行/字段保持，不改变原失败事实。

## 修改与实际验收

before18917/原11546/native83008通过公开shutdown200、原exec exit0、native物理/output/request/launcher及精确出生身份完整结算，自有83页关闭后修改生产。唯一工具failure解析派生cancelled，保留原status；CardParts汇总取消与失败分别显示，并沿现有locale格式化数字；InlineToolPart原正文/诊断使用neutral Feedback与取消标题，其它失败代码分支仍保持error。新增两个locale中的同一计数key，复用原单项取消标签，同步07-panel事实合同。未修改后端、工具执行、持久schema/字段、终态、时间、模型或权限。

after18919/原33162/native真实Source CLI开发/ui加载独立正式新bundle。公共GET message-Part返回200，原Tool id/session/message身份、state.status error、persisted outcome failed、完整failure对象与原SQLite一字不改；只读比较不是以摘要代替正确性。10英文汇总1 cancelled，11英文单项Cancelled和中性原因框，12真实展开Details含MessageAbortedError/原session.processor.catch及原取消身份，13中文单项已取消和完整原英语原因，14中文汇总1个已取消且与Task/审批保持一致。原成功skill/read/前一manage_task完成勾和输出仍实际可读。15中文首页创建表单、16最终空白首页再次人工查看，Goal入口位于输入框之后，关闭回到原首页。所有16图均实际查看；01包含新对话按钮悬停提示，08为展开后上方skill区域，09才是修复前末项红框，不把08当红框证据。

实际Details由原生summary提供。第一次用Playwright button role定位该原生控件没有匹配，工具报deadline；随后获取新完整可访问树，按真实索引306点击成功并实际查看图12。没有修改产品以迎合定位器，没有运行Playwright test/DOM/组件/源码文案断言或截图基线。画面模型配置暂不可用来自明确无凭据/目录的零模型阅读scope，没有重试/发送/暗加请求，不能据这组图宣称真实Provider或成员新流已验收。

全仓typecheck8项成功（7缓存/1新，26.282秒），正式Node/Vite新bundle构建成功（原24810，1分9秒）；i18n两locale/2526 keys、CSS设计语言/依赖图、renderer public surface、docs345 operations/26 groups与architecture20文档通过。没有非UI生产改动，未添加UI自动化或无目标运行全量测试。原正式构建包含第三方use client忽略与大chunk提示，保留原输出，不改写为零警告。

after公开shutdown200、原33162 exit0和native物理/output/request/launcher/精确出生完整结算，自有84页关闭。两scope实际Provider0/max0/exhausted false，无auth/models复制。闭合后联合核对两scope各90表145033原行/所有字段/rowid或主键差异0，Provider activity364→364；源bytes/mtime、完整五键canonical、schema3/全部实际对象/integrity保持。用户18571进程/窗口/数据库未操作，无清库/迁移/新Task/Goal/消息或效果重放。

[完整证据](../../artifacts/2026-10-21-home-goal-current/README.md)。本批修复原明确取消类型被显示为工具失败的呈现根因，首页本轮未发现新布局缺陷而不改布局；普通失败/混合组与独立成员取消无真实历史样本，视觉覆盖未达，不能据共享组件或类型通过宣称全部场景实测。既有并发成员/重连/连续帧、Main精确挂载原因、149目录性能与Rust父依赖限制保留。按范围提交及正常upstream同步推送收尾，长期Goal继续active。
