# 以实际结果为中心的运行时纠偏

## Recall

- 用户原话：“每个执行半个小时结果还有0%的，滑天下之大稽”“我要你从底层，从opencorvus的底层，理念开始纠偏”。前序要求原生Luna与Luna+Base对照，并明确冗余调用至少减半。不能把消除少量调用、内部PASS、运行结束或证据密封当作交付成功。
- 本轮承接[复刻记录](2026-09-12-luna-base-reproduction.md)及已实施未提交的直接read-ref发布与终态观察器修复。当前首5例e03f全部完成，暂不扩跑100例；有效零分保留，官方评分不改，模型不换，不能把已见评分断言写进模型提示。
- 验收：公共运行语义保持原始目标高于派生任务/计划；Base普通执行工作流使用执行者→独立验证者，额外研究图仅用于可证明的独立研究分区；最小交付仍包含真实结果和独立复核；原始Tool/Provider消息、来源完整性、权限、恢复和终态事实不削弱。真实同首5例报告严格/部分评分、所有Provider/Tool调用、业务操作和耗时；未达到冗余减半与真实质量验收前不声称优化完成。
- 已读：当前04-extensions、17-code-work-agent-platform、task-control-plane、Mission/Orchestrator核心提示、intent/request-prompt、Base全部角色/manifest/selector/method、实际首5例原始Mission/Task消息、Tool事件、官方assertion_results和内部计划/报告。独立agent已审查前序发布改动提出4项，其中前三项已修正、输入密封加固在验收；此扩大范围尚无独立反馈，首轮验证后只读复审。
- 全仓搜索：固定Planner先行策略存在Base manifest/selector/README/角色、拓扑检查脚本、catalog与package正向测试、网站市场中文元数据；通用authoring模板又把Planner+两个worker作为偏好。Host manifest validator本身允许direct dispatch，不需要引入新运行引擎。Mission核心“Original user input是audit而非stage boundary”与首段原始请求最高权威并置，Task渲染又把Mission派生文本统一标作Full user request，存在语义混淆。
- 权威资料：[OpenAI agent guide](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)建议先充分发挥单agent；[Anthropic effective agents](https://www.anthropic.com/engineering/building-effective-agents)建议由最简单可用方案开始，再以评测决定是否增加复杂度。这里据仓库证据选择保留独立验证，减少无业务增益的前置角色与中转，不照搬某个框架。

## 问题深度与影响

1. 现象：Base首5例17.1–38.8分钟，严格1/5；case1/4部分得分为0。case4内部PASS但官方要求的标签/路由/备注未形成；原始请求本身含隐含业务意图，评分与字面表达存在解释距离，不能仅按评分断言编造新授权。case1围绕“面向客户支持负责人”寻找专用定向字段后判阻塞；该是否必须等同广告定向尚无证据。需要让模型用业务目标和实际数据判断，不能继续把接口字段字面对应当唯一语义。
2. 直接触发与根因：固定角色链、长篇强制结构、冻结搜索候选和“每个字段都要证明语义等效”的提示共同把不确定性变成前置流程。Tester虽然独立读取，却仍被派生Task合同和同一机械方法约束；反复独立推导相同偏差不会带来独立判断。case4 Tester27个assistant消息多于执行者17个，仍漏掉最终业务效果。
3. 旧路径原因：过去针对单例追加约束和proof步骤，没有用单agent基线证明额外步骤有净收益。Host持久化和权限事实本身有价值，错误在于要求模型反复生产/搬运这些事实的派生文档。
4. 公开契约：不改Task/Mission/Session数据库、事件、租约、消息来源、权限或流式Provider。修改现有核心提示中的目标与派生文本关系、Task输入标签、Base的唯一普通工作流声明/角色方法、包作者指导和当前架构；替换普通工作流旧ID，不保留兼容图。复杂并行研究图保留其不同的真实需求，不是旧路径fallback。
5. 横向边界：所有Mission创建及root Task共用请求渲染，必须保持输入原字节并且不得误标调用方为用户；不同Squad原有依赖仍按其声明，不强行删专业审查。Base修复继续沿同Task同worker谱系，Tester只能在执行者收敛后读回；调度和重启恢复不加旁路。旧冻结runner需同语义投影并归档差异，旧结果身份不变。
6. 风险：短提示可能暴露此前由冗长步骤掩盖的问题；最小角色并不保证Luna业务推理改善。真实评分仍是独立证据，不能为一次观察结果改任务清单或挑选重试。仅源码和局部测试不能证明总体速度或质量收益。

## 实施

1. Mission交接先保留原始输入，再用简短分工说明增加所有权、前提和必要验收；不强制重复的八段任务合同，不允许派生Scope或Acceptance降低原始目标。Task显示按实际含义称“Task input”，不暗示派生文本由用户逐字提出。
2. Base普通图替换为`execution-verification`：Developer→Tester。保留`planner-parallel-delivery`用于真实独立研究分区，Planner只做足以分配工作的简短设计。Orchestrator按能力与依赖自然选择，不加host路由gate。
3. Developer根据原始任务和权威业务数据规划并执行，合并互不依赖的读取，按目标相关性探索，不机械穷举authority账本。Tester先独立理解目标和看当前状态，再比较执行声明，一份test-report直接记录具体预期/观察/差距；删除先publish再search/read/select自己的验收清单。报告是证据索引与判断，不是替代结果。
4. 包作者指导采用最小足够协作，按独立信息/权限/结果需求增加节点，不再默认Planner+两个worker。同步所有引用、包版本、generated、拓扑和正向测试。
5. 全部有效独立审查发现关闭后再冻结新配置、真实首5例。当前无新模型运行。

### 环境适配边界的追加纠偏

冻结运行时的automationbench-api Skill还注入了10步业务策略：固定拼接的搜索词、冻结来源账本、强制每字段effect row、验收清单，以及成功调用但状态读回不一致时直接将effect row关闭。真实case4计划逐字消费了该环境策略，故仅精简Base仍会被适配器重新注入旧流程。Skill应只描述模拟环境、3个官方工具的真实传输方式、参数/错误语义与证据访问边界，不替模型规定业务推理、角色工作流或验收结论。同步替换该历史适配Skill，保留模拟状态的局限说明但不从HTTP成功推导任务完成；官方工具、世界和checker不变。此为新配置的显式变化，不能把复验效果仅归因于角色数变化。

## 实施与验证状态

- 当前生产源码完成第一轮纠偏；Base与SquadSDK为2026.09.12.2，现有唯一payload/市场生成器已重新生成。纯Task输入渲染测试确认原始内容和归属保持；实际包投影确认普通图为Developer→Tester，原并行研究图完整保留。
- 当前聚焦29项经修正旧selector标题断言后全部通过（前15项通过，catalog-index14项/75断言独立重跑）；全仓typecheck8任务、docs339 operations/25 groups和topology121包/133图通过。冻结运行时17项/100断言、环境Skill合同1项/4断言、产品及benchmark两份typecheck通过；这些不代表模型效果验收。
- 两轮独立只读审查已关闭全部5项发现：同locator多read-ref归一化、废弃generic selection解析器清理、失败消费者计量、密封输入字节/身份/路径边界、SquadSDK真实作者/审查角色的旧Planner默认偏好。最终reviewer独立复跑26项TypeScript和5项Python，并从真实密封数据复算48/540/737基线，无未解决发现。
- e03f首5例均完成官方世界独立复算并保留正式榜单身份；新配置固定clean commit `3f9cb474b577f6e313492ed48b5b4bbf1bfa4f1f`，tree `975415012f91fe8bf3534429ea87eafa2b64a4b3`，父e03f。41文件精确增量268627bytes，SHA-256 `fffaa66226690460734bc1bd6ccdafcc4d3e13cbb0140812b8b220f8a77185f1`，已由独立reviewer与冻结diff逐字节比对。
- 新目录 `/var/lib/opencorvus-benchmark/reproduction-20260912-outcome-first` 同时投影已授权新安装auth/models，精确Luna流式预检HTTP200。未输出秘密。首5例batch `6f1e14ec-71f4-4434-b3ec-9d6dfbef1168` 并发2，600秒无活动窗口不变；case1 `bd9db4a4-f806-41ad-ace8-979b3cca9c52`、case2 `d170f696-0822-49cb-af90-c2ef42b5baa7`，Windows隐藏host PID27988。启动前核验commit精确且status为空。
- 当前未完成：新配置真实质量、总调用与耗时/冗余减半验收，后续100例双组及论文完整更新。不能把本轮源码纠偏称为底层所有问题已修复，也不能从简化角色直接推断质量改善。

- 主agent已在独立Astro开发服务59850打开真实Base市场页，点击角色衔接说明并查看普通两节点/研究四节点截图，版本2026.09.12.2、说明与派生拓扑一致。初始Node启动不支持既有bun:sqlite；改以Bun启动后遇到本轮生成content-assets缓存的Windows rename EPERM，保存该精确缓存副本并仅移除该自动生成文件，原开发验收重跑成功。未改框架依赖或用户服务；验收后停止自建预览PID7908。未运行UI自动化测试。
- 新配置查看器在 http://localhost:8766/ui，以新Base根和原生根显式启动（Windows隐藏host PID9776）；原8765旧基线页面保持。主agent查看真实截图：原生5已评分/1严格通过，新Base0已评分/2运行，通过率为未知。自动唤醒luna-base已更新到最新Recall、3f9cb474、当前batch和新结果页；后续只有实质进展才通知。

- 市场生成器还刷新featured-squads里5个已滞后的既有包version/digest；这些包的source manifest在本轮没有改动，生成值来自当前索引与唯一payload。保留整份可重现生成结果，不手工保留过期digest。
