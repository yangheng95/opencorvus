# 217 历史工具完整读取

修改前[Recall/根因/影响](../historical-tool-read-plan-217.md)、[当前只读准入](../historical-tool-readiness-217/README.md)和[启动manifest](../historical-tool-startup-217.json)。上一轮局部错误UI保留信息但实际读取400：纯历史message list/get/part入口漏用既有Project identity authority，热Instance测试未覆盖cold执行环境验证。

本轮现有单一authority classifier加入三个精确GET，handler/身份、持久化、结果格式、SDK与执行配置验证契约保持。[直接后端测试](live-01/historical-tool-read-217-01-tests.log)原36558=0，9项正向测试/61断言：assistant/mission根/子会话cold完整大Tool输出、列表/单消息/Part实际HTTP入口200与跨项目typed404、当前config实际ModelNotFound400；原Part热测试改为cold覆盖，不保留热测试冒充原错误覆盖。后端types48055=0、routes/docs当前通过。本轮UI源码/资产不改，沿当前216 main-Bmeb8tJo，实际HTTP200和浏览器加载确认。

## 真正页面和服务路径

自己33页真实CUA（Computer Use Automation，计算机界面操作）/截图人工复核：[MDN完整结果](live-01/mdn-complete-result.jpg)、[展开全文](live-01/mdn-output-expanded.jpg)，DOM（Document Object Model，文档对象模型）只读事实显示Output32395字符含起首/末尾；原same card40028/六章节/两Sources保留。[W3C参数和结果](live-01/w3c-input-and-result.jpg)有url/format/timeout原参数，Output20733字符，真实展开全文后card28499/height18243，原数据保持。DOM事实不是UI自动化断言，成功依据实际操作/绑定截图与人工查看；没有UI自动化测试。

两结果关闭、MDN重开显示同32395全文；既有成功cache复用而非错误缓存，原六章节/two Sources展开保持，关闭后card7645/height9762。实际Sources阅读：[浅色关闭结果后](live-01/sources-after-tool-read.jpg)、[深色原生Source链接Tab焦点及完整Tooltip](live-01/final-sources-dark.jpg)、[最终深色Sources](live-01/final-sources-dark-clean.jpg)。Tool按钮/Source focus保留，新GET读取成功没有再用错误feedback代替消息。

真实Native HTTP记录：00:42:41.542Z MDN Part请求fbcf6c3a-ee2c-4d79-891b-19ecb2b5dd10=200，00:43:55.559Z W3C Part01eedf9f-9c28-47c7-a61d-7fe86be95ea0=200。另[服务三个真实读取及完整响应](live-01/actual-message-http-reads.json)均200，list105865/message35598/Part33676 bytes，由同canonical目录和原ID读取；[HTTP原日志](live-01/historical-tool-read-217-01-http-summary.json)保留requestID/状态与285本轮行，unparsed0/unknown[]。原215/216 ModelNotFound400和原21501期限1保持，不改为本轮成功。

## 原生和历史闭合

原父48166=0，Native2026-10-09T00:46:14.764Z exited0，physical/output/request全完成，早于固定deadline1791507411874。Host51840/Target75984精确出生身份独立dead_or_reused，18138/pair关闭。自己33页已关，用户23页未操作。[原生结算](live-01/historical-tool-read-217-01-native-host-settled.json)、[独立OS（Operating System，操作系统）闭合](live-01/historical-tool-read-217-01-independent-closure.json)及[5份生成FFI（Foreign Function Interface，外部函数接口）单文件移交](live-01/generated-native-observer-custody.json)保留；出生00:41:52.992–53.070Z，绝对workspace界限核对、全部原父/观察闭合后逐文件移入私有忽略目录，无递归删除。

初始90表逐实际完整行一致。最终[canonical六表](live-01/final-canonical-custody.json)Session2/Message8/Part21/Provider请求5/结果5/usage8逐完整行相等。Tool状态来自独立request/progress/outcome事实，不能用Part表替代：[补充三表全行比较](live-01/final-tool-fact-custody.json)为2/0/2，同原213；同时补证原216闭合副本也逐行相等。没有新Provider记录、Tool事实或原历史改写；不是count-only/digest验收。公共检查日志仅行尾/EOF空白整理，私有原件与HTTP/Native/数据库事实保持。

## 尚未满足

本轮完成历史数据三个读取的模型独立性和Main Tool/Sources实际阅读。当前模型不可执行仍由Composer和实际config400报告；没有凭据/catalog移交或新模型请求，不能称真实新Sol流式或Side Chat创建通过。中文切换216原失败、更多配置/child实际页面及其他平台矩阵继续单agent处理，目标active。
