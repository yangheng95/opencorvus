# CI workflow and dependency repair

## Recall

用户要求“修复ci问题”。本侧对话只修复当前持续集成（Continuous Integration，CI）失败，不继续主线程界面迭代、不委托、不创建分支或工作树、不重发安装包。当前main起点c3a5ee40c；会话组件、conversation-ui、dom-utils与07-panel-reactivity有主线程未提交修改，必须保留。

验收：最新失败run38251166220的workflow contract与dependency audit使用原检查器通过；聚焦非界面正向行为验证、完整锁文件差异审查、文档检查与推送钩子通过；推送后检查真实GitHub运行。不得忽略安全告警、降低审计阈值、删除有效检查、伪称旧安装包已修复或用局部测试替代远端结论。依赖安装不改写主线程正在使用的node_modules，先使用lockfile-only和独立临时依赖目录验证。

已读AGENTS、RELEASE、test.yml/build.yml/setup-bun、github-actions-workflow-contract/ci-scope、根与相关package manifests、Bun锁文件、package-topology、2026-10-05-dependency-remediation记录及发布日志方案。已全仓搜索相关依赖的声明、调用、锁节点、运行时打包入口和历史决定；本次检索的workflow测试没有界面自动化或负向断言。没有发现Task/Mission/Session调度异常，故不变更其状态、队列、恢复或多项目契约。

## 根因与影响面

1. verify在workflow contract第692行失败：prepare新增真实“Verify written release notes”步骤后，测试仍断言末尾固定9步，遗漏新增步骤。旧测试按位置截取，无法表达从版本检查至发布认领的当前完整顺序。修正当前步骤序列和日志检查命令契约，并实际执行根日志checker；生产发布流程本身保持现状。
2. audit报告5项实际锁定漏洞：braces3.0.3、http-cache-semantics4.2.0、katex0.16.47、postcss-selector-parser6.1.4、sprintf-js1.1.3。历史审计已保留前两项未修复事实，新增公告与锁定版本停留导致持续失败。失败阻止critical builds与三平台unit开始；不能把后续skipped当作另一调度故障。
3. 官方npm（Node Package Manager，包管理注册表）当前提供http-cache-semantics4.3.0、KaTeX0.18.11、selector-parser7.1.6；对应已公布修复范围。braces仍只有3.0.3，但实际唯一父链@parcel/watcher2.5.1→micromatch使用它，新watcher2.6.0已用picomatch；sprintf-js仍1.1.3，而tedious20.3.6起已删除该依赖。当前锁包含tedious20.0.0与mssql/tedious18.6.2两个节点，需要统一处理。
4. Watcher是后端文件监控与原生打包依赖，须验证实际文件事件与忽略规则；HTTP缓存和CSS选择器用于官网构建；KaTeX由Mermaid消费，需检验公开API及构建兼容。Tedious为Drizzle安装图中的SQL Server依赖，生产源码无直接SQL Server调用；升级到20.3.7需明确Node22和mssql旧父范围风险，验证实例/API与实际数据库路径。现有Bun版本1.4.0、Node22满足运行时要求，不能据此声称连接了真实SQL Server。

## 实施计划

1. 更新release prepare契约，使用版本校验步骤作为完整有序序列起点，纳入written notes并验证其真实命令。运行原失败的两份workflow测试及check-release-notes。
2. 通过现有单一manifest面精确更新watcher声明及http-cache-semantics/KaTeX/selector-parser/Tedious根override；用Bun1.4.0只更新锁文件。审查全部实际节点差异并保留patches/无关版本；遇到跨主版本不兼容先修正方案再继续。
3. 在独立临时依赖目录验证精确新版本的公开行为、原生watcher事件、缓存隔离与正常缓存复用、选择器转换、数学渲染和SQL参数实例；不测试或改写页面DOM。原bun audit必须无过滤通过。线上构建负责全图frozen安装与平台集成；本地不替换主线程依赖。
4. 更新证据与索引、正常提交、fresh fetch/merge并审查全部待推送提交后push。观察真实CI结果，出现后续失败继续按日志修复；无未核验的“全部通过”声明。

