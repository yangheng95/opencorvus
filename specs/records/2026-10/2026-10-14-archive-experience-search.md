# 第23批：归档与工作记录的Work会话类型

## Recall

- 用户要求持续批次迭代直到明确停止；Root自己调查、实施和验收，不启动子agent，不向其他聊天发消息。前一批归档搜索9fc9fb7bb和证据范围校正0ee22c4d6均已正常提交，本任务正常push实际0，完整原hook通过；fresh fetch/远端main与own祖先确认0ee22c4d6，自己的组件/record/artifact无未提交变更。新的其他任务权限/Session源、message工具与测试/索引变更全部保留。
- 本批承接第22批尚未实际操作的Mission与Work归档/恢复/重新打开入口，同时调查可见类型的搜索匹配。前批Root12图、正式checker656 HTTP、两轮物理退出/整对假凭据清理资格保持；不能拿Chat资格替代本批。
- 已读AGENTS、当前07-panel/07-panel-reactivity统一工作记录、Archive查询、会话体验身份和authority合同；B22完整Recall；canonical chat/identity与chat/session创建writer；work-ledger projection全部searchPattern/Project/Mission/Task/assistant分支及两个生产出口；公共work-ledger路由与overlay唯一service/Archive/CommandPalette消费者；work-ledger-search测试与memoryProject夹具；MissionDraftInput/createDraft/archive路由及其service，原Mission原生未派发draft合同。
- 全仓定义/调用/历史检索：conversation.experience由唯一writer产生chat/work；合法assistant分支已用该JSON字段验证身份，输出行kind统一chat，experience则保留真实值并由界面显示为Chat/Work。当前搜索OR只比较常量chat、原title/id/directory，遗漏同一已验证experience。两个公开active/archive出口共用此SQL（Structured Query Language，结构化查询语言）投影。旧command-search只声明技术kind查询，现有测试只造Chat；B22接入页面也未改变服务器字段。没有第二搜索实现或地方性keyword分派。

## 根因与影响分析（实施前）

1. 候选可观察现象：原始标题与目录都不含work的合法Work会话，在列表仍标Work，输入Work却可能零结果。源码存在明确字段缺口；真实页面/HTTP复现前不先改产品或宣称通过。测试数据路径使用archive-experience而非含work的目录，避免目录匹配掩盖缺口。
2. 直接触发/数据流：同一Session.metadata.conversation.experience进入身份筛选与最终row.experience，但查询只拿row.kind的固定chat参与匹配。默认标题Work会碰巧命中，改名后暴露遗漏，因此不能靠默认命名或别名补丁。既有LIKE字面转义、排序和cursor保持唯一事实。
3. 影响面：全局/Project范围的active Work Ledger、命令面板和Settings Archive共用生产投影，均需同源修复。Task/Mission独立分支不改变；原技术kind chat搜索语义保留。此次不是调度/队列/恢复缺陷；归档/恢复若显现终态异常，立即横审全部Task/Mission/Session入口与轮次、正常/终态、重试/重启、串并行、多Project，不能以局部通过排除。
4. 最小方案（真实复现后实施）：只在已验证合法conversation的同一search OR中加入其现有JSON experience字段的LIKE比较；重用search参数/转义，不解析用户意图、不硬编码Work查询分支、不在浏览器本地过滤。公开参数、函数、错误、SDK、配置、schema/持久格式、迁移基线和identity writer均不变，不需要数据迁移或新索引。
5. 聚焦正向测试：原work-ledger-search追加真实canonical writer的中性标题Work与Chat，覆盖两个Project、active/archived、原experience/ID身份和同查询cursor。先跑原checker保留明确预期Work结果的失败，再实施单一投影修复并重跑全文件。禁止负向核心断言、UI文案/DOM/组件/截图测试；原4个正确查询合同继续通过。
6. 真实输入与页面：成熟独立backend /ui，before18662/63、after18664/65，自有HOME/数据库/完整公开models与随机假auth整对；两轮均用B22冻结UI，因本批预计仅后台数据读取修改，不另开Vite或重建无关前端。公开创建/命名/归档A/B各一Work、一Chat和一Mission draft，共6条，所有标题中性且不含英文类型；Mission仅真实draft，不dispatch、不伪造消息或模型结果。
7. UI/API资格：before亲看6条类型与Work零结果、Mission查询及完整原draft；after亲看Work查询匹配两条及中英呈现，恢复A的Work和B的Mission后查询保留、公开读回真实active/archive身份，回应用重新打开对应原Work与Mission草稿，核对原title/request/体验。Chat不冒充Task；Task执行/恢复、永久删除、LLM（Large Language Model，大语言模型）推理和调度触发不在本批资格，零真实模型请求无需Sol。
8. 检查/隔离：聚焦真实后端测试、core类型、文档/架构索引/精确树与正常hooks；没有UI自动化或测试替代视觉。只自有页面/服务；原75分钟生命周期/真实无活动边界保持，正常marker -> settlement -> 父真实退出 -> 双端口0 -> 精确删除自有假auth/models整对 -> 完整原日志隐私复核。失败原件保留，不动用户进程或凭据。
9. 交付：先本spec和三个索引，再实际证据/改动；当前07-panel补canonical experience搜索合同、CHANGELOG中英未发布增量、相关README与原始截图/HTTP/失败/检查/退出。范围正常commit、fresh上游merge、完整pending已授权交付审阅与正常push；不新branch/worktree、不rebase/force/no-verify、无tag/Release/PR。B22最终push与其文档提交/type审阅原件由本批previous-delivery承接。

