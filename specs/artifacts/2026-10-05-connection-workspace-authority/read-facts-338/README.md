# 338 读取摘要的真实范围与数量

[Recall及分析](../read-facts-plan-338.md)。ReadTool结果携带原metadata中的readType、实际offset和唯一lines/totalLines计数；摘要明确区分文本行、目录条目和二进制。请求上限在Input保留，完成态不把它当作实际读取量。空内容更正为0行，offset/limit统一为正整数。

## 真实页面人工查看

Root在开发模式 http://localhost:18314/ui 正常Work Chat逐项交互，无UI自动测试。

- [01 英文摘要](01-actual-result-summaries-en.png)：短文件2行、尾部29-30/30、目录2-3/3、空文件0行。
- [02 请求与结果](02-request-versus-returned-window.png)：原Input仍为offset29/limit2000，实际输出29、30行；上方PDF仅以原名显示。
- [03 PDF中间帧](03-pdf-without-text-window.png)：已打开但尚在加载。
- [04 PDF已加载](04-pdf-loaded-summary.png)：16页真实PDF预览与原名摘要。
- [05 文本初始帧](05-actual-tail-source.png)：编辑器刚打开，定位仍未完成。
- [06 引用定位完成](06-tail-range-settled.png)：29-30行实际高亮。
- [07 中文摘要与空文件](07-chinese-result-summaries.png)：只改变本轮自建页面语言，行/项中文显示正确，空文件可打开。
- [08 目录实际结果](08-directory-result-zh.png)：摘要第2-3项，共3项；实际结果beta.txt/gamma.txt。
- [09 历史返回](09-history-actual-counts-zh.png)：切至另一真实会话再返回，可见目录/空文件摘要保持；截图仅声明当时可见部分。

03/05为保留的中间帧，不作完成证据；不以页面文本、模型自述或测试分数替代截图人工复核。

## 后端与运行事实

[真实输入](live-01/actual-inputs.json)、[canonical请求/结果/Source](live-01/canonical-current-conversations.json)及[后台checker](checks/actual-backend.json)核对5次真实read的原参数和typed结果事实、原文件字节、4条Source及tail29-30范围；9次gpt-6.1-sol流式请求HTTP200/EOF。checker没有UI断言。

[验证句柄](checks/validation.json)：98159原checker失败保留；64801聚焦四文件25项通过，最终read10840六项48断言通过，前后端及共享协议类型、i18n、docs通过。76507构建、2659启动实际exit0，当前bundle main-HB6Ez6mO.js。页面121关闭，精确进程/端口/输出/请求和复制的auth/models配对清理已闭合。38份文本/解压证据凭据扫描0匹配，gzip无损，私有原日志保留。

旧历史无readType时仅保留标题及原始可展开详情，不猜原类型；未迁移历史。当前主对话实证不代表所有子侧栏和流式矩阵都已逐一视觉验证。Skill异步大文件总数和通用布尔字符串coercion仍是下一批调查入口，未借本轮结果宣称其已修复。
