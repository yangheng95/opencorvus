# Sources与侧栏Rendering单agent复查

## Recall

用户最新要求只用一个开发agent自主排查，优先Sources显示与侧栏Rendering闪烁，真实体验验证后提交推送。停止所有开发委派；不创建新的产品子成员，既有成员只读。此前418后端集合能力修复已独立提交cb21f21c，完整UI验收仍未达成；原scope全部关闭。旧数据删除是已完成的一次操作，当前v1历史保留，后续格式演进自动迁移。

## 修改前读取与影响分析

已读SourceParts、TextPart/text-part-model、markdown-render服务/worker、CardParts、SubagentConversationPanel、SubagentProgressGrid及07-panel/07-panel-reactivity合同；全仓检索Rendering唯一产品占位在TextPart。SourceParts当前首来源直接展示，其余独立折叠，真实文件行号、引用身份与公开打开合同已经存在。412/328/388记录表明先前修复了历史列表对象身份、成员面板目标生命周期与Task-only指导适用范围，但没有证明所有瞬时Rendering消失。当前新触发和根因未知，先真实页面观察，禁止仅隐藏占位或扩大缓存。

影响面暂为共享Markdown呈现、主/侧会话和历史成员dock及Sources分组。API、Provider、消息/Source持久化、数据库迁移、调度/队列本轮暂不修改；若发现共享调度异常立即按全生产入口横审。用户现有改动保留，无新branch/worktree。无新增/运行UI自动化测试；被触及UI路径发现旧UI测试时删除，不将DOM文字或类型检查当视觉验收。

## 调查及验收方案

先用同一412-fresh当前v1历史、417现有正式/UI bundle、当前后台源码建立独立NativeService scope/18551，完整auth/models配对并验证精确gpt-6.1-sol，累计12请求/180秒无活动/Native600秒。只读既有成员Sources，观察展开、文件跳转、关闭/重开与阅读位置；若需新流，仅由当前主会话直接read并输出，不授权委派。真实UI CUA截图人工查看，不造消息、Source或页面状态。发现明确缺陷后先在本记录补齐触发、根因、调用/合同、实施与风险再修改；修后Node构建实际同区域截图复验。每个自有scope立即公开shutdown、join原句柄、确认physical/output/request后退休配对。

本轮修复独立范围commit，与418一起或分别fresh fetch/merge、全待推送集合审查和正常push。所有未知/失败如实保留，整体goal继续。

## 首轮真实观察

实际页面43只读416已完成成员：来源直接显示README.md/L3，点击后编辑器真实第3行高亮，返回侧栏和展开/收起Handoff后同一来源与正文保留，三张原图已人工查看。这些步骤未复现反复Rendering，不将未复现写成全场景解决。NativeService预检收到实际AI_StreamProviderError服务过载，因此没有发送新的业务输入；公开shutdown fa7bac exit0，原25989已join，关闭页面。再开18553独立scope，只验一个主对话的真实读取和流式展示，明确不委派；仍12请求/600秒/180秒原界限，无新产品子成员。

## 单主会话实际结果

重试scope的preflight明确credential usable/catalog projected/actualModel gpt-6.1-sol/streaming true。真实页面44提交只由主会话分别read第2/3行的用户请求，第一次业务请求2秒后发生Provider服务过载（04原图）；同一会话通过真实用户续行再次发送原请求，没有更换模型或创建任何成员。实际主Session ses_-zURzTlJFzzacrP6FufN的只读数据库事实只有一个Session，两次工具都是read，分别绑定精确Source范围2–2与3–3，最终assistant自然finish=stop。

07原图实际展示两个真实Source及完成正文，06展开原始读取结果，08实际文件第2行高亮。第3行来源复制经真实Ctrl+V读回完整路径README.md:3，草稿随后清空且未发送。当前Source行24px，直接可见文件名/行号，工具明细仍可独立展开，不重复旧图中的“Sources 1”空标题。既有成员的来源跳转/返回也已由01–03实际复核。

本次未复现重复Rendering，没有据猜测修改共享渲染器或只隐藏提示。AX观察到主回复继续生成至第六小节，但05截图已自然完成且Home默认滚动到了页顶，故05不能作为流中来源画面；后续06–08均是完成态。严格保留这个未达成边界：尚未得到流中侧栏反复闪烁的完整复现/消除证据，不能宣称问题全面修复。当前主会话和已完成成员都未创建新子agent；没有UI自动化测试、DOM断言或合成消息。

两scope共10条真实Sol流（before2、retry8），全部原Provider审计保留。retry公开shutdown 2cea55 exit0，原32807 join3818ac exit0；before原25989 join c3cecc exit0。两scope physical/output/request收尾和auth/models配对退休均真实完成，页面43/44关闭，当前v1数据保留。源码本轮没有新增UI修改；8张截图、错误、实际Source/Tool关系和收尾见[证据](../../artifacts/2026-10-14-source-render-review/README.md)。

## 已提交修复与推送检查

418生产集合能力修复cb21f21c42a72d138f35d45830ac1966a01ccc67已独立正常提交，12项188断言通过。fresh fetch/merge后完整待推送还包含其他人类任务的17ee22b8e（通道当前语言/失败草稿修复）：其记录、实际32图、14项42断言和交付边界已只读复核。正常push31750 join253f61 exit1；全类型检查8项成功，随后api:routes-check报告generated-openapi-differs-tracked-openapi。

根因精确定位为另一任务未提交的transport-protocol VcsCommitMessageStreamEvent新增必需code字段，以及vcs-stream-error/TaskDirBar消费；tracked SDK仍对应原合同。这些变更不属于本次修复，直接覆盖外部source或只提交孤立SDK会使提交树接口不一致；未绕hook、未回退或混入该任务。其后的8373c591a是该已授权通道任务的交付记录，保留同一阻塞。当前只收敛本次调查证据，随后仍fresh fetch/merge、复核完整待推送并正常重试；结果以实际工具回执为准。
