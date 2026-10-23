# 已授权能力发现、加载与执行闭合

## Recall

- 用户原始要求：按已授权能力可自主发现、自动加载和执行的方向深入审计并修复；解决 Explore 的 Skill 加载限制和联合发布工具超限，补齐包声明到运行时可执行性的校验；先写方案，修复共享根因并真实验收，不只改 Evolution Lab 绕过问题。
- 单 agent 实施，不委托。保留开始时 overlay 十三个文件、07-panel 和根/月 README 的既有修改，以及 `.bun/`、`packages/opencorvus/bun/` 未跟踪目录；不创建 branch/worktree，不操作现用进程。凭据与模型目录只有用户明确批准后才用于新隔离服务，绝不输出或提交内容。
- 验收指标：普通请求无 @Skill 标记也直接获得已授权 loader；Explore 真实读取其获授包 Skill；专业工具由模型搜索精确引用并激活，真实调用产生明确产物；共享结构完整保留，规范化发布定义低于 32,000 字符及 8,000 估算 token；无效声明在包验证或真实模型适配边界返回明确错误；恢复仍由冻结目录与原授权重建。禁止用静态断言、模拟 Provider 或夹具冒充真实模型端到端。
- 已读：AGENTS.md；当前 capability-search-runtime、17-code-work-agent-platform 的发现/授权/预算契约；341 Skill loader 常驻方案与记录；runtime-template-registry、tool-pool-data/contract、session-agent-runtime、capability-grants、registry、prompt-profile-resolver、Skill mounts/eligibility/required-tools、SessionLoop 的 loader/provider 初始化、plugin tool、ProviderSchema/Transform/tool-execution-input、package-tool-bundle/capsule/process-supervisor；skill-reveal/task-routine-tools/tool-definition-budget、typed-publisher-provider-schema/package-tool-native-runtime 及测试 runner。
- 全仓搜索：skillMountable 的全部定义/调用；Skill 与 Mission Skill loader 的授权和常驻路径；包 projection 展开、资源引用和 package publication/introspection；publish-evolution-artifact 的全部声明/调用；Provider JSON Schema（JavaScript Object Notation Schema，工具参数结构）归一化、预算及执行输入转换；根 package scripts、文档检查和隔离测试/真实 checker。未检索 UI 自动化路径，不新增或运行 UI 自动测试。

## 问题深度、证据及影响

1. Explore 在唯一模板标为 skillMountable=false，基础工具池没有 skill；Evolution Observer 的 projection 却明确授予 Campaign Skill。包验证检查引用存在和所有权，没有验证 loader 及 Skill.required_tools 闭合。operator mount 拒绝 Explore，manifest Skill 又可被接纳，产生两种互相矛盾的能力声明。方法性 Skill 的读取本身不授予其叙述中的工具、调度或写权限。
2. plugin.tool.introspect 默认展开重复 Zod 子结构。未改代码直接调用 Evolution 联合发布 introspect，原结构 53,599 字符；同一个 canonical inputSchema 使用 Zod reused=ref 输出 14,929 字符、31 个共享定义。运行时实际限制为规范化扩展工具 32,000 字符、8,000 估算 token，不是源码字节。原预算只在 reveal 时检查，因此不满足预算的包可以先被接纳。不能通过提高上限、删字段、opaque payload 或改 Evolution 模板遮蔽。
3. 共享引用会影响 Provider 适配、OpenAI strict optional-null 还原及 JSON Pointer（JSON 指针）解析，必须同步审计；canonical Zod 执行校验保持唯一来源。现有按 inline 结构定位字段的后台测试需按当前引用契约更新为明确正向行为验收。
4. 影响面：所有包 Skill 授权/设置挂载、所有 package tool introspection、包安装/不可变 revision 加载、Task scheduler/worker 模型请求与执行；Chat/Work/Mission loader 保持真实目录 owner。默认/远程 MCP（Model Context Protocol，模型上下文协议）能力沿既有 resolver 与真实权限，每次实际模型定义仍受预算。认证、权限规则和角色获授集合不可由搜索或 Skill 文本扩张。
5. 当前未观察到调度、队列或终态收敛异常；本次不修改其协议、数据库 schema、消息参与者或任务所有权。若真实运行出现该类异常，立即按共享机制横向审计全部生产入口、Task/Mission/Session 轮次、正常/终态、恢复/重试及多项目隔离，不能归为局部偶发。
6. 公共契约：保留工具名字、参数语义、原执行 Zod 校验及产物协议；JSON Schema 改用标准共享引用。无数据库格式升级，无发布版本、tag 或 Release。风险为模型提供商对共享引用的支持、严格输入还原、包验证新发现的无效存量声明及检查成本；通过聚焦合同与实际模型验证，不建立旧格式后备路径。

