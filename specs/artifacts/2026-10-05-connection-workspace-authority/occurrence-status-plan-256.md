# 256 活动投影按真实输入轮次收敛

## Recall

用户要求持续自主体验/修复Sources（来源）与Rendering（渲染），最新只用单agent；root独立实现，不委托或启动新应用成员。上一轮255为实际进展，a139332b8478516e5c7907c3c85fe0847747227a已正常推送，开始工作区干净。真实生成中暂停往返/末尾跟随/暗色来源通过；原普通Session（会话）两次回答已完成，活动栏仍出现第一输入Running（运行中）、无输入预览Idle（空闲）汇总、第二输入Idle三行。原9个Sol流式200/eof（End of File，流结束）、Native（原生进程）/父命令实际0与原失败均保留。

已重读255 Recall/原DTO（Data Transfer Object，数据传输对象）/真实活动栏，当前SessionStatus、ProtocolStore、Task输入轮次投影、两个projectConversationAgentView生产调用、Session hydrate/history/SSE（载入/历史页/服务端事件流）、前端message/Part/生命周期/载入合并、Main/Side/成员共同记录路径及相关数据检查。一次错误路径通配符已用目录rg纠正，不当产品故障。无UI（User Interface，用户界面）自动化运行或新测试。

## 深度与共享影响

原持久数据库只读核对证明每个真实输入的agent.execution.lifecycle已经按inputMessageID完整保存：第一输入从streaming到idle，第二输入也从streaming到idle。SessionStatus把Session当拓扑、输入Message（消息）当执行轮次；ProtocolStore.latestSessionOccurrenceEvent已有按session/input精确读取原事实的唯一接口，不需要从模型完成文案或Message结束推断运行状态。

根因有三处：普通Session/Mission载入仅传selectedTaskID对应的Task（任务）轮次，其余为空，projector因而保留无输入身份的会话汇总；实时层再按parentID创建真实输入记录，形成两套呈现。重连只读取每个Session的最新生命周期且仅回放terminal，遗漏旧输入和idle/streaming/retry事实。前端正文/Part更新把idle或pending推成running、重复Message把非终态推成running，迟到的历史/正文更新可覆盖已收到的idle，即使持久事实正确也留下旧Running。

共同影响为普通Main、未绑定/绑定Task的Side、Mission根会话和Task/成员的共同实时数据投影；不是一个专家团或模型问题。Task载入已有真实executionProjection输入和生命周期，保留其派发/等待/终态权威，不能把单个assistant Message完成改作Task结束。Session/任务历史页已有events数组契约；以原生命周期事实填充它即可覆盖旧页，无需第二份消息或新增配置。源/API（Application Programming Interface，应用编程接口）授权/Project（项目）隔离仍由现选择轮次与会话树边界拥有。

恢复/串并行审查：每条输入独立身份和最新生命周期，第一轮idle不能因第二轮正文重放而改回running；同输入重试由新的真实retry/streaming事实更新；重连订阅先建立，再读取快照与生命周期，后缓冲事件按原顺序释放，不能仅补最新terminal。旧页只补实际页中输入的生命周期。Task/Mission当前输入/派发与恢复仍使用其真实持久事件，不新增业务调度、host（宿主）流程门或模型工具路由。未实际运行的Mission/长分页/重启矩阵不能由代码或普通会话通过推导已完成。

观察到原255退出时为最后idle输入另记terminal/aborted（服务器关闭）。其物理Turn（执行轮次）语义与普通Prompt（提示执行）结束的关系仍需单独调查，不能擅自改写旧事实或将它归为本次运行栏根因；本轮不改变取消/物理终态生产者。

## 实施方案

1. projector以已有prepared输入、真实消息的inputMessageID/Session拓扑以及真实生命周期创建一条输入记录；有真实输入时退休该Session的汇总占位。输入未开始时为pending，运行状态只由原生命周期提供，不以结束Message合成终态。无输入的拓扑占位仅保留其真实准备边界。
2. Session公共入口共用读取当前view（视图）所含真实输入的最新生命周期函数，直接调用现ProtocolStore精确读取。hydrate将它们交同projector，history填充原events契约，SSE快照后回放各输入最新生命周期（含idle/streaming/retry），并与现Task派发事实去重；不改公共响应字段或增加后备协议。
3. 前端消息/Part只能更新内容/目标/时间，保存已有状态；新消息记录先pending，实际生命周期拥有状态转换。沿原源退休/清理机制，不建第二状态缓存或用UI层隐藏Running行。

