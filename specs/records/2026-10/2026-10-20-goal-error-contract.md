# Goal 冲突错误的公开合同

## Recall

持续单 agent 自主迭代；后续明确单 agent 指令覆盖旧 goal 的 Astra 文案，不委托。用户重点是 Goal 不知如何使用与默认首页布局，继续修复并实际验证后提交推送。上一轮 457 是 progress：1f6742a536637dbb8053b363f2ba5cf98fb73c82 已正常推送，fresh fetch HEAD=origin/main，117 例/271 断言和实际接口验证通过；schema 2、104 Project/137 Session 完整保留，全部自有 scope/物理/输出/请求及授权对退休。原完整保存 12.799s/恢复 12.560s 仍不达 10s/5s，四读取 20s 通过。工作区仅既有 .bun/ 与 packages/opencorvus/bun/ 未跟踪。

继续已应用的 benchmark-debug-template 与 computer-use。用户本轮回复使用“内置浏览器调试”；实际调用内置 cua.getState 仍返回 Work 设置禁用本地浏览器，已请求开启，等待真实状态变化，不绕过。UI 首页前序 441/452 有真实截图，不能冒充本轮当前视觉资格。不操作用户 18571、窗口、进程、数据库；不建 branch/worktree，不清历史，不运行 UI 自动化。若需要真实 Provider 预检，已授权 auth 与完整 models 必须新鲜成对，验证 credential、catalog、实际 gpt-6.1-sol 与流式，全部结算后退休，秘密不入日志或提交。

## 修改前分析

先追查剩余性能，证实 Windows Git 路径查询已合并，且旧并行扫描实验无整体收益；不重复假称新优化。本轮回到 Goal 公开使用链路，读取当前 continuous-goal 架构、controller/store/schema、三个 HTTP 路由、原正常/恢复/跨进程测试、公开 server error handler 与 helper、SDK 生成源和调用点。

可观察问题：Goal 读取、创建和更新的 HTTP 409 实际返回 name=ContinuousGoalError，而已生成 OpenAPI 与 TypeScript SDK 把三个英文说明句作为 name 的字面类型。直接触发为 owner 不可用、重复创建或 revision 冲突。根因是三处 namedErrorResponse 参数颠倒：唯一 helper 签名是 description, firstErrorName, ...，Goal 路由按相反次序使用。错误 handler 的 409 映射、领域 schema 与前端 errorSummary 当前均使用真实 ContinuousGoalError，不是运行时换错名称。

全仓 AST（Abstract Syntax Tree，抽象语法树）调查 95 个 namedErrorResponse 调用，所有错误名参数均为静态字符串；仅 Goal 三处呈现错误名在第一位、说明句在第二位的此类问题。全仓搜索三个错误说明的流向，证实已污染 packages/sdk/openapi.json 和 packages/sdk/js/src/gen/types.gen.ts。旧 route checker、文档 freshness 和类型检查都能通过，因为它们校验各自产物/结构一致，没有把真实 HTTP 具名错误与声明字面值相互核对；不能以现有 green 状态排除错误。

影响为 public API（Application Programming Interface，应用程序接口）和 SDK（Software Development Kit，软件开发工具包）消费者的错误辨识/类型收窄。当前 UI 自己按真实 error body 处理，源码、布局、语言、Goal 数据/权限/预算/消息/调度与 Task/Mission/Session occurrence 本轮均不需要改变。不存在当前新队列或终态异常；如真实使用暴露此类问题，立即按全部生产入口、正常/终态、重试/重启、串并行及多项目横审。

## 实施前方案与验收

