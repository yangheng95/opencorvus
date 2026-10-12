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

38259887245的Windows selected unit随后成功，17个文件中的物理/逻辑Task路径修复已在真实Windows runner通过；macOS其余16个文件成功。03546870c修正watcher测试临时根，隔离安装上的5测试/10断言、本地文档和完整推送钩子通过并推送。2026-10-12T14:20Z从既有手动入口启动watcher聚焦run38262258110及新完整run38262262133；运行中的完整旧run38256988111继续保留以发现其余失败，不将其已知失败重标为通过。

38262258110在Windows/Linux成功，macOS订阅也通过；快照仍在写入后49ms返回空事件。此次新增快照测试错误地假定操作系统历史缓存即时可见：官方watcher文档区分实时订阅与后台守护进程支持的历史查询，源码全仓搜索表明产品仅由file/watcher.ts使用subscribeWithParcel，不调用writeSnapshot/getEventsSince。此前路径修复解决了事件身份，但没有消除新增测试对历史缓存时序的额外假定。将brace忽略规则的真实创建事件验证并入订阅测试：先建目录、订阅后顺序写入两个忽略文件和一个可见文件，以收到可见事件为交付条件，断言实际累计创建事件的完整明确列表并await unsubscribe。删除产品未使用的快照API验收；不删除忽略规则覆盖，不加sleep/retry、不放宽超时或跳过平台。生产订阅、事件处理和取消契约保持现状。

## 完整运行第三批：继续调查与实施范围

完整旧run38256988111的Linux/macOS已跑完591文件，分别62/65个文件失败（包含已修复的第二批）；这是真实未完成事实。原生订阅修正5b6285704已正常推送，隔离4测试/9断言和推送钩子通过，单文件三平台run38264650642正在验证。

- 多数专家团失败固定2026.08/09旧版本，而当前发布源为2026.10.12.1。需要逐包核对当前manifest、Skill/Tool投影和可选工作流，再把可变版本复制改成从既有发布元数据验证精确当前身份，保留真实工具执行/安装/HTTP路径。不能盲目替换所有日期或删除行为断言。另有旧能力清单、提示词和配置读取预期，须按当前公开契约分别核对。
- CLI（Command Line Interface，命令行）正常结束/错误/超时路径均可在Linux/macOS出现exit7和未处理AbortError。SDK（Software Development Kit，软件开发包）生成的SSE（Server-Sent Events，服务器发送事件）abortHandler调用reader.cancel()却只捕获同步throw，异步拒绝脱离其owner；调用者loopTask虽被await也无法处理该游离Promise。所有SDK事件订阅共用此生成实现，应修生成权威并重生当前产物，取消Promise必须同步挂拒绝处理并在释放reader锁前join；非取消读取错误仍交给原onSseError。保留真实CLI子进程七种场景原退出码和结构化响应，不接受exit7或吞所有进程异常。
- 跨进程Session重复summary在两个远端平台及本地稳定卡住，不能判定为平台偶发或简单旧fixture。已读Session loop、compaction与02-data，正在审计控制请求的exact source/control receipt、过滤后历史、owner释放/重启与Task/Mission/普通Session共享调用；先补采真实测试运行的持久化控制、Message与Provider请求证据，再决定修复。不延长等待、不跳过用例，未完成共享根因审计前不改生产调度。

SSE修正已通过正式SDK生成及TypeScript编译，仅生成预期core文件差异。原CLI真实子进程七场景从3通过/4失败恢复为7通过/18断言，exit和错误输出合同保持不变。生成脚本对固定上游模板形状做显式契约检查，形状改变会要求重新审查，不静默跳过修正；未改共享node_modules或应用进程。

订阅run38264650642的macOS确实交付了目标文件及正确brace过滤，但FSEvents还交付订阅前新建的根目录和src目录create事件；原API合法报告文件与目录，测试名称声明验证文件，却将所有create都当文件。按真实lstat分类文件事件后精确比较完整文件列表（包括任何错误泄漏的忽略文件），不按预期路径白名单过滤，也不sleep等待系统缓存。目录通知的跨平台批次差异不属于本次文件忽略回归合同。

摘要持久化证据已取得：第一个manual_summarize确实consumed并绑定summary5，第二个相同source的control仍pending，owner exact_live且错误启动了第三个prompt请求；并非丢唤醒或死owner。summary5的checkpoint保留原anchor1和tail_start=user3，user3/assistant4的created与completed均早于summary5。Message.filterCompacted按当前模型上下文合同把summary移到anchor之后，得到anchor1/summary5/user3/assistant4；hasPostCompactionMaterialForSource却把数组中summary之后的旧tail当成新增材料，再次请求Provider，于是等待幂等receipt的真实peer卡住。旧路径仅按可见数组索引判定，无法区分模型上下文顺序与持久化时间线。

