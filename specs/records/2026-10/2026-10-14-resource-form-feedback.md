# 第18批：资源表单反馈位置

## Recall

- 用户要求持续批次迭代，先完成根因/影响分析并落盘，再自己实现、真实桌面操作、原图人工复核、适当正向检查及必要的已授权Sol验收，范围提交、同步和正常推送后继续。最新指令全部子agent停止，Root自己做与验收。本批不委托。
- 第17批已由本任务正常push成功，远端main精确读回 `dc14840a32b19c7dfaa365d6a0b95f8f277af3fb`（parent `9c24705da548ea844690c9f3998727614d44cd41`，87路径）。其全部正常hooks通过；原commit、fetch/merge、pending、exact topology、push与remote回执保存在 `.tmp-codex-skill-source-validation-01a133`，本批artifact承接原件。10项29断言、6张原图、实际HTTP（Hypertext Transfer Protocol，超文本传输协议）400与成功安装、物理exit0/pair清理0均属于第17批，不重复归功本批。
- 问题证据来自第16批原图01/02与第17批原图01–04：表单提交处在当前viewport下方，失败notice固定在整个面板顶部；Root必须人工上滚才能看到。400后端错误已经由第17批修复，本批只处理反馈呈现。
- 验收：在真实源后台 `/ui` 的桌面视口，从实际提交按钮提交Skill无效目录与MCP（Model Context Protocol，模型上下文协议）本地参数解析错误；完成后反馈、表单和实际操作区域无需人工上滚即可看到；原诊断/真实requestID、当前语言、关闭保留输入、原焦点保持、收起表单后的诊断呈现与有效Skill安装均人工操作和原截图复核。项目变化或表单关闭后的旧微任务不得抢滚动，需实际可构造的页面场景及代码证据，不虚构未运行的并发资格。
- 硬约束：不写/改/跑UI（User Interface，用户界面）自动化测试；不以DOM（Document Object Model，文档对象模型）文本、类型检查或构建代替视觉。不启动独立Vite，沿正式后台服务静态UI。仅本任务隔离项目/服务/页面，0真实凭据、当前无模型/Tool/prompt变更，无需真实Sol；如范围变化重新判断。
- 已读：用户AGENTS.md；`07-panel-reactivity.md`唯一notice与资源操作scope、`04-extensions.md`资源配置/安装边界；第16/17批记录和相关原图；`SkillMarketPanel.tsx`唯一ResourceNotice定义、工厂/错误setter、全部调用点、两个add handler、reload与MCP轮询effect、inline forms；`Feedback.tsx`原primitive（role alert/status、原诊断Disclosure、原HTML属性ref透传）。技能computer-use和benchmark-debug-template已读，本批不重读或委托。
- 全仓搜索：ResourceNotice只在该组件定义/使用；setPanelError只有同组件调用，其中open/pick-folder两处传自定义key。新增资源的两处catch都有实际current-directory检查。Show表单的标题toggle/取消/成功收起、Source目录reload及每秒MCP状态刷新均已读。相关test文件检索只有mission-skill-service纯服务文件，未发现本目标的UI自动化测试，不扩大无关扫描或运行。

## 根因与影响分析（实施前）