1. 新增后端正向合同，使用原 ContinuousGoalRoutes、真实 Memory Project/Session/store、Hono error handler 和 generateSpecs，分别触发 GET owner_unavailable、POST conflict、PATCH revision_conflict 的实际 409；将真实具名错误和生成的相应响应 schema/description 同时核对。先保存原失败，不写 UI/DOM/源码断言或负向测试。
2. 只修正三个调用的参数顺序，复用唯一 helper 和领域实现；不增加错误别名、兼容分支、另一响应 schema 或静态 checker 白名单。用当前 SDK build 的隔离 generation transaction 正式重建 OpenAPI/SDK，并按现有 renderer 更新 API 文档；审查全部生成差异，禁止手改生成类型。
3. 原聚焦合同和 continuous-goal 领域合同、相关 server error 合同与 backend/SDK 类型检查通过后，启动新自有 native 开发 /ui 服务，实际 HTTP Goal 创建/读取/暂停/恢复/完成及精确 revision 冲突，对照公开 OpenAPI。LLM（Large Language Model，大语言模型）协议不改，流式预检仅按真实证据报告，不将其冒充新的完整 Goal 执行。浏览器开启后优先人工操作 Goal 入口与默认布局、截图复核；未开启则明确当前视觉未达，不以 HTTP 或构建替代。
4. 保留完整历史；本轮不修改全局保存控制流，因此不重复无目标性能验收或改变原 10s/5s/20s 门槛，原失败继续未完成。原物理/输出/请求/launcher/checker 全部结算，readonly SQLite 核对原身份/归属/目录和 schema，扫描实际秘密后退休配对，归档实际证据。
5. 三索引和相关当前架构同步，当前 docs/API/architecture 检查，范围 commit；严格等待 fetch/merge 与完整待推集合检查结算后才开始正常 push，fresh fetch 验证。没有 Release/tag/版本发布，持续目标 active。

## 真实运行发现的共享文档根因与补充方案

原三例实际HTTP错误/metadata合同先0 pass/3 fail，修正Goal参数后30例/89断言通过；正式SDK transaction原79600 exit0，只有三处错误literal与description的生成变化，API MDX同步。后端70939和SDK类型检查均exit0。

首次原native18729的SDK状态链已实际跑通active→paused→active→complete，并验证三种真实409；公开/doc最后一步失败。最初checker把Windows canonical反斜杠与输入正斜杠直接比较，保留该工具失败，按path.resolve正规比较修复，未改产品路径事实。第二次失败是实际产品文档遗漏：Server.loadProjectRoutesApp把完整AppRoutes挂在外层proxy下；AppRoutes的/doc却用传入外层root生成schema，外层Hono只有global/auth/UI与项目proxy，不包含实际项目route metadata。Server.openapi/routeInventoryApp的CLI清单完整，当前public/doc和生成SDK已形成不同文档事实。不能改checker只读CLI来掩盖真实HTTP遗漏。

扩展范围仍是同一Goal公开错误/文档流。修改前全仓核对AppRoutes仅Server内部两个构造调用、loadProjectRoutesApp两个调用与openAPIRouteHandler唯一使用。准备删除仅为旧root文档传参服务的参数，/doc以延迟dynamic import调用唯一Server.openapi生成完整清单，CLI和HTTP复用同一query/required-body正规化；不新增文档cache、另一spec、默认空清单或提前初始化项目。routeInventoryApp构造原Hono router/schema并重置的是lazy route factory引用，不是现有运行Hono实例或业务/Provider状态；已构造路由持有原闭包，不能在此增加runtime reset。新增真实Server.App /doc与Server.openapi完整operation集合正向合同，另覆盖并发文档请求与普通具名错误响应。所有现有实际路由、Global/auth/Project权限与Task/Mission/Session调度/队列/恢复/终态不改。若原错误/并发实际检查暴露共享执行异常则立即扩审。

首scope公开shutdown200，原27893 exit0，物理/output/request/launcher及runtime授权对已退休。最终server根因修复须等原测试/生成稳定后启动新scope再验收；首次生命周期成功不能替代最终/doc资格。旧HTTP初次耗时字段0只是checker占位，保留原失败不作为延迟证据；修正后均记录实际performance.now区间。

扩展完整schema正向合同再发现上游hono-openapi 1.1.2的真实共享元数据变异：getSpec浅复制responses后直接给共用media对象的raw.schema赋值。第一次生成把AuthReadUnavailableResponse及ERRORS中带ref的resolver替换为$ref；后续生成再无toOpenAPISchema去登记components，三个真实定义丢失。原32例运行中，完整operation已修复且并发operation检查通过，但完整schema等价失败；保留contracts-final.log，不删除/收窄该正向检查。

