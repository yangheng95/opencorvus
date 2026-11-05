# 工具恢复与读取说明实页证据

本人隐藏IAB页面326/327、两个真实原生开发实例/ui，经独占本地传输代理手工验收；20张原图逐张人工查看。故障条件只物理断开原Question结果GET，其余请求真实转发，页面保持在线，不伪造结果、不注入消息/状态、不重新执行工具，没有UI自动化。用户18571及现用窗口/进程/数据库未操作。

三次真实按钮成功有点击时间、代理/原生请求和200/8325字节回执，原4问、输入/输出/回答完整相等；这次补齐946明确未覆盖的在线按钮成功。新发现并修复的是中文读取正文末尾仍直接显示英文服务说明：现在与标题共用原ReadToolResultFacts格式化当前语言范围，原文通过既有ToolPayload明确提供。资格见[qualification.json](qualification.json)。

- [01-original-chinese-online-question-history.png](01-original-chinese-online-question-history.png)：原927中文在线历史及四问数量；本图只有前两答可见，不冒称四答同屏。
- [02-chinese-tool-read-failure-while-page-online.png](02-chinese-tool-read-failure-while-page-online.png)：保持页面在线、只物理断开原Question结果GET后显示中文失败/重试；同图暴露读取说明仍直接英文。
- [03-connected-path-restored-error-retained-before-click.png](03-connected-path-restored-error-retained-before-click.png)：恢复该路径转发后，原页面错误仍保留，尚未点击。
- [04-chinese-explicit-retry-loads-original-result.png](04-chinese-explicit-retry-loads-original-result.png)：实际中文点击后恢复原输入/输出入口；输出不全在本图视口，完整相等由真实服务回执另证。
- [05-english-tool-read-failure-page-online.png](05-english-tool-read-failure-page-online.png)：重新中断后本人刷新获得英文失败，页面仍在线。
- [06-english-connected-path-restored-error-retained.png](06-english-connected-path-restored-error-retained.png)：恢复路径后英文错误仍保留，尚未点击。
- [07-english-explicit-retry-loads-original-result.png](07-english-explicit-retry-loads-original-result.png)：实际英文点击后恢复同一原结果；只证明本图可见部分。
- [08-after-chinese-read-summary-and-original-note-entry.png](08-after-chinese-read-summary-and-original-note-entry.png)：新版本中文读取结果9行，原始读取说明默认折叠，Question结果读取错误在下方。
- [09-after-original-read-note-remains-verbatim.png](09-after-original-read-note-remains-verbatim.png)：实际展开原始说明，End of file/total9原文完整保留。
- [10-after-connected-new-summary-error-awaits-click.png](10-after-connected-new-summary-error-awaits-click.png)：新版本路径恢复后，错误仍等待明确点击，中文读取摘要保持。
- [11-after-new-build-explicit-retry-restores-original-result.png](11-after-new-build-explicit-retry-restores-original-result.png)：实际新版本重试成功，原Question输入入口恢复，完整结果由第三份真实回执核对。
- [12-after-english-read-summary-and-original-note-entry.png](12-after-english-read-summary-and-original-note-entry.png)：同一读取切英文，Read result9lines和Original read note入口正常。
- [13-after-english-original-read-note-expanded.png](13-after-english-original-read-note-expanded.png)：实际展开英文原始说明，原文保持。
- [14-after-english-partial-window-and-original-offset-note.png](14-after-english-partial-window-and-original-offset-note.png)：真实部分读取：英文37—191/总365与原始offset192说明同屏，文件尾部原内容保持。
- [15-after-chinese-partial-window-original-note-open.png](15-after-chinese-partial-window-original-note-open.png)：切中文后第37—191行/共365行与原始说明同屏，原文件英文内容不翻译。
- [16-after-chinese-partial-window-original-note-collapsed.png](16-after-chinese-partial-window-original-note-collapsed.png)：收起原始说明后中文实际范围保持。
- [17-after-reload-partial-summary-and-original-note.png](17-after-reload-partial-summary-and-original-note.png)：本人刷新后重新展开，中文范围和完整原始续读说明一致。
- [18-after-original-eight-file-review-and-line-counts.png](18-after-original-eight-file-review-and-line-counts.png)：实际加载原八文件审阅，56新增0删除/8—8及首条原比较。
- [19-after-reloaded-read-summary-and-question-count.png](19-after-reloaded-read-summary-and-question-count.png)：返回原927后读取摘要9行、原四问工具数量可见；本图没有显示四答。
- [20-after-four-question-count-and-four-real-answers.png](20-after-four-question-count-and-four-real-answers.png)：实际收起工具组后，原四问数量、四项真实回答和八文件摘要同屏。

一次8包类型、一次普通Node构建main-B82aJgGR.js与文档检查通过；36业务检查点、原936/939各3次及940两轮共6次事实核验通过。2原生原句柄exit0/公开关闭200、2传输代理原句柄正常停止exit0，物理输出请求结清，4配对认证/完整模型目录副本退役，新模型0/累计1440。303669→303671→303673原行/业务内容、源库/120项目/110配置/289附件元数据及文件/Git保持，schema10/92表不变，最终退役预留2399192ms。

空文本/字节截断、独立Task/侧聊、剪贴板发送和瞬时loading没有独立视觉证明；metadata.browser原样本0，未修改截图分支。故障是本人受控传输中断，成功结果来自真实服务，不将它伪称原生故障或自动重连成功。