## 实施前状态

仅实施前分析，产品尚未修改。本批真实页面、正式输入和测试红/绿尚待执行；实现以本方案和实际调查补充为准。

### 原检查失败与工具修复

新的纯后端正向合同已实际红：原runner4通过/1失败、19断言，WoRk应返回两个canonical Work身份，实际空数组；原4个查询合同仍通过。产品投影未改。

首自有before PID35112、18662/63，occurrence beca2503-33e9-443b-9e6b-049478456bb5的数据准备器用未声明surface `root.owned_archive_experience`发Mission archive，实际400而预期200。原transport-protocol允许api与声明的overlay入口，正确独立HTTP来源是api。随后诊断器又错误假定GET /mission/:id，实际文本404解析失败，Node25同时保留原libuv断言；两轮外层均非零，准备器原exit1而诊断Node原exit3221226505，完整原输出保留。原诊断器按汇总后才写盘，未保存早先响应body，不能重建或伪称已得到原body。当前仅已归档A的Work/Chat与未归档Mission draft，不能当6项准备通过或功能故障。

工具修复：按当前公开Mission list/status合同读取，不猜单条GET；每个HTTP响应先把原text/status/输入立即写盘，再作状态/JSON契约检查，脚本明确收敛exit1。数据创建归档来源改api。原before已正常settlement/父exit0、双端口0、整对自身假auth/models清理与隐私0（完整后台56049字节），没有截图或模型请求资格。将用新before02 occurrence在同端口重跑原6项准备，不重开旧occurrence；原失败数据/日志保持。

原工具准备还把新增test probe误当修前test快照；已在产品修改前从原干净不可变HEAD保存真实baseline，初次probe快照也保留。此为捕获身份校正，不改原测试结果/输入/生产实现。

### 实施前真实确认

新before02 PID73816，occurrence7d09d63d-5b4a-43bd-8976-cc6e875ce575，18662/63。修正后的原准备器实际0：19次正式HTTP创建/命名/归档两Project的6项，all6、Work0、Mission2；Root浏览后再3次GET精确同一原身份集合。独立修正输入probe另3次HTTP实际0，真实400明确surface非法enum，all6及当前Project归档Mission保持；不是复原旧响应。至此工具链原验收已重跑通过。

Root亲看01完整6条列表及各Mission/Chat/Work真实标签/目录，02输入Work却空，03原mission查询仍两条。中性标题恢复入口A/B-1/2/3、目录均不含work，排除标题/路径偶然匹配。tab25已关闭并发出正常停止marker；本轮未恢复/派发任何记录。结合红测试和正式HTTP，确认遗漏唯一experience字段是共享根因，按既定一处投影方案实施，不修改其他Session/权限工作源。

### 修后聚焦资格与类型修复

一处SQL OR补上同一合法conversation的原experience后，正式原runner5通过/0失败、24断言；after正式19 HTTP也实际0，all6、Work2、Mission2。尚待Root修后页面与恢复流程，不用这些数据代替视觉。

扩展到当前真实test的类型检查首轮非零（编译器原exit2）：新增排序期望数组将work字面量扩大成string，且旧titles helper的无注解空数组被推断never[]；全部错误都在同一被触及test，生产源未报错。保留原完整失败，只补期望字面量类型和canonical Session.Info[]注解，不改运行值、协议或查询。随后重跑原聚焦类型与业务checker。core原配置排除test，不能只跑旧core类型来掩盖它。

### 共享消费者的补充根因（前端实施前）

