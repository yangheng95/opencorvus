# 文件操作忙态与键盘恢复

## Recall

继续自主迭代整个opencorvus的UI（User Interface，用户界面）、UX（User Experience，用户体验）和功能，只用当前单agent（代理），不重新调查旧Rendering闪烁。旧Goal（目标）的多Astra描述由用户后续单agent要求覆盖。上一轮5a7b13a9f增加真实磁盘/基准版/草稿只读比较，19原图、类型/语言/构建/正常推送全部通过，2026-10-27T10:50:55.780Z重新fetch/merge（拉取/合并）后main/upstream同提交、0/0，31本轮文件清洁，176项他人工作区变化保留。711/712/713均已结清和退役目录副本，模型累计353。

本轮从当前原保存/恢复流程继续找问题，不操作用户18571、数据库、窗口/进程，不委托、不建分支/工作树、不改schema（数据库结构）9或发布。已经读取当前FileEditorPane完整保存、重载、下载、关闭、离开决定、归属/代数和渲染，共享Button/Dialog/CodeEditor、原API（应用接口）路径、07-panel焦点/修订合同、644/645失败反馈与711–713比较规格。全仓搜索原disabled/aria-disabled/aria-busy消费者、相同焦点实现、相关历史；当前文件编辑原生禁用随请求忙态变动，没有操作焦点恢复。ArtifactActions和UsagePanel已使用原Button的ARIA（Accessible Rich Internet Applications，可访问富互联网应用）忙态与原入口守卫，CSS（层叠样式表）本来支持aria-disabled。范围内overlay/test未发现FileEditorPane UI自动化，不新增/运行。