横向审计：该判定只在共享Session loop四个生产位置使用（显式manual/auto control、predictive compaction、Provider overflow和按上次实际请求计量触发），Task/Mission/普通Session统一进入该loop；HTTP summarize与Mission acceptance checkpoint都由SessionCompaction.create写入相同source/control，再由process统一消费。输入历史来自exact Session的MessageStore并按当前Project配置隔离，修正不读取其他Session/Project或修改队列。修正必须用现有canonical timeline order比较实际Message与完成summary的顺序；保留summary后实际产生的文本、推理、tool、patch/file/snapshot材料判定，以及exact source、Session、control receipt和原owner/lease。新增持久化Project/Session的正向用例覆盖保留tail在source前/后/同点、重复摘要复用和实际新材料触发，原真实双后端/重启接管/并发输入/失败control用例全部重跑。不能增大deadline来接受重复压缩。

修正后重复manual/auto都正常复用相同summary receipt。原后续“新材料”测试却没有提交新的真实输入，而隐式依赖重复auto重新调用模型产生材料；现显式通过真实HTTP route提交下一条用户输入并消费流式回复，再验证第二个summary绑定该新source。两次真实compaction及四个原control receipt数量保持原合同。跨进程完整5测试/45断言通过（含并发重复/入队、standby peer、失败control、owner死亡接管）；3种保留tail位置和实际新增材料的持久化/关闭重开检查、窗口与overflow计量也通过。仅本地结果，远端跨平台待核验。

包与小合同复核：26个包测试的硬编码版本改为读取既有source package manifest的version，并继续验证安装/嵌入产物及包资源，而非维护第三份日期清单。作者示例的真实ExpertSquadAuthorParameters.parse又发现squad-sdk唯一definition-contract.json中根node缺少当前必填depends_on数组；这不是旧测试预期，需要修复随包交付的公开编写示例并用真实authorProjectExpertSquad/typed publisher验收。工作流仍是可选参考，不增加执行门槛。Light/Work/Coding/Mission的直接工具清单按现有角色声明补入skill或mission_skill、apply_patch与已授权panel_expert_squad_inspect；保留真实发现、回执、重启和执行校验。Orchestrator项目通用工具由ToolRegistry构建，测试须验证该现有owner与专用factory的完整并集。Mission audit fixture使用当前outcome.kind=accepted；HTTP输入校验检查当前badRequestBody投影的code/path/message，保留完整数据库round-trip和typed错误合同。

第三批验证收敛：26文件原入口中22文件先通过；四个后续文件分别修正版本fixture中的局部root路径、Light真实routine Skill投影和上述作者示例后重跑全部通过。共享包Skill检查改为真正materialize并通过loadPackageRevisionSnapshot加载122份随包不可变资源，校验声明Skill与实际解析Skill及SKILL.md闭包，393断言通过；旧路径只用根目录正则强制每个包都有Skill，不符合可选声明与嵌套资源合同。Advanced只验证其manifest明确授予的17个Browser执行工具，与包含help的导入工具全集分开，不扩大产品权限。

当前默认Squad为dynamic，五个原真实HTTP bootstrap/install测试与其probe按该明确合同验证活跃投影、dynamic/shared/method及五个嵌入候选，完整安装/现有包投影断言保留并通过。状态读服务不触发模型/包候选校验；cold status仍200且空Session清单，配置PATCH和直接candidate验证保留缺模型/内置ID冲突的当前typed错误。两种入口各有原真实运行证据。MCP（Model Context Protocol，模型上下文协议）发现/执行4测试13断言、Host Session 5测试、Computer配置4测试、Conversation路由4测试、数据库合同15测试81断言全部通过。没有浏览器界面或UI自动化。

作者示例修复经既有revision generator仅将squad-sdk从2026.10.12.1推进到2026.10.12.2，防止公开Registry同版本不同内容冲突；应用仍0.1.25，没有创建Release/tag/安装包。完整script/generate.ts成功，唯一额外生成差异是portable authoring template里的相同depends_on数组，SDK取消修正保持生成固定点。

远端run38267596684精确绑定699538b23：四个重点文件（原生watcher、真实CLI、跨进程Session owner、compaction完整性）在Windows/macOS/Linux均成功，verify/audit/service与Selected CI passed全部成功。它是selected结果，不是完整CI。旧完整03546870c的Linux已跑完，剩余失败恰为本批旧合同及已修正的运行时缺陷；Windows旧67f全量也已结束，没有新增此前Linux/macOS未见的失败文件。下一步提交当前批次并启动最新完整手动CI，保留旧失败事实。