1. 现象/直接触发：安装表单位于Skill Market之后，页面可长于桌面viewport。点击提交时浏览器已把按钮滚入视口，失败后新notice插到根部loading之后，而按钮/表单没有任何关联的inline输出或定位。截图证据证明“请求已经正确失败但用户当前视口看不到反馈”。MCP新增使用同一根notice路径。
2. 控制流根因：handleAddSkill/handleAddMcp捕获错误后都调用setPanelError，唯一notice只保存key/vars/tone/details，不保存来源与实际目录owner；唯一Feedback只渲染在面板顶部。ARIA（Accessible Rich Internet Applications，无障碍富互联网应用）alert可供读屏器宣布，但不能证明可见区域有反馈。不能简单让所有notice自动滚动，因为MCP后台轮询、reload错误、目录warning也写同一状态。
3. 旧路径未根治：第16批解决摘要和原诊断可读性，第17批解决本地目录HTTP合同；两者都明确保留位置问题。全局自动focus、每次后台错误滚至面板顶部或复制一份form error会扩大影响并产生混乱。
4. 唯一实现：沿唯一ResourceNotice增加来源origin（panel/skill-install/mcp-add）及两种表单失败的实际directory owner。原setter默认panel；只有两处显式add失败传入表单origin及实际请求目录，所有自定义key、公共操作、后台刷新继续原义。位置只从当前notice与当前Show状态派生：对应form打开时渲染在其提交区域附近；收起后在面板原位置保留该诊断。抽出同一渲染函数，3个互斥slot只呈现唯一notice，不复制消息或新增错误状态。
5. 最小揭示：只对实际inline表单notice，在DOM布局就绪的单次microtask检查元素仍连接、notice对象仍为同一次、当前slot、panel active与目录owner均相符，才scrollIntoView(block nearest)。不调用focus、不轮询/计时、不改变键盘焦点。表单收起、notice替换、项目变化或组件卸载使旧回调不再拥有滚动资格。正常native Disclosure、关闭按钮和语言渲染沿同一个primitive。
6. 影响面与排除：修改仅一个前端组件；无后端、SDK（Software Development Kit，软件开发工具包）、配置/数据库/消息/模型/工具合同变化。不会改文件/目录选择、MCP连接或命令启动、资源更新/删除等能力。locale已有键足够，正文与原路径不翻译。没有真实调度/队列/Task/Mission/Session终态异常；若发现此类事实立即单独做共享横向审计。
7. 风险/未知：微任务揭示与浏览器scroll anchoring的最终视觉需要真实桌面验证；方案不是通过证据。首轮若仍被viewport裁切，先据截图调整同一inline位置/揭示，再重新截图。MCP畸形引号只证明本地参数验证，不能充作真实服务器连接端到端。高延迟后关表单/换项目场景必须绑定原请求真实时序，不能把超时当成功接受。
   为资格“返回前收起表单”，独立runtime的自有registry participant增加本地fixture控制：经真实SkillManager.withCatalogMutationOwner持有同一个生产目录owner，收到明确release或10秒deadline即释放；实际安装HTTP进入同一owner等待，响应仍由原生产route产生，不拦截/改写响应。记录held/released时间、释放原因、实际HTTP完成状态与耗时；小于现有15秒client timeout才有有效资格。不是模型请求或生产新路由，不传递真实credential；before运行器原件先保存，after输入独立归档。如出现非预期死锁或收敛故障，立即审计共享机制，不将有意持有解释为真实异常。
8. 文档与交付：更新当前07-panel-reactivity合同及未发布CHANGELOG双语增量，3个索引和artifact目录README。只需前端类型与Node构建、当前docs:check和架构index；不添加镜像实现测试，UI完全由真实页面/截图验收。采用独立before/after服务、正常退出/端口归零/自有假auth+完整models pair清理与全日志隐私检查。所有自身变更范围commit，fresh fetch/merge、完整pending归属与正常hooks/push；保留其他用户任务的工作区/索引，禁止新branch/worktree。

## 执行与资格

恢复后先重读Recall及以下实际回执，再核对未完成项。不得把方案描述当验收通过。

