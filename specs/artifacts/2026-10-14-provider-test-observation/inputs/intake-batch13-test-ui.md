# 第13批 Provider Test：单一结果 owner、退休边界与反馈复核

## Recall 与资格边界

本报告承接同目录 `intake-batch13-ui.md`，依 Root 最新委托只读复核 Provider Test 的 editing/saveKey/delete/auth/目录刷新、Panel 重挂、scope/authority 和在途 completion；核对当前语言短摘要、完整展开详情的现有 primitive 与相关语言键。只写本 scratch，不修改产品、测试或正式 spec，不启动服务，不使用凭据或调用模型，不操作浏览器，不执行 UI 自动化，不再委托。

已全仓搜索 `testProviderConnection`、`ProviderTestResult`、`providerTest`、`setProviderTest`、所有 Panel `testResults` 写入及 `providerState` 调用，读 project/global HTTP 路由、共享 Provider producer、config-load、Save/Auth/refresh/delete、Feedback/Disclosure/CSS、现架构与 B9–B12 历史。开始工作区有其他任务的 compaction/permission/navigation 等修改，全部保留。本轮只是源码与历史事实；Root 正取得本批前态，本文不能宣称任何 Test 实页或模型请求通过。上一报告亲自查看的 B11/B12 图只能证明继承声明/现有 Feedback 布局，图中没有 Test 运行结果。

## 最重要的结论

1. 当前真实 Test 结果只有 `ProvidersPanel` 顶层 Map 一个 owner；“row remount 会清结果”的注释不成立。已有 scope/authority fence 完整，但同 scope 接受配置/凭据变更后没有退休旧 Test，删除只清 Map 没有退休在途 completion。
2. **不要把 `providerTestScopeGeneration` 当作仅 Test 的 generation。** `providerLoadOptions` 把它用于全部 Save/Auth/refresh/load 操作；为清 Test 递增它会误退休这些操作。复用现有 per-provider generation，并同步清该 ID 的结果与 busy，才不破坏 B12 的 accepted commit/后续阶段合同。
3. 已有 `Feedback details` 与原生 Disclosure 足够实现短的当前语言摘要和完整原诊断。成功固定英文是产品文案；SDK/Provider 原错误是技术事实，不能关键词翻译。正常语言切换历史上会卸载 Panel，不能把预翻译字符串的源码问题包装成已实页证明跨语言残留。
4. 当前只有 `zh-CN`、`en-US` 两个语言目录（`utils/i18n.ts:7`）；此处核对到的“19”是 6 个 Test 键 + 7 个状态键 + 6 个详情键，而非 19 种语言。另有公共 `common.details`。状态/凭据键不是物理测试回执，不能拿它们合并两类事实。

## 唯一结果与已有归属控制

- `ProvidersPanel.tsx:111–116`：`testing:Set<id>`、`testResults:Map<id,ProviderTestResult>` 属于整个 Panel，不是 `<For>` 子行。`111–114` 注释称编辑/删除由行重挂清理，实际没有这种闭包归属。
- `297–305`：先读 config 显式模型第一项；空集合立即写本地翻译后的错误，不进入请求/generation。继承模型问题见上一报告，不能以这条 UI 分支断言真实 runtime 没模型。
- `307–340`：请求捕获 directory、Panel scope generation、per-ID generation、authority、selectEpoch；只有全部仍 current 才能写结果/清 busy。成功是服务返回 object，catch 仅 `err.message`，没有保留完整 HTTP/Error 诊断。
- `255–278`：directory/authority revision/selectEpoch 任意变化时递增 scope，清 Test generations/results/busy 和其他 scope-owned UI 状态并重读。`434–440` cleanup 递增 scope，旧异步 completion 无权落入新 Panel。相同路径 A→B→A 也由 epoch/scope 保证不会把 A 的旧轮次当新轮次。
- `1216–1262`：Test busy 时只禁用自己的 Test 按钮；Edit、Delete、API Key 和 Auth 各自有自己的 busy，因此同一行 mutation 与 Test 可以并发。结果区始终按 ID 查顶层 Map，不展示实际模型、时间戳或结果版本。
- 新 Test `316` 只置 busy，没有清上一轮结果；等待时上一轮成功/失败仍显示。这是源码可见行为，实际是否造成视觉误读需 Root 点击截图。
- `providerState` 生产调用只有 Panel 自定义/目录行（`928`,`972`）与 `llm.ts:367` 选择项。`appStore.providerTest` 的旧分支在 `llm.ts:245–260`；全包唯一 `setProviderTest` 命中是 `store/app.ts:263–264` 定义，字段/初值 `108/164`，workspace 只清空 `271/1042`。当前 Test 从不写它。不要把局部 Map 同步过去制造第二 owner；若正式 scope 包含删除死路径，应一起退休字段、setter、两个 reset、providerState 无用参数/分支，而不是只删一个调用。

