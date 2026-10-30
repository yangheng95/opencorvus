# 归档列表中的原内容阅读入口

## Recall

用户要求持续单agent自主体验UI（User Interface，用户界面）/UX（User Experience，使用体验）和功能，分析后落盘、实页交互与截图人工复核、范围提交及fresh upstream合并后正常push；最新明确禁止子agent，覆盖长期Goal中旧的三个Astra。只在无法安全判定的真实冲突等待，不新建branch/worktree，不动用户18571实例、窗口、进程和数据库。Dependabot一次重扫790已经消耗，不重复。长期Goal保持active。

805是实质progress：a83472f7013175e4bfcaeb998815958d8c2d2253已推main，00:54:10.401Z fresh fetch/merge HEAD=origin/main、0/0，本批71文件干净、三共享索引行HEAD/working各一次；保留177项外部改动。修复精确Task归档身份和活动列表误清选择的双根因；5后端测试/69断言、23本人实页、构建/类型/文档352操作/26组及全部正常hooks通过。源805-after2已shutdown200、原exec/native/launcher0、物理/输出/请求结清；复制auth+完整models退休，Provider0/累计1083。完整schema9/92表204673行，204326原行全值保留，75附件/六namespace和五项目12tracked/Git状态保持；现有paused/complete Goal、Task完成、Mission关闭原事实不改。

已读当前AGENTS、07-panel Archive queries/选中身份/导航契约、805 Recall和结果；ArchivePanel全部列表/查询/动作/focus寿命、ConfigDialogHost/App/main属性链、单一archive reader、普通Task/Chat/Mission导航与requestWorkspaceSelection、config-dialog关闭合同和现有Button/SettingsRow primitive。全仓搜索ArchivePanel/ConfigDialogHost定义及调用、list/read/open、原架构和10月归档搜索记录。触及overlay/test未发现这些组件/属性的UI自动化测试，不运行UI测试。开始相关源码无外部未提交修改；其他benchmark在途改动保持。

## 修改前调查和影响面

源码证据显示Settings归档列表行只有restore/delete动作，title是span；无法在保持归档状态下从列表打开。804/805提供了真实精确归档读取和Task原链接，但没有接入该可发现入口。此为产品体验缺口，先由真实页面确认后实施，不把源码推断当视觉通过。归档公开reader已返回含真实directory、体验、Project与Task/Mission身份的WorkLedgerItemRow，不需新API或第二缓存。

已有main selectWorkLedgerTask/openWorkLedgerChat/openWorkLedgerMission分别复用普通导航生命周期，包含authority、选择epoch、未保存编辑器离开确认、中心panel与现有SSE（Server-Sent Events，服务端推送事件）读取；不得以window.location或平行读取绕过。ConfigDialogHost目前只接收已有Automation会话打开回调，可沿同一App→ConfigDialogHost→ArchivePanel属性链增加一个类型化row回调。main dispatch只按已有真实row.kind选择原入口。

三个现有普通导航在admission unchanged时共用revealCurrentConversationFromBoard，只显露会话而不关闭Settings。新入口必须覆盖“当前同一归档对象→Settings→Open”，否则按钮会看似无效；若实页证实则扩展该共有reveal，在现有authority/epoch下关闭Settings并显露会话，三个调用共同await，不新增选择寿命或伪造身份。初始判断待实页确认。新打开动作必须服从当前row mutation/loading可用性；打开不会restore、暂停/继续Goal、发送消息或创建执行轮次。

持久数据/模型协议/路由/SDK/schema不改。纯UI不新增、修改或运行UI自动化；普通build/type/i18n和docs仅作配套检查，真实桌面截图是UI验收。计划不新增通用抽象、平行配置或后备路径。用户/模型原文、文件名和原完成理由保持真实语言；新增Open及归档说明覆盖en-US/zh-CN并使用当前语言。

## 实施前验收方案

1. 新before38382/after38383从完全退休805-after2作原生SQLite backup，保留204673行/92表/schema9、持久publication、包revision、全部75原附件与五QA项目Git/index/status/原tracked字节。每批首启动前固定60分钟诊断截止，候选沿同一截止，至少提前5分钟公开shutdown；native用精确物理进程寿命，短checker沿既有inactivity工具。配对复制已授权OpenAI认证和完整模型目录，只验证本地注册/精确gpt-6.1-sol目录，不新发模型请求；最大0/累计1083。
2. 本人通过独立内置浏览器真实打开Settings→Archive，查看原行、试读标题/操作并截图确认缺口。另选既有native Chat三消息/70字节Sources文件、已有complete Work Goal148493令牌/3轮、完成Task30消息/139事件和已关闭Mission两消息；通过真实正式archive HTTP准备四对象归档，保留原身份、历史、用量和停态。HTTP准备不冒充UI归档点击验收。既有原生Session/Task/Goal均不SQL构造，不执行原正文指令。
3. 缺口确认后才加入Open文字按钮和单一导航回调链，复用Button/行布局；英文中文说明明确可阅读、恢复、永久删除。先验证正常不同对象打开；同对象再次从Settings打开验证配置页收起，必要时修复已分析的共有ready分支。所有更改先补充实页现象和最终决策。
4. 实际从Archive按当前查询打开四类对象，确认Settings收起、准确原标题/Project/体验、归档banner、禁用输入；Chat展开真实Source原件，Work看原Goal完成证据/用量，Task展开交付文件，Mission读原历史/关闭状态。至少一次键盘打开和中英文、长标题/目录布局，恢复从原详情明确操作，query/empty/列表操作无混淆。当前对象再Open必须实际通过。不得新增UI自动化、DOM/文案/快照断言。
5. HTTP只读回验和原生SQLite全表EXCEPT保留所有原Message/Part/usage/Goal/任务/关闭事实；只允许四目标archive/update字段及正常Bus/lease/event新增，逐项解释。原库、75附件和五项目Git保持。全部独立页关闭、公开shutdown200、原exec/native/launcher0、物理/输出/请求结清、复制对退休与源metadata/catalog字节核对。更新本记录、产物README/三索引、当前架构与文档检查，所有本轮修改范围提交、fresh fetch/merge/完整待推集合/正常hooks push及fresh同步；不发布版本/tag/Release/PR。

