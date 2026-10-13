# Provider 行模型摘要的目录事实（持续迭代第15批）

## Recall

用户要求持续按批次调查、落盘根因与影响分析、实施有证据的改进、真实桌面交互及截图人工复核、聚焦正向非UI（User Interface，用户界面）合同、必要且已授权的GPT-6.1 Sol端到端验收、范围提交、fresh上游合并与正常push，直到明确停止。最新要求“停止所有子agent，你自己做并验收”；本批保持所有子agent停止，Root独立执行，不委托、不发消息、不操作用户进程/窗口。

前批范围17781b959e8574260fa259b98a2d075032273825（124路径、parent3e9f3b59ba9d67ebc24ed746b75a5c7287e49c7d），原commit53541完成72174c实际0，精确原index结算0。原fresh fetch c6554d实际0、merge ae86ad实际0，完整pending仅本批提交。正常push24452完成ed4e38实际0，原全部钩子通过；原634446实际远端refs/heads/main确认17781b959。所有本批源/记录/证据干净，剩余工作区为独立用户任务，继续保留。本任务实际当前分支main/upstream origin/main；不因历史merge标题推断当前分支。交付原回执将本批独立承接，避免前批提交自引用。

已读：当前06-provider、07-panel、07-panel-reactivity、B11空声明/B13有效模型/B14生命周期Recall、当前ProvidersPanel完整模型摘要/搜索/编辑/目录行、config-load/catalog projection、project/global provider公开目录路由、Provider buildState/configured/runnable分流、ComposerModelSelector目录输入、两种locale（语言目录）。全仓搜索providerModelIds/modelSummaryText/modelOverflowText/provider.models.count/provider.label.no_models、catalog/list/configProviders/disabled/whitelist及全部直接调用。模型数量翻译还用于Composer分组；不全局重定义它。当前检索触及的provider业务测试均为纯字段/transport/metadata合同，没有UI自动化；不运行或新建UI测试。历史日期不重建旧spec。

## 现象、触发与根因

B14原图17–20显示owned-lifecycle-a/b每行“0 models”和“none”；同轮原GET目录各有一个模型，原真实Test请求body.model分别为owned-lifecycle-a-model/b-model。这不是猜测凭据、标题或模型自述：前批实际HTTP原件、目录ready和原图均可核验。B11/B13已经明确空models声明可以继承canonical目录；B13修复Test从有效配置选默认模型，但保留行声明数量，因此界面仍给出另一个没有标明来源的“模型数量”。

直接触发为unfilteredProviderEntries调用providerModelIds(provider.models)，provider来自appStore.config；摘要、溢出、标题和搜索都沿该声明集合。目录行则来自appStore.providerCatalog.all，Composer同样消费公开目录模型。数据根因是把用于编辑覆盖的配置声明当成显示完整目录的模型事实，导致继承模型不展示也搜不到；部分覆盖时只显示被覆盖的部分ID。旧修复处理保存、Key事实、Test默认选择和观察退休，没有统一这条读路径。当前声明并不等于模型可运行集合；公开catalog也包括尚未认证的声明，不能把目录数量称为认证或可运行证明。

## 影响、合同与排除

唯一生产模型摘要/标题/搜索consumer为ProvidersPanel对应row；startEdit和form模型字段仍从配置读取，必须保持其覆盖/保存意图，不能将继承目录写回配置。catalog分组和custom分组已按Provider ID去重，继续保留当前信息架构、顺序、密度、控件及8项模型摘要上限。两个HTTP目录已合并canonical+配置+插件并按当前scope输出all，来源是既有appStore.providerCatalog；不新建catalog缓存、配置、fallback、派生持久状态或后端合同。

config-load拥有scope/authority/sequence保护，失败保留旧catalog值并记录providerLoadIssues(resource=catalog)。因此本批不能仅把旧数组换进来后在失败时当最新事实；缺少当前目录响应或目录读取失败时，计数显示“—”，摘要使用当前语言“加载中”或“模型列表暂不可用”，原错误详情仍由已有Feedback承载；成功重读后恢复原目录。catalog公开行同样使用这一个已知性判断，避免同页两个数量语义。Provider身份原文、技术ID不翻译。

不改Provider/SDK（Software Development Kit，软件开发工具包）/Config/Auth路由、LLM（Large Language Model，大语言模型）流、调度、队列、恢复、终态、权限或版本；没有新发现上述机制异常。本批是UI呈现来源修正，不新增/修改/运行任何UI自动化；不存在新的非UI公共行为需补业务测试。B14的15个真实故障输入和B13的9次Sol只保留各自批次边界，不算本批新验收。新的真实Sol只有触及推理合同或真实运行证据要求时才执行，不能为数目重复凭据使用。

