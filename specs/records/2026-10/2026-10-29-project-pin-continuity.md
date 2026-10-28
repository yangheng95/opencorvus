# 项目置顶后的键盘连续性

## Recall

持续自主体验/修复/验证/提交推送，仅单agent；不再回到已解决的Rendering。上一批是progress：d29a5cbd9已正常推送，fresh sync0/0，项目确认取消和失败归还已实页通过，但图06真实Pin成功后的焦点为BODY。本批解决成功跨分区的焦点交接，并横审匿名项目与两种侧栏组织方式。保留并行176项改动，不创建分支/工作树，不接触用户18571窗口/服务，不发布、不永久删除。

已读777 Recall、WorkLedger全部group/reconcile/reload/排序/Pin/渲染路径、ProjectLedgerGroup现owner、LedgerList/ProgressiveList、行主按钮键盘controller、共享Dialog/Kobalte补丁、ArchivePanel/CommandPalette已有提交后focus合同、07-panel与07-panel-reactivity。全仓搜索updateProjectPinned、isPinnedProjectGroup、work-ledger-pinned-groups及同义focusAfterAction，唯一项目Pin适配器/分区定义在WorkLedger，未命中相关UI测试。Project.setPinned的公开路由接受真实Project identity，与项目类型无关；服务/数据库仍唯一事实来源。

## 根因与影响分析（修改前）

观察：777真实Pin/Unpin成功后BODY。直接触发：isPinnedProjectGroup使同一group从普通LedgerList/ProgressiveList搬到另一For（或逆向），旧ProjectLedgerGroup卸载，更多按钮和子组件action generation一起退休。reconcile按renderKey保留store身份只能保持同一For内部实例，不能跨两个owner保留DOM。旧路径只有菜单默认归还/子组件错误归还，成功路径没有存活的操作呈现owner。

固定分区和十项渐进列表是当前信息架构，不应为焦点把两区合成单列表、强制始终展示所有项目，或用timer重试旧节点。父WorkLedger在两区间存活，且已有同一份完整分页projection和loading/error/current API authority，适合拥有此次已提交操作的焦点意图。它不是pinned的第二份业务状态，不能写入持久化或用于决定业务操作。

横向发现：isPinnedProjectGroup还排除implicit目录，但匿名项目菜单提供Pin，后端同样支持。即使取消排除，Pinned分区projectGroupView的anonymousProjectHeader默认false仍隐藏匿名项目头。需基线实际Pin确认这两个独立条件的组合，未确认前标记待证；如确认则一起沿真实Project.pinned投影修复，保留匿名命名/显示语义。

影响覆盖普通/匿名Project、Pin/Unpin、按项目/单列表、priority/updated/manual排序、渐进折叠、原current API与多项目并发、列表刷新成功/失败/被更新读取取代、卸载/连接改变、用户已移焦点的情况。记录行Pin仍在同一group/For内，当前reconcile保留行身份，不同于跨区；本批不改其业务或快捷键。Task/Mission/Session occurrence（执行轮次）、调度/队列/恢复/终态无变化；当前没有调度异常证据。schema9/HTTP/SDK/LLM不改，无凭据复制、模型0。慢请求与跨连接完整矩阵未知，实测不足时明确保留限制。

## 实施方案

先从已退休777-after逐行备份独立开发38327/ui，当前普通main-DjvNrNiL.js；实页重现普通Pin/Unpin失焦及匿名Pin分区情况，恢复原pinned。截图实际查看。首次启动固定60分钟不续期，每实例10分钟预定shutdown，至少5分钟收拢。

基线确认后，在WorkLedger现mutation适配器建立一个当前UI焦点意图，含API authority、Project identity、目录、目标pin、组织模式与保存/刷新阶段；新操作取代旧焦点意图，旧mutation正常结算。成功ACK后以batch同时进入现reload和刷新阶段；effect等当前真实分页读取loading结束，核对projection已具有目标Project/pinned，再一次性归还。被新读取取代时仍由现loading表示最新projection，不把旧reload返回当成完成；读失败/连接或组织变化即退休，不延后夺焦。

