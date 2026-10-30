# 对话中的原来源查找

## Recall

用户要求持续单 agent 自主体验 UI/UX 和功能、查清根因后落盘方案、真实页面/截图人工复核、聚焦正向测试、范围提交与同步上游后正常推送；旧 Goal 的多人要求已被后续单 agent 指令覆盖。本批从已推送 cfe226f62f4443ff97f38d5a8e05fef54140b022 继续，809 为 progress：Goal 预算可核对、字段原生纠错与长表单错误可见已交付，20 图与完整数据保全、正常 hooks 通过。五个旧 scope 都已退出和退休认证/模型目录副本，最新源为 809-locale，schema9/92表/204873行，75附件/7项目25tracked保持；模型0/累计1083。Dependabot一次重扫已消耗，不重复。

本批继续原 Sources 使用体验，用户18571服务、窗口、进程和真实数据库不操作；不开 branch/worktree，不委托，不执行历史输入。隔离 OAuth 与完整模型目录复制授权有效，但本批目标是来源阅读/查找，模型请求上限0。工作区初始181行其他改动、暂存空，保留不混入交付。

已读当前AGENTS、07-panel-reactivity Sources/阅读/导航合同、近期Sources桌面看板与下载恢复、侧聊继承来源、807/808原消息定位记录，SourceParts当前标签/分组/位置/复制/摘录、CardParts原分组和执行折叠、ConversationSearchDialog和conversation-search/snapshot、主/参与者两surface定位入口、公开原会话导出。全仓搜索来源位置串只有SourceParts一个实现；查找服务明确只用text Part及结构化停止原因，没有消费原Source Part。SourceParts的原分组/身份/原文件和复制路径已有真实证据，本批不重复陈旧闪烁或虚构当前缺陷。

## 修改前调查与验收方案

当前代码线索：findConversationMessages忽略Source标题、路径、URL和摘录。实际可观察缺口及原记录仍需实页证明，尚不修改生产。查找返回原Message，公开完整快照保留Source Part；不应另抓网页/文件来索引、不读取Reasoning或复活工具执行。若查找来源成功，定位还必须使真实来源可见，不能只跳到折叠组所在的消息后宣称完成。

1. 只读核对已退休809-locale原数据库与现有Source，选择原摘录/标题/路径中未在正文出现的真实查询；不SQL注入或制造消息。记录原Message/Session/Source/目录身份与原值。先补齐真实现象、直接触发、数据流根因、旧方案遗漏、定义/调用/公共契约/数据/测试/文档/交付风险和具体方案，再改产品。
2. 以完全退出的原源复制全库/原配置/75附件六namespace，保留92表/schema9与7项目/Git/原文件字节。新810-before38401/after38402共用首次启动固定60分钟物理截止，至少提前五分钟完全退出。构建成功并冻结全UI资源后才启动 native 开发 serve /ui；运行中的资源不可变，语言等静态修改必须新scope重启，不以文件名或reload冒充新资源。短checker沿原隔离runner。
3. 基线通过真实页面确认原Sources可见而查找查询不命中原来源；修改后检查来源查找结果的原身份、预览、真实来源展开/定位与复制/打开，以及正文原消息查找回归。主会话和参与者分支按实际数据覆盖，未覆盖明确记录。所有UI只能真实交互、截图人工复核，不新增/修改/运行UI自动化、源码文案/DOM/组件/fixture/快照测试。
4. 非UI检索/解析或公共请求变更须先全仓审计并有聚焦正向契约测试；原公开API/SDK/持久化/模型调用预计不变。若出现调度/队列/唤醒/恢复/并发/终态异常，立即横向审计Task/Mission/Session全部生产入口、轮次、正常终态、重试重启、串并行与多项目，不能按Sources场景降级。
5. 实页后完整HTTP及原生SQL EXCEPT保全全部原值、业务计数、附件/项目/Git。自有页关闭、公开shutdown、原exec/native/launcher/物理/输出/请求/出生身份结清，配对凭据和完整catalog副本退休、源metadata和catalog字节保持。同步架构/记录/证据/三索引、当前docs检查、范围提交，fresh fetch/merge完整待推集合复核、正常hooks push和fresh回读。长期Goal保持active。

