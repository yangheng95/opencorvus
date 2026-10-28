# 重命名保存、失败与输入保留

## Recall

用户持续要求单代理自主体验/修复UI/UX和功能，直到明确停止；不使用子agent覆盖旧Goal的Astra文字。保留原产品范围、不重查已解决Rendering、不建branch/worktree、不重启/刷新用户18571或窗口，只在无法安全判断真实冲突时等待。先完整根因/影响分析与spec，UI只用实际开发/ui、原图人工复核，禁止UI自动化及源码文案/DOM/render/快照/像素测试。每批范围commit与fresh fetch/merge/完整待推审查及正常hooks/push；无Release/tag/PR，Goal保持active。

上一turn为progress：8eb2234dfdd99f924390856ef85566836e48d9b5已正常push，20:32:23Z fresh sync0/0、40自有文件清洁，保留177外部状态。新增名称/标识/目录Project搜索，复用原导航owner，19原图覆盖双语/分页/取消/设置与无目录导航，长目录/完整高亮均最终构建复看。发现并修复Windows checker并发编译运行exe冲突，唯一published locator、真实运行中再发布正向测试及三项cold并发原checker0。三个774scope已公开200、原exec/native/launcher0/三项结算及精确出生链退休、catalog清退；原截止不重开。闭合774-after2为92表103484行/schema9，全部行及五QA文件、附件namespace字节保持，模型0/累计767、未复制auth。另一人类聊天冻结38源码于e1a并处理发布；只有实际冲突才等待，保留其版本/日志/索引。其他聊天的要求回复不自行构成给它发消息的授权。

## 现象、根因与全仓影响分析

773图03/04真实重命名失败后对话框已关闭，名称未改且没有显著反馈；当时Provider执行初始化依赖已在773修复，反馈问题仍未处理。当前shared AppDialog.finishAppDialog先清activeDialog、关闭并resolve confirmed，main的Project/Mission/Task/Chat rename再调用实际API；任何校验或请求异常只能到runMainAsync/reportError的诊断日志。四类metadata rename共用同一输入丢失路径，Work使用Chat同一函数。当前空输入已有inputRequired保留机制，但200字符上限只在Mission/Chat服务或Task服务内执行，长输入在弹窗关闭后才失败。

已读根AGENTS、774 Recall/交付、07-panel共享对话框前台输入与Project identity合同，完整app-dialog服务/host、dialogStore、共享Dialog/TextField/Button/Feedback、native-surface occlusion、main四rename与header/sidebar复用，Project/Mission/Chat/Task服务、board.loadTasks及task-rename-service现测试；全仓搜索AppDialogOptions/Result/show/settle/dismiss/所有inputRequired调用，包含FileExplorer、nativePrompt/Confirm/Select、clipboard API-key、card rewind与设置。没有命中AppDialog的UI自动化。task-rename-service是真实请求映射契约的stub测试，不是UI/端到端证据，不能代替实页。触及代码均无外部差异。

另有直接控制流风险：finish的required校验在epoch校验之外，迟到的旧确认可写当前dialog错误；如果简单在transition queue里await保存，又会阻塞新弹窗/occlusion收拢。Task.renameTask在PATCH成功后还await loadTasks/loadBoard，后续读失败会将已提交写操作误报为重命名失败。Project/Mission无网络刷新，Chat仅同步规范响应投影。不能复制独立Rename对话框或以统一全局错误弹窗遮蔽此根因。

## 实施合同

给现AppDialogOpenOptions添加可选异步onConfirm(value)，函数仅存当前completion，呈现状态仍在唯一dialogStore.app。当前未使用回调的确认/输入/选择框沿原合同。finish在原transition内核验真实completion/epoch、值和required/可选inputMaxLength，标记submitting；实际保存必须在transition之外执行；只有同一completion的成功才关闭并resolve confirmed，失败保留输入/原native occlusion并显示当前语言错误摘要与原技术详情。新弹窗仍由原epoch/replacement owner管理，旧回调返回不得写新弹窗或焦点；host只为当前未提交/失败的同一epoch恢复输入焦点。保存中同一确认不重入，控件/取消/普通Esc关闭暂不可用；这只是当前UI提交期，不修改LLM工具可见性或执行流程。

四类metadata rename将真实原API放入该onConfirm；Chat/Work、Task、Mission按已有公开标题合同验证trim后最多200字符并保留超长输入，Project不新增无依据长度限制。成功后的shared refresh token仍用现runPostCommitUiEffect，不把本地投影异常改写成持久失败。Task.renameTask的PATCH确认后，列表/board refresh失败记录现诊断并返回原成功合同，现board错误状态保留给原读取界面；输入与后端错误合同不改变。聚焦正向服务测试验证200写入加后续读错误仍返回成功、明确API错误继续拒绝，不新增任何UI自动化。

共享机制横审：全部show/settle/dismiss生产入口沿一个completion/epoch/occlusion队列；normal/失败/retry/replacement/新开及迟到回调分别按当前owner收敛。后端Task/Mission/Session轮次、正常/终态、重启恢复、串并行和多项目调度不由此UI队列拥有，四个mutation仍调用现metadata服务/identity路由、相同Project/Task/Mission/Session身份，不新增wake/dispatch/resume或消息。API authority在操作前捕获并在确认时校验，原Project目录/owner不随modal等待改变。相关执行状态/持久事件以原数据与最终完整行核对为证，不把模型或界面自述当根因。若实页发现业务调度异常，再立即按其真实共享机制扩审。