- 产品仅修改SkillMarketPanel.tsx。唯一notice增加origin和实际directory owner；setPanelNotice仍是唯一工厂，只有两处add失败带form来源，既有自定义key及后台/公共操作语义保持。唯一renderNotice函数用于互斥slot，位置由notice和对应Show状态派生；只有当前inline、同一notice和目录、panel active及已连接元素才可执行一次nearest滚动。未增加focus、计时轮询、持久配置、消息副本或后端接口。
- 修前：PID87808，18638/18639，occurrence e56f84bb-e02a-4067-926f-6c3bda173467；正式源backend使用B16冻结UI。01实际提交视口看不到根部反馈、按钮仍有焦点；02人工打开顶部Details后的真实400，requestID 6653aa0f-11d4-48c8-a3c8-566b29cf1a1d。Root查看两张原图后再修改。
- 修后：PID69828，18640/18641，occurrence 08662276-e39c-4cc7-91a1-da4dfa71bb10；本批Node Vite正式构建产物由生产backend `/ui` 提供。前端overlay-typecheck实际0，ui-build实际0（原报告约1分钟、chunk等warnings完整保存），final-format实际0。纯UI布局与反馈生命周期不新增自动化测试；没有用这些静态检查替代截图。
- Root逐张人工查看16个未经编辑的原PNG：01–02修前，03–05修后英文摘要/诊断与保留输入；06首轮deadline后才收起的原件；07–09有效在途收起、迟到响应后的阅读区域、重开表单的原输入/原诊断；10英文MCP解析，11中文Skill400，12有效Skill完整来源，13中文MCP解析，14关闭保留原字段，15在途切B，16原响应后B项目正常输入。没有截图自动断言或像素比较。10顶部标题略被viewport裁出，目标表单/错误/控件完整可见；未冒充整页截图。
- 真实迟到资格：独立fixture持有同一个生产catalog owner，不改写响应，3次都由10秒deadline释放。首轮HTTP effc1d74-85a7-414a-bdca-72e482cac03e实际6389ms且400，但人工步骤分开，收起前已经返回，**不具备“在途收起”资格**。control release在deadline之后，只是已释放的确认，不是manual释放。
- 第二轮把提交、观察、收起按连续真实页面动作执行：HTTP 71d25cbf-4050-47f7-bf84-d70caa96d2db实际4330ms/400；请求开始1791936551902，form关闭1791936552478，完成1791936556231，即关闭3753ms后返回。07为在途关闭，08保留当前阅读区域且当时焦点仍为页面，09重开后输入与该次原始诊断同屏。没有client timeout。
- 第三轮真实项目切换：HTTP 9a6c82bf-4054-4066-be37-4356cfc14d4d实际2617ms/400；开始1791936907500，离开设置1791936908080，真实项目操作“为此项目新建Chat”切到B为1791936908749，原响应完成1791936910117，晚于B选择1368ms。15/16可见B项目正常草稿。15刚切页时焦点仍为项目新Chat按钮，16正常输入获得焦点，因此**不宣称跨页面焦点恒等**。新的代码从未调用focus；该场景资格是原错误归属及当前B页面/阅读区域。
- 实际时序来自完整生产日志及人工动作时间原件。collect-requests只整理日志和动作时间，不是DOM/截图/UI自动化测试。未出现非预期队列/调度或恢复异常；有意持锁本身不冒充故障。
- 普通失败英文cac521c9-fd74-425a-a343-37be38932fdd（9ms/400）、中文fe7f9c41-fb70-4df9-91b9-896fc1c36c9e（3ms/400）均由真实route产生，摘要当前语言，原路径/requestID保留。提交后AX（Accessibility，无障碍树）焦点分别仍在Install Skill/Add MCP；点击Details后才自然移到Disclosure。关闭保留字段由05/14实际复核。
- MCP两种语言只资格真实本地参数解析错误“unterminated quote”，不冒充第三方服务器连接或后端验收。表单填写自有虚构名称和命令，畸形引号由现有客户端参数解析器拒绝，不作为实际命令执行资格。语言切换经过Appearance会卸载组件，不宣称同一notice跨页面存活。
- 有效Skill由真实UI成功接受：9fb4da9a-157a-419e-9c16-4a6f9f994994，200、1044ms；图12真实已加载身份/原文说明/完整路径，未操作更新和删除。installed公开GET checker实际0，精确读回owned-feedback/config_path与全局source目录身份；正向比较使用真实Windows路径身份，不以裸分隔符字符串或源码摘要替代功能。
- 物理收尾：tab15/16均关闭；before与after均正常runtime settlement、parent真实exit0，分别两个端口0，之后精确删除自身假auth.json/models.json整对。privacy-before/privacy-after均实际0，凭据值仅在内存持有；后台完整原日志101482/193179字节、stdout/stderr各0全量扫描后gzip。after terminal实际requests0、realSolCalls0；没有真实凭据或模型调用。
- 文档资格：docs-check实际0（345 operations、26 groups），architecture-index实际0（19份当前架构与有效链接）。未资格范围是其他宿主、第三方MCP连接/远端Skill安装、所有资源操作位置和语言切页同notice存活；B项目新Chat的自然focus属于原产品行为，未归功本批。主路径目标已达到；范围commit、fresh同步/pending审阅、正常push与远端确认仍待完成，原回执由下一批承接。
