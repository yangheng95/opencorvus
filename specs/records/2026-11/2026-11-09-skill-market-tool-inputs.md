# Runtime Skill Market 工具输入适配

## Recall

持续迭代，先根因/影响落盘、聚焦正向checker和真实开发/ui桌面截图本人复核、清晰提交/普通上游合并/正常push，再单人下一批，直到用户明确停止。用户要求不要子agent，本批独立。b32 9b4a30853正常推送全部hook通过，main/upstream0/0、原177条状态和空暂存完整。Sol授权仍未收到，零模型/凭据；不批准外部技能安装。上一批真实两段来源差异保持开放，本批不假装修复它。

已读04-extensions/07-panel当前合同、2026-08-26-runtime-skill-market-search-install及b31/b32 Recall；读取SkillMarketTool所有三个分支、Tool.define包装/参数转换/附件物化/Truncate小结果直返、SkillManager全部市场schema和方法、SkillMarket严格SearchInput/Identity、全仓三个方法全部调用、两个HTTP路由、permission/invocation的网络读取与install单独write_local分类、primary角色工具投影。读取全部已有skill-market-builtin-authority正向路由/服务用例及fixture，未覆盖SkillMarketTool.execute；未发现触及路径UI自动化。查阅当前[官方市场API](https://skills.sh/docs/api)和[Vercel CLI搜索](https://raw.githubusercontent.com/vercel-labs/skills/main/src/find.ts)：网站well-known两段身份是独立合同扩展，认证v1接口不可在没有授权时读取凭据或替换当前公开接口。

## 实施前根因和影响

代码现象：SkillMarketTool.Parameters是含action的discriminatedUnion，Tool.define保留并parse整个合法工具输入，分支又Parameters.parse，然后将input原对象传给searchMarket/inspectMarket/installMarket。服务的SearchInput、MarketInspectInput、MarketInstallInput全部strict，且不声明action。直接触发点为工具选择字段越过了工具→服务边界；三个分支理论均会以unrecognized_keys/action拒绝。必须通过真实Tool.init().execute的三项正向用例重现，尚未执行本批新checker，不把静态阅读冒称运行结论。

根因属于工具适配，没有证据表明LLM传错参数；action在工具公开schema中是必需字段，不能改prompt教模型省略，也不能松开共享服务strict或host绕行。旧路径只通过HTTP已验证查询和JSON对象入服务，那些入口不含action，因此过往路由/fixture通过未覆盖真实运行工具入口。所有主角色共用同一个SkillMarketTool，搜索/检查/安装三动作都受影响；HTTP入口继续正确，不能将问题局限于单任务或模型行为。正常参数校验拒绝不是已观察的调度/队列/恢复/终态收敛异常，本批未发现这些机制异常。

方案仅在三个分支显式投影服务输入：search {query,limit}；inspect {id}；install {id,expected_hash,policy}，全部取自原已解析input。工具声明/模型原输入/action/元数据/result完全保留；服务严格输入、权限分类、精确内容hash授权、安装目录所有权、配置、风险算法和后续轮次可见性保持。没有公共API/SDK/schema、持久数据或迁移改变，无新fallback、gate、LLM路由或双源。三个参数映射是三个既有不同公共方法的显式适配，不抽象通用删字段器。

影响面覆盖唯一工具定义和所有消费者角色、三个服务输入契约、真实网络搜索/下载、普通错误和安装后投影，以及原路由/服务测试、架构和交付。风险是漏limit/default/coerce/trim、丢expected_hash或policy、误扩大权限和改变结果格式。聚焦用例必须经Tool.init包装且检验当前正确metadata/output、候选/风险/精确hash/deny/next_turn及自有fixture文件/provenance；实际网络只调用搜索和检查，绝不安装外部bundle。测试自有fixture只写隔离测试runtime，清理前验证目标属于其managedRoot，配置还原。

## 方案与验收

先在现有后端market测试里复用marketFixture，新增三个Tool入口正向用例（search/inspect/install），运行正式bun run test指定文件与名称模式，应以原action字段失败；保存原失败日志/隔离runtime，不改共享校验。确认三项同根后才实施显式映射，再重跑三项及该现有市场文件全部聚焦用例。无UI测试、源码文案断言或全量bun test。

Temp opencorvus-iteration-20261109-b33，fresh本人私有Git/profile/项目；独立开发38984 /ui，与Tool真实网络checker同一自有profile资源但服务/本地checker不能并发争用写状态，先checker正常结束再启动页面。真实SkillMarketTool.init/execute仅search公开react和inspect已返回候选，检验真实结果并记录；上下文是checker的显式测试输入，不合成或持久化用户/模型消息，不能冒称LLM或完整Session端到端。若实际需要持久化大输出，必须使用真实Session authority或明确未达成，不伪造授权。真实页面按同一现有API搜索、查看中英文详情，截图本人复核并正常退出，证明服务入口保持；不执行安装。

后端typecheck、必要plugin/sdk类型和文档/架构为辅助；UI源码未变，不无目标重建或新增UI自动化。若checker或工具链失败先根因修复并重跑，不掩盖未完成。自己的页面关闭/服务正常shutdown和原session exit0，项目原文/Git与原177状态保持；范围提交三README仅本条、fetch普通merge、完整待推集复核及正常push后继续来源差异调查。Sol、新来源成功、真实外部安装不在本批合格范围。

## 三入口真实红证与实施定稿

正式bun run test指定现有后端文件与executes the runtime market名称模式：0 pass/3 fail/4 filtered。search、inspect、install三个实际Tool.init().execute均在各自服务严格输入报ZodError，code=unrecognized_keys、keys=[action]、path=[]，未到任何外部安装；原完整日志留存b33/red-tool-contract.log，隔离runtime opencorvus-test-run-brGFSV按失败规范保留，physical/output settlement=true。不是mock服务函数或静态字符串猜测；fixture仅代替公开网络bundle，真实工具包装/服务parse路径运行。已完成三个分支同根确认，按原方案实施显式字段投影，不松strict、不改工具参数/提示或权限。

## 最终实现和验证

三个服务调用显式传入各自字段，input/action本身完整保留供元数据和原工具声明消费。服务strict、权限network_read/install write_local、原hash/所有权/配置/风险/后续turn合同均未改。后端typecheck通过，文档352操作/26组和20份架构索引通过；没有API/SDK/持久结构/UI源码变化，无新增/运行UI自动化，无需重复构建未修改的UI。

新三项Tool正向用例首次改后3 pass/8断言。首次扩大到原文件7项时为4 pass/3 fail，全部后续失败指向本测试tool-install夹具的已删除managed目录：新增finally直接rm物理目录，Config.writeGlobal(before)经writeGlobalMutation/writeConfigFile的patch语义没有同步删除新增路径，留下测试残留引用。已读取Config/SkillManager.remove唯一owner；改为在验证绝对目标归属managedRoot后调用真实remove同步配置和文件，再恢复原配置/发现状态。原失败runtime opencorvus-test-run-ZCUYIr保留/physical-output结清。没有为测试故障改产品Config、放松目录验证或屏蔽失败。重新运行原完整聚焦文件7 pass/31断言，原HTTP/精确hash变化/身份隔离/路径与上游错误合同及新三个Tool入口全部通过。

本人fresh b33/profile中真实生产SkillMarketTool.init().execute，经正式Tool参数解析、服务和公开skills.sh网络读取：search react/limit2得到2个候选，inspect实际首候选得到76个文件/medium/deny，原hash及元数据对应正确。原output分别1253/7181字节，完整JSON可解析，未进入持久截断分支。ctx明确是本地checker测试上下文，messages=[]且无持久化对话、模型或伪造消息；这是实际工具到网络读取checker，不冒充Session/模型端到端。原进程exit0后才启动同一自有profile的开发服务，避免并发写owner。

38984/IAB70本人实际设置Skill Library搜索react、点击Review、同一详情切中文；01英文列表/02英文原详情/03中文中风险，三张均本人实际呈现查看。UI保留main-WxJflJJM.js；原名称/仓库/hash/108,261 B数据和前两批语言行为保持。两个真实TCP响应以运行时/doc schema和Ajv2020校验200，搜索前2候选和完整详情JSON与直接Tool结果精确相同。不能将HTTP页面当作工具入口验收，工具入口由上述独立真实checker和三个正向用例证明。

自己的页面70关闭，开发服务33807正常shutdown200/原session exit0；项目原文53字节的工作区和种子commit内容精确一致（实际字节以owned-project-after-check为准），仅一个已声明种子提交与原subject，config文件清单为空。零模型/凭据/外部安装；测试安装仅自有网络fixture在正式隔离runtime内通过真实owner写入和清理，不执行其中脚本。

真实外部安装、完整Permission/Session/LLM与授权GPT-6.1 Sol端到端本批未达成，不能用direct Tool checker替代。b32发现的well-known两段身份仍按当前三段合同被拒绝，成功来源扩展未实现；后续继续单独调查官方身份/下载/provenance及数据影响。原177条工作区改动保留、三个README只提交本条；范围提交/fetch普通merge/完整待推集合复核/正常push后单人继续。
