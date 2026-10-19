# 冷配置保存的共享目录准入成本

## Recall

持续单 agent 自主迭代，不委托；持久 goal 的旧 Astra 文案由后续单 agent 指令覆盖。前一轮为 progress，448792215 已正常推送，当前 main/upstream 同步。436 最终 55 项目真实 username 保存 21.864s、恢复 4.226s，并发页面配置读 2.469s；完整性能 benchmark 明确 failed，cold<=10s 未满足，不能把暖路径通过冒充完成。本轮保留 cold10s/warm5s/读取20s 和全量项目/完整校验/保留用户数据目标。不触碰用户 18571、不创建 branch/worktree、不改 schema 或清库；原 .bun/ 和 packages/opencorvus/bun/ 保留。benchmark-debug-template skill 已在前一轮读用，继续以真实测量推进。

本文 QA 指 Quality Assurance（质量验收），HTTP 指 Hypertext Transfer Protocol（超文本传输协议），UI 指 User Interface（用户界面）；DEBUG 是调试日志级别。

## 修改前分析与共享影响面

重读 436 Recall 和未完成项，当前 Config/Project identity/物理目录合同、ProjectDirectoryAdmission.run、fromDirectory、全物理注册集合 capture/revalidate、shared JSON fact lock、现有 SkillReadDiagnostics owner 阶段。全仓搜索 run 的五个生产入口：Project.fromDirectory、sandbox 增加、implicit Project 创建、promotion restore/publish 及其共同 owner；再检索目录准入/GC/creation/identity 的测试。Task/Mission/Session 的执行轮次、正常/终态、恢复、并发和跨项目继续依赖原目录 SQLite generation 与 physical occurrence。本轮先不改变它们的控制流或正确性边界。

进一步按实际函数确认五处直接 run 是 fromDirectory、addSandbox、promotion backward restore、creation compensation reclamation、creation journal abandoned-directory reclamation。promotion publish、Task worktree 等还使用同一 durable token 的 acquire/provide/settle；不能把直接 run 列表当作全部 token 生产入口。后续若修改准入算法，必须同时审计这些直接 token 用户。

可观察现象是冷写仍约22s，暖写约4s；直接路径是多个冷 Project identity 进入同一个目录准入文件队列，callback 内重新校验物理注册关系和身份、结算 durable token。436 已排除模型校验及最终 runtime reconcile 为主要冷成本，物理比较并行实验没有足够整体收益，已撤回。剩余 admission（含 provision、本进程队列、跨进程锁）与 held 实际处理各占多少仍未知。不能把队列存在当作锁死、不能根据超时归罪模型，也不能绕过 generation/删除隔离。

既有 SkillReadDiagnostics.catalogOwner 已能观察 total/admission/held/release，保持原 operation promise/value/error；准备复用同一个实现观察 directory owner。只有重复已经出现的两种 owner 时间线才提取私有共同 observer；不建立另一套 tracer 或状态，不改目录队列语义、错误补偿或 request 身份。DEBUG 关闭时直接走原 acquire(operation)。角色标签进入既有 closed phase 集合，元数据只含阶段、计时、trace/request 身份，不记录配置或凭据。

## 实施前方案及验收

1. 在同一 observer 内保留 catalog phases，增加 directory total/admission/held/release；DirectoryAdmission.run 把原 withSharedJsonFactLock 和原 callback 原样交给该 observer。fromDirectory 增加初始 identity、物理 capture、durable acquire、物理 revalidate、admitted identity 的分段，优先定位已持有目录 owner 的实耗。先以真实日志区分 admission 与 callback，不改变 owner 顺序、重试、终态或并发数量。
2. 聚焦 diagnostics 正向合同验证两种真实 durable owner 的返回对象、原错误和完整阶段；原目录 compromise/发生错误后的 durable 结算按原测试复核。TypeScript 检查先于性能运行，避免与 benchmark 争用资源。禁止 UI 自动化、源码文案断言、hash 门槛和全量 bun test。
3. 新独立 before 18647 native scope，复用 413 harness 与 436 脚本体系、600s 物理安全期限和真实活动监测。现有授权 auth 与完整 models 成对绑定，确认 gpt-6.1-sol 投影与真实流请求；只在原自有 QA412 runtime 内用生产 service/transport/HTTP 写入并完整恢复 username，保留 Ask。逐 requestID 采集全量阶段、Project 数和真实结果；两次 Provider 预检不是业务执行。
4. 分段证据齐备后再补具体根因方案并修改；共享机制涉及五个入口和所有 occurrence，修复前覆盖它们的正常、失败、重试/重启、并发和跨项目，不为单一 config 绕行。实际产品路径复测并人工截图，保留未满足目标。
5. 每个新 scope 公开 shutdown、原句柄 join、physical/output/request 结算后退休凭据对，私有 authority 最终退休。三索引/架构、适用文档检查、范围提交、fresh fetch/merge、完整 pending 审查与正常 push。目标保持 active，不将未完成冷路径标为完成。

## 结果

