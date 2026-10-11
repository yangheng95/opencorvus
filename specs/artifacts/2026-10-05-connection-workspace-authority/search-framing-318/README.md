# 318 搜索文件身份和命中文本

[实施前 Recall](../search-framing-plan-318.md)。单 agent；生产基线为 6d61b1cbedb6147ce3914fe3f8eaa878eca226ac。

## 修复与复核

`search_code` 的竖线字段分隔和文件枚举的换行分隔不能表示所有合法 POSIX 文件名；整体 `trim()` 还会删除最后命中行的尾随空格和 Tab。修复前的真实 Windows 工具调用已经复现后一个问题，见 `before-search-test.log.gz`（保留原始尾随空白）。统一采用既有 Ripgrep 层的 JSON Lines 解码和 NUL 文件边界，正文只移除一个行终止符。共享文件列表按流解码 UTF-8，保留跨 chunk 字符及名称中的 BOM（Byte Order Mark，字节顺序标记）字符；不完整文件帧与不可准确表示的文件身份明确失败。

公开 Match 文本结构不变，官方 text/bytes 字段归一到原结构。路径使用严格解码，内容继续使用 UTF-8 文本显示语义，无法表示的内容字节显示替换字符；这不声称原始二进制内容无损。原忽略、权限、执行归属、批次参数、累计 2 MiB 原始输出预算、30 秒总期限与部分成功语义保留。JSON 的额外字节计入同一预算，较多短命中可能更早达到上限。

旧伪进程测试观察过时 terminate 回调而失败，公共终止/结算调用链已横向核对并记录在方案。替换为真实 Conversation/Task 超限调用，实际返回 `output_limit`、恰好 2,097,152 字节、各自执行归属与结算后的 live 数量。收据实际 exitCode 为 0，不能据此声称杀死仍活跃进程。生产 Process/ProcessSupervisor 未改动。

## 验证资格

- 私有官方 Bun 1.4.0、实际 ripgrep 14.1.0；17 项检查、17 个正向断言通过。真实文件检查覆盖 Unicode/前导空格、字节内容、行尾空白、显式 glob 和实际预算；伪进程只检查分批、累计预算及分块协议契约。
- Windows 普通文件 API 无法创建本次管道符/换行文件名，相关身份检查明确限于协议层。中途误用不受此 ripgrep 支持的 `--label` 导致 15 通过/1 失败，保留 `after-search-tests.log`，已删除错误调用；不把它称为产品缺陷或真实 POSIX 验收。
- `final-search-tests.log` 为 17 通过；其原句柄输出在上下文恢复时不可再取得，因此另行重跑原检查，`joined-search-tests.log` 的句柄 18777 已实际 exit 0。后端 typecheck 句柄 57801 已实际 exit 0。
- 本轮是后端修复，没有前端代码变更；实际开发 `/ui` 使用当前 317 构建。没有运行 UI 自动化测试。

## 实际模型与页面

`/ui18287` 的普通 Work Chat，Session `ses_-zUSDcYhUzzOAWmky5kK`。授权凭据与完整 models 成对暂存；预检分别验证 usable、projected、实际 `gpt-6.1-sol` 且流式。实际模型调用 `search_code` 的输入为 pattern `SOURCE318_NEEDLE`、path `.`、include `*.txt`，然后 `read` 输入的文件名前导两个空格原样保留。闭合后从真实数据库读取的搜索输出与实际磁盘内容逐字符相等，末尾空格/Tab 完整，见 `actual-search-contract.json`。

人工操作展开搜索结果、收起并点击 read 产生的 Sources。两张实际呈现且人工查看的截图：

- `01-real-search-output.png`：完整搜索结果含准确文件名和第 2 行。
- `02-source-file-open.png`：来源打开文件编辑区，显示同一条第 2 行命中内容。

搜索工具本身目前仍未产生可点击 Sources；本轮截图中的来源由真实 read 工具产生，不可混称为已给搜索新增来源。该产品改进应在本轮身份修复之后继续实施。也不凭普通 Chat 的两帧截图宣称原 Research Studio 子侧栏流式闪烁完全解决。

累计 6 次实际模型请求（含预检与内部请求）均 gpt-6.1-sol、streaming、200、EOF（End of File，流结束）。页 87 已关闭，Native 78132/Host 51816 按出生身份退休，18287 释放，配对副本清理，原启动句柄 7851 实际 exit 0。完整脱敏收据、当前对话、可还原运行日志在 `live-01`；运行日志 3576 行，无未知时间行。五个本轮原生生成文件已按身份和路径保管。

## 后续

下一轮调查本地搜索如何经现有单一 Source 生产/持久化契约提供可点击文件来源；不从输出字符串猜文件身份。真实截图另外显示展开工具的 Input 区域只有操作栏，需检查是否为既定折叠交互或缺失内容，再决定修复。持续目标 active，继续单 agent。
