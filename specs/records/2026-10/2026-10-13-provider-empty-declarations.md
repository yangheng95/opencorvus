# 持续迭代第十一批：Provider 空模型声明保存

## Recall

用户要求持续分批并行体验 UI/UX（User Interface/User Experience，用户界面/用户体验）、功能与缺陷，直到明确停止。每批先根因/影响分析与规格、实际修复、真实桌面交互及截图人工复核、聚焦正向非 UI 测试、必要已授权 GPT-6.1 Sol 流式验收、范围提交、fresh upstream 合并与正常 push，再进入下一批。上一轮是实际进展：第10批373d8682d0b6159a4a50edfae03e9e40bf89e5fa范围85路径、原commit70502/push33594均exit0；45项71断言、19截图、4真实Sol请求200/stream/eof；自有3 UI进程及Sol物理exit0/port0，配对auth/models已清理。远端0370acd0包含该交付，后来7e393fd28是独立owner提交。开始工作区有395 Source/Skill、进程、表格patch、日志与共享索引等并行改动，必须保留，不建分支/工作树、不粗暴回退。

已重新读取AGENTS、当前05-config/06-provider/07-panel/07-panel-reactivity、2026-10-04产品体验、第五批地址字段意图、第八批零模型发现、第九批凭据三态、第十批Recall/原push及前态截图。全仓rg检索providerFormValues/applyProviderForm/providerModelIDs/models_required、Config.Provider、configured/runnable派生、模型引用校验、global/project GET/PATCH与generic/live discovery。唯一生产调用为ProvidersPanel；helper的ID解析及纯数据测试仍使用providerModelIDs。models_required仅Panel guard和两个locale。测试只覆盖已有字段意图，尚缺三组空集合明确输出。未找到当前架构要求所有Provider声明必须至少显式配置一个模型；保留快照65d0bfc98已含该guard，不能据快照猜测最初产品偏好。

两个已授权独立一层agent完成只读并行调查，禁止再次委托；UI分工亲自查看第10批真实空模型编辑阻挡图并审查唯一guard、locale、历史与字段意图；功能分工独立确认Source/有效配置、目录继承、模型引用400、Auth后续与并发字段保真，未运行新矩阵。原报告归档本批artifact。主agent核对源码：Panel handleSave643提前return；Config.Provider optional models record；Provider buildState367–380先继承catalog再应用配置；provider-form92–138只应用明确字段意图；services/config439–483保存时重读当前有效配置并发RFC7396差异；candidate-validation/model-reference-validation保持全部模型引用准入。一次猜测validation.ts读取不存在已用rg定位model-reference-validation.ts/candidate-validation.ts，未把失败读取当证据。

本批没有产品修改。当前持久方案如下，后续实施/验证必须据此；当前源与并行改动再变更时复核自己的范围。

## 可观察现象、直接触发与根因

第10批独有中文桌面页对owned-bootstrap（已配置Key、0模型）的编辑按Update产生“请至少添加一个模型”。当时只有虚构输入与自有参与者，没有实际私有配置或用户服务操作。该截图证明合法空声明被阻挡，具体只改名称/API的历史动作由root交互报告提供；本批重新绑定目标运行前态后才能取得本批操作证据。

直接触发是提交模型textarea解析结果为空；handleSave在HTTP之前无条件返回。数据根因是把显式配置声明数量当所有保存的前提，而声明不等于完整有效目录、更不等于运行准入。Config.Provider和现有helper都允许空集合；正确的空→空字段保真、非空→空明确删除及空新建路径被调用方旧guard阻断。旧元数据/地址意图/发现/凭据修复各自处理真实合同，没有替换这条数量限制；第10批只把同一提示改结构化，没有新造条件。

三份事实必须区分：canonical models.json目录、global/project JSONC声明/覆盖、ProviderState实际runnable集合。项目GET/config返回有效层合并，textarea可以包含global继承ID，不能称其全部为项目文件本地声明。缺席models和{}均可继承catalog；删除project覆盖可恢复global同ID，删除config覆盖可恢复catalog同ID。清空textarea不表达禁用整个Provider、删除Auth或屏蔽继承模型。

