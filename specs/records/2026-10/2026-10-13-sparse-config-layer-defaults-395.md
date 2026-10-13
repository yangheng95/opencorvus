# 395 稀疏配置文件默认值与层级继承

## 当前交付状态与证据入口

配置根因修复的最终后台合同58项/165断言通过，Root独立重跑29项/91断言为其中重复确认。真实Scope01配置Base/Ask继承与Settings通过，但Main缺少批准投影，页面allow_once、read成功及最终回答未完成；原native exit1及closeBy迟28.830秒必须保留。完整checker未运行，后端退出后只读终态仅用于保留事实，不是端到端成功替代。证据已按明确允许清单归档到[395证据目录](../../artifacts/2026-10-13-sparse-config-layer-defaults-395/README.md)。以下调查/准备/后台阶段的“尚未执行”均按原历史保留，最终状态以本节、真实scope01结果和归档原记录为准。

## Recall

用户持续目标要求先分析根因/影响、落盘方案，再有证据实施和验收。root在393 scope02观察到Global Chat项目GET/config为dynamic而Session overlay为base；授权本395独立调查，不能凭注释或名称认定缺陷。范围覆盖全部Global/Project/Session/Task/Mission/CLI/Settings配置入口、raw/effective及writer契约、嵌套默认、历史/现有测试，并核查当前Zod权威语义。只写本spec与 `.tmp-sparse-config-layer-defaults-395`，不改生产/测试/共享索引，不启动服务/模型、不读取真实凭据、不浏览器或委托、不提交。

已读AGENTS、当前05-config、393真实scope02配置/202回执、config.ts全部source/read/merge/writer边界、effective.ts、PromptProfile schema、PermissionAuthority初次策略、GlobalChat创建、Task配置快照、Session overlay、Mission/Settings/CLI调用。全仓搜索Config.get/global/getGlobal/getProject/snapshotForProject、所有write/update/Info parse、同义默认投影及历史决策。当前config生产路径没有本agent未提交改动；并行任务文件不碰。调查期间没有实际调度、队列、恢复或终态异常，配置策略消费者不等于发生新的调度事故；若后续实测出现则立即按共享机制横审。

## 当前证据与待完成分析

393 scope02的真实global文件和原native项目均显式base；Global Chat返回的Session overlay仍为base。新项目真实文件仅terminal和后续MCP entry；公开GET/config返回dynamic。`load()`对每个非空source使用完整Info.safeParse，PromptProfile默认dynamic被注入后作为项目层merge；GET/config是项目合成基础配置，EffectiveConfig随后再merge Session overlay，因此该例没有证明实际Chat选择已改变。所有原live失败/关闭证据继续归393，scope03Provider overloaded不作为395验证。

代码候选影响包括global permission_mode=ask被无关非空项目文件的默认full_access覆盖，以及experimental/terminal等嵌套对象缺省值覆盖既有字段。PermissionAuthority.policyForSession首次直接读取Config.get并保存模式；已保存Session策略沿原持久化值，不得声称此问题会自动重写每个已存在Session。须继续以完整加载输出和明确输入验证，而不是仅凭默认声明。

## 有界纯配置探针计划（无服务、无凭据）

只在自有scratch创建公开JSONC样本和独立runtime/managed/project目录，OPENCORVUS_HOME及managed目录显式指向该根，不复制auth/models，不触达用户项目。清除会影响样本的custom/config-dir/inline环境入口，git目录向上边界限定到本scratch，避免父仓库配置参与。使用生产 `Config.snapshotForProject` 的readOnly路径读取这些公开文件；该路径不建立Instance、不启动Provider、SDK或HTTP，不安装插件；样本不声明plugin/provider/外部路径。另调用生产Info与实际merge primitive辅助核对嵌套默认，不冒充完整加载。

单一前台Bun1.4进程固定60000ms上限，记录PID/开始/原截止/完整公开输入与选定输出，结束清理自己的timer；不kill其它进程，probe不含模型/服务请求。运行前后保留样本文件事实，stdout/结果写scratch。该探针仅证明配置数据流；正式runner正向测试、公开HTTP、Settings与真实模型验收均未执行。实现方案待全入口、历史和该证据收敛后补齐，当前不实施。

## 实测结论：存在共享文件层解析缺陷

不是仅凭393 raw/effective名称差异：本轮直接调用生产 `Config.snapshotForProject(directory)`，使用真实公开global/project JSONC文件、同一个生产readOnly loader、实际source revision读取和原merge primitive。进程PID86520，原60000ms上限，实际2635ms结束，退出0。9组结果完整保存于 `.tmp-sparse-config-layer-defaults-395/probe-results.json`，原命令stdout为probe.log/exit。无auth.json/models.json存在，无Provider、MCP（Model Context Protocol，模型上下文协议）、HTTP（Hypertext Transfer Protocol，超文本传输协议）或浏览器服务。

全局固定值：profile=base、permission_mode=ask、auto_question=false、memory的document/input/pending=5000/16000/50、terminal public profile.args=["-NoProfile"]。

| 项目原文/设置 | 当前生产输出 | 正确继承合同与影响 |
| --- | --- | --- |
| 文件缺失、空串、空白，3组 | base / ask，其它全局值保留 | 当前正确，对照成立 |
| `{}` | dynamic / full_access | 没有项目覆盖值却改变两个全局值 |
| `{username:"public-project-user"}` | dynamic / full_access | 仅保存无关用户名也改变profile/初始授权模式 |
| experimental.openTelemetry=true | dynamic / full_access，auto_question=true | 开启遥测额外改变全局等待提问策略 |
| experimental.memory.enabled=true | dynamic / full_access，auto_question=true，memory=10000/32000/500 | 一个布尔开关覆盖三个已有预算 |
| terminal.public只提供command/label | args=[]；env.MODE仍保留public | 缺省数组覆盖全局参数；空默认对象经deep merge却保留既有env，不能把所有默认对象都称为相同影响 |
| memory.organizer_input_token_budget=12000 | ConfigInvalidError，关系校验失败 | 与实际继承document_limit5000组合时12000>5000+2000合法；单层先注入10000并比较12000>12000，错误拒绝 |

探针有8组解析完成、1组返回预期观察到的明确ConfigInvalidError；“exit0”表示调查按计划完整记录结果，**不是修复后的9项成功测试**。这比393仅profile一例扩大了经运行证明的影响，但仍没有运行实际权限调用或模型行为，不能宣称已观察到真实工具绕过确认。

## 单一根因与完整数据流

`config.ts:323–326/1893–1898`仅对缺失/空白source返回稀疏空对象；任意非空source，包括`{}`，进入`load`。`load:1953–1967`使用完整`Info.safeParse(data)`并把**输出配置**当作source layer返回。`loadStateOnce:380`已经用`Info.parse({})`建立最终配置默认种子，之后global/custom/project/config-dir/inline/managed依次merge；项目层解析补出的默认因此被误当作较高层明确声明覆盖。缺省与显式默认值在进入merge前失去区分。

写路径也有同一错误：`parseConfig:2570–2597`完整Info.safeParse；`writeConfigFile:2714–2748`把该结果作为currentWritable/candidate传入`resolveProjectCandidate`或`resolveGlobalCandidate`。JSONC补丁本身只写显式patch，**通常不会把两个隐式默认直接写入文件**；错误出现在读结果、候选合成和currentWritable的形状。仅改reader会保留“公开PATCH候选与冷读不同”的双源，必须同批覆盖两个解析入口。

