# 第20批：IPv6 Provider标识的零段位置

## Recall

- 用户要求持续按批迭代：分析/spec先行、真实桌面交互与原图人工复核、聚焦正向业务检查、必要的已授权GPT-6.1 Sol验收、范围提交/上游同步/正常push后继续。最新指令停止所有子agent，由Root自己做并验收；本批不委托。
- 第19批实际提交e3c3d1aa73bfc2b071180d85a21773bdcc4b79b7，parent ba5f55cb3647385db64bc77a93260619e2ef3fb5，99路径/3产品及业务测试文件；42通过82断言、类型/Node构建/业务格式/docs/index、11张亲看原PNG、两轮正式后台退出/3端口0/自有假auth与models整对清理、公开配置读回均有实际证据。exact两项topology及逐blob/索引结算复核0。
- 第19批首次正常push实际1：fresh fetch/merge后完整pending只有自身e3c3d1aa7，被共享工作区新ComboboxControl.tsx:117的TS2322拦下（countAnnouncement返回string，Kobalte声明只有英文单数字面量）。未绕过hook或改写他人文件，保留失败原件，待确认并行修改/检查状态后重跑原正常push。本批先进行独立调查与修前资格，不把第19批伪写成已推送。
- 新证据：执行生产providerFormID，http://[2001:db8:1::1]:18651/v1与http://[2001:db8::1:1]:18651/v1的规范化hostname不同，却都得到ipv6-2001-db8-1-1-18651。第19批未覆盖零段位置，不能把其端口资格推广为IPv6全地址唯一性。
- 已读AGENTS.md、当前05-config/06-provider/07-panel-reactivity、B19 Recall/原始3文件和11图/公开配置/退出资格、provider-form.ts及纯业务test、ProvidersPanel::formProviderId和Discover/Save/高级预览3个消费者。全仓搜索providerFormID/sanitizeProviderId/providerIdFromApi/ipv6-：当前唯一实现在既有provider-form服务，组件旧两个实现已删除。
- 接口搜索：Provider路由providerID是非空string或string，SDK也是string；当前清洗允许下划线，显式ID已有my_custom_id正向案例。配置map、冲突及scope owner不需替换。没有需改的后端、SDK（Software Development Kit，软件开发工具包）、错误、凭据、LLM（Large Language Model，大语言模型）或请求协议。
- 官方依据沿用已读[WHATWG URL标准](https://url.spec.whatwg.org/#dom-url-host)的规范化hostname/IPv6序列化；平台URL（Uniform Resource Locator，统一资源定位符）负责解析，不引入宿主net或自造解析器。标准不替代本批Bun/浏览器实际资格。

## 根因与影响分析（实施前）

1. 现象/触发：不同IPv6（Internet Protocol version 6，网际协议第6版）地址有相同非零组而::位置不同，生产函数输出相同ID（Identifier，标识符）；真实before预览、首条保存及第二条冲突待原图资格。
2. 数据根因：URL.hostname保留正确冒号和::，sanitizeProviderId先把冒号变-，再/-+/合并，丢失零组位置。B19修了完整IP与非默认port，却仅测::1/::2和等价压缩，没有不同零段位置矩阵；已有路径未根治有源码与实际生产计算证据。
3. 影响：同port两地址会共用配置键，applyProviderForm的PROVIDER_ALREADY_EXISTS拒绝第二条，属新增受阻，不是数据覆盖。ID同时用于Discover候选、Save map键与高级预览，应修现有单一owner。既有ID不迁移，编辑继续保留其真实身份。
4. 唯一方案：IPv6分支内把规范化地址的每个冒号一对一编码为清洗允许的下划线，再复用既有ipv6前缀/port/清洗；双冒号保留双下划线。2001:db8:1::1→ipv6-2001_db8_1__1-18651；2001:db8::1:1→ipv6-2001_db8__1_1-18651。纯十六进制组及冒号逐字符映射保留位置，URL规范化负责等价压缩和大小写。::1新ID为ipv6-__1-port，已保存旧ID仍保留，不加兼容、迁移、平行函数或回退。
5. 定义/调用/配置范围：仅既有业务服务IPv6一处和纯业务test。IPv4（Internet Protocol version 4，网际协议第4版）、localhost/子域、普通域名品牌、显式id/name优先级及默认port标准序列化保持；不改3个组件消费者。不同path/query/protocol普遍唯一性及显式ID与自动ID冲突仍由现有合同负责，不夸称全输入无碰撞。
6. 正向检查：先留现有42例baseline；更新触及的4条旧IPv6期望为当前合同，增加不同零段位置、展开等价、大写、全8组/首尾零及同port两份完整声明的具体输出。不以“不相同”代替正向值，不运行UI（User Interface，用户界面）自动化、DOM（Document Object Model，文档对象模型）/组件/文案/截图断言或无目标全量测试。
7. 真实矩阵：正式backend /ui，before用B19冻结UI，亲看两旧预览、首条真实保存、第二条冲突；after本批Node build，亲看两新ID/保存双行及完整API（Application Programming Interface，应用程序接口）地址、中文和编辑已存ID保持，正式GET/config按原目录精确读回。声明里的IPv6地址仅写独立配置，不点击发现/测试，不访问这些地址或宣称网络/Provider/推理资格；虚构participant仅提供完整目录和隔离基础设施。
8. 隔离/风险：before18648/49/51、after18650/51/53先确认端口空闲；独立HOME/目录、自有假auth/models完整同对，0真实凭据。marker→正常settlement→parent实际exit0→3端口0→精确删除自身假pair→全量原日志扫描，禁止操作用户服务/窗口。无调度/恢复异常证据，若出现立即Task/Mission/Session全部入口横向审计。
9. 文档/交付：当前07-panel-reactivity补原IPv6编码合同，CHANGELOG中英未发布增量、3索引及artifact README；保留B19历史事实。业务/格式/overlay type/Node build/docs/index及原图均须实际完成。B19原push失败单独解决并留原件；每次正常push前fresh同步、完整pending归属/验证审阅，保留他人暂存，无新branch/worktree/rebase/force/tag/Release/PR。

## 执行与资格

恢复后先读Recall和本节，先核对实际完成和未完成再继续，不重开已退出运行。

- 第19批第二次正常push实际1：全部8个typecheck通过（6缓存/2执行），route/docs通过；共享权限恢复新改动新增租约入口后，control-lease-owners声明1而源码2，原checker明确拦下。Root没有改他人权限权威或降低检查，保留两次原输出；这是登记检查结果，不冒充已经观察到该任务的生产调度异常，也不宣称其新lease收敛已验收。
- 本批修前PID60400，18648/49/51，occurrence 3202bfa2-dd23-4a4c-b3db-809c08b872f2，B19冻结UI。Root亲看01、02两个不同零段地址同ID；03首条真实保存；04第二条ProviderFormConflictError（可见完整第一句，stack下部viewport裁出）。正式公开GET/config实际200精确读回旧ID及首端点、空env/空models；全程未点击Test/Discover，无IPv6地址请求或模型推理。
- tab19已关闭，正常runtime settlement与parent实际exit0，3端口0，之后精确移除自有假auth/models整对；privacy-before实际0，完整后台原日志98086字节、stdout/stderr各0，terminal实际requests0/realSolCalls0。
- 实施限定计划的业务服务/纯业务test两文件。baseline42通过82断言；新增8地址和1完整map案例、更新4个原IPv6输出，先红态38通过13失败91断言（保留原件），一处IPv6编码修复后51通过91断言。测试核心均为具体字符串或完整声明，不以“不相同/不存在”断言替代功能。服务/test格式、精确源diff检查、overlay类型及Node构建实际0（59.58s），原构建warnings保留。
- 修后PID88128，18650/51/53，occurrence 484aacef-1ead-472c-b9d5-f05c3b3c89c0。Root亲看05首地址→ipv6-2001_db8_1__1-18651，06第二地址→ipv6-2001_db8__1_1-18651与首条保存同屏；07双条保存/完整各自API；08编辑首条草稿API变[::1]仍保留首ID，随后取消未保存；09中文双条/端点与当前语言控件完整可见。共9个未经编辑原PNG，04只资格完整错误第一句不冒充全stack，01/02提交控件被viewport裁出仅资格预览，05有完整新增控件。
- config-after正式公开GET/config实际200，精确读回两ID及各自正确name/API/env[]/models{}。两声明没有模型，只资格配置身份与保存，未访问IPv6地址、发现模型或推理，不需Sol。
- tab20已关闭；正式settlement与parent/隐私checker实际exit0，3端口0后精确删除自身假auth/models整对；完整后台原日志109425字节，stdout/stderr各0，全量已知假凭据检查通过，terminal实际requests0/realSolCalls0。两轮全日志无损gzip，保留原失败/红态和原始输入。
- 最终docs:check实际0（345 ops/26 groups）、architecture-index实际0（19 current documents）。范围提交与正常push尚未完成。第19批正常推送仍需解决共享钩子后重跑；新增独立用户任务的79ee53039仅35条spec/输入原件及405交付回执，没有产品源码，但完整pending仍须再次审阅，不因标题放行，不借他人push或删除失败原件。另一个独立文件浏览提交b767b9325已出现，当前尚未审阅其完整资格，不放行未验证交付。