## 影响、公开边界与未知

范围覆盖两scope的新建空声明、已有api-only（models absent）、models:{}、models-only:{}（API absent）的可达行，以及名称/API/env编辑、明确清空最后一个配置覆盖、旧表单期间新增模型/metadata。纯{name}且api/models都缺席的配置不是当前custom行，未解决其可达性。真实运行模型仍由既有enabled/disabled、loader、过滤、hasRunnableModels/getModel/getLanguage决定；不产生伪模型或第二集合。

新建仍需合法明确API、唯一ID；编辑未改API保留缺席/模板/当前并发地址，同ID并发创建与Provider并发删除保持既有具名冲突。helper从保存时current clone开始，空→空不写models，显式清空只删除initial ID并保留peer新增metadata。它不是CAS（Compare-And-Swap，比较并交换），GET后PATCH前同字段并发仍为原最后写入语义，不能声称消除所有并发冲突；canonical writer重读/patch/原子替换保留。

模型引用校验继续检查model、small_model、agent、runtime_templates、expert_squads及command。清空仍被引用的唯一自定义模型，保持ProviderModelNotFoundError HTTP400；global writer还验证已登记项目候选。不得为保存空声明绕过引用、profile或Skill/Conversation约束。project清空与继承恢复、catalog覆盖恢复、引用错误组合的本批真实运行尚未知，必须用实际正向输出验证。

配置先提交；仅非空用户输入Key才走唯一Auth写入、当前scope config-key清理与刷新。空模型不授权清除Key，配置已提交/Auth后续失败仍保留第10批事实。未填Key保存当前只更新config store，catalog事实刷新是独立边界，要真实查看保存行及明确刷新后的事实。地址api拥有discovery，但只继承catalog模型的推理地址还受options.baseURL/model.api.url拥有，不能由api保存成功推断所有inference URL改变。本批不改该合同。

调度、队列、唤醒、Task/Mission/Session occurrence（执行轮次）、重试/重启与消息数据流不进入此次产品改动；没有新共享异常，不声称对应全矩阵通过。testResults连接反馈独立候选明确延期。没有改变LLM调用、模型codec或流式路径，删除表单限制的资格不需要重新使用私有Provider推理；若发现与实际模型路径相关的缺陷，再沿既有授权执行fresh完整配对auth/models、三项预检及精确流式身份检查，绝不只复制auth或刷新副本OAuth。

## 实施方案与验收合同

1. 产品只删除Panel空模型数量guard及唯一无用providerModelIDs import；helper ID解析仍保留。删除两locale失去生产引用的models_required，调整现有models_hint明确可留空/稍后添加或发现、保持完整ID与标签/metadata提醒。不增特殊Provider豁免、表单模式、backend gate、fallback、影子状态或新协议。数量空集合不需要第二校验源。此必要删除属于本次修复，不扩大无关清理。
2. 先运行修改前实际源backend /ui，Node冻结当前前端，不单独Vite；清空重建独有HOME/XDG/data/project/managed/env。自有18590/18591及随机虚构Key参与者，只服务registry/discovery，不模拟LLM或合成消息。全局/项目分别编辑0声明名称/有效API，actualUpdate阻挡与HTTP/持久化事实对照，至少一张与目标绑定的前态截图人工查看。所有服务仅正常stop自有owner，未知用户端口不复用，不杀用户进程。
3. 聚焦纯数据provider-form正向测试增加：新建空/空白集合的完整定义；absent与{}名称/API/env准确保真；空→空保留并发模型及options；显式清空保留peer新增；空集合ID冲突/地址错误保持原类型。旧helper本来应通过，只证明数据兼容，不冒充UI修复红绿。没有组件、DOM、源码文案、快照或浏览器自动化测试。后端优先直接相关现有bootstrap/credential合同及必要新公开Config/Provider正向合同；实TCP检查global/project创建/回读、目录继承、引用400与实际source，不用mock/static字符串替代真实路径。
4. 后态真实桌面矩阵：两scope零声明仅改name/API/env保存→重开→实际Config回读；models-only缺席API改名；新建空声明（无Key及填写虚构Key）→行→显式发现→保存IDs；清空最后一项未引用custom模型→重开；目录继承与同ID覆盖恢复；project覆盖删除恢复global；旧表单期间通过正常HTTP新增peer模型/改options，保存只改name保留完整metadata。被引用唯一custom模型清空保持实际400与精确错误。普通1模型编辑为对照，取消与scope切换保持原退休。每次截图人工查看，必要视觉修改后重新截图；中文/英文可留空说明、0数量与Details/发现/保存控件保持密度、语言和键盘语义，不扩移动端。
5. UI资格完全由主agent实际CUA交互、截图及人工复核，不引入自动断言/网络拦截/fixture/像素基线。TCP探针只调用实际公开业务接口与读取自有source，不操作页面；完整数据输出/状态/typed error是其验收。长期过程按确认活跃的原handle检查，不能以观察超时重启；服务lifetime为owner边界，不把总时长当功能失败。原失败日志保留，工具/夹具本地问题先修再跑原检查。
6. 完成后更新06-provider唯一声明/运行合同、必要Panel契约与根CHANGELOG双语未发布说明；本spec/artifact/根月索引同步当前docs:check。精确Node source格式、Overlay/backend types及最终NodeUI build只作工程检查，不代替视觉。范围普通commit、fresh fetch/merge、完整pending归属和验证、normal push全钩子；保留所有并行worktree/staging，不rebase/force/no-verify，不Release/tag/PR。原push终态、远端own ancestor及物理owner收尾之后进入下一批，goal保持active。

