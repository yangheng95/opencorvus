# 项目菜单的操作反馈与焦点归属

## Recall

用户要求持续自主体验、修复并实际验证后提交推送，仅单 agent；Rendering 已解决，不再以旧症状代替产品体验。本批接续已推送 c51da108d 的明确未完成项：项目菜单重命名取消后焦点落到 BODY，以及项目操作失败只记诊断。保留所有数据与并行工作，不操作用户 18571 页面/进程，不新增分支、不发布。

已读 ProjectLedgerGroup 完整菜单、WorkLedger 分组/置顶、main 项目 rename/promote/delete/open/select 与 runMainAsync/runUserNavigation、AppDialog 公开呈现合同、sidebar.css、776 Recall 和当前 07-panel/07-panel-reactivity。全仓搜索 ProjectLedgerGroup、各项目回调、runProjectAction 与 updateProjectPinned：唯一生产 ProjectLedgerGroup 消费者为 WorkLedger，main 为回调提供者，未命中另一实现或相关 UI 测试。本批不新增或运行 UI 自动化。

## 根因与影响分析（实施前）

可观察事实：776 图21真实项目重命名取消后为 BODY；当时将旧 trigger 称为“退休”并未证明物理卸载，本批纠正此证据边界。CSS 显示 project-group-actions 在无 hover/focus/menu 时 visibility:hidden，项目主按钮始终显示。直接触发是菜单启动 modal 后菜单关闭、焦点离开项目组，隐藏的更多按钮成为默认归还目标；是否仍连接及具体可见性须基线页面确认。

错误控制流已明确：ProjectLedgerGroup.runProjectAction 只 reportError；main 的 open/rename/delete 由 runMainAsync 吞错，select/create/promote 经 runUserNavigation 再吞错；WorkLedger.updateProjectPinned 也 catch 后只记诊断并 reload。外层即使增加可见错误也收不到被吞 Promise。776 只修了行与标题操作，没有覆盖项目入口，原共享错误对话框和明确 returnFocusTarget 可复用。

影响面为项目导航/新对话/置顶/打开目录/重命名/匿名项目命名/删除确认的 UI 异步归属与焦点。业务服务、HTTP/SDK、数据库 schema9、任务/使命/会话 occurrence（执行轮次）、重试/恢复与 Provider 请求不改；不进入不可逆删除，不打开系统目录选择或资源管理器。并发连接变化、项目组卸载和 pin 重排会退休原呈现所有者，迟到错误不能打开新范围弹窗。原导航 AbortError 与 ApiAuthorityChangedError 保留正常取消语义；不引入调度/工具选择 gate。慢请求完整矩阵未知，不宣称覆盖。

## 实施方案

先从已正常退休的776-after7做 SQLite 在线备份和逐行校验，独立开发38325/ui，当前普通 UI 构建；无 auth 复制、模型调用上限0，完整模型目录仅投影历史身份。实际打开项目菜单→Rename→Escape，只读观察 opener、主按钮和当前 focus，截图人工复核；再正常公开关闭自有服务后实际 Pin，确认静默链路。

基线确认后，项目组件使用现有 API authority + directory + 生命周期作为单一呈现 owner，统一 async runner 保留诊断并显示共享本地化错误，复用已有 work_ledger 失败摘要与原详情。busy 仅防止同一组件重复提交。项目主按钮通过已有 groupHeadRef 查找，不新增平行 focus 状态。重命名/命名/删除确认回调直接透传 AppDialog 已有 openingGuard/returnFocusTarget，归还给可见主按钮。WorkLedger 项目 callback 类型取组件公开类型，main 直接返回业务 Promise；置顶不再吞错，当前连接下重抛原错。与任务/会话无关的原 wrapper 保持原合同。

改后普通 build/typecheck/i18n 与真实开发38326/ui：键盘项目菜单、Rename 取消/Escape、保存同一名称/修改并恢复，置顶/取消置顶，删除仅取消；公开关闭后双语 Pin/Open-directory 失败、原技术详情、关闭回主按钮并可重新开启菜单。实际未覆盖项如实列出。每次截图都查看，不以 DOM 或检查分数代替视觉验收。

本批首次启动固定60分钟截止，实例10分钟预定正常 shutdown，至少5分钟收拢；原 exec join、native/launcher0、公开200、physical/output/request 与出生身份链退休后清退 catalog。检查源库逐行、原5文件字节/metadata、附件命名空间逐文件，模型0/累计767。补当前架构、Unreleased双语、三索引、真实产物；跑当前检查和正常 hooks，范围提交/fetch merge/审查待推集合/push/最终fresh sync，Goal继续 active。

