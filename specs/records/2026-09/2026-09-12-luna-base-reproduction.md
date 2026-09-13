# Luna 与 Base 专家团的 AutomationBench 复刻

## Recall

- 最新主线改为[从底层以实际结果为中心纠偏](2026-09-12-outcome-first-runtime-correction.md)：用户明确不能接受半小时且零分，要求从OpenCorvus理念纠偏。普通Base改为执行→独立验证，原始输入高于派生合同，精简发布中转和环境Skill。e03f首5例已独立复算，strict1/5、两例partial0；保持旧结果，100例扩跑继续暂停。纠偏新运行时3f9cb474已独立审查/冻结并启动首5例，详情见文末。

- 最新速度要求：“还是不行，执行太慢了”，明确选择“先把冗余调用至少减半”。优化仍保持Luna、官方业务评分和必要独立验证；不以强制截断或删掉失败凑速度。先核实并减少证据传输中多余的模型往返，同时报告总调用与真实耗时，不把局部调用减幅冒充整体加速。

- 最新纠正：“bug不修吗？”要求立即修复Base无效执行根因并验收。此前仅解释错误未完成修复，不算交付。首批之外的新准入暂停；保留所有有效零分和原始失败证据。共享调度审计、生产修复、固定运行时修复投影、真实复验及独立审查完成后才扩展。

- 网页展示要求：用户询问“有网页展示结果吗”。补本轮原生Luna/Base共同结果页，使用真实实验快照；必须打开真实页面、截图人工复核，不运行UI自动化测试。该页面作为现有benchmark工具的结果查看器，本轮产品开发页面没有此双组视图，故使用独立只读本地服务，不启动Vite或修改产品UI。

- 最新授权（重新认证后）：用户明确“我auth了，开始”，授权使用重新安装后 `C:/Users/hengu/AppData/Local/OpenCorvus/data` 的新OpenAI登录与模型目录执行已确认的两个条件。旧安装目录已按用户确认移到同级备份（永久递归删除被自动审批阻止）；不使用该备份或旧WSL凭据。新auth采用generation/info结构，须用Auth公开读取契约，不能以顶层缺少type误报未登录。

