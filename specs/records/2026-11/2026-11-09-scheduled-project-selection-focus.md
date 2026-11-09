# 定时项目选择的键盘焦点

## Recall

用户要求本人独立持续迭代：先查根因与影响并落盘规格，再实施、本人复核真实桌面、做聚焦正向检查、范围提交并正常同步推送。上批 `8baee1207` 正常推送退出 0，本地与上游 0/0，原 177 条工作区状态逐项相同。未授权隔离 Provider（服务商）凭据，不读取凭据/模型目录、不创建或运行定时计划，不触发 GPT-6.1 Sol。本轮只注册两组自有空项目供实际发现和编辑，不改真实用户数据。

已读 07-panel 定时目标与共享搜索合同、前批表单搜索回车及 2026-11-01-scheduled-project-identity，查历史 `49265a79a`、`7658d66b8`、`168f5d41e`。已核对 ScheduledAutomationsPanel 的 `projectChoices`、`visibleProjects`、`visibleSelectedProjects`、`applyProjectSelection`、发现、表单复位/保存、目标实体身份与服务解析器；全仓查 ListboxRoot 调用与同语义选择，读共用 Listbox/SearchField、定时样式、当前安装的 Kobalte 0.13.11 `ListboxRoot`、`createListState`、`createCollection`。定时项目和撰写器引用是当前多选 Listbox，两处有不同的目录与选取数据来源。没有找到其他同一 `selectedProjectTargets` 生产入口或需要调整的界面自动化测试；已有 `automation-project-targets.test.ts` 覆盖身份解析的局部契约，此次不改该服务。其他列表实际交互不在本批验收矩阵。

## 修改前根因及影响

前批 09 图出现选中后焦点落页根。现用独立服务 39075 的实际 `/ui`（`main-CpbC1sCL.js`）复现，真实项目发现返回两个各有稳定 ID 的隔离项目 `second-before` 和 `project-before`。打开定时新建，Selected projects，输入 `before` 匹配两个，Down 聚焦首项目：原项目元素 ID 尾号 `1125`、第二项 `1126`（01）。Space 正常从 0 选中 1，但两行 DOM（文档对象模型）身份分别变为 `1128`、`1130`，焦点落到网页根（02）；下一次 Down 没有移动到第二项（03）。取消后仍显示 `No scheduled tasks`。这与前批英文单项目现象一致，且没有计划写入。

直接触发 `applyProjectSelection` 仅改变 `selectedProjectTargets`。为保留发现源缺失的真实已选目标，`projectChoices` 同时读发现结果和已选数组；每次选取都会重建 `Map`、选项对象与 `visibleProjects` 数组，即使同一查询的可见键、元数据和目录全未变。Kobalte 将 `options` 用作 collection 数据源，重读时生成新 node，当前非虚拟列表虽然按 key 跟踪 collection 项，但 `renderItem` 仍重新收到新 node 并替换内容；实际两项 DOM 身份和焦点证明了这一控制流。`value` 已有单独的 `visibleSelectedProjects` 正常发布选取状态。`49265a79a` 修的是原生键的页面滚动与动作语义；`168f5d41e` 后来把选项投影接到已选目标以保留缺失发现项，恢复了选取对列表数据源的联动。前批把搜索 Enter 归还给搜索字段，不改变 Space、Listbox 或目标投影。

[万维网联盟（W3C）的 Listbox 键盘指引](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/#keyboard_interaction)区分焦点与选中：Space 切换当前项，Up/Down 负责移焦。当前缺陷在定时编辑的本地可见集合；无计划创建、发生轮次、队列、调度、唤醒、重试恢复、并发或终态异常。公开 API（应用程序接口）、验证、配置、持久数据库和现保存目标（注册 ID/待注册目录、可见编辑保留隐藏选取）不改。真实查询、项目发现元数据、项目顺序或可见成员变化仍必须更新；若所聚焦的真实选项已被移除，本批不发明焦点或改变当前真实列表导航。风险是错误地抑制真实项目数据更新，或与选中计数不同步；必须用真实两项目筛选与取消验证。

## 实施和验收计划

只收敛现有 `visibleProjects` 投影：按位置比较规范身份键、发现项目引用与原显示目录，等价时复用当前可见集合，使 `options` 不因选中重建，仍由 `value`、既有 Kobalte 与现选取数组发布选择。比较原显示目录保留无元数据待注册目录的真实大小写与位置变化；发现元数据换源仍更新。保留现在的未知目标、可见选择合并、计数、目录解析与 SearchField 行为；不添加缓存字段、焦点定时器、重新聚焦、并行选择实现或共用控件修改。同步 07-panel。

在真实桌面用两个发现项目从搜索 Down→Space 保持原项及可见焦点，再直接 Down→Space 选中第二项；Up/Space 去掉第一项时保留焦点。再缩窄查询使一项隐藏，核对已选总数和恢复匹配后的状态；中文重新打开并复核基本 Space、Up/Down 和取消。只使用实际桌面交互和截图本人复核；聚焦类型、语言、正常构建与文档，实际服务公开发现和定时读取、原项目文件和数据库核对，确认无任务或计划写入及模型活动。最后范围提交、普通合并、全范围核查及正常推送。

## 实施与复核

39076 实际 `/ui` 使用正常构建的 `main-_hH679O0.js`。英文查询 `after` 后 Down 把焦点给 `second-after`，两项元素 ID 尾号 `1119` 和 `1120`。Space 后显示选中 1，原 `1119` 仍聚焦且两项身份保持；下一次 Down→Space 让 `project-after` 作为第二项选中并仍聚焦原 `1120`（04–06）。Up→Space 去掉第一项，原 `1119` 保留焦点（07）。重新选中后以 `project-after` 缩窄，实际显示 1/2 项、选中总数 2（08）；Escape 清查询后两项恢复且保持选中（09）。发生真正可见成员变化时实际更新列表。中文从搜索 Up 进入末项，Space、Up、Space 连续选中两项并保留最后行的可见焦点（10），取消后回空定时列表（11）。本人复核全部 11 张桌面原图。未复测正在编辑的缺失元数据历史目标和打开时异步项目变更；保留实际身份/元数据变化的更新路径。

两阶段共 8 个真实业务读取按实际 `/doc` 响应结构检查，两组各 2 个项目的注册 ID 与目录一致，定时读取均为空。四个隔离项目的原 Git HEAD 与跟踪文件内容不变；两个数据库各只含对应两项目，均无会话、消息、执行任务、定时定义、触发、运行及 Provider 活动。两个实例均经公开 `/shutdown` 正常退出 0。正式类型、双语（2955 个键）、正常构建（51.62 秒）、文档、架构及差异检查通过。未运行界面自动化测试。见[原图及运行证据](../../artifacts/2026-11-09-scheduled-project-selection-focus/README.md)。
