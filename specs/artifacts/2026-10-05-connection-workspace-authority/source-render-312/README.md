# 312 来源侧栏渲染调查结果

[实施前 Recall 与候选原因](../source-render-plan-312.md)。2026-10-12，单开发 agent，生产基线 a0a4f9b3c5dc40c915e46a70169cdfab6ca8bfd7。本轮没有生产代码改动。

## 已观察到的行为

正常开发服务 `/ui18281` 的 380px Side chat 使用真实 `gpt-6.1-sol`，依次生成引言、webfetch W3C robots.txt、六节正文、read 隔离项目 README，再生成六节正文。侧聊 Session 为 `ses_-zUSEFSqbzzmtyHDgQQE`。三段实际 assistant 文本原始长度为 482、2302、2154，共4938字符；屏幕渲染正文读数为481、2140、2063，共4684字符。

人工观察截图01–10：正文逐步增加，网页和文件来源在各自工具后出现，先前引言保留；最后一段仍在流式更新时，已有正文与来源仍可阅读；结束后关闭/重开 Dock 返回同一文件来源附近。本轮观察帧没有复现反复回到 Rendering，也没有据此移除加载状态或改写分组结构。

- `02-after-first-source.png`、`02-render-state.json`：第一来源已到达，后续正文1133字符/16个块，引言481字符/3个块仍在。
- `05-first-source-retained.png`、`05-render-state.json`：第二次读取后，前文已2140字符/32块；新正文939字符/14块正在渲染。pending=true 时已有HTML（Hypertext Markup Language，超文本标记语言）保留，符合现有机制。
- `06-web-source-while-streaming.png` 与 `07-web-source-after-output.png`：停留的网页来源及相邻引言持续可见。
- `09-file-source-visible.png`、`10-reopened-reading.png`：真实文件来源的完整路径换行和重开阅读位置。

截图均实际呈现、人工复核。DOM（Document Object Model，文档对象模型）只读数据仅辅助记录可见块数和位置，没有断言、自动截图比较、循环浏览器测试或人工注入来源。程序没有被替换或添加诊断分支。

## 证据改变的判断

已安装 Solid 的 Switch/Match 非 keyed 条件按真假等价，因此“正文每个 token 改变 when 字符串就必然重建”的猜测不成立。Subagent 实时投影接收 source 的 part.updated，所以不能假定来源只通过慢补全到达。

`observed-timeline.json` 从本轮关闭后的实际 SQLite（轻量关系数据库）只读获取：网页来源创建于下一段正文创建前约5.3秒，文件来源创建于下一段正文创建前约3.8秒。本样本不支持“来源迟到后把已存在正文切入新组”的触发；数据库创建时间不能代表浏览器交付顺序或组件生命周期，不能扩大结论。

普通 Side chat 没有覆盖 SubagentConversationPanel 专有的 resource refetch 与 live projection 合并，因此原 Research Studio 子侧栏的当前真实流式问题仍未知。下一步应直接调查该路径与真实事件顺序，继续保持单开发 agent，而非仅重复同一普通侧聊样本或根据候选原因打补丁。既有历史静态子侧栏证据不能替代这个差异。

## 资格与收尾

预检分别确认凭据 usable、完整模型目录 projected、实际模型正确且流式。累计7次实际请求均200/EOF（End of File，流结束），包含预检/正常内部请求；侧聊用户请求覆盖的实际读流约19:01:31–19:03:32 UTC。完整最终 Provider、原始持久化对话和脱敏运行日志均在live-01，运行日志gzip可恢复同一字节。

自己的页81关闭；原执行器33375实际回收exit0，Native66148/Host19412按本轮出生身份退出，18281端口释放，auth/models配对清理；独立closure-readback通过。复用PID不代表旧轮次：本轮以processInstanceID核对。五个本轮Native生成文件在所有原执行器终态后保管。

这是一轮实际调查与验收证据，未新增代码修复，也不宣称原始闪烁已解决。当前文档检查、范围提交、正常上游同步/推送后持续goal保持active。