## 新前态发现的共享空对象写入语义（产品修改前补充）

Node前态原28977实际exit0，fresh before PID78132/process win32:639275023593527385/occurrence89064a45-1547-4573-8b96-f8b0e4d76891在18590/18591提供真实/ui。全局英语只改name、全局中文合法api、项目中文合法api三个实际Update均被旧guard阻挡，三图已人工查看；source与HTTP200回读仍为原name/各自api，未把草稿当提交。

inspect原e9e925实际exit0证明，初始化通过Config.updateGlobalPatch提交models:{}后，bootstrap source仅name/api，models-only source只name；后者因此是不可达纯name行，被catalog列出Configure。isCustomProviderConfig本来正确接受显式object，不能把此夹具现象归咎predicate或把提交输入称已持久事实。功能agent原95584实际exit1：13项9pass/4fail、53断言；global/project各自的models-only新建和absent→{}实际HTTP200却省略{}，保持完整正向期望，没有改预期掩盖。继承/清空旧覆盖/Auth保真/模型与agent引用400/项目恢复global九项已绿。纯helper原1cb8a6实际exit0，21项61断言，只证明已有数据语义。

根因在config.ts现有patchJsonc的record分支：仅递归遍历成员，不将缺席或非object目标先建立为{}。空record没有成员，因此不产生任何edit；非空object要替换scalar/array时也缺少这个共同起点。唯一内存primitive mergeWithNullDelete在target缺席/非record时直接返回source，同样未递归处理object成员，nested null deletion可能保留为数据。两者自保留基线65d0bfc98即存在；此前395仅处理Source/有效层与默认物化、明确未改RFC7396，不是这个写入缺口的修复。