第三表现是跨字段关系提前在孤立文件上校验。Info中的memory.superRefine读取该文件补出的默认document_limit，尚未合并真实global值。只把safeParse输出按输入keys裁剪，或者仅删除prompt_profile/permission_mode，也修不了已被拒绝的合法配置。应重排source层与有效配置的验证/默认物化边界。

原始文件指canonical JSONC事实；`Config.get()`虽常被变量命名为raw，实际是多层合成且已物化默认的**项目基础配置**；`getGlobal/global`是全局有效配置；`getProject`注释承诺project-owned writable值，却目前也经load得到虚构默认；`EffectiveConfig.effective`再叠加root Session overlay。不能将raw理解为未解析的源文件，也不能拿Global Chat overlay保护profile推断其它项目字段安全。

## 当前Zod合同与不应采用的修补

仓库catalog及实际安装均为Zod4.4.3，mergeDeep实际库为Remeda2.26.0。已查阅官方[默认值说明](https://zod.dev/api#defaults)和[Zod4迁移说明](https://zod.dev/v4/changelog#defaults-applied-within-optional-fields)：undefined输入触发default，optional包装内的默认仍可能出现在解析输出。因此`.partial()`或添加`.optional()`并不自动形成保留缺省字段的文件层；`.prefault()`也不是关闭默认，它仍替代缺失输入。问题属于应用把有效schema输出误作覆盖层，不是Zod违反协议。

避免字段白名单删除、依赖Zod内部_def遍历的第二schema引擎、复制整份Info无默认版本、回退到global、强写项目profile=base、给LLM（Large Language Model，大语言模型）增加工具选择gate或修改PermissionAuthority。不得把legacy permission迁移生成的明确模式当作可删除默认；该迁移具有真实source_fields及审计记录。

## 定义、调用与入口矩阵

全仓调用搜索结果563行存于scratch/call-sites.txt，默认定义存default-definitions.txt；这包含测试命中，不能当作563个生产入口计数。调用按同一事实来源归组如下。

| 入口/消费者 | 当前数据来源与影响边界 |
| --- | --- |
| Global `/global/config` GET/PATCH，Config.global/getGlobal | 单一global文件作为最终global配置，应补全默认；这一行为必须保留。向Project投影global source时才必须保留其原声明稀疏性。global写候选还通过snapshotForProject评估已注册项目。 |
| Project `/config` GET/PATCH，Config.get/updateProjectPatch/getProject | 本缺陷直接入口。JSON Merge Patch的null删除应恢复继承；当前删除后文件仍非空又注入默认。getProject、atomic callback只能表示实际项目source值。 |
| Global Chat/Work首建 | `GlobalConversationService.preflight/create`取getGlobal并存model/profile overlay。393首条/后续profile被base overlay保护，但Permission、terminal、memory不在Overlay允许范围，不能同样保护。 |
| 项目内Chat/Work首建及公开Session | right-sidebar-conversation路由的初始overlay通常只有显式model；公开Session route及prompt解析读EffectiveConfig，未覆盖字段仍受项目基础配置影响。393第二条byteProject修复与此独立。 |
| Task本地/global创建、Task后续输入 | task-api创建用EffectiveConfig.snapshotCurrent或global resolution seed，并冻结配置选择/初始overlay；显式专家包/模型能固定对应字段，但不能反推整个基础配置正确。现有不可变Task请求、package revision、恢复快照不得重写或迁移。 |
| Mission及子Session | Mission路由以Config.get与持久overlay做preview，session.ts持久initialConfigOverlay；EffectiveConfig沿root lineage合并，未被允许overlay覆盖的字段依旧来自Project。运行控制/恢复owner不改。 |
| CLI（Command Line Interface，命令行界面） | debug config、MCP/auth等直接Config.get；run经公开Session create/prompt，专家包/模型显式参数只影响其自己的字段；network/upgrade直接global不构成项目层覆盖。CLI MCP writeMcpConfigEntry同一canonical文件、下次读也触发本问题。 |
| Settings/Composer | Overlay服务patchConfig/patchGlobalConfig发稀疏diff；permission-mode按当前project写同一policy字段，appStore投影GET/config。保存MCP、terminal或任何无关项目设置即可引入此错误，不能在UI逐字段修补。实际Settings页面尚未验收。 |
| PermissionAuthority | authority.ts:231–258首次policyForSession读取Config.get.permission_mode并持久化。global ask→隐式full_access会影响尚未建立策略的新Session；既有行直接读取，不在本395推定或改写其历史策略。 |
| Question/Memory/Terminal | question与orchestrator读取auto_question；memory预算来自experimental.memory；terminal.profile消费args。探针证明值改变，不等于已经运行等待超时、Organizer或shell命令。 |
| Provider/catalog/Skill/MCP | 这些消费者用完整Config做派生投影；Provider的Info.parse完整snapshot属于正确默认/校验边界，不应全仓替换。getProject用于MCP定义来源和删包检查；atomic writer用于Conversation capability/Provider removal/Skill mounts，需按source形状检查调用合同。 |

所有文件层覆盖remote well-known、canonical global、OPENCORVUS_CONFIG、自有project、OPENCORVUS_CONFIG_DIR、inline和managed；本轮实跑global/project，其它层同一load/merge定义已证实，未调用网络或企业目录。GlobalExecutionCapacity是global独占，Project声明仍必须按当前所有权错误拒绝；本批不改变配置层优先级、能力归属或锁序。

默认影响横向：top-level prompt_profile/permission_mode已有实证；experimental.auto_question/memory三预算、terminal.args已有实证；terminal.env空对象未覆盖旧键的对照已证实。PrimaryAssistantCapabilities的空数组是project-owned字段，不能套用“可配置global继承”的虚构样本；应保留最终完整配置的数组物化。Config.Keybinds虽声明很多default，但不是当前Info字段，不据此夸大本缺陷范围。Provider/model、Agent runtime overrides、MCP类型等嵌套schema须在正式正向测试中继续保持已声明类型/正规化合同，不为本修复放宽合法性。

## 历史与已有测试为何未覆盖

- load的Info.safeParse/return parsed.data已存在于当前可追溯基线65d0bfc98（2026-08-07）；不是393新增。
- 43636df96引入统一两模式permission配置后，同一旧层解析问题会涉及full_access默认；不能把策略设计本身定为根因。
- ab2860df2/830204e0调整空对象/$schema写回，防止读空文件生成业务配置，未改变非空层的schema默认注入。
- a8865f4de与[2026-09-15记录](../2026-09/2026-09-15-global-config-defaults.md)修复缺失global文件发布缺默认：仅在loadStableGlobalState加Info.parse，既有6项global测试覆盖absent/blank/{}及首次atomic write；当时明确将架构稀疏保证限定缺失/空白，未测“全局明确值+空对象/无关项目字段”。本395应保留其最终global正确行为，补足每层声明语义。
- b71986073将默认profile改为dynamic，使393观察到base/dynamic差异更明显，但换回base只会遮蔽其它字段错误。
- config-peer-convergence验证generation/跨进程事实；candidate-status测试多处显式profile=base；permission-two-mode直接updateProjectPatch写模式。它们没有检测从global ask继承且仅写无关项目字段的路径。

检索到的有关测试均为后台合同测试；本轮未运行、修改或新增任何UI自动化测试。官网config文档仍有旧permission/热重载叙述，与当前架构存在已知时效差异，395以当前代码和05-config为契约，后续文档交付由root统一处理，不在只读调查中顺带改站点。

## 建议最小单源修法（待root批准）

限定根因在 `config/config.ts` 的source/effective分界，复用现有ConfigPaths解析/替换、legacy迁移、source revision、mergeConfigConcatArrays、Info schema、mergeWithNullDelete、JSONC writer与candidate-validation；不要修改Permission/Task/Mission消费者来弥补错误值。

1. 文件/inline读取和writer的JSONC parse返回**声明层**，保留显式缺省/空对象与真实迁移字段；用适当source类型取代把稀疏对象断言成完整Info。最终公开get/getGlobal及模型消费者仍拿完整Info。
2. 合并前不把独立source送入完整Info默认/跨字段验证。按当前顺序把source合入已经累积的低层配置，再使用同一Info schema正规化、默认物化和校验；错误仍以当前源路径和ConfigInvalidError/具体issues呈现。逐个累积边界验证可保留“非法低层不能靠高层隐藏”的现有约束，同时使项目关系校验看到真实global值。global-only发布、project read/snapshot、候选override共用相同有效物化边界。
3. writer的currentWritable/getProject保持实际source字段；candidate用同一完整layer resolver验证后再原子persist原patch文本。Global atomic回调的currentGlobal仍是完整有效配置，currentWritable应是源文件字段，不能二者都注入默认。如显式字段有trim/变换，应在合成验证后保留该显式字段的正规化值；不可把默认补出的其它字段回填成source。当前JSONC注释、null删除、数组合并专例、严格未知字段、legacy迁移、项目独占限制全部保留。
4. 空global最终输出继续Info默认；显式设置dynamic/full_access、false/0/空数组仍是用户决定，不能按值等于默认就删除。已有Session permission policy/Task请求/历史snapshot不迁移，新读取和新准入采用修复后的层级事实。

这是一个解析/合并顺序修复，不需要第二套配置、字段白名单或新运行时。预计生产中心为config.ts；只有source类型变精确后编译证明直接调用者需要调整时才列明必要范围给root审批。getProject/atomic writer以及mcp source身份需正式验证，不应为减少diff而保留错误的Info类型或另一条旧解析路径。

## 正向验证与交付计划（尚未执行）

实施前先正式Bun1.4隔离runner红测，最小后台测试应进入真实canonical文件与Config.get/global/getProject/snapshot/public handler，不mock parser/merge/store。当前纯probe不是formal测试，不可挪用其exit0作绿测。

| 合同 | 必须明确输出 |
| --- | --- |
| 源存在形态与优先级 | absent/empty/whitespace/{}、只username/terminal/MCP的Project在global base/ask下都继承base/ask；显式project dynamic/full_access精确覆盖；删除该显式key后恢复global；同进程重读与新进程冷读一致。 |
| 嵌套值 | auto_question=false保留，memory5000/16000/50保留，terminal参数保留；显式false/0/[]按原schema/merge合同正确返回。允许global document5000+project budget12000；真正无效有效组合返回同ConfigInvalidError issues。 |
| writer等价 | 真实PATCH config/global、atomic回调的effective/source各自形状，persist文件只含真实patch；冷读结果与precommit candidate一致。global无源输出仍为完整默认，原global-defaults测试按澄清后的currentWritable合同调整。 |
| 全层/错误 | custom/config-dir/inline/managed稀疏层、remote输入使用受控公开fixture；源类型/未知键/MCP builtin/Agent prompt模式/项目独占execution_capacity仍为明确错误。数组plugin/instructions/skills去重追加与其它数组覆盖保持。 |
| 权限真实消费者 | Global ask+无关Project设置，创建真实新Session并通过现有PermissionAuthority产生mode=ask请求，真实reply allow_once后得到确定工具结果及policy行；既有full_access策略行按原合同保持，不能写迁移。无真实外网/凭据。 |
| 公开会话/项目 | Global Chat与项目Chat/Session的真实配置overlay/基础配置、Task/Mission配置预检按各自入口验证；两个独立项目不同明确覆盖保持隔离。不要重写不可变请求或引入模型路由规则。 |
| 关联检查 | config-global-defaults、config-peer-convergence、config-candidate-status、execution-capacity-config及permission-two-mode中相关正向范围；config-catalog/skill lock-order仅在触及generation/writer调用顺序时复跑。核心typecheck与文档检查。 |

后台通过后由root决定fresh真实HTTP/桌面与必要GPT-6.1 Sol范围：正常Global Chat/Settings先全局base/ask，在真实项目保存无关设置，GET/config与会话有效配置正确，发一条自然只读消息并在真实权限请求上人工确认，观察最终完成。页面截图、语言与真实授权交互不能用源码/DOM断言替代；模型验收仍需独立pair/preflight/预算/原owner收尾。若后台充分证明数据层，本修复不要求覆盖所有专家包的真实模型运行；必须说明具体真实入口和未覆盖项。

任何出现的真实generation/并发/恢复/终态异常须保留原失败并按AGENTS全横审，不能当本配置样本偶发；本轮探针没有此类异常。本agent本轮仅调查/落spec，root接手范围审批、共享索引/架构/CHANGELOG及最终提交推送。

## 当前交接状态与风险

结论为确证bug，影响范围由真实源文件和9组生产loader输出限定。根因包含默认注入与跨层关系提前验证，最小方案须同时覆盖read和write candidate；仅修profile显示不充分。纯probe自有进程已正常退出0、timer清理，样本/日志保留；安装库版本读取首次通过package exports读取remeda/package.json被拒，随后直接读取已安装公开package.json确认2.26.0/4.4.3，该辅助元数据错误不影响probe，未作网络安装。

风险是改变当前原本错误但可能被依赖的implicit默认覆盖；应在更新日志明确“未声明项目字段继续继承全局，显式项目覆盖不变”，不能自动写一批旧项目配置模拟旧行为。历史Task/权限快照是事实，不自动追改。源码叶值正规化、invalid source命名错误、source/effective类型及原generation一致性必须在正式实施验证，当前方案没有宣称已经解决它们。

未执行：任何修复、正式红绿、public HTTP、实际权限effect、UI/下载、真实Provider以及共享docs检查。当前新增只有本spec和自有scratch；相关共享索引由root负责，未提交/推送。

## 实施批准与红测前精确方案

root已完整review本Recall/9组probe/调用与历史，并批准生产仅config.ts，新增一个集中后台正向测试及触及的过期后台期望；先正式Bun1.4 runner红测再实施再绿测。已保存config-before.ts、空config-before.diff以及工作区/index全部原diff和status到自有scratch；不改变或归档无关diff到本批公开证据。

具体采用单一Info schema对**当前累积低层值+当前source**进行校验/正规化，再仅将source原先实际提供的字段投影为声明层参与合并。该字段投影不是裁剪独立safeParse输出：Info验证之前已合并真实低层，故12000/5000跨层关系可正常判断。数组保持原原子/专例merge语义；没有Zod内部遍历或复制schema。config.ts内部需要一个明确Source类型及同一“有效校验→显式字段投影”小函数；不引入新文件/运行时/配置source。

reader向load传当时累积base；global完整发布仍materialize最终默认。writer必须用现有resolveProjectCandidate/resolveGlobalCandidate取得对应source在完整环境中的有效值，再将显式字段提供给currentWritable/getProject；现有file/catalog/generation owner次序和最终candidate preflight保持。getProject不能继续伪装成完整Info。global atomic回调分清effective完整与writable稀疏；已有global-defaults的writable={}期望需要随本公开source合同纠正。所有必要类型传播限定同文件；若编译证明必须改外部消费者，将先报告root，不扩大权限/session实现。

集中测试进入实际Config source读取、Project/global writer及公开Config Hono handler，含9组probe等价、显式覆盖/删除、叶值正规化、未知字段/错误类型、currentWritable/getProject、Global空源以及实际PermissionAuthority正向授权请求/回复。无Provider/服务/模型/凭据或UI自动化；成熟memoryProject/正式runner在finally管理自身资源，原异常必须保留。

正式红测before.log/exit已完成：20项6 pass/14 fail/20断言，exit1，29.97秒。预期错误包括{}和无关字段覆盖、partial terminal在继承前缺command/label被拒、合法memory关系被拒、writer/default形状及真实PermissionAuthority直接completed而非Ask请求。已退出的原handle29997为exit1，原日志保留。没有测试owner/调度/终态异常；权限回调仅返回public-result，不联网或真实副作用。随后才进入config.ts实现。

### 首轮绿测与直接类型调用者扩围申请

after-first.log：20 pass/51断言、exit0，44.74秒；真实继承Ask已产生请求，allow_once后持久policy为ask并返回public-result，所有source/跨层/writer用例通过。核心typecheck-first发现Source类型传播的三个直接文件：config/update-global.ts的currentWritable仍声明完整Info；conversation/capability.ts.assignment只读primary_assistant_capabilities却要求完整Info；provider/removal.ts.removalPatch只读模型/列表/agent却要求完整Info。这不是新的消费逻辑，错误证明原签名不符合现在已验证的稀疏source合同。

拟最小扩围仅三个函数输入类型：update-global的currentWritable改Config.Source；assignment接受其实际读取字段的Source pick；removalPatch接受其实际读取字段的Source pick。逻辑、权限、Provider行为和数据不改；不得用as Info遮蔽。另writeGlobalMutation的公开返回必须继续完整Info（在config.ts内部保留），不能让类型修复反向把公开global config响应变稀疏。已向root报告，未批准前不编辑上述三个外部文件；同时继续已授权范围的过期global-defaults writable期望和关联测试。

### 直接类型批准与源数组/Global null 边界自审

root已批准三个直接输入类型扩围，现仅将update-global currentWritable改Source、Conversation assignment及Provider removalPatch改实际读取字段的Pick<Source>，不修改任何业务行为。第一轮关联6 files全部exit0，包含global-defaults、peer convergence、public candidate status、global execution capacity、catalog lock-order、Skill recovery lock-order；没有owner/并发/恢复异常。

自审新增getProject.instructions的实际源归属断言：首实现使用追加数组merge构造正规化环境，虽然effective数组内容正确，显式source字段投影却带入global数组条目。source-array-before正式21项前版本为20 tests、19 pass/1 fail/52断言，exit1，失败原文保留。随后补writer数组归属与global null合同，boundary-before为21 tests、19 pass/2 fail/52断言，exit1。数组修法继续复用mergeDeep：正规化每个声明数组时使用本层数组值；现有mergeConfigConcatArrays仍只在真实层累积边界执行追加与去重。writer同样经parseSourceLayer正规化本层数组，不能从最终完整数组直接复制成currentWritable。没有字段名单、第二schema、Zod内部遍历或丢弃显式正规化。

第二条失败来自原assertNoInheritedGlobalDeletes：完整effective与真实稀疏writable一比较，将schema默认错误解释成“lower-priority file”所有，global={}的null删除prompt_profile因此抛GlobalConfigInheritedValueError。全仓只有此函数、NamedError定义和updateGlobalPatchAtomic唯一调用；当前loadGlobalConfig/resolveGlobalCandidate只读单一canonical文件，65d0bfc98历史基线也已如此，没有另一个较低Global文件所有权可验证。拟移除这段失效guard/错误定义，保持现有JSONC null-delete和最终schema默认；已向root报告待批准，不改其它锁序/权限或消费者。不存在的lower Global层不能用新影子配置或默认值关键字特判补成第二事实来源。

root补充review并批准：移除config.ts已失去真实lower-global来源的guard/递归定义/NamedError/调用；正向覆盖空global的null与明确base/ask清除回schema默认，不更改RFC7396 patchJsonc。第二次typecheck-inputs仅skill/manager.ts:934报Source→Info签名错误；root读全部7处install/path/url/git、remove、setPolicy与market-effect后，批准patchGlobal仅Pick<Source,skills|skill_policy>及applyPolicyToConfig仅Pick<Source,skill_policy>。两处都是输入类型，原业务/锁/恢复不变。Skill remove中的stillConfigured真实postcommit检查保留：它复查写后配置路径是否仍存在；错误文案仍声称lower-priority global，在唯一canonical架构下该归因不精确，本批不扩展其控制流，记录边界。

并行任务对config.ts的JSONC错误格式化修改（ConfigPaths.jsonErrorMessage与printParseErrorCode import移除）已识别保留，由root单独分配提交；395不声称这些行为是本修复，也不覆盖其相关测试/paths.ts文件。

boundary-after正式21 pass/59断言、exit0；两个新增源边界修复均进入真实writer/getProject/getGlobal。最新typecheck-final只剩Source类型自身对record键过度optional：skill_policy的z.record值必须为allow/deny，而DeclaredFields原映射让已存在值变为undefined可选，skill/manager:947触发TS2322。已报告root拟在同一DeclaredFields中区分string-index record与有名字段对象，保持record已有值的原合法类型，仅递归对象内部可选；无需运行时nullguard/as Info，不放宽schema。

直接消费者验证补充到同一集中测试：SkillManager真实公开路径样本install→setPolicy→remove→global文件/有效配置，证明其postcommit仍以真实清除结果完成；Provider removal使用隔离runner无任何真实凭据的公开未配置ID，验证source agent model清除与committed/credential absent回执。它们不使用网络/模型或外部服务；原所有安装/删除owner由生产finally结束，fixture目录由memoryProject处理。

root批准DeclaredFields的string-index分支后，typecheck-source-records正式核心检查exit0。Source仍从唯一Info的z.input生成：允许命名字段不声明，保留record已声明值的合法类型，不增加运行时guard。

新增直接调用者首跑direct-final：集中23项22 pass/1 fail，Skill install/policy/remove全部成功；失误是Provider测试声明了已被当前Info严格禁止的agent.public，真实ConfigInvalidError unrecognized_keys正确拒绝。原失败保留，没有生产回归或更改schema。修复本测试为现有合法agent.chat，并在同一用例验证provider record的公开name/timeout=false以及Agent正文真实source投影；补Skill allow→deny明确值断言。另global-defaults 6 pass/19断言、conversation-capability-route 4 pass/21断言均exit0。该路由测试只后台目录/配置/工具catalog，无UI操作或模型请求；其runtime owner按既有finally退出。

## 实施后最终后台验收与交付边界

当前395根因修复已经完成；前文“尚未执行/待批准”为当时调查阶段记录，不能解读为当前状态。所有原红测/类型错误/样本错误均保留，未覆盖或替写原文件。正式Bun1.4 runner最终以下8个直接文件共 **58 pass、0 fail、165断言**：

| 文件 | pass / 断言 | 证据与退出 |
| --- | --- | --- |
| config-layer-inheritance.test.ts | 23 / 72 | after-final.log、after-final.exit=0，35.78秒 |
| config-global-defaults.test.ts | 6 / 19 | direct-final.log该文件DONE exit0 |
| server/conversation-capability-route.test.ts | 4 / 21 | direct-final.log该文件DONE exit0 |
| config-peer-convergence.test.ts | 7 / 8 | related-final.log、整体exit0 |
| server/config-candidate-status.test.ts | 11 / 32 | related-final.log、整体exit0 |
| execution-capacity-config.test.ts | 2 / 2 | related-final.log、整体exit0 |
| config-catalog-lock-order.test.ts | 4 / 8 | related-final.log、整体exit0 |
| config-skill-recovery-lock-order.test.ts | 1 / 3 | related-final.log、整体exit0 |

注意direct-final整体exit1来自当次新增Provider样本非法agent.public，不能把该次整体说成成功；同文件中另外两个测试文件DONE exit0是其真实独立runner结果，集中目标样本随后修复为agent.chat并独立after-final全部23项通过。typecheck-source-records.log/exit为最后有效核心类型检查exit0；此前typecheck-final.log exit2只是过程名称，不能误当最终成功回执。最初before20项6pass14fail对应旧生产输入；source-array-before、boundary-before覆盖实施后自审收敛点，不冒充全部旧版本红测。

所有测试命令均先将Bun1.4目录加入PATH，再用package.json的`bun run --cwd packages/opencorvus test <明确文件>`；类型检查为同package typecheck。相应exec handles 29997、25628、28621、30807、59380、36195、63861、87153、39239、69398、3743、57219、38247均已回收实际退出码；没有测试进程、服务或凭据scope留待用户处理。未启动真实Provider或自有HTTP服务；实际PermissionAuthority仅用公开无副作用callback，但有真实Ask请求/allow_once/result/持久policy。没有运行任何UI自动化。

覆盖证明：真实文件source→低层累积→单Info校验→稀疏正规化→读写候选→公开Hono PATCH与最终配置；absent/blank/{}与无关值继承、嵌套cross-field、明确false/0/[]、新增Source类型、strict错误、proxy叶值trim、指令数组读写归属、null清除、两个项目隔离、legacy显式模式、Skill安装/allow/deny/移除、Provider已配置公开record移除和Work能力source更新。配置generation/跨进程/目录catalog及Skill恢复关联检查全通过；并不声称已重新运行所有Task/Mission或其它系统的恢复场景。

未覆盖：remote well-known/真实enterprise managed目录、Config custom path在本轮的运行样本，真实网络HTTP权限/UI交互、Global Chat/Task/Mission模型端到端。源代码对全部层均调用同一parseSourceLayer，正式test覆盖global/project/config-dir/inline；未执行层必须保留此范围差异。真实HTTP/桌面与必要Sol由root在自有隔离scope安排；本后台结果不能替代人工截图或模型验收。

本agent允许交接生产5files：config/config.ts（含唯一source/effective实现及死guard删除）和仅输入类型的config/update-global.ts、conversation/capability.ts、provider/removal.ts、skill/manager.ts；测试为新增config-layer-inheritance.test.ts与global-defaults一条过期期望；本spec与自有scratch。config.ts内并行JSONC诊断修改仍归root另一范围，不纳本批自有diff。没有修改shared README/架构/CHANGELOG，按委托不创建Git提交；root负责最终独立复核/归档/共享索引/提交及正常上游同步推送。

## 真实HTTP/Settings/必要Sol验收准备（root独占启动，尚未执行）

本轮root只授权395 scratch/spec中的方案和辅助脚本准备，禁止本agent启动服务、访问/复制auth或models、Provider请求、UI操作、生产修改和提交。复用`.tmp-product-iteration/live-sol-launch.ps1`及其唯一`live-sol-cli-owned.ts`/shutdown，QualificationKind=NativeService、builtin Base、RequestBudget=20、physical native deadline=600000ms、Provider inactivity=180000ms。不得另造runtimefactory、Task/Mission包装、复制大量runner或延长deadline。若root需要独立UI bundle，可沿393已审两处launcher适配：自有copy只替taskBun为已审private executable（相邻ui）以及PSScriptRoot指回原runner目录；本agent不创建或执行此适配、不复制binary。

最小真实场景不需要MCP服务。准备一份自有公开CSV放在本scope根目录（有固定标记CEDAR395、Maple3/Iris4，共7），确定位于Global Chat新项目之外。现有permission/invocation.ts将项目外read归为read_local，直接read是Chat当前通用工具；正常项目内read则无需Ask，不能把后者当权限验收。本场景只读公开自有文件，不涉及用户文件或写入副作用。

1. root检查18506端口自由，启动fresh `.tmp-sparse-config-layer-defaults-395/live-attempt-01/provider-run`，evidence置scope/settlement，prefix sparse-config-layer-defaults-395-live-01。原成熟wrapper先全局model/small_model exactSol+Base、native项目Base，成对stage既有授权OpenAI auth入口和完整models目录，分别核对credential usable/catalog projected/actualModel gpt-6.1-sol/streamingtrue；原native基准预检Session只算服务资格，不算395业务。helper只读取预检公开状态，绝不读取凭据/models。
2. helper读取已产生的launch-owner，断言exact scoped runtime/NativeService/600s/20/180s与同occurrence preflight。开始业务必须至少剩余240000ms（两个自然回合+root窗口）；原closeBy=nativeDeadlineAt-60000，pageReserveAt=deadline-180000。通过公开PATCH /global/config显式写permission_mode=ask、profile保持base，同时保留已投影exact model。这里改变的是自有隔离全局事实，不是固化项目覆盖。随后正常POST /global/chat/start只传requestID/text/model，202接受返回session/projectID/directory/messageID，原schema没有mode/target字段；首条自然“稍后给公开数据路径，请先确认”消息建立可导航Chat。
3. 接收返回后立即将ready URL/session/projectID/original deadline写ready.json供root开页；检查返回directory realpath属于owner.runtime/data/projects且目录真实，不能强绑native.project，不写metadata、不另造Session。此后每个项目HTTP调用的x-opencorvus-directory均用返回的实际directory，原文直传（server/directory.ts直接选择header后Filesystem.resolve，不做百分号解码；本scope根及分配路径为ASCII）；SQLite与sourcechecker也以该projectID/directory为事实源。
4. 首条真实assistant完成后，公开PATCH /config仅 `{username:'Config 395 public project'}`。读GET/config断言base/ask；读真实canonical项目JSONC并记录declared-keys及profile/permission所有权均global；此证明项目无关设置不注入默认覆盖。正常GlobalChat原创建可能带terminal字段，这些字段保留，不裁剪现有配置。Settings只展示此真实Chat项目Permissions/模型专家团选择，禁止为让显示通过点选Ask/Base形成项目显式覆盖。
5. root准备好页面后运行send阶段：原SessionID的公开POST /session/:id/message，stable messageID、agent chat、model openai/gpt-6.1-sol、自然文本要求读取自有绝对路径公开CSV并说明标记/两行/总计。只发一次，不注入工具结果或消息，不教host选择工具。请求前必须至少剩余180000ms；helper不会自动批准。root通过真实页面观察实际Ask卡片、请求工具/path/mode、点击仅一次allow_once；如果请求工具/路径不符合预计先保留真实事实并判断，不能自动批准所有请求。
6. read结果/最终assistant以规范消息与SQLite一致只读快照核对；PermissionPolicy应为该实际Session/project的ask，原请求行modeask/精确toolCall归属，真实requested→allowed_once→execution_started→execution_succeeded，tool completed正文含公开文件各行，原公开文件字节精确不变。检查同messageID真实user+最终stop/completed assistant exactSol、正常ledger allocation目标及projectID；Provider同pid请求累计≤20，每个request模型gpt-6.1-sol、streamingtrue、HTTP200、reader settled/eof，至少一个业务Session关联请求。只记录公开字段与selected audit信息，不读取/归档secret。模型自述不能替代文件/配置/账本事实。
7. root截图人工复核：Chat正常导航与真实会话、Settings显示Ask及Base、待授权卡片、批准后read输出与中文最终答案。至少预留约120秒真实桌面操作，原deadline-60秒前主动关闭自有tab并调用成熟shutdown `-PageClosed`；join原launcher，验证physicalCompletion/outputDrainComplete/requestCleanupComplete、native/host真实exit0及portrelease，之后由成熟owner精确删除本scope auth.json+完整models.json配对。不得手工杀用户进程/缩略为HTTP200已结束；失败仍沿原owner清理并保留原failed及审计。辅助checker只读、无长驻owner，不创建MCPserver。

原始scope不得盲重试、重置request budget或自动新建Session。没有足够窗口、Provider overloaded/非EOF、权限恢复/终态异常均保留原事实；涉及共享控制异常立即全横审。当前helper仅准备和syntax检查，不宣称任何真实HTTP/Settings/Provider结果。

### 准备完成的辅助文件与当前差异隔离

仅scratch新增`live-395.mjs`（start/send/observe，无permission reply API、无auth/models读取）、`check-live-395.ts`（真实只读SQLite+公开HTTP+selected Provider审计）、`LIVE-HELPERS.md`（root命令/人工页面/原deadline关闭），以及fresh live-attempt-01下builtin Base selection和公开CSV。尚未创建provider-run、launch-owner、任何模型scope或服务进程。脚本只做node --check和Bun.Transpiler语法转译，helper-syntax/checker-transpile/checker-syntax均exit0，绝不等同真实验收。已复查header协议为返回目录原文，不使用百分号编码；native deadline由host启动前固定，targetBirth后实际剩余≤600000ms（393历史公开owner差为599066ms），helper核对native-host-ready原截止而非误要求targetBirth+600000完全相等。

`split-config-hunks.mjs`只读本任务保存的config-before.ts与当前config.ts，回填原JSONC import及parseConfig错误格式化块生成config-395-only.ts；不还原Source返回/稀疏实现。395-config-only.patch为原preimage→395 variant（33hunks）；external-jsonc-after-395.patch为395 variant→当前combined（2hunks，只有printParseErrorCode import移除/格式与ConfigPaths.jsonErrorMessage错误格式化）。保存config-combined-review.ts及config-hunk-split-review.json；脚本不修改任何生产文件或Git index。external patch对当前工作区reverse --check仅验证精确hunk适配，不执行apply；parent应在最新HEAD/private index重新检查后按blob/hunk纳独立提交，不盲用过期patch覆盖并行内容。preimage与combined不是功能验收摘要；原workspace-before.diff仍排除公开归档。

真实验收必须由root下一阶段review并执行：预检/paired staging、两次自然用户输入、UI Allow once、只读checker、页面截图、原shutdown/join/paired cleanup。当前没有这些结果，不能把准备路径或syntax exit0列作完成。

## Root最终源码与真实验收准备审读

Root完整复核五生产文件、集中正向测试、read/write候选与source数组归属、Source类型、唯一Info校验及死global删除guard的范围。当前JSONC诊断已由独立提交`373d8682d`交付，config.ts最新HEAD包含其安全formatter/import；395当前差异仅为本source/effective实现，不再需要从旧preimage盲分patch。Root保留已提交的诊断实现，并未纳入本批新更改。其它compaction/process/SDK并行修改不在本批范围。

Root正式Bun1.4 runner复跑`config-layer-inheritance.test.ts`与`config-global-defaults.test.ts`，exec9353实际exit0，29 pass、0 fail、91断言，分别38.58/3.10秒。此为58个已覆盖独立测试的重复确认，不累加成87项。当前架构05-config已按唯一声明源/最终Info契约更新，双语Unreleased已编写，独立ops保留；真实HTTP与模型仍待执行。

Root已审读helper及checker全部请求、原NativeService launcher/wrapper/shutdown、实际canonical路径、GlobalChat allocation表、PermissionLedger事件和Tool结果投影。接受一个fresh self-owned scope：正常两轮GlobalChat，项目仅username稀疏PATCH，外部路径仅本scope公开CSV，通过真实页面allow_once批准read，readonly checker核对配置所有权、真实策略/账本/结果/exactSol全部200EOF。使用393已审私有launcher与相邻冻结UI，只有Bun路径和原helper目录绑定的适配；不复制或改runtimefactory/预算、不给helper批准权限，也不为Settings可见性新增项目Ask/Base覆盖。启动前保持原600s/20请求/180s无活动资格；原截止减60秒主动关闭，所有实际失败同样走原physical/output/request settlement和成对清理。

## 真实scope01结果：配置与Ask成立，完整验收未达成

Root已执行而非仅准备：NativeTarget88712、Host84240、occurrence `sparse-config-layer-defaults-395-live-01-f496abf4-d946-4025-9b30-6340012de09a`，原native截止2026-10-13T15:44:15.154Z、closeBy15:43:15.154Z。预检分别为credential usable、catalog projected、actualModel gpt-6.1-sol、streaming true，成对来源按原wrapper绑定。正常GlobalChat创建202，实际Session `ses_hxQa5jQTUbR8tnvMY6gA`、Project `prj_htaqdXH2yXa4W5BGreGP`、目录为返回的runtime/data/projects/.../370124c5-e849-45af-8289-03232cffe4a1；首次5秒自然回复完成。此后仅公开PATCH项目username，公开GET/config、canonical source所有权、普通Chat的Base/Ask和Settings Ask全部真实通过，没有点选模式或添加项目覆盖。

第二条真实输入`msg_2ec34fd6-5460-4240-b634-40edcaea7594`让模型读取自有项目外public-external.csv，实际工具read、模式ask、effect read_local、权限请求`per_hnAtJviYIcPphDoaRGRp`及精确scope.resource.paths均正确。普通Chat仅显示read Running，展开工具仍为waiting for result；Ask菜单→Grants/history→Settings能看到Requested实际记录，却无批准控件。Root未通过API自动回复、未切换不同Session侧聊绕过。界面截图、原公开permission/messages观察和实际Settings历史均保留。

源代码与392冻结bundle共同证实Main Chat权限投影缺口：tree-writer直接忽略permission事件、hydrate只接pendingQuestions、InteractionDialogHost只消费卡树，Task upsertPermission又需taskID；SideChat独有同Session投影但不可批准其它Session。warm/cold/reconnect/orderKey/已解决真实时间与多项目边界按共享控制机制继续横审，独立402方案。此为本轮实际发现的新共性问题，不把“工具仍Running”或模型自述当根因。

发送helper在15:41:40.148Z先报fetch failed，早于Root关闭，根因仍须结合实际HTTP/请求/owner事实审查，不能凭最后异常称Provider失败。Root于15:43:43.984Z关闭tab39，比预留closeBy晚28.830秒；这是Root在截止前继续分析造成的操作失误，原时间不修改，也不宣称预留合规。原shutdown admission15:43:54.849Z；CLI记录listener quiesce5000ms超时/escalating及Server stop timed out after5000ms。Native于15:44:02.509Z物理settled、exit1、outputDrainComplete/requestCleanupComplete true；15:44:05配对副本删除完成。shutdown25175 exit0仅证明收尾完成，launcher74529 exit1/OWNED_NATIVE_COMPLETION_INVALID是真实资格失败，不可记成成功退出。原physical截止没有延长，没有用户进程操作，当前Scope已无活动owner或配对凭据。

完整未达成项为实际页面allow_once、read execution_succeeded、最终数据回答及NativeService exit0资格；本轮仅通过配置继承、实际Ask触发与真实待授权状态。准备的完整checker没有执行：在审批/工具完成尚未成立时不认证结果，也不在HTTP已关闭后改出离线成功。Root据实际scopeVersion=2契约将其错误的scope.paths改为scope.resource.paths，并把可能的相对read输入绑定实际会话directory，保留单一当前形状；此前syntax准备不算实际checker验收。关闭异常另按所有Session/Task/Mission/CLI/服务入口及并发/恢复/多项目横审进入403，不在395叠超时、强停或后备路径。

## live-01 暴露的共享权限批准界面缺口（只读紧急横向调查，未实施）

root追加授权只读调查全部permission.asked生产/展示/恢复入口，不操作服务、浏览器、模型或凭据，不改生产/提交，不再次委托。此处是395真实验收所揭示的独立共享控制投影问题，不能用“单个模型没继续”或“某个专家包问题”降级。395已完成的源配置继承与真实Ask事实仍有效；UI批准、read执行成功及最终答案必须分别标记未达成，不能由backend20/58项测试替代。

### 实际可核对事实

root报告GlobalChat首条真实完成；global Base/Ask、Project仅username以及Settings Ask正确。scope为sparse-config-layer-defaults-395-live-01，实际Session `ses_hxQa5jQTUbR8tnvMY6gA`、Project `prj_htaqdXH2yXa4W5BGreGP`，read请求 `per_hnAtJviYIcPphDoaRGRp`，canonical toolCall `call_224d69aadbed492c98e67a29eea61ea3`。自有observation-1791905827294.json真实GET /permission为200，mode=ask、effectClass=read_local、choices=[allow_once,allow_project,deny]，精确公开文件在scope.resource.paths；Main只显示read Running。root已人工查看settings-inherited-ask.jpg、permission-pending.jpg、history-pending-read.jpg等截图，本agent未操作页面/查看图片，不冒称自己完成视觉验收。

原owner Native88712/Host84240，nativeDeadline=2026-10-13T15:44:15UTC，closeBy15:43:15；本agent于15:42:48明确提醒root仍按原截止收尾，没有延长、重启或发任何请求。原helper-failure-send-1791906100148.json记录15:41:40 `fetch failed`，该错误本身不能判定是Provider、HTTP还是owner结束原因；原native/Provider/settlement回执由root收齐后定因。不得用它抹去之前已持久pending/实际页面缺按钮的事实。

准备checker中原`JSON.parse(scope).paths`不符合现存version2合同，应精确为`scope.resource.paths`；root已经识别并接手其修复。本agent没有添加fallback、改scope数据或借修checker改产品。

### 直接根因：Main live与hydrate均未物化权限卡片

- overlay/services/tree-writer.ts:901–904将permission.asked/replied直接return；953的重复分支和“InteractionCard已处理”注释并不生成InteractionData。
- services/conversation.ts:688/699、720只提取/prepare/commit pendingQuestions；后端server/routes/session.ts:1087–1141的Session hydrate同样只返回pendingQuestions，board没有独立Permission interactions。
- tree-writer.ts:3927的conversationInteractions仅合并board.interactions与standaloneQuestionInteractions；card-tree没有当前permission seed。
- components/InteractionDialogHost.tsx:33只从cardTreeStore收集既有InteractionCard；CardParts.tsx:112虽能渲染permission card，但无输入不能产生按钮。这不是弹窗被dismiss、滚动位置或Tool展开状态造成。
- services/sse.ts:475–494收到session事件后进入routeSSEEvent；events.ts统一先writeToTree，event-policy.ts:107承认permission.asked，因此不是“后端根本没发/浏览器拒未知event”的证据。
- Settings PermissionsPanel只GET permission/grants与history，提供grant revoke；没有pending list或reply动作。Requested历史记录并非批准控件。

### 已排除仅旧392 bundle

实际复用393 private392 UI的main-QSwgWIyk.js已只读检索，公开摘录保存`permission-bundle-code-evidence.json`：字符390807/391424处明确相同permission.* noop，493690处只有pendingQuestions；1568874处是SideChat真正permission→InteractionData分支。共1709330bytes，摘录不是DOM/组件/UI自动化测试，也不是摘要身份门槛。当前源与已运行bundle在这条数据流上相同；无需假定重构建当前源即可恢复批准能力。

### 全入口与occurrence影响矩阵

| 入口/状态 | 权威数据与实际展示链 | 当前结论/实证边界 |
| --- | --- | --- |
| Global Chat /项目直接Chat | GlobalChat202自然创建assistant Session，Main BoardSource.kind=session；同一hydrate+SSE+tree-writer | 本次GlobalChat真实pending/无批准复现；直接Chat同函数路径，尚未单独实页复现。 |
| Work主会话 | BoardSource.kind=session且experience=work，仍同一Main projector | 没有独立permission bridge，可受同一缺口影响；未用Work真实模型复现。 |
| Mission主Session | kind=mission在Session hydrate中只增加artifact投影，pending仍仅Questions；无Task所有者时engine interaction不创建 | 同一Main缺口；不能把Task内子会话的成功路径推给独立Mission。 |
| Task根/执行轮次/Task子Session | EngineInteraction.subscribe→upsertPermission，resolveOwner按taskIDForSession遍历真实parent查engine_task.session_id；合法Task拥有者写engine interaction→board.interactions→InteractionCard→interaction reply | 现有独立权威投影存在；不为修Main创建假Task或双写permission。未在本次重新实页测试Task/worker。 |
| Side Chat独立自身Session | side-chat.ts:113–126把permission事件直接映射卡片，replyEndpoint=permission且传target.directory；SideChatPanel:486渲染 | 现成批准入口属于SideChat自己的session，不能批准当前Main请求。子Session权限事件被event.session_id===target.sessionID过滤，子树覆盖需后续精确核对，不外推为已验收。 |
| 公开Session API / SDK | GET /permission给durable Request；POST /permission/:id/reply使用PermissionAuthority.replyUser | 可以进行真实API决定，但不能冒充本轮UI Allow once验收。root决定是否独立backend继续，本agent未调用。 |
| CLI / ACP | permission/pending-projection.ts按exact session过滤真实permission.list；CLI run.ts:475/597、ACP agent.ts:338/674消费live+durable pending | 已有独立展示/回复通路，本轮未运行；不因Main问题删除或重写。 |
| 断开/重新选择/重启 | Session SSE先订阅再读取PermissionAuthority.list，按sessionTreeIDs过滤，1322/1363发送pendingPermissionEvents；Main仍丢弃 | 现有后端durable恢复不能修复Main缺失物化；重新选择/刷新不会产生这张卡。SideChat重连清pending后接收后端快照，已有自身Session恢复通路。 |
| 正常决定/重复事件/终态 | Authority唯一ledger，replyValidated settleDecision、releaseDecisionWaiters；已完成Tool/Message retirement；Mainpermission.replied仍noop | 后续应按requestID幂等、同一ledger决定删除/更新同卡，不创造影子授权事实。没有真实批准后不推断恢复成功。 |
| 串并行请求与多Project | ID绑定project/session/message/toolCall/fingerprint；SessionLoop恢复入口4756拒绝错Project；逐message continuations及原Prompt owner回收 | Main缺口影响每个合法pending；本次只1业务Project/1request，未进行串并行多项目真实运行。不得据单样本排除共享风险。 |

### 不能只解除noop：live/恢复排序合同不一致

protocol/session-mirror.ts:196/204为permission asked/replied使用默认sessionOrderKey（取Session创建时间，domain=session）；question分支则明确生成interaction请求/答复orderKey。server/routes/session.ts的pendingPermissionProtocolSessionEvent已按request.timeCreated/id生成interaction key。Main card seed/interactionToCardSeeds要求interaction domain。因此直接照搬question处理器会让实时permission抛排序域错误，而重连permission表面又能通过，形成新的“双路”缺陷。

PermissionAuthority.Event.Replied当前字段没有timeResolved；后续若展示决定时间必须从已提交ledger的决定事实取得，不用UI Date.now或重放时间。实际允许一次仍由现有replyUser/API/决定事务控制，UI投影不得成为策略事实源。建议下一独立规格以同一Permission Request/ledger为权威完成session pending投影（hydrate/live/reconnect/decided），复用InteractionCard、interaction-reply和现有timeline primitive；Task继续其已有board.interactions所有者，不能重复发布同permission。是否需要完整已答卡片或仅移除pending应按当前可见消息合同设计，不先拼一个平行前端队列。

### 横审发现的额外边界与未知

Authority.list():1197未向requestedRows传projectID，公开GET /permission直接返回。CLI/ACP随后按exact session过滤，Session SSE按sessionTree过滤；history/grants显式使用permissionRequestOwnerBelongsToProject。replyValidated按requestID取requested，SessionLoop恢复阶段才核对Project。此是代码层值得验证的多项目准入/投影风险，当前没有跨Project实际错误回执；不能宣称已证实泄漏或跨Project执行。未来Main hydrate必须按已验证Session树和Project事实筛选，不能直接灌整个list。相关进一步行为调查应单独有界、无凭据，并在原scope完成正常收尾后安排。

已读恢复路径：PermissionAuthority.resumeApprovedContinuations按Instance.project.id查询；SessionLoop.resumePermissionContinuation区分已终态Tool/Message、Mission自己恢复owner、普通Session exact Prompt owner、多个同message获准continuation、finally释放再重读；Task engine interaction恢复保留真实pending Permission。当前并无充分运行证据认定这些owner/恢复代码有新错误，故本结论精确为共享人机批准投影缺口，仍记录控制全矩阵而非降级。

历史：permission noop可追溯65d0bfc98；pendingPermissionEvents后端加入见1f52b298a。本轮读取后台permission-transport-hydration、permission-continuation-recovery、permission-two-mode、engine-interaction-recovery及session permission-message-settlement相关case：已有durable CLI/ACP/protocol、Task恢复、精确message/Project和重复结果正向覆盖，没有证明Main按钮可见。未运行或修改任何测试，未发现/运行UI自动化。当前07-panel-reactivity约定的standalone恢复正文只写Question；07-panel的Permission InteractionCard承诺位于SideChat段，不能拿它证明Main已实现。

独立后续验收建议：正式后台正向覆盖真实Session hydrate+SSE（请求在订阅前、实时、重连重复、回复真实时间、跨Project/Session树、Task occurrence不重复），正常所有者close；UI只真实页面，至少GlobalChat/项目Chat与Work/Mission代表入口、Task原功能和SideChat自身回归，查看待授权、Allow once/deny正常决定、切会话重回、重连恢复、中文/英文与多个pending排序。必要一次实际Sol+外部公开read在fresh原预算scope复验，来源/配置/模型/ledger/工具终态分别查证。原395 live-01失败证据不能覆盖；修复批准前不实施、不创建UI自动化、不伪造消息。

### 395 live-01收尾纠正

root已确认原服务退出及配对删除。pageClose实际15:43:43.984，比closeBy15:43:15晚29秒，必须记录预留窗口不合规；仍在physical原deadline15:44:15前结束。Native88712/Host84240物理15:44:02.509，output/request/physical均true但Native exit1；shutdown helper25175 exit0，launcher74529 qualification exit1 OWNED_NATIVE_COMPLETION_INVALID。stderr为listener quiesce timeout 5000 / Server stop timed out after5000，不是“正常exit0”。因此395未完成UI Allow once、tool read正常结果与最终答复，不能计端到端成功。独立402规格已接管共享权限投影方案；关闭异常独立403分析，不在395读写配置修复中顺手改server/process代码。checker scope.resource.paths修正由root接手，本agent未运行已关闭HTTP checker。


## 最终证据归档与有限交付资格

395的[正式证据入口](../../artifacts/2026-10-13-sparse-config-layer-defaults-395/README.md)已完成显式允许清单归档。后台58 pass/165断言和Root29 pass/91断言重复确认、原红测与类型错误、direct-final整体exit1及其中两个文件独立成功均按真实阶段保留。没有重跑probe、完整checker、live helper或Provider来修改历史结果；LIVE-HELPERS的准备时态与后来实际start/send执行已在README明确区分。

后端唯一[只读终态观察](../../artifacts/2026-10-13-sparse-config-layer-defaults-395/live-01/terminal-observation.json)于2026-10-13T15:55:13.511Z在物理退出后生成。所选Provider事实为7次gpt-6.1-sol流式HTTP200/EOF，含preflight与实际业务请求，预算未耗尽；同一Session仍为ask、permission账本仅requested、read有请求而toolOutcomes为空，第二轮assistant没有completed时间或最终数据答案。它是一次选定证据收集，不是HTTP后备、执行恢复或完整端到端checker通过。归档没有复制其引用的原Provider audit或数据库。

实际[页面关闭记录](../../artifacts/2026-10-13-sparse-config-layer-defaults-395/live-01/observations/page-closed.json)仍为15:43:43.984Z，较closeBy晚28.830秒；[原physical及pair清理](../../artifacts/2026-10-13-sparse-config-layer-defaults-395/live-01/settlement/physical-terminal-and-pair-cleanup.json)保留Native/Host15:44:02.509Z settled、Native exit1、physical/output/request均true及15:44:05.426Z成对删除。shutdown25175 exit0、launcher74529 exit1与send19231 exit1各有不同含义，不能互相替代或把迟收尾写成合规。send原日志的UND_ERR_HEADERS_TIMEOUT早于关闭；其底层服务原因继续按403调查，不能凭该错误归咎Provider。

交付资格仍限于配置根因修复、聚焦后台正确性与真实配置/Ask展示事实；页面allow_once、read execution_succeeded、最终答案和NativeService exit0未达成。[402批准投影](2026-10-13-standalone-permission-projection-402.md)与[403关闭异常](2026-10-13-native-shutdown-pending-permission-403.md)继续独立分析，不在395添加绕行批准、额外超时或强停。

归档为96个选定源文件及README/manifest/archive-check共99文件，4张原JPEG、34个gzip；公开CSV原53字节只是要求读取的输入，不是工具输出。8个公开项目fixture保留原字节，absent输入只记录缺失状态。原字段/路径及字节数见[manifest](../../artifacts/2026-10-13-sparse-config-layer-defaults-395/archive-manifest.json)，安全与恢复结果见[archive-check](../../artifacts/2026-10-13-sparse-config-layer-defaults-395/archive-check.json)。只做有限模式扫描、局部链接和原字节恢复，未复制runtime/auth/models、全source/vendor、无关工作区diff或raw Provider审计。Root另负责原授权SourceAuth的KnownCredentialRedactor内存扫描；audit_ui未读取凭据，未修改共享文档、生产或提交。精确索引建议位于自有scratch archive-index-ops.json，交由Root审读应用及完成docs/范围提交/正常推送。

Root提交前已运行既有KnownCredentialRedactor的精确已知值及JSON/URL编码内存扫描：95个归档文本文件、0个命中，exit0；凭据值未输出，runtime未复制。该扫描是有限的归档安全复核，不能替代功能或完整端到端验收。原回执保留在自有scratch的known-credential-scan.json。