## 当前真实缺口与实施前完整分析

38401/current main-C7JjON1J.js：01 已人工查看第7个原文件来源 test_invoice.py:44:26 的真实摘录，包含999.999；02 查找999.999显示0条。03 原W3C写作来源及可展开原摘录正常，04查找其中的Proposal Documents显示0条。真实HTTP也确认两个原Chat分别3/4条，以及Task68条中invoice.py:1:5的Source，原查找函数均返回0；原Source完整存在，不能归因为数据丢失或模型没有引用。三个来源都是旧真实记录，不创建新消息。新增Source752项目原Git/3tracked快照后，共8项目28tracked；原库204873行与75附件保留。基线已公开shutdown200、native/launcher0、配对副本退休，原截止余3161162ms。

直接触发是查找对话框的统一findConversationMessages；根因是它只从text和结构化停止原因构建body，原Source Part完全未进入索引。旧807/808解决了不同会话类型、原Message和参与者定位，但没有扩展这个明确的正文范围；这次是来源检索能力补全，而不是旧Sources渲染/下载故障。原Sources的真实计数、相邻分组、复制和打开保持。全库只读核对同Message内Source ID没有重复；Source ID跨Message/侧聊复制重复仍保留各自真实上下文。

方案：把现有Source类型判断、身份与file位置串从组件移至一个纯共享模块，SourceParts和检索共用，不复制格式或保留旧导出层。完整快照reader为新增消费的来源身份/地址/可选文本/行范围提供明确字段错误；现有Session/Message、原对象、导出、生产顺序和错误名保持。find在原Part顺序内统一构建正文/Source片段/停止原因，检索保存的标题、地址、文件位置和摘录，不读取Reasoning、工具JSON、磁盘或在线页面。仍一条命中对应一条原Message，额外携带真正命中的sourceId，预览取自同一body；普通正文命中合同保持。

定位继续唯一conversation-scroll请求，增加可选sourceId；标题入口/AgentRail/阅读恢复等未携带它的调用保持。SourceParts将其现有group key及当前source ID列表暴露为派生DOM元数据，叶子标记原sourceId。共享的UI reveal helper只在指定原Message内从这些真实分组元数据展开同一个cardExpanded状态并解析原叶子，不在Dialog猜分组或另建数据源。原网页摘录可沿同一excerpt key展开；Source文件仍沿原Tooltip/文件阅读路径，不新增第二摘录renderer。主reader在原虚拟卡片/Message挂载后定位原叶子；子reader的原layout恢复使用同一叶子resolver。主等待过程补当前selection epoch/authority检查，子请求沿原requestKey/landing/Message及active owner退休。不是第二scroll writer或全局DOM搜索。

横向影响已核对：生产消费者只有主VirtualizedConversationCards和SubagentConversationPanel，生产者有查找、AgentRail、主阅读恢复及主到子交接。Task/Mission/Chat/Work的查找复用同一原快照与读取边界，目标来源若退休返回现有未能定位反馈。原Session/Task执行轮次、唤醒、重试、终态及模型请求不修改；真实before startup recovery全0、Provider0、原API/SQL保全后继续核对。没有当前业务调度异常证据，不制造新执行来凑覆盖。

非UI改动在现有conversation-search/transcript/export纯数据测试中做正向原身份/生产顺序/Unicode、三种Source、范围格式及命名错误合同，先运行新增正向查找用例验证旧实现失败，再实现并重跑必要关联测试。UI helper和导航只真实页面截图验收。中英查找提示说明来源范围，计数仍为匹配Message。无公开HTTP/SDK/schema/持久化格式、Provider或Release修改。after38402沿同一截止，实际复核隐藏组第7来源、网页标题/摘录和Task参与者来源、原正文查找；只定位原来源，不声称字词级高亮或摘录内部精确字符定位。

## 候选实页返工分析

原文件来源查找999.999已命中、展开第7来源，点击后原文件第44行实际选中；但预览从完整body取上下文，混入第8来源路径。应仅在命中的原Source片段内截预览，正文与停止原因原合同保持，用两个相邻来源的明确预览输出作正向契约测试。