上轮712/713真实UI保存失败后观察到焦点落到BODY（页面根节点），包含普通Save及未保存框Save；当前HEAD仍为同一源码。先用714当前发布实页确认键盘触发、失败后Tab顺序及下载/重载，保留实际原图，再定实现细节。W3C（万维网联盟）APG（无障碍编写实践指南）的[禁用控件可聚焦原则](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#focusability-of-disabled-controls)说明native disabled会移出焦点顺序，需可发现的操作可用aria-disabled保留焦点；该资料是设计依据，产品是否修复必须由真实页面证明。

## 修改前分析与验收方案

可观察现象为保存错误和原草稿可读，但键盘起点丢失；上轮没有把它当作闪烁或数据丢失。直接触发是save先setSaving(true)，头部Button的disabled包含isBusy，保存确认的三个按钮disabled包含leaveSaving。浏览器因此撤销原生焦点，操作失败后原按钮重新可用也不会自动获得焦点。与新比较刷新相同机制，但比较已在5a根治，不能当成新复现。旧644/645修正文案/语言、707/708修正主动取消反馈、711–713添加比较，都没处理保存原生忙态。

影响分析：保存两个入口共享save、条件修订/原子写和具名错误；重载/下载也把自己的请求忙态用于native disabled，存在同类候选。close/compare在其它操作时不可用，未发现它们自行进入请求导致焦点丢失的新证据。共享Button是原生透传，不全局改它或Dialog，不添加自动focus补偿/第二焦点store/计时器。真正资源未就绪、只读、导航预留仍保持原准入。请求入口必须继续由现saving/reloading/downloading/leaveSaving判定进行中，不能让aria-disabled仅作外观。成功Save后clean（无未保存变化）的语义另需明确：是否保留Save可发现焦点、下一次Tab能到比较/编辑器，不能仅失败通过便宣称全生命周期完成。成功离开仍交给原导航目的地和Dialog关闭焦点；不得抢回旧编辑器。

当前错误是可见按钮原生焦点语义，尚无调度/队列/Session执行轮次/重启恢复异常证据。修改不涉及后台/API/SDK（软件开发工具包）/持久数据/模型/配置；条件写和公共文件权限保持。若实际发现重复提交或执行异常，须立即横向审计共享生产机制。纯UI交付只用真实交互、截图及人工复核；静态/类型不能代替。

714/38219从关闭713只读整库备份，校验92表原行/schema9、7147关键事实/166旧文件；复用当前main-DnfRmDOe.js，0认证/模型请求。仅在自有A项目新“键盘恢复714”目录设原A，真实编辑D后外部保留原件并移走以触发404；以实际键盘Enter保存、查看焦点/下一次Tab及未保存框重试，再恢复原A使UI显式保存成功。下载真实草稿逐字节核对，无删除。十分钟关闭目标、原20分钟物理边界/至少五分钟结清，关闭自建标签/公共shutdown（关闭）200、同原exec（执行句柄）和native（宿主）/launcher（启动器）终态0、物理/输出/请求结清、目录副本退役，不重启重置时间。

714后补齐实证与实施定案，然后715/38220普通Node构建实际复核头部Save失败/成功、Ctrl+S编辑器焦点、未保存框Save失败/Cancel返回/成功离开、重载/下载及当前中英/主题。保留真实原输入/草稿字节和原关键历史，三索引/当前架构同步、聚焦类型/CSS/语言/构建/docs（文档）检查、范围提交、最新上游合并和完整待推提交审查、正常push（推送），整体Goal继续进行中。

## 714实际基线及实施定案

真实文件输入D后将本轮原A移动保留，头部键盘Enter保存404，错误和完整D保持，焦点确为BODY（01）；实际下一次Tab到Compare with disk，不能误称一定跳到全局导航。未保存框Enter Save同样404/BODY（02），Cancel仍正确返回原Close file按钮。恢复原A后键盘Save成功D74字节，clean Save变原生disabled并同样丢失焦点；Reload从请求到完成也为BODY（03）。真实8字节二进制下载完成后焦点BODY（04）。不是只根据一个错误标题推测：同一原disabled渲染调用、真实键盘输入、完成状态和浏览器activeElement均支持共同根因。

确定修复只改FileEditorPane：从现loading和资源身份派生resourceReady，原isBusy继续由它和saving/reloading定义；资源未就绪/导航预留保留native disabled，请求短暂忙态用现Button支持的aria-disabled/aria-busy。保存无改动时仍保持可发现的Save焦点、ARIA明确不可执行，save既有dirty判断仍返回而不写入。保存/重载/下载/比较各自原guard保持；Close显式检查原忙态/预留再调用原离开准入。确认框Cancel/Discard在leaveSaving时由原状态guard拒绝，Save仍走原saveAndLeave守卫。所有当前文件动作一并消除相同原生瞬时禁用触发，不改共享Button/Dialog/CSS，不写focus补偿，不添加派生状态副本。成功保存留在同一Save，成功离开继续原目的地归属，Ctrl+S原编辑器继续持有焦点。

715需实际验证上述完整生命周期及readonly下载、重载；不能用ARIA属性或类型通过替代焦点人工复核。原714自建标签98关闭、shutdown200、原84070/native/launcher均0、物理/输出/请求结清、余量1045436ms，92表240229源行/7147关键事实/166旧文件保持、0请求、累计353；原件回置为明确自有输入，不是产品自动恢复。

## 715实际验收与交付

最终普通构建main-BT_sDM31.js在开发CLI/38220/ui实际运行。原件A移走保留后，真实头部Enter Save 404保持D及Save焦点（05），未保存框Enter Save 404也保持该按钮（06），Cancel完成关闭后焦点回原Close file。恢复原A后Save成功74字节D，连续两次原生回车仅一笔成功写入，clean Save仍可聚焦并ARIA说明不可执行（07）。原被动Server请求日志第一阶段共3笔实际PATCH /file/content，与两次404/一次成功吻合，没有修改响应/网络/组件或增加测试端点。

原Reload加载中及完成后均保持同按钮焦点（08）。真实Ctrl+A输入新正文、Ctrl+S保存，编辑器焦点与内容保持（09）；再次输入离开前草稿，确认框Save成功关闭，目的地Explorer页签获得焦点（10），实际磁盘77字节逐字相等。正文与头部各一次实际8字节下载，两份与原件逐字节相等且保持各自焦点（11–12），中文浅色完整显示。实际重开77字节最终正文，通过原生Shift+Tab到无改动Save再回车，控件焦点/状态保持（16）；总5笔实际写请求和2笔下载匹配全部动作。

初次工具fill发生在编辑器打开期间，实际结果为D追加A，未提交任何保存；明确用Ctrl+A及原生文本输入改为预定D后再继续，不将自动化输入实现差异归因产品。对clean Save的locator.press被工具ARIA启用检查正常拒绝（DOM原生disabled为false）；之后采用实际Shift+Tab/回车完成验收，没有改产品ARIA或绕过原save守卫。Cancel首次读取仍在Dialog关闭生命周期内，随后同一页面实际闭合并回到原Close，不把中间快照当失败或重启。

最终页面还发现独立实际搜索问题：Windows输入“键盘恢复715/恢复.txt”没有结果，相同反斜杠路径和文件名找到原文件（13–15）。本轮只完成焦点根因修复，不将该差异称为已解决；下一批读FileExplorerPanel.searchFiles→find/file→File.search及全部调用，查清路径规范化归属后修复并实际验收。未进行慢网络晚响应/切换连接竞态，不能宣称这些已经通过。

715关闭标签99、shutdown200、原83436/native/launcher均0、物理/输出/请求结清、余量705104ms；源92表240246原行/7147关键事实/166旧文件及项目A19旧文件保持，目录副本退役。额外按rowid/完整主键逐行核对714/715目标92表240229/240246原行全部保持，schema9不变、0新模型请求/累计353。类型、CSS、语言2585键、普通构建和文档351操作26组均0，原大资源块及第三方use-client提示保留。[16原图和运行摘要](../../artifacts/2026-10-27-file-editor-action-focus/README.md)已实际复核。只提交当前UI/架构/规格和本轮索引行，保留176项他人变化，最新上游合并后审查完整待推集合并正常推送。Goal仍进行中。
