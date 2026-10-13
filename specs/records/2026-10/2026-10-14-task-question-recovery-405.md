# 405 Question 执行恢复权威与终态反馈

## Recall

用户原始要求：持续按批次并行体验/调查 UI（User Interface，用户界面）、功能与缺陷；根因/影响分析先落 specs，实施后真实桌面页面、原截图人工复核、聚焦正向功能测试和需要的授权 GPT-6.1 Sol 验收，范围提交、拉取合并上游和正常 push（推送），自主进入下一批，直到用户明确停止。目标 active，无 token 预算。仅既有 audit_functionality/audit_ui 单层两 agent，禁止再次委托。

404 范围提交 e70e3dc55cc7c9627b81fc3f6b12274394240f64 已创建，正常推送仍在检查。真实 Git 基线/read/页面 Stop 取消、Main Dialog/inline/SideChat 同 Request 草稿重连、普通 Session 崩溃后的完整当前可回答集合、真实 Sol Question 自然准确回答均有原证据。Task source-only red03、ASCII310 原 Windows native cwd267、Task 正常业务完成/result checkpoint 与 Work/Mission 独立页面 Question 尚未满足，不能继承成通过。404 所有 Root 页面/服务/模型与 Agent 正式 checker 均已关闭，不能沿用其已结束的期限重新起任务。

已读：404 Recall/原红与交接、task-question-recovery-authority-review、实际 Question 六个生产入口、Task root activation/dispatch 与 SessionLoop interruption、Mission process recovery、host/bootstrap、Question 唯一原发布事实和 pending waiter；当前 panel reactivity、Task control/runtime directory。全仓只读 callers 与 source-excerpts 由功能 agent 冻结到 .tmp-task-question-recovery-405；Root需复核完整反馈才批准生产。UI agent 阅读404五原JPEG及当前 SideChatPanel/service、interaction/transcript/CardParts，未运行页面或 UI 自动化。

硬约束：无 UI 自动化/DOM（Document Object Model，文档对象模型）/渲染/快照/源码文案测试；所有模型流式；不以标题、最后 error 或模型自述作根因。单一事实来源，不造 Abandoned/时间/消息/决定，不以 Session pending 过滤遮蔽 Task Board。只能本任务隔离服务/页，用户原进程不可动。需要真实 Sol 时 auth/models 必须配对、凭据可用/模型投影/实际精确模型分别验证，原600s/请求20/180s无活动期限及60s收尾、先页后物理结算后原父清理；不写凭据。只提交本批，保留并行改动，正常钩子不得绕过。

压缩恢复后先重读本 Recall、最新批准范围与每个 original owner/deadline；不覆盖旧失败、不从最后错误猜原因，不重复已验收轮次。

## A. Task Question：已证实问题与尚缺证据

现象：404 red03 原 Accepted Asked commit 未物化 interaction 行，真实生产进程 crash23 后，新服务正常 bootstrap 最后 Board pending、Question canonical[]、public reply404。原已回答控制仍能按原 occurrence/time/answers 收敛。一次 Project-only recovery只扫已经物化的 request，异步 Asked replay随后才补行，形成扫描时序缺口；该入口没有原 physical owner fence（物理执行所有者围栏），不能无条件 restore 空 Promise waiter。

新增生产合同核实：普通 tool/question、orchestrator.question、analyze_intent 均不传固定 requestID，依赖原 Promise 执行并在正常 dispose 发布真实 infrastructure Abandoned；只有 A2A（Agent-to-Agent，代理间协作）工具以 deterministic requestID、action/epoch 提供明确 durable continuation（持久接续）。Task root 的真实 activation 失效后，既有 interruption 将普通 Tool 结束为明确 error，respond_agent_coordination 才有原 exact reexecution（精确再执行）。404 red03 固定 requestID 且没有 Tool/activation 是未绑定持久夹具，不能冒称普通 Task Tool 恢复已证明。

影响横审必须覆盖所有六个 Question producer/公开回复入口、Task/Mission/Session occurrence、正常/终态/延迟 Asked、重试/重启、单/多进程、串并行及多 Project。Task root activation owner_occurrence、dispatch 原 admission lease/pipeline/Prompt generation 和操作系统 processInstanceID 可提供各自原 owner 证据；native capsule binding、lease 时间和最新 PromptOwner 本身不能证明原 Question owner 已死。Asked outbox当前不带 publisher physical identity、Request.tool可选，缺绑定的旧记录保持未知，禁止补猜。

当前分析方向（尚未批准生产）：原事实先唯一物化；普通 Tool 在确切被授权且证明原 owner 死亡的真实 interruption 边界接受 infrastructure terminal；durable A2A只由原 exact continuation owner接续。仍活/未知 owner 保留原事实，不安装第二物理 waiter、不生成假终态。若替换恢复 owner，删除旧 Project-only unbound restore，不留两套恢复权威。需要实际公开 Task→真实 Provider QuestionTool→Message.activation/Tool/source→crash→正常启动的红态与 still-alive/unknown/terminal/delayed-source/multiProject控制，之后 Root 完整读方案并明确精确生产路径与正向验收指标。

## B. SideChat 重连反馈：已证实展示缺口

404 原 Side 图在断流前无反馈 banner，重连后及自然回答完成仍有红反馈，而 footer恢复绿色。截图未展开 Details，不能仅凭截图声称具体 error 字符串。代码显示 SideChatPanel 单个 error string 同时承载 transport/onError 和真实业务/动作错误，connected 或自然 final不退休旧 transport。直接根因是不同寿命反馈被放入同一状态；一次连上就清全部 error 会抹掉真实失败，同样不正确。