## 实施方案（生产修改前落盘）

1. 先补正向后台复现：Explore 获授 Skill 的 loader/读取、无效 Skill 依赖错误、联合发布真实 schema 预算与合法/非法输入的明确契约。保留修复前失败事实。
2. 在唯一模板与工具池赋予 Explore 通用 Skill loader。现有 Role/Skill 权限、required_tools 资格和冻结 Harness 继续约束可加载内容，不按自然语言关键字扩权；普通请求直接使用 loader，专业叶子沿 capability_search 精确激活。
3. plugin tool 用同一个 canonical Zod schema 生成标准共享引用；Provider 执行输入转换完整解析本地引用，保持严格模式可选 null、联合分支选择与原始值语义，错误引用显式失败。先测量完整规范化结果；若不可约定义仍超限，返回精确预算错误并要求包作者拆分真实动作。
4. 包声明验证补 Skill loader/required_tools 的完整闭合，覆盖 scheduler、worker、Capability Set 展开及原生角色可投影范围。package tool 在无业务执行权限的隔离 introspection 进程验证其真实定义及单叶预算，复用现有 bundle、RPC（Remote Procedure Call，远程过程调用）、进程监督及结算机制；真实 Task 下继续使用其 task-owned capsule。实际 Provider 归一化后的定义继续走同一预算计算，不另设上限或复制策略。
5. 审计所有 production 包入口与存量包，修复本任务暴露的真实契约缺陷；不保留旧双源。更新当前架构与相关测试/文档。检查范围外技术债只记录，不扩大清理。

## 验收闭环与环境

- 使用 package 声明的隔离 runner 运行直接相关后台测试；所有新断言验证实际结果、产物、状态或明确错误类型/字段。不运行无目标全套 bun test，不运行 UI 自动测试。
- 运行后端及 plugin 聚焦类型检查、expert-squad 类型与文档/架构索引检查。新增规格同步根/月 README，精确暂存本任务条目，保留用户已有条目。
- 真实 checker 在新隔离运行根启动正式开发服务，使用 `http://localhost:<port>/ui` 查看真实流程；无界面代码修改，仍记录人工交互截图和模型工具事实。复用仓库成熟的 native/隔离服务和进程结算 primitive，不重启现用服务。
- 真实 Provider 必须先分别验证凭据可用、配套 models 目录存在目标投影、实际流请求模型一致；用户已明确授权本轮使用本机 OpenAI 凭据及完整模型目录调用 gpt-6.1-sol。仅记录脱敏请求计数、工具定义大小、Skill 输出和正式发布产物。验收限制：最多 24 次实际流式请求，180 秒无真实活动失败；正常停止并等待原启动进程及所有自有子进程/输出结算，最后移除隔离凭据副本。工具自然失败完整保留，模型未执行目标不得算通过。
- 真实路径覆盖通用测试包 Explore（证明非 Evolution 特例）、Evolution Observer 的原包声明及可加载 Skill、联合发布机会 Artifact；另覆盖受控无效包、两项目隔离和同轮恢复的后台合同。凭据或 Provider 外部不可用时如实记录，不把本地合同替代真实模型结果。
- 完成后人工复核差异，创建仅本任务提交；fresh fetch/upstream merge 后检查全部待推送提交、完成必要验证并正常 push，不 bypass hooks。

