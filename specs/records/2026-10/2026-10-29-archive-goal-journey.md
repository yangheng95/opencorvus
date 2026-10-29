# 归档对话与持续目标的日常使用体验

## Recall

用户要求单agent持续自主迭代，覆盖真实UI/UX（User Interface/User Experience，用户界面与使用体验）和功能，修复有证据的问题、实页截图人工复核、范围提交及正常fetch/merge/push；后续单agent指令覆盖旧Goal中三Astra，不委托、不新建branch/worktree。Rendering闪烁早已解决，不将旧截图当作当前缺陷或重复重点。790为真实progress：29bafc25f修复生产GLib/首次SDK（Software Development Kit，软件开发工具包）构建与Docker路径，427d3b1a8收录零开放Dependabot；Linux完整原生构建、选择挂载Docker原生构建、8项GLib正向合同通过。10:19:31Z远端main=427d3b1a8、fresh0/0、Dependabot0open，8项fixed，旧manifest退出图。已授权的单次手动重扫已实际执行且确认queued/59min冷却，授权已消耗，不再触发。整体Goal保持active。

本轮开始171其他旧媒体删除、4外部/共享文档修改、2缓存目录，均保留；只在真实冲突时等待。不操作用户18571服务/窗口/真实DB，不重启Docker/WSL（Windows Subsystem for Linux，Linux子系统）或旧实例。无在途791任务；788/790均真实终态，旧deadline不复用。已读788/770 Recall、结果/范围、当前ArchivePanel全部控制流、work-ledger archive契约、目标架构相关入口、project-archive与现启动/退休primitive；检索Home/Goal/Archive定义与调用。未发现package内额外AGENTS。

旧770已验证一次真实Work归档恢复与双语空态；788已验证附件编码/JSON历史并保留最后成功schema9/92表116028行备份。当前ArchivePanel统一从归档Work Ledger按全局query分页，mutation后沿原tail刷新、保留authority/generation和焦点；Goal Home/现有owner使用同一表单与guide。此次不能凭代码命名判定新问题，将实际体验首页→目标表单/指南/取消/返回、历史→归档→搜索→恢复→原会话的完整桌面路径，再决定实现。

## 调查、影响与验收方案

以最后真实788-after隔离QA数据库一致备份和两QA项目附件namespace/durable facts为输入，保持源库/原件；不SQL制造消息/目标，不改原会话身份。使用新自有开发serve /ui和当前普通Vite构建；仅将输出指向自有目录，不启动独立Vite服务或覆盖用户运行目录。新端口38355/必要改后38356。初始只做真实界面阅读、表单取消与可逆归档恢复，不点击永久删除，不启动/恢复目标；最大真实模型请求0，累计793不增加。为正确呈现准备状态，按已有授权同时复制OpenAI认证与完整models目录，分别验证凭据可用/目标gpt-6.1-sol投影；不执行真实Provider preflight，更不将本地投影冒称实际请求资格。若需要实际新模型行为，须先明确有限新场景/预算与同一阶段资源边界。

首启动前固定新的60分钟绝对截止，每实例预定15分钟正常公开shutdown，保留至少5分钟收尾；改后实例/重试沿同一截止。用现成熟native-host owner、实际原exec、物理/输出/请求结算及精确出生身份确认终态，正常关闭后删除自有auth/models副本。源码、UI发布输入、持久事实与可见结果分别保留；不因观察超时重启任务，不重开旧轮次。

实际交互用内置浏览器新独立页与当前桌面截图，人工复核原图；不写/改/运行任何UI自动化、DOM（Document Object Model，文档对象模型）/源码文案/组件或截图断言。类型/build/i18n（internationalization，国际化）仅辅助。实现前必须补齐可观察现象/直接触发/数据或控制流根因、旧路径不足、全仓定义调用/公共契约/数据测试文档交付及风险；当前尚无已证新缺陷，不先改生产。若涉及非UI逻辑，补聚焦正向真实checker；若发现调度/并发/恢复/终态异常，立即按Task/Mission/Session occurrence及多项目共享机制横审。未触及项明确排除，未知不能当作模型行为。

