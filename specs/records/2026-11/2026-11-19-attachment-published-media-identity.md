# 已发布原件的媒体身份保持不变

## Recall

- 用户要求本人持续分批调查，先完整分析根因/影响并落盘，再实施、真实 Windows 桌面页面交互及逐张截图人工复核、聚焦正向测试、范围提交、上游合并和普通推送；明确不用子 agent。本批为第 323 批。第 322 批 `8ae2821e5`、`54ed88926` 已推送，分支同步；原有 177 项工作区改动逐项一致。
- 已读 `AGENTS.md`、当前数据、界面、扩展与控制架构中的原件、执行轮次、公共输入及恢复合同，`AttachmentStore` 的完整发布、校验、读取和回收实现，所有生产 `write`/`writeFromPath` 调用，公开附件/目录上传、Session 提示与命令、Task 创建及消息、Mission wake、全局 Chat 输入，中央错误映射和相关 OpenAPI（开放接口描述规范）声明。已读前两批原始 SDK（Software Development Kit，软件开发工具包）上传、明确媒体类型、零字节和回放记录及现存正向检查。
- 本批优先解决已发布媒体元数据被改写，暂不修改原件 HTTP（Hypertext Transfer Protocol，超文本传输协议）媒体头的后缀映射、SVG（Scalable Vector Graphics，可缩放矢量图形）派生显示或编辑器跨网页角色加载。这些已记录线索需要分别调查，不能用此批结果宣称解决。
- 验收：首次发布的规范引用在同媒体重复、另一媒体冲突、串行/并发、跨进程、重启和多项目下仍拥有同一媒体身份及原字节；冲突得到明确命名错误，公开上传使用 409。旧引用继续被真实提示与编辑器加载/派生/恢复接受，后续轮次正常。完整发布回执即使原字节缺失或损坏，也不能授权另一媒体改写其身份；原媒体的实际字节修复继续可用。原件长度为零时合同一致。
- 使用隔离本机 `acp-review/local` 流式参与者，不使用外部凭据或 GPT-6.1 Sol，不委托 agent。所有 UI（User Interface，用户界面）验收仅真实坐标/键盘、截图及人工复核，非 UI 改动增加聚焦正向存储/传输检查；不新增或运行 UI 自动化。

## 现象、触发与根因

真实基线项目 `prj_hRv5DcSIxBDSSjMAwsjd` 通过公开 SDK 上传 `frozen-reference.dat`：102 字节，MIME（Multipurpose Internet Mail Extensions，互联网媒体类型）为 `text/plain`。同类型重复上传 200，真实原生编辑器会话 `ses_-zUOdXgkOzz1VY3w13hJ` 接受原引用、正常 `stop`，随后 load 也成功。独立网页对话 `ses_hZ9GUaSQxW00g0TT4y1z` 同样接受并保存原引用。

将完全相同的字节及原名改用 `application/octet-stream` 再上传，服务仍返回 200、相同规范 URL，但媒体值已改变。随后原引用再提交得到 500；编辑器 load/fork 均报告 `-32603`，明确细节为 `attachment MIME does not match canonical metadata`。resume 和没有重新附加原件的下一轮仍正常 `end_turn`。正常退出并重启同一库后，load/fork 和原引用再次失败，resume 继续成功。

只读 metadata sidecar（原件元数据旁文件）确认原件现已是 `application/octet-stream`，既有用户文件部件仍是 `text/plain`。两个独立项目对同一 35 字节原件并发同类型重复及另一类型上传，所有请求均返回 200，最终各自 metadata 都变成后来的声明。命名空间仍分别属于各自 projectID；字节仍可完整下载。这不是字节丢失或项目串线，而是已发布引用的媒体身份被更改。

直接触发点是 `validatePublishedPair` 把新请求的 MIME 也纳入“现有原件完整性”判断。即使字节、长度、摘要、规范 URL 和原 metadata 都有效，只要新请求的媒体不同，它就返回 false。`write` 把该结果解释为需要修复，删除现有 blob/metadata pair（字节与元数据对），用新声明重新发布同一 `<sha>.<ext>`。已有锁只串行化了这次错误决定，不能让语义上的覆盖变正确。原有同 MIME 去重、回收保留和非空媒体检查没有覆盖另一 MIME，因此未根治。

## 共享机制横向审计