## 逐入口的在途归属与最小边界

| 入口 | 当前实现及明确事实 | 最小处理建议/边界 |
| --- | --- | --- |
| 打开 Edit/Add、取消、表单重开 | `496–535`,`918` 只 reset 表单 occurrence/discovery/saving/输入；没有修改当前 Provider，也不清 Test。 | 仅打开或取消没有 accepted mutation，不要因此把物理测试事实判为已失效。表单 occurrence 与 Test occurrence 保持分开。 |
| 普通 Save | `652–664` 接受 Config 200 或 typed committed409；`665–693` 独立 Auth/cleanup/reload；`695–714` 才关闭表单/反馈。没有 Test 退休。 | accepted Config 后就在仍 current 的 scope 退休此 Provider 的 Test；不能等整个 Save success 或 reload success。typed409 是已提交事实。未提交的 API 校验/Config 错误不应冒充提交。名称-only 是否也清是产品合同选择，按所有 accepted Provider Save 清较小且无需比较秘密。 |
| Save 内 Auth | `672–679` Auth PUT resolved 后 `credentialCommitted=true`；即使后续 cleanup/reload 失败也已改变凭据。 | 该 accepted receipt 也要退休，尤其 Config 提交退休之后用户又开启一轮 Test、随后 Auth 才完成的并发时序；只在 Save 最初清一次不够。每个实际成功写入边界都需保留。 |
| 行内 Save Key | `785–792` Auth accepted 后清输入，之后 cleanup/reload 按 B12 settle 顺序执行；`818` 按 Auth receipt 区分 saved-with-issues 与 save-failed。 | 同一 receipt 边界退休 ID；Auth 失败无 accepted write，独立 reload 仍运行但不可谎称 Key 已改。不要等 finally 才清 Test。 |
| Auth API/OAuth | `371–407` authenticate 返回 true 且 owns 后重读，再显示 connected；busy/auth回执与 Test 无连接。 | 在 true+owns 的 accepted 边界退休 ID，后续读失败不能恢复旧 Test 成“当前”；不能把用户取消/retired dialog 当 accepted Auth。服务仍保留原 authority。 |
| credential cleanup | `685–687`,`799–805` 可改变 config.options 的覆盖；普通 typed409 也可能代表已提交。 | 若本批追求严格 commit ownership，cleanup 的 accepted config 边界也可使在前一 Auth receipt 后新启动的 Test 失效。应沿现有唯一 Config receipt 判断，不能从 catch 文案推断；不得引入 key 哈希/第二缓存。 |
| Delete | `877–896` 接受 committed/committed_with_residue 后删除 Map 项并重读；**没有递增 Test generation，也未清 testing**。 | 接受 removal receipt 即同时退休 ID；现有旧 completion 仍 owns，会重新写 Map，随后同 ID recreate 可见旧结果。失败前未提交不能当删除完成。residue/reload 的两个摘要继续保留。 |
| Provider catalog refresh | `193–207` result.ok 后记时间、保留 issues；`281–287` 无论刷新成功与否都再读。后端 `routes/provider.ts:165–171` 成功调用共享失效；`provider.ts:731–734` 替换整个 canonical declaration。 | 明确成功提交刷新时退休本 Panel 已知全部 Test generations/results/busy；issues 不撤销已提交事实。不要递增共享 scopeGeneration。不要把单纯 read request fulfilled 误当 catalog refresh committed。 |
| Models refresh | Panel `225–235` 与 `289–295` 同上；后端 `provider.ts:763–814` 当前只读取 OpenCorvus live identities/info 并 `replaceProviderModels("opencorvus",...)`。成功响应已带 `providers:[{providerID,count,ids}]`，两 route schema 也公开。 | 实际受影响 ID 有公共响应事实，可在唯一 service 类型保留 `providers` 后按响应退休，避免 UI 硬编码第二份目标或无根据清其他行。当前 Overlay `ProviderRefreshResult` (`provider-refresh.ts:10–15`) 丢弃该类型字段；若不做精细退休，需正式说明是整次目录重验边界，不能称所有 Provider 都被写了。 |
| 普通目录重读 | `config-load.ts:169–268` 有唯一 loadSequence/authority/directory fence；allSettled 只投影成功资源，失败资源保留上次值并保存 issues。project与global读内容不同；未写 Test。 | re-render/对象身份变化不能证明 endpoint/Key 实际变了。`providerAuthRefreshRevision` 在 catalog **或 Auth methods** 成功时都加一（229/265），不是实际 credential mutation version，不能拿它做精确秘密身份。局部接受 mutation/明确目录刷新可退休；其他窗口/后台配置变化的精确 Test 失效通知当前未知，别声称已覆盖。 |
| 搜索、目录行重算 | 可隐藏/恢复相同行；顶层 Map 保留。 | 不是 mutation，无需仅因 UI 重挂清回执；但旧结果不能被描述为新配置的 proof。 |
| project/global/authority/selection/Panel unmount | 已有 scope/authority/epoch+cleanup 如上，跨scope Test结果不能提交新Panel。 | 保留现有 fence，不合并到 form reset，不删除它们换“ID相同”判断。原请求可能已向旧 Provider 发出；UI退休不是网络/模型回滚，不能宣称已取消收费请求。 |

