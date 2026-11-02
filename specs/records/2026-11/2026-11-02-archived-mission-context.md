# 已归档多步任务的原请求阅读（893）

## Recall

用户要求持续单agent（代理）自主排查UI（User Interface，用户界面）/UX（User Experience，用户体验）和功能，实际体验验证后提交推送，不操作正在使用的窗口。后续单agent要求覆盖旧Goal的三Astra文字。892是已改变权威状态的progress：ec3fc4fcb955addb4575582257ec6bf653ad24a7已正常推送，fresh HEAD=origin/main、0/0，24普通文件/2本地化字段/三索引行干净、177项无关改动保留；原句柄57462消费exit0、公开关闭HTTP200、物理身份/输出/请求闭合、配对凭据/完整模型目录退休。源892-final严格资格259215行、schema9/92表、100项目文件/Git、229附件、0模型请求、累计1260。

已读：AGENTS；892 Recall/15截图/资格/推送；当前07-panel空Mission与Archive/selected reader合同；2026-10-05-mission-draft-context历史根因/限定；Conversation完整空Mission判断、savedMissionRequest、标题、请求区域及Board按钮；main唯一Conversation挂载和selectedItem资源身份/刷新/错误/恢复合同；App现标题/归档只读提示/唯一恢复入口；work-ledger生产active/archive/selection三个reader、workLedgerMissionFromCandidate及transport（传输协议）严格行；missionRecord/missionPendingPrompt与原请求持久化；MissionBoard全页active list；session hydration/SessionBoardEnvelope及session.updated处理；现work-ledger-search后端测试，真实memoryProject/公共HTTP（Hypertext Transfer Protocol，超文本传输协议）调用与正向错误契约；SDK（Software Development Kit，软件开发工具包）生成器和公开路由检查入口待生成前复核。

## 修改前根因与影响

892的11截图是实际触发证据：从归档打开本人未执行草稿，页头显示真实“归档项目检索892（未执行）”，正文却显示内部Session ID和通用“暂无对话”；实际Mission公共reader仍有完整pendingPrompt。持久数据正确。直接触发为归档后active工作列表不再包含该Mission：正文标题用workLedgerActiveItem，正文请求用missionBoardStore.records，两者都只读active列表；标题区域已用独立的当前selectedItem reader，支持原归档身份。旧修复只覆盖未归档草稿并绕接了看板列表，未根治当前阅读者与列表成员身份混用。

选择唯一当前实现：在现WorkLedgerMissionRow增加可选pendingPromptText，只投影现missionRecord.pendingPrompt?.text，不另读原始metadata、不复制持久数据、不合成消息。active/archive/selection共用workLedgerMissionFromCandidate；transport严格行、OpenAPI（开放接口描述）、SDK类型、生成文档同源更新，不增加新接口或兼容路径。无pending请求保持字段未设置，不从空transcript推断“未执行”。字段是只读投影，不改数据库schema或持久格式。标题继续沿同一selectedItem而不是hydration旧标题，支持既有改名/刷新。

Conversation新增一个现selectedItem函数prop（属性），唯一main挂载传入现资源；只有已完成hydration的空Mission且row.kind/sessionID/规范directory一致才显示它的标题/请求。删除本区域对missionBoardStore及active工作列表的依赖；元数据尚未可用时沿已存在泛化Mission标题，绝不展示其他行或把ID伪装成标题。请求仍为原有只读上下文区，不进入消息树，无第二编辑器、请求owner或缓存。当前selected reader的既有authority/epoch/AbortController/refresh token已负责选择隔离和更新，不另建状态。

归档正文显示两语言明确提示“先恢复再到任务看板继续”；Board快捷按钮仅对未归档记录呈现，归档沿App已有唯一Restore入口，避免跳到排除归档工作的看板。未归档原编辑/开始路线保留；原真实消息存在时仍显示原transcript。任务、Chat、普通Work、Provider及工具定义不变。此次是被动读取与展示，不触及调度/队列/唤醒/恢复执行/终态，未发现相关异常；若实跑发现，立即按共享机制全入口横审，不能用本次页面通过排除调度风险。

全仓定义/调用点：transport WorkLedgerMissionRow为active/archive判别联合唯一行；后端同一构造器由三个reader复用；前端work-ledger API严格parse同一行、selectedItem已有单一读取/当前性合同；Conversation仅main一处挂载，原savedMissionRequest仅这一展示区使用。公开响应新增可选字段，客户端不需要fallback；生成类型/文档必须同步。已有work-ledger-search测试不含UI自动化或负向核心断言；增加聚焦正向用例覆盖同名不同项目、当前请求/改名、active/archive公共selected reader和完整行，先运行原实现失败，再修后重跑。其余UI只能真实交互截图人工验收。

## 实施与验收

