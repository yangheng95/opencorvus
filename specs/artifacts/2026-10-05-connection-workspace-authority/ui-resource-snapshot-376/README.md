# 376 前端静态资源快照证据

[Recall和根因](../ui-resource-snapshot-plan-376.md)。改前生产现象来自[375旧worker失败](../attachment-display-375/after/00b-rebuild-in-progress.png)及其实际404请求。

本轮在私有Bun相邻ui目录运行生产CLI/NativeService，端口18383，页面201。全部5张截图逐张人工查看：

| 图 | 观察与范围 |
| --- | --- |
| [01](after/01-before-rebuild.png) | 重建前的真实read、Source与自然回复。 |
| [02](after/02-after-rebuild-reload.png) | 私有目录实际重建后，原服务reload仍正常显示同一会话。 |
| [03](after/03-lazy-editor-save.png) | 重建后首次加载文件编辑器成功，实际编辑保存x。 |
| [04](after/04-nested-path-observation.png) | 额外嵌套路径探查仍停在Preparing Environment；客户端相对语言路径错误，尚未修复。 |
| [05](after/05-root-recovered.png) | 返回正常/ui入口后同一会话正常。 |

resource-before/after记录七项旧资源完整响应字节与来源身份，包括独有32字节归属资源；这项二进制的原件单独标于private-bundle-preparation，而非应用UI内容。真实Vite重建50.59s产生main-tGz5a9EI、worker-DqbgtJ0U与CodeEditor-DOnjp3fh。旧服务仍提供main-CAo85tzZ、worker-CF9y63Km和CodeEditor-KqnXIBNR。fresh-capture记录独立新HTTP服务确实读取新构建；并非哈希外形或源码摘要替代行为检查。

最终11项后台HTTP合同通过，类型检查通过。原84566 exit0，Native578003ms，5次gpt-6.1-sol流式EOF；真实Source/完整ToolOutcome/65字节项目文件与全运行闭合见checks/runtime-qualification.json。临时auth/models成对清理。正式UI捕获约30.5MB数据，私有新构建捕获内存观测保留于fresh-capture；不承诺零内存开销。

04的语言JSON路径错误与二次错误呈现待下一轮处理。没有对截图、DOM或渲染文字写自动断言；旧HTML子串/摘要形状测试已删除，新的后台测试只验证不透明资源字节、HTTP状态和归属。没有运行编译embedded二进制验收或其它平台UI验收。