权威合同已查[Internet Engineering Task Force（IETF，互联网工程任务组）RFC7396 §2](https://datatracker.ietf.org/doc/html/rfc7396)：object patch先把非object target转为空object，再逐项递归；null是删除标记。RFC编辑站首次读取超时，随后IETF原文已读，不把失败请求当内容证据。本批按该原有声明合同修复，不加空Provider特例或把{}改成undefined。JSONC保留注释的文本edit与内存数据merge是两个表示层，继续复用现有各自primitive及同一合同，不增加fallback/第二配置面。

横向影响：patchJsonc仅由唯一writeConfigFile的JSONC分支调用，两个生产writer为canonical project/global，覆盖公开PATCH、CLI/Skill/Provider等同writer消费者；初始化空对象及已存scalar/array转object都应准确。内存primitive用于mergeOverlay、previewOverlayUpdate、mergePatch及writeConfigFile的非JSONC分支；后者两canonical生产caller总为.jsonc，未发现本批独立.json写入入口，不为兼容另增路径或扩大删除。mergePatch当前全仓仅定义、不是新增测试可冒充真实调用；测试它只作primitive合同补充。mergeOverlay/preview实际消费者包含effective Config、Global Chat preflight、global creation target、Session.prepareConfigOverlayMergeInProject、Task snapshot/配置消息、Mission提交/恢复、右侧Chat/普通Session入口及panel工具。全仓调用已读；这些consumer都继续经原Overlay schema/模型引用/profile/metadata ownership与提交边界，不改运行调度、owner、队列或消息。

真实持久Session合同还明确assertNoStoredConfigOverlayNull；合法nested null用来删除当前override，原primitive缺target时遗留null会在有效schema/储存完整性边界失败。应验证preview current空/已有override两种都形成无null的明确nextOverlay、继承base正确；direct mergeOverlay仍按RFC删除base字段。这是已分析的数据契约问题，不是已观测的调度或终态异常；不因此省略所有生产入口审查，也不假称完整运行轮次/重启矩阵已通过。

新增实施动作（必须完成）：JSONC在record递归前读取该path当前值，仅缺席/非record时用原jsonc modify/applyEdits初始化{}，原record保留成员/注释与每项null删除；内存merge仅以source类型决定整体替换，record source从target record或{}开始并递归全部record值，保留原clone/array替换与null删除。不得跳过candidate/source验证。与395共享config.ts仅这两个primitive的精确hunk，Source/defaults/Skill类型保留。

新增资格：两个scope真实HTTP新建明确{}、models-only可编辑、已存options.metadata scalar→{}及nested null→明确空对象；原record加{}继续保留旧成员，不能误解为清空旧object。纯数据补direct merge/preview删除override恢复base与typed合法options深层merge；实际Session configOverlay公开管理路径至少覆盖nested null的metadata持久事实。相关已有Session/Config正向合同聚焦检查，任何实际调度/恢复异常立即升级完整共性审计。由于现在触及全部LLM有效配置消费者，必要Sol改为必须重新做：fresh完整paired auth/models、启动前三项预检、真实公开preflight/Chat与所有reader200/stream/eof、真实物理exit及配对清理；仍不进行复制OAuth refresh。

## 当前状态

本节保留修改前状态：当时分析完成、实施待执行。实际结果以以下收尾记录及原证据为准。

## 实施、验收与交付范围（2026-10-14 收尾）

唯一 Panel guard 和无用 import 已删除，两语言旧错误键删除，原 hint 说明可稍后添加/发现及继承保留。helper、模型运行准入、Auth、真实消息与流式路径保持原 owner。两个共享 primitive 已准确落地，但并行配置 owner 在 `9438501d5d6eaa627cd7276d481f1dfc2696b7b1` 先行集成了这两段：patchJsonc 当前2600–2610与mergeWithNullDelete2634–2635/2639，git blame及当前零diff已核验。本批不会重复改写既有提交；本批余留范围为 Panel/两locale的provider字段、两组正向测试、唯一架构合同、根更新日志、规格与脱敏验收。395 Source/defaults/Skill改动和其他并行 ACP/FileExplorer/表格/Session改动保留。最终提交以私有精确index从当前HEAD派生，locale仅Provider字段，不能混入新增explorer.root_directory。

红绿证据：helper原1cb8a6 exit0、21项61断言（已有helper本来正确，不冒充UI红绿）；backend原95584 exit1（13项9绿4红）及5296 exit1（18项10绿8红）明确发现空对象写入/深层null；修复后42617 exit0（18项68断言），最终74714 exit0：新24项92断言、Conversation1项3断言、Mission2项3断言。合计48项159断言。所有核心断言是明确值/错误合同，没有UI自动化、mock或源码文案测试。shared primitive原24目标在943之后未变；后续并行提交未被冒称同一次全HEAD验收。

真实生产TCP：前态4d2ffc exit0的12响应证明旧source遗漏；后态a87fc8 exit0的12响应完整比较global/project新空对象、scalar替换、空成员及nested删除；额外5f2b7a exit0的8响应覆盖array→{}与record+{}保留成员。Session公开创建201、configOverlay更新200及持久GET共6项由f70793 exit0核验，缺席/已有override的null都得到明确nextOverlay.prompt:{}并继承base，原project source保持。固定protocol12只在fresh source执行一次；额外probe使用独立ID，不重跑已变更目标伪造fresh预期。

真实桌面：主agent亲自使用后端/ui与Node冻结前端、英语/中文共30张桌面截图（3前态、27后态），覆盖global/project空name/API/env保存重开、models-only无API改名、absent形态保留、新建无Key/有样例Key、发现返回ID再明确保存、清空最后未引用项、旧空表单期间HTTPpeer新增完整metadata、catalog2模型继承、项目同ID覆盖删除恢复global、两scope引用400、普通单模型编辑、取消重开及scope恢复。每张原PNG人工查看；中文hint单行/英文两行与原textarea/Discover/保存控件密度清楚。project 400图完整显示响应body/providerID/modelID/requestID；global400图只覆盖请求摘要及部分details，完整错误由真实AX与后续source回读补充，不将裁剪外内容声称已截图。没有移动端交付。before tab24/after tab25均正常关闭，只操作自有页；前态86586及后态61692原handle实际exit0，before PID78132、after PID86192 occurrence见ready/physical；18590/18591/18592实际listeners0。

必要Sol：原58357实际exit0，fresh完整相邻auth/models配对，authority-ready分别确认凭据available、目录projected、目标/API都是gpt-6.1-sol；empty-config-ready证明真实writer持久{}和overlay归一化后再执行。实际preflight及Chat接受202，最终assistant READY。四个真实Provider请求全部200、streaming=true、精确API模型gpt-6.1-sol、reader settled/eof，分别Chat与Memory原参与者；不是mock响应。PID67544实际exit0、18592listener0后父进程清除两份副本，没有refresh复制OAuth，也无私有内容进入spec/artifact。

工程：Node前态28977、后态38752、最终hint版本9364均build exit0；Overlay56421和backend12424 typecheck exit0。最终docs/source格式与标准commit/push按原流程收尾；这几个检查不替代上述视觉证据。当前文档操作同步根/月/artifact索引，最终实际日志归档。

工具修复而非产品失败：样例Auth为generation/info envelope，首次CUA fill undefined在输入前拒绝，随后使用真实info.key；早期scratch redaction也据此修正，17个已有records脱敏，再做全archive已知真实/样例credential字节扫描。global peer原expected遗漏现有Zod temperature:false/options:{}，初始checker exit1原日志保留；只修有效预期，source完整metadata预期不变，再跑e06412/00b74c exit0。原protocol与Session合同没有改预期掩盖失败。一次Advanced span键盘focus失败在动作前拒绝，检查真实DOM后点击原summary正常展开，未添加产品补丁。

边界与下一批：空声明保存不承诺推理可用或隐藏继承；GET→PATCH同字段并发仍非CAS。无Key保存即时catalog观察未重读是既有边界，真实global新建图显示暂不可用、后续Key保存重读确认；项目HTTP新增引用声明初始页未自动更新，显式Provider刷新只更新目录，重开自有页才读到新config；这是明确下一批调查输入，未伪称本批解决。IPv4新建自动ID显示0，显式ID及冲突合同仍有效，也是下一批候选。testResults语言候选延期；未发生调度/终态异常，不宣称完整Task/Mission恢复矩阵。最终Git原handle、完整pending审查、normal push/ancestor证据保存自有delivery.json，并在下一批Recall承接，不使用自变源码摘要验收。连续目标保持active。

最终收尾补充：current HEAD3c5adc5bf上的聚焦三文件原23333实际exit0，仍24/92 + 1/3 + 2/3；format-final原f4d9ca exit0，docs-final原e1e5fd exit0（348 ops/26 groups）。归档工具首次把截图数手算为28而实际为30而exit1，已逐文件核对3前态/27后态，移除这条无功能意义的数量门，保留实际清单并修正说明；不是页面失败。archive最终已知真实/样例credential内容0、实际四请求合同全绿；实际listener-settlement复核三个端口0。
