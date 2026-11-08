# 文件复制后的键盘位置与目标选择

## Recall

持续批次迭代，先根因/影响分析落盘，再有证据实施，真实开发模式/ui桌面交互、截图本人查看、聚焦正向checker（检查器）、范围提交、普通上游合并和正常推送后自主下一批。用户要求“不要用子agent，你自己工作”，本批本人独立执行，不委托。b25提交0207b2134已完成98项339断言及4张截图、普通Unicode文件37/40字节、正常服务退出0；其正常推送钩子进行中。原177项工作区状态完整、暂存空。GPT-6.1 Sol凭据授权尚未收到，继续零模型/凭据。

已读FileExplorerPanel的全部Copy入口（单项、批量）、applyCopyResults/runMutation/refreshFileViews、selection/anchor/row keys/虚拟焦点/现capturePathMutationFocus，以及重命名/单Move（移动）调用。全仓搜索copyFileItem/applyCopyResults/copySelectionsToDirectory/capturePathMutationFocus，定义仅现组件和file-workbench服务；copyFileItem原POST file/item/copy、单一authority（权限代次）和公开FileCopyResult回执。已读共享Dialog的动态returnFocusTarget/当前焦点及可见性保护、app-dialog选项传递、07-panel公开焦点/复制合同、b23已记录但未验的Copy边界。检索到file-workbench-mutation为纯服务/局部transport checker，未见组件渲染/DOM（Document Object Model，文档对象模型）测试，不以它冒称网页验收；不运行UI自动化。

## 根因与影响分析

当前可观察候选为复制成功后的键盘位置与目标选中项可能分离，尚待真实页面确认。直接触发路径：上下文Copy→默认目的路径或用户输入→真实复制→applyCopyResults根据已完成回执选中目标并设置anchor→当前目录/搜索刷新。源文件保留且其row稳定，默认Dialog通常返回原源行；单Copy未接现操作焦点owner。旧b10/b23方案只接rename/单Move，Copy当时明确未验，不能把未处理项当成回归或凭代码断言已坏。

数据/控制流：复制服务与文件字节由原后端单一实现拥有，前端applyCopyResults只根据原回执更新目标选择/展开/缓存/刷新；焦点应使用相同真实回执和已成功刷新，而非复制路径预测或额外假状态。如果页面证实选中目标但焦点仍在源行，ArrowDown/Enter继续操作会从源位置出发，本批作为可证实的体验改进处理。不存在已观察的Task/Mission/Session occurrence（执行轮次）调度/恢复异常；文件UI局部mutation所有权正常，不能据此修改共享调度机制。

全部相关定义、调用点、公共契约、数据、测试、文档和交付：单Copy可复用私有capturePathMutationFocus，无需更改共享Dialog/API（Application Programming Interface，应用程序接口）/服务/数据库schema或持久格式。批量Copy/Move、拖放、新建和删除需分别真实证据，本批不默认接入。现helper已有scope、active、查询、当前loaded刷新、可见尺寸、真实新焦点保护和动态Dialog返回；目标退出搜索时返回原搜索框。用户自己已打开的编辑器/控件必须保留其新焦点。取消、冲突返回原调用者，复制源与目的原文保持。

风险是复制本来应保留源焦点而误改体验、刷新前抢焦点、异步关闭顺序覆盖新焦点、Windows路径分隔符混用以及把源码/服务fixture当成视觉证据。先截图确认选择/焦点和实际键盘继续行为；若证伪则只记录调查，不改产品。若证实，仅单Copy连接现owner，保持原helper和路径身份，不加timer、事件模拟、并行状态或额外抽象；先补实证与定稿后实施。

## 体验和验收计划

本人Temp opencorvus-iteration-20261109-b26，fresh profile-before/after、自有Git项目、私有Git配置；开发服务38970/38971，隔离隐藏页面/ui。普通notes.txt、other.txt、dest/other.txt和Unicode原文，不触碰用户页面/进程/凭据/设备名。基线先用源行Shift+F10→Copy，观察完成选择、实际activeElement的只读DOM信息和截图，再用真实ArrowDown/Enter确认出发位置，不用locator重新聚焦目标掩盖结果。

证实后只单Copy接入现owner；正常构建，真实重验默认同目录、子目录搜索仍匹配/退出匹配、中文原文、取消/已有目的409错误、已打开编辑器的实际焦点保护。范围随证据明确收敛，不把未验的大规模虚拟/慢网scope切换/批量等宣称通过。截图亲自呈现复核，公开文件API与物理原文回读。UI改动不新增或运行UI自动化；必要的服务/纯数据正向检查、类型/双语/正常构建/文档检查只是辅助。保留原177状态，提交/上游普通合并/完整待推审查/正常push后继续单人下一批。