## 实页与资源验收

先从已闭合774-after2逐行备份和namespace复制，用当前普通build启动开发/ui基线38313：真实原Chat/Work输入201字符观察失败及保留情况，Project可用时打开表单后对自有实例公开正常shutdown，再确认体验真实网络失败，不使用UI测试fixture/拦截/mock服务。改后38314/必要38315沿本批最初60分钟绝对截止；每实例15分钟预定正常shutdown、至少5分钟收拢，观察超时只查原handle/精确出生身份。不因旧scope或句柄超时重开。Provider额度0/累计767、完整catalog用于历史投影、无auth复制。

改后实际输入校验/保留/取消，成功重命名并恢复原QA标题/名称；尽可能覆盖当前已存在Project/Chat/Work/Task/Mission，不为验收合成消息或创建执行。检查中文摘要/可访问名称、Saving状态与焦点，最后真实网络失败后同一表单保留输入和详情，人工截图；未知/缺少可用owner的矩阵如实说明。全旧行、预期metadata及规范追加事件、源库/schema9/integrity、五原文件/catalog/auth metadata与namespace核对。结束公开200、原exec/native/launcher0、三项结算、出生链退休后清退catalog；原图/非秘密证据、三索引、当前docs检查、范围commit和正常push。没有数据库迁移、SDK或HTTP契约变更，不把一批交付当全产品完成。
基线38313/198实证：图01输入209字符标题（重命名体验775加201个x）后点OK，图02表单关闭、原标题759未改；图03真实日志20:44:09 work-ledger.header-rename明确renameConversationSession 1–200字符要求，只有日志没有原位错误。图04 Project表单保留项目失败输入775；随后对自有实例公开shutdown200并原exec67731/native/launcher0、三项/出生链结算，catalog退休、余3404194ms。原775截止为21:42:42.485Z。再在缓存页面确认，图05表单关闭、只剩通用离线banner，输入丢失；198已关闭。无UI fixture/网络拦截，无metadata写入或模型调用。下一步按既定共享onConfirm/maxlength/错误呈现合同实施。

38314首轮实页图06确认长标题留在原表单且焦点恢复，但错误显示字面量`{max}`。复核唯一翻译器fillTemplate，只接受双花括号变量；新文案写成单花括号，check:i18n仅验证键集合所以未发现。先按现有双花括号合同修正两种语言，再普通构建、独立新scope实际重验数字200，不扩展翻译器或增加UI文案测试。

图07–11实际完成Chat、Work、Task、Mission、Project各自改名与恢复；图12–13在自有38314公开200关闭、原exec70420/native/launcher0后确认项目改名，原输入/焦点/错误摘要和真实Failed to fetch详情均保留。38315最终locale图14已显示数字200。图15又发现空Chat标题提示“Enter a file browser path.”；全仓复核根因不是通用dialog.input_required翻译，而是main三个metadata rename沿用了explorer.name_required覆盖默认提示，文件浏览器同键语义不应改动。三个rename改用现有dialog.input_required，两语沿单一通用合同；Project保留自己的项目名称提示。普通构建后38316新scope仅做最终双语校验，仍沿最初截止21:42:42.485Z。

## 最终复核与边界

图14/16数字200、17中文真实断网摘要、18编辑清错和取消、19/20最终英中文必填、21最终中文长度均实际呈现并查看。四实例已分别公开200关闭，原exec67731/70420/99230/7386及native/launcher均0，三项结算/精确出生链退休，catalog副本已清退；最后仍余1979874ms。原凭据未复制、元数据不变，模型0/累计767。

完整92表比对：基线103484行全部精确相同；改后103588行，只有Project与三个Session的time_updated改变，所有名称与其余字段恢复，原行保留；后两份最终副本103588行全同，四库schema9/integrity ok，所有源库同复制前事实。新增104行追溯到6项session.updated与2项task.updated原发布：16 delivery、16成功receipt、8 outbox、8 owner、24 phase、16 bus_delivery activation lease、16 grant；逐项关联发布和完成事实，不是Task/Mission/Session执行唤醒。Task现setter仅set title且publishOwnedInTransaction TaskUpdated，恢复后整行相同符合代码；Project.update沿现GlobalBus.emit project.updated，不进入持久outbox；无执行状态/Task轮次或消息新增。临时逐行检查器第一次误用线性查找造成二次复杂度，精确核验自有node PID84748/出生21:08:39Z后停止，改为Set索引重跑5.3秒退出0；不影响生产或UI验收。

真实本地请求很快，未获得慢保存完整窗口、替换/迟到回调的实页矩阵；当前只有代码ownership/epoch复核和类型检查，不宣称该矩阵完成。Task PATCH成功加后续503只有聚焦服务stub合同，真实页验证正常改名和刷新。最终类型、普通build/renderer、2617键i18n和3项服务测试0；文档检查与交付回执另随提交收拢。没有UI自动化或数据库迁移。

用户新增授权已用于gh只读GET：当前7开放告警身份与771回执一致，6历史锁、1当前GTK链glib；只读未dismiss/写设置。真实依赖风险不以历史产物计数掩盖，本批不改依赖版本。