### 退休实现的三个风险

`providerLoadOptions:142–153` 中 scopeGeneration 被全 Panel 的 Save/Auth/Refresh 使用。单 Test 退休应只操作现有 per-ID generation、testing、testResults，不能动 scopeGeneration。

退休必须是一个一致动作：generation 单调增加，结果移除，testing 移除。只增加 generation 会使旧请求 finally 的 `ownsResult` 为 false，原 busy 永久留下；只清 Map 会让旧 completion 写回；删除/归零 generation 会让 delete→recreate→new test 与旧 generation 碰撞。整个 Panel scope 清空 Map 已有独立 scope 增量，所以该场合仍安全。多 ID 测试并行时，一个 ID 退休不得清另一个新请求的 busy。

Config Save/Key/Auth/cleanup 是不同已接受写入点。前一个阶段退休后新启动 Test，后一个阶段又改变事实，因此“保存开始时一次性清结果”不充分。最小实现应明确 accepted phase 边界，保持 B12 `owns` 及串行 settled loop；别用一把全局忙碌 gate 禁止全部按钮规避归属问题。当前仅是 UI 观察归属候选；没有发现或运行 Task/Mission/Session 调度异常，本文不宣称其恢复/终态矩阵通过。

## 当前语言与完整详情：可直接复用的一个表示

- `Feedback.tsx:5–9,22–35` 现有 details + error alert/success status + aria-live；`Disclosure.tsx:37–45,57–65,74` 使用原生 details/summary。`feedback.css:34–40,56–62` 已有最小宽度、任意长字换行、原文 pre-wrap/可选中，勿新造另一个折叠错误组件。
- 当前 `ProvidersPanel:1257–1260` 直接把任意 `result.message` 放主摘要；成功 producer `operations.ts:238` 总返固定产品文本 `Provider is reachable.`，所以中文 t(success) 常规成功被覆盖。失败 SDK/Provider 原文应保存在 Details；catch 的原Error可通过已存在 `formatErrorDetails` 保留 HTTP method/status/path/requestID/body。`error-details.ts:25–27` 已对 typed Config receipt 使用安全诊断投影；不能重新拼完整 config。后端原错误的 redaction 仍属原 producer，Overlay不做新关键词秘密识别。
- 最小结果 shape 保存机器事实（ok/必要typed reason/实际模型identity）与原 diagnostics，渲染时选择 t(success/failed/明确precondition key)，不保存预翻译摘要，也不复制到appStore。Panel已有 `ProviderFeedback:49–68` 的key/vars/details模式，但 `ProviderMessages` tone固定error；不能将测试成功直接塞进去而显示error。
- `utils/i18n.ts:50–52` 读取 localeSeq，render时 t 会响应当前语言；`169–178` 切换实际目录。B10历史 `2026-10-13-config-jsonc-diagnostics.md:66` 明确普通设置切语言会卸载 Panel，故旧 no_models 存字符串不能单独证明用户切语言后仍留旧语言；固定英文成功在任意新的中文 Panel 都同样覆盖摘要。
- Test没有时间/持续时长事实；Header `formatRelative` 是两个refresh timestamp。若正式方案要显示测试时间，需要真正接受response时的事实，属于新增能力，不为“修本地化”捏造 timestamp。实际 provider/model ID、URL、HTTP技术标识和原文不翻译。
- `settings.css:3012–3021` 保留 main/summary/actions→key→result→models 原顺序，`3100–3107` actions wrap，`3219` result grid area。只把主摘要改短、详情折叠即可保持密度；无已验证需要新增 CSS。长详情完整可达、keyboard focus 和收起后的行密度必须由 Root 实页截图确认。

