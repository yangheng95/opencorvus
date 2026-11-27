# 蜡烛图逐条读数与缺失成交量证据

对应[根因与验收记录](../../records/2026-11/2026-11-27-candlestick-bar-details.md)。

- 真实Mission ses_-zUNoueGYzzqJOP91zw0：唯一公开工具发布art_g0VcB5ObV00wP1lFZdxF。六条是明确验收绘图输入，不是真实行情或销售数据；原计划Work与实际Mission入口差异如实记录，没有子任务或委托。
- before为4张图表基线和1张首次复制原生粘贴原图；accepted为16张最终原图，均已逐张人工查看，覆盖六条完整读数、缺值/0、两pane、平移缩放、普通/展开、中英/深色/恢复中文。截图超时和旧帧不作通过证据，最终归档的是后续实际目标图。
- 三份native CSV保留6行time/24个OHLC和volume120/省略/160/0/省略/100，均418字节；ZIP保存实际菜单下载原文件名。baseline-first-copy/native-copy为两fresh tab第一次Copy结果；两native-paste为真实键盘粘贴412字节，只规范化六处换行。
- expected-series、baseline-facts、data-facts保存真实输入、实际发布身份及当前生产schema/数字格式/WhitespaceData投影/导出证据。facts-run94/95与verification保存9项纯数据测试、类型/构建/文档检查、7次Sol流式EOF、原句柄退出0及23文件/2313旧行保护结果。
- 单根、全缺量、量小数的原生界面、2万根、无序/重复time、极端价格、其他5主题及屏幕阅读器未新验；没有新增键盘逐条导航。全部限制详见记录。
- 不保存凭据、私有完整请求或数据库，不进行UI自动化和像素断言。
