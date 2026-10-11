# 323 HTML/XHTML 来源正文转换

2026-10-12，单agent。[实施前Recall](../source-mime-plan-323.md)；生产改动只在webfetch的媒体类型判别，前端沿用320构建，没有UI自动化测试。

## 结果与证据

已有归一化媒体类型现在共同决定标题和正文转换：text/html、大小写变体及application/xhtml+xml均进入现有HTML转换；非HTML主类型的参数即使包含text/html也保持其实际类型。显式format=html继续返回原文。改动没有新增解析器、请求、后备路径、权限或来源缓存。

[实际Source/Tool数据核对](actual-source-contract.json)来自[关闭后的规范消息与工具输出](live-01/canonical-current-conversations.json)。真实普通Work Chat `ses_-zUSDALzRzzkSHjoUQek` 共四个webfetch调用：先读取W3C索引的markdown/text，再读取该索引明确给出的test.xhtml的markdown/text。索引实际协商返回text/html，不能算XHTML验收；后两项Tool结果的原始title保留了response Content-Type `application/xhtml+xml; charset=utf-8`，实际输出分别7553/6927字符，Source标题均为“Sample XHTML 1.0 document”。不是根据模型自述或扩展名推断类型。

真实10次gpt-6.1-sol请求全部流式HTTP200并正常读到末尾（含预检与同一Chat的两轮），处于原12请求预算内。没有产品worker/Task派发。原NativeService37909已actual exit0；Native75952、Host75084完成原物理/output/request闭合，18293释放，复制auth/models成对清理。只有自己的tab93/94/95被打开和关闭；服务未重启或延长截止。[终态资格](live-01/source-mime-323-live-01-qualified-surface-completion.json)与[清理](live-01/source-mime-323-live-01-physical-terminal-and-pair-cleanup.json)保留。

## 人工页面复核

- [01](screenshots/01-xhtml-tool-and-source.png)：真实XHTML工具结果已转换为Markdown标题/目录，而非整份原始标签。
- [02](screenshots/02-source-titles-and-result.png)：两次真实读取各自保留原文Source标题和域名；不跨Message合并来源。
- [03](screenshots/03-click-opened-original.png)：点击Source后新标签94显示真实W3C文档，原93仍为对话。
- [04](screenshots/04-conversation-after-enter.png)：Enter激活后原对话仍可读，随后标签95实际加载相同原URL/标题。即时标签清单第一次尚未出现95，后续实际清单及页面读取确认；没有重复发送按键或猜测弹窗失败。

这是桌面Web页面人工交互与截图复核。未验收Tauri原生嵌入预览或修饰键行为，未宣称覆盖所有浏览器，也没有以控制台、类型或DOM字符串代替视觉。

## 检查和剩余问题

原失败日志[before-media-type.log.gz](before-media-type.log.gz)证明大写HTML进入错误原文分支；修复后[媒体类型/来源持久化](after-media-type.log.gz)3 pass/35断言，[真实HTTP body边界](body-contracts.log.gz)6 pass/34断言。合计9 pass/69断言。核心typecheck、接口路由6规则/34文件、docs345操作/25组均通过；原执行器64775、66642实际exit0。

实际证据核对脚本最初错误地将58字符前缀截为56字符，产生检查器断言失败；已改为明确结构前缀并重跑通过。没有修改实际产物迎合检查器，也没有把该失误归为产品错误。

仍发现独立的纯文本提取缺陷：同一实际XHTML的阿拉伯文在markdown为`غرب`，text仍为`&#x063A;&#x0631;&#x0628;`；原本的文本提取器也会把紧邻块文本拼接。证据完整保留，本次媒体类型修复不把这两项写成已解决。下一轮继续针对原文本提取实现分析与实际复测；持续goal保持active。