仅document.activeElement为BODY时交接，新焦点拥有者优先。以existing projects-scroll root ref和真实data-project-directory/row-key找当前目标，不缓存旧组件ref、不按翻译标题或DOM顺序猜身份、不加重试timer。当前可见项目头存在则回其主按钮；单列表没有项目头时回该项目当前可见第一条记录。目标在渐进折叠之后时回同一集合的展开按钮；该组织没有可表示条目时回Projects的组织菜单入口。这是当前显示结构的明确focus规则，不展开列表、不选择/导航记录。普通排序与pinned来源保持原实现。

采用[Solid createEffect公开生命周期](https://docs.solidjs.com/reference/basic-reactivity/create-effect)：用户effect与现render/reconcile配合，真实DOM ref是呈现证据；不根据初始effect顺序推定后续DOM必定已提交，须实页核验。匿名排除若确认，则移除排除且在Pinned分区传现anonymousProjectHeader，不新增匿名pinned配置。

改后普通build/typecheck/i18n，开发38328/ui，实际普通/匿名Pin/Unpin后原入口的键盘菜单继续可用、保持折叠；按项目与单列表实际切换并恢复设置，检查单列表Unpin目标；manual排序隐入渐进列表时检查展开控制目标。正常公开停服后Pin仍显示777原详情/回主按钮。仅做可逆metadata，不发送模型请求，不搬目录/永久删除。完整截图、所有旧行/源库/原文件/附件namespace核对、原exec join/public200/native/launcher0/出生链退休/catalog清退；current docs与正常hooks，范围提交/fetch merge/待推集合检查/push/fresh sync，Goal保持active。

基线38327/main-DjvNrNiL.js已实证：图01普通Pin进入Pinned但focus为BODY，Unpin同样BODY。图02匿名Pin后只在Projects顶部显示；图03实际菜单为Unpin，证明真实pinned已保存但分区不接受，确认前述两条件缺陷。两项目已实际Unpin恢复，211关闭。公开shutdown200、原exec9829/native/launcher0、三项与出生链退休、catalog清退、模型0/累计767；最初截止沿batch-deadline.json不续开。Project.setPinned代码进一步证实仅time_pinned变化，明确保留原time_updated，故本批往返预计旧数据全同，而非沿用改名更新时间预期。

焦点交接使用浏览器focus的默认可见性滚动，让跨分区后的新目标出现在侧栏视口；不对远处的新目标使用preventScroll导致“已聚焦但看不到”。不写聊天阅读位置，不主动展开折叠/渐进列表。当前已有渐进显示控制是隐入条目时的明确交接点，缺少表示条目时为同一Projects组织入口，不推测另一个记录。typecheck先行通过，最终普通build在此单行focus选择后重跑。

## 最终真实页面验收

最终普通main-CEbR_tGb.js、开发38328/ui。图04/05普通Pin/Unpin后为新位置主按钮，直接从实际返回焦点Tab/Enter打开菜单；图06–08匿名项目进入Pinned、保留匿名头/Convert to named project，并Unpin回原匿名主按钮。图09/10是切换单列表后仍打开的组织checkbox菜单，需Escape关闭再操作后面的项目；首次locator无匹配来自该modal菜单/快速定向Tab的交互操作，原菜单并未丢失，未将它归咎于业务。图11单列表Unpin后焦点为同项目对话导出体验759，列表仍按当前排序显示。

图12手动排序的首十项不含QA项目。实际Show more→Pin QA→折叠普通集合，图13保留首十项；Unpin后图14焦点为同一集合Show more，原集合没有被自动展开；从实际焦点Enter，图15展开并显示后段项目。图16点击项目头产生真实项目选择并折叠，图17跨Pinned再返回仍为Expand Project journey 773，焦点正确且没有强制展开。随后实际展开项目、收拢渐进列表并恢复By project/Last updated。

通过真实命令面板重新打开原Chat，再切中文，图18匿名项目的置顶区/名称/主按钮与菜单当前语言一致，实际Unpin恢复；图19确认英文、By project、Last updated已恢复。公开shutdown200并join原exec64449/native/launcher0、完成physical/output/request和出生链退休、清退catalog后，图20/21真实Pin失败仍显示777摘要/TypeError原栈，图22关闭后回原Project主按钮。212已关闭。全部22张原始JPEG已实际呈现和人工查看；09在工具组合调用中止后从本地原文件再次呈现复核。

限定：本批实测updated/manual排序，priority未单独循环；空项目分支在后续提交前复核补测（见下节）。慢请求下移焦点、多项目同时Pin、跨连接迟到结果和读取被另一请求取代的完整矩阵未通过真实延迟场景验收，只能确认现API/loading/intent归属代码，不能宣称竞态已全面实测。未执行永久删除、匿名搬迁、UI自动化或模型请求。后续继续较完整产品体验，不把本批局部通过当整个Goal完成。

## 数据、进程与检查

两实例均92表/schema9/integrity_check=ok，103724行全部精确相同，无新增/丢失/变更；Project.setPinned保留原time_updated，全部置顶最终恢复。两源库pre-copy逐行保持，原5文件字节和metadata、两个附件namespace各13文件精确一致。源auth/catalog metadata不变，两个复制catalog均在物理退出后清退，未复制auth。模型0/累计767，启动恢复计数均0。

最初固定截止1793231058068未续开。原exec9829/64449均join0、公开200、native/launcher0、三项收拢、出生链dead_or_reused；最小余量2778564ms。两UI页211/212关闭，用户18571未操作。UI-only呈现改动不改服务/HTTP/schema，不新增源码/DOM断言测试。聚焦typecheck/i18n、两次普通build/renderer实际退出0，最终build为浏览器所用版本；文档与正常push hooks继续完整运行。原类型/build不能代替上述真实视觉证据。

## 提交前边界复核修正

尚未commit的范围复核发现，统一缺目标分支会在单列表空Project（group.items为空）时选择其它记录集合的Show more，与本规格的明确组织入口规则不符。源库只读查询找到两个真实无Session的既有Project：mcp-connection-753与mcp-empty-arguments-754目录，不能因较常见用例通过而保留此偏差。精确修正为：仅按项目模式或确有Project记录时才选择渐进展开，否则直达同一Projects组织入口；不改其它排序/投影、无新数据种子。重新普通build，沿原截止新增38329独立scope，从已退休after逐行备份，用既有空Project验证Pin→切单列表→Unpin回组织入口，同时复核普通项目正向路径，之后完整结算。前22图仍为前一普通构建的真实证据，不伪称已经覆盖该新增分支；最终回执更新为三scope。

最终普通main-BCs5veQK.js/38329实证：从页面真实data-project-directory定位754空Project，图23实际Pin后头部存在、无记录且焦点归属该精确目录。切单列表后Unpin，图24在Show more仍存在的情况下，焦点明确为Organize sidebar。由真实焦点Enter再次打开组织菜单，恢复By project。图27/28复核同一最终构建的普通QA项目Pin/Unpin，焦点仍正确回主按钮；所有pinned恢复、原对话和默认组织/排序保持。213已关闭，原exec90921 join0/公开200/native/launcher0、完整三项/出生链退休/catalog清退；模型0，最小原截止余量1917143ms。三库各92表/schema9/103724行全部精确相同，源库、原文件和三个附件namespace均继续校验。

新增未完成问题：恢复组织后，焦点在By project checkbox时，多次native Escape及浏览器locator.press(Escape)仍保持组织菜单打开；图26显示同时可见的解释Tooltip，图25证明点击原组织trigger可正常关闭。该实证否定将所有此前菜单未关闭都归为工具操作的推定，不能再宣称Escape全面通过。当前只能定位到组织checkbox/Tooltip/Dropdown层级的真实交互，未知是Tooltip重开、库层级登记还是事件取消；下一批应读取共享Tooltip与Kobalte dismiss层及全部生产组合入口，先被动日志确认，不以新焦点timer遮蔽。此问题不改变本批已验证的Pin事实和焦点交接，但必须继续修复；不将标题/最后状态当根因。
