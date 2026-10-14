# Sources多来源与长文件身份迭代

## Recall

用户要求继续自主迭代，只使用单开发agent。上一轮8cee8fd64已推送；Rendering现存修复在真实流中切换/重开通过，本轮不重写已验证路径。主要复核多来源展开、长文件身份、复制和准确文件跳转。开始工作区只有.bun与packages/opencorvus/bun两个非本任务未跟踪目录，保留；不创建branch/worktree，不操作用户窗口。

## 修改前分析与搜索

已读取420 Recall、SourceParts完整实现、CardParts的citationRenderRuns、messages.css来源样式、Tooltip/Disclosure公共primitive、file-workbench打开路径以及07-panel与07-panel-reactivity公开合同。根组件按真实Source身份keyed，额外来源原生details折叠，打开/复制独立，文本与行号不改事实。Tooltip共享primitive已有overflow-wrap:anywhere，不能把长标题溢出当成未经证明的bug。文件目录caption目前只允许自然换行，URL有两行clamp；长路径可能过度占据窄侧栏，但尚未实际复现，不先打补丁。读取失败的文件面板有自己的公开错误合同，不能仅据Source打开catch的日志判断静默失败。

检索到SourceParts只有CardParts共享入口，源码类型来源是SDK SourceFilePart和tool/source；本轮只改UI时不改Provider/工具/持久化/数据库、调度或公共API。grep.ts的search_code生产工具可对真实文件多命中生成多条Source。本轮准备的隔离真实文件含两行界面测试材料，不写假消息/Source/数据库。当前仓库较420只改overlay版本元数据，Sources源码相同，可先复用420正式UI bundle查看before，修后Node重新正式构建。没有UI自动化测试，工具路径检索到workspace-source-resolution.test.ts并非本轮UI目标，不运行或扩大扫描。

## 验收与实施方案

用原412隔离数据和一个既有普通主会话，通过真实用户输入让gpt-6.1-sol自身search_code检索source-reading目录中的真实材料；不委派、不新增产品子成员。正式开发服务/ui、自有页面CUA真实操作与截图人工复核，多来源展开/收起、长文件名与完整目录、单个Source复制、实际文件行号跳转以及当前语言。发现明确缺陷后补齐触发/数据流根因/影响/方案再改当前唯一实现；修后用同一持久事实正式构建复验。

每scope Provider预检auth+models配对、目标catalog投影与实际模型完全一致，累计12实际流调用、180秒无活动、NativeService600秒有限资源。构建在启动前完成。页面采集后立即公开shutdown并join原启动/发送句柄；physical/output/request收尾、精确OS身份、端口与复制配对退休全部核对。禁止UI断言/快照/Playwright test；类型/构建不能代替截图。

修改只纳入本轮相关源码、唯一架构合同、记录与原件，更新三索引、运行当前docs/checks，范围提交、freshfetch/merge、完整待推送集合复核、普通push；不发布版本。

## 实际发现与实施决定

before真实页面1（浏览器2）已有主会话实际发出一次search_code，两个真实命中保留同一长文件的第2行第11列与第3行第15列。展开后实际打开第二来源，右侧文件工作区准确高亮第3行。01默认宽度、02打开文件瞬间、03清晰窄正文的原图均已人工查看。03中完整目录caption占3行；被动几何观察为406.79px宽、48.59px高、16.2px行高，原始caption长度和文本保留。用户实际打开文件会自然缩窄正文，这一常见工作布局中辅助目录过多占高，挤压来源列表与回复空间。

直接触发是现有源文件目录自然换行；数据流根因是相同SourceChip的URL副标题已有两行clamp，文件副标题没有使用这一现有布局合同。先前文件名ellipsis及同文件目录去重分别解决横向长名与重复目录，未约束首来源目录纵向占高；占位/渲染生命周期与此无关。Tooltip共享primitive已正确换行，实际02也证明完整文件名/路径/摘录可读，不修改提示系统。

决定将现有URL的两行caption规则移动到共享msg-source-chip__detail，文件目录和URL均使用同一呈现合同，同时删除不再有独立样式职责的URL专属location class。只改变辅助文字布局，原文、title、aria-label、URL、Source identity、范围、复制和打开调用保持实际完整值；附件短副标题同样适用且正常一行。无新增配置/状态/迁移/调度/接口或文案。同步07-panel公共UI合同，Node正式构建后用同一持久Source再次实际复制、跳转、展开/收起；不用UI自动化测试验证。

before已公开shutdown e3b113 exit0，原67256 join5a6b10 exit0，精确native physical/output/request和配对退休完成，页面关闭后再构建修复版本。原一次滚动目标被SVG遮挡失败保留，随后根据新截图改用正文内实际坐标完成滚动，不伪称第一次操作成功。

## 修后真实验收与限制

Node正式构建95275 joinfddc58 exit0，49.56秒；存在第三方use-client和大chunk警告，未描述为无警告。自有18563/ui页面2读回同一持久会话，不新发业务消息。04打开第二来源，05清晰窄正文截图中同一目录收敛两行；原文相同、观察宽度同为406.79px，caption由48.59px变32.40px。这个几何观察仅辅助描述实际视觉，computed-style桥接未暴露lineClamp字段，不将该字段当通过判据。图04/05实际文件工作区的第3行高亮，正文、第二来源L3:15及独立复制按钮可见；第一来源仍L2:11。

底部Collapse sources实际收起并将焦点返回原生summary，空格键再次展开，06真实显示第二来源与原生焦点。07实际点第二来源复制后出现check/Copied反馈。完整剪贴板粘贴链**未达成**：两种文档允许的Control+V调用均报告虚拟剪贴板无数据，tab clipboard readText为空；产品Edit只提供Search/Providers，输入框右键未暴露Paste。保留这些工具边界，没有改用shell读系统剪贴板、写虚拟剪贴板冒充真实复制、修改产品复制实现或宣称粘贴成功。页面没有产生路径草稿或额外发送。当前范围仅布局，复制text生产函数与完整路径/行列合同未改；07只能证明实际按钮反馈。

另一次DOM button角色定位原生summary未命中，改用最新AX控件成功，不修改原生语义来迎合工具。原浏览器4句柄在新工具会话不可用、重绑定的声明错误及原结果以显式转录边界记录，不冒充后端原始导出。7张图均人工查看；没有新增、运行或修改UI自动化测试。当前界面为英文资源，模型/文件原文中文保真；此改动没有产品文案或新增翻译项。URL副标题沿用完全相同的现有规则，未在本轮生成新的网页来源，不能把这次文件体验说成网页来源的新端到端验收。

生产只读事实：主Session ses_-zURzTlJFzzacrP6FufN；实际search_code工具prt_g0VY1Uan700LaQY4jgg5产生Source prt_g0VY1Ub7900I1xQP4VFx和prt_g0VY1Ub7B00zH8G197kZ，真实范围2:11和3:15分别保留，最终自然finish=stop。before5条、after2条真实Provider流（含预检与普通memory），全部gpt-6.1-sol/streaming/HTTP200/settled/eof；没有新增产品子成员。当前持久schema仍2，本轮未改数据。

after公开shutdown e5efa4 exit0，原18257 joina88067 exit0，两scope physical/output/request、精确OS实例退场与auth/models配对退休完成。两自有页面均关闭，原数据保留。docs-check.log与architecture-check.log对应当前命令实际exit0，Git正常hook仍将复验。完整原件及本轮边界见[证据](../../artifacts/2026-10-14-sources-reading-iteration/README.md)。