首次before/after额度各0；75分钟共同绝对截止、5分钟闭合预留，不加额/续期/重启。before复用892最终UI，before源892-final，after源严格合格before；CLI（Command Line Interface，命令行接口）38613/38614的`/ui/`，Node.js构建本人UI目录，不启动独立Vite。凭据与完整目录配对准备/验证/退休，保留全部旧行/项目/附件。只读已有892归档草稿；after若验编辑/改名，只操作本轮新建手动893草稿，不启动模型，不修改任何旧行，不永久删除。

1. before实际打开892归档草稿及刷新，截图确认标题/请求遗漏；生产reader核对相同身份和原文。正常闭合原句柄/HTTP/物理链/配对副本/全旧数据资格后改产品。
2. 聚焦后端正向失败；唯一投影与严格公共行、当前selectedItem展示及双语言提示；删除旧列表读取路径。读取现SDK生成器后实际生成，类型/本地化/CSS（Cascading Style Sheets，层叠样式表）/文档/真实路由检查与Node构建。
3. after同一旧892归档原文/标题/只读/唯一恢复入口，中英文截图与刷新；不同项目已有active草稿显示自身数据。只在本轮新建893草稿实测编辑、改名、归档后当前原文和标题一致，不执行。未知状态不得声称覆盖。
4. 本人服务正常关闭、原native句柄exit0、物理链/输出/请求闭合、配对副本退休和严格全旧数据资格；三索引同步，范围清晰提交、fresh fetch/普通merge/完整待推集合复核、正常hook/push、fresh0/0。持续Goal保留active。

## before与实现进展

38613的01/02截图实际复现归档892的页头原标题、正文Session ID及通用空提示，刷新后相同。公开Mission reader逐字段等于上一轮rearchived原记录；原pendingPrompt完整、选中reader无此投影、hydration为原归档Session且0条transcript。未恢复、改名或编辑任何旧数据。原服务63522消费exit0、关闭HTTP200、物理资源闭合、配对副本退休；严格资格259215→259217仅两条租约，100项目/229附件/schema9/92与源数据保全，0请求、累计1260。

新建纯后端正向测试，原实现在公共selected reader精确缺pendingPromptText处失败（0pass/1fail、2断言），不是运行器故障。唯一行投影及当前selectedItem接入后，原新用例与现work-ledger-search共8pass/68正向断言，overlay类型通过。SDK生成前审查其现事务生成器和实际generate-openapi入口：使用bootstrapIsolatedTestRuntime，产物先在已加锁的package暂存区生成/编译后提交，不访问用户DB；原SDK工作树干净。新增字段由同一transport严格行生成，无手工修改生成产物或旧协议层。

## after实际验收与闭合

38614实际加载main-BJxtHaPY.js。03/04同一旧892归档直接打开和冷刷新均显示原标题、完整原请求与明确归档提示，原归档时间不变；11中文同一原记录再读一致。05切换另一项目已有888草稿，显示其自身标题/请求和可用Board操作，没有修改旧草稿。06通过实际UI新建本轮“归档草稿阅读893（未执行）”，Work/Base、原项目773，Mission 3f5facf3990ef2a6、Session ses_-zUQDD7rezzOW8NsCJtX。请求区保留真实多行原文。经当前Board按钮进入原编辑器追加一行、保存后打开同一选中草稿，07直接显示新原文；当前页菜单实际改名，08页头/正文同步为“归档草稿阅读893（已改名，未执行）”。只归档本轮实体后，从Archive再次打开，09/10中英文显示同一新标题、全部新请求及归档提示，沿原页面唯一恢复入口。四步公开reader分别核对同一Mission/Session、精确标题/请求、backlog及0条transcript，不启动模型、未生成假消息。全部11张原始截图人工查看，08/11另从本地原图复核。

SDK事务生成exit0，仅生成三个现work-ledger响应里的可选pendingPromptText：OpenAPI增加9行，SDK类型增加3行；既有命令/接口未新增。双语言API文档实际生成及check通过（生成结果与原文相同）；真实routes checker六规则/36文件通过，core/overlay类型通过，2754键/2语言、本地化/CSS9066引用/402TS/TSX检查通过，Node UI构建通过，保留既有大chunk提示。不运行或新增UI自动化。最初测试作者误给editMissionPendingPrompt带两个其签名不接受的字段；在实施阶段读签名后已删除，正向重跑验证的是现公开契约，没有为错误测试改接口。

本人tab183关闭，公开shutdown HTTP200，原native句柄42636消费exit0；settle确认原native/launcher、物理身份/输出/请求闭合，成对认证/完整模型目录副本均退休。after严格资格259217原行全部保全，当前259462行仅本轮新草稿及其原生发布/租约事实；100项目文件/Git、229附件、源DB及认证/模型目录源元信息均保全，schema9/92表不变，模型请求0/累计1260。沿首次截止退休时剩3801738ms，无重启/加额/续期。未单独验收失败读取像素、长请求键盘滚动、归档非草稿空会话或新模型执行，不把类型/构建/局部测试替代这些未知覆盖。当前任务交付范围为原请求阅读链路，持续Goal仍active；提交推送以本轮Git回执为准。