## 进度

- 包实际描述已沿 admitted executable definition 投影到 scheduler/worker Catalog；native Task 物化重检同一冻结定义。后端实际包工具执行及 package MCP 合同3项/52断言通过，描述投影3项/4断言通过，最新backend类型通过。
- 首轮19124已公开shutdown200、原exec82310 exit0、native physical/output/request结清；24个原reader均settled。四份隔离auth/models已清理，实际值扫描0，源OAuth条目与完整models内容/mtime保持。新19125只复验Evolution，不与通用Task争用原请求额度，保持新独立24请求上限；不延长或重写原失败轮次。
- 通用实际 Task `tsk_g00VYtiobx00uWRStMZM` 已 completed：真实 gpt-6.1-sol 自行搜索方法（第一次中文搜索0，第二次英文命中）、加载 root 和 supporting marker、两次 capability_search 搜索/精确激活、实际 native report 返回 `authorized-capability-executed` 与准确 marker；UI 已打开成员并截图。所有真实 tool/result 与最终生命周期保留。
- 同服务 Evolution Task 在联合发布之前被原 24 次总请求限制中断，终态 failed/interrupted、原错误 E2E_REQUEST_BUDGET_EXHAUSTED，不能宣称发布通过。24 次实际流请求均 HTTP200、原 reader settled；通用 Task 已正常完成，未发现该轮调度收敛异常。失败按 checker 额度诱发分类，有精确 terminalError，不归咎凭据或模型。
- 新关联根因（生产修改前补录）：真实搜索结果的包工具 description 来自编码后 Provider 名称拼接（`... is published by ...`），而非冻结 ToolDefinition 的用途，导致按用途检索缺少真实语义。包准入已真实 introspect，需把该唯一可执行定义的描述投影到 scheduler/worker Catalog；同时比较 Task capsule 的同一冻结定义与准入定义以发现实际漂移，不能另加手写描述配置或 fallback。补正向目录描述合同，再以新隔离轮次验证真实搜索和发布。原失败服务先正常关闭并结清；新轮次具有独立原预算，不能改写首次失败。
- 全部122包已通过真实准入检查；第一次checker只因自有SQLite未关闭而清理EBUSY，修复检查器close后原命令重跑exit0。backend及plugin类型通过；新13项/36断言、reveal-owner7项/33断言、native-skill3项/9断言通过。原测试的Goal常驻工具期望已按当前契约更新。
- 最新用户追加：举一反三调查并修复同类及关联问题。扩展审计到全部内置包、所有模板、默认/包内 Skill、Capability Set、所有包入口及 Provider 共享引用；不引入额外权限或并行 agent。
- 共享引用关联缺陷：Google 的数组元素补型会把 `$ref` 对象误补成 string；OpenAI 根联合 envelope 将 `$defs` 移入 operation 导致根引用失效；strict 输入还原原先不解析 `$ref`。同步修复并以合法数据、实际校验错误和 canonical 还原验证。默认工具引用也参与 Skill 依赖闭合，不能只检查 built-in 子集。
- 初始阶段先落盘调查与方案，再开始生产实现。
- 初始实测原 schema 53,599 字符 / Zod 共享引用 14,929 字符；当时尚无实际 Provider 归一化与真实执行资格，最终结果见下。
- 原隔离 runner 68227 正常 exit1：7 项中 1 通过 / 6 失败；Explore loader、OpenAI 54,367 / Anthropic 53,900 / Google 54,092 规范化字符超限、未声明 write 的 Skill 及 48,000 字符工具均被错误接纳，完整原输出已观察。共享 schema 的执行输入测试在 inline 原实现通过，后续必须在 ref 输出上继续通过。
- 用户已明确批准本次隔离服务使用现有 OpenAI 凭据与配套模型目录调用 gpt-6.1-sol。