## 实施前冻结方案与验收

1. 独立归档前批原commit/pending/fetch/merge/push输入输出及实际exit，保留原成功与失败，不使用另一owner推送代替。根/月/artifact索引同步，当前docs:check。
2. fresh自有默认/A/B Git项目，Config之前核对真实root；复用B14已修正运行器，以完整默认canonical目录加本批fake样例、生成假Auth、独立端口和原75分钟服务上限启动backend `/ui`。全套真实Provider不复制用户凭据。先用修前冻结UI亲自查看并截图：空声明继承、部分声明继承、无目录模型。通过真实公开API核对声明/目录两份事实；不注入DOM（Document Object Model，文档对象模型）或产品状态。
3. 实际前态核对后，custom行按真实ID读取同一公开catalog模型集合，用它产生数量、前8项摘要、完整标题及搜索；编辑仍只读原配置。catalog未资格时统一未知展示，不把旧值当0或最新值。不修改共享plural翻译语义，必要新增unknown摘要同步中英。
4. Root用Node构建、类型检查后启动fresh自有后态backend `/ui`。实际中英桌面核验继承数量和ID摘要、按继承模型搜索、0模型行、打开编辑仍为空/部分原声明、取消/切项目、普通模型行；如改到错误未知分支，用自有生产输入/锁控制真实公开目录失败并恢复，不浏览器拦截。截图必须本人看过并据视觉修改后重拍，不扩大移动端或运行UI自动化。
5. 正常关闭自有页面与服务，确认物理exit、监听0、整对假auth/models清理及完整日志检查。保存原图、输入、原HTTP事实、工程检查和未满足项，更新当前架构/唯一CHANGELOG中英未发布。精确范围正常commit，fresh fetch/merge、完整pending归属/验证检查、正常push，不Release/tag/PR；之后继续下一批。

当前状态：本方案在新运行器、新UI动作和产品修改前落盘。前批已实际正常交付；本批只有历史证据与源码分析，新的前后态尚未执行，不提前记为通过。

## 前态实跑与方案精化（产品修改前）

原launcher6c1b4f/session13835，PID89936、18624/18625，fresh默认/A/B Git在Config前核验精确root，完整canonical91。三个自有输入：A空配置声明/目录1；B配置1/目录2（额外继承owned-summary-b-inherited）；zero配置0/目录0。三个scope实际GET/config+provider均200，原624db9投影保存public-model-facts.json，仅保存身份和两套ID、不记录Auth。没有LLM调用、Message或结果注入。

Root亲自操作tab9查看四张原图：01实际A0/B1，02按继承ID搜索为0/3且无匹配，03真实zero行0/none。04打开A编辑的上部，Models在当时viewport以下；原AX与公开Config证明草稿/声明为空，但04不能冒充本人看过Models输入区域。后态必须实际滚动到该区域留图确认。所有原图已查看，不将文件名当区域证据。

复用现有成熟primitive：services/llm.ts::modelsForProvider从唯一appStore.providerCatalog按真实Provider ID返回排序ID，现有defaultModelForProvider也调用它。custom与catalog行复用此读法，删除只给两处旧计数服务的providerModelIds私有helper，不新增平行模型解析。编辑继续原providerFormValues(config)。进一步读到providerProjectionIssues将后端局部问题标为resource=provider并保留providerID；模型已知性应同时考虑目录请求错误及本Provider/无ID的projection issue，不能把错误中的缺失项当完整0。该判断仅控制既有UI呈现，不改共享读写合同或新增业务状态。

未知分支真实资格用本批after假Auth的可恢复语法损坏作为明确故障输入，原值只放进自有控制器内存；保存前已知所有请求结束，拿生产文件锁做原子替换，明确恢复marker或120秒绝对上限finally恢复同一原文件，不重置产品请求预算。不复制用户Auth、不中断用户服务、不拦截浏览器。之后通过真实页面导航重读触发实际AuthReadError/HTTP和原Feedback，再恢复重读。若返回路径不足以覆盖计划分支，如实保留原结果而不伪造catalog错误。

## 后态实际资格与完整搜索补充

原before13835完成5df105实际0，privacy40351完成606da4实际0，完整backend97956bytes/stdout0/stderr0检查通过，端口0/pair清理。后态Node构建30525完成5596b2实际0、56.18s；类型53395完成4e2fb9实际0。原after launcher44906、PID83080、18626/18627、occurrencecc6ae05a-d917-4c97-84ca-581cf4bcc59a，三个输入与前态一致。