## 01:02 UTC：实页确认与实施决定

本人已在38382 Home→Settings→Archive看到实际五条合法投影：原Mission、完成Work、三消息Chat、旧空Chat及完成Task。另一旧metadata={}记录没有native conversation身份，不以直接SQL行数冒充公开archive数量。图01显示只有恢复/删除图标；实际点击Task标题没有页面/AX变化，阅读入口缺口已证实。四个正式PATCH都200，所有archive后精确GET确认原3/8/30/2条消息、Task139事件/交付、Goal完整原projection仍相等，Goal complete/148493/3保持。

新增明确Open文字按钮，复用现有Button outline/sm，附本行标题的本地化无障碍名称；不把整行变为嵌套按钮，保留原title截断、元数据换行和恢复/删除语义。按上述单一props链传真实row，main用既有runUserNavigation与三现有入口。共有ready分支的提前return在代码上已明确不会关闭Settings；无需新增后备关闭。实施同时把已有reveal helper改为async，捕获现有epoch，await closeConfigDialog后校验原authority/epoch，再显示当前conversation，三处await；最终实页将覆盖同对象再次打开，代码推断不冒充已完成视觉复现。没有新增后端契约或数据迁移。

## 01:07–01:18 UTC：真实验收与保全

普通构建main-C9ybhFm-.js在38383真实开发/ui发布。本人从Archive而非手工URL依次打开完成Task、完成Work、关闭Mission、真实Chat：英文列表长原名/目录和按钮布局可读；键盘Enter直接打开Task，展开原counter.py并滚动读到return value + 1；Work类型查询命中原条目，Goal readonly详情保持complete/148493/3及原完成证据；切中文后Mission原两消息/非进行中，Chat按session-data-788.json查询打开，从实际Sources打开原JSON，check原文回看788、answer数字42、status ready可见。四类均实测“当前对象→Settings→Archive→再Open”，设置页正确收起；Chat的只读原文件面板和Task代码预览保持。图01–15全部本人查看；最后搜索零结果与清除恢复原剩余行准确，未把加载中间态当通过。

四对象均从原详情banner明确恢复；20次实际HTTP观察确认Task原30消息/139事件/turnArtifacts、Work/Chat/Mission原8/3/2消息全值相等，Goal完整projection相等，Task仍completed、Mission仍closed；仅Open时archive时间原值保持，恢复后清空。不发消息、不继续Goal或任何执行轮次，不永久删除。已有未保存编辑器离开确认沿原导航复用，本批没有制造未保存编辑器buffer，不将该分支宣称新增端到端通过。

build/renderer public surface、Overlay类型、i18n两语言2638键、当前docs352操作/26组均通过；纯UI未新增或运行自动化测试。所有结果与[15张实页/读取/检查原件](../../artifacts/2026-10-30-archive-library-reading/README.md)落盘。schema仍9/92表，原生SQLite EXCEPT覆盖原204673行完整TEXT/BLOB；source204673完全不变，before204703/after204849，integrity_check=ok且foreign_key_check空。只有三个操作Session的archive/update与该Task archive字段允许变化，最终全恢复；其余所有semantic行值和行数保持，包括原Message/Part/protocol。176新增行全部为8普通归档/恢复通知、32成功delivery/receipt、24 phase receipts、34 lease/grant（32delivery+2runtime）及4UI事件轮次。没有新增业务执行事实。

75原附件/六namespace字节与五项目Git HEAD/ref/index/status/全部12 tracked文件保持（含unborn HEAD原错误码/输出、已有staged/unstaged差异）。两个native服务全部公开shutdown200，原exec/native/launcher0，物理/输出/请求结清；源身份与监督链按PID+OS出生核对，runtime UUID对应authority-ready，不跨域混同观察UUID。所有复制auth+完整models退休，源auth metadata/catalog bytes+metadata保持；最终截止前2669818ms关闭。Provider0/累计1083，只本地注册/目录投影，不声称新真实模型调用。下一步按本批范围提交、fresh fetch/merge/完整待推集合与正常hooks push，长期Goal保持active。

补充新增四个event_occurrence的来源资格：实际bus_outbox_id逐个连接原不可变outbox，分别对应本轮四个明确restore通知，目标和时间与实际操作一致。scheduler/event-service.ts在接收Bus输入时写入该引用式acceptance，即使没有匹配Fire也持久化空接收；event-projection.ts同样从原outbox解释事件身份。全表EXCEPT与非Bus/lease/event表精确行数证明下游旧业务/执行事实保持，不把这四条叫作Task/Mission执行轮次。公开publication资格保留逐个outbox/target/type/restore映射。
