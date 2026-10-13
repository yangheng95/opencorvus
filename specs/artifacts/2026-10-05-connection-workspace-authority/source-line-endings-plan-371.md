# 371 来源文件保存换行

## Recall

用户要求自主持续改善 Sources、UI/功能，最新明确单 agent；旧 goal 的并行文字不执行。370 已完成并推送 a7575c5fc6d952840410bf50ad65dda9c88781c1，随后其他已完成依赖交付将 main 快进到34d470c89，目前工作区干净、与origin/main同步。本轮不改其他交付。已读370 Recall、135混合换行根因记录、当前07-panel、CodeEditor完整同步/输出/定位、FileEditorPane加载/草稿/保存/重载、File read/write和三个其他CodeEditor调用点；全仓搜索lineSeparator/lineBreak/sliceDoc/doc.toString及相关历史与测试路径。未发现本轮相关UI自动化测试。135/136的规范Text比较与369的已完成定位身份必须保留。

## 实施前分析与范围

可观察问题目前待实页确认。代码直接链：后端读原UTF-8文本→FileEditorPane原样draft→CodeMirror默认将CRLF/CR/LF解析为Text行→编辑回调doc.toString统一LF→整份draft PATCH→后端原样原子写入。小幅编辑可能重写全部换行。旧135修复仅保证外部值规范比较及光标稳定，并未处理输出序列化。根因位于共享编辑器的文本边界，所有四个调用点需审查；只有FileEditorPane/CodeArtifact可编辑，另外两处只读。文件revision仍保护真实字节与物理身份，不改后端读写协议。编码损坏另属未验证候选，不在本轮顺带变更。无调度、队列、恢复/终态修改；若实际发现异常按共享机制横审。

CodeMirror官方文档在线403，已读安装的state6.7.1/commands6.10.4源码及公开类型：默认split同时接受三种换行，Text序列化默认LF，commands提供invertedEffects将额外编辑元数据与原生撤销绑定。只设置lineSeparator会改变解析边界，混合换行不适用；简单首换行全量拼接会损坏其他分隔符。候选为保留每个既有行边界的原分隔符并随真实ChangeSet映射，新增行使用当前文件格式，删除/撤销用官方映射effect恢复实际被删除边界；不另存平行全文、另建撤销栈或改变行列坐标。实际证据后再落盘最终具体设计。未知：当前实页保存/撤销结果，混合换行的编辑边界与历史映射细节。

## 真实验收与交付

预先声明独立before/18374和after/18375两阶段，目录source-line-endings-371-before/after，各NativeService固定600000ms、12累计请求，不扩期或重开。既有授权auth和完整models成对私有复制，分别确认usable/projected/actual gpt-6.1-sol streaming。全程单开发agent；模型只真实search_code生成文件Sources，无子agent/任务委托。

每阶段在新隔离project创建CRLF、LF、CR及混合换行的UTF-8小文件。真实/ui逐个从Source打开，键盘小幅编辑并保存，直接核对实际文件完整字节；人工看实际截图，不能用checker替代视觉。改后还验证新增行、删除换行及Undo/Redo、混合原格式回到清洁状态、重载及重复来源定位。只操作自身文件、服务和页面。修改需聚焦正向纯数据合同（不渲染组件、DOM或UI断言），类型、正式构建、docs/check:architecture-index。保留失败的真实结果与完整Provider/消息/ToolOutcome/物理关闭证据，原launcher实际join。最后归档、凭据扫描、范围提交、fresh fetch/merge和待推全部集合检查后正常push，goal active。

## 改前证据与最终实施决定

before18374/page193：真实search_code和完成回复产生4个Sources，逐个真实键盘Ctrl+Home、x、Save。4图已人工查看；完整saved-files.json显示CRLF、CR、mixed三文件全部变为三段LF，只有LF对照等于“x+原始全文”。页面193已关，唯一shutdown和原54003 join均exit0，5 Sol HTTP200/流式EOF。首次prepare在preflight生成前失败，未创建输入；实际ready后重跑原prepare成功，不修改资格。CR文件的search_code按rg行定义显示1:10、编辑器按CR显示4行，这是另一个来源坐标候选，本轮保留证据但不把它等同保存根因。

落实为一个原始行边界元数据StateField：保存每个规范Text换行位置与CRLF/CR/LF分隔符，以及当前文件首个分隔符作为新行格式（无换行默认LF）。它是Text未保留的格式事实，不另存原文或草稿。真实ChangeSet用官方MapMode.TrackAfter保留未删除的换行，插入的规范Text行边界使用该格式。外部值始终用原toText/eq判断正文语义，只有正文变化才替换Text；格式变化通过同一映射StateEffect更新边界/新行格式。序列化从Text行和此元数据输出原始字符串。

历史只记录本次删除或覆盖的分隔符与格式变化，通过commands.invertedEffects加入现有撤销栈；effect携带旧文档坐标并通过官方ChangeDesc映射，不保存整份格式快照，不另建undo栈。元数据单独撤销也需触发onValueChange。聚焦测试只检查Text/ChangeSet到字符串/边界数据的正向合同；不创建EditorState/View、DOM或模拟键盘，不替代实页历史验收。当前4调用点共用同一边界，后端写入和修订冲突合同不变。纯CR来源坐标、非UTF8解码和原359首次复制仍是明确未完成的另轮候选。

改后追加同一已声明scope内的格式重载验收：仅对自身mixed.txt，在完整字节等于已保存“x+原文”后，把分隔符原子地写为LF且正文不变，保存此次外部写入前后全文。通过真实Reload加载，再用原生Undo/Redo和Save验证格式单独变化也能更新草稿并恢复/重做；最终回到“x+原始混合全文”。这不操作用户文件，也不注入界面状态。

## 改后结果与收敛

16纯文本合同通过，81101类型exit0；47563初始build通过后，因空事务优化和import整理重跑原合同及正式build，原28282exit0，49.89s/main--IPEAIl1.js。改后18375/page194实际4个Sources逐个编辑保存，全部文件恰为x+原始全文；mixed删除/Undo/Ctrl+Y/再Undo、新增行/Undo，以及外部仅格式改LF→Reload→Undo/Redo/Undo各次Save均由完整字节验证。16张图全部人工查看，最终重复Source正确选择MATCH371 mixed起始offset0。第一次Ctrl+Shift+Z在Windows无效果，Save disabled的原事实保留；查安装官方historyKeymap后用Ctrl+Y完成原重做验收，未添加产品按键补丁。

before/after原54003/30476实际join exit0，Native162056/315960ms、各5真实Sol流式HTTP200/EOF，无扩期或重开。页面193/194关闭、最终IAB为空、物理/output/request/端口/成对凭据清除；真实checker完整Source/Message/ToolOutcome/字节/Provider/Native通过。精确当前Native生成的5个pile均在进程闭合后按路径/出生事实转私有保管，不动他人文件。现在归档并执行范围commit、fresh upstream合并和普通push，goal active。CR来源坐标与非UTF8编辑依然明确未完成，后续按各自契约调查；不把本轮成功覆盖到它们。
