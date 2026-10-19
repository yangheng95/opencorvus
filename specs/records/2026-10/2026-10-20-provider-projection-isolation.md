# Provider 目录可变引用隔离

## Recall

持续单agent，goal旧三Astra描述已被用户后续单agent硬约束覆盖。上一批444为progress：c21f566a9553ae6dd6bb1a6b84078db64f582e98正常push，fresh fetch HEAD=origin/main；同库异步PATH查找落地，36例63断言与正常hook通过。完整QA412保留76 Project、schema2，运行凭据/私有444授权目录对成对退休，原native全部physical/output/request结算与launcher join0，canonical完整恢复，原授权源metadata未变。已有.bun/和packages/opencorvus/bun/不动。

整体配置性能仍failed：无采样cold18065.6297ms、restore5345.6541ms、保存中GET14649ms/200；原10s/5s/20s门槛保持。继续benchmark-debug-template，真实全历史开发服务与正式441 UI，不清库、不缩项目集、不运行UI自动化、不碰用户18571进程/窗口。原生spawn与Provider投影是已测热点，但不能据采样直接改归属协议或跳过身份检查。真实Provider验收必须配对完整auth/models，credential/catalog/实际gpt-6.1-sol流式分别验证，原进程结算后才退休副本。

## 修改前根因与影响分析

已读444 Recall/安全CPU与after阶段、05-config、06-provider、ModelsDev.Data/get/replaceProviderModels/refresh、Provider.buildState/fromModelsDevProvider/fromModelsDevModel/stateFor/globalStateFor、模型variants及现有模型投影/缓存身份正向测试。精确全仓调用：fromModelsDevProvider生产仅buildState，现有直接测试仅openai-codex-model-projection；ModelsDev.get生产还供CLI auth/github、Provider配置来源和operations，当前返回同一个Data对象，不是每次克隆。

观察到的代码风险：fromModelsDevModel将源model.headers/options和对象类型interleaved直接放入每次新Model，fromModelsDevProvider直接借用provider.env；buildState把该可变Provider传入plugin.models，然后再做项目配置/凭据/variants投影。插件或调用者对借用对象的修改可能写回共享ModelsDev源，后续Project/全局重建继承污染。当前project config cache隔离只保护外层ProviderState，未复制这些内部引用。需正向测试证明实际数据变化，不能仅以引用命名定根因；尚未复现处标为未知。

影响面是所有通过同一声明目录进行全局/Project/Task/Mission/Session模型解析的入口、重建与重试，不是队列/唤醒/终态异常。原权限、消息、流式LLM、模型目录writer、配置、schema/迁移不改。不得通过跨Project复用可变ProviderState来优化热点；也不借本次扩大清理其他同步调用或替换Git解析。项目配置中的runtime函数保持原现有单独合同，目录来源为JSON声明数据。

## 实施前方案与验收

1. 先新增聚焦正向测试：一次投影合法修改env、headers、深层options、interleaved后，原目录和下一次投影各自仍保留明确原值；验证原投影保有明确修改值。再使用真实目录文件、ModelsDev.Data与两个独立Instance/getModel及global resolver检查跨项目数据合同。实际插件若有独立共享入口，用生产加载方式补充；不用UI自动化或mock声称E2E。
2. 只有复现证明后修改唯一转换边界。分析每个Model/Provider输出字段的所有借用引用，使用现有成熟clone/对象/数组原语获得每次投影独有的可变数据；不增加目录缓存、影子catalog、深冻结用户模型或备用转换。保持全部模型、variants、状态、成本、错误与插件输入合同。若发现独立引用尚有遗漏，补入同一边界并正向测试。
3. 原失败→通过检查、现有模型投影、Provider缓存/插件来源、typecheck及相关Config候选合同。随后保留完整QA76以上项目的原生产Config service→HostTransport→HTTP保存与完整恢复，配对真实gpt-6.1-sol预检、真实页面截图人工复核；所有性能按原门槛如实记录，不将隔离修复宣称为原生启动成本修复。
4. 同步架构/三索引，docs与architecture-index；安全摘要归档，原句柄完整结算与凭据对退休；范围提交、fetch/merge upstream、完整待推集合复核、正常hook push与fresh fetch。整体goal保持active。

