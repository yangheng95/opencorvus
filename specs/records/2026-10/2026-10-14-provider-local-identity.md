# 第19批：本地Provider自动标识

## Recall

- 用户要求持续批次调查UI（User Interface，用户界面）/UX（User Experience，用户体验）、功能和缺陷，先根因/影响分析落盘，再修复、真实桌面原图人工复核、聚焦正向功能检查、必要的已授权GPT-6.1 Sol验收、范围commit、上游合并和正常push后继续。最新指令停止全部子agent，由Root自己实施和验收；本批不委托。
- 第18批 `c23b13fe6df51f706dc56771afafaf88ca6a8fb5`（parent dc14840a3、104路径）已交付，Root正常push实际0，远端最终读回fedd04743（含该提交）；最终完整pending为空。正常push绑定刚审阅的当前分支快照到配置上游，避免新的并行提交在检查后混入；全部常规hooks0。原commit stderr对非本批compaction ledger报过short read，原因未知，但commit实际0、104路径逐对象核对通过，再执行精确索引结算复核0。该原件随本批承接，不伪称未发生。
- 同步中途有其他用户任务的文件迁移、数据库回写和Provider模型家族提交；Root仅只读检查其来源/原件，没有委托、发消息或操作它们的进程。中途看到其一个保留的失败测试回执，未据此宣称它全部通过。它们随后已在上游；Root自己最终push的pending为空，不借用其他任务push替代自己的回执。
- 本批对象：Provider表单未填显示名称/高级ID时，旧ProvidersPanel::providerIdFromApi把hostname按点切开取倒数第二段；127.0.0.1被派生为0，而且不同端口相同。localhost不带端口；IPv6（Internet Protocol version 6，网际协议第6版）也未作为完整地址处理。IPv4（Internet Protocol version 4，网际协议第4版）的源计算及真实修前碰撞/第二条冲突已由01–04原图、公开配置和原始源码共同证明。
- 目标：同一IP的两个非默认端口可由默认表单得到明确且不同的Provider ID（Identifier，标识符），真实保存并公开读回各自正确端点；localhost、IPv6和规范化地址有聚焦正向业务测试。既有编辑ID、显式ID、显示名称优先级和普通域名品牌推导保持。当前语言的既有ID预览/反馈继续复用，不新增产品实现细节文案。
- 已读：AGENTS.md、当前05-config、06-provider及07-panel-reactivity中Provider配置/表单/接受传播合同；B15 Provider模型摘要记录；ProvidersPanel的reset/startAdd、两个私有派生函数、formProviderId、Discover/Save/高级预览3个消费者、冲突及scope逻辑；provider-form.ts的单一API（Application Programming Interface，应用程序接口）校验与原子字段变更；纯业务provider-form.test.ts（无DOM、渲染、截图或UI测试，没有检索到负向核心断言）。
- 全仓搜索：sanitizeProviderId、providerIdFromApi、formProviderId只有该组件当前实现。现有provider-form服务是字段解析/合并和明确错误的事实来源；provider-save/mutation管理接受阶段、API authority与原directory，保持不变。浏览器预览及安装handoff有局部loopback判断，不适合作为Provider身份owner，不能把URL安全策略与身份派生耦合。
- 官方依据：已查[WHATWG URL标准的host/hostname](https://url.spec.whatwg.org/#dom-url-host)，host返回规范化主机及存在的port，hostname只返回主机。使用平台URL解析，不新增地址解析库或宿主专用net模块；实际Bun/浏览器资格仍须本批运行，不以标准文本代替产品行为。

## 根因与影响分析（实施前）

1. 现象/触发：直接源码计算显示任意a.b.c.d选c；127.0.0.1的两个服务都会得到0。需真实页面输入两个自有端点，查看原高级ID预览。若观测不一致先重查表单输入/代码，不实施猜测修复。
2. 数据流：resetForm将name/id置空，startAdd冻结实际目录；formProviderId按editing→显式id→显示名→API地址派生。结果同时用于Discover候选providerID、Save的config map键和高级ID预览。URL解析丢port，再用域名标签规则处理IP，造成地址信息丢失/碰撞。applyProviderForm的PROVIDER_ALREADY_EXISTS正向错误防止已有配置被覆盖，因此影响是新增第二服务被拒或需人为补ID，不把它夸称数据丢失。
3. 旧路径未根治：B15只修公开模型目录数量/搜索，B18只修资源操作反馈。已读的变更没有替换该身份派生。直接换所有域名为完整host会改变openai等品牌ID与目录继承关系，超出本批本地地址问题。
4. 唯一方案：把现有表单身份优先级和清洗整体移入既有provider-form服务的一个实际生产导出providerFormID；组件移除两个旧私有实现并由同一函数服务3个消费者。不保留平行派生、兼容层、配置迁移或新error DTO（Data Transfer Object，数据传输对象）。既有编辑ID保留原值，新的显式ID/显示名清洗语义保持。
5. 地址规则：已由URL解析的IPv4与localhost（含.localhost子域）使用完整规范化host（含非默认port）；IPv6保留完整规范化地址并加ipv6前缀后清洗，同时保留其非默认port。示例127.0.0.1:18645→127-0-0-1-18645，另端口18647→127-0-0-1-18647，localhost:18645→localhost-18645，[::1]:18645→ipv6-1-18645。普通DNS（Domain Name System，域名系统）延续原品牌标签规则。默认端口沿URL序列化省略；同一host下不同path/query或不同协议的所有唯一性不属本批，用户仍可填name/id并获得现有明确冲突合同，不宣称通用无碰撞标识。
6. 错误/配置/LLM影响：现有validateProviderFormApi仍是唯一HTTP（Hypertext Transfer Protocol，超文本传输协议）端点校验，错误类型和保存阶段不变。没有后端、SDK（Software Development Kit，软件开发工具包）、模型、Tool、prompt或请求协议变化；不修改现有ID/凭据，不调用第三方Provider或模型。普通品牌ID正向回归并真实配置读回足以验证本批，当前不需Sol。
7. 测试与工具：在现有纯业务test追加明确输入→字符串ID/配置输出的正向案例，覆盖优先级、完整IP/端口、localhost、IPv6、规范化短地址/默认port及普通品牌域名；不新增无效输入空值核心断言，不写/改/运行UI自动化。Bun1.4执行聚焦文件、前端typecheck、Node构建；真实backend /ui使用独立before/after三端口服务（后台、主registry、自有第二HTTP participant）。两处地址都受自己服务所有权保护；真实模型请求不得借这些虚构participant冒充。
8. 真实矩阵：before以两个自有端点依次输入，原预览及可能的第二条已有ID错误逐图查看；若保存第一条，只写独立临时项目配置，无凭据。after保存两个不同端口派生ID，原图复核当前语言/两行，再正式GET/config按实际目录读回两个正确name/api/空models声明。补localhost/IPv6预览与编辑原ID保持；原输入、原失败和重跑保留。没有IP网络连接或IPv6宿主连通性资格时明确排除。
9. 风险/隔离：默认派生只影响新表单，旧ID不改名；清洗仍可能使不同输入相同，现有冲突合同继续负责。测试runtime不配置全局enabled_providers限制，代表默认配置，避免把单独allowlist策略混入本批身份资格；三份虚构Provider/Auth与完整公共模型目录仍同对，0真实credential。没有调度/队列/恢复/终态异常证据；若出现按共享机制横向审计Task/Mission/Session，不能归咎个别场景。
10. 文档/交付：当前07-panel-reactivity补单一表单身份合同，CHANGELOG未发布中英增量，3个索引与artifact目录README，运行当前docs:check和architecture-index。自身源预计组件+既有服务+纯业务测试3文件，保留其他用户改动。完成范围提交、fresh fetch/merge、完整pending归属/验证审阅，再正常push配置上游；不新branch/worktree，不tag/Release/PR。独立服务正常退出、3端口归零之后精确清理自身假auth/models，检查全日志并归档原PNG（Portable Network Graphics，便携式网络图形）。

## 执行与资格

恢复后先读本Recall和本节，核对完成/未完成与实际原命令，不重跑已经结束的服务。

- 修前实际：PID26540，18642/18643/18645，occurrence a1aa82c8-49cd-443e-8bcb-03bb740a8047；使用B18冻结UI，Provider目标代码此前未变。Root亲看01首端口18643→0、02次端口18645仍→0；03真实首端点保存为0，04第二端点由原ProviderFormConflictError拒绝。04仅资格可见完整错误第一句与表单，stack下部被viewport裁出，不冒充全诊断可见。
- config-before公开GET实际200，精确读回0的name/API/空env/空models及首个地址http://127.0.0.1:18643/v1。第二条的错误来自现有客户端配置冲突合同，不冒充后端500或请求超时；实际ID碰撞已由真实UI输入/保存和公开持久配置共同证明。
- 纯业务baseline：business-before实际21通过、61断言；文件只导入配置服务并断言数据/错误，不是UI自动化。产品改动已实施于3个计划文件：组件移除两个私有派生实现，3消费者统一providerFormID；既有服务增加地址/身份函数，测试追加明确正向输入输出与两份配置声明。business-after实际42通过、82断言；新增21例，不把重跑次数算新覆盖。
- 前端overlay-typecheck实际0，Node ui-build实际0，原chunk等warnings保留。formatter初次改到一个原provider-save导入的排版，Root审查diff后精确保留其原行，产品组件最终只有本批import与旧实现替换；service-format对服务和业务测试实际0。没有把全文件排版差异混入本批，也没有UI文案/DOM/截图自动断言。
- 修前tab17已关闭，正式runtime正常settlement和parent实际exit0，3端口监听0，之后精确清理自有假auth/models整对。privacy-before实际0：后台完整原日志111549字节、stdout/stderr各0，全量已知假凭据扫描后归档；终态和pair原件保留。
- 修后实际PID88784、occurrence 5f3590e1-e162-487b-8793-443c59f958a9，正式源backend18644与自有participants18645/18647，Node冻结本批UI。05第一端口自动ID127-0-0-1-18645；06第二端口自动ID127-0-0-1-18647与首条已保存行同屏；07英文两次保存后两行及各自正确API完整可见；11中文同样完整呈现两项、当前语言控件和0模型事实。全部11张原PNG由Root亲自查看，无编辑/裁剪/像素或DOM断言。
- config-after正式公开GET实际200，精确读回两项name/API/env[]/models{}；在取消后续预览草稿后再次读回相同两项。08编辑第一条，把草稿API改为localhost:18647但高级ID仍保持原127-0-0-1-18645，随后取消未保存；09新建localhost:18645→localhost-18645；10同一未保存表单换[::1]:18645→ipv6-1-18645，之后取消。09/10只资格表单身份预览，没有localhost/IPv6连通性、模型发现或推理资格，不冒充新增配置。
- after tab18已关闭；marker请求正常settlement，parent与privacy-after各实际exit0；3端口监听0后精确删除自有假auth/models整对。完整后台原日志140384字节、stdout/stderr各0，已知假凭据全量扫描通过。terminal原件实际requests0/realSolCalls0；两轮均未调用模型或使用真实凭据。
- 最终docs:check实际0（345 ops/26 groups）、architecture-index实际0（19 current documents），本批精确范围git diff --check实际0。交付尚需范围commit、fresh fetch/merge和完整pending归属/验证复核、自身正常push及远端读回。最终交付原始回执在提交后产生，由下一批承接，不能在提交前伪造本批commit或push成功。
