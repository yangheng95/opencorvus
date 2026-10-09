# 233 整个侧栏关闭焦点

[实施前Recall、完整分析与方案](../../artifacts/2026-10-05-connection-workspace-authority/dock-dismiss-focus-plan-233.md) / [原始与修复后实际证据](../../artifacts/2026-10-05-connection-workspace-authority/dock-dismiss-focus-233/README.md)。持续仅单agent。

## 问题与当前修复

before-01真实键盘/鼠标Close panel使activeElement落到BODY，header重开仍可见。main唯一可见effect先把focused Dock设inert，没有接续；232只覆盖tab移除/File确认取消。当前effect在inert前把实际Dock/resizer焦点交给可见conversation header；检查当前primary surface、Settings、DOM连接/可见/可用条件，不新增事实来源或异步焦点缓存。

另发现File保持打开时，三个真实Mission Board动作均回到conversation，Settings正常。File effect调用的explicit opener隐式读取primary surface，形成错误依赖，把导航当作新File请求。改用已有Solid on显式观察fileWorkbenchOpen和fileEditorRevealRevision；新/重复Source请求与close沿用原service/opener。全仓调用/上下文路径分析见Recall。原观察中的未知保留，不把它解释为执行调度问题。

## 真实验收

after-01/18164通过原231全90表逐行一致副本，原Session/Project/目录未替换，当前HTML及main-DzTLjY3N.js实际HTTP 200。root自己操作IAB70并人工查看以下画面：

- 原自然README Source Enter打开真实一行文件。Close panel Enter/pointer后焦点均是可见Open right dock；原生当前焦点Return可重开原File/Browser。Browser输入scoped地址保留。
- File打开且Browser选中时，Mission Board Enter显示实际看板，missionBoardTitle持焦点、Dock关闭。Chats返回原conversation，Dock保持关闭；同Source Enter显示已有File。
- header自身Enter关闭保持按钮焦点。Settings显示General/Search，Back to app保持Settings入口焦点。
- 中文深色Close panel Enter/原生Return接续正确；File tab Delete后实际只显示剩余Browser，焦点在该tab。再次Source打开File后，中文Mission pointer仍显示实际看板及title焦点。

截图绑定真实目标区域，DOM只作辅助诊断。file-tab-closed-focus.json遍历到Kobalte的隐藏target，不能当作open-tab membership；截图和真实操作才是该UI结论。未新增/修改/运行UI自动化测试。

首次types发现缺少dialogStore导入，补现有store后原typecheck重跑52116实际0。首次准入脚本误改源路径被只读guard拒绝，修复helper并保留原guard；重复创建不可覆盖guard的错误发生在启动前，未重启任何scope。最终build78322实际0。当前production改动仅main及07-panel契约，没有新Provider请求、model目录或auth移交。

## 闭合与限制

before-01原foreground99197及Native actual0；after-01原foreground46195及Native actual0，physical/output/request完成、独立birth/port/pair闭合。IAB69/70已关闭，只保留用户23/18107未操作。结束13表完整行内容一致，两Project全inventory仅primary .git目录mtime变化，原README保留46bytes。全部checker/observer终态后，精确自己birth的5个pile分别归档；没有删除源数据或重设lease。

Portal菜单、resizer竞态、连接/resource变更焦点、Tauri GUI与活子agent流式Rendering仍未获本轮实际覆盖。此次Web修复不宣称这些矩阵通过。范围提交、fetch/merge upstream/待推送完整集合复核后正常push；持续goal保持active。
