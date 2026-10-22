# Sources 与成员重连历史证据

见[Recall、根因分析与完整结果](../../records/2026-10/2026-10-22-source-reconnect-history.md)。单agent，13张实图，11次真实Sol流式请求，两个同URL服务轮次组合；修复私有就绪/查询/日志观测工具并真实重跑，没有生产渲染改动或UI自动化测试。

- [原Sources阅读](02-before-source-reading.png)、[实际Offline](03-service-offline-reading.png)：32正文/10Source及旧阅读位置保持。
- [真实公开读取权限](04-reconnected-source.png)仅选择Allow Once；[新增Disclosure来源](06-new-source-reading.png)显示实际标题/host，[完整末尾](07-complete-text-end.png)及`after-checked-result.json`核对一次真实输入、唯一completed webfetch/原Tool绑定Source、1511字符/12节/stop。
- 第一组`before-offline-console.json.gz`与`after-input-final-console.json.gz`合计819条独立事件，最近500窗口覆盖了早期重连/新输入，明确有缺口。`after-reconnected-live`文件实际捕获时已EOF，不能作为流中截图证明。
- [低频观测补验](observation-recheck/README.md)在原检查失败后修改私有观测、重新构建并用新scope实际重走关闭/恢复；不重复业务输入，不冒充生产修复前后。[恢复后的实图](observation-recheck/12-recheck-natural-recovery.png)维持35正文/11Source/top62262。
- [资源摘要](resource-summary.json)：四服务74487/41385/44671/11482及原业务输入54303 join0，四public shutdown200/native physical/output/request/launcher/精确出生闭合，139/140关闭；2/8+5/8+2/4+2/4=11/24真实Sol，16份配对凭据/catalog成员退休。provider只留实际wire身份/status/stream/EOF，省略请求payload/headers。
- 两组`data-preservation-observation.json.gz`核对完整90表/全部原行及源bytesmtime/schema3/canonical。目标原行分别2/5/2/2条正常运行字段更新，Provider activity407→408→411→412→413；绝非目标全字段零差异。全DB/原始全行快照和完整Tool网页输出不归档。
- `after-early-input-original.log`保留过早工具调用在就绪文件处停止，未发POST；`after-checker-original-error.json`为不合法limit1000的实际HTTP400，改当前200后原checker实际通过。原凭据/完整models及新scope preflight/退休元数据分别保存，未将模型未投影误报为凭据失效。
- `result-observation.json.gz`提供完整限制、实际HTTP与端点观察。Helpers依赖原成熟监督链，是本批真实取证来源，不能作为独立安装器或UI自动化测试使用。

本批限定普通Session成员；Task的live delta/epoch分支、native authority轮换、虚拟窗口与流中重连组合仍开放，不能宣称Sources/Rendering整体解决。
