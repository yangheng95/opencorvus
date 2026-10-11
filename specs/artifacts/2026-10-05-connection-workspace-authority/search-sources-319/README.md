# 319 搜索命中的可点击来源

[实施前 Recall 与分析](../search-sources-plan-319.md)。单 agent；基线 b68e3bc1dcf6451177101277b41008a1710167c4。

## 改动

`search_code` 现在直接把实际展示的命中行交给现有 `fileSource`/消息来源保存链路。每条来源含准确路径和单行范围，顺序与结果一致，最多覆盖100条展示结果。同一文件不同命中行分别可定位，不根据输出文本或模型说明猜引用。现有忽略、授权、预算、部分成功和错误契约保持。

Sources 沿用首条可见、剩余显式折叠的布局。共享文件标签和详情将单行范围显示为 `file:2`，多行仍为 `file:2-4`；真实导航范围不变。搜索 provenance（来源获取方式）在中英文界面显示为 Local search/本地搜索，原标识保留在事实及 tooltip（悬浮提示）标题中。

## 检查

修复前真实工具的正向 Sources 检查失败，见 `before-sources.log.gz`。修复后25项检查、27断言通过（原句柄10202实际exit0），覆盖真实3条和125条命中（展示100条）的来源范围、忽略/部分成功、Task/Conversation输出预算、共享字节协议和来源保存。8个workspace类型检查通过（60772实际exit0）。前端构建78453实际exit0，63秒，实际入口 `main-C5ym2uLq.js`；中英文2124键及renderer公共面检查通过。

上述检查只证明各自契约；没有新增或运行UI自动化。真实页面证据如下。

## 实际页面和模型

正常开发服务 `/ui18288`，普通Work Chat `ses_-zUSDZsfYzz1FASulxsi`。第一条用户请求实际只调用一次search_code，pattern `SOURCE319_NEEDLE`、include `*.txt`，返回两个实际文件的三条命中。该请求生成三条provider为 `opencorvus-search-code` 的来源，先于后续单独read请求；不存在用read来源冒充搜索来源的情况。

人工操作和实际呈现的截图均已查看：

- `01-collapsed-sources.png`：搜索下方直接显示首条 `命中 [notes].txt:2` 和“2 more sources”。
- `02-first-line-target.png`：展开其余来源后点击首条，准确选中第2行，列表保持展开。
- `03-distant-line-target.png`：同文件另一来源将编辑器定位并选中第70行；来源列表和对话读位保留，Local search 悬浮提示可见。
- `04-second-file-target.png`：点击另一文件来源，准确打开second.txt并选中第3行。
- `05-existing-multiline-range.png`：同会话后续明确read offset2/limit3产生独立来源，标签保留 `:2-4`，编辑器选中第2至4行。

`actual-source-contract.json` 从闭合后的实际数据库和隔离磁盘文件核对完整请求、输出、来源归属和行范围。四个Source身份分别对应三条搜索命中与一次多行读取；文件名的两个前导空格完整保留。截图证明实际显示与点击行为，数据库检查不冒充视觉资格。

auth与完整models按用户授权配对；预检分别确认凭据usable、模型projected、实际gpt-6.1-sol流式。累计8次请求（含预检和内部请求）全部200/EOF（End of File，流结束），无取消。原启动句柄82663实际exit0；页88关闭，Native78360/Host70264按出生身份结算，18288释放，临时配对凭据清理。4977行本轮运行日志已脱敏gzip，未知时间行0；五个本轮原生生成文件保管完成。

## 边界与后续

本轮完成搜索Sources与单行范围显示，覆盖桌面普通Chat和真实文件编辑器。100条来源边界由真实工具检查覆盖，页面人工检查为3条搜索来源。没有验证100条展开的视觉或原Research Studio子侧栏的完整流式生命周期，不能宣称后者的所有闪烁已解决。持续目标保持active，继续单agent调查。