| 范围 | 代码/事实 | 本批判断和验证 |
| --- | --- | --- |
| 所有生产发布入口 | 全仓 `write`/`writeFromPath` 调用覆盖公开上传和目录、Session 内联/本地/MCP（Model Context Protocol，模型上下文协议）资源、Task/Mission/全局 Chat 字节、工具结果、浏览器/桌面截图、能力目录、前端设计及 Office 产物。 | 共同根因在唯一发布器，不针对某个入口增加例外。各自固定媒体的正常调用继续去重；矛盾的媒体声明是数据冲突。 |
| 锁、并发与多项目 | 每个绝对原件路径由进程内 `withKeyedLock` 及跨进程 `withProcessLock` 共用锁；读取和回收亦进入该锁。实际两个项目的并发请求都发生覆盖，项目 URL 保持正确。 | 不新增锁、队列或影子媒体状态。校验与冲突判断必须仍在同一 pair 锁中，且先于 staging（临时发布）和任何删除；继续做真实跨进程发布检查。 |
| Session 正常/终态 occurrence（执行轮次） | 原生首次提示、load 前置对照、网页提示及改写后的独立下一轮都正常 `stop/end_turn`。旧引用重附加在字节物化校验失败。 | 已接受的轮次正常结算，媒体损坏位于共享数据层；不改执行队列、所有权或终态规则。只读库和实际协议响应共同验证，不用标题或最后错误判根因。 |
| 加载、派生、恢复与重启 | load/fork 共用直接验证原件的回放；fork 失败后按现有合同清理新建子会话，保留源历史；resume 不回放原件。同一正常重启后的失败完全一致。 | 严格读取发现真实不一致是正确行为，不能放宽验证掩盖已改写 metadata。修复发布端，候选重新执行全部路径及下一轮。 |
| Task/Mission occurrence | Task 创建和消息在接受前物化字节/验证引用；Mission wake 与全局 Chat 共用 `materializeUserUploadParts`，规范引用均调用 `requireReference`。截图、工作产物和工具发布最终也使用同一 writer。 | 均受媒体改写影响。冻结领域身份、重试请求和唤醒合同不变；冲突不能通过新的类型猜测或重试修复。代码审计覆盖全部入口，候选保留现有领域正向准入检查，不冒称执行过完整 Task/Mission 外部模型流程。 |
| 故障修复与历史 | 读取已发布回执与验证字节应分开；健康回执在 blob 丢失/损坏时仍携带既有媒体。缺少或无效回执的原 staging 修复合同另行保留。 | 同类型修复字节，异类型先报告冲突。此批保持持久格式和 URL，不自动猜测已被旧版本改写的历史原始 MIME；历史损坏仍由严格 reader 报诊断，不能宣称已恢复这些记录。 |

## 独立角色问题与验收工具修正

最初使用网页会话做编辑器前置对照，网页用户的持久角色为 `chat`，ACP（Agent Client Protocol，编辑器客户端协议）的当前角色目录仅提供 `coding`，因此媒体改写之前 load 就已失败。显式公共 `agent: coding` 仍按网页会话自己的角色执行，不能用它伪造原生编辑器历史。已保留两次对照事实，改为真实 `client.newSession` 的原生会话，强制验证修改前 load 成功，再做第二次发布；网页仅作为独立真实显示会话。角色加载问题另列后续调查，不把它算作本次附件回放失败。

只读持久采集首次误以为 `part` 有 `session_id`，SQL（Structured Query Language，结构化查询语言）报错；已读实际表结构，改为通过 `part.message_id` 连接真实 `message.session_id`，原采集重新完成。没有改数据库、补写消息、清掉失败记录或把工具故障计为产品通过。

## 实施方案、公共合同与风险

1. 将唯一 pair 校验器改为返回已发布规范回执及字节完整性。回执身份的判断不接受新请求的 MIME；保留当前摘要、大小、URL、项目验证与真正存储错误。有效回执与新请求 MIME 不同则在同一锁内、任何临时文件或删除前抛出 `AttachmentMediaTypeConflictError`，数据含规范 URL、`publishedMime`、`requestedMime` 和明确消息。
2. 同 MIME 的完整 pair 继续去重，同 MIME 的坏/缺失 blob 继续通过原 staging 修复。验证 staging 与最终 pair 时仍核实际 MIME 和完整字节。原名是显示来源，保持当前返回及持久合同；不以新请求的原名重写已有回执。零字节仍是合法原件。
3. 中央 `namedErrorStatus` 映射此命名数据冲突到 HTTP 409，与 [RFC 9110 的冲突语义](https://www.rfc-editor.org/rfc/rfc9110.html#name-409-conflict)一致。公开原始上传和目录上传声明真实错误 schema（结构）；能够直接物化字节的 Session prompt/command、Task create/global create/message、Mission wake 和全局 Chat start 的现有 409 联合声明同步包含此错误。没有附件参数的 inject、shell、fork 等不扩大。正常工具调用仍通过真实工具结果传递错误，不做 LLM（Large Language Model，大语言模型）流程分流。
4. 正式生成 SDK、OpenAPI 和对应 API 文档，不手改生成文件。当前数据库、metadata JSON（JavaScript Object Notation，结构化数据格式）、规范 URL 和文件布局不变，无持久格式迁移、版本变更或发布。现有调用者若过去依赖重写已发布媒体，改为得到明确冲突；这是保护已交付引用所需的合同修正。
5. 同一资源的 MIME 比较继续使用现有严格 reader 的完整原字符串合同，不在此批无依据改写历史大小写、参数或相等规则。已有错误 metadata 的原始媒体在所有情况下未必可唯一推导，本批不自动恢复、删除或重命名历史记录。HTTP 原件媒体头和 SVG 显示仍待独立后续调查。

## 正向验收计划

增加真实存储和 HTTP/SDK 正向检查：冲突返回命名字段/409；原引用、回执、字节和媒体继续有效；同媒体去重；健康回执配合损坏/缺失 blob 时媒体冲突正确且原媒体修复成功；零字节、串并行、多项目及跨进程。运行聚焦原件发布保留、上传/下载、ACP 终态/回放及需要的领域附件准入检查，运行 SDK/后端类型、完整路由、文档和架构索引。

候选 `40132/ui/` 实际展开原件并下载，尝试通过真实 Composer（输入框）上传同名原字节的通用二进制，人工查看明确冲突及原件状态；所有截图逐张查看。不做 DOM（Document Object Model，文档对象模型）或浏览器自动断言。使用同一候选持久库重启，验证原生会话 load/fork/resume、旧引用提交及正常下一轮，复核模型精确 `local` 且全流式。证据集中于[本批验收](../../artifacts/2026-11-19-attachment-published-media-identity/README.md)。实施前先提交此规格；候选尚未修改和验收。
