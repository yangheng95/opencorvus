# Sources 导航与权限历史呈现

## Recall

持续单开发 agent，用户后续单 agent 要求覆盖旧 Goal 的三 Astra 文本。上一轮513为 progress：8dec671230d273269afe21035af3c8dfef48d3c4 修复 Goal 首页信息层级，九张真实页面图、类型/本地化/样式/正式构建和完整 push hook 通过；fresh HEAD=origin/main。原42877/99731、IAB100/101完整结算，零模型/无凭据副本；两 scope90表156566原行、schema3、完整配置保持。开始仅原有 .bun/ 与 packages/opencorvus/bun/ 未跟踪。

本轮回到用户主要痛点 Sources 显示与 Rendering（渲染中）闪烁，在原页面寻找可复现问题。继续已应用的 computer-use 与 benchmark-debug-template，不委托，不触碰用户18571页面/进程/真实数据库，不新增或运行 UI 自动化测试。

## 修改前调查与影响分析

已读 SourceParts 的 SourceChip/SourceEntry/摘录滚动与 SourceParts 分组、CardParts 的相邻真实 Source 分区、messages.css 来源布局、main.tsx 真实链接委托、tauri-transport 浏览器 open-url/clipboard，以及 Message.SourceUrlPayload/SourceFilePayload 的生产定义。全仓搜索来源定义、展示和链接入口，读取481/482 Sources 真实阅读和聚焦锚点既有结论。初次猜测 message-v2/browser-host-transport 旧路径不存在，已按真实 message.ts/tauri-transport 纠正，不能当产品故障。

当前证据排除“未限制网页协议”：生产 HttpSourceUrl 限定 HTTP/HTTPS；浏览器 opener 再用现有 externalUrl 校验并以 noopener/noreferrer 新页打开。也不能依据新建数组推断全部条目重挂载：原来源按真实 type/session/message/sourceId Key，展开状态按原身份保留。首条直接可见，其余来源和摘录分别控制；摘录使用原 authority/epoch/身份保存位置，切换目标不写回旧阅读状态。未知仍包括当前真实点击/复制结果、实际展开与重开可读性、长标题和来源元数据的当前呈现，需真实页面观察。

本轮先只读，不先造生产补丁。若发现问题，修改前补充可观察现象、直接触发、数据/控制根因、旧路径遗漏、同义定义调用、公共契约/数据/测试/文档/交付风险。当前没有调度/队列/恢复/终态异常证据；出现时立即审计所有生产 Task/Mission/Session occurrence、正常终态、重试重启、串并行/多项目共享机制，不把局部通过当全部排除。

## 启动前方案与验收边界

1. 零模型自有 source-entry-navigation-514-before18959，通过已审查513/510 Source CLI 原生宿主和正式 main-uBAGKTCv 资源启动 /ui，固定20分钟原生边界、启动180秒无活动边界。只读完整 serialize 已关闭513-after90表156566原行与 schema3/canonical；不复制 auth/models、不调用 Provider。新 runtime/config/home/log 与用户隔离，源身份/全部字段/时间及bytes/mtime保留。
2. 在独立内置浏览器页实际选择已有成员/来源，用真实点击、键盘、复制及展开/收起/切换阅读，保存并人工查看目标截图。复制仅使用自有验收来源的公开 URL/文件定位，无秘密或用户剪贴板读取。打开的公开网页按实际新页身份关闭；不操控用户标签。DOM 只读观察不作断言，不合成来源、工具结果或会话。
3. 如有证实根因，在现有唯一实现修复，必要时使用 after18961 新正式构建/新服务实页复验；UI 仅人工交互/截图，非 UI 变更有聚焦正向合同。没有发现产品缺陷则如实限定资格，不能宣称所有 Sources/Rendering 已解决。
4. 每个原 scope 公开 shutdown、原 exec/native/输出/request/launcher/精确出生链结算，关闭自有页。真实数据完整性/模型0及秘密值扫描，归档最小相关证据，更新三索引与 docs/architecture 检查；范围提交、fresh upstream fetch/merge/完整待推审查、正常 push。无 branch/worktree/tag/Release/schema/版本变化预期，长期 Goal active。

## 实页发现与修改前补充

before18959/原48411/IAB102 已实际选择原 Task511 与 B 1cq3。01成员初始处于原长正文尾部；02键盘聚焦原 Source 后标题和域名完整可读；03点击原复制入口，真实按钮返回 Copied 且图标为确认，未读取既有剪贴板。点击原 URL 后即时标签清单尚未发布新页，稍后真实103页出现并核对为准确 ACL 标题/URL，04目标实图已查看后关闭103；不能把即时清单误报为打开失败。无新的来源展示缺陷证据，不能因此宣称全部 Sources 状态通过。

