# 第12批只读补充：已提交 Config 409 的诊断保密边界

## Recall 与范围

Root要求在正式spec和产品修改前复核 Provider已提交409的完整错误链，尤其receipt.data.config经ApiError、console、formatErrorDetails和持久诊断的流向，复用现有成熟结构化redactor/DTO（Data Transfer Object，数据传输对象）投影，禁止关键词特判和第二配置事实源。本分工只读源码、旧spec、B11公开样例证据，未读取真实Auth/models/私有Config内容，没有构造或注入故障，没有运行任何测试、UI或服务。唯一写入为本scratch；未改产品/测试/共享spec，未委托。

B11三张已看图片只证明配置200后catalog观察缺口，不能当作409保密资格。本报告的409链是当前源码可达事实；真实409回执、实际console展示与落日志尚未实跑。

## 确定的数据流

1. `packages/opencorvus/src/config/config.ts:2014–2046` 两种CommittedReconcileError都持有完整Info；唯一committedMutationReceipt直接返回 `{name, data:{committed:true, message:error.message, config:error.config, failures:error.errors.map(message)}}`，没有诊断投影或脱敏。
2. Config.Provider.options在同文件1310–1332允许apiKey且catchall任意options；NetworkProxy1384允许password；provider/models.ts:94允许任意model.headers，Provider配置扩展保留它。因此full Config可以包含provider.options.apiKey、network.proxy.password、options.headers、model.headers等。它们是类型和数据流可能性，不是本调查读到任何实际秘密。
3. 两HTTP公开入口 `server/routes/config.ts:103–104` / `global.ts:1291–1292` 捕获该错误并直接c.json(receipt,409)。**标准409在这里已被处理，不经过serverErrorResponse的log.error。** 不能把通常500具名错误日志链直接套到此409，声称每次必然由后端通用handler落盘。
4. `packages/overlay/src/services/api.ts:168–175` ApiError把decoded response body原样保存在公开body；普通object甚至保留同一对象引用。message/summary（213–239）先取data.message，当前两个Config错误的顶层message为固定文本，所以正常标准回执的折叠摘要/stack通常不包含config。body仍是完整配置，fallback JSON.stringify规则也不是安全边界。
5. `services/config.ts:139–145` 唯一committedConfigFromError读取data.config；patchConfig165–167、patchGlobalConfig188–190、updateConfigPath478–480在当前owner内更新appStore.config后均rethrow原ApiError。这是业务恢复所需的原配置事实，也是完整快照继续流入泛用错误通道的交接点。
6. `ProvidersPanel.tsx:683` 在ownsForm判断前直接console.error原Error对象；696/689把formatErrorDetails结果放Feedback.details。`utils/error-details.ts:24–31`用JSON.stringify(meta.body,null,2)无条件拼入response body。故这个分支的Details可以展开所有receipt.data.config字段；console收到的对象也仍携带完整body，控制台默认是否展开并不等于安全投影。不能仅隐藏Details就称已修。

这是已授权配置读取内容被额外提升为诊断数据的边界问题，**不是已证明的未认证接口、越权读取或跨用户泄漏**。成功GET Config本来允许当前客户端读取对应配置；不能为了诊断修复擅自更改成功GET或真实持久化配置。

## 实际同语义日志消费者与限制

ApiError本身不自动持久化全部响应：onApiError当前唯一生产订阅为init.ts:82的missing-project恢复。Panel的直接catch当前没有调用AppLog，console.error不应在没有证据时被称为自动写入应用日志。

但相同Config错误确有其他生产入口把它提升到持久日志：

- `services/permission-mode.ts:41/48`调用patchConfig/patchGlobalConfig，53–57捕获后`reportError({details:formatErrorDetails(error)})`。
- `components/ChatComposer.tsx:715–722`的run-control配置保存调用patchConfig，失败同样进入reportError和完整details。
- `services/diagnostics.ts:16–25`把details交AppLog；`utils/log.ts:60–66`存原extra，117–130将其序列化POST /log，145–149加入flush队列。因此对于这些入口的同一409，full config进入持久诊断是源码可达，不只是泛泛猜测。尚无本轮实际日志运行证据。
- main.tsx:337–357运行异常也经formatErrorDetails/AppLog，但当前Provider保存catch已处理错误，不能声称它必然再触发window.unhandledrejection。
- 07-panel.md:2886说明support ZIP保留原日志与subject details；一旦此前被写入，就可能被导出。这里未读取或导出任何实际日志。

后端Log.sanitizeRecord（util/log.ts:378–385）只对APICallError走safeProviderErrorDiagnostic，对一般对象/字符串没有统一secret投影；pino serializer对Error有自己的展开。但标准两路由409不走通用错误handler，本批不得据此声称所有后端日志已含config。若新的实现新增已提交失败日志，必须从一开始传安全DTO。

