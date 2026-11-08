# Skill Market 来源能力与完整搜索结果

## Recall

当前最终资格：24 pass/53断言、15张本人实图、10项最终真实TCP/schema、正式SDK/全部352路径与组件核对通过；7个受影响操作与1新组件已审查，其余345保持。原177状态保留，范围提交/普通上游合并/push待执行。网站精确安装、认证API与Sol完整端到端仍未达成。

持续按批次调查/先分析落盘/证据修复/真实开发/ui桌面交互及本人截图/聚焦正向检查/范围提交/普通上游合并/正常push，再单人下一批直至用户明确停止。用户最新要求不要子agent，本批独立。b33 52d725665已正常推送全部hook通过，main/upstream0/0、原177条状态与空暂存精确保持。Sol凭据授权仍未收到，零模型/凭据。b31本地化、b32零结果及b33三动作Tool适配已交付；b32发现的网站来源搜索502未解决。禁止真实外部安装、发布或操作用户窗口/进程。

已读当前04-extensions全部市场合同、02-data版本化/持久路径原则、07-panel当前语言/诊断、2026-08-26-runtime-skill-market-search-install与b31/32/33 Recall/证据；读SkillMarket完整schema/identity/search/download/digest/错误，SkillManager全部market schema、搜索/详情/安装/删除/目标/ownership/installedIDs/manifest调用，两个HTTP路由族、公共error schema/handler、runtime Tool和权限分类、Overlay唯一候选服务类型与全部展示/操作调用、SDK（Software Development Kit，软件开发工具包）生成器和公开搜索响应类型、现有市场后台测试及fixture。全仓identity调用6处生产/1处测试已列明，Candidate只在市场Manager/服务/列表消费；未发现触及路径UI自动化。不得新增/修改/运行UI自动化。