## 结果

原checker已完成exit1并完整退出：两个正向测试均失败。直接转换的第二份投影和源声明都继承PROJECT_TOKEN、x-scope=project、tags中的project、budget22及reasoning_details；生产file URL插件经真实Instance、ModelsDev.Data和Provider.catalog加载也污染另一个Project/全局读取。不是仅凭引用相等推测。

完整字段审计：Provider.env为字符串数组；Model.headers为字符串record；Model.options为JSON目录中的任意深层声明值；Model.capabilities.interleaved为boolean或field对象。这四处借用源引用，其他api/cost/limit/capabilities输入输出/variants容器均由唯一转换新建，叶值是原始类型。实施采用env数组spread、headers对象spread、options成熟structuredClone、interleaved对象spread；不克隆整份目录、不加缓存、不冻结插件输入，config runtime函数不经过此JSON目录边界。全仓生产调用仍只有buildState，原模型数/成本/variants/状态/错误映射保留。

标准structuredClone已核对[Node.js官方全局API](https://nodejs.org/api/globals.html#structuredclonevalue-options)，用于声明目录深层options；不引入单宿主私有复制算法。新两个合同均转pass，原72501四文件12例20断言joined0；原41692精确四个Provider cache/Project生命周期/runtime fetch函数/Bedrock函数合同4例5断言joined0，typecheck43041 joined0。runtime函数仍由原Config覆盖链执行，未进入目录clone。

真实服务18683原81220已启动并配对完整目录预检gpt-6.1-sol/streaming。首次checker61843在启动信号readFile处返回EBUSY并joined1，未进入计时或Config mutation；服务器日志确认PATCH/global/config记录0，完整canonical仍等于before。根因是scratch的PowerShell Copy-Item先打开目标再写入，等待中的Bun readFile撞上Windows共享锁；不能把它当作产品保存失败或用重试掩盖。改用现有Filesystem.writeDurableAtomicIfAbsent发布全新信号，原服务exact_live且87284仍持有18683，故保留该原生occurrence，启新checker68411及新文件名、重跑原两次保存与恢复；原错误日志与精确前置事实归档。没有因为观察失败重启服务，也没有修改真实产品协议或数据库。

最终真实checker68411 joined0：全77 Project、初始loaded2，无采样cold19505.1606ms、restore5469.5452ms，before完整canonical恢复、Ask保留。实际New chat触发GET/global/config从21:36:43.203Z到21:36:59.444Z，16241ms/200，起点确在原cold PATCH内。原cold≤10s/restore≤5s仍failed，page≤20s通过，不用项目增长、采样或批次波动宣称性能改善。原生spawn成本未在本轮修复。

浏览器40实际检查gpt-6.1-sol/OK/Ask与恢复后的默认页，人工查看并保存截图；无UI源码或自动化。公开shutdown200，原81220 native launcher joined0；physical/output/request与精确进程状态均结算后才退休445私有auth/models，原授权源metadata未变。独立SQLite readonly/create:false直接查询user_version2、Project count77，没有生产DB初始化或迁移。

[完整安全结果与截图](../../artifacts/2026-10-20-provider-projection-isolation/README.md)包含失败→通过合同、生产插件/两Project/global/source的明确值、16例25断言日志、原保存请求、信号工具故障与原生结算。完整配置/Provider正文及开发日志保持私有，归档前按真实凭据值扫描。06-provider架构和三索引已同步；文档/API、architecture-index与正常Git hook在范围提交推送时结算。完整goal保持active，不创建branch/worktree/tag/Release。
