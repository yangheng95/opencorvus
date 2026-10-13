# 持续迭代首批：代理认证原值

## Recall

用户要求持续迭代当前版本，直到明确停止：按批次并行体验 UI/UX（User Interface/User Experience，用户界面/用户体验）、功能完成度和缺陷；每批先分析并落盘，再修复、真实桌面页面截图人工复核、聚焦正向功能测试、必要且获得授权的 GPT-6.1 Sol 端到端验收、提交、上游合并和正常推送，随后进入下一批。开始 HEAD ba1c6e5a6，main 跟踪 origin/main，工作区干净。只使用当前分支，不创建额外工作树、不发布。

已读根 AGENTS、当前 05-config/07-panel/server-runtime-readiness、近期更新日志国际化记录及证据、379 月记录、package 脚本及 pre-push。使用 benchmark-debug-template 的输入→输出→根因→复验闭环；UI 不建立或运行自动化测试。两个单层只读分工分别调查功能和设置界面，禁止再次委托。二者独立发现代理认证被 trim；功能分工进一步复现裸百分号导致 Node.js undici URIError。UI 分工追踪保存/测试/服务端回填共用草稿；另发现 SearchField 清除后焦点候选，留到后续批次真实验证。

全仓检索 NetworkProxy/authenticatedProxyUrl/resolveNetworkProxy/testNetworkProxy：定义在 config/config.ts、util/network-proxy.ts，消费者包括 provider/provider、tool/webfetch、tool/exa-mcp、browser/proxy、util/network-proxy-test、server/routes/config、overlay services/config 与 NetworkPanel；SDK（Software Development Kit，软件开发工具包）生成类型引用相同 schema。读取代理 transport、现有 network-proxy-fetch-init 功能测试及 dependency-proxy-contract 本地真实 Node 代理脚本。未检索到本批 UI 自动化测试。配置/代理历史索引检索未发现认证应裁剪空白的公开约定。

## 现象、根因与影响分析

观察：当前 schema 和 authenticatedProxyUrl 把含首尾空白的虚构密码改成另一字符串。NetworkPanel 输入本来保留 value，但 readProxyInput 也 trim，因此保存与测试两条路径同时受影响；保存回填再次显示已改写值。schema、工具函数重复裁剪，单改 UI 不足。用户名同属于认证身份，须核对并保留原值。URL（Uniform Resource Locator，统一资源定位符）的地址本身仍允许裁剪外围空白。

