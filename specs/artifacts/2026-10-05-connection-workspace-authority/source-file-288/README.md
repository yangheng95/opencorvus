# 288 文件来源只读状态与查找控件

[实施前 Recall 与根因](../source-file-plan-288.md)。上一轮873b9db3d已推送，开始工作区干净；本轮全程单agent，使用原265自然会话的完整历史，没有新Task、成员或Provider请求。

## 实际问题与实现

最初检查Sources文件打开错误：当前FileEditorPane已拥有真实读取错误和Retry，不能把Source导航catch仅写日志直接判成404不可见。本轮没有改动正确的文件错误路径。

[01前态](history-01/01-readonly-before.png)中，真实目录外read.ts已只读且27–37定位正确，但Header只显示disabled Save，无法区别于尚未修改的可编辑文件。现共享FileEditorPane直接根据现target.sourceAbsolutePath，在原Save位置显示现有Badge的Read only/只读；项目文件保留原Save。文件权限、只读状态、导航/资源/范围owner和保存流程均未改变。

[02实际Ctrl+F查找](history-01/02-search-before.png)又发现查找框白底浅灰字、9.1px字号。只读DOM观察记录背景255/255/255、前景224/224/221和真实查询citedReadRange。安装的CodeMirror基础light规则为cm-textfield指定白底、70%字体，按钮也保留light gradient；已有overlayEditorTheme只覆盖面板，遗漏控件。按[CodeMirror官方主题机制](https://codemirror.net/examples/styling/)，在同一个EditorView.theme补齐字段、按钮和搜索label的现设计token。使用既有TextField的surface-strong/text-strong、ui-font-body及边框/圆角/焦点变量，去除库的固定明亮gradient；保留库原搜索布局、事件和键盘命令，没有复制搜索UI或引入另一个主题。

## 本人真实页面复核

正常dev/ui18236，自己的tab26；修复后只刷新该页，原Native实例和预算保持。最终实际脚本main-B-uUFBJb.js。

- [03只读范围来源](history-01/03-readonly-after.png)：Read only明确可见，实际read.ts内容及27–37 band保留。
- [04深色查找](history-01/04-search-after.png)：查询文本清晰、焦点可见；当前字段背景44/44/44，前景238/238/236，14px。[05 previous](history-01/05-search-previous.png)实际定位并显示另一处citedReadRange匹配。
- [06整文件](history-01/06-whole-file.png)：同一真实无range Source仍打开原文件，Read only保持，原范围band已清除；截图中的局部紫色是刚才搜索选择，不是引用band。
- [07中文浅色](history-01/07-chinese-light-search.png)：只读正常显示，查询在白底32/32/32深字、14px；保留实际查询。通过本页Settings→Appearance切换，未改用户应用。
- [08返回来源](history-01/08-source-return.png)：关闭文件面板后同一两条来源和原总结可见。随后通过同一设置UI恢复English/System，09记录原偏好已恢复，关闭自己tab26。

所有图片由root实际查看；辅助AX/样式记录只解释图片，没有UI断言、组件/源码文案测试、浏览器fixture、快照或像素比较。普通可编辑保存/替换、DiffArtifact、其他CodeEditor消费者及其他平台未在本轮实际验收，不宣称完整矩阵通过。

中文页面进一步显示CodeMirror的Find/next/previous等仍为英文，原已挂载编辑器的AX名称仍是Editor。当前CodeEditor只在mount时设置aria-label，且没有EditorState.phrases语言配置；这是下一批需要独立分析和真实复核的体验缺口，本轮未隐藏或冒充已修复。

## 数据、检查与收尾

fresh原265实际Native出生/端口/auth-models对/完整物理输出请求已闭合，当前schema无漂移；原普通Main为ses_-zUSNlWWuzzuGg1K9BbU，Project prj_hln9w2B7mnt2gsZHByHX。无Task/Mission/dispatch，4 assistant完成、2 permission执行有结果、1control consumed，两项目Memory idle/pending0；唯一未过期runtime lease的精确出生已死亡。原265前台20142 actual0来自其既有完成收据，不冒充本轮新执行。配置和全表/恢复入口已审查，完整90表复制逐行相等后才启动。

引用源码9354bytes/262行，真实Source原始范围和完整文件事实未改。最终18核心/内存/控制表完整存储行与原库相等，12条生命周期事件完整一致；原2Session/6Message/14Part、2Tool结果、4Provider请求/结果与6usage均保管。原项目文件属性和引用源码完整内容/属性均equal；未把文件属性检查冒充原项目所有文件全文校验。当前历史页没有移交auth/models或发模型请求，Model configuration unavailable保留为这次无凭据阅读状态。

第一次只读Badge构建88613 actual0（53.13秒）、类型27448 actual0；补查找主题后最终构建13110 actual0（50.80秒）、类型67115 actual0；语言结构2locale/2092键通过。这些只证明编译/目录结构，以上真实图片才是视觉验收。

自己的页关闭后sole shutdown实际0，原前台13049实际join exit0。Native77016/出生639272967980443785，Host69788/出生639272967972968735，06:36:09.310Z物理输出/请求收敛，距固定15分钟deadline剩327912ms，达到提前五分钟目标。独立archive/checker确认精确出生、18236释放和凭据对退休；全部checker实际结束后才精确保管5自产物。

首次custody沿用266的旧预读记录文件名，完成18表部分记录后报缺文件；该首次记录和错误保留，改为本轮服务启动前已取得的target-file-before.json，再跑原custody实际0。没有补造当前期望值或放宽保管。两处启动前脚本准备问题见Recall，均在启动前修复。一次临时时间算术因PowerShell自动转换日期丢失UTC含义得出错误余量，已按原JSON字符串重新计算327912ms；原Native收据未改。

当前07-panel、root/月/相关索引同步，文档/架构检查与公开凭据扫描后范围提交、fetch/merge上游、审查全部待推送集合并普通push。原ResearchStudio、实时子Dock、全帧Rendering、287真实失败/交付名称等剩余范围保持未验，持续goal active。