- 用户原始要求：“你现在正要做的是完善论文和benchmark的分支，需要你自己运营实验，把论文完善好，首先要做的复刻luna和base专家团的实验”。随后确认“原生 Luna 与 Luna + Base 对照”。
- 当前交付来源为 `codex/paper-preliminary-results`，起点 `443a614e`；论文和本次实验交付仅提交、推送此分支，不合并 main。开始时只有三个原有未跟踪路径，保留不动。
- 验收：同一不可变 AutomationBench 任务清单、同一精确 Luna 模型的两个执行条件；官方世界状态评分；逐任务身份、原始对话、工具事件、初末世界、评分复算、版本与实际资源消耗可追溯；据实更新唯一论文稿源并独立复核。运行完成不是通过，严格零分也是有效实验结果。
- 硬约束：真实流式模型调用；不伪造历史结果；每个有效配置×任务只执行一次；保留失败；不以重复取最高分；不运行 UI 自动化；不改动用户正在使用的进程。长实验定时唤醒检查。凭据不进入日志、规格或提交。隔离时同时投影凭据和模型目录，启动前分别核验连接、目录投影和实际请求模型。
- 已读：根 AGENTS.md；benchmark-debug-template 技能；论文计划最新 Recall、实验章、README、source-map；历史 AutomationBench audit；Inspect adapter 文档；当前扩展架构；历史批协调器、单例运行器、冻结 600 例清单、官方评分 bridge、评分复算器和 2026-08-27 运行记录；当前 Provider 连接与流式入口。
- 全仓及 Git 历史搜索：论文分支没有专用 AutomationBench 运行器；该运行器在 `origin/codex/automation-workbuddy-benchmark`，查询时为 `17bc3f63fc2ed0e2d4953e50811ee106882fd8fe`。它与论文分支相差 1261 个文件，不为复刻合并整个历史产品分支。现有 Inspect catalog 没有 AutomationBench 世界评分接入，不能用 task-completed 代替正式评分。
- 官方资料：[AutomationBench 固定源码](https://github.com/zapier/AutomationBench/tree/4a8e1061254004d9dac807054eed33fad7d1ff14)，1.0.6、public 600 例、六领域、api 工具、严格评分和公开/私有集合区别。
- 独立 agent 反馈：无。初轮实现与验证通过后委托未参与实现的只读审查，禁止改文件和再次委托。
- 恢复时先读此 Recall 和下方状态，不能只凭旧记录中的 100/600 或 212/600 等计数继续执行。

## 问题深度与影响分析

1. 可观察现象：论文只保留用户确认的 100 例、34% 及未配对的 8.07% 参考；Windows 初次读取未看到原始实验目录。以 WSL root 只读检查后发现旧原始证据和完整评分环境仍在。
2. 直接触发：旧目录是 root 权限边界；普通 WSL 用户的路径检查无法证明目录不存在。此前论文计划“旧目录不存在”的环境描述不再成立。
3. 数据根因：仓库历史记载与这台机器上的持久化快照时间不同。当前本地 r3 catalog 有 141 次尝试、102 个候选、95 个完成榜单条目（case 1–95），不能用远端记录中的更晚进度代替。候选包含 15 个源码提交，不是一次固定版本实验。
4. 旧路径未解决的原因：网站/论文摘要和 derived catalog（派生目录）没有替代原始世界、run manifest（执行清单）与官方评分的证明力。需要重新核验密封文件、任务契约和 scorer（评分器），不是把发现的数字直接抄入论文。
5. 定义/调用/契约：真实 Base 入口是 Mission → child Task → Session → Provider；官方 bridge 隔离真实工具和世界；历史原生参考的执行器及样本对应关系尚未知。当前 `Provider.operations` 提供真实流式连接测试，模型目录与连接状态是不同契约。
6. 已知历史缺陷：case 96 留下 scorer transient state（评分器瞬态状态）复算错误，case 97 留下 inactivity（无活动超时）错误。远端历史包含后续共享恢复、去重与观察器修复；本机 runner 仍为 `e8cdd1be`。不得直接启动旧 runner 或把这些问题降级为模型行为。新运行前必须核对修复及共享入口、正常/终态、重启、串并行和项目隔离证据。
7. 修改范围：先写复刻计划和证据审计工具/产物；仅在确认可复用运行器与当前契约后接入两个条件。历史原始证据只读，不覆盖；新结果使用新目录。产品公共接口、迁移与 UI 本阶段不修改。
8. 风险和未知：原生 Luna 历史参考身份未知；历史混合版本不能支持固定版本因果结论；本机 Provider 连接和新实验费用/授权来源尚未验证；Git partial-clone（部分克隆）有缺失对象及网络失败线索，任何交付阻塞必须修复或精确记录。

## 执行协议

1. 从 root 私有 WSL 路径恢复实验目录清点。以现有官方 replay 脚本复算每个可用历史候选，同时核对密封文件哈希、任务 manifest、实际模型和源码身份。产出非秘密逐例摘要；目录标签和原有 passed 字段不作为新验收。
2. 冻结一个双方共享的 100 例清单：优先历史 600 例清单前 100 个身份，按已有与评分无关的确定顺序，完整保留领域和契约哈希。该集合是已暴露的复刻集合，不称 held-out（未参与开发）测试。若正式启动前范围调整，先更新协议，不结果驱动地选例。
3. 原生 Luna 条件采用官方任务指令、三种 api 工具及单 agent 循环；Base 条件采用真实 Mission/Base。两者均记录精确模型、推理参数、提示映射、工具接口、资源限制和源码。工具/推理预算差异必须在结果解释中披露，整体系统比较不能被称为纯协作增益。
4. 完成无模型环境检查和官方世界评分链检查，再验证实际 Luna 流式连接。不能把缺少模型投影说成凭据失效，不能切换其他模型凑通过。
5. 每组先完成小批真实链路运行，证据通过后滚动扩展到既定清单。有效的当前配置条目复用；旧版本结果作为历史复核单独报告。若修改执行条件或修复缺陷，记录新配置身份并明确哪些结果可比。
6. 无活动超时依据最近真实流式/工具/世界/任务进展，采用已有 600 秒窗口，不用从启动开始的总时长判死。维持有界并发和每例证据身份；长任务用线程定时唤醒检查，不持续 tail 日志。
7. 冻结结果后输出严格通过数、部分得分、逐域结果、配对转移、实际 token/调用/耗时及基础设施失败账本。缺少预算或模型快照的字段明确未知，不按零填充，不估计未测的进化收益。
8. 更新论文单一实验章、对应摘要/限制/溯源和 PDF；逐页视觉复核；运行文档检查；独立只读审查并修复全部有效发现。范围清晰地提交，fetch/merge 上游并检查待推送集合后 push 当前论文分支。

## 本机来源与当前状态

- WSL distribution：`Ubuntu-24.04`，旧 runner `/var/lib/opencorvus-benchmark/opencorvus-runner`，干净起点 `e8cdd1be4d280399bbb953562000b430f4e59fe7`。
- 官方环境：`/var/lib/opencorvus-benchmark/evaluator-venv/bin/python`，Python 3.13.15；Bun 1.3.14。
- 旧证据：`/var/lib/opencorvus-benchmark/evidence-luna-mission-base-v20260822-r3`；另有 r1/r2、Advanced/Sol 与诊断目录，彼此不合并为一个实验。
- Windows 镜像结果：`D:/myhexin-local/opencorvus-benchmark-results`，含 75/600 历史归档。归档计数不代表当前原始目录计数。
- 初读目录显示 95 个完成条目、27 个 strict pass；此处只是待复核目录观察，尚非本次复算结果。前 100 个 case 中，候选缺少 96/97，完成条目缺少 96–100。
- 尚未启动任何新的模型实验，尚未复制或使用凭据。

## 验证与交付记录

待补：官方评分复算、环境/模型预检、两个真实运行条件、最终逐例结果、论文更新、独立审查与提交。

- 首次恢复工具验证发现调用方把精简 score event 当成 replay 的完整输入，遗漏 `result.benchmark` 中的初始世界哈希与逐断言结果。密封文件和任务身份检查均通过，错误发生在调用参数映射，尚不能归因于原始证据。停止本任务自己的只读复算进程；按既有 checker 契约从密封 result 映射完整字段，保留 score event 的独立交叉检查，再重跑。

### 原生条件接入决策

- 现有专用 runner 只有 Base/Advanced，没有原生单 agent 条件。官方 Python clients 的现有调用不能直接冒充本仓库要求的全程流式路径。
- 采用官方 AutomationBench 工具 schema、原始 prompt 和 50 response-step 的普通函数调用循环；只复用 OpenCorvus Provider 的登录传输，不使用其 Orchestrator、专家提示、自动修补工具调用或协作逻辑。论文将准确称为 native tool-calling baseline，不能声称它与未知的 8.07% runner 完全相同。
- 官方世界仍由现有 `BridgeState` 与原有 replay checker 管理；原生调用桥只做标准输入输出的 JSON 请求映射，模型仅可见三个官方工具。主机评分动作不进入模型工具表。以官方真实 simple 世界进行无模型正向检查，最终模型路径另行验收。
- 新组先使用原有清单前 100 个固定身份，共 200 个一次性执行 slot（配置与任务组合）；各臂相同明确 Luna 推理档位。原生 50 steps 与历史 Base 无总步骤上限的差异公开记录，总体比较不归因为协作本身。新运行前再把 exact runtime revision、档位、命令和实际授权写入记录。

### 离线验证结果

- `python -m unittest discover -s script/benchmark -p test_recover_automationbench.py`：2 个正向/明确错误契约测试通过。
- `recover-automationbench.py` 的完整第二轮：102/102 candidate 通过文件密封、run/task/model/profile 身份及官方 checker 复算；其中95个原榜单成员有27个严格通过。结果在 [新产物目录](../../artifacts/opencorvus-paper/experiments/luna-base-2026-09-12/README.md)，不能冒充旧100例或新固定版本对照。
- `check-native-automationbench-world.py`：真实官方 simple 世界初始化、三个工具定义、base64与api_search调用、严格0分及原 checker 复算均通过，模型调用0。
- `bun build script/benchmark/run-native-automationbench.ts --target bun --packages external`：构建通过，仅证明语法/打包，不证明模型路径。
- `bun run docs:check`：339 operations、25 groups，通过；`git diff --check`通过。
- 已请求未参与实现的 reviewer 只读审查；反馈待核验。本机 OpenAI OAuth（开放授权协议）凭据使用请求仍待用户回复；未复制/使用凭据、未调用模型。

### 首轮独立审查的运行入口修复

- reviewer 发现新原生 runner 的 watchdog（无活动看门狗）只中止模型，未中止等待世界 ready/tool/score 或 stdin drain 的主机操作；SDK 的 abort 事件也可能被当普通事件继续评分。根因是同一实验执行的模型与世界等待没有共享终止信号。影响原生的初始化、工具、评分、失败证据和子进程收敛；Base旧运行器没有引用新代码，此发现不证明其存在相同实现问题。
- 修复方案：所有等待绑定同一取消信号；收到 abort 明确生成未评分失败，主机只终止本次创建的子进程并等待其退出；成功必须以自然模型终止和原有官方 replay 通过为前提。补正向取消错误契约和真实世界检查。同步将源码版本、参数、启动失败与终态结果纳入同一个持久化生命周期，避免设置阶段异常丢失执行证据。
- 最终首审共4项：上述世界等待、中止评分、设置阶段失败记录，以及 SDK `finish-step.response.headers` 的潜在凭据暴露。已统一中止世界/模型读取与发送等待；评分前检查自然终态并强制官方 replay；保存 run-start/初始化失败终态、精确运行时版本和脚本哈希；用现有 Provider 响应头脱敏器处理传输 metadata（元数据），保留模型与工具消息。3个原生契约测试、2个Python密封测试、构建和文档检查通过；真实模型路径仍待授权与执行。
- 第二轮复审发现已中止信号下仍需接管底层 Promise 拒绝，以及子进程 `error` 不等于实际 `close`。已先接管 operation（操作）再决定中止结果，新增对应错误契约测试；只以 close 兑现清理等待，错误只触发统一取消；stdin错误和主机工具传输异常也进入统一取消。重新验证并再次只读复审。
- 第三轮独立只读审查通过：已报告的7项问题全部关闭，无新的未解决发现。reviewer复跑4个Bun、2个Python聚焦测试，并以自己创建的零模型子进程确认实际close、5秒终止收敛和EPIPE（管道断开）错误收敛；未读取凭据或执行模型。审查结论仅覆盖准备交付。
- 全仓 `bun typecheck` 通过（8个任务）；新原生runner另外用严格 TypeScript 检查通过：`bunx tsc --noEmit --moduleResolution bundler --module preserve --target esnext --types bun --typeRoots packages/opencorvus/node_modules/@types --skipLibCheck --allowImportingTsExtensions --strict script/benchmark/run-native-automationbench.ts script/benchmark/native-run-contract.ts`。
- 真实CLI缺配置检查生成带run ID的 `unscored_infrastructure_failure` / `native_setup_error:ENOENT` 结果，证明初始化失败账本路径；未用空配置或stub冒充模型成功。
- 当前待办：用户回复具体OpenAI凭据使用请求；固定Base运行时并完成共享修复和真实链路预检；统一双方推理配置、执行200个一次性slot、完整验收；据实际新结果更新论文正文/PDF。本轮不声称实验或论文完善已完成。
- 现有WSL runner在确认工作区干净、未使用其进程后，以 `git merge --ff-only --no-stat 17bc3f63fc2ed0e2d4953e50811ee106882fd8fe` 从e8cdd1be快进到既有远端benchmark冻结版本，完成后HEAD精确一致、status为空；未创建额外branch/worktree，也未启动旧supervisor。该步骤只固定待运行源码，不替代共享机制/模型预检。

### 推送检查器发现的既有索引故障

- 首次提交 `ed9c9844` 后，fetch/merge显示上游已是最新，待推送集合只有本任务这一提交。push的类型、路由、文档、租约owner检查通过，但 `check:architecture-index` 报告12个失效链接。
- 根因：论文分支保留了旧架构索引的12项条目，而对应文档已在当前源码删除；对比 `origin/v0.0.55beta` 的完整差异，索引恰好多出这12条。当前架构目录全量搜索也只在README找到这些目标。修改前该文件没有用户差异。
- 修复范围仅当前架构入口README的失效链接，保持现存全部文档可达；不重建旧文档、兼容索引、产品接口或公共契约。原checker实际验证每个现存文档有入口且全部链接指向真实文件，因此复跑它作为此删除的验收；同步记录/root索引并进行只读复审后提交。
- 索引修复独立只读复审通过，无未解决发现；reviewer确认只删除12条失效链接，修复后与当前beta索引完全一致，16个现存文档全部可达；独立复跑架构、文档和差异检查均通过。package topology（包拓扑）与release mutation topology（发布变更拓扑）检查也通过。

## 重新认证后的执行阶段

- Windows新认证文件和新模型目录分别于2026-09-12 13:03与13:02更新；原生Luna模型条目存在。不得记录凭据值。
- 使用新的root私有目录 `/var/lib/opencorvus-benchmark/reproduction-20260912`，原始历史证据保持只读；源凭据/模型从新安装投影到此处，记录成功布尔值与非秘密模型身份。
- Base及原生登录传输使用固定源码 `17bc3f63fc2ed0e2d4953e50811ee106882fd8fe`；论文/新原生runner交付分支为 `codex/paper-preliminary-results`。尚需验证环境依赖和双方实际请求参数，不能仅凭构建即扩展运行。
- 先执行准确Luna的流式连接诊断，再各自运行同一小批；官方checker和完整运行证据通过后扩展。任何共享队列、恢复、并发或终态异常按完整横向范围审计，不通过改样本/更换模型/消除失败记录规避。
- 新登录与模型目录已同时投影到新的root私有环境（目录0700，文件0600）。运行时按新Auth的generation/info公开契约读取oauth；最初只读探针顶层type为空是探针字段选择错误，不是登录失败。
- 首次Provider预检遇到missing proper-lockfile依赖，`bun install --frozen-lockfile`补齐8个包，锁文件不变；原预检重跑通过，`status=200, ok=true, connected, providerID=openai, modelID=gpt-5.6-luna`，投影api.id亦完全一致。
- 双方主推理档位固定medium，对应Base现有Provider默认；Base内部helper的smallOptions档位是原组织实现的一部分，实际调用参数需随证据披露，不能声称所有内部调用资源相等。原生明确50个response steps；Base保留原历史无总步骤上限/600秒无活动窗口。
- Base历史checker对前50例使用原50例manifest/受限shell，对51–100使用扩展manifest/shell。新100例的身份与前缀逐项相同；这是保留的历史运行协议分段，并非依据本次结果选配置。新增100例manifest遗漏了原数据集index哈希；在任何正式模型case前补入原官方数据集index身份，任务membership和顺序不变，并更新字节哈希。
- 新100例manifest字节哈希为 `43ca54925db11d7dc6d9c5b80bbd32aed9b6c93ea92a2d1b8225a0858036ff42`；数据集index为原官方 `3f98894f1fa871dd27516c549e028d5651104d41a44b8f02a5cd00da39e11f37`。
- 隐藏Windows host启动原生case1和Base batch1；启动时host PID分别22352和28112。Base batch ID `653d3b52-eace-48d5-adc1-2b102118cdf7`，初始case1/2的run ID分别 `5e03f280-d1b5-466e-a355-5fc2ffe51cce` / `f1f0fdd2-5308-42de-8b09-cc879dc41f3f`，物理并发上限2。后续以run身份/lease而非可能复用的PID判断所有权。
- 原生case1/run `7b65e085-edc2-42c4-af2d-b266e294a2ba`已自然完成：133417ms、23个response steps、46次官方工具调用、strict=1、partial=1、官方replay通过。实际每步request model均为gpt-5.6-luna；累计365061输入token（含91648 cache-read）、3278输出token。11个原始文件的SHA-256和凭据扫描收据写入新产物；这是首例链路验收，不是100例总体结果。
- Base两例已创建真实Mission和child Task；只读provider_usage_event账本证实Luna连接及session调用。当前part表不存tool调用，真实工具事实在tool_part_request/outcome/progress；不能把part中没有tool字段误判为未调用工具。当前观察到正常planner产物发布与后继控制轮次，尚无已确认共享调度缺陷，保持运行。
- 已通过app工具创建30分钟线程定时唤醒 `luna-base`，只在实质进展、完成、失败或需用户操作时通知；普通状态不变保持安静。自动化使用此Recall与真实证据继续小批验收、扩展和论文更新，不重复请求已获授权。
- 本轮独立只读复审通过，无扩展前必须修复的问题。reviewer逐项核对11个原始文件哈希、已审代码及固定runtime、23步真实Luna/medium/三工具请求、官方prompt/工具输入输出、自然终止、45成功+1失败工具事件、官方replay、token与耗时一致；敏感响应头已脱敏，常见凭据标记扫描0。结论允许保持配置继续原生case2–5，不代表Base或双方100例完成。
- 原生case2–5已按同一medium/50steps配置启动顺序一次执行，输出分别为 `native/case-002-attempt-1` 至 `native/case-005-attempt-1`；出现非零exit即停止该批新准入，保留结果待根因调查，不自动重跑。Base batch1继续以两个并发slot运行，其两例已产生真实官方world工具事件。

## 本轮结果网页方案

- 现象：现有Windows结果目录仅有历史Base/Advanced单组HTML；历史 `write-automationbench-dashboard.ts` 只接受base/advanced profile，当前新原生结果格式不同，没有本轮双组页面。直接触发是用户要求查看网页，根因是缺少跨原生/专家团的只读展示映射，不是实验调度失败。
- 影响分析：只增benchmark结果查看服务和静态页面，读取已冻结100例manifest、native原始result/input、Base既有catalog和执行lease/失败记录。保留原生与Base原事实来源，不写模型状态、证据、配置、凭据或运行器，不增加Provider调用。现有单组历史页保留其历史用途，不当作本轮数据。
- 新服务仅监听127.0.0.1，固定 `/ui` 与 `/api/status` 两个内容入口；只输出白名单摘要，不提供文件浏览、任意路径、完整prompt/日志/认证文件。页面每30秒读取一次摘要，查看器不tail日志、不充当实验调度器。
- 指标：每臂已评分数/100、严格通过数/已评分数（分母0显示未知）、运行数、逐例严格/部分评分和耗时；Base候选但未完成批收据的结果显示待验收，不计入正式完成。配对统计只使用双方都已评分的相同case，不能用不同分母计算提升。重复有效结果显示冲突，不取最高分；不可解析数据返回明确错误状态。
- 当前真实快照：原生前5例已评分，case1严格通过、case2–5严格0分，均是有效结果；Base前两例lease仍在，当前catalog尚无完成行。不能把Base未评分显示为0%或把原生4个严格0分列为运行器故障。
- 实施前已读：本轮Recall/README、原生runner/结果、Base dashboard renderer和catalog/lease格式；全仓相关入口搜索已定位上述唯一来源。独立agent反馈：本次网页实现前无，首轮真实页面/后台契约验证后按AGENTS只读复审。
- 验收：后台聚焦正向状态/统计错误契约测试、真实WSL数据API、浏览器交互和截图人工复核、独立审查、docs:check和Git检查，范围提交并推送论文分支。
- 页面已在 `http://localhost:8765/ui` 启动，固定只读API为 `/api/status`。3个后台聚焦测试通过；真实API返回100行，原生5已评分/1通过（20%），Base0已评分、2运行和1待验收（catalog实际推进所致），未评分通过率为null。
- 主agent用CUA真实浏览器打开页面并查看截图；首次正常桌面侧栏宽度下配对卡占用过多首屏，已依据截图压缩为三卡横排，再次截图确认首屏能看到指标与前5例表格。实际选择“已开始”、搜索wave、核对单条结果、清空搜索返回100条、点击刷新，均通过人工页面验收。没有新增/运行DOM断言、快照测试或其他UI自动化测试。
- 只重启了本任务新建的查看器进程以载入CSS调整；原生/Base实验进程与新登录数据保持运行。页面已标记为用户交付标签页。独立只读审查待记录。
- 首轮网页独立审查发现3项展示映射缺陷：Base启动/失败记录不一定有case_index，现映射会遗漏已失败任务；同批多个任务的PID互换仍被弱身份检查认作运行；同run ID的矛盾分数会被字典覆盖。根因分别是未使用各生命周期共有的任务身份、未验证进程完整任务归属、重复项未检查内容一致性；均在查看器读取层，未发现实验调度或持久化失败。修复前已核验真实catalog形状与进程参数，范围覆盖Base所有目录记录类型和lease，原生已有多有效结果冲突语义保持一致。以冻结manifest的(domain, task)统一映射并校验已有index，运行状态同时核对domain/task/profile/output/batch，只有内容完全一致的重复记录可合并；新增后台正向状态/错误契约测试，重跑真实API、人工截图和独立复审。
- 三项修复后6个后台正向契约测试全部通过，覆盖真实启动失败目录形状、完整进程归属和重复记录冲突。真实API仍返回100例、原生5已评分/1通过、Base2运行/1待验收且通过率未知；页面HTTP 200。主agent再次刷新独立浏览器页并人工查看截图，首屏指标、前5例状态和部分评分与API一致；`bun run docs:check`通过（339 operations、25 groups），`git diff --check`通过。结果页保持运行，实验进程未受影响。
- 网页第二轮独立只读复审通过：3项问题全部关闭，没有新的未解决发现。reviewer独立复跑6个后台测试，并以真实数据内存副本核实无index失败记录保留invalid、同批错配PID返回interrupted、矛盾同run评分返回conflict；真实API计数与分母正确，代码/规格一致，未读取凭据或操作实验。此结论仅覆盖本轮结果查看器，100例双组实验与论文最终结果继续按定时唤醒协议推进。

## Base调度发送阻塞修复方案

- 现象及直接触发：case1/run `5e03f280-d1b5-466e-a355-5fc2ffe51cce`在Mission执行阶段运行54.65分钟后，600秒无进展，随后scheduler cleanup超过10000ms。原始catalog为invalid_bug/cleanup_failure，无官方得分。runtime snapshot中Mission请求工具 `call_CJUHn6gLUv3z1UWg4aEiZu6I` 与Task回复工具 `call_M7p4M8U6iTjyrNC0gPRF08OD`同时running；请求和回复已分别持久化task_ingress/session_wake回执。最后错误是结果，不是根因。
- 已确认控制流：冻结17bc运行时的 `sendSchedulerMessage` 对任一接收者await整个recipient drain；Mission drain又await接收Session的activation和completion，并复用该接收者既有owner Promise。Task回复已落入正在等待请求工具的Mission，而回复工具等待该Mission整轮结束，形成发送与接收执行之间的循环依赖。Task入口也await materializer后的dispatch，因此须横向验证所有方向，不能只对Base或reply特判。
- 旧路径未根治原因：既有公平性测试通过直接enqueue驱动drain，覆盖不同接收者并行和同接收者顺序，未覆盖工具内send等待对方执行的回边。当前论文分支的Mission目标已经异步，但Task目标仍同步等待drain；历史分支与当前分支不是祖先关系，不整体合并历史产品代码。
- 公开契约及方案：统一send的返回边界为消息已持久化的SchedulerDeliveryReceipt；投递、真实接收者Message、唤醒与最终收敛仍由现有durable inbox、drain和恢复入口负责。去除发送工具对接收者整轮执行的等待，不增加超时、特殊reply规则、模型提示路由或平行队列。请求、回复、通知、Mission/Task双向和同Mission的Task间通信共用此边界；实际业务结果仍必须等自然终态与官方checker。
- 影响面审计：定义在protocol/scheduler-message与delivery；生产调用覆盖Mission Tool、Task Orchestrator工具、Session loop的终态通知；消费者返回工具输出，不应把入队回执当作业务完成。正常投递、retry/dead letter、已投递幂等重放、Task epoch/根Session和Mission opened occurrence约束、重启扫描、串并行FIFO与跨Project隔离均保留持久化权威，并以聚焦测试复核。未审完项明确待验，不以当前其他case通过排除共性风险。
- 实施及交付：当前论文分支修改唯一生产sender并增加聚焦正向回执测试；已授权的独立冻结runner应用同一语义修复并验证其真实路径，精确差异及测试作为本实验版本补丁归档在本产物目录，与论文分支同轮提交，记录新源码身份。该补丁仅描述历史复刻运行时版本，不是产品第二实现或fallback；不创建额外branch/worktree、不覆盖历史证据、不把新版本与旧版本混算。修改前两个工作区tracked差异均为空。
- 验收：先证明原阻塞的可重复失败，再验证消息提交回执及时返回、接收者继续执行、双向关联与最终收敛；运行相关非UI检查和真实Luna/官方checker小批复验。根因/恢复审计和独立只读复审通过前不扩大100例。当前独立agent反馈：无，首轮验证后委托只读审查。
- 已完成双版本red验证：冻结runner的既有跨接收者FIFO测试增加繁忙Mission期间send回执断言，当前分支既有Task并发投递测试增加暂停materialization期间send回执断言；两者均明确失败于发送等待接收执行。Windows初跑先遇到未编译的Rust进程监督器超过5秒hook默认窗口，使用60000ms测试窗口完成真实helper构建后重跑，才得到目标red；未把工具准备失败当作缺陷复现。
- 当前生产sender修复后8项调度测试/106断言全部通过，涵盖Task物理容量、跨Project发现和取消、分页、Mission关闭/重开、错误wake恢复；全仓typecheck（8任务）及docs:check（339 operations/25 groups）通过。独立初审核验全调用方和事务信号链，未发现功能回归；指出materializer返回的messageID/ingressID/wakeStatus已无消费者。全仓证据只有定义、typeof端口绑定、bootstrap绑定及drain唯一调用，故同步删除该派生返回，保留真实await dispatch/reconcile，避免留下第二份返回状态。冻结生产源码待最后一个旧运行自然收尾后应用，未中途更换实验代码。
- 旧批次于约14:49自然收尾，lease清空且原trial进程消失后才应用冻结生产补丁；batch1为failed，catalog正式leaderboard为0，原有候选与失败全部保留。冻结busy-recipient red转green；同步将旧测试里把send回执等同delivered/messageID的断言改为先检查pending，再读取canonical投递结果，两个文件6项/30断言全部通过。对应4文件归档补丁16075字节，SHA-256 `08d5e57ede57558fc6986efbe2a7919e7809d7228cc230b3c821d50cd337d1b5`。
- 独立后续只读复审核验当前materializer清理、冻结4文件diff与归档逐字节一致，关闭/重开、FIFO、并发和revision检查保留，无未解决发现；当前分支最终8项/106断言及typecheck通过。冻结typecheck先发现SDK dist过期：src/index.ts已导出ProcessFacade，dist/index.d.ts尚未生成该导出。按SDK现有tsconfig以 `node node_modules/typescript/bin/tsc --build packages/sdk/js/tsconfig.json --force` 从冻结源码重建ignored dist，再重跑原typecheck；不改接口或锁文件来绕过检查。
- 真实修复复验使用独立目录 `/var/lib/opencorvus-benchmark/reproduction-20260912-scheduler-fix`，相同冻结首5例、模型、medium主推理及并发2，记录新的clean源码commit。旧版本有效零分保留为旧配置记录，不混入修复后固定版本结果，也不按分数挑选重跑。原生条件未触及调度sender，继续使用原5例单次执行证据。结果查看器以明确的native/base两个源目录连接原生原始证据与修复后Base，替换原同时指向一个root的启动参数，避免复制结果或混合两版Base目录；无旧参数兼容入口。
- SDK ignored产物重建后，冻结运行时完整 `bun run typecheck` 通过（产品tsconfig与tsconfig.benchmark）。冻结修复提交为 `e03f1fd678295421ac0a37c1b4b6fed8a22c6cc6`、tree `7e5b9011343cdf2b8e2333c2517b688699af42d9`，父提交17bc；status为空，4文件diff已归档且独立审查通过。该独立runner保持既有detached checkout，不创建或推送额外分支；补丁、当前生产修复、实验记录同轮收敛到论文分支。
- 新目录从已授权的新Windows安装再次同时投影auth/models，使用root私有0700目录和0600文件；准确Luna流式预检通过（OAuth、projected_model=request_model=gpt-5.6-luna、HTTP 200 connected）。预检后将其有效auth/models同时复制回本轮provider-source，防止仅保留过期的预检前登录快照；未记录凭据内容。
- 已启动修复后首5例Base batch1，并发2、600秒无活动窗口；Windows隐藏host PID 19532。启动脚本先验证运行时commit精确e03f及git status为空。当前待验：真实双向发送回执/回复推进和自然终态、官方评分复算、最终只读审查及论文分支提交推送。模型预检成功不代替该真实链路验收。
- 修复复验batch ID为 `bb871e9d-9956-446e-8f21-18248a76f56d`，首两例run ID为 `3aa4e29b-b0f4-460f-9da2-16fbe2c09027` / `fadd5d34-0bc9-41e4-b037-12328c57ec8d`。查看器改为必需 `--native-root`/`--base-root` 两个明确权威；6个后台测试通过，包括从两个独立根读取原生已评分与Base失败状态。真实API返回原生5已评分/1通过，修复后Base2运行/0已评分、0配对；主agent只读截图确认页面与该快照一致。只重启自建查看器加载新数据配置，未刷新/操作用户窗口或实验进程。
- 当前交付最终独立只读复审通过，无未解决发现；reviewer复核双数据源权限、运行归属、冻结commit/parent/tree/clean与补丁一致，以及batch/run真实身份，并独立复跑6个后台测试、文档和差异检查。15:05的只读真实Provider账本分别有26/22次gpt-5.6-luna调用，两个run持续推进。此交付只确认代码、回执契约和运行准备；修复后完整官方评分与真实终态仍未完成，后续继续验收并保持首5例以外准入暂停。

## 冗余证据调用减半方案

- 可观察现象：修复后前两例在约20分钟时分别95/101次Provider请求，已收敛请求时段的并集约占墙钟97%；这表示Provider活动边界覆盖大部分时间，不能未经流式边界复核就全归为网络或模型计算。后续密封结果：case1用时1980210ms（33.00分钟）、strict=0/partial=0；case2用时1196924ms（19.95分钟）、strict=0/partial=0.5。两例自然形成sealed_candidate，评分尚待独立复算和批次收据验收。
- 排除误判：同一参与者、同一immutable locator/hash/byte range的重复Artifact读取，前两例仅1/0次；不同角色的必要独立复核不计为冗余，查询重试或最终状态读回也不能仅凭输入相同判冗余。两例中的Artifact选择调用22/9次，其中13/4个selection回执仅用于后续通用artifact_publish，形成“完整读取→选择Tool→模型再次调用发布”的可合并往返；这是本轮明确消除的17个传输中转调用，而非宣称全部调用都可砍半。
- 直接触发与根因：通用publisher仅接受source_selection_refs，强制模型先执行artifact_select获得动态as_引用，即使模型已经完整读取源且在发布参数中能够明确作出来源选择。发布本身已有真实Tool请求、精确Scope、完整读证据、canonical source_artifact_locators及单一发布服务，独立中转不是维护这些契约的必要条件。Task/Session调度保持上一修复，本轮不改组织图、绕过独立验证、缩短超时或换模型。
- 修复方案：通用artifact_publish以source_read_refs替换source_selection_refs；该字段本身明确选择这些已完整读取的证据作为本次输出语义来源。复用resolveArtifactReadReferenceBeforeSelection的同Session、同物理Turn、先于本次Tool、完整字节和精确locator验证；将已核验的显式选择传给唯一publishExpertArtifact，保留其observed/selected/source一致性校验。无来源仍为[]。不保留旧参数兼容入口。独立artifact_select继续服务需要独立selection回执的其他既有消费者；通用发布只有一个当前参数路径，不增加新Tool、影子状态或隐藏消息。
- 影响面：全仓搜索命中通用Tool/schema、prompt-profile-resolver公共提示、Base/Advanced/Research及外部专家团和作者模板说明、SDK中英文文档、两类正向契约测试和generated expert-squad payload。逐项判断是否是通用publisher说明；typed/package publisher保留其原独立契约。同步使用现有生成器更新payload，版本和冻结实验delta单独记录。引用字段、完整read验证和发布源图是公开契约，必须测试真实服务的正确输出与明确错误类型；不只改提示字符串。
- 验收指标：同一冻结首批与固定模型下，发布用证据选择中转调用从基线17次至少减少50%；同时列出其他选择调用、总Provider调用、总Tool调用、官方strict/partial和耗时，不以局部指标替代总体结果。先做聚焦正向发布及错误契约、真实小批复验和独立审查；未达标继续定位，不扩大100例。与当前运行版本隔离，不中途修改其source。当前独立agent反馈：无；首轮实现与验证后委托只读审查。

### 终态观察器空等的追加调查与方案

- 已确认现象：e03f case1 的最终 Mission assistant 在1789197808142ms已自然完成，运行到1789198416123ms才结束，相隔607981ms；case2成功路径仅约7秒。case1的持久化审计为scored_terminal=true、natural_failed、11个Task执行轮次全部收敛，Mission inactive且无待答用户消息。不能把此600秒算作模型推理耗时，也不能删去有效零分。
- 控制流根因：冻结runner唯一waitForTerminal入口把missionRecord.completion作为提前转入quiescence检查的额外条件；自然失败只在无活动窗口耗尽后进入同一收尾。现有auditMissionOutcome已经统一定义成功/自然失败且检查Task集合、Session归属、最新用户应答、Provider健康和完成回执，观察器却再加成功专属条件，造成双重定义。旧测试覆盖audit的自然失败，但未核对运行器提前返回分支。
- 横向审计：全仓搜索冻结生产src及benchmark入口，completion专属提前返回仅在run-automationbench；native循环按自然模型finish收敛，当前论文分支没有这份历史运行器。Mission投影来自SessionStatus.isExecuting与projectID/missionID/sessionID约束的Task持久化记录；并无按Base单例分支。Task成功/自然失败/取消由统一auditTaskOutcome分别裁定可评分/无效。后续waitForTerminalQuiescence仍逐一检查全部Task/Session occurrence、pending interactions、scheduler收据、ingress/protocol交付及2秒稳定观测。延迟唤醒仍由项目+Mission+Task集合查询、原deadline逻辑处理；重启/重试及不同并发槽不共用观察器局部变量。上一轮发送回执修复、恢复/FIFO/跨Project验证继续有效；本次证据定位为benchmark观察器对既有终态契约的错误使用，不修改生产调度或模型决策。
- 实施：提前返回只使用唯一auditMissionOutcome.scored_terminal，不再额外要求completion；原未终态600秒无活动窗口和全部quiescence/官方checker保持。利用既有正向成功/自然失败audit测试，追加自然失败的完整轮次静止验收，并用密封真实case1/case2重建运行器输入验证两种路径。完成当前旧批次后才把此次运行器改动及发布优化投影进冻结源码，保存精确patch/commit/tree，再开始新配置首5例。独立审查已发起，反馈待记录。

### 纠偏配置实跑

后续唯一活跃Base来源为 `/var/lib/opencorvus-benchmark/reproduction-20260912-outcome-first/base`，运行时commit3f9cb474、Base/SquadSDK2026.09.12.2；首5例batch6f1e14ec已启动。旧e03f首5例官方复算5/5有效、strict1/5，两例partial0；成本基线48次发布选择、540次Provider和737次Tool，原始及归档证据完整保留。具体修改、独立审查和未完成验收见[纠偏记录](2026-09-12-outcome-first-runtime-correction.md)。现阶段仍暂停第6例及以后，不把源码测试等同效率或质量目标通过。

## 867e42ed 单例效率闸门与根因修复

### Recall

- 用户要求先解决全部问题，明确“先把冗余调用至少减半”，并要求从 OpenCorvus 底层理念纠偏；当前 Goal 固定以旧 Base 平均 105.23 次模型调用/例为基线，单例/小批平均必须不高于 52.615，且不得靠超时截断、删除 Tester、降低模型或评分、Host 路由 gate 达成。
- 当前可发表源码候选为已推送提交 `867e42ed3a14`。隔离安装、Provider 凭据与 `models.json` 成对投影、实际 `openai/gpt-5.6-luna` 请求、SDK 构建、29 项聚焦测试和零模型 checker 均已通过。第一次批运行因新实验根目录权限为 0755 触发 shell isolation 拒绝，5 个失败均保留为基础设施证据；根目录修正为 0700 后重新运行。
- 修正权限后的 case 1 `marketing.linkedin_company_update` 自然终止并通过完整运行审计与官方评分复算：strict=0、partial=0.8、889775ms、91 次模型调用、45 次官方 API 操作，全部 Tool 请求成功。它只因人为关闭后续批准入而不是 5 槽完整批次，未进入正式 leaderboard；原始 sealed candidate 保留不改写。
- 与旧同例相比，partial 同为 0.8，模型调用从 87 增至 91，耗时从 708542ms 增至 889775ms。角色调用为 Developer 30、Tester 27、Orchestrator 16、Mission 16、memory 2；当前改动没有达到效率闸门，100 例扩跑继续停止。
- 实际 API 序列显示 Developer 和 Tester分别执行 24/21 次操作。主要冗余是对 Slack、Drive、Notion、Airtable、Salesforce、Confluence 等未由任务或返回数据指向的替代来源逐个猜测，以及把可独立的只读发现拆成逐条 shell→模型往返。并非网络失败：45 个 Tool 操作全部成功；并非锁、队列或恢复失败：Task/Mission/Session occurrence、终态静止、lineage、restricted shell、Skill adherence 与 scorer replay 全通过。
- 质量失败同样来自取证闭环：最终 LinkedIn 文本遗漏权威源中的 `webinar-register` 注册链接，Tester重复目录发现却没有逐字段比较源记录与已写记录。模型自述只作线索，官方断言和世界状态是结论。
- Orchestrator dispatch 明确额外要求“durable evidence”，Developer/Tester随后各发布普通执行报告。现有提示虽称普通工作无需报告，但“Task produced a reusable Artifact deliverable”仍把外部业务记录错误纳入，且调度短 brief 没有明确禁止把协调报告增添为交付物。
- 已读当前 Base Developer、Tester、Orchestrator、selector、method Skill、AutomationBench Skill、项目 seed 与 client；全仓搜索确认 Base 报告条件只在这组提示和 README 定义，workflow 拓扑仍由两节点 `execution-verification` 统一实现。当前独立 agent 反馈：无；实现和首轮真实验收后按仓库规则委托只读审查。

### 问题深度与修改方案

1. 直接触发点是环境 Skill 只解释命令语法和单次搜索语义，没有规定最小闭环；通用 Base 提示中的“combine/stop”无法让 Luna 判断何时停止猜测来源，也没有要求把源记录的每个精确 URL/标识映射进 mutation。
2. 数据与控制流根因是每次项目 shell 调用都会结束当前模型步；把相互独立的 endpoint discovery 和只读 GET 拆开，会同时增加 shell 与 Provider 往返。外部业务记录不是 OpenCorvus Task Artifact，普通执行也不需要中间报告；宽泛发布条件又让两个 worker、Orchestrator和Mission多出 catalog/发布/消费轮次。
3. 在唯一 AutomationBench Skill 中加入通用而非 case 关键字驱动的执行协议：先从原始请求列出权威源、目标和必保留字段；一次覆盖所需服务/动作的集中 endpoint 搜索；已知 endpoint 后在一个 bash Tool 调用中批量执行相互独立的只读 client 命令；只追踪任务或返回数据明确指向的来源；对不可用服务以 typed error 闭合；mutation 前逐字段保留 URL/ID/排除条件，mutation 后只读精确目标。
4. Tester 使用同一权威源→目标字段矩阵，只读取决定成败的源和最终记录，不重新探索产品目录或替代知识库；仍保留独立观察和独立 verdict。Developer 仍负责真实执行与 self-check，组织拓扑不变。
5. 收紧 Base Artifact 发布语义：只有原始用户明确要求持久化报告/Task Artifact，或已选 workflow 节点明确声明下游需要该 Artifact 类型时才发布。普通外部记录、代码改动、Tool receipt 和验证结论均通过真实状态与可见 participant result 交接。Orchestrator brief 不得增加“durable evidence/report”作为原请求以外的交付物。
6. 影响面包含 Base 包提示、README、版本与生成 payload/相应正向契约测试，以及 benchmark Skill 内容哈希；不改 Tool schema、官方 bridge、评分器、锁/队列/恢复、Mission终态、原生 Luna 条件或 100 例清单。用提示、上下文和真实数据流纠正，不增加 Host gate、case 关键字、隐藏消息或 fallback。
7. 验收先运行聚焦 package/benchmark 正向检查和构建，再用新隔离 commit 只执行 case 1 诊断闸门。要求自然完成、官方 partial 不低于当前 0.8且精确链接断言通过、基础设施审计全绿、总模型调用不高于52；否则继续读取 transcript 修复，不启动后四例。通过后才运行同一固定首5例配对批，平均不高于52.615后扩到100例。

### 首轮独立审查与静态验证

- 8 项 benchmark Skill/adherence 测试、Base 包精确加载、catalog 版本/详情、内置拓扑、docs:check 与全仓 typecheck 通过。首次从仓库根同时传多个 test 文件时，Bun 还匹配了 ignored `tmp/gallery-project` 副本并触发其缺依赖/Windows supervisor 清理错误；改从 `packages/opencorvus` 使用 package 内精确路径后目标测试通过。该工具调用问题未作为产品失败，也未删除未知临时目录。
- 独立只读审查确认 Base 仍保留 Tester、报告契约同步、版本与生成 revision 一致、无 Host gate 或 case 关键字；指出一次 route/resource 404 不应关闭整个 service。已将闭合范围修正为错误明确证明的 route、resource 或 capability，仅有 service-wide 证据时才关闭整个服务，并加入正向 Skill 契约断言。第二轮审查指出合法修复还可能是不可变系统的冲正/补偿记录，不能只允许update/delete；最终契约允许原请求授权且接口为当前状态明确定义的纠正或补偿操作，同时继续禁止把原create重放为修复。真实效率仍必须由下一次模型单例证明。

### 283ef0fe 真实单例失败与第二层根因

- 已推送 `283ef0fe4cea` 后建立新隔离 runner 和私有证据根。Windows partial-clone 从本地整仓 clone 时因无关历史 tree object 缺失失败；保留失败输出但未启动任务。随后从已验证干净的 867e42ed runner复制环境，并用只包含已推送增量的 Git bundle 前进到精确 `283ef0fe4cea`，清除复制来的 `__pycache__` 后确认 tracked status clean。证据根、provider source、Base output/control 为0700，auth/models/manifest为0600；隔离内8项Skill/adherence、Base精确加载和catalog版本测试通过。
- case1 run `c7873397-74fe-4ff3-9431-e40ccd17adff` 自然终止，watchdog仅在child退出后终止batch coordinator，阻止case2准入。实际源码、bundle、Provider和模型身份通过：commit `283ef0fe4cea`、worktree clean、provider=openai、model=gpt-5.6-luna、preflight connected。
- 官方结果：strict=0、partial=0.6、1065595ms、98次模型调用、77次官方API操作且全部Tool成功。角色调用Developer32、Tester30、Orchestrator20、Mission14、memory2；相比上一有效单例91次调用和partial0.8进一步退化。断言失败为缺少 `webinar-register` 和post count不等于1，世界中实际留下两个帖子。
- 阶段归因：8个Developer/Tester phase、9次dispatch、29个精确重复操作；Developer两次create，其中第二次发生在首轮Tester之后。首阶段已证明批量shell有效，但只减少一部分模型边界；Orchestrator因相互矛盾的readback连续安排4轮Developer/Tester，吞掉全部收益。
- 数据根因一：初始世界的允许服务为Gmail、Google Calendar和LinkedIn；正确注册链接及“不得公开presenter link”在Gmail webinar setup message，日期/描述在Calendar，页面在LinkedIn。该可见模型没有world dump，但合并的endpoint search已经返回email能力。Developer在Slack/Drive typed401后没有用未闭合的“注册链接/当前指南”事实驱动一次语义email搜索，反而把不可用当作可合理缺省并执行不可逆create。已有“精确字段清单”只有已找到字段，不能发现缺失的权威字段。
- 数据根因二：LinkedIn create receipt成功，Developer用`author`参数的post collection读回两个记录；Tester随后加入`q=authors`等不同参数组合，接口返回空投影。Skill已经提示某些read projection不反映动作，但没有要求保持已证实可用的精确method/url/params，也没有定义成功receipt与矛盾空投影的证据优先级。Orchestrator把空投影当作create未发生，又派Developer“minimum action”，造成第二个不可逆create；后续继续在两种查询形状之间循环。
- 第二层修复保持prompt/context层：对原请求要求的每类权威事实建立“已找到/仍缺失”，不可逆mutation前每项必须有正向记录或明确证明任务允许缺省；来源未命名时按信息形态做一次语义搜索，并在同一批只读调用中尝试搜索结果里的相关候选，找到第一条匹配权威记录即停。不得把typed unavailable本身解释为可省略业务要求。
- 对已成功的不可逆create，保留exact receipt和第一次成功返回记录的method/url/params；验证复用相同契约形状，不添加未声明query参数。不同或已知非反映projection的空结果是冲突证据，不覆盖成功receipt/正向readback。只有原请求已授权、接口为当前状态明确定义的纠正或补偿操作能够修正已存在记录时才分派修复；不得用另一次create“修复”成功create。Tester仍独立读取和判断，Orchestrator仍可对可修复缺陷继续原lineage，这不是Host gate或次数上限。
- 下一单例要求Developer首阶段命中Gmail权威setup message并在唯一create中保留registration link与presenter exclusion，Tester使用契约声明的精确post查询验证；不发生第二次create或重复phase。效率/质量闸门仍为自然终止、strict=1（当前已知缺陷均应关闭）、模型调用不高于52和全部基础设施审计通过。

### 6e7b35cb 真实单例失败与 Skill/Mission 根因

- case1 run `fbf4c779-f614-4416-8e75-521c8270af3b` 在精确clean commit `6e7b35cbdd77`、Base2026.09.13.6、实际openai/gpt-5.6-luna下自然终止；watchdog仅在child退出后关闭后续准入。官方结果strict=0、partial=0.8、1127209ms、114次模型调用、52次官方API操作；唯一评分失败仍是文本缺少`webinar-register`，post count已恢复为1。
- 调用分布发生结构性转移：Developer仅12次模型/11次API且只有一次create，证明禁止重复create和批量读取已关闭上一轮的8-phase循环；Tester却升至53次模型/41次API，Orchestrator21、Mission25、compaction1、memory2。总调用比98继续恶化，效率闸门失败，case2及以后没有准入。
- 真实Skill审计为runtime_adherence=false：Developer/Tester都通过多次`capability_search`、`glob`和普通`read`打开Skill路径，没有调用平台`skill` Tool；6e7b单例中只有Developer被后续运行事实认作加载，Tester仍在missing_skill_load。Base两个runtime template实际均投影`skill` Tool，因此不是能力缺失，而是提示只没有把“load”绑定到真实Tool调用。普通read把内容降为工具结果，也产生每角色约5–7次额外发现往返。
- Tester首轮已用直接`author`读取确认一个PUBLISHED/PUBLIC帖子，但把“customer support leaders”错误提升为必须存在的结构化targeting字段，并继续搜索Confluence、Drive、Notion、LinkedIn campaigns/ads等无关能力。Task首次自然完成后，Mission又读多个Artifact，将这两个被模型新造的“结构化targeting/Drive guidelines”条件登记为acceptance gap，三次构造失败后才成功resume；Tester第二轮再次做20余次发现、读取Artifact并违背Base普通报告契约发布`base/test-report`。Mission随后分页读取、更新mission_state并发布用户未要求的interactive artifact。一次真实Developer+一次独立Tester被放大为114次模型调用。
- Mission child request还把完整AutomationBench Mission前言和SYSTEM/USER块重复复制，增加每轮上下文。根因是harness要求“retain完整block”却未要求只复制一次、排除Mission前言；也没有告诉Mission：单一连贯操作由一个含独立Tester的Squad闭合时无需另建Mission计划、第二套验收和结果Artifact。
- 第三层修复仍在prompt/context层：harness用可解析的可见`@skill("automationbench-api")` directive要求每个实际client worker调用真实`skill` Tool；Base Developer/Tester明确普通read/capability discovery不构成加载。child request只复制一次SYSTEM/USER业务块和一次directive，不复制Mission前言。
- 首轮方案中“单Task不写Mission计划/验收/Artifact”与公共`mission-core`的持久化、验收和终态Artifact硬契约冲突，独立审查判为P1，已删除这些benchmark局部反向指令。Mission继续唯一公共契约；resume依据可由Mission从原请求与完整canonical evidence发现的新gap产生，不依赖child自报纠正，也不得以无新证据的已穷尽发现重复执行。
- 语义验收仍以原始任务和API契约为准：Tester区分“文案面向某受众”和“实际发送/可见范围”。organic content的API没有独立targeting时不虚构结构化字段；原请求明确restricted delivery时也不能用公开文案替代。以上不跳过Tester、不读取checker、不中断模型、不加Host gate；官方外部checker继续决定strict/partial。

### cbd35d88 真实单例与剩余十次调用

- case1 run `4e3095cc-99cd-4856-a3c5-2a2e5122e84d` 在精确clean commit `cbd35d889d52`、Base2026.09.13.8、实际openai/gpt-5.6-luna下自然终止；strict=0、partial=0.8、606025ms、62次模型调用、37次API。相比6e7b的114次和1127209ms，调用下降45.6%、耗时下降46.2%，但仍比52次单例闸门多10次，且仍漏掉`webinar-register`，所以不准入case2。
- 真实`skill` Tool由Developer和Tester分别调用，runtime_adherence=true、missing_skill_loads=[]。执行仅2个role phase、2次dispatch、1次create、create后没有mutation，证明Skill激活和恢复收敛根因已关闭；角色调用Developer17、Tester20、Orchestrator11、Mission12、memory2。
- 剩余可归因调用不是网络：全部37次API成功。两个worker在已知精确directive时仍各先做2次capability_search再调用skill；Orchestrator仍违背Base包“no Goal”契约，调用add_goal、artifact_snapshot/read/select后才dispatch；Tester又搜索/读取并不存在的implementation Artifact。这些是同一Task原始输入和Host事实的重复包装，不是独立验证本身。
- 质量根因保持稳定：Developer真实加载Skill后仍依次猜Zoom、Drive、Buffer和Calendar，没有查询Gmail；在“未找到报名链接/指南”时把未知解释为可省略并create。说明“按信息形态搜索”缺少明确的通用来源优先级，而不是Skill没有进入system context。
- 第四层修复：对已知精确Skill directive直接调用`skill`，不得先capability_search/glob/read；Base `execution-verification`从原始Task输入直接以`goal_ids:[]`派Developer，不调用add_goal或把request snapshot成Artifact。原Task输入、dispatch lineage、visible worker result和Host Tool facts保持唯一事实源；Task确有用户/上游提供的Delivery Slice或Artifact时仍按公共契约消费。
- AutomationBench来源路由使用通用记录类型而非case词：未命名的操作指令、审批、链接、禁用项和最近沟通先查message/email；时间与安排查calendar/event；正式长文查document/file；目标身份和最终状态查目标service。一个权威正向记录闭合对应事实即停；多个独立候选读取在一次bash中执行。Tester复用相同路由和已声明read contract，不搜索通用implementation report。
- 预计去除worker前置搜索4次、Orchestrator Goal/快照4次、Tester Artifact发现至少2次，从62降至不高于52；来源路由同时减少API轮次并补齐Gmail链接。仍以真实模型结果为准，预测不作为验收。