第二个同链路问题：直接把原始百分号凭据赋给 URL.username/password 并不编码百分号；Node undici 消费时 decodeURIComponent 会报 URIError 或把形似转义的原始文本当成已编码文本。需由唯一 authenticatedProxyUrl 编码原始字段一次，再由标准 URL 序列化。先核对浏览器代理解析也按同一编码合同解码，不引入平行配置或后备通路。依据：[WHATWG URL password setter](https://url.spec.whatwg.org/#dom-url-password)、[RFC 7617 Basic authentication](https://www.rfc-editor.org/rfc/rfc7617.html#section-2)。

影响面：项目/global 配置 schema、UI 保存/测试草稿、所有代理消费者、Node/Bun 两运行时、浏览器代理的用户名密码读取。字段名和类型、HTTP（Hypertext Transfer Protocol，超文本传输协议）路由不变；现有 min(1)、密码需用户名、URL 禁止嵌入身份的校验保留。已被旧路径裁剪并保存的信息无法自动恢复，用户需要重新输入。无 Task/Mission/Session 调度、队列、唤醒、恢复或数据库合同修改，当前没有发现相关异常。真实 Provider 端到端不适用于这批原值传递合同，不复制或使用真实凭据。

风险：编码两次、空白用户名/密码被错误当成空值、仅 Bun 通过掩盖 Node 解码失败、浏览器消费异常、孤立 UI 保存需要有效项目配置。未知项先通过实际基线运行确认，不以 mock、DOM（Document Object Model，文档对象模型）或源码断言当验收。

## 实施与验收方案

1. 建立任务独有的无凭据 HOME/运行目录和空项目；清空子进程继承环境，仅保留运行系统项，使用现有 Bun 1.4.0 和源码 production listener/recovery，私有前端构建，经 localhost:18571/ui 做桌面人工交互。不得操作已有用户服务或窗口。服务使用现有 server.stop 收尾，自有停止标记和有限服务租期；这不是模型任务超时。
2. 在源码改动前补齐实际配置/代理基线输出及页面截图，只有本地虚构测试数据；结果日志仅记录身份匹配/状态/断言，不记录真实凭据。完整测试输入只作为明确公开虚构测试数据存在测试代码中。
3. 删除 UI、schema、唯一 URL 构造处的认证 trim；在唯一构造处把原始认证字段编码一次。保留 URL 地址正规化和原可选字段合同。完整影响分析确认后实施。
4. 聚焦正向功能测试验证 schema→URL→真实本地代理认证，覆盖前后空格、纯空格非空值、字面百分号/转义外观、保留字符、用户名与密码。Node 真实 undici 通道和 Bun fetch 通道分别验收；已有浏览器解析入口验证原值。无需真实模型或外部服务。
5. 重新私有构建、启动新的自有服务快照；中英文页面手动保存及重开验证。截图保持密码遮蔽，以真实保存配置和代理请求结果支撑数据结论。当前内置测试按钮的外部204地址不擅自改写或拦截成假成功；若只做本机传输验收，明确和按钮外部连通性分开。
6. 更新当前配置架构与本记录、索引；运行相关功能 runner、类型/目录检查、docs:check 和正常 pre-push。逐文件审查并提交，fresh fetch→merge upstream→审查完整 upstream..HEAD→必要复验→正常 push。未达成部分如实记录，完成后进入下一批。

## 当前进度

完整消费端核对完成：BrowserRuntime.resolveBrowserProxyConfig 对两字段各 decodeURIComponent 一次；Node 当前 undici ProxyAgent 同样解码，Bun 真实代理请求也解码。用户名、密码属于同一个原值保真合同。现有 SDK/OpenAPI 仅表示 string/minLength，不表达 trim；移除裁剪无需更改字段类型或平行生成契约。用户名冒号、控制字符的新校验不纳入本批，不把其当成功样例。

根因分析完成后，委托功能分工仅新增非 UI 正向测试与 Node 本机代理 fixture，先运行基线；主 agent 负责全部产品实现、页面与最终复核。基线独立源码服务 pid66004 / occurrence67236c2a-fda1-48ec-a707-3ffc82c14b3a，经实际 /ui 页面手动输入虚构原值并保存，原生输入阶段与 Saved 状态均截图人工查看。真实 canonical project `.opencorvus/opencorvus.jsonc` 两字段原值比较均 false，长度分别13/17，证明实际保存时外围空格丢失；首次误读项目根目录文件失败，未作为验收证据。页面已关闭，服务经 server.stop 自然 exit0。

构建首次从仓库根运行时 root:src 相对工作目录导致 /main.tsx 解析失败；已改为 package 正确工作目录重新运行原 Vite 构建，55.19秒 exit0。这是本任务命令修正，不改生产构建配置。所有输出与截图暂存 `.tmp-codex-iteration-20261013`，最终选择事实归档。产品源码仍未修改，下一步等聚焦功能基线后实施三处统一修复。

## 实施与实际复验

基线20项7通过/13失败后，统一删除UI/schema/helper的username/password裁剪，唯一helper对原始身份encodeURIComponent一次。Node/Bun真实本机传输、浏览器代理解析、schema均通过，连同已有fetch-init共21项/23断言。独立功能分工审查未发现阻塞。更新05-config唯一合同及双语未发布日志，版本不变。

实际页面已完成英文保存、测试及切中文后重开测试。落盘原值比较从两个false变为两个true，长度13/17变为15/19；两次真实CONNECT均完整保留身份。观察代理不向外网连接，真实返回502，页面英文/中文错误摘要已截图人工复核。所有传输成功样例在本地功能测试独立验证；本页502不能称外网成功。详见[证据](../../artifacts/2026-10-13-proxy-credentials/README.md)。

跨turn继续时原exec句柄缺失，after服务和观察代理端口均已关闭、原服务PID已被其他进程复用，缺少after正常终态文件，退出码未知；不操作这个复用PID，不把未知退出归因于生产调度或伪称正常收尾。before已有生产stop/exit0。为最终收尾追加新的独立scope，不复用旧数据库。另发现scratch名称与并行模型搜索任务相同，最终构建及服务改用唯一`.tmp-codex-proxy-credentials-01a133`；仅保留和归档已知本任务文件，不移动或覆盖对方产物。

最终唯一目录构建65秒exit0。新服务实际中文保存再次保留原值，截图人工查看；自有页面关闭后server.stop完成，原exec30033实际exit0、terminal回执和物理退出/端口关闭已归档。聚焦21测试/23断言、Overlay类型、i18n目录、docs检查通过。当前等待范围提交、上游同步及正常push；下一批候选为共享SearchField清除焦点，仍需实页复现，不先假定缺陷已成立。