## 基线实证与范围校正

38325图01重命名输入正确；Escape后图02/只读DOM观察 active=BODY，dropdownmenu-cl-266-trigger connected=true、rects=1，但实际 locator.isVisible=false，且AX省略该按钮。由此确认是CSS隐藏而非卸载，使用始终可见的项目主按钮归还。公开shutdown200、原exec13315/native/launcher0、全部出生链退休，catalog清退、模型0后实际Pin，图03只有“Update failed. Showing previously loaded items.”和独立Goal读失败，没有原操作反馈；不将列表reload错误称为完全无界面错误。209已关闭；最初截止1793229795891固定。

进一步调用链证据：openDirectory 在浏览器执行 Copy path，与服务在线状态无关；它已经捕获 reveal 错误并显示 nativeMessage。不能伪造“停服即可打开目录失败”用例，也不应调用系统 Explorer 或污染剪贴板。本批仅保留其真实 Promise 转交统一 runner，既有路径提示弹窗焦点未验证，后续单独处理。其它 workspace openDirectory 调用为 TaskDirBar 两处及 WorkspaceEditorLaunchers，本批不改其公开合同。匿名项目命名只验证取消，不进入目录选择/搬迁；Remove project 仅验证取消，永久删除未执行。

实现将三种项目对话框 presentation 定义为现 AppDialogOpenOptions 两个字段的 Pick，不另建呈现协议；WorkLedger 直接引用组件回调类型。所有组件入口统一 busy/authority/directory/generation；主按钮保持可聚焦并在busy时忽略重复点击，避免对话框关闭时尚未完成Promise finally而拒绝焦点。更多和新建按钮在忙时禁用。置顶原服务与reload仍唯一数据源，错误直接交组件，不重复诊断/reload遮蔽原错。导航AbortError按原语义静默取消，其余当前owner错误显示原详情。

## 最终实页验收与限定

普通构建main-DjvNrNiL.js、开发38326/ui，图04捕获关闭动画中间帧，图05明确完成后焦点在Project主按钮，随后菜单可再打开。实际Pin→Unpin、项目名Project journey 773→777→773均成功，图06/07是独立置顶与改名投影；保存改名后也回主按钮。图08/09仅打开并取消删除确认，初始安全焦点为Cancel；图10/11匿名项目命名仅取消，回原匿名项目主按钮，没有目录选择/搬迁或删除。

预载双语后正常公开shutdown200、原exec67863/native/launcher0，再实际点击Pin。图12/13英文摘要和完整TypeError: Failed to fetch，默认焦点OK，Details→Tab→Enter后图14回Project主按钮。图15/16中文同样保留技术原文，图17回主按钮，图18原菜单再次可操作。图19停服后的中文Rename保存失败保持输入“只验证失败777”及原位错误，没有第二个失败弹窗；Escape后图20和focus-observation.json确认回原Project主按钮。210已关闭，所有截图实际呈现并人工查看。

发现但本批未完成：Pin/Unpin成功跨Pinned/Projects分区会重挂项目组，真实AX为BODY；图06记录该成功后焦点缺口。当前回调的旧owner退休是正确的，但新位置的键盘连续性仍需通过分组稳定身份另行修复，不能用旧owner强抢焦点。本批完成的是当前项目对话框及失败归还。Copy path的既有提示焦点、跨连接迟到结果/慢请求矩阵未实际验证；永久删除与匿名搬迁未执行，不宣称这些端到端完成。

## 数据与运行结算

两实例均92表、schema9、integrity_check=ok；基线103724行全部精确相同。改后103724行中103723精确相同，唯一变化是同一QA Project的time_updated，名称与pinned恢复原值；无新增或丢失行。两源库全部pre-copy行精确保留。原5输入文件与附件命名空间逐字节/metadata核对，源auth/catalog metadata不变，两个catalog副本均在物理退出后清退。模型调用0、累计767，启动恢复计数均0，未使用auth。两原exec分别13315/67863已join0；公开200、native/launcher0、physical/output/request与完整出生链退休，仍有至少3245038ms原截止余量。

UI回调/呈现改动未修改非UI服务、持久格式或HTTP契约，因此不新增UI/源码断言测试。聚焦类型、双语、普通build/renderer已0，另运行当前docs:check与正常提交推送hooks；保留并行删除和索引调整。完整待推集合检查、fresh merge与最终同步证据保存在本批私有交付回执，不生成Release/tag。