候选最小合同：自动恢复 transport 使用既有 connected 与本地化 connecting 状态、原 retry 和 AppLog 保留实际诊断；业务/session/protocol/action反馈仍完整可见。footer先表示当前连接，再表示真实 running。无新的网络状态缓存/定时恢复/host gate。精确路径和完整 cold/side-owner/terminal/多Project影响面待UI最终报告，Root先保存before原输入后授权。

## C. Question 终态历史反馈：已证实代码缺口与视觉未知

404 empty header 原 Request合法，中文 pending控件和真实 expiry已通过；最终截图被 Project tooltip覆盖，精确历史 caption视觉仍未知。当前 transcript空title落入detail.pending_interactions；interaction adapter只为answered/rejected造response seed，expired跳过。实际 status/time/response已经来自真实原terminal，因此候选是展示缺支，不能重写事实或以硬编码英文回译。

方案方向：复用原 interaction-question part 的 request/response展示 phase，在既有CardParts/TextPart用当前 t（翻译函数）格式化真实语义/原Question正文；不在tree-writer预存译文，不增协议part/SDK（Software Development Kit，软件开发工具包）或第二pending来源。需要列四terminal/正常标题与空标题、Main/Side/Task/cold历史、同实例中英切换的完整公共展示合同。Task旧英文Question标题另有producer须明确处理或排除，禁止标题字符串匹配。

## 调查与批准顺序

1. 两既有 agent 仅调查、写独立scratch、保留原代码/公开数据证据；不改生产，不运行新服务/模型/UI或创建测试直到Root批准。
2. Root读完整报告、相关源/测试/架构和全仓调用，落盘每项最小实现及旧路径删除范围，再授权非共享文件。Task若缺真实入口红态，先以公开Task合法Research Studio input及原 bounded process primitive调查，不以fixture-only结果跳过。
3. 非UI改动必须明确正向输出/状态/错误合同且进入正式checker；UI只真实桌面 `/ui` 交互、原JPEG和人工复核。每个原scope固定期限，长跑定时观察，不延长或持续监听。
4. 真实 Sol仅在所改Task恢复/模型行为需要时采用已授权成熟原生服务；受控 Provider不冒称真实模型。先全流程合法输入/工具链，再做有限真实验收。
5. 同步唯一架构/CHANGELOG/索引、当前声明docs检查，范围提交，fetch+merge/full pending set核查、正常push；保留未满足和原失败，随即下一批。

## 完整反馈复核与第一阶段授权

Root已读功能analysis.md全文及18源摘录索引、UI analysis全文，另亲自读Task-root expired activation选择/terminalizer、SessionLoop原coordination恢复/普通interruption、EngineInteraction恢复函数和共享UI seed。明确旧Project-only Question.restore既有缺陷：没有physical owner而恢复空waiters，且fixed-ID旧测试无法证明真实普通Tool续作。A2A的原exact action/epoch/Tool恢复是唯一现成durable业务合同。原expired lease用于写入fence失效，不等于OS死亡；新增Question终态前必须补精确原owner观察，不以该时间或latest SessionPromptOwner猜死。

批准audit_functionality第一阶段仅独立scratch真实过程红态/控制，禁止生产修改及再委托：复用既有正式isolated runner/controlled streaming Provider/NodeProcess owned_tree与合法public Task admission，Research Studio完整包及catalog/mounts preflight保持。Task由实际HTTP接纳、原Git baseline自然产生，Provider真正调用普通Question；必须捕获原Tool/message/call/assistant.activation与activation owner/runtime_process/exact OS事实，不能手工persistEstablishedTask/插Message/调用Question.ask替代。仅原Accepted Asked delivery hold允许，原producer真实exit23/物理join、新child正常产品bootstrap/Host恢复；不直接调用恢复函数制造完成。父600s、顺序child≤180s、请求≤30s、60s收尾，同原deadline不增补。检查原Tool真实interruption和Question/Board原终态完整合同，先保留当前红；准备还活backend控制时另立fresh600s双owner scope、正常API回答A、B明确exact_live与当前集合，不造OS结果。无Task业务真实Sol、无UI操作、无凭据。首次合法输入/工具链错误先修新helper并保留原失败，不延原scope。报告再由Root落生产最小合同。

批准audit_ui目前仅独立scratch人工服务helper准备：将404已结算成熟Main empty-expiry和Side Question driver/server按精确路径移到405、旧source不覆盖，仍用已验证透明relay/current私有ui-before源；固定600s/原父物理后清理与30s真实Question业务期限。禁止启动/页面/模型/生产改动。Root先读helper并实际重新截图Details/清楚expiry历史标题。UI实施候选范围确定为side-chat service/SideChatPanel及interaction/transcript/CardParts和zh/en两组键；transport日志复用AppLog、保留业务错误、current lifecycleVersion guard；Question仍原part、phase仅派生展示、原Request/terminal/time保持、render实时翻译。不增加Task标题producer改动，该已知空标题英文字面值另列边界。before实证后Root追加实施授权才写生产。

工具链适配精确扩大第五scratch文件：旧relay-driver以自身import.meta父目录验证scope必须为404，因此405输出不能直接使用它。批准405新relay-driver只将http-relay import指向原404已验证实现、scope说明改405，其目录校验/实际forward算法/原owner/deadline/control完全保留；405两新人工driver调用自身新relay-driver。404原driver/control/算法不覆盖，不将输出写回旧scope，不绕过校验。此为当前真实checker可运行的路径修复，不变更产品或验收输入。

404 normal push02已退出0，原日志7897d1bd1..e70e3dc55 main→main；fresh fetch确认该提交是origin/main祖先、当前main同步。首push01只因默认Bun1.3.14被正常hook拒绝；已切正式Bun1.4.0重跑fetch/merge/pending集合检查和push，八包类型与全部正常checker/secret-scan0通过。新405分析不能把404原Task red03或超长cwd未知变成通过。