### 当前 19 键的用途核对（两种语言均存在）

| 分组 | 键 | 可复用范围 |
| --- | --- | --- |
| Test 6 | `provider.test.button`, `.button_title`, `.testing`, `.success`, `.failed`, `.no_models`（en/zh:484–489） | controls/忙碌/成功失败摘要已有。no_models文案要求“先添加模型”，与可继承目录存在冲突；若改变选择合同须同步改准确文案或退休该前端分支，不保留无生产引用键。 |
| 状态 7 | `llm.status.auth_required`, `.available`, `.configured`, `.api_key_unknown`, `.connected`, `.error`, `.needs_api_key`（en:1017–1023，zh:1016–1022） | catalog/auth状态保持原owner；不是 Test receipt。不能因 `configured` 或 true apiKeyConfigured 就宣称“测试成功”；unknown不是false。 |
| 详情 6 | `llm.detail.auth_methods`, `.available`, `.configured`, `.api_key_unknown`, `.connected`, `.needs_api_key`（en:1011–1016，zh:1010–1015） | 仅对应配置/认证状态详情，保留真实身份。不能用needs_api_key给所有无runnable Provider归因。 |
| 公共额外 1 | `common.details`（两目录728） | 现有折叠触发器直接复用。 |

后端现有 `operations.ts:178–200` 先通过 runnable Provider 取值，缺 Provider 统一返回“先配置key/auth”，所以空runtime/被排除也可落同一错误，不能仅映射英文关键字作缺凭据分类。public Test route已允许省略modelID，后端 `191` 有唯一排序/选择；Overlay `llm.ts:426–438` 目前强制string，Panel仅用config第一项。正式方案如纳入模型可测合同，应让后端真实模型事实负责，而不是前端复制runtime模型准入或把成功发现当连接成功。

## 历史决定与旧路径未根治原因

- `specs/current/architecture/06-provider.md:387`：global/project共用Provider实现，没活动项目不是测试/认证前置条件。
- `07-panel.md:2799–2819`：空声明保存/目录继承与真实推理资格分开；Config/Auth/read分别保留真实receipt与owner。
- `07-panel-reactivity.md:43–51`：短摘要key/vars与原Details，渲染时t，独立成功/失败事实；无平行状态/重试旁路。
- B9 `provider-credential-presence.md:19,48` 把旧appStore.providerTest当候选延期；B10 `config-jsonc-diagnostics.md:11,28,56,66` 明确排除Test回执；B11 `provider-empty-declarations.md:31,80` 延期Test语言，且已证明保存空声明不等于runtime空；B12仅改Save/观察链。故这一轮不能把前批改短错误/能保存0声明描述成已解决Test。
- 既有authority工作修 scope/selection fence，不覆盖同scope接受模型/Key变更后的Test有效性。注释称行remount清理不构成已实现行为。此前保留错误摘要的方式仍把backend message优先当产品正文，真实诊断在catch还降为message，正是现有缺口。

## 只列直接相关正向业务测试（全部未运行）