最终核对原数据/当前mutation归属、原件与schema9完整性、Provider0次及自有资源退休；如有修复，补当前架构/根Unreleased双语日志，更新本记录与各级索引，运行当前docs检查。所有本轮修改范围提交，fresh合并upstream、审查完整待推集合并正常push，不no-verify、不Release/tag、不夹带外部工作。无新问题也按实际证据记录已覆盖与剩余矩阵，继续下一日常路径，不把一批验证包装为全产品完成。

## 实页发现与实施前完整分析

38355/main-3kZGRd1y.js已真实启动，schema9 validated9→9，配对OpenAI/完整模型目录本地投影可用、0请求。1280×720首页布局原图01；从+打开Goal、填写未提交目标→About goals→Back to form，图02/03实际保留原文并聚焦Objective，Close返回+按钮；未创建Session或Goal。真实788 JSON会话原文/工具/Sources/回复完整可见，图04。通过header真实归档该Chat，设置Archive出现正确标题/目录/时间，图05；输入invoice-791实际无结果，图06，按Escape却直接离开设置到Home，图07。设置导航搜索archive同样按Escape退出并丢失query，图08/09。该问题在两个真实消费者复现，不是Rendering、Provider或后台关闭；本轮未运行UI自动化。

根因：共享SearchField明确使用type=search和受控value，但handleKeyDown只处理Enter；可清空值由按钮走唯一clear()，没有在Escape阶段同步该受控query。ConfigDialogHost已按781合同在window冒泡处理未取消Escape，因此先于浏览器原生search默认清空消费事件并关闭设置。Chromium当前[SearchInputType默认实现](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/html/forms/search_input_type.cc)也在非空search的Escape执行用户清空及搜索通知，证实应由输入处理当前操作。旧781修正了popup/父页面事件阶段，但未覆盖原生搜索字段默认动作，补Archive局部拦截或再次改父设置hotkey会遗漏共同源。

影响搜索使用成熟TypeScript AST（Abstract Syntax Tree，抽象语法树）枚举全部20个SearchField生产调用：19个clearable；Mailbox不clearable且有显式关闭Search合同；4个自定义onKeyDown均为函数，分别是References关闭popup/方向键、FileChanges非空清查询或空查询回列表、LogViewer消费Enter、Mailbox关闭Search。Memory另有onSubmit和onClear，必须复用现有clear回调。已读TextField.Input透传、search取消按钮样式、ConfigDialogHost/useHotkey与781历史决策；当前检索路径仅有settings保存纯事务测试，没有相关UI自动化。仅修改唯一SearchField：先调用当前公开自定义keydown（含其已声明的Solid函数/tuple handler形式），尊重defaultPrevented，再在非空/启用/clearable的未消费Escape复用clear()并preventDefault；空查询交给原popup/页面退出，Enter依旧走既有onSubmit。已有显式References/Mailbox/FileChanges合同继续由调用方拥有，不加页面旁路、全局层扫描、第二搜索状态或新配置。

这是纯UI键盘归属，API/SDK/schema/持久数据/归档事务/模型/执行调度不改；不存在新的调度异常证据。用户/模型原文和附件身份保持。风险为自定义handler优先级、受控value/Memory onClear同步、模型popup的两次Escape、空查询退出、禁用输入、中文和焦点。改后真实验证Archive/设置导航/Release notes非空Escape清空并留页及焦点、下一空Escape退出；实际归档搜索→恢复→原会话/JSON原文，模型selector的清查询/再关闭、References显式关闭和双语。IME（Input Method Editor，输入法）组合态、所有20入口未独立实测时明确保留范围，不以类型或源码分析冒称全部视觉通过。修改前SearchField diff为空。