## 外部证据

- [原CI](https://github.com/yangheng95/opencorvus/actions/runs/38251166220)：17个workflow测试通过，1个顺序测试失败；依赖审计2high/2moderate/1low。
- [braces公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)与[watcher2.6.0](https://github.com/parcel-bundler/watcher/releases/tag/v2.6.0)。
- [HTTP缓存公告](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)与[官方4.3.0包](https://registry.npmjs.org/http-cache-semantics/4.3.0)。
- [KaTeX公告](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7)、[选择器公告](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf)。
- [sprintf公告](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)与[Tedious移除实现](https://github.com/tediousjs/tedious/commit/e936c0f98a710538ed03fab266c284cb81eddfe3)。

## 本地实施与验证

现有workflow contract已按当前prepare完整顺序修正，且正向校验实际日志命令。原两文件测试18通过/206断言；真实check-release-notes检查61个历史版本通过。没有修改workflow的审计阈值、终态判断或跳过条件。

watcher及现有7个原生声明统一升级2.6.0，四个根override分别固定HTTP缓存4.3.0、KaTeX0.18.11、选择器7.1.6、Tedious20.3.7。全部实际锁差异为18个节点版本替换、12个过期节点删除：watcher及其12个平台节点、四个选定依赖与KaTeX的commander；删除micromatch/braces链、旧watcher detect-libc、旧Tedious及其重复依赖。上游watcher不再发布win32-ia32，项目现有交付平台是Windows x64，不改变项目矩阵。现有patches及其余版本保持原值。

隔离目录只复制当前manifests、patches和完整锁图，以Bun1.4.0执行frozen安装，1645包成功安装；共享node_modules仍保持旧版本，未刷新或关闭用户应用。新增dependency-ci-contract.test.ts通过真实父包解析依赖，五个正向行为验证实际原生snapshot/事件、带brace的忽略规则、缓存命中/用户变化重验证、CSS转译、SQL参数和GUID错误契约，5通过/10断言。SQL首次冷加载驱动及Azure依赖耗时11秒超过测试默认5秒，故为该真实依赖初始化设置30秒上限后原测试通过；未修改产品超时。测试文件仅复制到隔离安装目录执行，同一文件也进入原CI后端unit入口。没有浏览器或界面自动化断言，数学展示尚未做视觉验收，SQL Server网络连接也不作完成声明。

原始bun audit无ignore或等级过滤，实际检查1731包返回“无漏洞”；Bun frozen lockfile-only验证、package-topology（10工作区）、其聚焦测试（1通过/3断言）、docs:check（345操作/25组）与diff检查通过。新的真实GitHub构建、三平台unit与service结果待推送后核验。

## 远端后续契约修复

41f2cbb20已正常推送，原失败两处在run38253459893实际通过，verify包括critical build也成功；官网run38253459856完成成功。原先被verify失败挡住的service tests现真实执行，暴露mcp-service.test.ts第55行旧断言：生产apiJson已按统一HostTransport契约附加当前ApiAuthority，而此完整请求断言遗漏authority字段。已核对api.ts的captureApiAuthority、请求构造和host-transport定义及其他authority测试，这是历史测试未更新，非本轮依赖升级引入。修复限于从真实当前连接捕获authority并在完整预期中验证，保持生产控制流不变。此测试是传输请求契约，未渲染组件、DOM或页面；不属于界面自动化，也不冒充真实MCP服务端端到端验收。

本地使用原Overlay测试入口`bun run test -- test/mcp-service.test.ts`，5测试/8断言通过，原生监督与隔离测试运行器正常返回0。其他三平台unit仍运行中，等待完整结果后集中处理后续失败，避免反复推送取消正在取得的证据。

相邻五个非界面服务契约（mission-skill-service、project-actions-service、rewind-service、task-rename-service、workspace-discovery-service）经相同原运行器复核，共20测试/66断言通过；这些文件未修改。41f2cbb20的CodeQL运行38253460043也已成功。以上不替代三平台完整unit结论。

等待期间主分支另有f755edc17提交。现有push CI按ref取消旧任务，而workflow_dispatch本来就按run_id隔离；为取得本轮完整结果，MCP修正推送后从现有test.yml手动入口运行全量（test_files留空），读回并绑定实际head_sha。不修改并发策略，不创建新分支或绕过检查。旧run结果按实际终态保留，不能把被取消的unit算通过。

## 完整测试暴露的共享合同漂移：继续实施前分析

67f9469a2完成推送钩子并正常推送；手动run38256988111已启动。旧run38253459893最终failure，三平台unit均因新push取消；取消前Linux完成235/591文件、macOS172/591、Windows102/591，进度不等于全量通过。完成日志揭示此前verify失败掩盖的更多失败，不能以取消或偶发行为略过。

第一组是低层Task创建的promptProfile必填合同：Panel Tool lineage测试、真实HTTP/channel跨进程worker、Panel创建恢复worker和Project初始化HTTP测试没有传入选定专家团。已核对engine/model.ts的必填定义、task-api完整身份和panel透传，以及2026-10-07方案中的有意API调整；修复测试的当前有效输入，不恢复隐式默认选团。

第二组是Mission派发原子消费：旧mission-process-recovery fixture直接以mission.dispatch打开却没有持久化待消费草稿，现行事务因此返回MissionDispatchDraftConflictError。必须横向核对全部4个生产openMissionExecutionWithWake入口、测试入口、dispatch/wake区别、正常/终态、重试/重启和多Project隔离。已有fixture/mission-opened.ts通过setMissionPendingPrompt持久化后再dispatch，生产HTTP读取并传递同一pendingPrompt；Panel创建和恢复使用mission.wake。按当前公开草稿写入入口补齐测试前置事实，不删除事务检查或改生产恢复状态机。其余直接dispatch测试也逐一核对。

第三组待逐项核验：Skill当前直接投影而工具清单期望仍旧；Evolution包版本/诊断入口期望过期；结构化日志字段已进入data；公共ProcessExecutionError/ProcessOutputObserverError替代裸异常；ripgrep测试用桩没有结算。需要以真实定义、输入和执行证据区分过期fixture与产品故障。Project cleanup多项失败、Evolution诊断exit1和进程超时的根因尚未完成分析，暂不修改其行为。

横向补证：全部生产Mission入口仅HTTP dispatch消费pending，其余Panel创建/恢复与HTTP wake使用mission.wake；所有其他直接测试入口均是wake，唯一共享mission-opened辅助已在dispatch前写入pending。此次异常发生在测试fixture的派发事务前置条件，不是恢复扫描/队列/租约路径；原分项目、关闭恢复、原Prompt owner与重启用例完整保留并重跑。ripgrep的Host/Task入口共享`--files --null`与NUL（空字符）解码器，files协议已有实际测试；旧桩写入换行后不会产生一条可交付记录，导致consumer永远到不了break/cleanup。只改桩为实际协议。Skill角色声明明确Mission使用mission_skill，Orchestrator当前拥有skill；调整两份旧清单，不改变权限。进程模块的统一错误类保留cause与输出，日志统一把字段放入data；同步对应测试的当前正向契约。

Project清理日志显示7个失败均在凭据fixture或其后续读取中返回issuer缺失。McpAuth.updateTokens在进入持久化事务前要求issuer，现有auth-durable-revision合同也明确提供它；三个清理测试仍写入旧形态tokens。补齐各自虚构服务的issuer，保留凭据租约、世代、跨Project清理、失败回滚和重启恢复断言；不放宽认证合同。Prompt指导的两处文本测试则使用已删除的旧字段/措辞，修正为当前完整证据分页、repair occurrence和catalog revision指导，不恢复旧图流程约束。

Evolution失败另有明确分层：Windows runner临时目录使用RUNNER~1，生产Task binding按原生realpath保存runneradmin物理根，并另存logical_workspace_root；测试错误地将二者视为相同。补验两种路径语义，保留完整初始文件/独立同伴数据验收。嵌入包测试固定旧发布日期版本且重算可变源码contentDigest，按仓库规则删除这种源码摘要验收，保留manifest投影与现有实际包工具/比较结果验收。诊断准备测试的注册目标则是已退休包的固定身份：本地prepare合同应先从当前不可变嵌入包取得身份，再冻结进测试registration；保留生产登记身份检查及已有旧registration返回明确失败的正向错误合同，不修改历史业务registration或重算其期望摘要。

手动run38256988111的MCP测试通过后，service继续至workspace-directory-persistence暴露下一个旧预期：selectTask只在options显式提供directory时将它放入新BoardSource；该用例按全局Task身份调用，只有selectionEpoch，故当前source是kind/id而已应用设置仍持有目录。BoardSource类型仍支持显式目录，并非整个字段已被删除。按此入口模式更新测试输入与输出，并独立断言settingsStore.directory仍为NEXT_DIRECTORY。该测试只验证服务/状态事务，未操作或断言DOM、组件呈现或截图。

## 第二批聚焦结果

全部使用原生监督和隔离子进程的原`bun run test -- <files>`入口：

- Group A：Task Tool lineage、真实HTTP/channel跨进程竞争、Panel owner死亡恢复、Mission恢复，8测试/50断言通过。
- Group B：进程监督、二进制输入、实际metric scorer、不可变包发布、Orchestrator初次请求与角色工具面，45测试/136断言通过。
- Group C：Project目录/清理/GC全部60测试/89断言通过；两个prompt合同文件4测试/9断言通过。诊断首次仍使用旧登记目标失败，保留原日志，随后单独修复并重跑。
- Group D：独立Trial树、真实诊断prepare/continuation和包Artifact消费，12测试/246断言通过；包含9项完整Evolution包协议和实际工具执行。没有Provider调用、私有凭据使用或界面自动化。
- Overlay目录选择服务，5测试/11断言通过。

合计134测试/541断言。AST（Abstract Syntax Tree，抽象语法树）只读扫描所有后端测试的直接createTask和HTTP POST创建输入，剩余唯一缺省promptProfile是明确验证ZodError的错误契约，保留原状；没有机械给所有请求补默认值。本地无法模拟GitHub Windows的8.3用户目录，物理/逻辑路径修正还须远端核验；手动完整运行继续用于发现其余未执行文件的失败。

提交审查发现触及的Project测试中另有两条旧负向比较，按仓库约束改为精确正向事实：新Project解析到其真实worktree，以及重建后保留明确生成的generation。保留原清理、凭据和文件内容断言，重跑该完整文件确认。

上述最终Project重跑60测试/89断言全部通过。服务runner在workspace-directory-persistence之后的三个文件（文件定位、workspace条件导出解析、worktree传输权限）另有8测试/18断言通过，均未修改；它们是服务/构建解析合同，不作视觉验收声明。

## 三平台聚焦回归

5b3584215正常推送并通过所有钩子。手动selected run38259887245绑定该精确提交与17个后端文件；audit、verify和全部service tests通过，Linux selected unit成功。macOS仅新增watcher两个测试失败：快照事件为/private/tmp物理路径，而测试用/tmp逻辑别名比较，订阅也用逻辑绝对路径过滤，导致实际事件无法结算测试Promise。原生日志显示真实事件已产生，Linux同样测试通过；测试setup应在创建临时目录后用标准realpath取得同一物理目录身份，再供snapshot、subscribe与断言共同使用。修复测试输入身份，不延长事件超时、不过滤额外结果、不修改产品文件监控或取消规则。Windows同类8.3别名也使用相同处理。