## 最终结果与复核

- 共享机制修复：Explore loader 和 operator mount；包/default Skill 的 loader 与 required_tools 闭合；所有 plugin Tool 从同一 Zod 执行 schema 输出共享引用；strict 输入本地引用、根 envelope 定义范围、Google 引用型数组；冻结包隔离元数据检查与单叶字符/token 预算；真实用途描述进入 Catalog；Task 物化与准入定义一致性。Evolution Lab 的包、版本、角色和联合工具均未改，未增加兼容路径或提高上限。
- 新17项/41断言全部通过，覆盖三种 Provider 适配、合法共享对象数组、optional/null、根联合、明确引用错误、包Skill缺loader/缺依赖、默认Skill缺依赖、字符与密集文本token超限、真实描述投影及两个独立项目的Explore实际Skill读取。另有Skill reveal恢复1/13、typed publisher2/10、role routine19/42、native Skill3/9、reveal owner7/33（包括实际跨进程提交）、真实native package1/11、Evolution原包投影1/44、实际package Tool和package MCP3/52通过。后端、plugin、全expert-squads类型及docs/architecture检查通过；最终同一个生产准入checker122/122、invalid0、正常exit0。未运行UI自动测试，未用mock代替真实Provider。
- 实际OpenAI规范化发布定义：54,367→15,697字符、3,909估算token；Anthropic和Google适配均15,230字符、3,792估算token。三者共享原精确参数与canonical Zod执行校验，未使用opaque payload；后两者是适配合同验证，没有网络端到端声明。
- 第二独立服务19125正式Task `tsk_g00VYtlbh0008KQsIZVZ` 正常completed（epoch1）。原包 `evolution-observer` 真实加载 `evolution-lab-campaign`，自主搜索/精确激活联合工具并通过native capsule发布 `art_hbsmITck3igEswPoBvjP`，类型为 `evolution-lab/opportunity@1`。Scheduler另经真实artifact_search/read/select完整读取该记录并用原产物和worker消息作完成依据；不是模型自述或静态schema替代。实际16/24次gpt-6.1-sol流请求，全部HTTP200、原reader settled。
- 19124与19125均在自有页面查看实际工具、回执和终态并保存人工截图；无界面源码修改。两次公开shutdown200，原exec82310/65364均join0，native physical/output/request与原launcher结清。八份隔离auth/models全部退休；逐实际凭据值扫描0；源完整OAuth条目与完整models内容/mtime保持。原24额度失败、首轮checker EBUSY和准备期错误均保留，不把失败说成通过。
- 新checker的同源包检查与实际Task执行已人工二次复核。未发现调度、队列或终态恢复异常；原失败的精确原因是checker额度，后续Task正常完成，后台跨进程reveal和目录隔离合同保持。没有数据库结构或持久格式升级，没有发布版本、tag、Release或PR。
- [真实工具事实、失败、发布记录与结算证据](../../artifacts/2026-10-24-authorized-capability-execution/README.md)。本次实际仅验证本地发布机会Artifact和通用报告调用；不声称完整Evolution Campaign、候选评估、远程MCP认证或外部发布已经验收。

## 权威资料

- [Zod共享结构的JSON Schema输出](https://zod.dev/json-schema)：采用现有reused=ref，不另写schema压缩器。
- [OpenAI结构化输出的definitions支持](https://developers.openai.com/api/docs/guides/structured-outputs)：本地共享定义及严格必需字段的官方合同；本轮另有实际gpt-6.1-sol调用证明。
- [Anthropic结构化输出](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)：本地引用支持；本轮只做适配正向合同，未作该Provider网络验收。
