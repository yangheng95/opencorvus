# 371 来源文件保存换行

[Recall与实施前分析](../source-line-endings-plan-371.md)。本轮单agent修复共享编辑器保存时静默统一换行的问题。

改前实际Source打开4文件，Ctrl+Home输入x并Save：CRLF、CR、mixed全部被写成LF，只有LF对照正确。改后同样操作4份全文均等于原始字节前增加一个x。格式信息作为CodeMirror行边界元数据随ChangeSet映射，删除/覆盖的分隔符通过官方invertedEffects参与原生Undo/Redo；无平行全文或撤销栈。

改后进一步实页删除mixed首个CRLF、Undo恢复、Ctrl+Y重做、Undo恢复；新增一行沿用CRLF，其余原LF和CR保留；Undo恢复。仅自身mixed文件的外部写入改为LF而正文相同，真实Reload后Undo/Redo均使草稿正确变脏，Save分别恢复混合/统一LF。最终Undo并保存回x+原混合全文，再点Source正确落在第2行开头。全部过程有完整文件字节记录；界面由实际键盘、点击和人工看图验证。

- `before/01`至`04`：四种输入真实保存，4图人工查看。
- `after/01`至`04`：四种换行保存；`05`至`08`：删除、撤销、重做、新增；`09`至`11`：仅格式重载与撤销/重做待保存状态；`12`：最终Source定位，12图人工查看。
- `checks/runtime-qualification.json`：真实canonical Source/Message/ToolOutcome、完整文件字节、HTTP资源与Provider/Native结果；不含UI自动断言。
- `after/01-saved-files.json`至`09-final-files.json`及`format-only-external-write.json`：各次真实磁盘全文；`final-page-metadata.json`仅辅助记录所见选择位置和实际载入资源。

16项纯Text/ChangeSet序列化正向合同通过，没有EditorState/View、DOM或UI自动测试。类型检查81101及最终15599 exit0；初始构建47563 exit0，随后因优化空事务及整理import再进行最终合同/构建28282 exit0，49.89s，实际页加载main--IPEAIl1.js。最终docs/architecture通过。

before18374/page193，原54003 exit0，Native162056ms；after18375/page194，原30476 exit0，315960ms。每scope预声明600000ms/12请求，实际各5次gpt-6.1-sol、流式HTTP200/EOF，模型真实search_code各产生4Sources并自然stop。两页面、物理进程、输出/请求、端口、临时auth/models对均已闭合，无重开或延长scope。before第一次prepare早于ready而失败，ready后原命令重跑成功；初次使用Ctrl+Shift+Z在Windows无变化，按安装commands公开keymap改用Ctrl+Y后成功。两者保留为操作记录，未改写产品资格。

边界：本轮修复文本保存，不声称覆盖非UTF-8编辑或纯CR搜索行坐标；纯CR实际Source仍为rg的1:10，而编辑器按CR分成4行，留待下一轮统一契约调查。CodeArtifact共享同一实现，本轮实页集中在Source文件编辑，未创建Artifact假数据替代其验收。359首次复制未知及367原请求预算失败保留原结论。
