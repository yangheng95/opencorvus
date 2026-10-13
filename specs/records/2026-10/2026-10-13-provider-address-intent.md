# 持续迭代第五批：Provider 地址编辑合同

## Recall

用户要求持续分批并行体验 UI/UX（User Interface/User Experience，用户界面/用户体验）与功能，直到明确停止；先根因/影响分析落盘，再实施、真实桌面交互与截图人工复核、聚焦正向功能测试、必要且已授权的 GPT-6.1 Sol 端到端验收、范围提交、fresh fetch/merge upstream 与正常 push，然后下一批。第四批 43a596c26 已推送。开始工作区有其他任务的依赖补丁、权限恢复测试、产物/来源记录和共享索引，全部保留；不建分支或工作树。

两个既有一层只读分工：UI 分工调查设置表单，功能分工调查 usage（用量）适配器；禁止再次委托。功能分工发现 Venice SDK（Software Development Kit，软件开发工具包）流式用量转换重复输出总量的独立候选，下一批单独收敛，不把局部合同当真实账单。本批不改它。

已读 ProvidersPanel、provider-form、其七项纯数据测试与当前测试运行器，Config.Provider/ModelsDev.Provider 定义、provider/base-url 和 operations 的发现入口、06-provider/07-panel、2026-10-04-product-experience 和 2026-10-13-release-notes-i18n。全仓搜索 applyProviderForm/providerFormValues/apiInvalid/api_invalid/discover-models、api/baseURL 的定义与调用及现有 URL（Uniform Resource Locator，统一资源定位符）验证：唯一表单写入 helper 为 applyProviderForm；底层 baseURL 解析拥有环境变量模板展开；发现接口已有独立 HTTP（Hypertext Transfer Protocol，超文本传输协议）请求/已存密钥地址归属校验。不存在可复用的表单地址校验。命令中 Windows 通配路径报错后改用目录加 rg glob 重查，不能把失败搜索当覆盖。

