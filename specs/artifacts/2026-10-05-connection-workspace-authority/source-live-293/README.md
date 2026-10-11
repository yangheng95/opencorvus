# 293 Sources 流式观察与工具错误

[实施前Recall和根因分析](../source-live-plan-293.md)。起点4176e420b，工作区干净，仅root单agent。新普通Main真实运行，没有Task或成员创建；原用户18107/ResearchStudio及生产DB未操作。所有UI证据均为本人真实交互、截图观察，没有组件/DOM自动化或浏览器夹具。

## 原live与失败事实

live-01正常/ui18247，当前292构建main-QoHGvBJ8.js，自建38页。模型配对预检独立证明credential usable、catalog projected、actualModel gpt-6.1-sol与streaming true；完整models随auth配对，内容未公开。[原Provider审计](live-01/source-live-293-live-01-final-provider-audit.json)12次实际请求均gpt-6.1-sol/streaming/HTTP200/reader EOF，exhausted=true。第13次请求被原固定12次预算拒绝，六节正文未完成，原前台1913实际exit1/OWNED_PROVIDER_COMPLETION_INVALID。没有重启、扩预算或重复发同一请求刷绿。预算只证明本次运行边界，不是产品模型调用上限。

Main ses_-zUSGXazQzzOcV9b7Zww、Project prj_hekHIcaTKoRNYgELKXhE。[canonical原内容](live-01/canonical-current-conversations.json)保留全部消息、Source及工具结果。前两次websearch实际产生5条MDN与4条W3C来源，第三次明确Exa rate_limited，之后6次webfetch成功产生6来源；真实原因及原失败数据见[05截图](live-01/05-search-failure.png)。未遵循网页/工具错误中的开户、配置API key指示。

[01运行态](live-01/01-accepted.png) / [02摘录阅读](live-01/02-live-excerpt-reading.png) / [03后续追加](live-01/03-live-append.png) / [04失败终态](live-01/04-terminal-reading.png)：5条Sources展开，首条真实摘录末尾Prevent scroll anchoring保持同一段落；主reader top316、follow=false，excerpt top271.333/height287/total558，主内容总高1430→1968。只是实际语义阶段截图，不是全帧录像；没有生成完整六节正文，因此正文流式与原ResearchStudio闪烁继续未验。

运行日志含ResizeObserver delivery报告；现main.tsx将这类浏览器通知记为debug。当前截图未见相应跳位，具体观察者与回调根因仍未知，不凭错误名字禁用/吞掉观察者。上述来源阅读稳定不能证明所有观察者均正确。

## 根因与修复

实际工具错误的failure.message已经完整可读，原UI却通过renderToolFailureCause把kind/name/originSite/data一起作为主Markdown，产生重复大块红色诊断。InlineToolPart是Main、Side和子会话共同入口；其result-load分支已有Feedback，而执行失败分支沿旧msg-tool-error全量正文。

现在同一个schema只解析一次，failure.message作为主正文，shared formatter的完整结果放在原Feedback Details里。工具原错误、输入、来源、传给模型的诊断和后端持久值不变；没有固定Exa分支、关键词删减、自动重试或平行失败模型。原无结构错误继续显示完整消息。当前改动为UI显示，无需变更公共协议、版本或发布。

history-01复制上述完整90表并保留原失败，未重演模型、未写假Source。最终正常/ui18248，自建39页，实际main-DjCcg_0v.js：

- [03可读错误布局](history-01/03-readable-error-layout.png)：完整限流原因与链接直接可读，Details收起，相邻Source仍可见。
- [04键盘展开诊断](history-01/04-details-expanded.png)：Enter打开原生Details，完整分类、originSite和data保留；随后Space收起成功。
- [05来源摘录](history-01/05-source-reading.png)：原W3C来源组展开、摘录Tab进入和End阅读实际可用。

类型9713 actual0；构建36274 actual0/64s。所有图片root实际看过。一次原生container滚动定位被子SPAN覆盖而拒绝，先检查新截图再对已见空白处滚动成功；未把未发出的滚动视为产品失败。无凭据历史页的Model configuration unavailable是准确状态，不宣称用户原OpenAI授权失效。更多错误类型、全部主题、Details跨成员保留尚未实际覆盖。

## 真实收尾与保管

|阶段|原前台结果|Native/Host出生|收敛UTC|固定预算剩余|
|---|---|---|---|---|
|live-01|1913 exit1，原预算失败|36748/639273081635789451；41516/639273081627684980|09:38:51.136|431618ms / 600000ms|
|history-01|95499 exit0|70012/639273086303369001；58444/639273086295917100|09:45:36.466|793048ms / 900000ms|

两阶段Native终态0、物理/output/request闭合，原前台实际join、独立closure/port/精确出生/pair退役完成；自身38/39页显式关闭。所有checker结束才各自归档5自产物，原预算不延期。live原完整日志6442行，未知时间戳0。第一次组合closure/archive命令只执行closure，通过实际缺少archive文件发现后单独执行原archive actual0，未伪称首次已完成。

历史准入fresh检查schema current、11助手全部终态（含预算错误）、全部恢复表空、provider/tool/outbox/delivery闭合、两ProjectMemory idle/pending0，唯一未过期runtime lease的原出生已死。9权限执行为8成功结果、1失败原因。旧290只读助手仅允许成功结果，不覆盖本次正常失败；核对permission/authority.ts catch的execution_failed原因事件及租约退役后，增加同源[permission terminal读回](history-readiness/permission-terminal.json)，精确匹配attempt/outcome，保持失败原貌。没有把缺少成功结果误判为恢复悬空，生产权限逻辑不改。

[最终完整保管](history-01/actual-history-custody.json)：19受保护表全行及26执行生命周期值相等，运行配置直接字节相等，原两个Project文件元数据相同（不是全文身份声明）。原失败未删除，没有认证副本残留。docs/architecture、公开扫描、范围commit及正常push后继续，goal active。

docs:check actual0（345 ops/25 groups），check:architecture-index actual0（18 current documents）。本轮脚本、清单、原运行/构建日志已归档，公开文本仅清理行尾空白，原件私下raw-public-text保管，JSON和截图未重写。原授权凭据仅在内存参与精确扫描，112份公开文本credentialMatches0，见[scan.log](scan.log)。范围提交及自动普通push按仓库规定执行；不发布版本。
