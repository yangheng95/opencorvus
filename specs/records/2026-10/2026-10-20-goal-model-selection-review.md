# Goal 页面模型选择与首次使用闭环

## Recall

持续单开发 agent，不委托；后续单 agent 指令覆盖长期 Goal 中旧三 Astra 文案。上一批478为 progress：1b7d02d30319a557ed4a1469dd5e7544fcc2beb2 已正常 push，fresh fetch 后 HEAD=origin/main；原物理终态复用、28例/84断言和完整配置三轮验收完成，但完整保存约16.9秒/恢复16.3秒仍未达原10秒/5秒标准。全部原native/writer/reader/output/request结算，完整运行与private凭据对退休，既有149 Project/198 Session/schema3与原Sources32/72/62行保留。当前仅原.bun/和packages/opencorvus/bun/未跟踪。长期 Goal 未完成。

用户要求深入体验、持续改进 Goal 可用性与默认页布局、Sources和Rendering，实际页面验收并提交推送。本批回到 Goal 首次使用。477已修缺模型时假Active，真实blocked和显式恢复有证据，但恢复是启动前明确配置canonical默认model/small_model，未覆盖真实页面模型选择和Provider设置流程。不能把那次恢复冒充本次完整路径。

已读AGENTS、477 Recall/全部验收、continuous-goal架构、App/Home创建移交、main.onStartGoal、conversation-session两个创建入口、workspace.resolveGlobalComposerSubmissionContext、composer-model唯一选择/Session投影、ComposerModelSelector及config-dialog-control、共享Goal表单/样式。全仓调用搜索证明main.onStartGoal已在异步导航前读取composerModel并传给全局和项目Conversation创建，不能以未经验证的“遗漏模型”作修复依据。既有模型选择器仅列真实连接服务商，Session选择使用唯一patchSessionConfig，不能再加默认猜测或第二模型配置面。General页不提供默认模型编辑，Provider设置用于连接；其与实际选择的操作区别须按实页确认。

继续沿用benchmark-debug-template和内置浏览器，禁止任何UI（User Interface，用户界面）自动化测试、DOM（Document Object Model，文档对象模型）断言、组件/截图测试；不用单独Vite。不动用户18571、用户进程/窗口、用户库或旧QA历史。没有新branch/worktree。schema、公开API（Application Programming Interface，应用程序接口）、Goal调度和持久化无预设变化。

## 调查前分析与未知

原可观察边界：477的真实首页显示模型“继承配置”、Goal入口与指引，截图无足够证据证明模型选择全流程可用。缺模型Goal的原因已本地化，但用户从该状态找到、连接并选择模型、恢复同一Goal是否清晰仍未知；不能把缺少凭据、目录未投影、模型未配置混作一个错误。原Home布局对话输入和Goal入口分开，尚未证明新的遮挡/溢出或错误状态。本批必须先实际交互再决定修改。

若出现任务调度、唤醒、恢复、并发或终态异常，立即按共享机制审计全部Host/Task/Mission/Session、正常与终态、重试重启、串并行和多项目，以事实排除局部假设。模型选择改变的Session配置必须从canonical读取核对；UI文字和模型自述不能证明实际请求身份。纯界面改动不新增自动化；如触及非UI行为，补聚焦正向契约并进入正式checker。没有发现需扩大的死代码清理。

## 实施前方案

1. 新建自有479-data/runtime/project/home/appdata/localappdata，初始canonical为空，仅完整模型目录元数据；真实源码CLI开发服务18819、当前477最终正式UI，通过原413 owned-host与446 release helper监督，20分钟监管寿命，180秒真实无活动观察。沿用现有成熟启动/结算原语，先确认端口无人占用。新根不缩小此前完整配置性能资格。
2. 在独立内置浏览器页面查看中英首页/Goal指南、空模型选择器及Provider设置，实际创建有限1轮Goal并观察缺模型blocked、原会话/事实。所有截图实际呈现人工查看，原日志在下次启动前冻结；不发送未授权登录/外部变更。
3. 如果真实模型选择需要当前已授权凭据，前一scope原physical/output/request/launcher完整结算后，创建private完整auth/models对，源不refresh/exchange/写入；成熟stageDiagnosticProvider只成对暂存凭据与目录，不预设canonical模型。分别验证凭据、精确gpt-6.1-sol目录和实际流式预检。在启动前固定整批最多6次请求，包含预检和所有helper；最终计数后分配下一scope，不活跃扩额。通过真实页面选择模型再创建/恢复，确认Session持久配置与实际请求模型一致。未用尽也不额外制造请求。
4. 根据真实结果补充根因、影响面和实施方案，再改唯一原实现；UI需正式构建/当前renderer检查、独立源码CLI新scope真实重截并人工复核。实际页面不能获得时明确未达成。不能用提示、gate、fallback、修改用户原文或弱化检查遮蔽功能问题。
5. 每scope公开shutdown与原句柄join，原physical/output/request/launcher及全部模型source reader EOF（End Of File，流结束）完成后退休完整运行对；按实际凭据值检查自有证据后退休private对。三索引、相关当前架构、文档/i18n/类型和必要聚焦测试，范围提交，fresh fetch/merge、完整待推集合审查、正常hooks push/fresh fetch。目标保持active；完整配置10s/5s、Sources/Rendering广泛验收仍保留。

