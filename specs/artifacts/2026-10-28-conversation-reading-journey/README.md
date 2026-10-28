# 会话阅读实页证据

对应[调查方案](../../records/2026-10/2026-10-28-conversation-reading-journey.md)。使用当前开发CLI的真实`/ui`，三个独立自有scope依次正常闭合；原40分钟截止06:39:35.342Z未重置。没有使用或刷新用户18571实例，没有新增/运行UI自动化测试。

## 实页与原始截图

所有JPEG均由内置浏览器直接捕获并人工查看，未修图。基线真实Chat/Work、项目、消息和文件均来自已正常关闭的原数据库副本，没有注入假消息或请求模型生成验收数据。

1. [原Chat阅读](01-current-conversation-reading.jpg)：停止原文与成功续聊、当前默认布局。
2. [原菜单](02-current-conversation-menu.jpg)：已有Markdown/JSON下载，没有正文查找入口。
3. [跨项目Work](03-cross-project-work-reading.jpg)：真实三个自动轮次、Goal Complete；左侧自然悬停提示保留。
4. [完整草稿返回](04-full-draft-returned.jpg)：先独立输入并确认全文，再跨项目并返回，完整“阅读返回体验761：未发送草稿”仍在。首次把输入/切换连在同一工具调用的初始全文没有证据，不据此认定草稿缺陷。
5. [原来源文件](05-original-source-file-opened.jpg)：Sources打开准确的mcp.ts原文件，右侧文件面板可读。
6. [首次改后查找](06-first-search-count-placeholder.jpg)：Ctrl+F与三个真实匹配成功，但计数暴露单花括号插值错误。这是保留的失败证据，随后两语言均修为当前双花括号合同。
7. [原消息定位](07-first-search-original-message-located.jpg)：点击首个真实结果后，弹窗关闭并定位原用户消息。
8. [最终计数](08-final-search-count.jpg)：最终构建实页Ctrl+F先显示“8 messages loaded”，mcp精确返回同三个原messageID，显示“3 matching messages”，作者、日期和原文上下文可读。截图时预设正常关闭已完成，因此底部Offline为隔离实例退休后的真实状态；不据此宣称在线刷新已通过。

本轮最终实页范围为英文Chat八条原消息。中文Work查找、刷新、无结果、Esc/Enter、查找期间跨项目退休和超过80条的分页导航尚未完成实页验收；基线跨项目/草稿返回已验证。121消息匹配与分页Promise归属只有非UI正向合同证据，不冒充真实长历史页面验证。

## 功能与完整性

会话菜单和Ctrl/Cmd+F使用同一完整目录作用域导出快照，匹配原消息正文及错误原因；结果使用真实作者/消息身份，导航复用原消息到卡片映射、历史分页和虚拟滚动。快照与原导出共享唯一结构验证，原导出错误公共合同保留。分页共享原读取Promise，跨来源仍由原authority、epoch和AbortController管理。无新API、SDK、数据库schema或Provider调用。

聚焦非UI检查15项/28断言通过，包含原导出8项/16断言与新匹配/分页归属7项/12断言。类型、普通构建、双语键及文档检查记录见[checks.json](checks.json)。首次类型失败（Button缺tone）和计数插值失败已保留并修复，不隐藏中间失败。

完整全表核对三scope的101306/101308/101310条原行逐字段保持，对应最终101308/101310/101312行；源数据库也逐行保持，schema9、integrity_check=ok，三个原Project输入保持。三个原exec/native/launcher均0，公开shutdown200，物理完成、输出排空、请求清理及精确出生身份退休均有正向事实；最终scope由预设诊断timer正常关闭，最终余344722ms。没有复制凭据，只复制的完整模型目录均在结算后清退，源目录字节/元数据和auth元数据保持，Provider0、累计759。见[runtime-and-data.json](runtime-and-data.json)。