全部生产generateSpecs调用仅Server.openapi。准备在唯一routeInventoryApp边界对用于生成的describeRoute metadata创建新的描述middleware：仅复制responses/content/media容器，保留原schema resolver、验证middleware与schema对象；生成器只改新media容器，不改活跃路由或模块常量。使用库已公开的uniqueSymbol、HandlerUniqueProperty、describeRoute，不patch node_modules、不cache文档、不逐错误补schema、不新增第二错误工厂。每次调用（含并发）拥有自己的容器和components。现有reset factory语义保持，全部operation与完整序列化schema正向等价及并发普通HTTP错误必须通过。初始与后续生产生成均必须走该边界，完成后正式SDK重建确认差异仍仅当前Goal三处。

当前完整运行的native public/doc已覆盖345 operations，components与生成SDK完全一致。初版最终checker还将CLI generateOpenApiSpec专门添加的x-codeSamples与Server.openapi原文直接比较，因这个既有文档展示扩展而失败；独立逐字段调查确认components无差异，paths差异为该CLI展示字段。不是新的schema缺失，也不需要把示例生成移动成另一产品功能。保留原失败和原checker，最终比较仅正规掉明确由CLI添加的x-codeSamples，仍对全部paths字段和全部components逐一完整比较，并进行重复/并发真实请求。新增完整Server.openapi原始schema正向相等检查保持原样，没有删断言或将HTTP换成离线证明。

第一次module-topology默认只检查HEAD，保留其日志，不作为未提交代码资格；随后精确暂存本轮源/SDK/测试后执行--index，原9598针对实际index:6fba3a15e36c完成1171 modules/5987 runtime edges、4 clean imports且exit0，未绕hook或创建分支。最终两个runtime schema正向合同97061 exit0/9断言，完整Goal/validation其余30例亦通过；新的容器clone保持上游允许的undefined response/media条目，初版漏守卫造成500的失败日志保留，未交付该中间实现。

## 最终验收与交付范围

最终生产范围为三个Goal错误调用顺序、AppRoutes/doc复用canonical Server.openapi、删除旧root参数，以及routeInventoryApp为每次生成持有独立response/content/media容器。上游resolver与原schema/validation函数不复制，undefined entries按原合同保留。正式SDK最终原30172 exit0，生成diff仍仅三个Goal错误literal与说明；英文/中文API MDX正规生成。App文件首次格式化带来的无关restart/SSE/diff排版差异已逐hunk审查并精确回收，没有保留无关清理。

最终原97061 runtime文档2例/9断言通过，加上原85678其余三个文件30例/89断言，共32例/98断言；失败中间结果全部保留。原96421后端typecheck exit0，SDK typecheck与正式SDK staging tsc通过。原9598 --index已结算0且覆盖本次源，不把HEAD-only默认检查冒充新源码验证。

最终18731使用完整新SDK，14个实际请求通过：Goal active→paused→active→complete，保留同一goal/owner/revision事实，三类冲突正确返回ContinuousGoalError；重复/并发三份实际doc均345 operations/315 schemas，完整wire metadata/components保持。原SDK所带CLI x-codeSamples为明确的展示扩展，checker仅按其真实合同正规掉该字段。Goal的turnsAccepted与tokensUsed本次均0；完成是operator合同检查的真实操作，不宣称新自动Goal执行。两轮独立预检均实际gpt-6.1-sol/streaming。

原native27893/6812、所有HTTP checker均结算，两个公共shutdown200，物理/output/request/launcher及runtime配对关闭。之后readonly SQLite确认schema2/106 Project/143 Session，逐行保留两个基线全部身份/归属/目录；初次checker产生的空Chat与各轮真实Goal历史没有删除。两组private auth/models在实际秘密扫描后精确退休，源未写入。用户18571及用户进程、窗口、数据库未操作。

实际使用内置cua.getState后仍返回Work local browser disabled，新的开启确认问题仍等待用户；没有重试绕过、UI自动化或当前视觉资格。原全量保存性能失败继续未满足，本轮不改其控制流或门槛。证据见[归档](../../artifacts/2026-10-20-goal-error-contract/README.md)。三索引与continuous-goal/server-runtime-readiness当前架构已同步；docs/API/architecture最终检查后范围commit，等待fetch/merge与完整待推集合检查终态后再正常push，fresh fetch复核。没有版本/tag/Release发布，持续目标active。
