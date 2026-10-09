# 244 Side已提交草稿的显示所有权

## Recall

用户持续自主迭代UI/功能、修Sources阅读与Rendering；授权当前OpenAI/完整models的真实gpt-6.1-sol。最新只允许root单agent。243已推送317f0b5c8，工作区干净，原Native/fore1期限失败已独立保存及全物理/pair退役，不重启/延长/重置。243真实accept/partial图证明User Message已显示时disabled composer仍显示同一已提交内容，挤占阅读区。目标修复显示重复，保留draft/quote/submission身份和现重试协议，真实页面截图复核、normal Native0闭合。user18107/IAB23不控制，不branch/worktree/发布/委托。

已读AGENTS、243 Recall/照片/真实timeline、07-panel、SideChatPanel全部sender/receiver/markup、side-chat service/current Subagent transcript、composer-draft records/quotation与同步session /message。全仓rg composerSubmission唯生产caller为SideChatPanel；store现export composerDraftStore，setText保留submission，setQuotation替换draft使submission退休，clear在HTTP完成且同文本后发生。现同步/message公开契约等待完整assistant，SSE（Server-Sent Events）是真实User Message的事实来源；不改接口/生成SDK/数据。composer-draft.test纯数据（无DOM/组件），本轮未改服务、不运行或新增UI自动化。相关SideChatPanel UI测试文件检索未发现。

验收：相同submission对应真实当前Side User Message且当前connected/healthy/running时，输入与quote重复区域收起，保留status/Stop；不能由发送按钮或猜测时间直接认accepted。正常回复完毕新空输入返回；原text/quote/submission事实不提前删。输入/quote发生变更、identity未知、disconnect/error时显示现草稿以支持原恢复。真实新Source+Side运行中截图、terminal输入与表格/代码阅读亲自检查，当前type/build仅辅助。

## 修改前根因及影响

现象：243两个accept图及16:19:23真实partial均有唯一User bubble及disabled textarea重复同问题。send先composerSubmission mint并持久化一个messageID/text，setSending，await同步/message，只有整个assistant完成且原quotedPrompt未变才clear；textarea仍无条件显示当前draft。保留draft是请求identity/传输重试/重新加载的正确data contract，但UI将已被canonical接受的提交继续当成待输入内容。240仅修auto-grow首次布局，无关这处display ownership；不能靠maxheight/CSS缩掉长草稿、提前clear或协议旁路遮蔽。

采用现唯一store和当前完整Side transcript的身份join：current draft submission.text与现quotedPrompt(trimmed text/quote)相等，当前非inherited messages含同messageID/role=user；connected且running且现error为空才收起。running用现sending||active，包含remount后的实际Side lifecycle。无accepted副本/新signal/假Message/LLM状态机，所有原SDK/JSON/错误/quote/TextField协议不动。errors/disconnect保留现draft区域；quote改写会退休submission，text变更的签名不同，未接受新内容不收起。

范围：Chat/Task-root/Mission source均经同Side panel，key含serverURL/directory/Side SID，transcript已有API/selected owner fence。主要影响textarea/quotation的纯显示；Main/Question/Operator/Mission配置/Provider/调度不改。每message identity仍用现严格parser，不能以角色名称/字符串包含判断。旧UI sending request owner和selection races未在本轮改实现、不宣称验证；如实际出现并发/调度异常，再共享横审。风险：remount后台运行时模型active与connection尚在hydrate，显示以当前事实为准；隐藏后旧textarea ref暂不连接、queuedresize由现AutoGrow disposal保护；后续quote/draft变化要恢复可见原事实，field焦点/terminal尺寸必须实看。

## 实施与验收

SidePanel导入现readonly composerDraftStore，新增纯createMemo作上述join；用一个Show包裹现QuotationChip/AutoGrowTextarea，actions/status/Stop沿现代码。无CSS新策略或transport清理变更，不添加UI测试。

先type/build并准备closure/archive/facts/piles，之后新独立R2026-10-10/side-submitted-draft-244-live-01、18178、E244/live-01、builtin Base、NativeService600000ms及同process12请求，Auth/models成对和usable/projected/actual model/stream200/reader EOF分别验证。Main短只读MDN资料，Side长结构化回复；accept、实际partial、terminal等语义截图，读完即关自有Page/sole shutdown，不延长期限。原243 failure保持。必要helper checker全部完成后最后五个自有Bun文件按exactbirth/bounds归档。

root/month/相关README/current architecture，docs/architecture检查，范围commit、fetch merge全部outgoing审查、正常push；未验证错误/quote变更/selection race与全帧必须如实标明，不把正常Provider代替UI。目标持续active。

## 当前结果与剩余项

已实施唯一派生显示，types78827/build74476实际0（50.59s）。独立18178/own85真实accept、partial、Source展开阅读、terminal表格/代码亲自截图；reading280.333→466，完成textarea72且空/可写。9次Sol streaming200/source EOF、未耗尽；Native75016/Host16400在17:12:35.518正常0，fore42908 actual0、独立closure0、pair清理。全archive/facts实际0、日志10177/unknown0；全部observer终态后5个自有Bun文件精确归档。详细时序与原文件名阶段校正在本轮证据README。

本轮未覆盖quote变更、断连/error、选择竞态与全Rendering帧；Source摘录HTML标签名称缺失已观察到、根因未知，后续先调查再实施。docs:check（345 ops/25 groups）、architecture-index（18 documents/live links）与git diff --check实际0；范围commit与fetch/merge/outgoing/push在当前交付收敛，继续单agent目标。