437-before 18647 的真实冷 PATCH /global/config 为 24,584ms（客户端 24,590.7ms），56 项目、已加载2。54个 directory.held 累计22,744ms，project.identity.admitted累计22,302ms；registry capture348ms、acquire75ms、revalidate203ms。directory admission累计191,564ms是重叠队列等待，不能当作墙钟耗时。暖恢复4,065.4ms，原canonical完整解析值恢复且保持Ask。源原始阶段已保存 before-cost.json。which("git")独立5次6.7—8.7ms，排除PATH查找主因。56个QA项目均有.git，身份读取会执行两次真实受监管Git命令；仍需区分命令本体、进程监管及identify成本，暂不改安全边界。

人工查看18647默认首页并保存01-home-before.jpg：433交付的三步Goal帮助及填写按钮可见，当前没有新增UI修改。自有tab关闭，公开shutdown200，原45416 joined exit0，native physical/output/request结算后运行态凭据对已退休。原用户18571未操作。

下一步使用官方隔离test runner运行临时非UI诊断：相同只读Git rev-parse，通过当前生产Process.runHost和NodeProcess owned_process分别获取明确成功输出与完整结算耗时；全部子进程仍由成熟ProcessFacade拥有和回收。探针不触碰QA或用户数据库，不改变命令环境、生产监管或配置契约。仅用于区分进程启动成本，不作为配置端到端验收。

## 精确修复方案（实施前）

探针修正了两次对NodeProcess返回结构的误用（exitCode属于receipt，字节输出使用Buffer解码），最终原runner1pass/12expect：supervised 202.96/187.20/173.76ms，owned_process74.60/74.87/71.97ms。不以更快为由改用root-only监管。两次身份Git查询现按top→common串行，common目录本身不依赖top的结果；Git官方rev-parse文档确认--path-format=absolute对--git-common-dir生效，仓库snapshot/source-stage已有相同选项。准备在原directory同时发起top和absolute common查询，保留两份独立stdout，避免多字段换行解析与shell。使用原directory解析absolute common后再按既有displayGitTop确定sandbox/worktree。初始和admitted两次发现、全部physical occurrence、registry和SQLite generation边界均保留，五个共享run入口及直接token用户不改协议。公共API、schema、消息、Task/Mission/Session重启/终态语义不变，Git内核仍是唯一事实来源。

增加真实Git的正向合同：带空格/引号/Unicode的主目录、物理alias、linked worktree分别返回精确Project与sandbox，并保持同一durable generation。复核既有registration与reclamation竞争、文件队列compromise和linked worktree拒绝合同，以及diagnostics。新after native scope实际冷/暖保存并恢复全部原配置；目标仍cold10s/warm5s，改善不足继续明确failed，不放宽阈值。

## 修复结果、真实验收与未满足项

新增Git discovery正向用例1pass/8expect，真实Git仓库、linked worktree与junction/alias均解析到同一Project occurrence；既有diagnostics6pass/43expect，真实registration先胜、文件队列compromise后generation保护、main回收与linked注册冲突3pass/8expect，backend tsc通过。没有新增或执行UI自动化；临时进程适配器探针1pass/12expect只证明局部耗时，不作端到端资格。五个run入口和直接token调用点（worktree、deletion-cleanup、implicit creation/promotion与Project）均检索复核：仅原discoverIdentity的两次独立Git I/O改为并行，run observer保持原callback完整结算；没有改变acquire/provide/settle/generation/重试恢复/终态协议，也没有按Task或项目绕过任何检查。

after18649用最终源码与原正式UI：57项目、原已加载2，冷保存19,966ms（客户端19,971.5ms）、暖恢复4,055.8ms。55次held累计18,141ms、admitted identity17,622ms；before54次分别22,744/22,302ms。即使项目数增加1，冷保存改善约18.8%，但cold<=10s仍失败；暖<=5s与完整canonical接受/恢复通过。并行化只削减两次受监管Git查询的串行等待，没有根治整个随冷项目数增长的共享身份成本。剩余身份内部Git/marker/物理遍历比例尚未再分解，下一轮继续，不将推测当结论。本轮没有在冷写期间发起真实页面读取，读取<=20s资格未知。

02为after实际中文首页，点击“填写第一条需求”真实聚焦输入框；03为打开原有Chat后点击顶部“创建目标”的真实表单。未填写/提交Goal、未触发业务续跑，不宣称本轮重新验收自动目标执行。UI本轮没有修改，433的首页/创建流程继续可达。只改变自有18649 origin的界面语言；用户18571未触碰。两个自有页面关闭、服务公开shutdown200，原45416/37955 joined exit0；native physical/output/request回执和运行态auth/models退休已完成。额外私有authority将由归档器在核对所有物理回执后精确退休。共4次真实gpt-6.1-sol流预检（每scope两次），不是业务执行。

没有新增schema或迁移、没有打开真实用户数据库。数据保留验收仅作用于显式OPENCORVUS_HOME的自有QA412 runtime。当前配置性能目标仍active且未完全达标；本轮交付范围是可复核的共享阶段诊断与身份查询并行化，后续不能用暖缓存结果代替冷验收。

归档器最终确认两个scope各2次Provider请求全部model=gpt-6.1-sol、streaming=true、200、reader EOF；两份native physical/output/request、launcher0、shutdown200与paired cleanup均成立，随后精确删除私有两个副本。原Codex auth4318字节、mtime1791990556516.2156保持准备前。选定压缩内容以实际授权值在内存中做泄露检查通过，未记录值。完整benchmark evaluate exit1/status=failed已保留；当前05-config与三索引已同步。正常文档/架构检查、提交与上游同步推送继续执行。