## 基线实证与实施定稿

本人38970/IAB55实际源notes.txt行Shift+F10→Copy→默认notes-copy.txt成功，稳定两次只读观察均为BODY焦点，目标行data-selected=true。01截图显示目标成功/选中但没有键盘焦点；真实原生Down/Return后02截图仍为原列表和BODY，未能继续文件操作。公开GET和物理原文确认源及复制目标均为35字节，正文/CRLF逐字一致（before-source-bytes.json）。原先“源行仍在且可能保留焦点”的代码假设被实际结果修正。

完整控制流根因：applyCopyResults先clearDirectoryCaches清除源/目的parent，源row在required重新加载前也退休；即使逻辑源路径不变，先前Dialog保存的DOM元素也已断开。复制完成选择正确，公共文件服务和后端正常；单Copy没有接入已经用于rename/Move的动态操作焦点owner，不能跨越这一真实卸载/刷新。不能通过保留陈旧缓存、改共享Dialog或延时补焦点遮蔽。

实施仅在copyItem取得现capturePathMutationFocus(scope)，传给原showAppDialog.returnFocusTarget，applyCopyResults取得完整refresh receipt后在原runMutation有效所有权内调用focus.restore(result.path, outcome.refresh, ownsOperation)。原helper、选择、回执、复制、错误与路径规则不变，单一来源；批量/拖放/新建不接入。07-panel公开合同同步单Copy。所有截图本人已查看，页面55关闭、服务session19546正常shutdown退出0。b25已正常push0207b2134，全钩子/密钥0，无远端合并变化。

## 验收结果与交付范围

正常overlay build54.10秒/renderer public surface通过，实际新页面加载main-2QIv37ZP.js。overlay typecheck、2语言2923键、纯server-path checker 53pass/55断言通过；未新增/运行UI自动化。docs:check 352操作/26组及architecture-index 20文档通过，差异检查通过。没有更改非UI服务实现，纯路径检查是辅助，不代替真实视觉。

本人38971/IAB56最终构建逐项实际体验并查看截图：03单Copy后notes-copy.txt同时选中/真实BUTTON焦点；04未重聚焦直接原生Down/Return，正常打开相邻notes.txt及原文；05搜索notes中复制到dest/notes-matching.txt，原Windows反斜杠搜索身份与回执保持，目标行焦点正确；06目标dest/unrelated.txt离开搜索，真实INPUT焦点且其value仍notes；07取消回到notes.txt源行；08已有notes-copy.txt返回真实HTTP409/FileConflictError，Request ID 3acbfe3f-0205-40c9-b051-3df582ef2cd4，错误发生后先观察源行焦点，随后本人展开Details查看原响应。不是以最后错误文案猜根因。

09中文原资料.txt复制到dest/资料副本.txt，提示/控件中文、真实目标焦点正确；10目录dest复制到dest-copy，完成后焦点在目标，原生Right展开目录及4个真实子文件；11复制editor-choice.txt后本人立即点“文件”标签，观察正常notes.txt正文，稳定后焦点仍在本人选择的文件tab。该快速操作未记录请求/点击的精确时序，不能宣称覆盖了慢请求正在执行时的焦点竞争。所有11张截图都已实际呈现人工查看，没有自动截图断言。

after-source-bytes.json对13项源文件/目标/目录副本逐一公开GET200并与物理UTF-8原始字节精确比较：notes族每项35字节/CRLF，中文族每项18字节/CRLF，根邻居18字节/LF，子目录邻居25字节/LF，原数据及文件身份保持。未用摘要/校验和作为功能门槛。页面56已关闭，正常POST /shutdown 200，原session86638退出0，未动用户进程。

本批产品范围仅FileExplorerPanel.copyItem三行接入现私有owner，07-panel合同同步；原helper/API/服务/后端/持久格式未改。批量Copy/Move、拖放、新建/删除、100项以上虚拟窗口、慢网中scope/query/新焦点竞争、脏编辑器完整矩阵本批未验。GPT-6.1 Sol授权尚未收到，模型验收未达成，零凭据/模型；b23空目录搜索及b25持久portable别名升级仍开放。收尾按原177状态/范围提交/普通上游合并/待推全集检查/正常push，自主单人进入下一批。
