# 保存会话设置与项目执行准备

## Recall

用户要求本人独立持续分批迭代，先完成根因与影响并落盘，再作有证据的修改、真实桌面操作和截图复核、聚焦正向验证、范围提交、合并与正常推送。`1509dee74` 已与远端一致，保留 177 项原工作区状态。已读 [会话配置读取](2026-11-24-passive-session-config-read.md)、[草稿路径](2026-11-24-passive-expert-catalog-project-bootstrap.md)、[配置架构](../../current/architecture/05-config.md)、专家团详情、会话覆盖的前端调用、正式路由、`Session.prepareConfigOverlayMergeInProject`、事务提交和缓存重置。全仓查 `patchSessionConfig`、`session.config.update`、模型与专家团配置验证、项目身份与运行权限、真实任务绑定和会话设置用例。两条自建草稿始终待办，不发消息或调用模型。

## 基线、根因与影响

- `41760/ui/` 加载 `main-DPV2Gw9j.js`。实际打开 `protected-ignore` 的已保存待办，在已安装专家团详情中为该会话选择 Base。页面可读项目和会话有效配置，点击 `Set Session Override` 后服务返回 500，请求 `09341229-7de6-494e-9b9a-38421dfdf40b` 对应完整项目准备中的 `EPERM`，试图打开已有只读 `.gitignore`。正式读取此后仍是项目来源、项目和会话均有效 `dynamic`。在普通项目走同一操作，正式请求 `d314f69e-9c2c-4fb0-ac4b-65abab51a8a7` 返回 200，重新打开已持久化的 `base` 会话覆盖，项目默认仍是 `dynamic`。[实际界面与请求](../../artifacts/2026-11-24-session-override-project-startup/README.md)
- 根因在精确 PATCH（部分更新请求）的权限和共享数据读取。路由进入完整运行准备，既有 BASE 项目验证与 Git 写入一同成为前置。处理器只验证当前会话及模型、专家团配置，写持久覆盖、释放或更新派生缓存，再返回当前覆盖来源。共享覆盖准备又用 `Instance.provide` 读取拥有项目的 `Config.get`，所以仅修改路由中间件仍可能通过这里进入运行准备。前几批修复的会话读取和专家团目录能正确展示当前数据，覆盖写入尚留上述两个入口。
- 影响会话级专家团、模型和同路由其他合法覆盖，包括清除已有覆盖。保留根会话和真实项目归属、未知模型的既有错误、活跃专家团和技能挂载校验、Task（任务）固定专家团绑定、事务内并发检查、事件和缓存重置。共享准备还被 Task 消息和 Mission（多步任务）运行入口调用，它们各自已有明确运行权限与消息、附件、覆盖、唤醒入场的原事务。会话编辑不打开或关闭 Task/Mission/Session（任务/多步任务/会话）执行轮次。基线未发现其他共享调度、队列、唤醒、恢复或终态异常；候选另用已有正向测试复验共享提交。

### 执行准备的技能挂载回归

按前述 Recall 增设正向复现时，给现有保护规则用例加入合法的 `skill_mounts: {}`，第一次覆盖写入在 Git 阶段之前返回 400 `ConfigCandidateValidationError`。原始断言捕获 `Cannot provide project identity recursively while instance capability preflight is active`。前一批 `d4c46525f` 将默认技能目录改为用项目身份读取，解决了被动读取请求的 Git 准备问题，但没有覆盖完整运行入口持有同目录生命周期权限时的行为。`prepareCapabilityPreflight` 已用有效租约安装当前 `ProjectInstanceContext`，之后 `validateConfigCandidate` 在 `skill_mounts` 存在时再次调用 `assertSkillMountConfig`，其 `provideProjectIdentity` 在同一目录排队或重入之前触发递归保护。失败发生在 Git、可选运行器及所有活动提交之前，合法配置内容没有触发实际技能条目的错误。

横向查阅 `server/server.ts` 的身份与执行权限分流、`project/bootstrap.ts` 的配置校验与运行恢复、`config/candidate-validation.ts` 的模型/专家团/技能验证、`instance.ts` 的外部和继承租约准备、Task 消息事务和 Mission 运行提交。该准备被普通 Session、Task 运行目录和 Mission 执行请求共用。受影响条件是完整准备进入含 `skill_mounts` 的同一项目根目录。另一个工作目录或项目仍必须在真实拥有目录选择技能来源。失败不会接收入参、消费草稿或推进任何现有执行轮次。写入覆盖的事务及 Task/Mission（任务/多步任务）消息、唤醒和终态机制本身继续按现有路径复验；此次基线没有启动模型或构造正在运行的任务。

独立可写项目用 `skill_mounts: {base: {orchestrator: {}}}` 冷开正式路由，`GET /config` 已返回 200 及该对象，随后 `GET /channel/runtime` 返回同一具名 400 和递归错误。命令为 `bun test test/server/passive-workspace-metadata.test.ts -t 'explicit skill mounts'`。两项断言分别观察到配置读取成功和完整准备失败，排除了物理 Git 保护规则这一触发条件。

## 实施与验收

将精确 PATCH 放在已有项目身份权限。与 GET 共用原项目基础配置校验及其技能目录、会话能力引用读取权限，保留现有覆盖预览验证、源归属、返回、事务、事件、重置及主动运行入口。共享覆盖准备按同一个拥有项目、同一 `Config.get` 在身份范围读基础配置。复用正式根会话、草稿和保护规则夹具验证写入、确切来源及清除。保留无效模型、固定 Task 绑定和外项目约束。正向检查先证明旧完整项目准备拒绝合法写入。

技能挂载验证优先使用调用者已经提供的技能目录；当前有效项目目录与所需目录匹配时直接读取当前技能目录，其他目录仍用项目身份进入。保留生命周期递归保护和已有项目路径比较。候选须在普通可写项目冷启动，使用真实运行路由验证显式技能挂载配置可进入运行上下文。保护规则用例覆盖同项目会话保存、清除及另一路径的原具名模型错误。再运行现有实例准备、Task 原子入场和 Mission 唤醒用例。

候选真实桌面在两个隔离项目打开相同入口。在受保护项目写入 Base、重新打开确认已持久化与同一草稿，清除恢复项目来源，再核对另一个项目状态、只读规则和真实会话数据库的零执行事实。对照正式响应、配置来源、原 Git 文件和缓存/事件合同，关闭专用窗口和服务，完成文档、类型、聚焦检查及普通推送。
