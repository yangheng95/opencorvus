# 263 只读来源键盘入口与重开缺陷

[Recall和完整修改前分析](../source-range-plan-263.md)。当前完整原262历史、90表直接全部存储行相等复制、原真实主Session和两个read Source，没有新消息/来源/任务/成员或Provider请求。新资格schema无漂移、两项目memory无pending/organizerLease、持久恢复入口与未完成tool/provider/bus均0；285条租约只有原runtime_process永久声明未按时间过期，其精确出生已结束，其他租约/容量已到期。

发现并修复共享CodeEditor只读焦点入口：原关闭editable后内容是不可聚焦div，aria-readonly仍true；打开Source后焦点停在引用按钮。03 AX定向键盘准备失败且没有发键，04鼠标点击/全局Ctrl+Home虽改变浏览器滚动，但焦点是BODY，不能冒称编辑器键盘成功。依据[CodeMirror官方只读说明](https://codemirror.net/examples/readonly/)，在唯一readOnly compartment的contentAttributes为只读内容加tabindex=0，保留两层禁止编辑和所有Source/文件权限。共享使用处为FileEditorPane/CodeArtifact/TextPreview/Notebook；其他artifact视觉矩阵未验。

原CodeEditor身份join中有真实NUL（Null character，空字符），Git视为二进制；只改为源码\\0表示，运行时同一分隔。旧HEAD和本任务焦点修改后的原字节表示、重写前diff保留在私有目录，现Git归一行尾为LF（Line Feed，换行字符）。语义审查使用git diff --text --ignore-space-at-eol，实际只有只读tabindex和等价分隔表示，不引入第二实现。

最终main-DpnD4XG1.js、CodeEditor-D2Ibwtez.js。本人实际查看：[06 Source打开](history-01/06-fixed-source-open.jpg)定位206并焦点Editor，辅助实际属性readonly=true/editable=false/tabindex=0；[07键盘Home](history-01/07-fixed-home.jpg)到行1；[08同一Source](history-01/08-same-source-return.jpg)重新定位206；[09末尾](history-01/09-range-end.jpg)高亮结束224、225起正常背景；[11实际编辑器搜索](history-01/11-editor-search-result.jpg)查到27行citedReadRange，Escape返回Editor；[12 Tab入口](history-01/12-tab-editor-entry.jpg)从Close workspace前后Tab实际进入Editor；[13另一Source](history-01/13-first-range-fixed.jpg)显示27–37范围。正文未输入/修改/保存，原文件完整内容与metadata相等。

**面板重开仍失败，不能称本轮范围全通过。** [16首次重开](history-01/16-same-source-dock-reopened.jpg)停在225附近、焦点Source；首次页面立即关闭，稳定结果未知，故在同一原生服务另开自己110补核，不重启或延长。[17再次重开](history-01/17-reopen-second-page.jpg)和[18布局稳定后](history-01/18-reopen-settled.jpg)均停225附近。03:08:09实际视口已非hidden/inert、380×572.667，cm-scroller top16836.666/height19173，焦点仍Source。CodeEditor的range/revision effect可在forced mount隐藏布局中先执行、focus失败并按doc行数settle；旧requestMeasure不能自动补一次逻辑reveal，visibility根因须下一轮完整审计/修复。原失败图片保留，不用Native0、build或DOM计数盖掉此缺陷。

自己109/110均关闭，固定900000毫秒预算没有更改；Native66692/出生win32:639271978559075329、Host74936/出生win32:639271978551474869，实际03:09:22.198Z exited/0，早于03:12:35.068Z。原前台69420实际join0，独立出生/18201端口/无凭据与物理输出请求闭合。[12核心表/12生命周期](history-01/actual-history-custody.json)完整相等，[原引用代码](history-01/referenced-file-custody.json)全文及元数据相等，原项目文件属性相等。所有新runtime原事实日志与人工截图保管，没有合成消息或UI自动化。

当前Overlay types原73911实际0、build原62145实际0（53.27s，renderer surface通过）。这些只验证编译，真实UI证据如上。目录内范围/大文件/实时子Dock/Task/Mission/Tauri宽矩阵未验；Source重开已确认未满足且继续修复，持续goal active。

最终docs:check 345 ops/25 groups、architecture-index 18文档均0；52份公开文本当前凭据扫描匹配0。所有观察器完成后精确自己5个Bun产物保留，工作区相关产物退到私有目录。12份AX移除行尾空白，原始文本私有raw-publications保留，截图及实际数据内容未重写。
