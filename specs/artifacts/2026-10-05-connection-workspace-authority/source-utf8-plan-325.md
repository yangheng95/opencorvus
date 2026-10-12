# 325 来源与附件的完整 UTF-8 前缀

## Recall

用户要求持续自主体验修复 UI（User Interface，用户界面）、Sources 和功能；最新明确单 agent，覆盖旧 goal 的多 Astra 措辞。前轮 324 属于 progress：正文实体与结构修复已正常推送 `2dd3c692ad9e937c770b3802c335cef29b326009`，当前 git status 干净。本轮沿实际正文路径检查长内容边界，不扩大宣称全产品完成。

已读 AGENTS、324 Recall、webfetch 全文、bash 实时前缀和测试、text-mime 与 Message.toolResultToModelOutput、真实附件存储/投影测试、Truncate、trace 尾部读取及 07-panel。全仓搜索找到两个直接截断解码点：webfetch 的超长首行 50688 字节，以及工具文本附件的 200000 字节。bash 已有完整字符前缀，但为局部私有实现。trace 读取的是完整文件尾部且丢弃首个不完整行，不是相同前缀契约；其他 artifact byte window 保持自己的明确坐标和错误契约，排除本次修改。未发现触及路径的 UI 自动化测试。

## 根因与影响

可观察现象目前是代码风险，必须先用生产函数及真实本地 HTTP 红测确认：`Buffer.subarray(...).toString('utf8')` 在人为预算处将未完成编码视为文件结束，产生替代字符，甚至使 shownBytes 大于正文预算。324 改的是 HTML 语义提取，没有改最后的字节截断。受影响的是所有 webfetch 非图像格式的超长首行，以及 tool-result 文本附件的实时与持久化重放投影；Source 原 URL、标题、HTTP 大小/取消/清理、附件身份和原文件保持原契约。

没有调度、队列、恢复或终态异常证据。本次不新增参数、路由、SDK（Software Development Kit，软件开发工具包）协议、配置、持久化字段或 Provider 分支。源码修改前以红测明确边界，不以函数名称或模型自述当根因证据。

## 唯一实现

在既有 util 层提供一个 `decodeUtf8Prefix(bytes, maxBytes)`，用标准 TextDecoder：截断时以流式 chunk 语义解码并保留未完成尾字符，不把被省略的后续字节伪装成真实 EOF（End of File，输入结束）；完整输入正常 flush，保留已有非法输入替代语义。`ignoreBOM: true` 保持 Buffer 旧路径的 BOM（Byte Order Mark，字节序标记）内容语义。已查阅 [Encoding 标准](https://encoding.spec.whatwg.org/#dom-textdecoder-decode) 及 [标准解码参考](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode)，并与 Node StringDecoder 的 chunk/EOF 定义核对。

webfetch、文本附件和 bash 前缀共用该实现，删除 bash 局部重复算法；预算、行优先策略、截断提示、附件完整性校验保持当前唯一来源。仅字符边界，不承诺 grapheme（用户感知字符簇）截断或其他编码识别。不引入依赖或宿主专用接口。

## 验收与交付

真实 HTTP 正向用例覆盖 2/3/4 字节字符被每个内部字节边界切断、恰好边界、ASCII 与整行优先；明确期望正文、shown/original/omitted 字节及 Source。文本附件通过实际 AttachmentStore 与 Message.toolResultToModelOutput 验证，覆盖实时 data URL 与持久化引用；完整输入、BOM 和真实非法尾字节另做聚焦解码契约。bash 原实时正向测试复核共享替换。保留红测日志，再跑相同测试、核心类型及相关文档检查，不运行 UI 自动化或全量测试。

真实端到端启动隔离正常开发 `/ui` 18295，沿用配对 auth/models、实际目标 gpt-6.1-sol 流式预检、Base 普通单人 Work Chat。选取公开长文本资源，实际工具结果与原响应可核对字节及截断提示；人工查看 Source 和正文截图，不把本地 HTTP 夹具当网页端到端。公开响应是否能命中半字符边界尚未知，须如实区分确定性边界测试与真实链路覆盖。固定 NativeService 10 分钟、12 请求预算；所有原 handle join、自己页面关闭、Native/Host 物理退出、端口和复制配对清理后归档脱敏证据。

同步根/月/目录索引及架构，运行当前 docs:check。精确范围提交、fetch/merge upstream、检查完整待推送集合、正常 push。持续 goal 保持 active。

## 实施进展

原实现红测真实失败：网页 Arabic 单字节切点显示 50690 字节（预算 50688），中文与 emoji 各内部切点出现替代字符；inline/persisted 文本附件同样出现 `文�`。替换后 24 项/134 断言通过（原执行器 88874 已 join exit0），包括真实 HTTP、两种附件投影、BOM/实际非法 EOF、bash 原实时行为与既有 HTTP 生命周期。

公开输入探查找到真实中文维基百科 API（Application Programming Interface，应用程序接口）的 `北京市` extract，200/JSON，80190 字节单行；字节 50687 起为“在”的编码，旧切法实际尾部为“并�”。本轮真实 Work Chat 将直接 webfetch 这一公开 URL，核对是否保留“并”及明确省略数量。探查原响应保留于私有工作目录，不能作为实际模型工具结果的替代。另两个小响应只用于选择足够长度的公开输入，没有改写远端内容或制造 fixture。

## 完成后的 Recall

[本轮结果](source-utf8-325/README.md)已包含实际规范Tool与四张人工截图。真实普通Chat对所选公开URL返回50687/80190字节，省略29503字节，完整前缀以“并”结束；独立逐字符oracle与规范Tool全文相等。共5次真实gpt-6.1-sol流式请求，源代码没有LLM非流式改动。公开探查还取得一个“中国历史”长响应，未用于模型验收；不把探查数量当Provider请求数。

原测试88874 exit0（24/134）、类型25161 exit0、启动49097 exit0均已join。tab97已关、Native62952/Host70984正常物理退出、18295及复制auth/models配对清理完成。首次配置路径拼错导致启动前失败，修正真实路径后运行，未绕过检查。当前剩余范围提交、fetch/merge/push；持续goal active，后续从已见长查询串Source标签问题继续调查。
