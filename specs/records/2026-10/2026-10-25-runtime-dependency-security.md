# 运行依赖的内容编码、集合校验与网站补丁

## Recall

590继续用户授权的长期产品迭代，只用当前一个编码agent，不委派，不创建分支/worktree；仅在无法安全判定的实际冲突时等待。上轮progress：393325e36已正常完整hook推送，fresh0/0。234/236个会话的真实outbox分组调查、758条非空Markdown词法调查没有证明原assistant Rendering根因；保留两个缺失历史Message错误、瞬态与视觉覆盖边界。源588b schema8/92表214319原行字段、配置、bytes/mtime完整，目标差异0；有限分析进程退出0/Instance dispose，无auth、无Provider、无原生服务或UI启动，模型目录副本清退。原Rendering、Task成员选择生命周期仍未完成，不因本批依赖工作降低或改写整体Goal。

当前HEAD393325e36，171删除、3共享README修改和2缓存目录属他人并保留。上轮原Git push两次OpenSSL连接明确失败后，使用Git for Windows自带schannel且sslVerify=true、同一127.0.0.1:7892代理完成fetch/merge/完整待推审查及正常push，未改持久配置、证书校验或绕hook。后续若需要同样配置只作用单次命令。GitHub实际开放依赖告警9项，已逐条读取两高危及Astro两条；本轮bulk查询原handle7641真实终态unexpected EOF，不把它当新列表成功，个别公告和本地事实已分别核实。

## 修改前分析与影响面

现象与触发：Undici6.28.1仍由后端直接依赖及根override锁定；官方GHSA-xjj6-f33q-929c指出过长Content-Encoding加提前断开会在内部stream建立后留下未处理错误，即使调用者捕获fetch错误也可能退出。当前生产只显式消费Undici ProxyAgent/Dispatcher，Bun由其原生proxy处理，Node代理owner及现有真实代理合同使用已安装Undici fetch；不夸大为已证明线上可利用，仍修复交付依赖。6系修复6.29.1，保持同主版本；同补丁也覆盖当前EventSource解析器告警，未使用API不增加并行实现或应用层fallback。

Zod后端/SDK等使用根catalog4.4.3，网站单独3.25.76，仅website-registry-contract显式import zod；网站其它内容由astro:content原始公开API提供。官方PR6652实际修复领先max/length/size约束在array/set/map遍历前拒绝超大输入，4.6.6已发布。PR6475的abortEarly提案为closed而非已合并，不能假定存在该选项。无上限集合行为不因6652改变，不能宣称通用内存耗尽已根治或随意给所有API加参数上限。根catalog升级4.6.6，网站改用现有catalog单一版本；不保留项目自有Zod3兼容层。网站现有schema功能为object/string/enum/array/number/optional等共同API，需真实Registry合法数据及错误合同复验。

Astro由根override与网站直接依赖共同固定7.2.8；官方GHSA-98hj-9722-w3j8修复于7.3.2、GHSA-mpr7-6m5w-76rw修复于7.3.3，升级同7系7.3.3。影响网站构建/动态Registry服务、Starlight/Node/Solid集成与现有包补丁，不能只改manifest就宣称运行修复。保持现有依赖声明合同，审查完整bun.lock差异，只接受三依赖家族及必要父子变化；四个Rust rand/glib告警随后按真实target与上游修复单独调查，不隐藏或dismiss，也不修改历史before锁来制造告警减少。

旧路径原因是固定版本尚在本次公告修复前；现有正常stream代理合同不能触发畸形响应，版本检查不能代替实际行为。公共API错误、OpenAPI/SDK投影、配置/模型/工具schema、网站Registry输入与Node/Bun传输均受影响；不改数据库schema或持久格式，不执行用户数据库迁移，不修改用户进程/窗口或上线部署。全仓搜索当前Undici生产调用只在network-proxy与network-proxy-transport，Zod网站显式调用在Registry合同，根catalog与override、两个package及锁为当前版本事实；已读当前public-website/server-runtime合同、Oct05/Oct21依赖修复记录、相关真实Node proxy fixture及依赖合同测试。未创建/运行UI自动化。

