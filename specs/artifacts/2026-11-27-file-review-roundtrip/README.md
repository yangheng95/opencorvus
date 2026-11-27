# 文档引用返回与真实文件往返证据

关联[本批Recall、根因调查与验收](../../records/2026-11/2026-11-27-file-review-roundtrip.md)。实际路径为Sol读取sales.csv、创建中文/空格/#文件，页面打开/编辑/草稿决策/保存/下载，再点击两种退款来源引用并返回文档。未新增或运行UI（User Interface，用户界面）自动化测试。

- `first-attempt-overload.json`和`before-provider-overload-details.png`记录真实服务端过载与页面原始诊断，随后从同一真实输入框续发。`task-status.json`、`tool-parts-run55.json`为正式工具及最终finish=stop；`generated-report-conversation.png`显示真实读取、写入、命令和最终文件链接。17次HTTP（HyperText Transfer Protocol，超文本传输协议）200/流EOF（End Of File，流结束）只说明物理读取完成，首轮语义失败未改写为成功。
- `generated-report.md`为Sol实际新建的3855字节原稿，`sales.csv`为181字节真实源文件。最初原生草稿/保存下载各3976字节；补入真实来源引用和往返复核注记后，`saved-report.md`为4141字节，和实际浏览器`销售复核 #1 (2).md`逐字节相同。`facts-run55.json`对应第一阶段，`facts-run56.json`、`api-file-run56.json`和`check-facts.py`对应最终数据及21旧文件/1959旧行保护；revision是既有条件写入协议身份，不以可变源码摘要充当正确性检查。
- 12张任务/基线截图涵盖文档预览、原生草稿、未保存决策、查找/跳行，以及真实发现：`found-codespan-source-navigation.png`中CSV第4行正确但返回文档操作丢失；`before-explicit-link-return.png`同一来源通过显式链接则保留返回，`before-explicit-document-returned.png`显示原读点。工具式fill后待键盘提交的查询不当作产品缺陷，`source-find-keyboard.png`保存原生提交后真实高亮结果。
- 11张`accepted56*.png`为最终构建真实桌面截图，均人工查看：两种链接均打开A003退款第4行并返回原文档/链接；保留草稿与保存并继续均走同一个决策；英语动作和原作者正文均正确。`accepted56-reading-points.json`为只读位置/焦点支持证据，`accepted56-browser-errors.json`仅辅助；未做DOM（Document Object Model，文档对象模型）或像素自动断言。
- `path-tests.log`33项/56条纯路径与章节正向断言、`typecheck.log`和`verification.json`记录辅助检查；构建52.84秒和公开渲染器表面通过。所有真实Provider（模型服务商）请求为精确gpt-6.1-sol流式，凭据与完整目录预检分别通过，两个服务完成流结算、正常退出和配对副本清理。
- 验收为桌面Web UI；宿主原生编辑器偏好仅代码审计，未启动用户编辑器；未宣称外部Source、多项目竞态、深层嵌套链、Office或移动端已全部人工验收。凭据、模型目录、完整数据库及加密推理留仓外，原177项工作区改动不进入提交。