## 可复用的成熟实现

1. `provider/error.ts:70–86`的ProviderError.redactSensitiveProviderValue按结构处理完整凭据字段与header容器，string内容复用Payload/parser逻辑；176–177为序列化payload入口，180–188处理headers。`session/assistant-diagnostics.ts:45`与`tool/read-agent-message.ts:137/171/245`已经在真实诊断投影复用它。它覆盖apiKey/password/Authorization等已知协议字段，**不应宣称能识别任意catchall字段里任意命名的秘密**；这正是整份config不该作为诊断载荷的理由。
2. `util/error-diagnostics.ts:1–42`已提供ErrorDiagnostic DTO：只选name/message/stack/code/cause/aggregate errors，有统一深度/子错误数量控制，而不枚举Error所有业务属性。它本身不做secret redaction；可以在同一诊断投影组合现有ProviderError redactor，而不是另造一套错误递归/正则。
3. `safeProviderErrorDiagnostic`（provider/error.ts:192–203）只对SDK APICallError执行，Config错误原样返回，不能直接把“调用了safe函数”当保护证据。
4. Overlay `boundedDebugText`（utils/debug-text.ts:17）用于剪贴板的启发式裁剪，既没有在此链调用，也会损失完整诊断/换行；不能拿它替代明确receipt诊断合同。Tool diagnostic-value只处理inline/base64，不是credential redactor。
5. `services/api-state.ts:22–40`已有ApiAuthorityChangedError将原response放private #outcome、以安全固定message说明退休的做法，说明“原业务事实保留”和“公开诊断内容”可以分开。private字段本身不保证devtools不能观察，也不替代console只接收安全DTO；不要把错误的整个outcome再JSON.stringify进日志。

ProviderError当前模块同时依赖ai、http等后端能力，Overlay没有直接import它。若需要浏览器端共用其结构化redactor，应只把现有纯投影实现移到现有可跨包util/transport层，原后端与前端均改用唯一实现并删除原重复定义；不要从Overlay导入整份后端provider/error.ts或复制规则列表。是否需要这种跨包移动取决于最终投影边界；若backend已输出safe failure诊断，前端无须为本任务引入另一遍sanitize。

Root追加要求后的依赖核对：provider/error.ts:1–5顶层实际导入`ai`的APICallError、transport-protocol、Node `http`的STATUS_CODES、`jsonc-parser`和后端`@/util/iife`。结构化redactor纯子集自身只使用标准JS对象/数组/string、jsonc-parser（scanner/tree/edit文本）以及URL标准API，没有Bun/fs/process；理论上可移到宿主无关层，但**当前没有可直接供Overlay导入的独立纯模块边界**。Overlay也没有现成ProviderError依赖，后端@路径和Node http不能靠未经build证明的tree-shaking忽略。跨端复用将要求迁移/删除旧定义、全消费者与纯数据测试同步，而不是复制。因此本批更小且充分的选择是typed receipt诊断DTO整份省略config；不为它扩大redactor跨包重构或任意未知秘密识别。后端原failure诊断如需净化仍可在已有后端边界调用现有实现。

## 推荐本批边界与不可取方案

保留唯一committed snapshot的业务读取与当前owner投影，同时在共享**配置错误消费边界**形成一个纯派生的安全诊断DTO。它应保留真实错误name、committed事实、HTTP status/method/path/requestID、固定message和必要failure诊断，不把整个config作为诊断正文。typed receipt识别应复用/收敛现有committedConfigFromError合同，不能靠“committed”“config”等消息关键词、URL子串或secret token列表猜测。

建议本批随着“已提交结果与后续观察分离”一起收口三个Config helper的外抛结果：原snapshot先按已有ownership更新appStore；随后交给UI/console/reportError的域错误或结果仅带安全诊断。三个方法用同一个分类/投影，不保留旧raw-error重抛分支作为兼容路径。此方案会改变本地错误消费合同，必须先在spec中列出所有调用点/类型/测试更新；不能偷偷把普通失败变成成功Promise或丢掉409和failure原因。

安全DTO是同一原回执的即时视图，不是另一个可修改配置状态/map/cache。不得把redactor生成的config副本写入appStore，否者可能将 `<redacted>` 当作真实Key覆盖后续保存。也不得为了保密直接删除公开HTTP receipt.config而不同时修改现有恢复合同；那会破坏已提交情况下保持配置事实的功能。

若选择保留原ApiError作为全部公共消费错误，则仅改formatErrorDetails不够，所有console/report/log入口必须统一使用同一个安全DTO；仍然console.error(rawError)或将rawError作为cause嵌入新错误，会留下原body通道。因此更稳妥的是在已有Config域边界处理业务receipt后不再向泛用诊断传播完整快照，而不是遍布Panel/Network/Composer的局部掩码。

