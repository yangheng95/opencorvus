# 第21批：定时任务时间与频率的界面语言

## Recall

- 用户要求持续按批调查UI（User Interface，用户界面）/UX（User Experience，用户体验）、完成度与缺陷，先根因/影响和spec，再真实交互/原图人工复核/聚焦正向资格、范围提交/上游同步/正常push后继续；最新指令停止所有子agent，Root自己做并验收。本批不委托。
- 第19批e3c3d1aa73bfc2b071180d85a21773bdcc4b79b7（99路径，3源/test，42/82，11原图）和第20批0fe812062088fc2aa6bc5f388d6e03b6ac078ae6（100路径，2源/test，51/91，9原图）已各自正常提交，逐blob/精确索引结算与exact release/module检查实际0，自己范围工作区干净。两批的正式UI/公开配置/正常退出/端口0/假auth+models整对清理/全日志隐私均实际完成，没有真实凭据或模型请求。
- 正常push尚未成功：第一次被并行Combobox类型错误挡下，第二次8项typecheck通过后被并行权限恢复新租约入口的声明计数挡下（permission/authority 1声明/2实际）。两次完整原输出/exit/receipt已随B20归档，不绕过hook/不修改他人正在实施的源/暂存/进程。待共享状态收敛后必须fresh fetch/merge、完整pending审阅并重跑本任务正常push；这里继续独立呈现调查，不将前批伪写为已推送。
- 已只读审阅其他独立用户任务的79ee53039（35个spec/分析输入/405交付回执，无产品源）和b767b9325的实际路径/不可变artifact。b767最终link56/523、root18/294、ignore13/79共87/896，实际HTTP209+58+43=310；先前两轮runner1、初type2保留，最终各独立合同/类型/build/docs及原runtime物理收尾均有0回执。此为审阅他人已有交付，不是本批委托，也不冒充Root自己操作过该任务的9图。完整pending原四项为e3、79、b767、0fe，后续可能变化必须重新检查。
- 已读AGENTS.md、当前03-control、07-panel定时日历/编辑快照/revision/SDK合同，ScheduledAutomationsPanel的formatTimestamp及列表nextRun、详情nextRun/lastRun、run.startedAt四个调用；当前utils/i18n::localeTag；已有Usage/Permissions/ReleaseNotes的当前locale调用；automation-recurrence的日期/时区/序列化，services/automations的正式公开API（Application Programming Interface，应用程序接口）和global路由Create/Update schema、AutomationService.create/nextRun。
- 全仓搜索formatTimestamp/localeTag/定时日期语言历史：本页面私有formatTimestamp只有一处，以Intl.DateTimeFormat(undefined,...)格式化绝对时间。localeTag是现有单一应用语言投影。recurrence内en-US用于机器日历解析/weekday编码，不是显示文字，不能误改。历史Source日期与Usage工具提示已说明当前locale/真实时间身份分工，不另建格式配置或语言状态。
- 官方依据：[ECMA-402 2026的InitializeDateTimeFormat及DefaultLocale](https://402.ecma-international.org/#sec-initializedatetimeformat)：没有请求locale时采用宿主locale；应用自己的语言选择不会自动改它。仅引用这一行为，真实页面仍需取证。

## 根因与影响分析（实施前）

1. 可观察/触发：中文应用运行在英文默认locale的浏览器时，周边中文而未来nextRun仍可能显示英文月份。已定位明确源码，尚未真实复现，不先改产品或宣称通过。若实际浏览器默认恰为中文，应如实记录并寻找合法隔离对照，不修改用户浏览器设置。
2. 数据流：公开AutomationView的nextRun/lastRun及AutomationRunView.startedAt是原绝对毫秒事实；列表/详情/历史四处进入同一私有formatTimestamp；当前传undefined，与反应式app语言断开。空值返回现有本地化“从未”，保留其合同。切换应用语言只更新t，不能让Intl宿主locale变成应用语言。
3. 旧路径未根治：此前日历编辑修锚点/时区和revision，并未修改这处显示locale。单独翻译next_run标签不能修其插值里的英文日期；不得改时间值、时区、recurrence或后台调度绕行。
4. 唯一最小方案：在同一组件import现有localeTag，把DateTimeFormat的undefined替为localeTag()；保留dateStyle medium/timeStyle short和浏览器时区语义，四个消费者仍共用一个函数。没有新formatter服务、状态、机器日历解析、SDK、配置、公共错误、路由、LLM或调度修改。
5. 影响/排除：只改用户可见日期与12/24小时习惯，原绝对时间、目标、revisionId、recurrence、实际next fire和模型身份保持。Usage/Permissions已接localeTag，不复制；Provider native title及ExpertSquad授权日期另有同类线索但未实际资格，不扩大到未验收区域。历史run时间使用同一函数，但本轮不伪造run或消息；未真正执行的历史日期资格应排除。
6. 实际矩阵：独立正式backend /ui，完整自有假auth/models同对，自己创建一个2030年未来的正式automation定义（公开POST/GET），绝不点击Run或把时钟前移。before使用B20冻结UI，亲看英文列表/详情，再切中文看列表/详情仍英文日期；after新Node build同条件亲看中英列表/详情和空lastRun/真实recurrence/目标。若切语言会卸载页，按真实导航重开，不伪称同一编辑会话存活。
7. 真实checker：公开HTTP（Hypertext Transfer Protocol，超文本传输协议）201创建、200读回实际id/revisionId/name/target/recurrence/nextRun，nextRun确属2030未来，后续UI浏览后再次正式GET读回相同定义。它只证明真实定义/时间身份，不代替原图。使用当前服务/路由，不mock/stub、不seed伪run；不资格调度触发/恢复/模型执行，因此不需真实Sol。若出现调度/队列/恢复/终态异常立即共享机制全入口Task/Mission/Session occurrence横向审计。
8. 检查/隔离：纯UI呈现改动，禁止UI自动化/DOM/文案/组件/截图断言，不新增镜像实现的业务test。运行overlay类型、Node build及当前docs/index；仅自己页面、独立HOME/数据和before18654/55、after18656/57端口，先查空闲，2030定义不会在验收窗口到期。正常marker/settlement/parent真实exit0/双端口0后整对精确删假auth/models，全量原日志隐私检查，无用户进程动作。
9. 文档/交付：当前07-panel补显示locale遵循应用语言且不改原时间身份，CHANGELOG未发布中英增量，3索引/根artifact及子目录README；保留原图、原输入、失败和检查/退出原回执。前两批推送依赖仍必须明确，不因等待改成通过。范围提交、fresh同步/全部pending审阅和本任务正常push，不新branch/worktree/rebase/force/tag/Release/PR。

## 执行与资格

恢复后先读Recall、本节与下述实施前补充。当前尚未修改产品；修前已结束，不能重开原occurrence。前两批正常push仍待共享登记检查收敛，不宣称已交付。

- before PID12724、18654/55，公开POST201创建atm_g0VXz0UOO00XtaNptsC0，其revisionId相同，target为自有session ses_-zUS0zXTUzzYR3GQvbLm。两次正式GET200读回完全一致的目标、原recurrence和nextRun1918182840000（2030-10-14 12:34 Asia/Shanghai），lastRun为null、真实history为空。
- Root亲看01英文列表和02详情；切中文后03列表与04详情仍为Oct 14, 2030, 12:34 PM，同时生成的频率摘要仍为Daily at 12:34。英文名称/prompt是本任务真实原输入，保留其事实；日期和Daily是产品生成内容，不属于原文豁免。
- tab21已关闭；正常settlement、parent/隐私checker实际exit0，双端口0后精确删除假auth/models整对；完整后台原日志109370字节、stdout/stderr各0。原日志和terminal原件后续归档，不能以4原图冒充修后通过。

## 实施前补充：同一时间摘要的数据流

1. 新现象与调用：全仓recurrenceSummary仅automation-recurrence.ts一个导出、同页面列表/详情/搜索3个调用及scheduled-automations.test.ts的5条UI文案断言。它把RRULE识别成硬编码Daily/Weekdays/Weekly，并拼英文at；这是与当前locale断开的第二处同页根因。当前parseAutomationRecurrence已是唯一机器日历解释，复用它而不保留第二套前端部分规则解释。
2. 历史已读2026-10-05产品迭代Calendar UTC决定：原问题是Z锚点未展示UTC，修复复用parse的time/timeZone。本批必须继续保留该事实；不能把翻译变成重算/改写recurrence或丢失高级表达式。
3. 修订唯一方案：把纯呈现recurrenceSummary从机器日历服务移到该唯一页面，仍由列表/详情/搜索共用。调用parseAutomationRecurrence；基础daily/weekdays/weekly用既有当前语言频率和星期键，新增一个中英时间框架键automations.recurrence.summary（schedule/time/timeZone）；高级表达式显示解析器保留的完整customRule作为技术原文，不用部分关键字把COUNT/秒/例外/多行降成基础描述。删除服务旧硬编码实现与导入，不留平行formatter或兼容导出。
4. 测试规则：发现的5条当前UI生成文案断言不得运行，先保存原件并删除（首个业务case中1条和独立summary case中4条）。UTC锚点改由明确日历数据对象/高级raw表达式正向合同证明，不写任何UI文案/DOM/组件/截图测试。现有host transport桩只资格HTTP映射局部合同，绝不冒充真实API或端到端；真实定义checker另行执行。
5. 范围/风险：预计3个独占文件为页面、既有机器日历服务（纯删除呈现导出）、既有业务test；两个locale文件仅新增同一个键，必须精确patch保留其他任务未提交翻译，不可整文件暂存。机器parse/build/update/defaults与后端/SDK/调度均不改。基础英文摘要将统一使用原选择框的Every day/Every week文案；高级摘要改为完整真实表达式，可能较长，必须真实截图检查其列表/详情布局。搜索同样使用当前摘要，原name/prompt搜索保持。
6. 修后矩阵补充：除一条daily正式定义，再通过真实公开POST创建同属2030未来的weekdays、weekly、含COUNT/非零秒的advanced定义，分别精确GET原事实并人工查看列表/详情/中文搜索。高级行若截断则如实界定，详情应能查看完整表达式；没有真实执行就不资格run.startedAt或非空lastRun。所有定义都未来，不点击Run/暂停/删除，不产生伪run或合成消息。

## 修后实际资格

- 实施为独占3文件（页面、服务删除呈现函数、业务test）和中英locale各1个精确键；保留其他任务同locale文件的全部改动。移除5条现存UI生成文案断言后才运行剩余业务检查；10通过57断言。UTC对应具体日历对象与完整高级表达式，没有UI自动化。transport桩只是局部HTTP映射资格；真实公开API另有原回执。
- 服务/test格式0；页面仅本批import、locale参数与唯一私有摘要，未全组件格式化。overlay-typecheck实际0、Node build实际0（1m3s），原warnings保留；没有因为build通过就宣称视觉通过。
- after PID84424、18656/57，occurrence 1c22f5ae-dfe1-4ad3-bc19-66a9fcbc9430。正式公开POST201创建daily/weekdays/weekly/advanced，id与revision分别见原件；正式GET200在UI前后精确读回同一name/prompt/target/revision/原规则。daily与weekdays nextRun1918182840000、weekly1918528440000（10月18日周五）、advanced1918182877000（真实秒37），均为2030未来；lastRun=null、真实run历史为空，没有执行资格。
- Root亲看全部12个原PNG：01/02修前英文列表/详情，03/04中文界面英文日期/频率；05/06修后英文列表/详情，07中文四规则/日期，08中文daily详情，09真实中文星期五搜索，10中文weekly详情，11高级完整原表达式含秒37/COUNT4及中文日期，12工作日详情（此前也通过工作日中文搜索打开）。07中文列表完整原表达式可见；05英文长行及名称按原CSS省略，不冒充列表全文可见。11详情完整可读；换行按原段落布局显示为空格，没有宣称代码块/复制保留换行。
- calendarAfter tab22已关闭；正常settlement与parent/隐私checker实际exit0，双端口0后精确删除自有假auth/models整对；完整后台日志120051字节，stdout/stderr各0，全量已知假凭据检查通过。before对应109370字节；两轮terminal实际requests0/realSolCalls0。没有真实Provider凭据、Sol、scheduler fire、非空lastRun或历史startedAt日期资格。
- 当前lease-current原checker仍实际1（permission authority声明1/实际2），原因和前两次push一致；未改并行权限源或绕过检查。新d6fc0a555压缩和3c5f8d2a0交付记录提交已出现，尚待完整pending复核，不能据标题声称验证通过。最终docs:check实际0（345 ops/26 groups）、architecture-index实际0（19 current documents），本批精确diff检查0。范围commit、fresh同步/所有pending审阅与本任务正常push仍待完成；之后原交付回执由下一批承接。
- 第一次正常commit期间，另一个用户任务将HEAD从已审阅3c5f8d2a0推进到ce798bfc4，Git的ref compare-and-swap拒绝本次更新，实际exit128。原commit-first日志/exit保留；没有reset/覆盖对方提交或借旧index重试。ce仅文件浏览交付回执/spec，Root在新HEAD重新建立自己的精确private index再正常commit；首次失败不能写成已提交。
