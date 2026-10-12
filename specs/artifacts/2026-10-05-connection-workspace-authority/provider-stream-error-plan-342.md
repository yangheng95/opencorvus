# 342 流式 Provider 错误的可读展示

## Recall

用户要求持续自主体验、修复和改进，最新要求仅单 agent。341已提交推送45366f3e，开始时工作区干净；真实Sol运行中捕获HTTP 200流里的server_is_overloaded，原截图skill-loader-341/01-provider-overload.png、实际message msg_g0VXofL0v00voJgQANZ1及canonical会话保留。当前目标是简洁可读的错误主提示与可展开原始诊断，同时正确记录Provider错误类型。不得伪造模型消息、引发真实过载或把历史回放说成新Provider复现。沿用benchmark-debug-template，本轮已读取openai-docs。没有委托。

## 分析与影响面

直接触发：parseStreamError只识别嵌套error.code的三种错误；真实overload包落入Message.fromError默认UnknownError/JSON.stringify。界面assistantMessageErrorReason只取字符串，三个投影入口丢弃responseBody，ChatBubble把JSON作为主文案。旧路径只为有限配额错误特判，未建立完整的结构化事件契约。

已搜索parseStreamError、Message.fromError、ErrorClass、withLLMActivity、collectLLMText全部生产调用；阅读Provider error/redaction、Session processor/error事件、shared activity、title、memory organizer、vcs commit message、tree-writer、SideChatPanel、subagent-conversation、CardNode、ChatBubble、CardHeaderChrome、Disclosure及06-provider架构。共享activity覆盖Session的Chat/Task/Mission、三个辅助流；每个调用自己持有context/attempt/abort与terminal，持久化分类字段为字符串。恢复后读取同一Message事实，项目不共享错误投影状态。HTTP重试、外部取消优先级、工具收敛和终态所有权均保留。此处是流错误分类缺失，没有证据表明队列或重启调度异常；全生命周期追踪已核对，不能把overload误判为凭据或HTTP 503。

官方资料：https://developers.openai.com/api/docs/guides/streaming-responses 提供flat type=error/message事件；https://developers.openai.com/api/docs/guides/rate-limits 区分流前HTTP 503与已开始流中的错误，并要求消费输出后不自动重放。当前真实包为嵌套error格式，保留同样支持。两种真实协议形状共享一个解码实现，不能按overloaded关键词推断状态码或重试。

## 实现

transport-protocol增加纯结构化stream error解码，返回原包、code/type/message；Backend使用该解码，保留现有context/quota明确契约，其余有效事件成为APIError，message为Provider可读提示，responseBody为现有结构化脱敏器处理的原包，isRetryable=false，不虚构statusCode。activity将已识别流错误明确记录provider_stream_error（context overflow仍有自己的类），沿用非自动重试终态。

界面用一个assistantMessageFailure替换旧Reason helper，返回同一消息的reason/details。历史真实UnknownError的JSON也通过同一解码显示，数据不改写；新APIError使用message与responseBody。Main/child/Side Chat所有投影和相等比较携带配对details。现有错误图标保留摘要并复制完整诊断；正文用普通阅读字体呈现摘要，原包通过现有Disclosure展开。无UI自动测试，未检索无关测试目录。

## 验收与交付

新增聚焦后端正向契约：真实捕获包和flat错误、配额/context、结构化脱敏、Message APIError、activity流中错误的明确失败终态与原cause。运行直接相关检查、后端/overlay/transport类型、当前docs检查和frontend build。真实页面通过项目开发服务/ui人工查看历史原错误及展开诊断截图。优先使用正式Session export/import保留完整真实会话；若导入契约不具备所需范围，记录阻碍并用经过资格检查的完整历史副本，不拼接伪消息。

独立服务18319、固定600000ms上限，只操作本轮页面和进程。历史阅读无需模型调用或凭据；若必须真实请求则成对auth/models预检并限制预算。启动句柄必须实际join，截屏人工查看、端口/进程关闭证据必须保存。原Provider过载不再现属已知限制。规格索引同步、范围明确提交，fresh fetch/merge及待推送集合复核后正常push；goal保持active。

## 真实导入暴露的共享写入问题（实施前补充）

342只读原库发现Memory Organizer retry_wait/pending1；整体副本正常启动会重新组织，故没有启动副本或清除该事实。改为真实9条消息/21个Part的正式会话导入。读取原库使用readonly BEGIN/ROLLBACK、Session.fromRow、Message schemas及生产tool projection，逐条保留原身份/时间/错误/工具结果，绝无生成消息。导入首次实际失败：Assistant failure occurrence must match its Session, message, and canonical error。

根因是Session.importSnapshot和persistMessageBundleRows的重复暂存逻辑只剥离completed/finish/error，却保留failureOccurrence及其依附的convergenceFailure/observationFailures。Message.Assistant的公共校验要求这些事实与error同时存在；原写入路径未覆盖完成的失败消息，第一次upsert即失败，事务回滚。全仓importSnapshot/importSessionData及两个暂存定义、Message schema、upsert不可变终态约束、真实schema错误均已核对。影响正式导入和原子消息保存（包括调用此保存器的其他生产入口），与队列重试无关；事务中必须先写开放行以容纳Parts，最后统一写入原终态事实，不能放松schema。

实施增加唯一初始消息暂存函数，仅对新完成助手消息临时剥离完整终态错误组，在同一事务的最后重放原Info；两个入口共用。正向测试分别走正式导入和persistMessage，验证完成时间、错误、归属、观察失败和正文都完整持久化。首轮导入history-01与日志保留，新history-02重跑正式导入，成功才启动/ui。原Memory待重试作为独立原事实记录，不声称本轮处理它。

## 最终资格与未完成项

11项正向后端测试/34断言、后端/overlay/transport类型和docs、final build均通过。真实正式导入03与原消息Info逐条相等，原失败JSON保留。79751实际join0，Host68200/Native70672闭合，139331ms、0新Provider请求；页面126关闭。当前真实页面03/04截图人工确认详情层级、主摘要与Return折叠，最终bundle main-B6ejkKmg.js实际200。完整证据和原始失败日志见provider-stream-error-342/README.md。

实际clipboard内容未确认：UI显示Copied，但浏览器虚拟clipboard读回旧303内容，而生产写入使用Host native transport，两者不对应。该无关读回仅保留私有诊断，不提交。原provider overload未新复现，子Dock/Side Chat错误独立视觉未验；原341 memory retry_wait/pending1保留。持续goal仍active，单agent继续，不发布版本。

## 最终事件顺序复核

handleSessionStatus只应用生命周期投影，不再重新聚合；regroupTimelineSegments原来优先生命周期terminal。生命周期契约仅有error字符串，无法携带Message APIError.responseBody，后到的terminal会覆盖刚写入的诊断正文。修改准入：状态仍由当前生命周期拥有，错误展示改从同一session/inputMessageID的最新真实Message settlement读取；没有该消息失败时使用生命周期自身错误。聚合路径同样分别选择生命周期状态与最新消息错误，不按文案相等混合来源、不增加新事实存储。完整类型/构建及新真实历史页面复核后才能作为最终交付。

最终04：main-DrobkXyT.js实际200；types/build重跑通过；9真实消息/21 Parts、0 Provider、页面127截图05/06和Return折叠人工复核。57394实际join0，71982ms闭合，native pile归档。没有新流式错误交错复现。