Task invoice.py:1:5实际命中原Builder消息，但选中后持续定位。只读DOM证明原来源存在且其祖先均可见：msg-source-entry是display:contents，getBoundingClientRect高度0，而同一msg-sources为24px。直接触发是新的叶子标记挂在无布局框的容器；子reader的原messageTop要求正尺寸，得null后原恢复器正确等待布局，因目标本身永远无框而无法结清。主reader也会对无框节点scrollIntoView，先前组展开可见不能证明准确落点。移动同一sourceId标记到现有msg-source-entry__row实际布局框，两surface共用原resolver，不修改CSS或给共享滚动器添加超时旁路。此为当前新增定位的布局目标选择错误，未涉及业务调度、队列或执行轮次；已横向核对两个生产reader和所有请求生产者，Task/Mission/Session持久事实保持。必须新冻结实例实页复验原主文件/网页/Task来源和普通正文，不能将第09图的定位中画面记为通过。

## 离线实施及新候选窗口

新增两项正向来源检索用例在旧实现实际2失败/7通过；实现后关联检索/Task transcript/原快照导出共21通过、46断言。当前Source类型/位置/身份只有utils/conversation-source一个定义，SourceParts旧导出已删除且CardParts改用新定义；新增UI resolver只展开原group key，原Message范围内解析叶子。主/子reader、查找请求和原网页excerpt接入可选sourceId；普通消息和其他生产者原参数保持。成功构建main-JXuv0WJR.js、overlay类型和2语言2638键检查均0。

基线在07:27:22.379Z已正常退出并退休，原绝对截止08:20:03.468Z未改。离线分析/实施跨过该截止，10:51:51Z当前时钟证明旧窗口过期；没有存活的旧服务/请求/认证副本，不能复活或延长它。候选改为全新810b-after/38402，从完全退休810-before的原数据续存，首次候选启动单独固定60分钟截止，旧批次期限/回执不改写，至少提前5分钟完全结清。基线截图与原HTTP仍是当前修改前的真实证据；新实例必须复核所有原数据和来源事实，不能因为检查器绿灯就宣称UI通过。

## 最终验收与交付

返工后的 main-B72V-3pp.js 先成功构建并冻结全部UI/语言资源，再启动810b-verified/38403；与after共用已固定B截止。第10—17图均实际呈现并人工查看：Task原Builder来源定位结清、网页原摘录展开、第7来源从折叠组展开、普通用户正文原消息定位、中英提示/计数/日期，以及最终打开原文件第44行。预览仅截取命中Source片段，相邻Source不再改变它的上下文；一条结果仍是一条原Message，携带命中的Source ID。摘录内部字词级定位不在当前合同。文档Source为纯数据覆盖，没有声称本批文档实页通过。复制按钮反馈已复制，但浏览器剪贴板独立读回为空，只如实保留UI反馈，不把它当完整剪贴板验收。

最终聚焦纯数据测试22通过/0失败/47断言，overlay类型、构建及renderer公开面检查均0；语言检查两语言各2638键通过。实际GET完整快照file/web/Task分别3/4/68条，与修改前完整原响应深比较相同，新真实来源查询返回原Message和原Source身份。原四类Task/Mission/Chat/Work完整HTTP在UI后与基线deepEqual。

三scope均公开shutdown200，原native/launcher exit0、物理/输出/请求完成；认证和完整模型目录副本均退休，源认证metadata/catalog字节和metadata保持。原生SQLite原值EXCEPT证明92表/schema9/204873原行全保留，最终204879只新增三组lease/grant；75附件六namespace原件/副本字节保持；8项目28tracked原文件和Git原HEAD/ref/index/status保持。模型0/累计1083。用户18571服务、窗口、进程和真实数据库未操作。

本批证据入口为[原来源查找](../../artifacts/2026-10-30-source-conversation-find/README.md)，含失败返工与最终17图、真实检查/数据回执。同步07架构和三索引，完成当前docs检查后只提交本批文件，其他并行工作区改动保留；提交前HEAD已由其他已推送benchmark交付推进，正常fresh fetch/merge与完整待推集合审查后正常hooks push，不创建发布。长期Goal保持active，后续继续自主体验。