实施前保存/审查精确文件差异；相关接口/调用点/测试/历史契约全仓搜索后才修改。聚焦正向数据检查覆盖两输入idle/running、迟到内容、Task真实终态/重试、源隔离与加载/事件回放；禁止新增或保留核心负向断言，检索到UI自动化则删除而不运行。检查失败先修工具链并重跑原检查，不改变期望掩盖事实。

## 实际验收与交付

先使用原255真实DTO/持久事实追溯数据契约，局部检查不能冒充端到端。修复后启动当前开发/ui独立页面，成熟完整凭据/模型目录、实际gpt-6.1-sol/流式一致，固定NativeService 600000ms/12请求预算；启动前备唯一退出、原前台命令join、完整脱敏归档与精确自身文件归档。真实普通会话至少两次输入，首轮自然idle、切换/返回、第二轮运行与完成后逐输入记录应忠于生命周期，无重复汇总；截图亲自查看。已有Task/成员只读历史可补验证，不启动新成员；无法资格化的矩阵明确列出。

当前类型/构建、必要文档/架构与相关数据检查仅辅助。同步根/月/相关索引；范围commit（提交）、fetch/merge upstream（取回/合并上游）、审查完整待推送集合并正常push（推送），无分支/工作树/Release/tag/PR（发布/标签/拉取请求），目标保持进行中。

## 实施边界补充

实际完成：服务器/投影最终19项正向检查76断言、实时数据8项10断言，后端/Overlay类型、当前前端构建、docs与architecture实际0；所有原失败日志保留。真实IAB99/开发18192普通会话三轮：原输入分别idle，新输入running，三轮自然结束及重载后手动重开为三个idle，真实Sources标题/域名与首轮定位截图亲自复核。重载中首页阶段不是恢复成功证据。完整11个原Sol流式200/eof，原前台12385实际join0/Native0/独立closure0，精确进程端口与完整复制对退休，13935新日志/未知时间0。所有检查/归档观察结束后仅归档当前原生出生的5个精确文件。当前Task/Mission/长分页/重启宽矩阵没有真实UI资格，退出idle→aborted物理语义仍待单独审计。[完整证据](occurrence-status-256/README.md)。

活动栏现primitive仅在至少3条记录时呈现。正确两轮应只有2条输入且保持原隐藏策略，不能为了验收改阈值或复活占位。实际验收增加第三个普通单会话输入，使3条真实输入的活动栏可以截图/交互复核；不启动Task或新成员。首轮切换截图first-return仅为中间加载状态，first-return-ready才是完整实际复核。

首次原服务器检查实际13通过/2失败：有真实生命周期的hydrate返回500。公共Protocol生命周期由唯一projectLifecycleProperties附加agentID/channel但没有Task投影的kind，原projector只消费Task事件因而未触发此差异。修复沿已有Session拓扑读取stage，已准备的Task输入继续使用原prepared identity；不向持久事件加冗余kind。原响应将先记录错误正文验证该根因，再重跑原检查。检索到服务器数据测试中的纯空权限断言删除；不把数据测试称为UI验收。

现session/lifecycle明确持久streaming/retry不能证明重启后实际Prompt存活。Session聚合的历史执行事件只有在同输入仍由当前SessionStatus实际拥有且真实物理状态执行中时才补运行；Task聚合保留其持久调度权威。历史idle/terminal按原事实读取，缺实际执行事实的真实消息输入仅为pending，不造idle/完成事件。重连/history沿同一读取函数和既有events契约，公共字段不新增。

projector优先现prepared输入与真实生命周期，再把实际消息中已存在的输入身份纳入记录；不是从Message完成推断状态。实时第一次输入退休同Session准备占位，已有状态完全由生命周期拥有；消息/Part不再改变状态。源合并也退休被真实输入替换的旧拓扑占位，防止慢载入留下第三行。