权威依据：

- [Undici维护者公告](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c)和[6系真实修复](https://github.com/nodejs/undici/commit/07ded4941b1e72afec862958c3b8ddf468f3b429)。
- [Zod已合并的集合大小修复](https://github.com/colinhacks/zod/pull/6652)与[未合并的abortEarly提案](https://github.com/colinhacks/zod/pull/6475)。
- [Astro JSX公告](https://github.com/withastro/astro/security/advisories/GHSA-98hj-9722-w3j8)和[View Transitions公告](https://github.com/withastro/astro/security/advisories/GHSA-mpr7-6m5w-76rw)。

## 实施前方案与验收

1. 保存原三manifest、锁、实际模块版本与当前告警证据。先用当前旧依赖运行有限本地HTTP的原Node子进程，验证畸形内容编码的明确拒绝与随后健康stream请求；保留原退出/错误，不能用捕获全局uncaughtException遮蔽。Zod使用小而足够说明问题的受限集合，确认当前多错误与修复后单一too_big错误/路径合同；覆盖合法解析值及网站真实Registry数据。新增的是非UI正向状态/错误/HTTP合同，不以未崩溃、不调用或版本字符串作为核心断言。
2. 仅修改根catalog/override、后端Undici及网站Astro/Zod声明，先ignore-scripts/lockfile-only解析并审查差异，再frozen install/ignore-scripts。不运行安装lifecycle脚本，不升级产品/Bun版本或覆盖他人改动；若本地native依赖被用户进程锁住，不杀进程或借分支绕过，查清精确持有者再处理。
3. 聚焦合同运行Node真实代理owner、畸形HTTP拒绝后续健康传输、Zod受限集合及Registry实际输入。运行相关类型、完整OpenAPI/docs/SDK与迁移内存检查；不运行UI自动化或全量bun test。网站构建和原Registry服务路径实际验证，必要时启动自有独立网站开发页面手工交互、截图人工复核；网站不由opencorvus /ui提供时使用该网站原开发入口，禁止直接单起Vite。页面内容/语言/布局保持公开合同；不发布、不创建Release/tag/PR。
4. 凭据/Provider预算0，不复制auth，不启动LLM或成员；构建环境与测试状态目录隔离，不触碰18571和用户DB。任何自有长期服务先固定物理期限/无活动策略，至少5分钟提前原关闭、join原句柄/物理输出请求与出生链，不因观察超时重启；有限checker等待真实终态。对实际调用不到的漏洞路径、无上限集合、Rust剩余告警和未做视觉项明确限制，不拿升级范围代替整体Goal完成。
5. 新spec/证据同步三索引、目录README，运行package声明docs check，完成范围清晰提交。fetch/merge上游、检查完整待推集合及必要验证后正常push，不绕hook；再读取GitHub当前告警状态，不能只凭本地版本声称远端已关闭。

## 修改前新增审计事实

实际`bun audit --json`（全局Bun1.4.3）返回9个npm包的18条公告，包括DOMPurify严重项，而不止GitHub列表的五个JavaScript告警。完整原JSON保留。DOMPurify当前root catalog/override均3.4.16，公开维护者公告修复3.4.17，注册表已确认；项目源码没有直接DOMPurify调用，第三方富文档/表格依赖仍由中央override选择该实现。将其同3系补丁纳入本阶段，保持原字符串/DOM模式边界，不新增应用层消毒器或以UI自动化验证上游DOM。其余msal-node、body-parser、fast-uri、ip-address、toml及旧Zod传递版本继续按父依赖契约调查，不能把本阶段升级宣称为全量审计归零。

实际`bun why zod`确认旧4.1.8来自opencode-poe-auth的@opencode-ai/plugin1.17.18，旧3.25.76除网站外还由chromium-bidi14、gitlab-ai-provider6.20.1、zod-to-json-schema3.24.5引入；不能对这些旧主版本盲目全局override4来消除告警。toml4.2.0由effect4.0.0-beta.83引入。旧Undici中央override本来已覆盖声明5/7/8系的第三方父包，此风险在Oct05记录中已明确；本次只作当前6系补丁，不伪称已重新证明全部父包主版本兼容。

先执行的三项新正向合同全部在旧版本失败：真实Node子进程捕获fetch拒绝后仍出现UND_ERR_RES_CONTENT_LENGTH_MISMATCH未处理stream错误并退出1；backend/website的受限array返回128个元素错误而非一个too_big。全局Bun当前1.4.3与packageManager1.4.0不同，已确认自有关闭588b bundle的Bun为1.4.0，正式锁解析/冻结安装/后续合同以该精确版本执行；不升级或覆盖用户全局Bun。原bulk GitHub查询handle7641退出1/unexpected EOF，原本的数据读取失败保留，后续远端告警核验需新完成的实际请求。

Astro7.3.3当前公开manifest要求可选peer @astrojs/markdown-remark ^7.3.0，而网站固定7.2.2，不能把旧peer矛盾带进本次升级。将网站该直接集成升7.3.0作为必要Astro家族变化，重新生成并审查锁；其它已锁父包保持。DOMPurify维护者公告GHSA-cg2g-xh64-v4q7及发布3.4.17已实际读取，第二个公告请求75080因TLS handshake timeout明确失败，不能当作正文已成功查阅；原Bun审计的三个具体范围和新模块元数据仍分别保留。

## 中间验证与验收调用链修正

完整网站构建原caller36178退出0，构建263页并成功生成模块/控制程序；实际runtime smoke原caller明确退出1，编译控制程序在业务import之前因runtime/package-require缺失dist/server/package.json报错。不是网站SQLite升级或输入失败。正在追查seed-validation静态引入ExpertSquadRegistry的依赖闭包，不能拷贝后端整套原生依赖或放宽packaged require隔离来绕过。共享ProcessFacade、文件broker及overlay事件等其它工作在本轮期间出现修改，保留其所有差异，不纳入本批提交。

api:routes-check真实失败为Zod4.6.6生成联合原始类型的JSON Schema从anyOf改为type数组；需要完整语义差异审查。已读当前SDK事务生成器及隔离generate-openapi入口，SDK原先无工作区改动，计划先执行唯一正式SDK build（在临时事务编译通过后原子替换），再以完整JSON结构核对差异、当前route inventory复验；不修改checker或手工伪造投影，不改变数据库版本。

控制程序直接路径已核实：website-registry-control → website-registry-import → seed-validation → ExpertSquadRegistry。它只调用同步loadEmbeddedPackageDeclaration重建ZIP事实，但registry顶层静态引入package-tool-capsule；该模块又静态连接Task binding/engine/runtime及sharp原生加载，造成控制程序在解析CLI参数前启动整个执行面。唯一introspect调用点为异步preparePackageToolBundles的实际bundle循环。计划将该import改为类型导入，并在真实循环内动态加载原同一个introspect实现，保持签名、原生隔离拒绝、包事实、工具校验/预算及错误语义；零工具的声明读取不应初始化执行器。无数据库/调度状态或重试逻辑变化，不新增后备解析器或网站私有manifest实现。全仓调用检索包括archive/manager/website生成/seed验证与name-field合同；本批以正式编译控制程序实际import、Registry真实合同和类型检查证明路径。首次失败的原控制进程退出1、外层物理/输出settlement为true；不是观测超时后重启。

正式控制程序重编后，原runtime smoke成功退出0，实际导入122个包并通过就绪、归档字节/计数合同。OpenAPI正式事务生成成功，仅openapi.json变化，SDK源码/类型无差异；结构变化包括原始联合折叠、starts_with字符串format注解、嵌套oneOf分支规范化，以及arm_order二元tuple新增精确minItems/maxItems/items:false。不能说只有格式变化或全部结构完全相同，tuple表达现在与原Zod运行合同一致；无API路径/方法变化，完整routes checker复验通过。

网站独立Astro正常dev API现已启动，自有Registry数据库/目录、零Provider预算，原生产ProcessFacade/Windows Job持有20分钟物理期限（05:32:36Z—05:52:36Z）；通过独立54087 controller主动关闭后等待原host/输出settlement，绝不操作18571。手工IAB查看中文、英文首页和真实市场；未签名本地catalog保持明确拒绝下载，不能声称签名下载已视觉验收。市场搜索research-studio实际返回一个卡片却显示“1 teams”，截图market-single-before-visible已查看。直接原因是MarketplacePage中两语言copy只有复数suffix，SSR初始和refresh都拼固定后缀；全仓teams/market-search检索定位这一实现。计划在现有copy补单数后缀，两个显示点按真实数量选择，数字用标准Intl.NumberFormat与当前页面lang；零结果保持现有本地化空状态。只改该组件，不引入独立翻译源/计数状态/测试；实际手工验证一项、多项、零项及中文并重新截图。网站构建生成的两份facts文件来自他人正在修改的包prompt/工具源，保留可审查输出后仅撤回本批生成的精确差异，不把这些未授权混合产物计入本批交付。

一项截图人工已确认1 team；多项12 teams截图同时揭示同组件卡片“1 workflows”的相同固定复数问题。将已读到的两个实际卡片计数（agents/workflows）一并沿同copy的单复数及当前语言数字格式修正，不扩展到未调查页面。新Node合同的无活动计时改为只终止自有子进程，错误必须等execFile原callback在stdout/stderr关闭后返回；去掉当前全4系校验中的旧Zod3 origin/type替代逻辑。格式工具第一次bun exec prettier失败只因未定位二进制，随后以项目实际node_modules/prettier/bin/prettier.cjs成功格式化两测试文件；未当成验收成功。修改后原聚焦合同重跑4pass/26expect。

完整OpenAPI语义调查继续深入到嵌套数组后发现ISO日期时间正则实际变更，不止tuple：4.4.3接受2026-10-25T05:30Z，4.6.6默认拒绝；秒、分数秒及带冒号offset均继续接受。直接运行两份已安装模块确认，而非根据diff猜测。全生产packages检索定位4个自有声明点：安装元数据generated_at、交互产物Timeline（含viewport）以及plugin evolution的data_window和last_activity_at；前二允许offset，后二区限UTC。安装元数据直接safeParse磁盘JSON，不能用本次安全升级悄悄收紧既有数据合同，更不能要求清库。官方当前[ISO datetime文档](https://zod.dev/api?id=iso-datetimes)明确推荐用两个公开precision声明的union表达“分钟及秒/分数秒”，无单个precision覆盖两者。计划在现有util包（已依赖Zod，已有通用schema）提供唯一isoDateTimeSchema定义，以offset参数保留两个现有时区边界；三个源文件同步替换全部4点。它定义的是当前产品完整允许值集合，没有旧协议探测、双读写、数据改写或自写正则，也不改第三方MCP合同。先新增纯数据/实际元数据文件读取正向合同证明当前失败，修复后重跑，并经唯一SDK事务重新投影及routes/完整类型验收。传递第三方包的默认RFC3339合同归其原维护者，不伪称自有helper改变了它。

网站最终构建原99467退出0，真实手工截图已确认英文1 team/12 teams、卡片1 workflow、英文空状态、中文1个团队及研究工作室详情。自建269页已关闭，05:40:58Z主动POST自有controller并完成原8060退出0/物理和双输出结算，距05:52:36Z期限11分钟以上；未刷新用户应用。未增加或运行UI自动化，页面视觉不能代替安全漏洞模式的完整覆盖。

## 本阶段最终验证与交付范围

- 日期合同新增前真实3fail/0pass；显式当前精度实现后4pass/19expect，包括实际旧格式元数据文件读取、Timeline点与Evolution字段，以及无效日期/时区边界的具名错误合同。没有数据改写、schema版本升级或用户数据库操作。
- 内容编码、受限集合与原Node代理合同最终4pass/26expect；Registry实际合同9pass/58expect。声明loader与工具执行器共享唯一实现，正式编译控制程序已验证初始化边界。
- 最后SDK事务build成功；当前生成types的`string | string`是生成器对两个精度分支的原样投影，仍是同一string值类型；不手工覆盖生成输出。完整api:routes-check通过36文件/6规则/实际库存一致，docs:check通过350操作/26组。
- 最后root typecheck原97527成功退出0，8个workspace全部cache miss；含内存迁移检查。真实Node overlay生产build通过。时间字段修正后再次完整网站build原12224成功退出0，263 HTML/搜索索引/正式module与control均完成；最终runtime smoke原48338成功退出0，122包、SQLite、readiness、归档字节和计数合同通过，唯一server退出join后才清理隔离数据库。此构建与实测是证据，不能拿单纯manifest/版本比较当成功。
- 实际Bun审计从18条（严重1/高8/中5/低4）降为11条（高6/中3/低2）。Astro/DOMPurify/Undici家族告警已退出本地结果；Zod传递旧版本仍由poe/plugin、chromium、GitLab、JSON Schema父依赖引入，msal-node/body-parser/fast-uri/ip-address/toml继续未完成。Rust4告警不在此补丁中，历史before锁未改，不能宣称总安全问题归零或远端告警已关闭。
- 两份网站facts生成文件起始clean，本批prebuild将他人prompt/工具改动物化；保存并审阅原差异后，用精确三行patch仅撤回本批输出至原事实，未覆盖任何其它源码。所有外部工作区删除和并行业务修改保留，三共享README只提交本阶段索引行。
- fetch已通过验证TLS的schannel单命令完成，上游当时0/0。下一步使用独立index提交本阶段完整变更，原hook、上游merge、完整待推集合审查与正常push；GitHub实际告警核验在推送后完成，不将未读结果提前写成关闭。未增加分支/worktree、tag、Release或发布网站。

本阶段不满足的整体要求仍为原成员侧栏高频Rendering根因与完整真实页面复验，以及剩余父依赖告警；本阶段依赖/交付故障与小型市场可用性修复不代替它们。当前长期Goal保持active、单agent继续。

固定Bun1.4.0的冻结安装通过，实际backend Undici6.29.1、backend/website Zod4.6.6、Astro7.3.3。锁差异已按真实package metadata核对，包含DOMPurify3.4.17及必要Astro helpers/remark/satteri/find-proc/verkit调整、已有picomatch重定位；未更新无关父包。聚焦合同4pass/26expect，8个workspace类型检查全部cache miss后实际通过。

第一条Registry命令误把--cwd放在run前，仅打印Bun帮助并退出0，不能计为验收。保留原log/result，改为包当前声明的`bun run --cwd packages/web test:registry`后经生产isolated/inactivity/ProcessFacade runner实际执行market生成与原测试，9pass/58expect；有限原caller和child返回0/输出已排空。未以最早exit0掩盖未运行checker。

当前网站实现及真实测试仍为`/api/site/v1/views`与月/总浏览量，而public-website架构的一段描述为visitors；已核对真实tracked route/ViewCount/SQLite合同，尚未定位授权更改语义的原始记录，本批保持实际功能，不按文档标题擅改计数或Cookie政策。网站runtime smoke属于实际HTTP/SQLite/不可变归档字节检查，没有DOM/组件/截图断言；其finally直接kill唯一自有server后就删临时数据库，缺少原child退出等待。此次仅补原exited join再清理：有限control子进程已有exited等待，smoke仅由网站package/CI调用，不进入Task/Mission/Session调度、恢复或持久轮次；外层采用现有生产ProcessFacade/隔离无活动runner，仍验证其物理/输出关闭。不把独立checker的清理风险说成已观察到生产执行队列异常，也不新增并行进程实现。