权威资料：[WHATWG URL 标准](https://url.spec.whatwg.org/#api)明确 URL 构造器的解析失败及 HTTP 特殊协议 host/port 校验；仅 http(s) 前缀不能验证主机/端口。使用宿主标准 URL parser，加表单公开要求的显式 http:// 或 https:// 前缀，不手写完整 URL 正则。

## 现象、触发、根因与影响

主 agent 在独有 .tmp-codex-provider-url-01a133/before、18573 启动生产 listener/recovery 和上一批私有前端，环境清空、独立项目与运行根，没有真实凭据或模型调用。真实中文设置→模型服务商→添加，输入 not-a-url，空 Key，独有 ID audit-invalid-endpoint，手填 audit-local-model。页面红色地址错误与启用的添加按钮同时可见；点击实际保存，表单关闭、列表显示 API: not-a-url；实际 project/.opencorvus/opencorvus.jsonc 含该 api 和模型。三张截图已人工查看，原始配置/启动/终态保留。自有页面已关闭、原 exec37467 实际 exit0，PID81148 及18573 listener已退出。

直接触发：按钮不在原生 form，type=url/required 不自动校验；Save/Discover 只检查非空。根因：错误提示的 apiInvalid 是单独前缀正则，数据 writer 只整理字符串，呈现与写入没有共同合同。历史 i18n（国际化）记录明确只把不可见 customValidity 换成可见本地化说明，不增加配置合同，故仍可提交。

影响新建与显式修改地址、鼠标/键盘保存、发现入口、域名/IPv4/IPv6/端口/大小写协议、空值及合法本地服务。公共底层 Provider 配置还支持 api 缺席、模型级声明、${ENV} 和 Vertex 变量；不能收紧全局 schema 或破坏只编辑名称/模型时对未编辑地址的保真。现有 helper 保留并发未触碰字段和完整模型元数据，这个契约须继续。已有无效配置不自动迁移；本批只处理表单明确提交的地址意图。用户直接编辑配置、catalog/runtime 模板、供应商请求/凭据和模型本身排除。无调度、队列、唤醒、恢复或终态异常；这些机制不受影响。

## 实施方案（产品修改前）

1. provider-form 内只有一个纯表单地址校验函数，返回 changed/value 或明确 REQUIRED/INVALID 错误码。整理沿用原 trim/末尾斜线合同；新建或相对于 initial 明确改变地址时用标准 URL 检查 HTTP(S) 及有效主机，并拒绝 Fetch 无法请求的 URL userinfo（地址内用户名/密码；[Fetch Request 合同](https://fetch.spec.whatwg.org/#dom-request)）。initial 未改变时保留 canonical current 地址；不按模板关键字白名单放行、不增加 fallback 或后端配置双源。
2. applyProviderForm 只在写入显式地址时调用同一校验并抛出具名错误。Panel 的本地错误、Save 和 Discover 都消费同一函数；Discover 总是校验当前可解析 HTTP(S) 地址，不借用未编辑 exemption。这不证明连接可用或模板已展开；URL parser 接受路径中的字面变量，底层展开仍只有原 owner。Save 在异步配置写入前给本地化错误；按钮据同一合同表达可用性，输入 required 跟随显式编辑。保留原输入修正、并发所有权和完整字段意图。双语 api_invalid 文案明确要求完整有效 HTTP(S) 地址。
3. 聚焦纯数据正向测试：合法远端/本地/IPv6 地址输出、畸形值→明确错误、原当前并发/未编辑模板/缺席地址保真；不新增/运行 UI 自动化。执行现有 Overlay 类型/i18n/Node 私有构建与文档 checker。
4. 新独立后态 source backend /ui 桌面真实交互：中英文无效地址提示/保存与发现可用性、先坏后好修正、有效 HTTP 本地地址保存与重开编辑、实际配置读回；无密钥、发现网络请求、连接测试或推理。UI 只人工截图复核，数据测试不替代视觉。必要真实模型验收在此数据完整性修复不适用。
5. 更新 07-panel 和双语未发布日志、根/月/artifact 索引。自有服务正常 stop、实际 exec exit 与 PID/端口回执。只提交本批文件和共享自身条目；fresh fetch/merge、审核全部待推提交与必要验证、正常 push；持续目标保持 active。

## 状态

根因/影响、真实基线与方案完成。产品源码尚未修改；后态与提交推送待执行，不声称通过。

## 实施与最终验收

已按上述方案实现唯一 validateProviderFormApi，原 apiInvalid 前缀单独实现删除。helper 输出 changed/value 或具名错误，Save/Discover 和字段消费同一个合同；未编辑字段仍保留 latest current；输入 required 随显式地址意图。没有后台 schema/API/模型调用/账本或依赖修改。Prettier 在本批五个文件中整理同文件已有长表达式，未改变其他行为。

首轮类型检查发现当前非 strictNullChecks 配置不能用 !ok 收窄 boolean 联合；改为 ok === false 后原 typecheck 重跑实际 exit0。保留首轮错误日志。一次未发布中文日志插入误命中历史标题，立即删除本任务的历史插入，实际 diff 确认最终只有未发布中英各一条，原历史内容保留；没有提交或发布过错误中态。

后态新 stage after/PID78072 使用本批 Node 私有前端，真实 production /ui，全部环境与运行根隔离；额外明确人工输入两个无凭据 fixture（测试声明）：models-only 与未展开模板。中文实际 not-a-url、超界端口与不完整 IPv6 显示完整有效地址错误、发现/Save 均禁用；先坏后好修正本地 http 地址，Enter 实际保存；重开编辑后有效 IPv6 更新 Enter 保存。models-only 名称编辑实际保存且地址仍缺席，API 输入 required=false；模板名称编辑实际保存且字面地址与模型元数据保持。英文非 HTTP 地址错误与描述关联、禁用状态、修正 https 地址后 Enter 实际保存及列表均已截图人工查看。没有点击模型发现/连接测试、注入响应或真实 Provider 请求；这些地址的连接能力和模板展开未验收。

真实 after-config 读回四个声明：Inherited renamed 保持缺席 api 与原模型对象；Template renamed 保持 https://${AUDIT_PROVIDER_HOST}/v1；audit-valid-endpoint 为 http://[::1]:17879/v1；audit-en-endpoint 为 https://example.com/v1，两个新增模型均有完整标识。不存在凭据。本批没有删除用户数据；仅自有空运行根保留作证据。

最终11项纯数据正向测试/46断言实际通过，覆盖新增及显式编辑错误、合法 URL 输出、并发字段与模板/缺席地址保真。Overlay typecheck exit0、i18n 2178键/两语言、Node 私有构建 exit0（1分钟）、docs checker 348操作/26组均通过。types/build 与数据测试不替代上述视觉证据；未测试屏幕阅读器、带密钥或异步发现结果、实际远端连接、所有浏览器/模板种类，明确不扩称。

before/after 自有 tab 均关闭；原 exec37467/35038 实际 exit0，生产 stop 终态、PID出生时间和18573无 listener 收尾有回执。[截图、配置和原始输出](../../artifacts/2026-10-13-provider-address-intent/README.md)。范围提交及 fresh upstream 同步/待推集合/正常push继续执行；持续目标 active，Venice 问题下一批。
