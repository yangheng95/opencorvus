# Mission 任务结果与完成进度（890）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）及功能，真实页面验证后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的三Astra文字。889已推送06be0f51ad357e654d0dfd811d9440ca18b22b4b，fresh HEAD=origin/main、0/0；38本轮普通文件和三索引行干净，177项无关改动保留。889-final严格资格259043行/schema9/92表、100项目/229附件，原句柄99386消费exit0、关闭HTTP200、物理输出请求闭合与配对副本退休，累计1260模型请求。前一轮属于有权威提交和实页证据的progress，不是等待。

889真实截图中的卡片显示“1 / 1 个 Task 已终态”或“Tasks terminal”。本轮继续核对其表达与事实，而不把技术术语或终态计数准确性直接当业务故障。已读取：AGENTS、889 Recall/资格/fresh推送；MissionBoard完整卡片与筛选实现、对应样式、本地化；MissionRecord/Task类型、mission-board服务加载；服务端mission/projection.ts的生命周期与activityStatus投影、board.ts的独立栏目/验收规则；公共status-labels和TaskStatusHeader、TaskProgressBar的不同范围。全仓搜索taskIsTerminal、terminalTasks、mission_board.task_progress、active_tasks及task_status，确认本轮卡片只有当前一处实现，非独立Task Goal进度条。新增或运行UI自动化测试被禁止；相关搜索未发现仓库内此类测试，不运行它们。

## 修改前问题深度与影响分析

- 可观察现象已有889截图；本轮before再进入真实页面，读取真实公开Mission投影并截图。直接触发为Mission带有Task时渲染卡片摘要和progress。现代码把completed/failed/cancelled合计作为terminalTasks，再传入名为completed的本地化变量和progress值。计数符合“执行结束”定义，却很难让普通用户理解其与成功完成的区别；只改“终态”字样会保留相同歧义。
- 当前activeTasks直接统计lifecycleStatus=active，中文却写“执行中”。公开projection同时提供独立activityStatus=running/inactive；生命周期active不是实际正在运行的充分条件。因此结果摘要应描述“未完成”，不从生命周期推断执行活动。没有发现调度、队列、唤醒、恢复或终态收敛异常；本轮不改变服务端事件/栏目归类。若实跑出现此类异常，必须转共享机制横向审计。
- 新卡片合同：完成进度仅统计lifecycleStatus=completed，总数仍是本Mission真实全部Task；失败、取消和未完成单独显示当前数量，即使任务位于前三个预览之外也能看到。栏目仍由原Mission投影及真实验收事实决定，Task全部完成不等于Mission已验收。使用一个本地响应式计数从当前tasks派生，不缓存、写回或另造状态源。
- 当前私有taskStatusLabel和四个mission_board.task_status翻译与公共taskLifecycleStatusLabel重复，且active中文一处“执行中”、一处“进行中”。本轮预览直接使用已有公共标签，删除仅供该私有函数的四个旧键和函数；全仓搜索没有其他调用。这是当前修改的结果语义收敛，不扩展清理其他组件。taskIsTerminal与activeTasks将由单一四类计数替换，删除旧路径。
- UI范围：MissionBoard卡片、原progress可访问名称、两语言键及当前页面样式。所有数量按当前locale格式显示，状态文本沿语言。失败/取消/未完成提示采用现Badge和设计token，保持可换行，桌面窄卡片实际截图后调整。标题、项目、模型原文、任务身份、原前三项预览及更多计数、打开/编辑/开始/删除等行为保持各自真实owner。
- 公共API（Application Programming Interface，应用程序接口）、SDK（Software Development Kit，软件开发工具包）、持久结构/迁移、Provider、Task/Mission/Session occurrence（执行轮次）、模型/配置/调度均不改；无非UI实现或新配置需单元测试。构建、类型、本地化、样式、文档只作聚焦检查，不替代实页。公开投影读回为真实身份/状态核对，不是DOM（Document Object Model，文档对象模型）断言或UI自动化。
- 风险与未知：失败/取消/未完成组合是否存在于当前未归档源投影，待before公开盘点确认；不得构造消息/静态页面/修改源状态冒充真实覆盖。计数语义改变要同步可见文本和可访问progress名称，避免结果与条形值不同。失败不因所有执行结束而填满成功进度；Mission验收栏目保持不变。

## 首次资源与验收顺序

首次prepare前声明before/after模型额度各0，75分钟共同绝对截止及5分钟闭合预留，不加额、续期或重启。使用本人隔离开发CLI（Command Line Interface，命令行接口）的38606/38607端口/ui/；before复用已合格main-BeJWP6iR.js，after由Node.js构建，不启动独立Vite。配对凭据/完整模型目录按现有授权验证复制及退休，不输出秘密。全部旧行、100项目文件/Git、229附件保全；用户18571窗口和真实数据库不操作。

