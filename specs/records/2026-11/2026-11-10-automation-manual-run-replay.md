# 定时任务手动运行复用已接受的执行

## Recall

用户要求持续分批迭代，由本人独立完成，不使用子 agent。每批先有真实证据、根因和影响面，规格先落盘，再实施、做真实桌面交互和截图人工复核、聚焦正向验证，完成范围提交、上游合并和普通推送。B164 `55f5097b8` 已推送、上游 0/0，原 177 项工作区状态保持。已读根 AGENTS、[B161 Task 重发](2026-11-10-task-operator-follow-up-replay.md)、[B160 接收未确认](2026-11-10-composer-delivery-uncertain-feedback.md)、当前 `task-control-plane` Automation Fire/frontier、03-control、02-data 与 07-panel 定时页、现 `check:scheduled-automations-e2e` 实际检查器。全仓搜索 `global.automations.run`、`runNow`、`runNowWithExecutor`、`runNowFromTool`、`claim`/`poll`/`executeWithRuntimeSettlement`、Fire/attempt/Run/receipt、最新 revision/retention、所有 Run now 展示和 OpenAPI（应用接口描述）/SDK（软件开发工具包）调用、B161/B160 前端作者身份和连接作用域。无委托，外部凭据和真实 Provider 不使用；测试通过真实开发后端与本机显式流式协议，核对实际执行身份和副作用。

## 基线、根因和影响

实际隔离服务 39416，两条远期、同一真实项目的定义；本机流式端口 39417。对 `atm_g0VaWclG500yhkGuzPlj` 连续发两次完全相同的公开 `POST /global/automations/:id/run`（相同 JSON `requestID`），两次 200，分别形成 `atm_g0VaWclGR00H2q6NZQOd`、`atm_g0VaWclVb00mYCvitL2P` 两个成功 manual API Fire、两个真实 Run、两个物理 Session 和各自真实流；原 2099 年计划 Fire 保持。基线脚本第一次因把读取字段 `fireId` 写成 `id` 未保存汇总；真实两次状态、首次完整回执、`/fires`、`/runs` 和本机流已独立复核，未重复执行来修脚本。桌面通过隔离代理 39418：首次 Run now 的真实上游 200 完整 607 字节、已成功 Fire `atm_g0VaWcxMZ00hpeWVt9jJ`，代理仅交付 24 字节。定时页提示“无法读取结果，请先刷新历史”，详情仍显示从未运行，原按钮可再次点。手动再次点击收到成功并真实创建另一个成功 Fire `atm_g0VaWd1rW00pVIQgOb22`、新的 Run/Session；历史显示两次成功。见[证据](../../artifacts/2026-11-10-automation-manual-run-replay/README.md)。

公开 Run 路由没有作者请求字段，忽略提交的 JSON；`runNowWithExecutor` 在现公共校验后以进程与时间创建 lease owner，`claim(force=true)` 每次分配全新 Fire 主键并占用同一 Automation frontier。现 lease 只能拒绝同时占用同一 Automation 的独立运行；首次成功释放后，完全相同的人为重试成为新动作。前端 `serverSettledRequest` 已等待真实服务结果且没有自动重试，现读取失败提示也正确承认不确定，但仍缺少该作者动作与原 Fire 的精确绑定；刷新“最新运行”不能用来猜某一作者请求，其他用户、定时触发、多个项目或新定义都可同时推进。真实问题是幂等接收/查看边界，不是模型输出、复发时间或单个项目。

### 共享执行审计

所有生产入口：Calendar 和内部一次性 Session delay 由唯一 scheduled Fire/frontier 与精确 due/lease 进入 poll；事件和 Task wait 本身有独立触发 Fire/target owner；Tool `runNowFromTool` 已用真实 Tool Part 及输入指纹绑定其 manual Tool Fire，重复读取原结果，不使用 HTTP（超文本传输协议）作者身份。API/定时页是原 `runNow` 唯一生产入口，无 CLI（命令行界面）重复直连实现；三种 Automation origin 共用真实 `executeWithRuntimeSettlement`、Run/attempt writer、同一 Automation 物理 lease 和 frontier。Session scope 需观察当前 Prompt owner；Project scope 的多个真实 Run 按目标隔离，Global scope 用现分配生成自己的 Session；Task 和 Mission 绑定下的 delay/reopen 仍使用既有 owner/reducer，不能由公开 API 冒认内部 delay。无依赖业务侧状态的去重。

首次 API reserve 同一 immediate transaction 提交 Fire、当前 revision、frontier、物理 attempt；在 process exit、lease expiry（2 分钟）或 retry 时间后，现 poll 按精确 Fire 接管，不分配另一个。`succeeded/failed/partial/disposition` 是已落盘终态，Run 按其唯一 Fire 投影；`retry_wait` 可有原 API 已返回的目标 Run，也可能是尚无目标 Run 的基础设施失败。终态零 Run 是真实 Fire，现 run 路由抛“没有运行记录”，不能当成没有接收。Definition update/pause/delete 有同一活动 frontier 的现保护；已完成后可修改模型、目标或移除定义，exact replay 读原 revision，已删除按现公开读权限 404。不动活动 lease、重试、时钟、任务/会话终态、首次 execution permit 或 owner 边界。本批验证串并行、原 `retry_wait`/零运行事实、同键/独立键、多目标及跨 Project、冷重启/现恢复检查；任何其他真实共同失效先补规格再改。

