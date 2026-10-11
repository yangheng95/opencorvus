# 290 真实差异产物与历史阅读

[Recall、实施前影响分析与完整失败](../diff-review-plan-290.md)。起点58bdde186工作区干净，全程root单agent，无委托、分支、worktree或Release。已有OpenAI使用授权用于一次普通Main真实请求，未创建Task或成员。

## 真实来源与保留的失败

Main ses_-zUSH2VMPzzn4cTey584、Project prj_hCEhMrScTRasJso0mZfp，真实publish_interactive_artifact发布art_g0VXixtjY00JZYwo14aL。内容来自CodeEditor.tsx的b34e232acc32406d18e6cd4738c3c1d2c505ea10与58bdde186c9b31a5ae6cb87684771e1b6f849802；两侧9039/9164字符的完整逻辑文本与Git原件一致，见[内容核验](live-01/artifact-content-check.json)、[真实记录](live-01/actual-artifacts.json)。Git版本是实际不可变来源身份，不以源码摘要作为功能验收。

live-01正常dev/ui18239和tab29，原auth/models配对、credential usable/catalog projected/实际模型分别验证。8请求全部gpt-6.1-sol与streaming，7个HTTP200/EOF、1个预检fetch_failed。实际日志07:32:48.906Z显示socket connection closed，随后同activity的network退避1192.523ms、attempt1完成；具体上游关闭端未知。Main4次chat及其memory调用完成，但严格checker正确保留OWNED_PROVIDER_REQUEST_INVALID，原前台35972 actual1，不能把正常重试或产物成功写成全链路通过。

[原页面](live-01/02-diff-produced.png)显示白色折叠条；真实两栏均contenteditable=false/aria-readonly=true，但没有tabindex/name。Ctrl+F定位因不能获取焦点超时，未声称键已送达；真实Tab依次到外层容器和Copy message，跳过两栏。后续history-01（18240/tab30）[真实失败](history-01/01-loaded.png)为Interactive content could not be loaded；HTTP请求d1946385-065b-4b8a-b7e2-d2a24bd65867返回400 ProviderModelNotFoundError，持久正文GET漏入identity清单，默认runtime错误触发模型配置验证。原完整失败与输出均保留。

## 当前实现与实际页面

codeEditorContent统一CodeEditor/Diff的当前名称、只读语义与键盘入口；Diff两侧以当前Original/Modified加原版本标签具名。共享主题覆盖折叠条与焦点，phrase目录补行数与展开动作。精确@codemirror/merge@6.12.2 patch在原widget用原生button执行原同步展开，结束后focus原正文；未复制控件或在宿主注入事件。Bun patch提交因Windows EPERM失败后，从修改前原件和真实修改件生成标准patch，再正常install及frozen-lockfile actual0验证消费，原失败未隐藏。

正文GET沿现有精确Project身份分类读取，原Project/Session/Message关联继续负责所有权；MCP App request/events维持runtime。没有修改schema、模型请求、Artifact payload或来源版本，没有备用读取API。

最终history-02为完整原290历史副本，正常dev/ui18241、自建tab31，实际脚本main-CC7iplju.js。本人真实操作并查看：

- [已加载暗色双栏](history-02/01-diff-loaded.png)，同一份真实产物可在模型配置不可用时阅读。真实Tab从作品按钮进入Original，具名、readonly=true、tabindex=0，见[焦点事实](history-02/02-tab-focus.json)。
- [左栏查找](history-02/03-original-find.png)与[右栏工作区查找](history-02/04-modified-find.png)分别通过Ctrl+F输入readOnlyExtensions并跳到真实匹配。
- [左栏Enter展开29行](history-02/05-enter-expanded.png)、[右栏Space展开92行](history-02/06-space-expanded.png)均显示两侧完整对应代码；焦点分别返回Original/Modified正文。没有改写原Artifact。
- [中文](history-02/07-chinese.png)显示“103 行未更改”和“展开 103 行未更改的代码”，两侧名称当前翻译、原版本标签保留；[重新打开查找](history-02/08-chinese-find.ax.txt)保留readOnlyExtensions查询。
- 恢复英文，通过Files打开原Project README；[普通编辑器查找](history-02/09-file-editor-find.png)实际突出Isolated。未保存或改写文件。[最终阅读](history-02/10-final-reading.png)后关闭自己的页面。

英文/中文与暗色、真实只读Diff和普通项目文件查找取得证据。Light、本机屏幕阅读器、Tauri及所有renderer未逐项覆盖。原ResearchStudio实时子Dock/全帧Rendering不由这些结果推断通过；没有UI自动化、DOM/组件/源码文案或快照测试。

## 检查、物理收尾和保管

最终build25840 actual0（53.77s）、types80549 actual0、两语言2121键通过。针对后端新增真实Server.App路径检查86855 actual0：两个Project各自完整记录200/no-store和跨Project、跨Session的明确404，两项测试四个正向断言。这是实际路由局部合同，真实浏览器验收来自以上页面。

三个自己的Native实例均在固定预算内物理/output/request收敛，只有live的Provider严格资格失败。原配对均退休、原源凭据不进入证据。初次history-01 shutdown因缺少两个必填参数被绑定拒绝，随后完整sole shutdown actual0；没有把错误命令的PowerShell包装exit0算收尾。

|阶段|原前台实际结果|Native / Host及出生|收敛UTC|原预算剩余|
|---|---|---|---|---|
|live-01|35972 exit1，Provider资格失败|68000/639273007548561841；36068/639273007540903618|07:40:47.773|106303ms，四分钟目标未达|
|history-01|26191 exit0|71936/639273027060363892；69296/639273027052527302|08:06:29.702|825479ms|
|history-02|29979 exit0|548/639273029159211068；78816/639273029151853977|08:12:09.195|695897ms|

两次history均从原290重新读取精确出生/端口/pair、当前schema/config与全恢复前沿，再完整90表逐行等值复制。源两个ProjectMemory idle/pending0，5个assistant完成、3个权限执行成功、control consumed、唯一未过期runtime lease出生已死。没有重新发起Provider/Task。结束后19个受保护表（含interactive_artifact）与16个执行生命周期值完整相等，原Project文件元数据保持。已修改的工作区CodeEditor不被误当作旧Git原件，产物内容仍严格对应原两个Git版本。

所有checker actual结束后才分别归档5个自产物；独立closure与custody均actual0。公开证据、辅助程序、原错误和通过日志一并保存。范围提交/正常上游同步推送后继续，goal active。