顶层message现在固定，不代表failures安全：committedMutationReceipt2045当前直接取子错误message。必要failure结构应复用成熟ErrorDiagnostic和既有ProviderError投影，保留原因顺序/类型/code/定位，避免新增ad-hoc字符替换。任意free text绝对秘密识别不可证明；本批可以明确保证不额外把已提交配置快照送入诊断，并保留现有规范凭据投影合同，不包装为整仓万能redaction。

已查阅[OWASP Logging Cheat Sheet，Data to exclude](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude)：建议不直接记录密码、access token和主要秘密，同时保留事件结果、原因和关联信息。这里采用“诊断只携带需要的DTO字段”，不是删除整个错误或日志；此权威资料是设计原则，不能代替项目运行验收。

## 必要正向数据资格（未运行）

- 用明确公开样例构造两个scope的标准409：config包含options.apiKey、proxy.password（含空格/换行样例）、model.headers.Authorization、options.headers任意私有字段名、普通name/API/model metadata。验证**完整安全DTO精确相等**：HTTP身份、committed、错误type/message、顺序failure、必要redacted marker。不要用not.toContain、secret出现0次、哈希或源码断言当核心测试。
- 同时精确比较被当前owner接纳的appStore.config与原公开样例配置，证明业务值原样且没有redacted值写回；退休owner的明确结果继续遵守既有ApiAuthority/选择合同。
- 三个Config helper（patchConfig、patchGlobalConfig、updateConfigPath）的正常200、普通错误、已提交409、读取刷新失败分别给出明确结果；当前config-service-fail-fast.test.ts、project-configuration-ownership.test.ts已经覆盖旧raw ApiError回执，不可为了保留旧期望留下双路径。api-error.test.ts的普通typed error原body保留不应被本次局部Config合同意外削弱。
- 诊断纯formatter/日志数据测试：安全域结果交formatErrorDetails/reportError后精确期望包含method/path/requestID及原因；内存记录和flush payload精确为安全DTO。使用服务级正向输入输出，不写UI组件/DOM/截图或源码文本测试。
- 若移动redactor，复用provider-error-redaction.test.ts已有结构化完整字段、JSON字符串嵌套、header及顺序合同；保留唯一implementation并补相应纯数据导出资格。现有error-diagnostics.test.ts证明错误嵌套顺序，不能冒充凭据安全。
- 若改HTTP receipt公开schema或增加明确diagnostic字段，必须真实搜索生成SDK/OpenAPI及路由文档再更新，当前两种CommittedReconcileError并无可检索的专门生成schema；不能手编另一份前端协议或声称SDK天然覆盖。

## 真实界面/日志资格建议（未运行）

Root需在新自有生产scope实际产生“配置已提交、reconcile失败”的409，使用公开虚构值而不读取/复制真实Auth或Model目录。沿真正配置写入和真实下游失效触发，禁止fake response/browser intercept。先证明canonical Config/source确已提交，再查看Provider中文/英文短摘要与Details、同次console安全诊断、原HTTP状态/requestID和scope；后续catalog失败不得把已提交保存说成失败重试。

另选择一个真实持久诊断consumer（权限模式或Composer配置保存）验证相同回执通过共享边界得到安全日志，并从自有Log读取该记录。不要为验收直接把秘密样例人工塞AppLog，那只能证明日志按输入写入。未能真实触发409必须列为未满足，不拿B11正常200图片或构造ApiError的数据测试替代。

全程只使用样例标记；不把真实秘密、真实配置快照复制进spec、截图或提交。真实HTTP响应若仍按现行业务合同携带样例config，只属于已授权业务证据，与安全诊断DTO明确分开；不要误称网络响应已被清空。无需为此单独触发LLM；若后续实现触及模型/共享运行或观察到调度异常，再由Root按现有授权与共性审计规则决定资格。

## 已验证与未验证结论

确定：原receipt携带完整配置；ApiError保留它；Provider Details无安全投影；console传入原对象；同配置409可由已检索的permission/Composer错误处理进入AppLog。已有redactor与ErrorDiagnostic可复用，但目前未保护该链。标准两HTTP409本身不经过通用serverErrorResponse日志。

未知：本轮真实409可达触发、实际console默认渲染细节、实际持久日志/导出内容、私有秘密是否曾出现、跨用户访问。没有读取实际私有资料或运行验证，不能把静态链称作已发生泄漏。AGENTS要求的正向检查与Root亲自实页资格仍待正式方案后完成。

本分工修正了两次猜测文件名：实际网络模块为util/network-proxy.ts，authority为api-state.ts，测试为provider-error-redaction.test.ts；不存在路径的失败读取不计覆盖。仅本文件落盘，其他工作区状态全部保留。