同时真实主区已完成 Task 的历史权限记录显示命令式 Allow Once，视觉上容易被看作待执行操作。代码确认它是 phase=response 的只读 permission-response，不是待审批按钮。唯一 interactionReplyLabel 虽注释为 durable decision，却对 allow_once/allow_task/allow_project/deny 复用了 InteractionCard 的命令式动作语言键；interactionResponseText 仅在已经 answered/rejected 的决定合同下使用此标签，历史 request 另有真实精确范围 disclosure。全仓调用只有共享 CardParts，因此 Main/SideChat/成员 Chat/Task/Mission 的历史都会受同一词义影响，正在等待用户决定的 InteractionCard 按钮不受 helper 调用影响。旧精确权限范围/审批工具修复未分离动作与完成记录的语义。

修改前先只读原 clone 的 permission_ledger、不可变 owner 关联和协议事实，核对实际决定已结算；若有真实 pending/终态冲突，停止把它当文案问题，转共享调度审计。若确定为呈现，修改仅在原唯一 durable-decision helper：本次批准/拒绝复用现有 permissions.event 的过去式键，Task/Project 精确范围补充各一个明确过去式语言键，中英同步。保持真实 request/response/actor、所有状态和错误校验、auto-reply 前缀与 cancelled/stale 终止标签，不修改权限决定或流程。Question 另一类历史语义不擅自随本轮扩大，没有把缺少新实际用例的分支冒充验收。

这是纯 UI 本地化呈现，不新增/运行源码文案、DOM 或 helper 输出断言测试。以正式新资源 after18961 对同一真实权限决定实页复验，检查英文/中文明确已批准，以及原 Source 标题/复制/成员关闭重开保持；原 pending 按钮语言键保持单一原实现，不新增新审批、模型或伪历史数据。无 API/SDK/schema/数据/权限模型变化；风险为历史动作语义误读，使用实际持久事实和相同条目截图限定结论。

只读原库观察实际4请求：dispatch_agents、两条webfetch、manage_task，均有唯一带 decision_slot 的 allowed_once、execution_started、execution_succeeded；Task 有原 task.completed 事件。尾部 stale 均 decision_slot=null，reason 为 The continuation reached its persisted conclusion。进一步读 authority.retireContinuation/continuationReady、ledger-facts 的 slotLocator/authority/retirement 及 EngineStore 投影：stale 是阻止已结算 continuation 被恢复扫描的独立退休标记，不覆盖原批准权威；同一共享机制覆盖 Ask-me 正常完成与 full-access inline 成功、恢复重扫、失败/取消，原项目/Task/Session 关联与决定槽不变。没有新的调度/恢复/终态收敛异常，不能改写原完成事实。05真实历史实图中 Allow Once 是只读文本，确认是动作/历史语言复用导致歧义。

首次私有观察 SQL 把排序列写成不存在的 sequence，真实 checker 退出；只读事务 finally 回滚、没有写库或开始生产修改。读 protocol.sql.ts 的真实 seq 定义后修复原观察器，保留第一份事实记录并新增详细观察，重跑成功；不把工具错误归因产品。另因实际打开的来源新页改变 IAB 的默认可用区域，05实图宽590，相比早先1280更窄；本轮未设置视口 override，不作同尺寸像素或精确布局比较。

## 实施与实际验收

原唯一 interactionReplyLabel 改用过去式决定文案：allow_once 与 deny 复用原权限事件键，Task/Project 精确范围各增加一个过去式语言键；原 InteractionCard 按钮语言键和决定数据保持。共享 CardParts 的真实历史响应继续走相同 status/decision/termination 校验和自动回复前缀，没有新消息、影子状态或执行流程。架构补充历史决定与当前动作的展示区别。

after18961/原82784/IAB104 正式新资源 main-WG2_rq1Y，Node Vite build exit0、7313模块、60秒；原 use-client、静/动态共同引用及大 chunk 提示保留。真实 Task 链接自动恢复，06同一 manage_task/dispatch_agents 原记录显示 Approved once，07切到中文后显示已批准本次；工具身份、请求原精确范围、Task Completed 保持，没有重新审批或调用模型。08原成员B的 Source 标题/ACL域名完整，09真实关闭重开成员面板后仍停在原 Source 阅读段，10中文复制反馈已复制。十张保存图均已人工查看。Scope没有配置模型，真实页面显示的“模型配置暂不可用”是本轮明确无凭据/目录的预期状态，不是本轮新产品错误。

Overlay typecheck、check:i18n（2语言2529顶层键）、docs:check（345操作26组）和 architecture-index（20文档）均 exit0；没有新增或运行 UI 自动化/源码文案/helper文本断言。Task/Project 批准及拒绝是同一纯呈现映射的代码审查，当前真实数据用例均为 allow_once，未将其他决定分支称为实页验收；没有新 Goal/Provider 执行资格，也不宣称全部 Sources、摘录或连续帧 Rendering 已通过。

两 scope 公开 shutdown200、原48411/82784 exit0，原native/输出/request/launcher/精确出生链完整结算；IAB102/104与来源新页103已关闭。Provider实际0/最大0、无auth/models副本，Provider activity391→391。真实 preserve checker 对 before/after 均核对90表156566原行身份/所有字段/时间、schema3实际对象/integrity、完整 canonical 及原 source bytes/mtime，原行差异0。用户18571和真实用户库未操作，无schema/持久格式/版本改变。接下来最小证据归档、三索引/检查、范围提交及正常上游推送；长期Goal保持active。