权威资料：[skills.sh官方API](https://skills.sh/docs/api)说明catalog id由source和slug组成，GitHub来源三段、well-known网站来源两段；当前v1查询/详情需单独OIDC（OpenID Connect，开放身份连接）凭据，未获授权不得使用。[官方CLI搜索](https://raw.githubusercontent.com/vercel-labs/skills/main/src/find.ts)仍用公开/api/search；[官方well-known provider](https://raw.githubusercontent.com/vercel-labs/skills/main/src/providers/wellknown.ts)另有发布发现/完整性协议，不能把其多路径/旧格式fallback抄进当前项目。[Zod官方schema](https://zod.dev/api#discriminated-unions)支持来源discriminated union及.options复用。仅借用公开合同和成熟schema primitive（基础组件），不引入新库或第二registry。

## 已观察事实与根因

b32的真实公开查询“"空<界面>&查询"”返回HTTP200/一个候选open.feishu.cn/lark-wiki、source=open.feishu.cn、skillId=lark-wiki、installs871192，原工具输出/官方JSON及截图已保留。当前本地同查询502/SkillMarketUpstreamError，当前identity正则仅三段，search在整批map里调用identity，合法网站记录一项即可使整批失败。不是中文编码、上游空结果或网络失败。旧方案把可发现catalog身份直接等同可下载GitHub仓库身份，所有候选都合成github.com仓库地址；上游扩展来源后该假设失效。

2026-11-09本轮公开GET /api/download/open.feishu.cn/lark-wiki为404 HTML；这只证明该样例在当前公开下载路径不可用，不声称所有网站都不可下载。官方认证v1是另一合同且没有授权；现有URL importer是原项目/全局高级入口，不能偷偷绕过去复制协议、安装整个来源或弱化hash/manifest所有权。另一次聚焦公开lark查询返回10个GitHub larksuite/cli候选，不把它说成混合实证；混合列表将由自有后台fixture证明，实页只使用真实公共结果。

直接触发点和数据流：公开SearchResponse→每项identity→Candidate.array.parse→SkillManager已安装投影→两个HTTP/Tool/Overlay；严格三段和required repository把来源类型事实丢失，asUpstreamError将整批变502。共享服务影响所有项目/全局、主角色工具和设置页，不能按某个查询/角色降级。尚未发现调度/队列/恢复/终态收敛异常，本批为来源数据契约问题。

## 实施前方案与影响

限定交付为完整可读搜索及明确能力，绝不宣称新增网站来源安装。候选以source_type判别GitHub/网站两种当前来源：GitHub保留真实repository和原完整检查/安装；网站保留原id/name/source/installs/homepage，明确当前不能精确包检查，不伪造GitHub URL、不丢弃候选、不屏蔽整批、不在网络出错后走备用协议。source_type是依据官方当前身份格式和本次wire source/id一致性的确定投影，不伪称原公开响应带了这个字段。未知/不一致/不合法来源仍发布原上游错误。

身份只保留一条当前解析：现Identity三段可移植schema继续作为既有GitHub/持久manifest准入，新增独立网站身份schema（hostname/slug）后以CatalogIdentity union表达两个不同当前来源；identity函数统一解析为discriminated value，不复制旧正则解析。repositoryIdentity从该值收窄，网站以具名SkillMarketSourceUnavailableError返回400。download/invalidBundleError、managedMarketTarget、inspectMarketBundle及安装入口在构造路径/写入前用此同一收窄；原持久manifest ownership读取继续显式使用既有三段Identity校验/原大小写归一，不能因catalog扩大而改变已存身份的解释。不是旧协议兼容/双读写，也不新增存储格式。

MarketInspectInput/InstallInput接CatalogIdentity，网站调用得到明确具名400而非匿名/错误安装，原工具action投影与严格服务输入保持；remove不得为网站构造目标。Candidate使用source_type判别union（仅GitHub有repository），Manager从同一options扩展installed，不复刻字段。Overlay候选直接使用生成SDK搜索响应元素类型，移除当前手写候选接口，详情/安装结果原合同保持；真实行显示本地化“此网站来源暂不支持精确包检查”，Review不可用但事实可读，GitHub Review保持。两个语言/无障碍名称接当前语言，原技术身份保留。工具定义同步客观描述当前来源能力；不新增host路由教LLM、角色白名单、工具隐藏或工作流状态。

具名错误定义在当前SkillMarket owner，原HTTP handler将其映射400；共享server错误声明一次复用BadRequest+具名schema，并用于两路由族的detail/install共4操作。搜索2操作改为来源union；SDK/OpenAPI（开放API描述）与双语API文档走正式生成，不手修生成产物。需完整审查352操作差异，预期仅2搜索响应/4输入及400和对应组件，其他变更必须说明。数据库schema10、原manifest字段/来源URL/GitHub目标路径/hash/旧数据均不变，没有持久格式/版本升级；不能借本批收紧旧portable路径或要求清库。

风险覆盖所有定义/调用/公共接口、来源事实、权限/hash/写入前收窄、既有目录ownership、数据/SDK/文档/交付。风险为来源误分类、造假仓库、丢候选/原顺序、无意允许网站写入、schema union扩展strict冲突、SDK与实响应分歧、UI说明未本地化。所有边界用正向完整对象/明确错误契约证明，不用“没有调用/不存在”等核心断言，不把不可用原因写成不安全风险。

## 验收和资源

Temp opencorvus-iteration-20261109-b34，fresh profile-before/after、本人Git项目/私有配置，dev38985/38986通过/ui隐藏独立页面。先保留前态实际502及官方200候选/公开下载404元数据，截图本人查看并正常关闭，定稿后才改产品。新增聚焦后台正向混合来源搜索（两个HTTP族/真实Tool包装）、网站具名400详情/安装、旧GitHub精确读取/安装/持久manifest路径原合同，复用现自有fixture，禁止真实外部安装。测试失败先修根因重跑原验收，保留红证。

改后真实同一公开查询得到原网站行、数量与当前语言不可用说明；中英/原query、正常react搜索及Review详情、零结果回归，各截图本人查看。真实TCP（Transmission Control Protocol，传输控制协议）checker用运行时/doc和Ajv校验搜索来源union、4个400及正常GitHub详情，直接Tool search/inspect来源错误也只读，不造模型/消息；不以fixture假装网页或模型验收。正式SDK生成、后端/overlay/SDK必要类型、双语key、正常Node UI构建/renderer、docs:check/architecture-index辅助通过。两项目原文/Git/profile保护、页关闭/正常shutdown及原session exit0，原177状态保留，范围提交三README仅本条、fetch普通merge/完整待推集合复核/正常push后继续。网站精确安装、认证API、完整权限Session/LLM/Sol均未授权/未达成，不用它们暂停其它已授权工作。

## 本批前态实证与定稿细节

38985/IAB71同一原公开查询实际502；01失败摘要和02原Details均本人实际呈现查看，Request ID 0f5653ff-dc3e-4083-8f8a-d2f98fe78a80。before-observed-protocol记录同批官方200原候选、本地502以及样例公开下载404元数据，未保存/执行远端代码；before-runtime-doc保存Temp供正式生成差异比较。页71已关闭，正常shutdown后原session必须退出0才继续实现。

定稿强调新网站slug保持原始大小写，不能把网站URL路径当GitHub名强制小写；GitHub既有canonical lowercase/portable规则保持。网站host仅用成熟hostname schema验证，无物理目录写入，不能把其合法域名按Windows设备路径错误过滤。source_type、id/source/skillId一致性仍来自同一解析器；未知来源严格报原上游错误。具名400响应声明将在现server/error.ts共享一次供4个路由复用，源class与data schema仍只定义在SkillMarket，中央handler仅按现有模式映射状态。不会新增认证、registry或多路径发现。

## 聚焦红证与实施准入

正式runner指定source-aware名称：0 pass/13 fail/7 filtered，隔离runtime opencorvus-test-run-ngC07U保留、physical/output settlement=true。覆盖当前来源身份、四个混合搜索入口以及检查/安装各四个服务/路由/Tool入口；当前网站来源被旧三段规则拒绝，预期的完整结果与明确具名400均未成立。原7项未重复在红阶段运行。

已读现badRequestOrNamedErrorResponse，只支持name+宽data record；本批需要由领域class.Schema发布id/source/source_type的具体契约，因此仅共享一个具体响应常量，复用原BAD_REQUEST_SCHEMA/z.union/resolver，不改通用helper或重造错误DTO。Web slug另明确排除URL点段.和..，其他合法元数据（含con.example/NUL）不当作Windows写入路径；仓库physical准入保持原规则。

## 当前验证和身份事实来源收敛

新13项已通过，完整现文件20 pass/49断言；后端、overlay/SDK类型、双语2930键、正式SDK生成和正常UI build1m6s/renderer通过。生成352操作只有预期2搜索+4详情/安装的输入及400变化，唯一新组件SkillMarketSourceUnavailableError；SDK参数string|string来自两个字符串身份branch的正式生成，未手修生成产物或为此改公共schema。实际direct Tool公开读取网站1项/具名不可检查、仓库1项/76文件/deny通过；9项真实TCP/schema及SDK与runtime全部paths/components（仅移除CLI-only x-codeSamples）精确一致。

38986/IAB72实际03/04网站原lark-wiki、open.feishu.cn、871,192安装量和中英不可用说明/Review帮助文本，05正常react10项、06/07原仓库详情中英、08零结果0/原query建议；01—08均已呈现本人查看，实际main-BZix5igu.js，没有为布局改CSS。该页已关闭，当前服务65747正常退役后再做下述最终收敛。

最终审查发现原SearchResponse.id.optional与item.id??source/skillId仍能重建缺失的原身份。官方当前catalog/CLI以原id为稳定事实来源，当前所有真实响应和现有fixture均提供id；该旧重建路径正落在本批身份范围，必须同步删除，不能保留平行身份来源。增加聚焦正向上游错误契约：缺失必需id的wire响应映射SkillMarketUpstreamError/search/固定原endpoint和invalid response；红证后将wire id改必需、search直接消费item.id，仍核对source/skillId一致性。该修改不改变公共输出、持久数据、SDK字段或UI代码，不新增兼容路径。之后重跑原聚焦完整验收与真实网络/TCP/独立最终页，不能把前一进程当最终源码资格。

## 最终实现、收敛与验收

最终代码只接受非空上游原id；新身份错误用例红证为原promise resolved（旧路径拼接出候选），修改后原整文件21 pass/50断言。第一轮来源红证13 fail与后续13 pass、完整20 pass及最终21 pass日志全部保留；失败runtime ngC07U/EQIFzF按runner规范保留且physical/output结清。没有用负向“不调用/不存在”或UI源码文案测试替代正确结果；错误输入对应明确SkillMarketUpstreamError或SourceUnavailableError合同。

源模型source_type判别github/well-known，唯一identity消费CatalogIdentity；三段持久Identity保持原规则，website host/slug原文与大小写保留，repositoryIdentity在精确包/物理能力边界给具名400。网站行只提供目录事实和本地化不可用说明，GitHub repository不伪造到网站候选。SDK生成响应元素替代Overlay手写候选接口，两种来源只有一份公开schema。4个400共用现BAD_REQUEST_SCHEMA+领域class.Schema的具体声明；中央handler映射状态，不加registry/认证/备用协议或LLM工具gate。

正式SDK/OpenAPI及双语API文档生成成功。352个operation只有skill/global.skill两族search/detail/install共6个预期变化；组件唯一新增SkillMarketSourceUnavailableError，其他346操作与原组件精确保持。SDK冗余string|string是两个字符串branch的原生成结果，未手改生成器或公共约束。完整后端typecheck在最后原id修改后重跑通过；overlay/SDK typecheck、双语2930键、正常Node UI build1m6s和renderer、docs352操作/26组、architecture-index20文档通过。最后仅私有wire输入删除重建路径，公共schema/UI源码未变，所以不重复生成/构建；最终运行时checker再次证明SDK全部paths/components精确相同（仅去CLI x-codeSamples）。

实际生产Tool.init/execute最终源码重跑，公开原查询返回1个well-known候选，inspect为原id/source的具名不可用错误；react/limit1返回github候选并检查到76文件/medium/deny，源描述/文件/hash保持。checker测试ctx无持久化对话或模型消息，不冒称完整Permission/Session/LLM端到端。Tool公开定义同步客观来源能力，原action/args、权限分类和结果路径保持。没有真实外部安装、凭据或模型请求。

38986原后态65747正常关闭后，以38987原session19374重启本人实例跑最终源码。最终9项TCP（Transmission Control Protocol，传输控制协议）检查：两个真实网站搜索200、两族detail/install四个具名400、正常GitHub搜索/详情200及零查询200；用运行时/doc和Ajv2020按公开schema校验，搜索与详情结果与direct Tool当前数据精确相同。真实install端点只输入已由前置数据收窄/聚焦用例证明拒绝的网站身份并返回400，不安装或执行远端内容；合法外部安装未验。缺失上游id场景仅自有wire fixture验证，当前实网上游始终提供id，不伪称外部实际缺失。

本人38987/IAB73最终09英文网站原lark-wiki/open.feishu.cn/871,192 installs、10同一行中文不可用说明/检查帮助文本，11真实react搜索并Review原仓库详情成功。01—11全部逐张实际呈现本人查看，实际main-BZix5igu.js；原03—08已经覆盖中英网站、仓库、零结果，最后09—11绑定最终源码，未用旧进程代替。没有UI自动化、DOM/组件/源文案断言或截图比较，也未为已经通过的布局添加CSS。

所有自己的页71/72/73关闭；before20103、after65747、final19374均正常shutdown200及原session exit0。两个项目原文各48字节、种子HEAD/原commit内容和工作区原文精确保持，profile config清单均为空；未接触用户现用窗口/进程或真实数据库。数据库schema/持久manifest字段、GitHub目标树和已存原始portable格式未变，无迁移或清库。

已解决合法网站来源导致整批搜索502的根因，交付明确范围为完整目录事实/准确能力/具名输入拒绝和原GitHub路径；网站精确包检查/安装、认证API、完整权限Session和授权GPT-6.1 Sol仍未达成，不包装成市场全部能力完成。原空目录搜索、持久路径等独立未决保留。原177条用户状态和三个索引的他人差异继续保持；范围提交、fetch普通merge、完整待推集审查/正常push后单人下一批，不发布。

## 同一wire事实审查的安装量收敛

记录前述最终21项后，对同一SearchResponse全部字段默认值完成审查：id重建已删除，另有installs.default(0)会把未知安装量伪造为真实零。当前官方/CLI响应明确提供installs；它不同于用户可省略的limit默认值，也不同于下载协议可选且不替代真实内容digest的upstream_hash。该字段同在本批当前搜索/数量展示范围，按单一事实来源删除默认补数，不留到下一协议路径。

将Malformed wire正向错误用例参数化覆盖缺失原id/安装量，先复现缺失安装量仍resolved；同时在混合来源完整输出中加入fixture中明确提供的installs=0候选，证明合法零有明确正向输出。修复只让wire installs必需，公共输出schema/SDK/UI保持；之后重跑完整22项、真实Tool和9项HTTP/schema，以及新最终实例实页。此前21项/11图资格保留为中间轮，不能冒称新的最终源码资格。

## 最终定稿：22项与原安装量事实

安装量红证1 fail/21 filtered，旧default(0)把缺失量投影为0；失败runtime RjOuiL按runner保留/physical-output结清。删除该唯一wire补数后，完整22 pass/51断言，包含混合搜索四入口的三条完整候选（其中一条fixture明确提供installs=0），而缺少必需id或安装量分别映射具名上游错误。真实上游当前一直提供正数，没有取得实际零安装量网页样例，不把后台0夹具冒称视觉验收；零结果0的网页资格另见08。

最后后端typecheck再通过，真实生产Tool网络读取再次通过，然后独立38988/session61182运行最终源码：9项真实HTTP/schema和SDK paths/components精确比对重跑通过。未改变公共schema/UI源码，因此前次正式生成、overlay/SDK类型、2930键和main-BZix5igu.js构建仍对应同一当前界面；没有为了源码字节摘要重复构建。最终IAB74实际12网站原名/域名/871,192与说明、13正常react/Review仓库详情本人查看，均为最后wire字段收敛后的进程。

自己的页74关闭、38988正常shutdown200/原session61182 exit0；之前71/72/73和20103/65747/19374也都正常结束。最终13图全部本人实际呈现查看，两个48字节原文/种子内容/HEAD及profile空配置清单再次精确核对。06-red-install-count与07-final-count日志保留最后红绿事实，其余中间资格不覆盖最后22项/9 TCP/13图的当前结论。后续范围提交、普通合并与正常push；全部模型/凭据/外部安装仍0，网站精确能力/Sol未达成。

提交格式检查发现Bun红证的空代码框行含行末空白；仅对仓库日志副本移除行末空白，原Temp原始输出完整保留。重跑同一git diff --cached --check通过，不改产品/断言或绕过hook。

## 全调用点审查：共享删除入口的公开闭包

最后完整复核identity/repositoryIdentity每个调用点，确认remove也在managedMarketTarget处返回同一SourceUnavailableError，而当前skill.remove文档只有200，没有400声明。已通过SDK/runtime全路径精确比对的当前文档同样证明此遗漏；此前6操作列表不含这个真实受影响入口，必须补齐，不能交付已知漏项。update经PackageUpdateClient ZIP owner，不调用市场identity/bundle，已按代码明确排除，不扩大改动。

计划在现skill.remove增加同一个SkillMarketInputErrorResponse/400，明确拒绝把网站目录身份当作已安装仓库；源helper先于配置/物理目标写入，正向服务/真实route合同覆盖。为检查、安装和删除共用具名原因，将message统一为“This Skill Market source supports catalog listings only.”，不再把每个被拒操作都叫检查；原UI可读说明仍准确且不变。公共class/data Schema不变，正式SDK及文档再生成，预期7操作/1组件变化，其余345保持。此处是同一市场来源边界的遗漏闭包，不是新增删除能力或安装网站内容。

新增2项正向服务/路由用例先红证，然后修改当前声明/领域原因，完整24项及10个实际HTTP/schema（增加网站移除400）重跑。新真实请求使用本人隔离profile/未安装目录身份，并由已审查前置收窄证明在任何删除目标/配置mutation之前明确拒绝，不执行物理删除或外部安装。当前13图仍为原UI各区域的有效视觉证据；当前UI源码无变化，最后会再用独立实例实页确认目录展示，避免以旧进程替代最新后端资格。

## 最后定稿：共享删除声明闭包

共享remove正向红证为2 fail/22 filtered，原当前技术原因只说检查；按上文方案统一原因catalog listings only并给skill.remove声明同一400。原整文件最终24 pass/53断言（09日志），后台typecheck及正式SDK/overlay/SDK类型再次通过，双语API文档正式再生成。实际差异最终为352操作中的7个（两族search/detail/install及skill.remove）和唯一SourceUnavailable错误组件，其余345及原组件保持；前文6操作只属于中间轮，当前以generated-api-delta为准。

最终生产Tool网络checker再次运行，网站候选可读、inspect为具名catalog-only拒绝、GitHub原76文件/deny保持，无模型/凭据/外部安装。38989原session72151进入最后源码，全部paths/components与正式SDK精确一致；最终10项真实HTTP/schema包括新增网站身份remove的明确400，未进行配置mutation或物理删除，实际输入在目标构造前被同一收窄拒绝。当前Update代码不使用market身份，明确排除；全部identity/repositoryIdentity调用点已收敛。

IAB75实际14网站原事实英文、15同一行中文、当前帮助说明与disabled Review均本人查看，main-BZix5igu.js。UI源码及运行JS自本批初次构建后保持，最后生成只增加错误类型/声明，不为源码摘要重复构建；前述正常仓库详情与零结果截图继续有效。总15图全部本人实际呈现查看；最后页75关闭、HTTP shutdown200/原session72151 exit0，两个48字节/种子HEAD/profile空配置再次保持。

当前完整资格为24项/53断言、10真实TCP/schema、15实图、7操作/1组件差异及类型/双语/构建/文档通过。所有早期13/20/21/22项与6操作/9TCP是本记录有据可查的中间轮，不覆盖此最新定稿。Task/Mission/Session调度异常未观察，缺少元数据的错误路径仍仅后台wire fixture资格，真实零安装量网页样例未取得。网站精确安装、认证API及完整Sol/权限Session端到端继续未达成，不能包装为市场全功能完成；继续范围提交/普通上游合并/正常push。