## 实施与验收

1. `POST /global/automations/:id/run` 接收可选规范作者 `requestID`（trim 后 1–200 字符）。不提供时本次操作生成独立业务键。按 Automation 定义 ID 和作者键推导唯一 manual API Fire 主键，真正的 Fire 自身是接受权威，现 `origin=manual_api` 与 revision 不变，无 schema（数据库结构）变更、历史迁移或额外写入。只给现 claim 增加精确 Fire 身份：事务内若已有此 Fire，读取赢家；否则沿现 lease/attempt 一次承诺。不同作者键仍受现冲突规则。读取已知原 Fire 在容量和当前执行前检；终态或者现服务已可返回的 `retry_wait` Run 从原 Fire 返回真实运行投影，状态可随同一 Fire 正常演进。已接受但尚不可读目标结果给精确 typed pending（409）；真实终态零 Run 给明确 typed terminal receipt error、原 Fire ID 和状态，禁止重新运行来补回执。首次正常结果和现作用域不变，普通首次运行故障继续现失败/重试路径。新回执不改变 Tool/定时/内部入口。
2. 定时工作台在启动时为这一作者动作保存一次稳定键，在同一标签页重载/导航和同一非凭据服务地址/定义范围可读回；不同标签页的独立新点击保持独立。用现 `serverSettledRequest` 发送键。无法确认后同位置明确“重试同一次运行”，真实 pending 或无法读回执保留键；已获得可校验原回执或明确零 Run 终态后退休键，之后正常 Run now 是新用户动作。刷新列表/运行历史只读取，不替代确认；真实响应到达但刷新失败不重复启动。当前 API authority 保持请求和更新作用域，存储只含不透明业务键和不含凭据的服务器/定义身份。沿现 Error/Feedback、简体中文和英文，无 UI（用户界面）自动化。
3. 候选跑现真实 `check:scheduled-automations-e2e` 和直接相关正向检查。真实 API 校验无键独立、同键串并行、同定义不同键、跨 Project、旧 revision/后端重启、准确 409 与保留同一 Fire，以及 Task/Mission/Session 原调度入口的共享测试。真实定时页经本地代理截断原 200，人工检查可读提示、同键重试只返回原 Fire/Run/Session、运行历史只有一个；再明确发新请求证实可以新增独立运行。同步生成 SDK/文档，实际截图和持久 facts 入库。

首次候选桌面已验证重载同一标签页仍有原键，重试只显示一条成功历史。视觉复核还发现首次截断后从旧快照读到 `Last run: Never`，且重载后只剩按钮，未确认的说明消失。最终在当前选中定义确有保留请求时仍展示同一说明；旧快照没有运行时间时表明该结果未确认。任何已读取的真实运行时间照常显示，不能用运行历史猜测当前作者键。再构建并实际复核这个改动。

## 实际验收

- 最终构建 `main-D5IZotvT.js` 从真实开发后端 39419 服务。代理 39420 将首次 200 从 595 字节截为 24；英文详情显示 `Not confirmed` 和 `Retry same run`。切换简体中文、重载同一标签页、重新打开定义，仍见未确认说明与“重试同一次运行”，服务器已读取的上次运行时间正常本地化。重试的键及 Fire `atm_h3579veBQzgEbkcNMhnQ`、Run、物理 Session 与首次完整上游回执相同，实际 `/fires`、`/runs` 和截图各显示一条成功。再次明确点击“立即运行”使用新键，产生 Fire `atm_h1dld2x3sv6KS0k8focA` 和独立 Run/Session，历史两条成功，2099 年计划仍在。七张截图及结构化事实见[证据](../../artifacts/2026-11-10-automation-manual-run-replay/README.md)。
- 真实接口串行、改名换 revision 和进程重启均返回原已接受的结果。并发暂停本机流时，同键返回 409 `AutomationManualRunPendingError` 和原 Fire；独立键按现有规则返回 409 `AutomationRunningConflictError`。释放后原执行成功，同键读取该 Fire。无请求体的两次运行各自独立；同 Fire 两个项目目标各有自己的 Run，另一项目定义使用同键也是独立执行。删除后为现公开 404。候选数据库从基线备份启动，SQLite `quick_check` 为 `ok`；精确比较保留 6 Fire、4 Run、4 attempt 和 4 Session 行。
- 真实 `bun run check:scheduled-automations-e2e` 通过，`findings` 为空；检查器在真实 Session 自动化变更 revision 后取回原执行，并通过项目/全局作用域、正常触发、暂停和占用等路径。三个聚焦文件 `scheduler-automation-remediation`、`scheduler-claim-and-fire-identity`、`task-wait-fire-identity` 共 15 个用例、68 项断言，含终态无 Run 回执、精确 Mission 复开与恢复、跨目标和执行轮次。后端与界面类型检查、双语键覆盖、构建、渲染端公开接口、应用接口生成、文档及架构检查通过。真实流使用本机模型协议，未调用外部 Provider 或凭据；没有 UI 自动化。隔离标签页及 39416–39420 验证监听均已关闭。
