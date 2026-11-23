# 侧栏项目展开按钮指向各自内容

## Recall

用户要求本人持续、独立地迭代 OpenCorvus。每批先从可核对现象分析根因和影响并落盘，后实施、真实桌面交互和人工截图复核、聚焦正向检查、范围提交、合并上游再普通推送。前批 `05dead16f` 已与 `origin/main` 一致，0/0，原 177 项工作区状态逐条保留。本批三个隔离 Git 项目使用自建文件，三个隔离对话各零消息，正式创建和标题更新均由产品已有接口完成，没有模型、凭据或用户项目。

已读工作侧栏公开合同、`WorkLedger` 的 `LedgerList`、置顶分区和项目展开状态，`ProjectLedgerGroup` 的按钮、项目导航、内容挂载和焦点归还，以及 `FileChangesView` 的现行唯一标识用法。全仓检索 `projectLedgerGroupBodyElementID`、`project-group-body`、`project-group-toggle`、`createProjectLedgerGroupCollapseState`、`aria-controls` 及 `ProjectLedgerGroup` 生产引用、旧记录、样式和正向项目测试。`WorkLedger` 是唯一使用者，置顶和普通分区都通过这一组件，样式及原焦点选择只查类、控件标记或项目目录。历史提交 65d0bfc98 已含原标识生成，既有项目名称、计数、目录提示和展开键盘修复继续使用不同职责。当前路径未见界面自动化测试。 [界面合同](../../current/architecture/07-panel.md) · [导航和披露入口](2026-11-03-project-tree-navigation.md) · [键盘展开](2026-11-10-sidebar-project-expand-keyboard.md)

## 实施前证据、根因和影响

真实开发页面 `40560/ui/` 载入 `main-DTMBeKuP.js`。正式项目接口分别接受同一父路径下的 `研发`、`测试`、`reference`，并返回三个项目身份。各目录的实际工作侧栏分别出现 Cedar research notes、River validation notes 和 Reference catalog。英文截图中三个可见分组都保持自己的内容。只读关联核对发现「Collapse 研发」与「Collapse 测试」`aria-controls` 相同，有两个元素持有该标识，实际查找首个匹配落在「测试」的 River validation notes 上。原始普通目录 `reference` 精确关联自己一项。按回车折叠「研发」时焦点留在该按钮，「测试」的可见会话保持；按空格重新展开后重复关联随之恢复。切换简中后可见标签更新，实际错误关系相同。 [三张截图和真实页面关联](../../artifacts/2026-11-23-sidebar-project-disclosure-identity/README.md)

`projectLedgerGroupBodyElementID` 把当前目录身份和展示标记拼在一起，再用窄字符集替换所有其他连续字符。两个不同目录的中文末段都变成同样的连接符；对该函数而言，共享父路径下其他仅受替换的名称也可能重合。项目选择、折叠状态和持久化仍使用原始项目目录身份，所以鼠标和键盘可以显示正确内容，仍会留下歧义的无障碍关联。此前的目录区别着眼于人识别名称，之前键盘修复着眼于焦点，二者都未修改标识投影。已观察到页面关系歧义和错误目标。具体屏幕阅读器会如何朗读或导航尚未验证。W3C（World Wide Web Consortium，万维网联盟）的披露规范要求提供 `aria-controls` 时指向受该按钮控制的完整内容。 [披露规范](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)

影响落在普通和置顶侧栏项目的无障碍内容关系。仍按既有目录键切换展开状态，用自己的标题打开原项目。项目名称、排序、分区、实际目录、会话内容、路径准入、公共服务接口、存储和模型无需变化。风险在于折叠时引用未挂载内容、重新展开时标识改变、移动分区或换语言后关联指向错误项目。未发现会话、任务或多步任务的执行轮次、队列、唤醒、恢复、并发或终态收敛异常。

## 方案和验收

1. 复用 Solid 的 `createUniqueId` 为每个 `ProjectLedgerGroup` 挂载实例生成唯一内容标识，用于同一按钮和其直属正文。移除目录字符串投影。展开时给出关系，折叠时保持现有卸载和展开状态合同。组件重新挂载时允许产生新标识，目录身份和定位行为继续沿原来源。 [Solid 标识接口](https://docs.solidjs.com/reference/solid-js/components-context/create-unique-id/)
2. 用最后候选 `40562/ui/` 的同样三份实际项目和对话，验收英文、简中实际键盘展开和折叠、各自的可见会话，补充核对每个按钮的唯一匹配和标题。观察同一组件折叠、重新展开及语言替换期间的关联；真实操作把一个项目迁入置顶，核对对应分区、原会话与另一项目，再撤销置顶恢复原元数据。点项目名或其会话，确认原作用域，保留截图逐张人工查看。
3. 跑现有聚焦项目身份、路径区别和工作列表读取契约，以及类型、双语、正常构建、文档和架构索引。核对每个项目文件、正式对话来源与空消息；结束两个自有服务，确认原句柄和端口，完整核对提交及工作区。界面自动化和真实模型调用不适用于此批。
