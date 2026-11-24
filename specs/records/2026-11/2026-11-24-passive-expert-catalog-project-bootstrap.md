# 专家团目录读取不应阻断草稿保存

## Recall

- 用户要求本人独立持续迭代，先分析并存档，再用真实桌面验收、聚焦正向检查、提交、同步上游和正常推送。用户要求把重心从同类键盘改动转向完整产品流程。第 552 批 `b1b67ebbb` 已与真实远端一致，原工作区 177 项状态保留。
- 已读[草稿流程实证](2026-11-24-mission-draft-lifecycle-review.md)、[当前扩展架构](../../current/architecture/04-extensions.md)、[项目配置架构](../../current/architecture/05-config.md)和[面板架构](../../current/architecture/07-panel.md)。全仓搜索 `/expert-squad/catalog`、`PromptProfileResolver.catalog`、`provideProjectIdentity`、`Skill.all`、`ensureGitProjectMetadata`、Project（项目）和 Session（会话）目录，以及项目目录元数据的读路由、前端创建和正式草稿准备调用。已检查应用程序接口（Application Programming Interface，API）契约与 `passive-workspace-metadata` 的现有正向测试。
- 真实 Windows 桌面使用隔离 Git 项目 `protected-ignore`，其已跟踪 `.gitignore` 有原团队规则且为只读，旁边同形的普通 Git 项目可写。验收通过真实界面保存草稿、精确接口前后读取、源文件字节和只读属性核对。项目用户数据及模型凭据不参与。

## 可观察结果、根因和影响

`41690/ui/` 加载 `main-DPV2Gw9j.js`。打开 `protected-ignore` 项目，真实文件树与 `review.txt` 原文可读。通过 Tasks（任务）进入 Save a draft（保存草稿），选 Work、填写标题和请求后，专家团显示加载失败，保存不可用。只切换到 `change-review`，相同标题、原请求和 Work 已可保存。切回受保护项目时故障重现。实际界面的请求 `81b89892-8ade-4288-8dd1-f2534796dfaa` 是 `GET /expert-squad/catalog` 500；服务日志在同次 `engine.git.ensure-project-metadata` 阶段记录打开 `.gitignore` 失败，系统错误码 `EPERM`。正式对照显示受保护项目的 `project.current`、文件内容、配置、专家团搜索、Mission Skill（多步任务技能）目录、技能挂载和草稿列表均为 200，只有实际专家团投影目录返回 500。隔离 Git 原件未变，没有草稿写入或任务执行。[桌面和接口证据](../../artifacts/2026-11-24-passive-expert-catalog-project-bootstrap/README.md)

创建表单从同一项目加载有效专家团投影和可选列表。路由上下文已经把 `GET /expert-squad/catalog` 和 `POST /mission/draft` 声明为身份权限。`resolvedCatalog` 传入准确项目或会话能力目录，但 `PromptProfileResolver.catalog` 再用完整 `Instance.provide` 读取 `Skill.all()`、查询项目安装包的 Project ID（项目标识）。即使只是读取目录，其进入的运行上下文也先执行需写入工作树的 Git 初始化，这是本次 500 的直接根因。之前的被动元数据验收有一个先经完整项目启动再退出的项目，默认 Git 文件已就绪，未覆盖冷读时 Git 初始化本身失败。现有 `Skill.all()` 从当前目录的技能目录状态读取文件及配置；项目身份权限可绑定同一目录，也允许读取同一缓存。保留既有出版版本、当前原件和读取权限，无需另造目录或后备数据。

受影响的是使用活跃目录投影的草稿作者、当前会话和专家团设置。项目安装包比内置包多一次项目标识读取，两种目录消费者必须共同使用准确项目身份。已查其他 `Instance.provide` 调用、`assertSkillMountConfig` 和 `capabilityResolutionContext`。它们属于不同的校验、执行或共享投影入口，本轮公开 `/skill/mounts` 对照成功，改动限 `catalog` 中的两处被动读取。注册、工作区 Git 策略、真实执行前的初始化、目录的公开结构/响应码、安装包选择、模型授权和持久格式无需变化。基线失败发生在首个 Git 元数据阶段，界面没有提交，真实待办列表为空。没有 Task（子任务）、Mission（多步任务）、Session 执行轮次、调度、队列、唤醒、恢复、并发或终态异常的证据。

## 方案与验收

在 `PromptProfileResolver.catalog` 使用现有项目身份上下文读取原始技能目录及项目包标识。保持沿既有实际文件、配置、发布版本和授权计算来源，保留活动包的项目标识与会话作用域。保留执行侧自己的工作区初始化及错误方式。

扩充现有真实路由聚焦验收，构造冷 Git 项目令元数据写入路径不可用，验证项目和会话目录的准确有效包、作用域及身份。重跑已有项目安装包、冷读取和身份隔离的正向检查。候选在同等只读 Git 文件状态下，用真实桌面完成表单保存、从回执打开同一个草稿并回读原请求。核对其他实际读路由、全部既有 Git 内容、已保护标志和零执行/模型请求。界面没有改动，实页仍需人工复核，对照正式构建与候选核心服务。跑核心类型、文档及架构检查，正常关停、提交、合并上游并推送。