Root原tab10实际查看05–15共11原图，加前态4张共15：英文A1/B2/zero0、继承ID搜索命中B、实际滚动聚焦Models后的07只含原B声明1、08仍空A编辑；中文09–10数量与零模型、11真实project-A继承搜索。修前冻结UI来自B14构建，新后态构建还包含工作区其它已授权变化（例如页面外的持续目标区域）；本批只资格Providers对应区域，未宣称其它页面或变化通过。

语法故障原helper76029/PID54656，started1791931872494，原120000ms上限不变；Root显式restore212861，原句柄ef7ec1实际0，at1791931952642、expired=false、restored=true（约80秒），原值只在内存。第一次换标签后的12仍有原缓存，不能冒充错误态。随后真实POST/provider/refresh b1ee8641于22:52:03.682开始/03.898 200，后端22:52:04.048记录auth.read/Saved Provider credentials contain malformed JSON；目录GET按原200+issues投影，不是先前计划猜测的HTTP503。13中文与14英文实际显示“—”及当前语言不可用摘要，原Auth与Feedback也显示真实暂不可用。原值恢复后真实再次刷新、重读，15恢复1/modelID；原feae64全局/A/B公开GET均200且两套ID保持原0/1、1/2、0/0。

Root关闭tab10，stop5b899f；after44906完成848075实际0、正常settle/logclose、监听0/pair整对清理。privacy94361完成093947实际0，完整backend133565bytes/stdout0/stderr0检查通过。当前15图全部本人看过。此阶段0实际推理请求/0 real Sol，不能借前批次数。

最终源码复核发现同范围搜索遗漏：providerEntries将modelSummaryText（仅前8个ID）及modelOverflowText送进matchesSearchParts，完整row.modelIds只供title。该纯显示截断原本也会让第9项以后的配置模型搜不到；改目录读法后仍会影响第9项以后的继承模型。matchesSearchParts已全仓读明为parts逐个字符串包含，正确修复是同时展开完整row.modelIds，不改全局搜索函数、不把展示上限当搜索上限。本节先记录根因与影响再补这一行，随后重复工程检查和fresh真实overflow页面资格；旧15图不算该新分支通过。原两轮均已正常结束，不重启、不延长原owner。

## 最终完整搜索资格与范围

完整ID加入原parts后，最终类型10143完成56a027实际0；最终Node构建91738完成ee7b05实际0、1m25s。fresh overflow launcher20897，PID86044、18628/18629，在相同完整canonical91中将B目录扩至10、声明仍1；A1/zero0不变，三个默认/A/B Git仍在Config前准备，未复制用户凭据或改运行上限。

Root原tab11实际图16显示10 models、按原排序显示前8项并+2 more，长技术ID自然换行，按钮与输入没有重叠；图17按第9个owned-summary-b-inherited搜索，结果仍为B、1/3。完整title中的10原ID同时可从原可访问状态读到，不把这当鼠标悬停截图资格。原85220e核对global/A/B实际GET两套集合，B1/10。关闭tab11、stop96014d后，原20897完成1bd746实际0，正常settle/log close、监听0/假pair整对清理；privacy74650完成60830c实际0，完整backend97924bytes/stdout0/stderr0检查通过。

本批最终17张原PNG均本人看过，三轮原服务全部正常0，0推理/0真实Sol/0UI自动化。没有修改modelsForProvider、全局搜索、Provider后台、SDK、配置/凭据或运行合同；唯一产品范围为ProvidersPanel目录呈现/完整ID搜索与两个现有locale各一个未知摘要。删除旧私有模型keys helper的两个唯一调用点均已替换，无该helper测试或公共caller。UI-only改动不创建自动化合同；两次类型与Node构建仅作工程检查，真实页面图证单列。

原始输入（含before/after使用的只读历史输入副本）、公开事实、完整完成日志、物理退出与pair清理、原工程检查、17原图和前批正常交付原回执统一归档。当前已资格：全局英文/中文、project-A中文、空与部分覆盖、真实0、继承ID搜索、八项摘要与第9项搜索、真实provider auth.read投影未知及原输入恢复后的正常刷新。尚未新增资格：所有provider局部失败类型、catalog纯HTTP故障/首次无catalog加载、其它主题/平台和大于当前10模型规模；不以源码或其它owner结果补齐。下一步只做文档检查、精确范围commit、fresh fetch/merge、完整pending审阅和本任务normal push；实际提交与推送产生之后由后续Recall承接，不预写成功。

范围暂存初次f21905未通过：完整前批push原日志含GitHub remote自带行末空格，git diff --cached --check实际2。未裁剪或重写原证据；核对四份归档副本与对应原字节完全相同后，将完整commit/fetch/merge/push日志无损gzip归档，并只删除本批尚未提交的精确原文本副本，之后重跑同一范围检查。该工具/归档问题不算UI失败或已完成提交，不跳过检查。