| 路径 | 当前直接相关正向契约/局限 |
| --- | --- |
| `packages/overlay/test/llm-provider-operation-scope.test.ts:43,58` | 唯一Test service的global/project正确路径、POST明确modelID请求与返回值。使用fake HostTransport，只证明服务路由/数据，不能证明页面、真实Provider或模型stream。若允许backend选默认模型，须补/更新明确请求body与响应契约，不能以“不发送”负断言代替。 |
| `packages/overlay/test/provider-auth-authority.test.ts:40,88,96,105` | 两scope入口token/body、OAuth真实occurrence绑定、retired accepted私有outcome、current refresh token。若动Auth调用边界应保持；不证明Panel Map退休。 |
| `packages/overlay/test/config-load-ownership.test.ts:26,41,61` | 当前项目目录投影、旧global响应之后的新项目精确状态、旧server完成后当前server/project投影。只证明data ownership。 |
| `packages/overlay/test/provider-refresh.test.ts:41,55,65,83` | project model/global catalog路径；partial issues与失败明确日志/错误。如保留providers IDs供退休，可测试完整成功响应值。 |
| `packages/overlay/test/provider-save.test.ts:4,28,73,100` | cleanup→目录观察顺序、失败后独立读结果、阶段错误顺序、退休后已接受stage私有结果。本批不能为清Test破坏这些既有正向事实。 |
| `packages/overlay/test/provider-form.test.ts:32–108,176–299` | 空声明/继承、只改显式字段、保留peer metadata与明确identity冲突；与Test不能只读raw config集合有关。不测试UI。 |
| `packages/opencorvus/test/provider-discovery-bootstrap.test.ts:189,213,260,281,295` | canonical声明/配置override、configured vs runnable不同事实、live模型refresh、明确credential错误、Auth503。未请求真实模型，不能冒充Test正向stream。 |
| `packages/opencorvus/test/provider-error-redaction.test.ts:5,26,83,182` | 结构化Provider错误完整安全诊断/stream错误正向输出。如果本批改变error producer可定向沿用；仅使用现有格式器的UI渲染不应扩为无关秘密识别。 |

所检索的 `packages/overlay/test` 对 Test function/key/对应结果class只命中上述服务测试，未遇到该目标的DOM/组件/快照/Playwright UI自动化；没有运行任何测试，也不宣称全仓无UI自动化。不能给Panel写源码文案断言、组件渲染或自动浏览器生命周期测试。若正式新增纯非UI helper，测试必须验证真实当前业务的明确输出/错误，不把只为可测性抽取的状态机当必要架构。

## Root 真实桌面资格建议（尚未执行）

1. 两scope、中文/英文各有至少一次真实Test结果；原config空但catalog继承有模型应与真正零可用模型区分。无凭据只做真实前置错误，不能把本地样例Key成功发现当推理通过。目标Sol模型如需要调用，应由Root按已有授权和成对auth/models隔离合同独立实施。
2. 成功短摘要、实际模型identity（若新增）、长错误Details展开/收起、Tab/Enter及长内容滚动、两行同时成功/失败与搜索恢复。禁止浏览器inject/intercept/fake state/network。截图人工检查原区域和原信息密度，不以DOM字符串/typecheck代替。
3. 完成一轮Test后实际改API/模型或保存Key；已接受写入即观察旧回执退休，保存后目录读取失败时仍不能复活。仅打开Edit/Cancel对照。凭据只由Root在授权自有scope使用，不进入截图/日志/spec。
4. 在真实较慢请求期间实际Delete并同ID重建、Save/SaveKey/Auth、目录刷新；观察旧completion归属与新Testbusy完成。若真实时序未碰到，标记该竞争窗口未实跑，不能用synthetic delayed response冒充。不为复现挂住模型/改用户服务。
5. global→project→global、authority重新选择、Panel离开重进；旧在途结果应归旧实例，当前新Test能正常终结。并行两个Provider明确A retired/B正常完成。正常语言切换重挂与新中文结果另验，不假设旧页面存活。
6. 目录成功刷新+后续load问题、单纯失败刷新+恢复读分别记录；精确区别catalog replacement与OpenCorvus models replacement。其他独立窗口/backend外部改配置的通知传播目前没有本报告资格，不扩大声称。

当前等待 Root 的真实前态、正式 Recall/spec 决定实施边界。本报告没有新增产品/测试/正式文档修改，也没有 Test 模型调用或实页验收结论。
