# 323 网页来源正文的媒体类型一致性

## Recall

用户持续要求自主改进UI（User Interface，用户界面）、Sources、子侧栏Rendering与功能，最新明确单agent工作。上一轮322完成前段正文读取、36测试、真实Sol/页面及两个提交；起始HEAD/upstream为052d8e39d93e6626028b80a8ef090470bc2a618f，工作区干净，前轮判定progress。本轮仍单agent，不遵循旧goal中多Astra措辞。

已读AGENTS、322 Recall、07-panel当前Source/文件错误合同、SourceParts、全局链接listener、file-workbench/host transport、220/230真实链接验收，以及webfetch完整生产实现、现有title/body/fragment后端测试。原导航候选已有真实click/Enter与browser transport证明，不据静态href重复修改；非法协议已有SourcePayload的HTTP约束。修饰键和Native浏览器预览尚未新增验收，本轮不把它们宣称完成。

## 根因、影响与当前证据

webfetch读取Content-Type后已有唯一小写且去参数的mime用于图片与标题；fetchedDocumentTitle明确接受text/html及application/xhtml+xml。但format=markdown/text两处仍对原header进行case-sensitive includes("text/html")。直接触发为有效XHTML或大写HTML媒体类型；标题正确而正文仍原始标签，模型与工具结果阅读均受影响。现有XHTML测试只请求format=html、检查title，恰好绕开正文转换，原Source标题修复没有根治格式转换。

影响所有使用同一webfetch Tool的普通Chat、Task/Mission/worker，不改模型调度、来源身份、权限、网络请求、redirect、body owner、响应大小/超时或清理。现无队列/唤醒/恢复/终态异常。全仓定义/调用/同语义搜索已完成：executeWebFetch为公开执行函数，转换helper只由同文件两格式分支使用，标题和输出均由真实同一response产生；Source持久化及frontend无第二标题实现。没有需要迁移的数据、API（Application Programming Interface，应用程序接口）schema或SDK（Software Development Kit，软件开发工具包）字段。

[RFC9110 §8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#name-media-type)明确媒体类型的type/subtype不区分大小写。[W3C XHTML媒体类型](https://www.w3.org/TR/xhtml-media-types/)是专门的媒体类型定义。[W3C实际测试页](https://www.w3.org/People/mimasa/test/xhtml/media-types/)当前web阅读器因application/xhtml+xml拒绝解析；这只是外部观察，必须由项目真实fetch另行核验，不算产品失败证据。

## 实施前方案

复用已经归一化的mime作为唯一HTML/XHTML判别，metadata标题与markdown/text正文共用。删除两处原header substring判断，不增加后备解析、按URL猜测或额外请求。format=html继续返回原文本，plain/JSON等相似字符串不被当作HTML。现有文本提取的实体/块间隔行为另列已观察待研究项，本轮不以MIME修复声称全面解决文本可读性。

先扩充现有非UI真实本地HTTP测试，验证同一正文在text/html、大小写变体、application/xhtml+xml下分别映射明确text/markdown/html输出；测试text/plain的HTML样文本保持其字面内容，参数中含text/html的非HTML类型也按其实际主类型处理。保留原标题、重定向、图片、Markdown/YAML元数据和实际Source持久化用例。先取得失败再改生产，随后原聚焦文件重跑、类型、文档检查。禁止任何UI自动化测试。

真实验收：使用新的正常开发/ui18293，现有320前端构建与新后端；授权auth+完整models配对、实际gpt-6.1-sol流式预检，普通Chat由同一模型读取该公开W3C XHTML来源的markdown/text格式并说明可见事实，实际Tool输出与Source持久化为依据，不能只信模型自述。累计请求上限12，使用现有NativeService独立截止与活动检查；不派发产品子agent，不复用或重启旧任务。

人工进入真实页面查看Source标题、展开Tool实际格式正文，点击与键盘激活真实来源后检查原对话仍可读；不注入Message/Source，不造浏览器fixture。原页面/启动/请求handle全部join、Native/Host/端口/配对清理后保存脱敏结果。若公开源临时失败保留错误，不把本地fixture通过冒充真实来源验收。更新root/月/目录索引、07-panel当前合同；所有本任务修改范围提交、fetch/merge并检查完整待推送范围后正常push。持续goal active。

## 真实源选择修正
首个普通Chat实际读取W3C索引时，服务器对项目Accept协商返回text/html;charset=utf-8，两次转换已正常完成，但这不能证明XHTML分支。真实Tool输出给出application/xhtml+xml对应test.xhtml链接，因此在同一已授权隔离会话和原12请求预算内继续读取该明确公开资源，不重启或延长原服务、不将索引HTML冒充XHTML。

## 完成后的Recall

[结果](source-mime-323/README.md)已取得：正向实际HTTP用例9 pass/69断言，核心类型、路由、文档通过；实际普通Work Chat对W3C test.xhtml获取application/xhtml+xml响应并输出结构化Markdown/纯文本，Source标题正确。真实click/Enter新开原来源，页面均人工查看；没有新的UI代码或UI自动化。

NativeService原37909与检查64775/66642均actual exit0，Native75952/Host75084物理闭合，18293释放，复制配对清理，tab93/94/95关。已保存新发现的实体/块文本缺陷，下一批需从其读取器根因入手；本轮不冒充该问题修复或Native嵌入/修饰键验收。后续只进行范围提交与正常upstream同步push并保持持续goal active。