- 修后原聚焦类型已实际0，最终业务5/24再跑0。after PID89284、18664/65、occurrence eb987fca-fa2c-4b4e-be48-313c7302307e；Root亲看04六项、05 Work2、06恢复A-Work后同查询1、07中文Work1、08中文Mission2、09恢复B-Mission后同查询1。正式readback3+6 HTTP确认Work原体验/身份、另一个保留归档，Mission原request/零Task统计/backlog与原draft一致。没有派发或模型请求。
- 返回主界面后，10刚输入Work与11已结算命令面板都只有本地“打开文件夹/Work设置/网络”命令；原活动Work记录未呈现。相同正式active API已读回A-Work真实身份，因此这不是后端遗漏或读取未结束。不能以Archive通过宣称命令面板也通过。tab26已关闭，原after发正常stop，保留整轮原证据。
- 全仓rowMatches/paletteLedgerRows/commandMatches检索只此私有组件；已完整阅读其加载/分页/owner、commands/visibleCommands、Combobox defaultFilter=true、text-search、原command-search Recall与Mission SQL子项匹配合同。CommandPalette先把服务结果全部展开再rowMatches（title/id/directory/kind），又按Command label/hint/keywords匹配一次；两处都遗漏experience，确实会隐藏已由服务器接受的Work。单补关键词会保留重复服务器搜索定义，不能根治数据流。
- 唯一修订：顶层非Mission记录直接消费既有服务器搜索结果；Mission父/展开子Task仍使用现有rowMatches做原来的层级相关性选择，保持该分支输入、predicate与顺序。ledger命令已经是当前已接收结果，不再进入本地命令文案过滤；本地动作继续现有commandMatches。删除由此不再消费的ledger keywords赋值。没有新缓存/状态/query API/host gate、回退、LLM流程或公共契约。
- 风险/验收：搜索空/非空、父Mission与子Task展开、groupStart、Ctrl+1..9、分页及query/API authority代际均沿原合同。Mission筛选只是移至展开同一层，原helper语义不变；Task正式执行不在本轮独立视觉资格。需要新的Node前端构建、overlay类型；在新after02 occurrence重建原6项，重新实际Work/Mission搜索/恢复、活动命令面板Work匹配并打开原Work、再打开原Mission草稿，保留中英原图。前两轮冻结B22 UI属于诊断阶段，不能替代最终新UI。

## 最终实现与实际资格

- 三个源/test文件：公共projection仅增加原conversation.experience的同参数LIKE；CommandPalette直接接受服务器匹配的顶层非Mission记录，只把原Mission父/子筛选移到展开层，ledger可见项不再进入本地命令文案过滤，原已无消费者的ledger keywords删除。rowMatches类型限于Mission/Task，未增加并行查询、缓存、状态、配置或协议。原动作、层级顺序、cursor、9个数字快捷键和authority/query所有权保留。
- 最终原业务checker5通过/24断言，扩展core+当前test类型0，overlay类型0，Node build0（54.82s，完整原warnings保留），docs345/26及架构19当前检查0。根因红、捕获错误、原400/404诊断与首类型非零全部保留；没有UI自动化、源码文案/DOM/组件/像素测试。
- final after02 PID51424、18664/65、occurrence3a0c474a-f122-494f-82ff-1c0574c844b2，真实新UI/public backend。19正式HTTP重建同一6项并读回Work2/Mission2；手动恢复A-Work、B-Mission，3次Work readback和最终6次完整readback确认active/archive原身份与原experience、Mission原request/backlog/原零Task统计。打开原记录与切语言后又经相同正式checker读回0。重复both读取都有独立0日志，但同名逐请求JSON被覆盖，只资格最后保留的6次原body，不声称保存了每一次重复body。
- Root亲看22原PNG：01–03修前六项/Work0/Mission2；04–09仅后台修复后的Archive及中英真实恢复；10刚输入、11真正已结算的旧前端二次过滤缺口；12–16最终六项、Work2→1、Mission2→1中文；17最终活动Work查询接受原A-1并显示Ctrl+1；18实际Ctrl+1打开该原Work；19原Mission重新打开含hover tooltip，20移开原悬浮后原title/request完整可读且明确未开始；21英文Archive Work1，22英文活动查询原Work与原本地命令齐全。10/11是失败诊断，04–09不替代最终新UI。未编辑原图，不以DOM文本或类型/build代替视觉。
- final Work原Session ses_-zUS0MApozznIcBQbRhy，剩余归档Work ses_-zUS0MAjizzYwP4rPl1w；恢复Mission aed8d769565ea99b属于Project B，原始请求完整，boardLane=backlog。没有点击Send/Dispatch/永久删除、选择模型或伪造消息/运行；Provider inference requests和realSolCalls四轮均0，UI/API请求另计。
- 仅Root自有tab25/26/27，均关闭。before失败准备、before02、after诊断、after02最终四轮均正常settlement/父exit0、双端口0，再各自精确删除假auth/models同对；完整后台日志56049/109854/144875/198163字节，stdout/stderr各0，四次隐私checker0。没有用户凭据、用户进程、其他聊天或子agent操作。
- 资格边界：真实桌面中英Work和Mission查询/归档恢复/重新打开、跨Project身份、当前可见Ctrl+1与本地命令共存。Mission子Task前端独立执行/恢复、真实模型、调度与不可逆删除未独立操作，不借此宣称通过。已有Mission层级匹配的predicate/输入/顺序原样保留且后台正向合同通过。
- 当前架构、未发布中英更新日志、三索引与原件说明同步；随后必须范围commit、fresh上游merge、完整pending审阅与正常push，以实际回执为准，不先写未来SHA或成功。前批B22最终正常交付由本批previous-delivery承接。

归档器首轮错误假定每个非零child exit均为1，原脚本通过同一检查重现后实际1；原诊断Node是3221226505、编译器是2，不能改写成外层工具的统一非零显示。修正为失败码原样捕获，只对合格检查要求真实0；这是本地证据工具修复，原应用/测试/页面结果不变。该重现及旧归档器一并保留，再重跑原归档检查。
