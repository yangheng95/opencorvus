# 按草稿请求查找多步任务

## Recall

- 用户要求本人独立持续迭代。每批先真实调查、明确根因和影响并落盘，再实施、本人桌面操作和复核、聚焦正向检查、范围提交、普通合并上游并推送。上一批 `1a475bbc4` 已核对远端，上下游 0/0，177 项原工作区状态逐行一致。此次使用本地隔离数据、两个测试项目、本人浏览器及真实路由。所有草稿未派发，无模型或凭据。
- 已读 `topRowCandidates`、`searchPattern`、Mission 记录的请求投影和 `MissionPendingPrompt`、工作记录现有游标/范围、两条正式路由、命令行 `ledger`、`CommandPalette`、`ArchivePanel`、`matchesSearchParts`、既有测试、双语及 07-panel。全仓查 `pendingPromptText`、`workLedger.listArchived`、`workLedger/list` 调用与 `$.mission.pendingPrompt.text` 的数据库校验。 [草稿预览已交付](2026-11-19-palette-mission-draft-request.md) · [命令面板查询合同](../../current/architecture/07-panel.md#command-palette-queries)
- 验收覆盖全局搜索、归档页、两项目路径范围、精确打开身份、请求中的中英文与百分号、下划线、反斜杠、当前项目与另一项目、游标顺序、保留既有标题搜索。公开接口及真实桌面同时核对。增加正向数据测试，无界面自动化。

## 基线与根因

- `40316/ui/` 提供 `main-CzlgD35T.js`。两个隔离项目有三条同名 `Quarterly Review` 草稿。两条请求包含 `North warehouse box count`，第三条是南区审批。正式归档另有 `Historical Review`，其原请求含 `Archive copper delivery`。实际全局搜索两个北区草稿的共同请求短语显示零项；搜索原标题显示三项，预览保留真实字段。设置归档以原请求短语也显示零项。正式 `/work-ledger` 与 `/work-ledger/archive` 四次 HTTP（超文本传输协议）查询均 200，对原标题分别返回三项和一项，对对应请求返回零项。归档为真实未派发草稿，原请求和零子任务都已由回执验证。 [实页和查询回执](../../artifacts/2026-11-19-work-ledger-draft-request-search/README.md)
- 工作记录在数据库候选查询中匹配各来源的标题、身份、目录、项目、类型，Mission 也允许其真实子任务命中；共同候选没有检查 Mission 规范持久数据的 `pendingPrompt.text`。等命中其它字段的行被投影，`pendingPromptText` 才进入公共结果。命令面板在展开 Mission 后独立检查父项是否命中以免子项命中吞并父项边界，匹配字段也缺原请求。因此只补数据库会使归档能查到，但全局面板继续丢掉仅请求命中的父项。此前预览只解决结果的可辨性，未改变查找范围。
- 同一候选查询为活动与归档读取、全局和指定目录、游标分页、界面和命令行服务。新增匹配只在真正的 Mission 记录中读取当前持久化文本；沿用单一转义参数、SQL（结构化查询语言）筛选、游标和权限边界。未涉及数据结构、模型执行、队列、唤醒、恢复、并发或 Task（任务）/Mission（多步任务）/Session（会话）执行轮次。归档探查只处理本批合成草稿，真实状态符合普通归档结果，没有调度异常。

## 实施与验收

- 在正式候选的 Mission 分支从受约束的 `$.mission.pendingPrompt.text` 匹配文本，在当前归档、项目和游标约束内沿用原 `LIKE … ESCAPE`。命令面板在现有父项相关性判断加入接受行的 `pendingPromptText`，子 Task 保持原字段和原入选粒度。归档输入提示、命令行现有通用选项帮助及公开架构说明同步反映查找能力。响应结构与生成的接口形状无改动。没有并行索引或合并数据路径。
- 现有生产路由测试添加正向请求搜索，分别验证跨项目稳定续页、指定目录、带中文与三个字面符号、归档精确结果、标题与原请求身份。候选沿用基线两项目和隔离数据。英文全局短语打开对应真实草稿，中文用含中文字面符号的短语精确找到另一条，再经简体中文归档按原请求打开原归档会话，核对只读原文。真实接口独立测两个项目、分页、活动/归档与完整请求。运行原工作记录和路由、类型、双语、正式构建、文档与架构检查。关闭本人浏览器和服务后做范围提交与推送。

## 实际验收

- `40318/ui/` 返回正式构建的 `main-VddIzLo0.js`。英文全局用 `North warehouse box count` 得到两个同名但目录不同的草稿，Enter 打开 `peer-request-search` 的原会话完整原文。简体中文用 `包装50%_\验收` 得到主项目唯一匹配，Ctrl+1 打开该会话并读到符号原文。中文归档按 `Archive copper delivery` 得到原 `Historical Review`，打开后地址、只读归档状态和原请求一致。英文归档输入提示完整展示，按原题仍得到同一行。 [桌面截图](../../artifacts/2026-11-19-work-ledger-draft-request-search/README.md)
- 同一隔离数据上的九次候选公开查询均 200，覆盖活动与归档、全局与两个指定项目、单项游标、字面符号以及标题。四个会话与消息历史的回执也均 200，身份、已保存文本、创建时刻、归档时刻与基线匹配，历史均为空。命令行实际连接候选服务，活动命中两条原任务，归档命中一条。本人复核九张候选截图和三张基线截图。两个隔离服务都通过身份核对正常关闭，未发起模型请求。 [接口回执](../../artifacts/2026-11-19-work-ledger-draft-request-search/candidate-request-search-receipts.json) · [命令行回执](../../artifacts/2026-11-19-work-ledger-draft-request-search/candidate-cli-search-receipts.json)
- 后端既有与新增正式路由检查通过 9 项（80 个断言），覆盖层查询和传输检查通过 14 项（24 个断言）。覆盖层类型、双语 3236 个键、正常构建、渲染公共接口、公开路由、文档与架构检查通过。桌面验收限 Windows Chrome，分页由正式接口读取验证。未验证高记录量的查询性能或其它平台。