## 实际路径与实施前补充裁决

before原1921在18819真实创建pev_g0VYbeG9M00ru2dhyMQ7 / ses_-zUROLjuLzzR85idVwtO；随后公开读取为blocked/model_not_configured、0轮、0消息。空模型菜单的Configure Provider可达OpenAI设置，Connect/API Key均可见，但本次没有触发登录或输入密钥。实际图01—04已查看。公开shutdown200、原native/output/request/launcher exit0并冻结原日志，之后才分配恢复scope。

recovery原67464在18821只暂存完整auth/models，不改空canonical。精确Sol预检2/6个请求先完成；实际模型菜单列12个已连接模型，页面点击GPT-6.1 Sol后Session配置真实落盘。原Goal显式Resume，唯一Goal ID保持，1轮/33642令牌、实际文本GOAL_MODEL_479、模型自行complete；此时4/6全部EOF。随后从New chat进入无目录Home，显式选择偏好保留，确认新Goal创建到真实匿名Project，Session配置同样为openai/gpt-6.1-sol；pev_g0VYbfTed00GsWyP2RtS / ses_-zUROKWdqzzKxtcY8vK6以1轮/33825令牌、GOAL_HOME_MODEL_479和真实complete完成。整批6/6实际流式200/EOF，无扩额，完整canonical仍为{}。没有证据支持修复模型传递、fallback或新增配置面。

Home第二个Goal的工具结果与完成文本先可见，状态条短时仍是Budget reached/0用量；公开API读取为complete/33825，后续图09已显示相同Complete用量。当前架构明确控制条五秒只读轮询，event-policy也将continuous_goal事件作为非消息消费；这一观察不能当成调度失败或持久化丢失。原调度/Task/Mission机制和状态事实未改。只有当后续要改即时投影时才应完整审计全部Session/Task/SideChat流，不在本轮暗加局部事件旁路。

本轮已证可改进的是共享指南第一步的操作指引：旧文案“先连接服务商并选择模型，或配置默认模型”没有说明实际控件位置；实页确认唯一已连接模型菜单位于输入框下方，列表为空时同一菜单有真实“配置 Provider…”入口，而General没有默认模型编辑器。决定只改两个locale的第一步标题/正文，明确这条页面路径，同时保留合法继承默认模型和确认后创建Conversation、既有会话顶部控件的事实。其他reason共用于Task/Mission/SideChat，SideChat没有同一Composer菜单，因此不把主界面的方位错误套到共用错误原因。数据/模型解析、API/schema、调度、权限、消息和测试合同均不变，纯UI文案无自动化测试新增。

原恢复scope已公开shutdown200且67464 join0；运行对退休后再正式build，使用全新无凭据visual root做中英指南/创建取消人工截图。真实模型6/6资格来自同一实际生产选择和创建路径；locale改动不冒充额外模型请求。新视觉根不替代既有完整历史与性能资格。

## 实施及最终验收

生产仅修改en-US/zh-CN的指南第一步标题和正文，共4行；模型传递、Session配置、Controller、Provider与权限保持原实现。正式build96698 exit0（约63秒+renderer checker）、overlay typecheck87716 exit0、i18n两语言2523 key通过。纯UI改动没有新增或运行UI自动化；检索到的continuous-goal-service是HTTP适配器的非UI正向契约，本次无行为改动，不以重复其mock测试冒充端到端。

新冻结479正式UI由原73685 native在18823真实源码CLI开发页面提供，fresh visual root无凭据。中英文指南、中文创建表单及取消后首页已实际截图并人工查看，英文完整文案与底部关闭操作均可见，中文控件与正文一致。新根1 Project/0 Session/schema3，取消没有创建Conversation；真实业务根3 Project/3 Session/schema3，各自对应原Goal、独立实际Provider预检和Home新Goal。两个Goal原用量关联分别33642/33825且公开配置均为精确Sol、canonical始终{}。[完整13张图、真实消息与原事实](../../artifacts/2026-10-21-goal-model-selection-review/README.md)归档；没有读取用户或旧149/198历史库。

三个原native1921/67464/73685均公开shutdown200、原句柄exit0，精确物理、output/request/launcher结算，日志都冻结。实际6/6请求含全部helper，200/流式/原source EOF全部早于运行对退休；2636个自有文件/95331155字节按5个实际凭据值检查clear后，private完整对退休，源凭据stat不变，没有refresh/exchange/源写入。自有tab38/39/40关闭。UI新根只使用模型目录元数据，无凭据和Provider请求资格声明。

边界：仅两个有限Work Chat Goal完成，服务商登录/密钥保存与Task/Mission真实Sol仍未覆盖；当前五秒状态轮询未优化，完整配置10s/5s仍未达到，Sources/Rendering广泛验收继续。没有新Release、tag或版本更新；长期目标保持active。提交推送仍须按原正常hooks与fresh fetch要求完成，不以当前文档预称尚未发生的结果。

最终docs:check通过345 ops/26 groups，check:architecture-index通过20篇当前架构文档。artifact归档日志只规范行尾空白，原私有运行日志保持；没有重算源码摘要或UI自动化作为验收。
