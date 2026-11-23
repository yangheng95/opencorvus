# 从项目笔记结果返回搜索草稿

## Recall

用户要求本人独立持续迭代。每批先体验、调查根因和影响并落盘，再实施、本人真实桌面操作和截图复核、聚焦正向检查、范围提交、合并最新上游及普通推送。第 497 批 `26cc5ce51` 已核对上游与本地 0/0，原 177 项状态保留。本批使用自有隔离项目和通过正式 `Memory.writeFile` 写入的三条测试笔记，读取和搜索不使用凭据或模型。

已读 [项目记忆架构](../../current/architecture/project-memory.md)、[已提交笔记搜索的结果导航](2026-11-23-memory-note-result-navigation.md)、[实际提交词的归属](2026-11-23-memory-submitted-search-query.md)、[笔记退出搜索](2026-11-09-memory-return-to-list-retires-results.md) 和 [目录结果返回搜索](2026-11-24-catalog-results-return-to-search.md)。全仓核对 `MemoryPanel` 唯一挂载的 `MemoryContextPanel`、`memorySearch`、`hasSearchResults`、`canEnterSearchResults`、`submittedQuery`、`handleSearchClear`、原文读取、共享 `returnToSearch`、现有本地化搜索提示、公开笔记接口和相关聚焦检查。相关路径无界面自动化。

## 实施前根因与影响

真实 `41140/ui/` 加载 `main-CzfRgA4S.js`。英文 100% 按 Enter 提交 `trailregister` 得到三条，Down 两次聚焦 East Landing，Enter 展开准确原文。焦点在展开按钮时按 Escape 退出设置。重开记忆页时搜索框为空，原已提交结果与展开状态消失。简体中文 160% 提交同一词后，将输入改成 `footbridgeroute` 而未提交。此时 Up 仍在输入，正文标明实际提交的是 `trailregister`。三次 Tab 到第一条长标记的实际结果，Escape 同样退出设置，未提交草稿与已接受结果都丢失。正式接口确认原三份笔记的项目、标识和内容，数据仍正确。 [真实桌面基线](../../artifacts/2026-11-24-memory-result-return-to-search/README.md)

面板负责独立保存当前输入、已提交查询、已接受结果及展开原文。`hasSearchResults` 允许浏览当前来源的已接受结果，`canEnterSearchResults` 另要求输入的当前草稿仍对应已提交词，避免编辑新词时方向键进入旧查询。后者未阻止正常 Tab 进入旧结果。真实结果的共享键处理未提供搜索输入，Escape 冒泡到设置窗口关闭，面板卸载回收局部状态。既有输入 Escape 是清除和重新读取普通列表，只在键真正落在输入时生效。此前的归属、保持旧结果和结果导航各自正确，缺少结果到同一输入的返程。无提交请求竞态，也未见执行、调度、队列、唤醒、恢复或终态异常。

影响限实际已接受搜索的有效笔记按钮与可编辑输入、结果状态区的真实双语提示及项目记忆架构。返回保留原稿、已提交查询、结果身份、顺序和已展开原文。Enter 显式提交、输入 Escape 清除、正常 Tab、普通列表、独立删除和只读原文、来源及连接归属、退出后的数据、API（应用程序编程接口）、权限、持久格式和模型均沿当前路径。

## 实施和验收方案

把现有 `searchInput` 提供给共享导航，沿现有实际接受结果范围消费未处理的普通 Escape，保留焦点和状态的当前单一来源。继续用 `canEnterSearchResults` 决定输入到首末结果的方向键和原无障碍描述。已接受结果显示独立的返回提示，明确是从结果返回搜索，未提交稿仍不显示输入方向键提示。启用实际结果声明 Escape 快捷键。由浏览器自然滚动使输入和相邻状态可见，不引入新的查询或状态变量。

用真实英文 100% 和简体中文 160% 检查已提交三项及真实原文、结果 Escape 回原输入并保留展开状态、长列表低位结果回到输入视区。中文稿与已提交词不同时，从正常 Tab 进入旧结果再返回，原稿和旧结果继续同时可见。直接 Enter 提交新词得到准确 West Footbridge 和原正文，空结果、输入清除回三条普通笔记、普通行 Escape 与原 Tab 路径保持现有行为。用正式列表、四种搜索、逐项原文和 SQLite（嵌入式数据库）验证原数据与范围。运行现有搜索、项目归属、类型、双语、样式、真实构建、文档和架构检查，逐张复核并正常关闭后范围提交和普通同步。