基线已公开shutdown200，原exec41967/native/launcher均0，物理/输出/请求及精确出生链退休，auth/models副本已清退，0模型调用，原截止余3026979ms。初次类型检查明确指出Solid BoundEventHandler为具有0/1属性的interface而非Array类型守卫可排除的类型；改为先判断function，否则调用其已声明的0/1绑定参数，不加断言cast。首次ui-after虽普通build通过，但未发布任何验收实例；最终另构建ui-after-final并重新typecheck，旧失败回执保留。

## 实施与真实复核结果

唯一生产修改为SearchField自定义键盘处理先行、尊重preventDefault、非空clearable的Escape复用现有clear()；空输入及非clearable继续原处理。最终普通Vite main-BeI-kx44.js和类型检查均0后，10:41:38Z启动自有38356。实际归档搜索同一invoice-791按Esc清空、留页、回显原行和输入焦点（图10）；第二次空查询退出。设置导航搜索archive同样清空留页、完整导航恢复（图11）。更新日志搜索无匹配→Esc清空、74版本恢复（图12）。真实搜索session-data-788→Restore成功，保留原query、成功反馈及0匹配（图13），返回原会话，原JSON/Sources/read5行及真实gpt-6.1-sol回复一致（图14）。

模型选择搜索无匹配→Esc清空并保留弹窗/焦点（图15）；未更换模型。随后空Esc后的稳定状态未在下一次点击前单独记录，不计作模型空查询关闭验收。已有历史的View conversation context是只读dialog，不含引用搜索，未混淆成引用消费者；真实New chat的Skills & squads搜索reference-791→Esc直接关闭并返回原按钮（图16），证明显式调用方所有权保留，未发送或创建会话。简体中文归档搜索→Esc清空留页（图17），空Esc回到中文首页（图18），控件、空态、日期/提示按当前语言。Popup退出过渡中立即DOM可能保留旧层，稳定后续状态和截图确认关闭；没有将这种观察延迟误报为新Rendering缺陷。18张原图已人工查看，只有真实交互/截图用于UI验收，无UI自动化测试。

10:49:02Z主动对自有38356公开shutdown200，原exec68777返回0，native/launcher均0，物理/输出/请求结算，精确出生链退休；10:49:15Z完成auth/models副本清退，原模型目录字节和元数据、认证元数据均保持，截止余2324285ms。实例原定15min shutdown未替换全批11:27:50.953Z固定截止。两次模型请求0，累计仍793。已关闭自有浏览器页；用户18571和其他窗口/服务未操作。

全92表实际逐行比较：788原QA源库116028行完全一致、schema9/integrity=ok；基线归档116060、候选恢复116092行均schema9/integrity=ok。两阶段各新增32行，逐项为delivery6、delivery_receipt6、outbox1、owner1、phase_receipt3、activation lease7/grant7、event occurrence1；现有行仅目标Session的time_archived/time_updated变动。Session61/Message387/Part1161/Goal0均保持原记录，原消息与六个file part完全一致。源附件35文件全部存在，基线副本正常初始化sweep收集4个无任何92表持久引用的旧临时上传（legacy-invalid-788、unicode-be-788、unicode-le-788、readback-original.txt.gz）及其4份metadata；代码attachment-store:1288+/instance:1177当前引用/60sec年龄合同与事实匹配，未向metadata伪造durableRefs。候选复制回收后17+10份，全部27逐字节一致，原附件仍完整；不虚称35候选文件保留。公开材料保留实际计数及归属，私有整库/认证不提交。

证据和截图见[artifact入口](../../artifacts/2026-10-29-archive-goal-journey/README.md)。同步当前面板架构与根Unreleased双语说明，未更新版本/发布。当前页实际构建先于这条Unreleased追加，不宣称其文案也已实页验收。Memory onClear重新加载、FileChanges空query列表交接、IME组合态、disabled与其他消费者未逐一实页重验；明确保持范围，不以类型或静态枚举冒称全部通过。Goal启动/运行/预算/暂停本轮没有重新运行，无调度/恢复/终态异常证据，不触发跨机制缺陷结论。当前docs:check（351 ops/26 groups）及architecture-index（20 documents）均真实0。下一步范围提交、fresh fetch/merge、完整待推集核验及正常push。