1. before公开真实Mission清单/身份/生命周期与活动状态盘点；实页查看全局卡片与可用的成功/失败/取消/未完成样本、中英文阅读。明确未知覆盖。正常关闭HTTP200、原句柄exit0、物理身份/输出/请求闭合及严格源数据资格后才改产品。
2. 按上述单一计数/公共标签/两语言方案实现并更新07-panel合同；Node构建、overlay类型、本地化/CSS（Cascading Style Sheets，层叠样式表）/docs检查。
3. after真实页面核对相同任务/栏目、完成分数、结果计数、前三项以外的汇总、项目/搜索筛选和原会话打开；中英文截图人工复核。没有源实例的分支明确不宣称实页覆盖。
4. 关闭本人服务、消费原句柄、退休配对副本、全旧数据资格、更新三索引、仅本轮提交；fresh fetch/普通merge/完整待推集合审查/正常hook和push/推后fresh 0/0。Goal保持active，继续下一批。

## before真实证据与补充根因

公开Mission接口HTTP200返回13条真实未归档记录：6待规划、1进行中、1待处理、5已完成。live-mission-blocked-741的同一Mission真实任务为completed1/failed1，原卡片显示2/2终态及满绿色进度（01/04/07）；review-handoff-793真实任务active1但activityStatus=inactive、taskStats.running=0，原中文卡片两处显示执行中（05/06）。没有当前未归档cancelled或超过三项Task的实例，这两种组合不宣称实页覆盖，不制造消息或修改原数据凑例。已完成单任务为成功对照。

另查进度条实际解析样式：源码把::-webkit-progress-value和::-moz-progress-bar合并为普通选择器列表。当前浏览器的CSSOM（CSS Object Model，样式对象模型）保留progress基础/轨道规则，却丢弃这一整条颜色规则；Attention的真实laneAccent为#fbbf24，截图却是默认绿色。全仓进度伪元素搜索仅此一处。按[W3C（World Wide Web Consortium，万维网联盟）Selectors错误处理合同](https://www.w3.org/TR/selectors/#invalid)，普通列表含不支持的选择器会使整条规则无效。实施前补充方案：把两个现浏览器分支拆为独立规则，继续使用同一个lane token及原尺寸/圆角，不增加硬编码色或新进度组件。after必须实际看到Attention半条主题色、Completed整条绿色并观察浏览器解析规则；Firefox未实际运行，不宣称跨浏览器验收。

02/03的工具内联显示一度看似没有卡片，但AX（Accessibility，辅助功能）树、DOM布局和可见样式均有效。提交前直接重读磁盘原始02/03/04图，三图卡片均正常；差异来自本次工具内联显示，不是已证明的浏览器或产品绘制故障。保留原图及观察说明，没有据此加重绘补丁。准备脚本最初把已落盘的本人check-missions.mjs目录误判为已有运行；在任何服务/凭据启动前失败，修正为精确初始文件库存后原验收正常，未创建第二次运行或修改额度/截止。

## after实页与最终资格

main-Y2tOqPNR.js在38607完成08–16真实截图和人工复核：全局与筛选后的同一失败混合Mission显示1/2成功完成、失败1及半条Attention主题黄色；成功单任务仍为1/1、Completed主题绿色。原生命周期active且activityStatus=inactive的任务显示0/1与未完成1，预览沿公共标签进行中，不再写实际执行中。中文/英文的文字、栏目和数据身份对应一致；窄卡片自然换行，没有把作者标题或真实路径翻译。无Task草稿保持原编辑/开始操作区。项目筛选后同一真实目录与数量保持，闭合下拉Esc保持名称；刷新看板后从原卡片打开同一已完成会话及原交付物。没有发送新消息、执行任务或改原验收事实。

after只读DOM属性value=1/max=2，可访问名称与实际半条进度一致；CSSOM现保留独立WebKit填充规则及原lane token。DOM包装器的原生progress value/max属性读取为空，未把它当产品实际值；记录真实HTML属性、AX值和视觉证据。09的工具内联显示也一度与原图不同；提交前直接重读磁盘09/10/14确认卡片及进度都正常，没有证明产品缺图。最终视觉结论以实际保存且重新查看的原图为准。

before/after公开接口均HTTP200，13条Mission完整记录deepEqual（深度相等），身份、任务、活动、栏目与结果均保持。两阶段原句柄68568/15996消费exit0、公共关闭HTTP200、物理身份/输出/请求清理闭合，认证/模型目录配对副本各两文件退休。严格资格259043→259045→259047行，每阶段仅新增当前租约两行；schema9/92表、源数据库、所有旧业务行/100项目文件及Git/229附件保全。模型请求各0/累计1260，原截止保持，after闭合余3585768ms。

Node.js构建、overlay类型检查、本地化两语言2751键、样式9054引用/402源文件、docs:check（352操作/26组）均exit0。私有提交字段生成器曾把模板中的换行转义展开，node --check在暂存前查出语法错误；改为原始模板并重生该本人文件后原语法检查exit0，没有改产品或绕过hook。没有新增/运行UI自动化测试，全部16张截图实际查看。取消/前三项外汇总缺少当前真实未归档样本，Firefox未实际运行；这三项不宣称实页验收。已审查封闭四种生命周期共用同一计数和状态枚举分支，仍保留上述实际覆盖限制。

交付范围仅卡片完成与结果阅读、正确的主题填充、两语言和单一公共标签/架构/证据。Goal保持active；后续继续用户全界面的理解成本与功能排查，不重新追查已解决的Sources/Rendering旧问题，也不扩大为本轮没有证据的调度修复。用户18571窗口和真实数据库未操作。
